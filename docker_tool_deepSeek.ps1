<#
.SYNOPSIS
    Docker Tools - Versión Nativa Windows PowerShell
    Enfoque: Robustez, Refactorización y UX/UI completamente en PowerShell
.DESCRIPTION
    Herramienta completa para gestión de Docker en Windows sin dependencias Unix
.NOTES
    Requiere: Docker Desktop para Windows con PowerShell 5.1+
#>

# ==================================================
# CONFIGURACIÓN Y CONSTANTES
# ==================================================

# Configuración de colores para PowerShell
$global:RED = "`e[91m"
$global:GREEN = "`e[92m"
$global:YELLOW = "`e[93m"
$global:BLUE = "`e[94m"
$global:MAGENTA = "`e[95m"
$global:CYAN = "`e[96m"
$global:WHITE = "`e[97m"
$global:BOLD = "`e[1m"
$global:NC = "`e[0m"

# Emojis consistentes para feedback
$global:ICON_SUCCESS = "✅"
$global:ICON_ERROR = "❌"
$global:ICON_WARNING = "⚠️"
$global:ICON_INFO = "ℹ️"
$global:ICON_QUESTION = "👉"
$global:ICON_CONTAINER = "📦"
$global:ICON_DOCKER = "🐳"
$global:ICON_MENU = "📋"
$global:ICON_SETTINGS = "⚙️"

# Variables globales
$global:ENV = "dev"
$global:PROJECT_NAME = ""
$global:STACK = ""
$global:LABEL_FILTER = ""
$global:COMPOSE_FILE = ""
$global:CURRENT_IP = ""
$global:BACKUP_DIR = "docker-backups"
$global:COMPOSE_CMD = "docker compose"
$global:SELECTED_PROFILE_ARGS = ""
$global:SELECTED_SERVICE_ARGS = ""
$global:SELECTED_CONTAINER_ID = ""
$global:SELECTED_CONTAINER_NAME = ""
$global:STACK_CONTAINERS = @()
$global:STACK_CONTAINER_COUNT = 0

# Configuración de Portainer
$global:PORTAINER_NAME = "portainer"
$global:PORTAINER_IMAGE = "portainer/portainer-ce:latest"

# ==================================================
# FUNCIONES DE UTILIDAD POWERSHELL
# ==================================================

function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = $global:NC
    )
    Write-Host "$Color$Message$($global:NC)" -NoNewline
}

function Write-Success {
    param([string]$Message)
    Write-Host "$($global:GREEN)$($global:ICON_SUCCESS) $Message$($global:NC)"
}

function Write-Error {
    param([string]$Message)
    Write-Host "$($global:RED)$($global:ICON_ERROR) $Message$($global:NC)"
}

function Write-Warning {
    param([string]$Message)
    Write-Host "$($global:YELLOW)$($global:ICON_WARNING) $Message$($global:NC)"
}

function Write-Info {
    param([string]$Message)
    Write-Host "$($global:BLUE)$($global:ICON_INFO) $Message$($global:NC)"
}

function Write-Step {
    param([string]$Message)
    Write-Host "$($global:CYAN)▶ $Message$($global:NC)"
}

function Clear-Screen {
    Clear-Host
}

function Pause-Menu {
    Write-Host ""
    Read-Host "$($global:CYAN)Presione Enter para continuar...$($global:NC)"
}

# ==================================================
# FUNCIONES DE LECTURA DE ARCHIVOS .ENV
# ==================================================

function Read-EnvValue {
    param(
        [string]$Key,
        [string]$DefaultValue = ""
    )
    
    $value = ""
    $envFiles = @(".env", ".env.$global:ENV")
    
    foreach ($envFile in $envFiles) {
        if (Test-Path $envFile) {
            $lines = Get-Content $envFile -ErrorAction SilentlyContinue
            foreach ($line in $lines) {
                if ($line -match "^$Key=(.*)$") {
                    $value = $matches[1].Trim().Trim('"')
                    break
                }
            }
        }
        if ($value) { break }
    }
    
    if ($value) { return $value }
    return $DefaultValue
}

function Read-ProjectName {
    $envFile = ".env"
    
    if (Test-Path $envFile) {
        $lines = Get-Content $envFile -ErrorAction SilentlyContinue
        foreach ($line in $lines) {
            if ($line -match "^PROJECT_NAME=(.*)$") {
                return $matches[1].Trim().Trim('"')
            }
        }
    }
    return ""
}

function Get-RuntimeDataRoot {
    return (Read-EnvValue "DATA_ROOT" "./APP/data/$($global:ENV)")
}

function Get-RuntimeLogsRoot {
    return (Read-EnvValue "LOGS_ROOT" "./APP/logs/$($global:ENV)")
}

function Get-RuntimeVolumesRoot {
    return (Read-EnvValue "VOLUMES_ROOT" "./APP/volumes")
}

# ==================================================
# FUNCIONES DE DOCKER COMPOSE
# ==================================================

function Define-ComposeFile {
    switch ($global:ENV) {
        "dev" { $global:COMPOSE_FILE = "docker-compose-dev.yml" }
        "qa" { $global:COMPOSE_FILE = "docker-compose-qa.yml" }
        "prd" { $global:COMPOSE_FILE = "docker-compose.yml" }
        default {
            Write-Warning "Entorno no válido. Se usará docker-compose-dev.yml"
            $global:COMPOSE_FILE = "docker-compose-dev.yml"
        }
    }
}

function Build-ComposeCmd {
    param(
        [string]$Action,
        [string]$ProfileArgs = "",
        [string]$ServiceArgs = ""
    )
    
    $cmd = "$global:COMPOSE_CMD -f $global:COMPOSE_FILE --env-file .env --env-file .env.$($global:ENV)"
    if ($ProfileArgs) { $cmd += " $ProfileArgs" }
    $cmd += " $Action"
    if ($ServiceArgs) { $cmd += " $ServiceArgs" }
    return $cmd
}

function Get-AllComposeProfileArgs {
    if (-not (Test-Path $global:COMPOSE_FILE)) { return "" }
    
    $profiles = @()
    $content = Get-Content $global:COMPOSE_FILE -Raw -ErrorAction SilentlyContinue
    $matches = [regex]::Matches($content, 'profiles:\s*\[([^\]]+)\]')
    
    foreach ($match in $matches) {
        $profileList = $match.Groups[1].Value -split ',' | ForEach-Object { 
            $_.Trim().Trim("'").Trim('"') 
        }
        $profiles += $profileList
    }
    
    $profiles = $profiles | Sort-Object -Unique
    if ($profiles.Count -eq 0) { return "" }
    
    return ($profiles | ForEach-Object { "--profile $_" }) -join " "
}

function Build-FullStackDownCmd {
    param([string]$DownAction = "down")
    $allProfiles = Get-AllComposeProfileArgs
    return Build-ComposeCmd $DownAction $allProfiles
}

# ==================================================
# FUNCIONES DE LISTADO DE SERVICIOS
# ==================================================

function Get-ServiceBlockFromCompose {
    param(
        [string]$ComposeFile,
        [string]$ServiceName
    )
    
    if (-not (Test-Path $ComposeFile)) { return "" }
    
    $content = Get-Content $ComposeFile -Raw
    $pattern = "(?s)services:\s*\n.*?\n\s+${ServiceName}:\s*\n(.*?)(?=\n\s+[a-zA-Z0-9_-]+:|\n\s*$)"
    $match = [regex]::Match($content, $pattern)
    
    if ($match.Success) {
        return "$ServiceName`:$($match.Groups[1].Value)"
    }
    return ""
}

function List-ServicesByGroup {
    param([string]$TargetGroup = "all")
    
    $services = @()
    $config = Invoke-Expression "$(Build-ComposeCmd 'config --services' '--profile tools')" 2>$null
    
    if (-not $config) { return @() }
    
    $serviceNames = $config -split "`r`n" | Where-Object { $_ -and $_.Trim() }
    
    foreach ($serviceName in $serviceNames) {
        $serviceBlock = Get-ServiceBlockFromCompose $global:COMPOSE_FILE $serviceName
        $groupValue = ""
        
        if ($serviceBlock) {
            $lines = $serviceBlock -split "`r`n"
            foreach ($line in $lines) {
                if ($line -match 'service\.group:\s*(.+)') {
                    $groupValue = $matches[1].Trim()
                    break
                }
            }
        }
        
        if ($TargetGroup -eq "all" -or $groupValue -eq $TargetGroup) {
            $services += $serviceName
        }
    }
    
    return $services
}

# ==================================================
# FUNCIONES DE VALIDACIÓN
# ==================================================

function Validate-ComposeEnvFiles {
    $missingFiles = @()
    
    foreach ($envFile in @(".env", ".env.$($global:ENV)")) {
        if (-not (Test-Path $envFile)) {
            $missingFiles += $envFile
        }
    }
    
    if ($missingFiles.Count -gt 0) {
        Write-Error "Faltan archivos de entorno requeridos:"
        foreach ($file in $missingFiles) {
            Write-Host "$($global:RED)   └─ $file$($global:NC)"
        }
        Write-Host ""
        Write-Warning "Cree los archivos locales a partir de .env.example"
        return $false
    }
    
    # Extraer variables requeridas del compose file
    if (Test-Path $global:COMPOSE_FILE) {
        $content = Get-Content $global:COMPOSE_FILE -Raw
        $matches = [regex]::Matches($content, '\$\{([A-Z0-9_]+)(?::-[^}]*)?\}')
        $requiredVars = @()
        
        foreach ($match in $matches) {
            $requiredVars += $match.Groups[1].Value
        }
        $requiredVars = $requiredVars | Sort-Object -Unique
        
        $optionalEmptyVars = @("ITOP_PACKAGE_URL")
        $missingVars = @()
        
        foreach ($varName in $requiredVars) {
            if ($optionalEmptyVars -contains $varName) { continue }
            $value = Read-EnvValue $varName
            if (-not $value) {
                $missingVars += $varName
            }
        }
        
        if ($missingVars.Count -gt 0) {
            Write-Error "Variables requeridas sin valor para $($global:COMPOSE_FILE):"
            foreach ($varName in $missingVars) {
                Write-Host "$($global:RED)   └─ $varName$($global:NC)"
            }
            return $false
        }
    }
    
    return $true
}

function Validate-Compose {
    Clear-Screen
    Write-Host "$($global:CYAN)$($global:BOLD)═══════════════════════════════════════════════════════════$($global:NC)"
    Write-Host "$($global:CYAN)$($global:BOLD)              VALIDAR DOCKER COMPOSE$($global:NC)"
    Write-Host "$($global:CYAN)$($global:BOLD)═══════════════════════════════════════════════════════════$($global:NC)"
    Write-Host ""
    
    if (-not (Test-Path $global:COMPOSE_FILE)) {
        Write-Error "Archivo no encontrado: $($global:COMPOSE_FILE)"
        Pause-Menu
        return
    }
    
    if (-not (Validate-ComposeEnvFiles)) {
        Pause-Menu
        return
    }
    
    Write-Step "Validando configuración..."
    Write-Host ""
    
    $config = Invoke-Expression "$(Build-ComposeCmd 'config')" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Success "VALIDACIÓN EXITOSA"
        Write-Host ""
        Write-Info "SERVICIOS CONFIGURADOS:"
        $services = Invoke-Expression "$(Build-ComposeCmd 'config --services')" 2>$null
        if ($services) {
            $services -split "`r`n" | ForEach-Object { Write-Host "   • $_" }
        }
    } else {
        Write-Error "ERROR DE VALIDACIÓN"
        Write-Host ""
        Write-Host $config
    }
    
    Pause-Menu
}

function Ask-ServiceGroups {
    $global:SELECTED_PROFILE_ARGS = ""
    $global:SELECTED_SERVICE_ARGS = ""
    
    $coreServices = List-ServicesByGroup "core"
    $dependencyServices = List-ServicesByGroup "dependency"
    $toolsServices = List-ServicesByGroup "tools"
    
    $selectedServices = @($coreServices)
    
    Write-Host ""
    Write-Host "$($global:CYAN)$($global:BOLD)🧩 ALCANCE DEL LEVANTE$($global:NC)"
    Write-Host "$($global:CYAN)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$($global:NC)"
    Write-Host "El grupo base para el entorno $($global:BOLD)$($global:ENV)$($global:NC) sera siempre $($global:BOLD)core$($global:NC)."
    Write-Host ""
    
    if ($dependencyServices.Count -gt 0) {
        Write-Host "Dependencias disponibles:"
        foreach ($svc in $dependencyServices) {
            Write-Host "   • $svc"
        }
        Write-Host ""
        $response = Read-Host "$($global:CYAN)¿Desea anexar también dependency? [s/N]:$($global:NC)"
        if ($response -eq "s" -or $response -eq "S") {
            $selectedServices += $dependencyServices
        }
    }
    
    if ($toolsServices.Count -gt 0) {
        Write-Host ""
        Write-Host "Herramientas disponibles:"
        foreach ($svc in $toolsServices) {
            Write-Host "   • $svc"
        }
        Write-Host ""
        $response = Read-Host "$($global:CYAN)¿Desea anexar también tools? [s/N]:$($global:NC)"
        if ($response -eq "s" -or $response -eq "S") {
            $global:SELECTED_PROFILE_ARGS = "--profile tools"
            $selectedServices += $toolsServices
        }
    }
    
    Write-Host ""
    Write-Warning "Docker Compose puede iniciar dependencias tecnicas adicionales cuando corresponda."
    
    if ($selectedServices.Count -gt 0) {
        $global:SELECTED_SERVICE_ARGS = $selectedServices -join " "
    }
}

# ==================================================
# FUNCIONES DE CONTENEDORES
# ==================================================

function List-StackContainers {
    param(
        [string]$Format = "simple",
        [bool]$IncludeAll = $false
    )
    
    $dockerCmd = "docker ps"
    if ($IncludeAll) { $dockerCmd = "docker ps -a" }
    
    $containers = @()
    $output = Invoke-Expression "$dockerCmd --filter 'label=$($global:LABEL_FILTER)' --format '{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}'" 2>$null
    
    if (-not $output) {
        Write-Warning "No se encontraron contenedores con la etiqueta: $($global:LABEL_FILTER)"
        return $false
    }
    
    $containers = $output -split "`r`n" | Where-Object { $_ -and $_.Trim() }
    
    if ($containers.Count -eq 0) {
        Write-Warning "No se encontraron contenedores con la etiqueta: $($global:LABEL_FILTER)"
        return $false
    }
    
    Write-Host ""
    
    if ($Format -eq "simple") {
        Write-Host "$($global:BOLD)#   NOMBRE                      ESTADO$($global:NC)"
        Write-Host "----------------------------------------------------"
        $i = 1
        foreach ($container in $containers) {
            $parts = $container -split '\|'
            $name = $parts[1]
            $status = $parts[3]
            $statusColor = if ($status -like "*Exited*") { $global:RED } elseif ($status -like "*Paused*") { $global:YELLOW } else { $global:GREEN }
            Write-Host ("{0,-4} {1,-25} $statusColor{2,-15}$($global:NC)" -f $i, $name, $status)
            $i++
        }
    } else {
        Write-Host "$($global:BOLD)#   NOMBRE                      IMAGEN                         ESTADO           PUERTOS$($global:NC)"
        Write-Host "------------------------------------------------------------------------------------------------------------------"
        $i = 1
        foreach ($container in $containers) {
            $parts = $container -split '\|'
            $id = $parts[0]
            $name = $parts[1]
            $image = $parts[2]
            $status = $parts[3]
            $ports = if ($parts.Count -gt 4) { $parts[4] } else { "" }
            $statusColor = if ($status -like "*Exited*") { $global:RED } elseif ($status -like "*Paused*") { $global:YELLOW } else { $global:GREEN }
            Write-Host ("{0,-4} {1,-25} {2,-30} $statusColor{3,-15}$($global:NC) {4,-25}" -f $i, $name, $image, $status, $ports)
            $i++
        }
    }
    
    $global:STACK_CONTAINERS = $containers
    $global:STACK_CONTAINER_COUNT = $containers.Count
    return $true
}

function Select-ContainerFromStack {
    param(
        [string]$Prompt = "Seleccione el número del contenedor",
        [bool]$AllowExit = $true,
        [bool]$ShowAll = $false
    )
    
    Write-Host ""
    Write-Host "$($global:CYAN)$($global:BOLD)📋 CONTENEDORES DISPONIBLES:$($global:NC)"
    
    if (-not (List-StackContainers "detailed" $ShowAll)) {
        return $false
    }
    
    $exitIndex = $global:STACK_CONTAINER_COUNT + 1
    Write-Host ""
    
    if ($AllowExit) {
        Write-Host "$($global:YELLOW)$exitIndex) ⬅️ Volver al menú anterior$($global:NC)"
    }
    
    Write-Host ""
    $index = Read-Host "$($global:CYAN)$Prompt$($global:NC)"
    
    if ($AllowExit -and ($index -eq $exitIndex -or $index -eq "0")) {
        return $null  # Special code for back
    }
    
    if (-not ($index -match '^\d+$') -or [int]$index -lt 1 -or [int]$index -gt $global:STACK_CONTAINER_COUNT) {
        Write-Error "Índice inválido. Debe ser un número entre 1 y $($global:STACK_CONTAINER_COUNT)"
        Start-Sleep -Seconds 2
        return $false
    }
    
    $parts = $global:STACK_CONTAINERS[[int]$index - 1] -split '\|'
    $global:SELECTED_CONTAINER_ID = $parts[0]
    $global:SELECTED_CONTAINER_NAME = $parts[1]
    
    Write-Success "Seleccionado: $($global:SELECTED_CONTAINER_NAME)"
    return $true
}

function Confirm-Action {
    param(
        [string]$Message,
        [string]$Default = "no"
    )
    
    Write-Host ""
    Write-Host "$($global:YELLOW)$($global:BOLD)⚠️  CONFIRMACIÓN REQUERIDA$($global:NC)"
    Write-Host "$($global:YELLOW)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$($global:NC)"
    Write-Host "$($global:YELLOW)$Message$($global:NC)"
    Write-Host ""
    
    if ($Default -eq "si") {
        $response = Read-Host "$($global:CYAN)¿Continuar? [S/n]:$($global:NC)"
        if ($response -eq "") { $response = "S" }
    } else {
        $response = Read-Host "$($global:CYAN)¿Continuar? [s/N]:$($global:NC)"
        if ($response -eq "") { $response = "N" }
    }
    
    if ($response -eq "S" -or $response -eq "s") {
        Write-Info "Procediendo..."
        return $true
    } else {
        Write-Info "Operación cancelada"
        return $false
    }
}

function Invoke-RunCmd {
    param(
        [string]$Command,
        [string]$ErrorMessage = "Error al ejecutar el comando",
        [string]$SuccessMessage = "Comando ejecutado exitosamente"
    )
    
    Write-Step "Ejecutando: $Command"
    Write-Host "$($global:CYAN)────────────────────────────────────────────────$($global:NC)"
    
    Invoke-Expression $Command
    $exitCode = $LASTEXITCODE
    
    Write-Host "$($global:CYAN)────────────────────────────────────────────────$($global:NC)"
    
    if ($exitCode -ne 0) {
        Write-Error "$ErrorMessage (código: $exitCode)"
        return $exitCode
    }
    
    Write-Success $SuccessMessage
    return 0
}

function Check-StackContainers {
    $output = docker ps --filter "label=$($global:LABEL_FILTER)" -q 2>$null
    if (-not $output) {
        Write-Warning "No hay contenedores activos con etiqueta: $($global:LABEL_FILTER)"
        Write-Info "Use la opción 1 del menú principal para iniciarlos"
        return $false
    }
    return $true
}

# ==================================================
# FUNCIONES DE ACCIÓN PRINCIPALES
# ==================================================

function Start-Containers {
    Clear-Screen
    Write-Host "$($global:CYAN)$($global:BOLD)═══════════════════════════════════════════════════════════$($global:NC)"
    Write-Host "$($global:CYAN)$($global:BOLD)              INICIAR CONTENEDORES$($global:NC)"
    Write-Host "$($global:CYAN)$($global:BOLD)═══════════════════════════════════════════════════════════$($global:NC)"
    Write-Host ""
    
    if (-not (Validate-ComposeEnvFiles)) {
        Pause-Menu
        return
    }
    
    Ask-ServiceGroups
    Invoke-RunCmd (Build-ComposeCmd "up -d --build" $global:SELECTED_PROFILE_ARGS $global:SELECTED_SERVICE_ARGS) `
        "Error al iniciar contenedores" `
        "Contenedores iniciados exitosamente"
    
    Pause-Menu
}

function Stop-Containers {
    Clear-Screen
    Write-Host "$($global:CYAN)$($global:BOLD)═══════════════════════════════════════════════════════════$($global:NC)"
    Write-Host "$($global:CYAN)$($global:BOLD)              DETENER CONTENEDORES$($global:NC)"
    Write-Host "$($global:CYAN)$($global:BOLD)═══════════════════════════════════════════════════════════$($global:NC)"
    Write-Host ""
    
    if (-not (Validate-ComposeEnvFiles)) {
        Pause-Menu
        return
    }
    
    if (Confirm-Action "¿Detener y eliminar todos los contenedores del stack?" "no") {
        Invoke-RunCmd (Build-FullStackDownCmd "down") `
            "Error al detener contenedores" `
            "Contenedores detenidos exitosamente"
    }
    
    Pause-Menu
}

function Restart-Containers {
    Clear-Screen
    Write-Host "$($global:CYAN)$($global:BOLD)═══════════════════════════════════════════════════════════$($global:NC)"
    Write-Host "$($global:CYAN)$($global:BOLD)              REINICIAR CONTENEDORES$($global:NC)"
    Write-Host "$($global:CYAN)$($global:BOLD)═══════════════════════════════════════════════════════════$($global:NC)"
    Write-Host ""
    
    if (-not (Validate-ComposeEnvFiles)) {
        Pause-Menu
        return
    }
    
    if (Confirm-Action "¿Reiniciar todos los contenedores del stack?" "no") {
        Ask-ServiceGroups
        Invoke-RunCmd (Build-FullStackDownCmd "down") "Error al detener contenedores"
        Invoke-RunCmd (Build-ComposeCmd "up -d --build" $global:SELECTED_PROFILE_ARGS $global:SELECTED_SERVICE_ARGS) `
            "Error al iniciar contenedores" `
            "Contenedores reiniciados exitosamente"
    }
    
    Pause-Menu
}

function Restart-SingleContainer {
    Clear-Screen
    Write-Host "$($global:CYAN)$($global:BOLD)═══════════════════════════════════════════════════════════$($global:NC)"
    Write-Host "$($global:CYAN)$($global:BOLD)              REINICIAR CONTENEDOR ÚNICO$($global:NC)"
    Write-Host "$($global:CYAN)$($global:BOLD)═══════════════════════════════════════════════════════════$($global:NC)"
    Write-Host ""
    
    $selection = Select-ContainerFromStack "Seleccione contenedor a reiniciar" $true $false
    if ($selection -eq $null -or $selection -eq $false) { return }
    
    if (Confirm-Action "¿Reiniciar contenedor $($global:SELECTED_CONTAINER_NAME)?" "no") {
        Invoke-RunCmd "docker restart $($global:SELECTED_CONTAINER_ID)" `
            "Error al reiniciar contenedor" `
            "Contenedor reiniciado exitosamente"
    }
    
    Pause-Menu
}

function Build-Images {
    Clear-Screen
    Write-Host "$($global:CYAN)$($global:BOLD)═══════════════════════════════════════════════════════════$($global:NC)"
    Write-Host "$($global:CYAN)$($global:BOLD)              CONSTRUIR IMÁGENES$($global:NC)"
    Write-Host "$($global:CYAN)$($global:BOLD)═══════════════════════════════════════════════════════════$($global:NC)"
    Write-Host ""
    
    if (-not (Validate-ComposeEnvFiles)) {
        Pause-Menu
        return
    }
    
    Ask-ServiceGroups
    Invoke-RunCmd (Build-ComposeCmd "build" $global:SELECTED_PROFILE_ARGS $global:SELECTED_SERVICE_ARGS) `
        "Error al construir imágenes" `
        "Imágenes construidas exitosamente"
    
    Pause-Menu
}

function Show-Logs {
    Clear-Screen
    Write-Host "$($global:CYAN)$($global:BOLD)═══════════════════════════════════════════════════════════$($global:NC)"
    Write-Host "$($global:CYAN)$($global:BOLD)              VER LOGS$($global:NC)"
    Write-Host "$($global:CYAN)$($global:BOLD)═══════════════════════════════════════════════════════════$($global:NC)"
    Write-Host ""
    
    if (-not (Validate-ComposeEnvFiles)) {
        Pause-Menu
        return
    }
    
    Write-Host "$($global:YELLOW)Presione Ctrl+C para salir de los logs$($global:NC)"
    Write-Host ""
    
    Invoke-Expression "$(Build-ComposeCmd 'logs -f')"
    
    Pause-Menu
}

function Show-LogsSingleContainer {
    Clear-Screen
    Write-Host "$($global:CYAN)$($global:BOLD)═══════════════════════════════════════════════════════════$($global:NC)"
    Write-Host "$($global:CYAN)$($global:BOLD)              LOGS DE CONTENEDOR$($global:NC)"
    Write-Host "$($global:CYAN)$($global:BOLD)═══════════════════════════════════════════════════════════$($global:NC)"
    Write-Host ""
    
    $selection = Select-ContainerFromStack "Seleccione contenedor para ver logs" $true $true
    if ($selection -eq $null -or $selection -eq $false) { return }
    
    Write-Host "$($global:YELLOW)Presione Ctrl+C para salir de los logs$($global:NC)"
    Write-Host ""
    
    Invoke-Expression "docker logs -f $($global:SELECTED_CONTAINER_ID)"
    
    Pause-Menu
}

function Show-Ps {
    Clear-Screen
    Write-Host "$($global:CYAN)$($global:BOLD)═══════════════════════════════════════════════════════════$($global:NC)"
    Write-Host "$($global:CYAN)$($global:BOLD)              ESTADO DE CONTENEDORES$($global:NC)"
    Write-Host "$($global:CYAN)$($global:BOLD)═══════════════════════════════════════════════════════════$($global:NC)"
    Write-Host ""
    
    if (-not (Validate-ComposeEnvFiles)) {
        Pause-Menu
        return
    }
    
    Invoke-Expression "$(Build-ComposeCmd 'ps')"
    
    Pause-Menu
}

function Show-ListStack {
    Clear-Screen
    Write-Host "$($global:CYAN)$($global:BOLD)═══════════════════════════════════════════════════════════$($global:NC)"
    Write-Host "$($global:CYAN)$($global:BOLD)              LISTAR CONTENEDORES$($global:NC)"
    Write-Host "$($global:CYAN)$($global:BOLD)═══════════════════════════════════════════════════════════$($global:NC)"
    Write-Host ""
    
    List-StackContainers "detailed" $true
    
    Pause-Menu
}

function Enter-ContainerTerminal {
    Clear-Screen
    Write-Host "$($global:CYAN)$($global:BOLD)═══════════════════════════════════════════════════════════$($global:NC)"
    Write-Host "$($global:CYAN)$($global:BOLD)              TERMINAL EN CONTENEDOR$($global:NC)"
    Write-Host "$($global:CYAN)$($global:BOLD)═══════════════════════════════════════════════════════════$($global:NC)"
    Write-Host ""
    
    $selection = Select-ContainerFromStack "Seleccione contenedor para acceder" $true $false
    if ($selection -eq $null -or $selection -eq $false) { return }
    
    Write-Host ""
    Write-Host "$($global:CYAN)$($global:BOLD)MODO DE ACCESO A LA TERMINAL$($global:NC)"
    Write-Host "$($global:CYAN)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$($global:NC)"
    Write-Host "  $($global:CYAN)1$($global:NC)) Usuario normal del contenedor"
    Write-Host "  $($global:CYAN)2$($global:NC)) root"
    Write-Host ""
    
    $choice = Read-Host "$($global:CYAN)Seleccione el usuario para la terminal [1/2]:$($global:NC)"
    
    $execArgs = "-it"
    if ($choice -eq "2") {
        $execArgs += " -u root"
        Write-Info "Conectando a $($global:SELECTED_CONTAINER_NAME) como root..."
    } else {
        Write-Info "Conectando a $($global:SELECTED_CONTAINER_NAME) como usuario normal..."
    }
    
    # Try bash first, fallback to sh
    docker exec $execArgs $global:SELECTED_CONTAINER_ID bash -c "exit" 2>$null
    if ($LASTEXITCODE -eq 0) {
        docker exec $execArgs $global:SELECTED_CONTAINER_ID bash
    } else {
        docker exec $execArgs $global:SELECTED_CONTAINER_ID sh
    }
    
    Pause-Menu
}

function Monitor-Resources {
    Clear-Screen
    Write-Host "$($global:CYAN)$($global:BOLD)═══════════════════════════════════════════════════════════$($global:NC)"
    Write-Host "$($global:CYAN)$($global:BOLD)              MONITOREO DE RECURSOS$($global:NC)"
    Write-Host "$($global:CYAN)$($global:BOLD)═══════════════════════════════════════════════════════════$($global:NC)"
    Write-Host ""
    
    if (-not (Check-StackContainers)) {
        Pause-Menu
        return
    }
    
    Write-Host "$($global:CYAN)$($global:BOLD)📊 ESTADÍSTICAS DE CONTENEDORES$($global:NC)"
    Write-Host "$($global:YELLOW)Presione Ctrl+C para salir$($global:NC)"
    Write-Host ""
    
    docker stats --filter "label=$($global:LABEL_FILTER)" --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}\t{{.BlockIO}}"
    
    Pause-Menu
}

# ==================================================
# FUNCIONES DE LIMPIEZA
# ==================================================

function Clean-Resources {
    Clear-Screen
    Write-Host "$($global:CYAN)$($global:BOLD)═══════════════════════════════════════════════════════════$($global:NC)"
    Write-Host "$($global:CYAN)$($global:BOLD)              LIMPIEZA DE RECURSOS$($global:NC)"
    Write-Host "$($global:CYAN)$($global:BOLD)═══════════════════════════════════════════════════════════$($global:NC)"
    Write-Host ""
    
    if (-not (Validate-ComposeEnvFiles)) {
        Pause-Menu
        return
    }
    
    if (Confirm-Action "¿Limpiar contenedores, redes y volúmenes del stack?" "no") {
        Invoke-RunCmd (Build-FullStackDownCmd "down --volumes --remove-orphans") `
            "Error durante la limpieza" `
            "Limpieza completada"
    }
    
    Pause-Menu
}

function Clean-Volumes {
    Clear-Screen
    Write-Host "$($global:CYAN)$($global:BOLD)═══════════════════════════════════════════════════════════$($global:NC)"
    Write-Host "$($global:CYAN)$($global:BOLD)              LIMPIAR VOLÚMENES$($global:NC)"
    Write-Host "$($global:CYAN)$($global:BOLD)═══════════════════════════════════════════════════════════$($global:NC)"
    Write-Host ""
    
    if (Confirm-Action "¿Eliminar todos los volúmenes no utilizados?" "no") {
        Invoke-RunCmd "docker volume prune -f" `
            "Error al limpiar volúmenes" `
            "Volúmenes no utilizados eliminados"
    }
    
    Pause-Menu
}

function Clean-ImagesEnhanced {
    Clear-Screen
    Write-Host "$($global:CYAN)$($global:BOLD)═══════════════════════════════════════════════════════════$($global:NC)"
    Write-Host "$($global:CYAN)$($global:BOLD)              LIMPIEZA DE IMÁGENES$($global:NC)"
    Write-Host "$($global:CYAN)$($global:BOLD)═══════════════════════════════════════════════════════════$($global:NC)"
    Write-Host ""
    
    Write-Host "$($global:CYAN)$($global:BOLD)📊 ANÁLISIS DE IMÁGENES DOCKER$($global:NC)"
    Write-Host "$($global:CYAN)═══════════════════════════════════════════════════════════$($global:NC)"
    Write-Host ""
    
    $totalImages = (docker images -q 2>$null | Measure-Object -Line).Lines
    $danglingImages = (docker images -f "dangling=true" -q 2>$null | Measure-Object -Line).Lines
    
    Write-Host "   $($global:BOLD)Total de imágenes:$($global:NC) $totalImages"
    Write-Host "   $($global:YELLOW)Imágenes huérfanas:$($global:NC) $danglingImages"
    Write-Host ""
    
    if ($danglingImages -gt 0) {
        Write-Host "$($global:YELLOW)$($global:BOLD)🗑️  IMÁGENES HUÉRFANAS:$($global:NC)"
        Write-Host "$($global:YELLOW)────────────────────────────────────────────────$($global:NC)"
        docker images -f "dangling=true" --format "   • {{.ID}} ({{.Size}}) - Creada: {{.CreatedSince}}"
        Write-Host ""
        
        if (Confirm-Action "¿Eliminar imágenes huérfanas?" "si") {
            Invoke-RunCmd "docker image prune -f" "Error al limpiar" "Imágenes huérfanas eliminadas"
        }
    }
    
    Write-Host ""
    if (Confirm-Action "¿Eliminar todas las imágenes no utilizadas?" "no") {
        Invoke-RunCmd "docker image prune -af" "Error al limpiar" "Imágenes no utilizadas eliminadas"
    }
    
    Pause-Menu
}

function Clean-All {
    Clear-Screen
    Write-Host "$($global:CYAN)$($global:BOLD)═══════════════════════════════════════════════════════════$($global:NC)"
    Write-Host "$($global:CYAN)$($global:BOLD)              LIMPIEZA COMPLETA$($global:NC)"
    Write-Host "$($global:CYAN)$($global:BOLD)═══════════════════════════════════════════════════════════$($global:NC)"
    Write-Host ""
    
    Write-Host "$($global:RED)$($global:BOLD)⚠️  ADVERTENCIA: Esta acción realizará una limpieza profunda del sistema$($global:NC)"
    Write-Host "$($global:YELLOW)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$($global:NC)"
    Write-Host "$($global:YELLOW)Se eliminarán:$($global:NC)"
    Write-Host "   • Contenedores, redes y volúmenes del stack actual"
    Write-Host "   • Volúmenes huérfanos relacionados con el stack"
    Write-Host "   • Imágenes base e Imágenes proyecto (Confirmación)"
    Write-Host "   • Caché de builds de Docker"
    Write-Host "$($global:YELLOW)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$($global:NC)"
    Write-Host ""
    
    if (-not (Confirm-Action "¿Iniciar limpieza completa?" "no")) {
        return
    }
    
    # PASO 1: Limpiar recursos del stack
    Write-Host ""
    Write-Step "PASO 1/3: Limpiando recursos del stack..."
    Write-Host "$($global:CYAN)────────────────────────────────────────────────$($global:NC)"
    
    Invoke-RunCmd (Build-FullStackDownCmd "down --volumes --remove-orphans") `
        "Error al limpiar recursos del stack" `
        "Recursos del stack eliminados"
    
    # PASO 2: Limpiar volúmenes huérfanos
    Write-Host ""
    Write-Step "PASO 2/3: Buscando volúmenes huérfanos del stack..."
    Write-Host "$($global:CYAN)────────────────────────────────────────────────$($global:NC)"
    
    $stackVolumes = docker volume ls --filter "dangling=true" --filter "label=$($global:LABEL_FILTER)" --format "{{.Name}}" 2>$null
    
    if ($stackVolumes) {
        $volumeList = $stackVolumes -split "`r`n" | Where-Object { $_ }
        Write-Warning "Se encontraron $($volumeList.Count) volúmenes huérfanos del stack:"
        foreach ($volume in $volumeList) {
            Write-Host "   • $volume"
        }
        Write-Host ""
        
        foreach ($volume in $volumeList) {
            docker volume rm $volume 2>$null
            if ($LASTEXITCODE -eq 0) {
                Write-Success "Eliminado: $volume"
            } else {
                Write-Error "Error al eliminar: $volume"
            }
        }
    } else {
        Write-Success "No se encontraron volúmenes huérfanos del stack"
    }
    
    # Limpiar imágenes huérfanas
    Write-Step "Eliminando imágenes huérfanas..."
    docker image prune -f 2>$null
    Write-Success "Imágenes huérfanas eliminadas"
    
    # PASO 3: Limpieza de imágenes
    Write-Host ""
    Write-Step "PASO 3/3: Limpieza de imágenes Docker..."
    Write-Host "$($global:CYAN)────────────────────────────────────────────────$($global:NC)"
    
    $projectName = if ($global:PROJECT_NAME) { $global:PROJECT_NAME } else { "inventario" }
    
    # Obtener imágenes base
    $allImages = docker images --format "{{.Repository}}:{{.Tag}}" 2>$null
    $baseImages = $allImages -split "`r`n" | Where-Object { $_ -and $_ -notlike "$projectName/*" -and $_ -notlike "<none>*" } | Sort-Object -Unique
    
    # Obtener imágenes del proyecto
    $projectImages = $allImages -split "`r`n" | Where-Object { $_ -and $_ -like "$projectName/*" } | Sort-Object -Unique
    
    # Imágenes base
    if ($baseImages.Count -gt 0) {
        Write-Host ""
        Write-Host "$($global:BLUE)$($global:BOLD)📦 IMÁGENES BASE (EXTERNAS) - $($baseImages.Count) encontradas$($global:NC)"
        Write-Host "$($global:BLUE)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$($global:NC)"
        Write-Host "$($global:YELLOW)Estas imágenes son descargadas de Docker Hub:$($global:NC)"
        Write-Host ""
        
        foreach ($image in $baseImages) {
            $size = docker images --format "{{.Size}}" $image 2>$null | Select-Object -First 1
            Write-Host "   • $image $($global:CYAN)($size)$($global:NC)"
        }
        Write-Host ""
        
        if (Confirm-Action "¿Eliminar TODAS las imágenes base?" "no") {
            Write-Warning "Eliminando imágenes base..."
            $deleted = 0
            foreach ($image in $baseImages) {
                docker rmi -f $image 2>$null
                if ($LASTEXITCODE -eq 0) {
                    Write-Success "Eliminada: $image"
                    $deleted++
                } else {
                    Write-Error "Error al eliminar: $image"
                }
            }
            Write-Success "Imágenes base eliminadas: $deleted de $($baseImages.Count)"
        } else {
            Write-Info "Imágenes base conservadas"
        }
    } else {
        Write-Host ""
        Write-Success "No hay imágenes base para eliminar"
    }
    
    # Imágenes del proyecto
    if ($projectImages.Count -gt 0) {
        Write-Host ""
        Write-Host "$($global:MAGENTA)$($global:BOLD)🏗️  IMÁGENES DEL PROYECTO - $($projectImages.Count) encontradas$($global:NC)"
        Write-Host "$($global:MAGENTA)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$($global:NC)"
        Write-Host "$($global:YELLOW)Estas imágenes fueron construidas desde Dockerfiles locales:$($global:NC)"
        Write-Host ""
        
        foreach ($image in $projectImages) {
            $size = docker images --format "{{.Size}}" $image 2>$null | Select-Object -First 1
            Write-Host "   • $image $($global:CYAN)($size)$($global:NC)"
        }
        Write-Host ""
        
        if (Confirm-Action "¿Eliminar TODAS las imágenes del proyecto?" "no") {
            Write-Warning "Eliminando imágenes del proyecto..."
            $deleted = 0
            foreach ($image in $projectImages) {
                docker rmi -f $image 2>$null
                if ($LASTEXITCODE -eq 0) {
                    Write-Success "Eliminada: $image"
                    $deleted++
                } else {
                    Write-Error "Error al eliminar: $image"
                }
            }
            Write-Success "Imágenes del proyecto eliminadas: $deleted de $($projectImages.Count)"
        } else {
            Write-Info "Imágenes del proyecto conservadas"
        }
    } else {
        Write-Host ""
        Write-Success "No hay imágenes del proyecto para eliminar"
    }
    
    # Limpiar caché de builds
    Write-Host ""
    Write-Step "Limpiando caché de builds..."
    docker builder prune -af 2>$null
    Write-Success "Caché de builds eliminada"
    
    Write-Host ""
    Write-Host "$($global:CYAN)$($global:BOLD)═══════════════════════════════════════════════════════════$($global:NC)"
    Write-Success "LIMPIEZA COMPLETA FINALIZADA"
    Write-Host "$($global:CYAN)$($global:BOLD)═══════════════════════════════════════════════════════════$($global:NC)"
    
    Pause-Menu
}

function Remove-DirectoryContents {
    param(
        [string]$TargetDir,
        [string]$Label
    )
    
    if (-not (Test-Path $TargetDir)) {
        Write-Warning "No existe el directorio $TargetDir"
        return $false
    }
    
    $items = Get-ChildItem -Path $TargetDir -Force -ErrorAction SilentlyContinue
    $found = $false
    
    foreach ($item in $items) {
        if ($item.Name -eq ".gitkeep") { continue }
        
        Remove-Item -Path $item.FullName -Recurse -Force -ErrorAction SilentlyContinue
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Eliminado: $($item.FullName)"
            $found = $true
        } else {
            Write-Error "Error al eliminar $($item.FullName)"
        }
    }
    
    if (-not $found) {
        Write-Warning "$Label ya está vacío"
    }
    return $found
}

function Ensure-PathWritable {
    param(
        [string]$TargetDir,
        [string]$Label
    )
    
    if (-not (Test-Path $TargetDir)) {
        return $true
    }
    
    # En Windows, intentamos establecer permisos con icacls
    try {
        $currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
        icacls $TargetDir /grant "${currentUser}:F" /T 2>$null
        Write-Success "Permisos actualizados: $TargetDir"
        return $true
    } catch {
        Write-Warning "No se pudieron corregir permisos en $TargetDir"
        return $false
    }
}

function Clean-RuntimeArtifacts {
    $volumesRoot = Get-RuntimeVolumesRoot
    
    Write-Info "Buscando artefactos de runtime en $volumesRoot..."
    
    if (-not (Test-Path $volumesRoot)) {
        Write-Warning "No existe el directorio $volumesRoot"
        return $false
    }
    
    $targets = @(
        "node_modules",
        "__pycache__",
        ".pytest_cache",
        ".mypy_cache",
        ".ruff_cache",
        ".venv",
        "venv",
        "dist",
        "build",
        "coverage"
    )
    
    $removedAny = $false
    
    foreach ($targetName in $targets) {
        $foundItems = Get-ChildItem -Path $volumesRoot -Recurse -Directory -Filter $targetName -ErrorAction SilentlyContinue
        foreach ($item in $foundItems) {
            if ($item.FullName -like "*\.git\*") { continue }
            Remove-Item -Path $item.FullName -Recurse -Force -ErrorAction SilentlyContinue
            if ($LASTEXITCODE -eq 0) {
                Write-Success "Eliminado: $($item.FullName)"
                $removedAny = $true
            } else {
                Write-Error "Error al eliminar $($item.FullName)"
            }
        }
    }
    
    # Limpiar archivos .pyc y .pyo
    $pycFiles = Get-ChildItem -Path $volumesRoot -Recurse -File -Include "*.pyc", "*.pyo" -ErrorAction SilentlyContinue
    foreach ($file in $pycFiles) {
        if ($file.FullName -like "*\.git\*") { continue }
        Remove-Item -Path $file.FullName -Force -ErrorAction SilentlyContinue
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Eliminado: $($file.FullName)"
            $removedAny = $true
        } else {
            Write-Error "Error al eliminar $($file.FullName)"
        }
    }
    
    if (-not $removedAny) {
        Write-Warning "No se encontraron artefactos de runtime para limpiar"
    }
    
    return $removedAny
}

function Drop-Persistence {
    Clear-Screen
    Write-Host "$($global:CYAN)$($global:BOLD)═══════════════════════════════════════════════════════════$($global:NC)"
    Write-Host "$($global:CYAN)$($global:BOLD)              ELIMINAR PERSISTENCIAS$($global:NC)"
    Write-Host "$($global:CYAN)$($global:BOLD)═══════════════════════════════════════════════════════════$($global:NC)"
    Write-Host ""
    
    $dataRoot = Get-RuntimeDataRoot
    $logsRoot = Get-RuntimeLogsRoot
    $volumesRoot = Get-RuntimeVolumesRoot
    
    Write-Host "$($global:RED)$($global:BOLD)⚠️  ADVERTENCIA: Esta acción eliminará:$($global:NC)"
    Write-Host "   • Volúmenes Docker nombrados del proyecto"
    Write-Host "   • Artefactos de runtime en $volumesRoot"
    Write-Host "   • Datos de $dataRoot"
    Write-Host "   • Logs de $logsRoot"
    Write-Host ""
    
    if (-not (Confirm-Action "¿Eliminar todas las persistencias?" "no")) {
        Pause-Menu
        return
    }
    
    # Cambiar permisos
    Write-Warning "Cambiando permisos de archivos..."
    Ensure-PathWritable $dataRoot "datos persistentes"
    Ensure-PathWritable $logsRoot "logs persistentes"
    Ensure-PathWritable $volumesRoot "artefactos runtime"
    Write-Host ""
    
    # 1. Volúmenes Docker nombrados
    if (Confirm-Action "¿Eliminar volúmenes Docker nombrados del proyecto?" "no") {
        $namedVolumes = @("${global:PROJECT_NAME}_frontend_node_modules")
        $deletedNamed = $false
        foreach ($volumeName in $namedVolumes) {
            $check = docker volume inspect $volumeName 2>$null
            if ($LASTEXITCODE -eq 0) {
                docker volume rm $volumeName 2>$null
                if ($LASTEXITCODE -eq 0) {
                    Write-Success "Eliminado: $volumeName"
                    $deletedNamed = $true
                } else {
                    Write-Warning "No se pudo eliminar $volumeName (puede estar en uso)"
                }
            }
        }
        if (-not $deletedNamed) {
            Write-Warning "No se encontraron volúmenes Docker nombrados del proyecto para eliminar"
        }
    } else {
        Write-Info "Omitida eliminación de volúmenes Docker nombrados"
    }
    
    # 2. Artefactos de runtime
    Write-Host ""
    if (Confirm-Action "¿Eliminar artefactos de runtime de Node/Python en $volumesRoot?" "no") {
        Clean-RuntimeArtifacts
    } else {
        Write-Info "Omitida eliminación de artefactos de runtime"
    }
    
    # 3. Persistence Data
    Write-Host ""
    if (Confirm-Action "¿Eliminar carpetas de $dataRoot?" "no") {
        Remove-DirectoryContents $dataRoot $dataRoot
    } else {
        Write-Info "Omitida eliminación de $dataRoot"
    }
    
    # 4. Persistence Logs
    Write-Host ""
    if (Confirm-Action "¿Eliminar contenido de $logsRoot?" "no") {
        Remove-DirectoryContents $logsRoot $logsRoot
    } else {
        Write-Info "Omitida eliminación de $logsRoot"
    }
    
    Pause-Menu
}

# ==================================================
# FUNCIONES DE CONFIGURACIÓN
# ==================================================

function Change-Env {
    Clear-Screen
    Write-Host "$($global:CYAN)$($global:BOLD)═══════════════════════════════════════════════════════════$($global:NC)"
    Write-Host "$($global:CYAN)$($global:BOLD)              CAMBIAR ENTORNO$($global:NC)"
    Write-Host "$($global:CYAN)$($global:BOLD)═══════════════════════════════════════════════════════════$($global:NC)"
    Write-Host ""
    
    $envColor = switch ($global:ENV) {
        "dev" { "$($global:GREEN)dev$($global:NC)" }
        "qa" { "$($global:YELLOW)qa$($global:NC)" }
        "prd" { "$($global:RED)prd$($global:NC)" }
        default { $global:ENV }
    }
    Write-Host "Entorno actual: $envColor"
    Write-Host ""
    Write-Host "Opciones disponibles:"
    Write-Host "  $($global:CYAN)1$($global:NC)) $($global:GREEN)dev$($global:NC)"
    Write-Host "  $($global:CYAN)2$($global:NC)) $($global:YELLOW)qa$($global:NC)"
    Write-Host "  $($global:CYAN)3$($global:NC)) $($global:RED)prd$($global:NC)"
    Write-Host ""
    
    $envChoice = Read-Host "$($global:CYAN)Seleccione nuevo entorno$($global:NC)"
    
    switch ($envChoice) {
        "1" { $global:ENV = "dev" }
        "2" { $global:ENV = "qa" }
        "3" { $global:ENV = "prd" }
        default {
            Write-Error "Opción inválida"
            Start-Sleep -Seconds 2
            return
        }
    }
    
    Define-ComposeFile
    Write-Success "Entorno cambiado a: $($global:ENV)"
    Pause-Menu
}

function Get-CurrentIP {
    $ip = ""
    
    # Usar PowerShell nativo para obtener IP
    $ipAddresses = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | 
        Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" -and $_.InterfaceAlias -notlike "*Loopback*" }
    
    # Buscar la IP de la interfaz con ruta por defecto
    $defaultRoute = Get-NetRoute -DestinationPrefix "0.0.0.0/0" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($defaultRoute) {
        $ip = ($ipAddresses | Where-Object { $_.InterfaceIndex -eq $defaultRoute.InterfaceIndex } | Select-Object -First 1).IPAddress
    }
    
    if (-not $ip -and $ipAddresses) {
        $ip = $ipAddresses[0].IPAddress
    }
    
    if (-not $ip) {
        $ip = "No detectada"
    }
    
    return $ip
}

function Update-IPMenu {
    Clear-Screen
    Write-Host "$($global:CYAN)$($global:BOLD)═══════════════════════════════════════════════════════════$($global:NC)"
    Write-Host "$($global:CYAN)$($global:BOLD)              ACTUALIZAR IP EXPO / ANDROID$($global:NC)"
    Write-Host "$($global:CYAN)$($global:BOLD)═══════════════════════════════════════════════════════════$($global:NC)"
    Write-Host ""
    
    $currentIP = Get-CurrentIP
    $envFile = ".env"
    
    if (-not (Test-Path $envFile)) {
        Write-Error "Archivo .env no encontrado"
        Pause-Menu
        return
    }
    
    Write-Host "IP actual detectada: $($global:CYAN)$currentIP$($global:NC)"
    Write-Info "Se usará para REACT_NATIVE_PACKAGER_HOSTNAME en Expo / android_app."
    
    if ($currentIP -eq "No detectada") {
        Write-Warning "No se pudo detectar IP automáticamente"
        $currentIP = Read-Host "Ingrese IP manualmente"
    }
    
    if (Confirm-Action "¿Actualizar REACT_NATIVE_PACKAGER_HOSTNAME en .env a $currentIP?" "si") {
        $content = Get-Content $envFile -Raw
        if ($content -match "REACT_NATIVE_PACKAGER_HOSTNAME=.*") {
            $content = $content -replace "REACT_NATIVE_PACKAGER_HOSTNAME=.*", "REACT_NATIVE_PACKAGER_HOSTNAME=$currentIP"
        } else {
            $content += "`nREACT_NATIVE_PACKAGER_HOSTNAME=$currentIP"
        }
        Set-Content -Path $envFile -Value $content -NoNewline
        Write-Success "IP actualizada exitosamente"
    }
    
    Pause-Menu
}

function Check-IPMenu {
    Clear-Screen
    Write-Host "$($global:CYAN)$($global:BOLD)═══════════════════════════════════════════════════════════$($global:NC)"
    Write-Host "$($global:CYAN)$($global:BOLD)              VERIFICAR IP EXPO / ANDROID$($global:NC)"
    Write-Host "$($global:CYAN)$($global:BOLD)═══════════════════════════════════════════════════════════$($global:NC)"
    Write-Host ""
    
    $currentIP = Get-CurrentIP
    $envFile = ".env"
    
    Write-Host "IP actual del equipo: $($global:CYAN)$currentIP$($global:NC)"
    
    if (Test-Path $envFile) {
        $content = Get-Content $envFile -Raw
        if ($content -match "REACT_NATIVE_PACKAGER_HOSTNAME=(.+)") {
            $envIP = $matches[1].Trim()
            Write-Host "REACT_NATIVE_PACKAGER_HOSTNAME en .env: $($global:CYAN)$envIP$($global:NC)"
            
            if ($currentIP -ne "No detectada" -and $envIP) {
                if ($currentIP -eq $envIP) {
                    Write-Success "Las IPs coinciden"
                } else {
                    Write-Warning "Las IPs NO coinciden"
                }
            }
        } else {
            Write-Host "REACT_NATIVE_PACKAGER_HOSTNAME en .env: $($global:CYAN)No configurada$($global:NC)"
        }
    }
    
    Pause-Menu
}

function Validate-ContainerEnv {
    Clear-Screen
    Write-Host "$($global:CYAN)$($global:BOLD)═══════════════════════════════════════════════════════════$($global:NC)"
    Write-Host "$($global:CYAN)$($global:BOLD)              VARIABLES DE ENTORNO$($global:NC)"
    Write-Host "$($global:CYAN)$($global:BOLD)═══════════════════════════════════════════════════════════$($global:NC)"
    Write-Host ""
    
    $selection = Select-ContainerFromStack "Seleccione contenedor" $true $false
    if ($selection -eq $null -or $selection -eq $false) { return }
    
    Write-Host ""
    Write-Info "Variables de entorno en $($global:SELECTED_CONTAINER_NAME):"
    Write-Host "$($global:CYAN)═══════════════════════════════════════════════════════════$($global:NC)"
    
    docker exec $global:SELECTED_CONTAINER_ID env 2>$null | Sort-Object | ForEach-Object -Begin { $i = 1 } -Process { Write-Host ("{0,3} {1}" -f $i, $_); $i++ }
    
    Pause-Menu
}

# ==================================================
# FUNCIONES DE BACKUP
# ==================================================

function Get-ProjectNamedVolumes {
    $volumes = docker volume ls --format "{{.Name}}" 2>$null
    return $volumes -split "`r`n" | Where-Object { $_ -and $_ -like "${global:PROJECT_NAME}_*" }
}

function Backup-Volumes {
    Clear-Screen
    Write-Host "$($global:CYAN)$($global:BOLD)═══════════════════════════════════════════════════════════$($global:NC)"
    Write-Host "$($global:CYAN)$($global:BOLD)              BACKUP DE VOLÚMENES$($global:NC)"
    Write-Host "$($global:CYAN)$($global:BOLD)═══════════════════════════════════════════════════════════$($global:NC)"
    Write-Host ""
    
    if (-not (Test-Path $global:BACKUP_DIR)) {
        New-Item -ItemType Directory -Path $global:BACKUP_DIR -Force | Out-Null
    }
    
    Write-Host "$($global:CYAN)$($global:BOLD)📦 VOLÚMENES DEL PROYECTO:$($global:NC)"
    Write-Host ""
    
    $volumes = Get-ProjectNamedVolumes
    
    if ($volumes.Count -eq 0) {
        Write-Warning "No hay volúmenes nombrados del proyecto disponibles"
        Pause-Menu
        return
    }
    
    for ($i = 0; $i -lt $volumes.Count; $i++) {
        Write-Host "  $($global:CYAN)$("{0,2}" -f ($i+1))$($global:NC)) $($volumes[$i])"
    }
    
    Write-Host ""
    Write-Host "  $($global:CYAN)T$($global:NC)) Todos los volúmenes"
    Write-Host "  $($global:CYAN)V$($global:NC)) ⬅️ Volver al menú anterior"
    Write-Host ""
    
    $volChoice = Read-Host "$($global:CYAN)Seleccione volumen a respaldar$($global:NC)"
    
    if ($volChoice -eq "V" -or $volChoice -eq "v") {
        Write-Info "Volviendo al menú anterior..."
        Start-Sleep -Seconds 1
        return
    }
    
    $volumesToBackup = @()
    if ($volChoice -eq "T" -or $volChoice -eq "t") {
        $volumesToBackup = $volumes
    } elseif ($volChoice -match '^\d+$' -and [int]$volChoice -ge 1 -and [int]$volChoice -le $volumes.Count) {
        $volumesToBackup = @($volumes[[int]$volChoice - 1])
    } else {
        Write-Error "Opción inválida"
        Pause-Menu
        return
    }
    
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $successCount = 0
    $errorCount = 0
    
    foreach ($volume in $volumesToBackup) {
        $backupFile = "$($global:BACKUP_DIR)/${volume}_$timestamp.tar.gz"
        Write-Step "Respaldando volumen: $volume"
        
        docker run --rm -v "${volume}:/source" -v "${PWD}/$($global:BACKUP_DIR):/backup" alpine tar czf "/backup/$(Split-Path $backupFile -Leaf)" -C /source . 2>$null
        
        if ($LASTEXITCODE -eq 0) {
            $size = (Get-Item $backupFile -ErrorAction SilentlyContinue).Length
            $sizeMB = [math]::Round($size / 1MB, 2)
            Write-Success "Backup creado: $backupFile (${sizeMB} MB)"
            $successCount++
        } else {
            Write-Error "Error al respaldar $volume"
            $errorCount++
        }
    }
    
    Write-Host ""
    Write-Host "$($global:CYAN)═══════════════════════════════════════════════════════════$($global:NC)"
    Write-Success "Backup completado: $successCount exitosos, $errorCount errores"
    Write-Host "$($global:CYAN)═══════════════════════════════════════════════════════════$($global:NC)"
    
    Pause-Menu
}

function Get-VolumeNameFromBackup {
    param([string]$BackupFilename)
    
    $baseName = $BackupFilename -replace '\.tar\.gz$', ''
    $baseName = $baseName -replace '_[0-9]{8}_[0-9]{6}$', ''
    return $baseName
}

function Restore-Volume {
    Clear-Screen
    Write-Host "$($global:CYAN)$($global:BOLD)═══════════════════════════════════════════════════════════$($global:NC)"
    Write-Host "$($global:CYAN)$($global:BOLD)              RESTAURAR VOLUMEN$($global:NC)"
    Write-Host "$($global:CYAN)$($global:BOLD)═══════════════════════════════════════════════════════════$($global:NC)"
    Write-Host ""
    
    if (-not (Test-Path $global:BACKUP_DIR) -or (Get-ChildItem $global:BACKUP_DIR -Filter "*.tar.gz" | Measure-Object).Count -eq 0) {
        Write-Warning "No hay backups disponibles"
        Pause-Menu
        return
    }
    
    Write-Host "$($global:CYAN)$($global:BOLD)📦 BACKUPS DISPONIBLES:$($global:NC)"
    Write-Host ""
    
    $backups = Get-ChildItem "$($global:BACKUP_DIR)/*.tar.gz" | ForEach-Object { $_.Name }
    
    for ($i = 0; $i -lt $backups.Count; $i++) {
        $size = (Get-Item "$($global:BACKUP_DIR)/$($backups[$i])").Length
        $sizeMB = [math]::Round($size / 1MB, 2)
        Write-Host "  $($global:CYAN)$("{0,2}" -f ($i+1))$($global:NC)) $($backups[$i]) $($global:YELLOW)[${sizeMB} MB]$($global:NC)"
    }
    
    Write-Host ""
    $backupChoice = Read-Host "$($global:CYAN)Seleccione backup a restaurar$($global:NC)"
    
    if (-not ($backupChoice -match '^\d+$') -or [int]$backupChoice -lt 1 -or [int]$backupChoice -gt $backups.Count) {
        Write-Error "Opción inválida"
        Pause-Menu
        return
    }
    
    $selectedBackup = $backups[[int]$backupChoice - 1]
    $volumeName = Get-VolumeNameFromBackup $selectedBackup
    
    if (-not $volumeName) {
        Write-Error "No se pudo determinar el volumen a restaurar desde $selectedBackup"
        Pause-Menu
        return
    }
    
    Write-Host ""
    Write-Warning "Se restaurará el volumen: $volumeName"
    
    if (-not (Confirm-Action "¿Continuar con la restauración?" "no")) {
        return
    }
    
    # Verificar si el volumen existe
    $volumeExists = docker volume ls -q | Select-String "^$volumeName$"
    if ($volumeExists) {
        if (Confirm-Action "¿Eliminar volumen existente antes de restaurar?" "no") {
            docker volume rm $volumeName 2>$null
        } else {
            Write-Info "Restauración cancelada"
            Pause-Menu
            return
        }
    }
    
    # Crear nuevo volumen y restaurar
    docker volume create $volumeName 2>$null
    Write-Success "Volumen creado: $volumeName"
    
    docker run --rm -v "${volumeName}:/target" -v "${PWD}/$($global:BACKUP_DIR):/backup" alpine tar xzf "/backup/$selectedBackup" -C /target 2>$null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Volumen restaurado exitosamente"
    } else {
        Write-Error "Error al restaurar el volumen"
    }
    
    Pause-Menu
}

# ==================================================
# FUNCIONES DE MENÚ
# ==================================================

function Show-Banner {
    param([string]$Title)
    
    Clear-Screen
    Write-Host "$($global:CYAN)$($global:BOLD)╔═══════════════════════════════════════════════════════════╗$($global:NC)"
    Write-Host "$($global:CYAN)$($global:BOLD)║              DOCKER TOOLS - $($Title.PadRight(25))║$($global:NC)"
    Write-Host "$($global:CYAN)$($global:BOLD)╚═══════════════════════════════════════════════════════════╝$($global:NC)"
    
    $currentIP = Get-CurrentIP
    
    $gitInfo = ""
    if (Test-Path ".git") {
        $branch = git rev-parse --abbrev-ref HEAD 2>$null
        if ($branch) { $gitInfo = "$($global:GREEN)$branch$($global:NC)" }
        else { $gitInfo = "$($global:YELLOW)No es repositorio Git$($global:NC)" }
    } else {
        $gitInfo = "$($global:YELLOW)No es repositorio Git$($global:NC)"
    }
    
    Write-Host "$($global:BLUE)$($global:BOLD)📋 INFORMACIÓN DEL ENTORNO:$($global:NC)"
    Write-Host "   $($global:CYAN)Archivo:$($global:NC) $($global:COMPOSE_FILE)"
    Write-Host "   $($global:CYAN)Stack:$($global:NC) $($global:STACK)"
    
    $envColor = switch ($global:ENV) {
        "dev" { "$($global:GREEN)dev$($global:NC)" }
        "qa" { "$($global:YELLOW)qa$($global:NC)" }
        "prd" { "$($global:RED)prd$($global:NC)" }
        default { $global:ENV }
    }
    Write-Host "   $($global:CYAN)Entorno:$($global:NC) $envColor"
    Write-Host "   $($global:CYAN)IP Actual:$($global:NC) $currentIP"
    Write-Host "   $($global:CYAN)Rama Git:$($global:NC) $gitInfo"
    Write-Host ""
}

function Menu-Containers {
    Show-Banner "MANEJADOR DE CONTENEDORES"
    
    Write-Host "$($global:BOLD)OPCIONES DISPONIBLES:$($global:NC)"
    Write-Host ""
    Write-Host "  $($global:CYAN)1$($global:NC)) $($global:ICON_CONTAINER) 🚀 Iniciar contenedores y construir imagenes"
    Write-Host "  $($global:CYAN)2$($global:NC)) 🛑 Detener y eliminar contenedores"
    Write-Host "  $($global:CYAN)3$($global:NC)) 🔄 Reiniciar contenedores"
    Write-Host "  $($global:CYAN)4$($global:NC)) 🔃 Reiniciar contenedor unico"
    Write-Host "  $($global:CYAN)5$($global:NC)) 🔨 Construir imágenes"
    Write-Host "  $($global:CYAN)6$($global:NC)) 🔍 Validar Docker Compose"
    Write-Host "  $($global:CYAN)7$($global:NC)) 📏 Validar reglas del proyecto"
    Write-Host ""
    Write-Host "  $($global:CYAN)V$($global:NC)) ⬅️ Volver"
    Write-Host "  $($global:CYAN)S$($global:NC)) 🚪 Salir"
    Write-Host ""
    
    $choice = Read-Host "$($global:CYAN)👉 Seleccione una opción$($global:NC)"
    
    switch ($choice) {
        "1" { Start-Containers; Menu-Containers }
        "2" { Stop-Containers; Menu-Containers }
        "3" { Restart-Containers; Menu-Containers }
        "4" { Restart-SingleContainer; Menu-Containers }
        "5" { Build-Images; Menu-Containers }
        "6" { Validate-Compose; Menu-Containers }
        "7" { Write-Warning "Función en desarrollo"; Start-Sleep -Seconds 2; Menu-Containers }
        "V" { Menu-Principal }
        "v" { Menu-Principal }
        "S" { Exit-Script }
        "s" { Exit-Script }
        default { Write-Error "Opción inválida"; Start-Sleep -Seconds 2; Menu-Containers }
    }
}

function Menu-Monitoreo {
    Show-Banner "MONITOREO Y DIAGNÓSTICO"
    
    Write-Host "$($global:BOLD)OPCIONES DISPONIBLES:$($global:NC)"
    Write-Host ""
    Write-Host "  $($global:CYAN)1$($global:NC)) 📋 Ver logs"
    Write-Host "  $($global:CYAN)2$($global:NC)) 🔎 Ver logs de un contenedor"
    Write-Host "  $($global:CYAN)3$($global:NC)) 📊 Estado de los contenedores"
    Write-Host "  $($global:CYAN)4$($global:NC)) 📦 Listar contenedores de stack"
    Write-Host "  $($global:CYAN)5$($global:NC)) 💻 Abrir terminal en contenedor"
    Write-Host "  $($global:CYAN)6$($global:NC)) 📈 Monitoreo de recursos"
    Write-Host ""
    Write-Host "  $($global:CYAN)V$($global:NC)) ⬅️ Volver"
    Write-Host "  $($global:CYAN)S$($global:NC)) 🚪 Salir"
    Write-Host ""
    
    $choice = Read-Host "$($global:CYAN)👉 Seleccione una opción$($global:NC)"
    
    switch ($choice) {
        "1" { Show-Logs; Menu-Monitoreo }
        "2" { Show-LogsSingleContainer; Menu-Monitoreo }
        "3" { Show-Ps; Menu-Monitoreo }
        "4" { Show-ListStack; Menu-Monitoreo }
        "5" { Enter-ContainerTerminal; Menu-Monitoreo }
        "6" { Monitor-Resources; Menu-Monitoreo }
        "V" { Menu-Principal }
        "v" { Menu-Principal }
        "S" { Exit-Script }
        "s" { Exit-Script }
        default { Write-Error "Opción inválida"; Start-Sleep -Seconds 2; Menu-Monitoreo }
    }
}

function Menu-Limpieza {
    Show-Banner "LIMPIEZA Y MANTENIMIENTO"
    
    Write-Host "$($global:BOLD)OPCIONES DISPONIBLES:$($global:NC)"
    Write-Host ""
    Write-Host "  $($global:CYAN)1$($global:NC)) 🧹 Limpiar contenedores, redes y volúmenes"
    Write-Host "  $($global:CYAN)2$($global:NC)) 🖼️ Limpiar imágenes no utilizadas"
    Write-Host "  $($global:CYAN)3$($global:NC)) 💾 Limpiar volúmenes no utilizados"
    Write-Host "  $($global:CYAN)4$($global:NC)) 🗑️ Limpiar todo"
    Write-Host "  $($global:CYAN)5$($global:NC)) 🔥 Eliminar Persistencias"
    Write-Host ""
    Write-Host "  $($global:CYAN)V$($global:NC)) ⬅️ Volver"
    Write-Host "  $($global:CYAN)S$($global:NC)) 🚪 Salir"
    Write-Host ""
    
    $choice = Read-Host "$($global:CYAN)👉 Seleccione una opción$($global:NC)"
    
    switch ($choice) {
        "1" { Clean-Resources; Menu-Limpieza }
        "2" { Clean-ImagesEnhanced; Menu-Limpieza }
        "3" { Clean-Volumes; Menu-Limpieza }
        "4" { Clean-All; Menu-Limpieza }
        "5" { Drop-Persistence; Menu-Limpieza }
        "V" { Menu-Principal }
        "v" { Menu-Principal }
        "S" { Exit-Script }
        "s" { Exit-Script }
        default { Write-Error "Opción inválida"; Start-Sleep -Seconds 2; Menu-Limpieza }
    }
}

function Menu-Configuracion {
    Show-Banner "CONFIGURACIÓN DEL SISTEMA"
    
    Write-Host "$($global:BOLD)OPCIONES DISPONIBLES:$($global:NC)"
    Write-Host ""
    Write-Host "  $($global:CYAN)1$($global:NC)) 🔧 Cambiar entorno (dev, qa, prd)"
    Write-Host "  $($global:CYAN)2$($global:NC)) 🌐 Actualizar IP para Expo / Android"
    Write-Host "  $($global:CYAN)3$($global:NC)) 🔍 Verificar IP de Expo / Android"
    Write-Host "  $($global:CYAN)4$($global:NC)) 📋 Listar variables de entorno"
    Write-Host ""
    Write-Host "  $($global:CYAN)V$($global:NC)) ⬅️ Volver"
    Write-Host "  $($global:CYAN)S$($global:NC)) 🚪 Salir"
    Write-Host ""
    
    $choice = Read-Host "$($global:CYAN)👉 Seleccione una opción$($global:NC)"
    
    switch ($choice) {
        "1" { Change-Env; Menu-Configuracion }
        "2" { Update-IPMenu; Menu-Configuracion }
        "3" { Check-IPMenu; Menu-Configuracion }
        "4" { Validate-ContainerEnv; Menu-Configuracion }
        "V" { Menu-Principal }
        "v" { Menu-Principal }
        "S" { Exit-Script }
        "s" { Exit-Script }
        default { Write-Error "Opción inválida"; Start-Sleep -Seconds 2; Menu-Configuracion }
    }
}

function Menu-Expo {
    Show-Banner "HERRAMIENTAS EXPO"
    
    Write-Host "$($global:BOLD)OPCIONES DISPONIBLES:$($global:NC)"
    Write-Host ""
    Write-Host "  $($global:CYAN)1$($global:NC)) 🚀 Iniciar Expo Development Server"
    Write-Host "  $($global:CYAN)2$($global:NC)) 🏗️ EAS Build"
    Write-Host ""
    Write-Host "  $($global:CYAN)V$($global:NC)) ⬅️ Volver"
    Write-Host "  $($global:CYAN)S$($global:NC)) 🚪 Salir"
    Write-Host ""
    
    $choice = Read-Host "$($global:CYAN)👉 Seleccione una opción$($global:NC)"
    
    switch ($choice) {
        "1" { Write-Warning "Función en desarrollo"; Start-Sleep -Seconds 2; Menu-Expo }
        "2" { Write-Warning "Función en desarrollo"; Start-Sleep -Seconds 2; Menu-Expo }
        "V" { Menu-Principal }
        "v" { Menu-Principal }
        "S" { Exit-Script }
        "s" { Exit-Script }
        default { Write-Error "Opción inválida"; Start-Sleep -Seconds 2; Menu-Expo }
    }
}

function Menu-Templates {
    Show-Banner "GESTIÓN DE TEMPLATES .ENV"
    
    Write-Host "$($global:BOLD)OPCIONES DISPONIBLES:$($global:NC)"
    Write-Host ""
    Write-Host "  $($global:CYAN)1$($global:NC)) 🔨 Generar .env.template"
    Write-Host "  $($global:CYAN)2$($global:NC)) 📋 Generar archivos .env desde template"
    Write-Host "  $($global:CYAN)3$($global:NC)) 🔍 Verificar archivos .env"
    Write-Host ""
    Write-Host "  $($global:CYAN)V$($global:NC)) ⬅️ Volver"
    Write-Host "  $($global:CYAN)S$($global:NC)) 🚪 Salir"
    Write-Host ""
    
    $choice = Read-Host "$($global:CYAN)👉 Seleccione una opción$($global:NC)"
    
    switch ($choice) {
        "1" { Write-Warning "Función en desarrollo"; Start-Sleep -Seconds 2; Menu-Templates }
        "2" { Write-Warning "Función en desarrollo"; Start-Sleep -Seconds 2; Menu-Templates }
        "3" { Write-Warning "Función en desarrollo"; Start-Sleep -Seconds 2; Menu-Templates }
        "V" { Menu-Principal }
        "v" { Menu-Principal }
        "S" { Exit-Script }
        "s" { Exit-Script }
        default { Write-Error "Opción inválida"; Start-Sleep -Seconds 2; Menu-Templates }
    }
}

function Menu-DockerServices {
    Show-Banner "ESTADO Y SERVICIOS DOCKER"
    
    Write-Host "$($global:BOLD)OPCIONES DISPONIBLES:$($global:NC)"
    Write-Host ""
    Write-Host "  $($global:CYAN)1$($global:NC)) 🔍 Estado Docker Engine"
    Write-Host "  $($global:CYAN)2$($global:NC)) 🖥️ Estado Docker Desktop"
    Write-Host "  $($global:CYAN)3$($global:NC)) 🔄 Reiniciar Docker Engine"
    Write-Host "  $($global:CYAN)4$($global:NC)) 🔄 Reiniciar Docker Desktop"
    Write-Host "  $($global:CYAN)5$($global:NC)) ♻️ Reiniciar Ambos"
    Write-Host ""
    Write-Host "  $($global:CYAN)V$($global:NC)) ⬅️ Volver"
    Write-Host "  $($global:CYAN)S$($global:NC)) 🚪 Salir"
    Write-Host ""
    
    $choice = Read-Host "$($global:CYAN)👉 Seleccione una opción$($global:NC)"
    
    switch ($choice) {
        "1" { docker info; Pause-Menu; Menu-DockerServices }
        "2" { Write-Warning "Verifique Docker Desktop manualmente"; Pause-Menu; Menu-DockerServices }
        "3" { 
            if (Confirm-Action "¿Reiniciar Docker Engine?" "no") {
                Write-Warning "Requiere permisos de administrador"
                net stop com.docker.service 2>$null; net start com.docker.service 2>$null
            }
            Pause-Menu; Menu-DockerServices 
        }
        "4" { Write-Warning "Reinicie Docker Desktop manualmente"; Pause-Menu; Menu-DockerServices }
        "5" { Write-Warning "Reinicie Docker Engine y Desktop manualmente"; Pause-Menu; Menu-DockerServices }
        "V" { Menu-Principal }
        "v" { Menu-Principal }
        "S" { Exit-Script }
        "s" { Exit-Script }
        default { Write-Error "Opción inválida"; Start-Sleep -Seconds 2; Menu-DockerServices }
    }
}

function Menu-Portainer {
    Show-Banner "PORTAINER"
    
    Write-Host "$($global:BOLD)OPCIONES DISPONIBLES:$($global:NC)"
    Write-Host ""
    Write-Host "  $($global:CYAN)1$($global:NC)) ▶️ Iniciar Portainer"
    Write-Host "  $($global:CYAN)2$($global:NC)) ⏹️ Detener Portainer"
    Write-Host "  $($global:CYAN)3$($global:NC)) 🔄 Reiniciar Portainer"
    Write-Host "  $($global:CYAN)4$($global:NC)) 🌐 Abrir en navegador"
    Write-Host "  $($global:CYAN)5$($global:NC)) 📋 Ver logs"
    Write-Host "  $($global:CYAN)6$($global:NC)) ♻️ Recrear Portainer"
    Write-Host ""
    Write-Host "  $($global:CYAN)V$($global:NC)) ⬅️ Volver"
    Write-Host "  $($global:CYAN)S$($global:NC)) 🚪 Salir"
    Write-Host ""
    
    $choice = Read-Host "$($global:CYAN)👉 Seleccione una opción$($global:NC)"
    
    switch ($choice) {
        "1" {
            $exists = docker ps -a --format '{{.Names}}' | Select-String -Pattern "^$global:PORTAINER_NAME$"
            if (-not $exists) {
                docker run -d --name $global:PORTAINER_NAME --restart unless-stopped -p 9000:9000 -v /var/run/docker.sock:/var/run/docker.sock -v portainer_data:/data $global:PORTAINER_IMAGE 2>$null
                if ($LASTEXITCODE -eq 0) { Write-Success "Portainer iniciado en http://localhost:9000" }
                else { Write-Error "Error al iniciar Portainer" }
            } else {
                docker start $global:PORTAINER_NAME 2>$null
                if ($LASTEXITCODE -eq 0) { Write-Success "Portainer iniciado" }
                else { Write-Error "Error al iniciar" }
            }
            Pause-Menu; Menu-Portainer
        }
        "2" {
            docker stop $global:PORTAINER_NAME 2>$null
            if ($LASTEXITCODE -eq 0) { Write-Success "Portainer detenido" }
            else { Write-Error "Error al detener" }
            Pause-Menu; Menu-Portainer
        }
        "3" {
            docker restart $global:PORTAINER_NAME 2>$null
            if ($LASTEXITCODE -eq 0) { Write-Success "Portainer reiniciado" }
            else { Write-Error "Error al reiniciar" }
            Pause-Menu; Menu-Portainer
        }
        "4" {
            Start-Process "http://localhost:9000"
            Pause-Menu; Menu-Portainer
        }
        "5" {
            docker logs $global:PORTAINER_NAME --tail 50
            Pause-Menu; Menu-Portainer
        }
        "6" {
            if (Confirm-Action "¿Recrear contenedor Portainer?" "no") {
                docker stop $global:PORTAINER_NAME 2>$null
                docker rm $global:PORTAINER_NAME 2>$null
                docker volume create portainer_data 2>$null
                docker run -d --name $global:PORTAINER_NAME --restart unless-stopped -p 9000:9000 -v /var/run/docker.sock:/var/run/docker.sock -v portainer_data:/data $global:PORTAINER_IMAGE 2>$null
                if ($LASTEXITCODE -eq 0) { Write-Success "Portainer recreado" }
                else { Write-Error "Error al recrear" }
            }
            Pause-Menu; Menu-Portainer
        }
        "V" { Menu-Principal }
        "v" { Menu-Principal }
        "S" { Exit-Script }
        "s" { Exit-Script }
        default { Write-Error "Opción inválida"; Start-Sleep -Seconds 2; Menu-Portainer }
    }
}

function Menu-Backup {
    Show-Banner "BACKUP Y RESTORE"
    
    Write-Host "$($global:BOLD)OPCIONES DISPONIBLES:$($global:NC)"
    Write-Host ""
    Write-Host "  $($global:CYAN)1$($global:NC)) 💾 Backup de volúmenes"
    Write-Host "  $($global:CYAN)2$($global:NC)) 🔄 Restaurar volumen"
    Write-Host ""
    Write-Host "  $($global:CYAN)V$($global:NC)) ⬅️ Volver"
    Write-Host "  $($global:CYAN)S$($global:NC)) 🚪 Salir"
    Write-Host ""
    
    $choice = Read-Host "$($global:CYAN)👉 Seleccione una opción$($global:NC)"
    
    switch ($choice) {
        "1" { Backup-Volumes; Menu-Backup }
        "2" { Restore-Volume; Menu-Backup }
        "V" { Menu-Principal }
        "v" { Menu-Principal }
        "S" { Exit-Script }
        "s" { Exit-Script }
        default { Write-Error "Opción inválida"; Start-Sleep -Seconds 2; Menu-Backup }
    }
}

function Menu-Principal {
    Show-Banner "MENÚ PRINCIPAL"
    
    Write-Host "$($global:BOLD)OPCIONES DISPONIBLES:$($global:NC)"
    Write-Host ""
    Write-Host "  $($global:CYAN)1$($global:NC)) $($global:ICON_CONTAINER) MANEJADOR DE CONTENEDORES"
    Write-Host "  $($global:CYAN)2$($global:NC)) 📊 MONITOREO Y DIAGNÓSTICO"
    Write-Host "  $($global:CYAN)3$($global:NC)) 🧹 LIMPIEZA Y MANTENIMIENTO"
    Write-Host "  $($global:CYAN)4$($global:NC)) $($global:ICON_SETTINGS) CONFIGURACIÓN DEL SISTEMA"
    Write-Host "  $($global:CYAN)5$($global:NC)) 📱 HERRAMIENTAS EXPO"
    Write-Host "  $($global:CYAN)6$($global:NC)) 📄 GESTIÓN DE TEMPLATES .ENV"
    Write-Host "  $($global:CYAN)7$($global:NC)) $($global:ICON_DOCKER) ESTADO Y SERVICIOS DOCKER"
    Write-Host "  $($global:CYAN)8$($global:NC)) 🧰 PORTAINER"
    Write-Host "  $($global:CYAN)9$($global:NC)) 💾 BACKUP Y RESTORE"
    Write-Host ""
    Write-Host "  $($global:CYAN)S$($global:NC)) 🚪 Salir"
    Write-Host ""
    
    $choice = Read-Host "$($global:CYAN)👉 Seleccione una opción$($global:NC)"
    
    switch ($choice) {
        "1" { Menu-Containers }
        "2" { Menu-Monitoreo }
        "3" { Menu-Limpieza }
        "4" { Menu-Configuracion }
        "5" { Menu-Expo }
        "6" { Menu-Templates }
        "7" { Menu-DockerServices }
        "8" { Menu-Portainer }
        "9" { Menu-Backup }
        "S" { Exit-Script }
        "s" { Exit-Script }
        default { Write-Error "Opción inválida"; Start-Sleep -Seconds 2; Menu-Principal }
    }
}

# ==================================================
# FUNCIÓN DE SALIDA
# ==================================================

function Exit-Script {
    Clear-Screen
    Write-Host "$($global:CYAN)$($global:BOLD)═══════════════════════════════════════════════════════════$($global:NC)"
    Write-Host "$($global:GREEN)$($global:BOLD)   ¡Gracias por usar Docker Tools!$($global:NC)"
    Write-Host "$($global:CYAN)$($global:BOLD)═══════════════════════════════════════════════════════════$($global:NC)"
    Write-Host ""
    Write-Info "Todos los procesos han sido cerrados correctamente."
    Write-Host ""
    exit 0
}

# ==================================================
# VERIFICACIÓN DE DEPENDENCIAS
# ==================================================

function Check-Dependencies {
    Clear-Screen
    Write-Host "$($global:CYAN)$($global:BOLD)═══════════════════════════════════════════════════════════$($global:NC)"
    Write-Host "$($global:CYAN)$($global:BOLD)🔍 VERIFICANDO DEPENDENCIAS DEL SISTEMA$($global:NC)"
    Write-Host "$($global:CYAN)$($global:BOLD)═══════════════════════════════════════════════════════════$($global:NC)"
    Write-Host ""
    
    $hasErrors = $false
    
    # Verificar Docker CLI
    $dockerPath = (Get-Command docker -ErrorAction SilentlyContinue).Source
    if ($dockerPath) {
        Write-Success "Docker CLI: Encontrado"
        
        # Verificar que Docker daemon esté corriendo
        $dockerInfo = docker info 2>$null
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Docker daemon: No está en ejecución"
            Write-Warning "   └─ Solución: Inicie Docker Desktop"
            $hasErrors = $true
        } else {
            Write-Success "Docker daemon: En ejecución"
        }
    } else {
        Write-Error "Docker CLI: No encontrado"
        $hasErrors = $true
    }
    
    # Verificar Docker Compose
    $composeVersion = docker compose version 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Docker Compose (plugin): Encontrado"
        $global:COMPOSE_CMD = "docker compose"
    } else {
        $composePath = (Get-Command docker-compose -ErrorAction SilentlyContinue).Source
        if ($composePath) {
            Write-Success "Docker Compose (standalone): Encontrado"
            $global:COMPOSE_CMD = "docker-compose"
        } else {
            Write-Error "Docker Compose: No encontrado"
            $hasErrors = $true
        }
    }
    
    Write-Host ""
    
    if ($hasErrors) {
        Write-Error "ERROR: Dependencias críticas faltantes"
        Write-Warning "💡 Instale las dependencias faltantes e intente nuevamente."
        exit 1
    }
    
    Write-Success "Verificación de dependencias completada exitosamente"
    Write-Host "$($global:CYAN)═══════════════════════════════════════════════════════════$($global:NC)"
    Write-Host ""
    Start-Sleep -Seconds 2
}

# ==================================================
# FUNCIÓN PRINCIPAL
# ==================================================

function Main {
    Clear-Screen
    
    # Verificar dependencias
    Check-Dependencies
    
    # Cargar configuración inicial
    $global:ENV = "dev"
    $global:PROJECT_NAME = Read-ProjectName
    $global:STACK = if ($global:PROJECT_NAME) { $global:PROJECT_NAME } else { "NoExiteStackName" }
    $global:LABEL_FILTER = "stack=${global:STACK}"
    
    Define-ComposeFile
    
    # Ir al menú principal
    Menu-Principal
}

# Ejecutar función principal
Main
