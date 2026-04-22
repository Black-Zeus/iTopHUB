#Requires -Version 5.1
# ==================================================
# Docker Tools - Version Windows Nativa
# Sin dependencias Unix (grep, awk, sed, etc.)
# Requiere: Docker Desktop con docker compose plugin
# ==================================================

Set-StrictMode -Version Latest
$ErrorActionPreference = 'SilentlyContinue'

# ==================================================
# CONSTANTES Y COLORES (ANSI - Windows 10+ / WT)
# ==================================================

function Initialize-Colors {
    # Compatibilidad PS 5.1 y PS 7+
    # `e solo funciona en PS7+, usamos [char]27 que funciona en ambos
    $esc = [char]27

    # Habilitar modo VT100/ANSI en consola Windows (necesario en PS5.1)
    try {
        $kernel32 = Add-Type -MemberDefinition @'
[DllImport("kernel32.dll", SetLastError=true)]
public static extern bool SetConsoleMode(IntPtr hConsoleHandle, uint dwMode);
[DllImport("kernel32.dll", SetLastError=true)]
public static extern IntPtr GetStdHandle(int nStdHandle);
[DllImport("kernel32.dll", SetLastError=true)]
public static extern bool GetConsoleMode(IntPtr hConsoleHandle, out uint lpMode);
'@ -Name 'Kernel32Col' -Namespace 'Win32Col' -PassThru -ErrorAction SilentlyContinue
        if ($kernel32) {
            $handle = $kernel32::GetStdHandle(-11)
            $currentMode = 0
            $null = $kernel32::GetConsoleMode($handle, [ref]$currentMode)
            $null = $kernel32::SetConsoleMode($handle, $currentMode -bor 0x0004)
        }
    } catch {}

    $script:RED     = "$esc[0;31m"
    $script:GREEN   = "$esc[0;32m"
    $script:YELLOW  = "$esc[1;33m"
    $script:BLUE    = "$esc[0;34m"
    $script:MAGENTA = "$esc[0;35m"
    $script:CYAN    = "$esc[0;36m"
    $script:WHITE   = "$esc[0;37m"
    $script:BOLD    = "$esc[1m"
    $script:NC      = "$esc[0m"
}

function Write-Color {
    param(
        [string]$Text,
        [string]$Color = $script:NC,
        [switch]$NoNewline
    )
    if ($NoNewline) {
        Write-Host "$Color$Text$($script:NC)" -NoNewline
    } else {
        Write-Host "$Color$Text$($script:NC)"
    }
}

# ==================================================
# VARIABLES GLOBALES
# ==================================================
$script:ENV_NAME       = "dev"
$script:PROJECT_NAME   = ""
$script:STACK          = ""
$script:LABEL_FILTER   = ""
$script:COMPOSE_FILE   = ""
$script:COMPOSE_CMD    = "docker compose"
$script:BACKUP_DIR     = "docker-backups"
$script:CURRENT_IP     = ""

# Selección global de contenedores
$script:SELECTED_CONTAINER_ID   = ""
$script:SELECTED_CONTAINER_NAME = ""
$script:STACK_CONTAINERS        = @()
$script:STACK_CONTAINER_COUNT   = 0

# Selección global de perfiles/servicios
$script:SELECTED_PROFILE_ARGS  = ""
$script:SELECTED_SERVICE_ARGS  = ""

# Terminal exec user
$script:TERMINAL_EXEC_USER  = ""
$script:TERMINAL_EXEC_LABEL = ""

# ==================================================
# LECTURA DE ARCHIVOS .ENV (reemplaza grep/sed/awk)
# ==================================================

function Read-EnvFile {
    param([string]$FilePath)
    $result = @{}
    if (-not (Test-Path $FilePath)) { return $result }
    Get-Content $FilePath | ForEach-Object {
        $line = $_.Trim()
        if ($line -match '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
            $key   = $Matches[1]
            $value = $Matches[2].Trim('"').Trim("'").Trim()
            $result[$key] = $value
        }
    }
    return $result
}

function Read-ProjectName {
    $envFile = ".env"
    if (Test-Path $envFile) {
        $data = Read-EnvFile $envFile
        if ($data.ContainsKey("PROJECT_NAME")) { return $data["PROJECT_NAME"] }
    }
    return ""
}

function Read-EnvValue {
    param([string]$Key, [string]$DefaultValue = "")
    $value = ""
    foreach ($file in @(".env", ".env.$($script:ENV_NAME)")) {
        if (Test-Path $file) {
            $data = Read-EnvFile $file
            if ($data.ContainsKey($Key) -and $data[$Key] -ne "") {
                $value = $data[$Key]
            }
        }
    }
    if ($value -ne "") { return $value }
    return $DefaultValue
}

function Get-RuntimeDataRoot   { return Read-EnvValue "DATA_ROOT"    "./APP/data/$($script:ENV_NAME)" }
function Get-RuntimeLogsRoot   { return Read-EnvValue "LOGS_ROOT"    "./APP/logs/$($script:ENV_NAME)" }
function Get-RuntimeVolumesRoot{ return Read-EnvValue "VOLUMES_ROOT" "./APP/volumes" }

# ==================================================
# ARCHIVO COMPOSE SEGÚN ENTORNO
# ==================================================

function Set-ComposeFile {
    switch ($script:ENV_NAME) {
        "dev" { $script:COMPOSE_FILE = "docker-compose-dev.yml" }
        "qa"  { $script:COMPOSE_FILE = "docker-compose-qa.yml" }
        "prd" { $script:COMPOSE_FILE = "docker-compose.yml" }
        default {
            Write-Color "Entorno no valido. Se usara docker-compose-dev.yml" $script:YELLOW
            $script:COMPOSE_FILE = "docker-compose-dev.yml"
        }
    }
}

function Get-EnvColor {
    switch ($script:ENV_NAME) {
        "dev" { return "$($script:GREEN)dev$($script:NC)" }
        "qa"  { return "$($script:YELLOW)qa$($script:NC)" }
        "prd" { return "$($script:RED)prd$($script:NC)" }
        default { return $script:ENV_NAME }
    }
}

# ==================================================
# CONSTRUCCION DE COMANDOS COMPOSE
# ==================================================

function Build-ComposeCmd {
    param(
        [string]$Action,
        [string]$ProfileArgs = "",
        [string]$ServiceArgs = ""
    )
    $cmd = "$($script:COMPOSE_CMD) -f $($script:COMPOSE_FILE) --env-file .env --env-file .env.$($script:ENV_NAME)"
    if ($ProfileArgs -ne "") { $cmd += " $ProfileArgs" }
    $cmd += " $Action"
    if ($ServiceArgs -ne "") { $cmd += " $ServiceArgs" }
    return $cmd
}

function Get-AllComposeProfileArgs {
    if (-not (Test-Path $script:COMPOSE_FILE)) { return "" }
    $content = Get-Content $script:COMPOSE_FILE -Raw
    $profiles = @()
    # Buscar bloques profiles: [...] con regex .NET
    $matches_ = [regex]::Matches($content, 'profiles:\s*\[([^\]]+)\]')
    foreach ($m in $matches_) {
        $inner = $m.Groups[1].Value
        foreach ($p in $inner -split ',') {
            $clean = $p.Trim().Trim('"').Trim("'")
            if ($clean -ne "" -and $profiles -notcontains $clean) {
                $profiles += $clean
            }
        }
    }
    if ($profiles.Count -eq 0) { return "" }
    return ($profiles | ForEach-Object { "--profile $_" }) -join " "
}

function Build-FullStackDownCmd {
    param([string]$DownAction = "down")
    $profileArgs = Get-AllComposeProfileArgs
    return Build-ComposeCmd $DownAction $profileArgs
}

# ==================================================
# PARSEO DE COMPOSE FILE (reemplaza awk)
# ==================================================

function Get-ServiceBlockFromCompose {
    param([string]$ComposeFile, [string]$ServiceName)
    if (-not (Test-Path $ComposeFile)) { return "" }
    $lines = Get-Content $ComposeFile
    $inServices = $false
    $inTarget   = $false
    $block = @()

    foreach ($line in $lines) {
        if ($line -match '^services:\s*$') {
            $inServices = $true
            continue
        }
        if ($inServices -and $line -match '^[^\s]' -and $line -notmatch '^services:') {
            if ($inTarget) { break }
            $inServices = $false
        }
        if ($inServices -and $line -match "^  ${ServiceName}:\s*$") {
            $inTarget = $true
            $block += $line
            continue
        }
        if ($inTarget -and $line -match '^  [a-zA-Z0-9_-]+:') {
            break
        }
        if ($inTarget) {
            $block += $line
        }
    }
    return $block -join "`n"
}

function Get-ServiceGroupValue {
    param([string]$ServiceBlock)
    foreach ($line in $ServiceBlock -split "`n") {
        if ($line -match '^\s+service\.group:\s*(.+)$') {
            return $Matches[1].Trim()
        }
    }
    return ""
}

function Get-AllComposeServices {
    param([string]$ProfileArgs = "")
    $cmd = "$($script:COMPOSE_CMD) -f $($script:COMPOSE_FILE) --env-file .env --env-file .env.$($script:ENV_NAME)"
    if ($ProfileArgs -ne "") { $cmd += " $ProfileArgs" }
    $cmd += " config --services"
    try {
        $output = Invoke-Expression $cmd 2>$null
        return $output | Where-Object { $_ -ne "" }
    } catch {
        return @()
    }
}

function Get-ServicesByGroup {
    param([string]$TargetGroup = "all")
    $services = @()
    $allServices = Get-AllComposeServices "--profile tools"
    foreach ($svc in $allServices) {
        $block = Get-ServiceBlockFromCompose $script:COMPOSE_FILE $svc
        $group = Get-ServiceGroupValue $block
        if ($TargetGroup -eq "all" -or $group -eq $TargetGroup) {
            $services += $svc
        }
    }
    return $services
}

function Get-ProjectNamedVolumes {
    $volumes = docker volume ls --format "{{.Name}}" 2>$null
    return $volumes | Where-Object { $_ -match "^$([regex]::Escape($script:PROJECT_NAME))_" }
}

function Get-VolumeNameFromBackup {
    param([string]$BackupFilename)
    # Quitar extensión .tar.gz
    $base = $BackupFilename -replace '\.tar\.gz$', ''
    # Quitar timestamp _YYYYMMDD_HHMMSS
    $base = $base -replace '_\d{8}_\d{6}$', ''
    return $base
}

# ==================================================
# VALIDACIONES
# ==================================================

function Test-ComposeEnvFiles {
    $missing = @()
    foreach ($f in @(".env", ".env.$($script:ENV_NAME)")) {
        if (-not (Test-Path $f)) { $missing += $f }
    }
    if ($missing.Count -gt 0) {
        Write-Color "❌ Faltan archivos de entorno requeridos:" $script:RED
        foreach ($f in $missing) { Write-Color "   -- $f" $script:RED }
        Write-Host ""
        Write-Color "Cree los archivos desde .env.example y genere .env.$($script:ENV_NAME) con overrides." $script:YELLOW
        return $false
    }

    # Verificar variables requeridas en el compose
    if (-not (Test-Path $script:COMPOSE_FILE)) { return $true }
    $content = Get-Content $script:COMPOSE_FILE -Raw
    $varMatches = [regex]::Matches($content, '\$\{([A-Z0-9_]+)(?::-[^}]*)?\}')
    $requiredVars = $varMatches | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique

    $optionalEmpty = @("ITOP_PACKAGE_URL")
    $missingVars = @()
    foreach ($var in $requiredVars) {
        if ($optionalEmpty -contains $var) { continue }
        $val = Read-EnvValue $var
        if ($val -eq "") { $missingVars += $var }
    }

    if ($missingVars.Count -gt 0) {
        Write-Color "❌ Variables sin valor para $($script:COMPOSE_FILE):" $script:RED
        foreach ($v in $missingVars) { Write-Color "   -- $v" $script:RED }
        Write-Host ""
        Write-Color "Revise .env y .env.$($script:ENV_NAME) o regenerelos desde *.example." $script:YELLOW
        return $false
    }
    return $true
}

# ==================================================
# IP ACTUAL (nativo Windows)
# ==================================================

function Get-CurrentIP {
    try {
        $route = Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction Stop |
                 Sort-Object RouteMetric | Select-Object -First 1
        if ($route) {
            $ip = Get-NetIPAddress -InterfaceIndex $route.IfIndex -AddressFamily IPv4 -ErrorAction Stop |
                  Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
                  Select-Object -ExpandProperty IPAddress -First 1
            if ($ip) { return $ip }
        }
    } catch {}

    try {
        $ip = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
              Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
              Select-Object -ExpandProperty IPAddress -First 1
        if ($ip) { return $ip }
    } catch {}

    return "No detectada"
}

# ==================================================
# VERIFICACION DE DEPENDENCIAS
# ==================================================

function Test-Dependencies {
    Write-Color "==========================================================" $script:CYAN
    Write-Color "🔍 VERIFICANDO DEPENDENCIAS DEL SISTEMA" $script:CYAN
    Write-Color "==========================================================" $script:CYAN
    Write-Host ""

    $hasErrors = $false

    # Docker CLI
    $dockerPath = Get-Command docker -ErrorAction SilentlyContinue
    if (-not $dockerPath) {
        Write-Color "❌ Docker CLI: No encontrado" $script:RED
        $hasErrors = $true
    } else {
        Write-Color "✅ Docker CLI: Encontrado" $script:GREEN
        $dockerInfo = docker info 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Color "❌ Docker daemon: No esta en ejecucion" $script:RED
            Write-Color "   -- Inicie Docker Desktop o el servicio Docker" $script:YELLOW
            $hasErrors = $true
        } else {
            Write-Color "✅ Docker daemon: En ejecucion" $script:GREEN
        }
    }

    # Docker Compose plugin
    $null = docker compose version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Color "✅ Docker Compose (plugin): Encontrado" $script:GREEN
        $script:COMPOSE_CMD = "docker compose"
    } else {
        $dcPath = Get-Command docker-compose -ErrorAction SilentlyContinue
        if ($dcPath) {
            Write-Color "✅ Docker Compose (standalone): Encontrado" $script:GREEN
            $script:COMPOSE_CMD = "docker-compose"
        } else {
            Write-Color "❌ Docker Compose: No encontrado" $script:RED
            $hasErrors = $true
        }
    }

    Write-Host ""
    if ($hasErrors) {
        Write-Color "❌ ERROR: Dependencias criticas faltantes. Instale e intente de nuevo." $script:RED
        Write-Host "Presione Enter para salir..."
        Read-Host | Out-Null
        exit 1
    }

    Write-Color "✅ Verificacion de dependencias completada exitosamente" $script:GREEN
    Write-Color "==========================================================" $script:CYAN
    Write-Host ""
    Start-Sleep -Seconds 2
}

# ==================================================
# UTILIDADES DE UI
# ==================================================

function Show-Banner {
    param([string]$Title)
    Clear-Host

    $ip = if ($script:CURRENT_IP -ne "") { $script:CURRENT_IP } else { Get-CurrentIP }

    # Git branch nativo
    $gitBranch = "No es repositorio Git"
    try {
        $gb = & git rev-parse --abbrev-ref HEAD 2>$null
        if ($LASTEXITCODE -eq 0 -and $gb) { $gitBranch = $gb }
    } catch {}

    Write-Color "╔═══════════════════════════════════════════════════════════╗" $script:CYAN
    $titlePad = "DOCKER TOOLS - $Title".PadRight(57)
    Write-Color "║  $titlePad║" $script:CYAN
    Write-Color "╚═══════════════════════════════════════════════════════════╝" $script:CYAN

    Write-Color "📋 INFORMACION DEL ENTORNO:" "$($script:BLUE)$($script:BOLD)"
    Write-Host "   $($script:CYAN)Archivo:$($script:NC) $($script:COMPOSE_FILE)"
    Write-Host "   $($script:CYAN)Stack:$($script:NC)   $($script:STACK)"
    Write-Host "   $($script:CYAN)Entorno:$($script:NC) $(Get-EnvColor)"
    Write-Host "   $($script:CYAN)IP:$($script:NC)      $ip"
    Write-Host "   $($script:CYAN)Git:$($script:NC)     $gitBranch"
    Write-Host ""
}

function Invoke-Pause {
    Write-Host ""
    Write-Host "$($script:CYAN)Presione Enter para continuar...$($script:NC)" -NoNewline
    Read-Host | Out-Null
}

function Confirm-Action {
    param([string]$Message, [string]$Default = "no")
    Write-Host ""
    Write-Color "⚠️  CONFIRMACION REQUERIDA" $script:YELLOW
    Write-Color "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" $script:YELLOW
    Write-Color $Message $script:YELLOW
    Write-Host ""
    if ($Default -eq "si") {
        $prompt = "$($script:CYAN)¿Continuar? [S/n]: $($script:NC)"
        $response = Read-Host $prompt
        if ($response -eq "") { $response = "S" }
    } else {
        $prompt = "$($script:CYAN)¿Continuar? [s/N]: $($script:NC)"
        $response = Read-Host $prompt
        if ($response -eq "") { $response = "N" }
    }
    if ($response -match '^[Ss]$') {
        Write-Color "⏳ Procediendo..." $script:BLUE
        return $true
    }
    Write-Color "⏭️  Operacion cancelada" $script:BLUE
    return $false
}

function Invoke-DockerCmd {
    param(
        [string]$Cmd,
        [string]$ErrorMsg  = "Error al ejecutar el comando",
        [string]$SuccessMsg = "Comando ejecutado exitosamente"
    )
    Write-Color "▶ Ejecutando: $Cmd" $script:CYAN
    Write-Color "────────────────────────────────────────────────" $script:CYAN
    Invoke-Expression $Cmd
    $code = $LASTEXITCODE
    Write-Color "────────────────────────────────────────────────" $script:CYAN
    if ($code -ne 0) {
        Write-Color "❌ $ErrorMsg (codigo: $code)" $script:RED
        return $false
    }
    Write-Color "✅ $SuccessMsg" $script:GREEN
    return $true
}

function Test-FileExists {
    param([string]$File, [string]$Purpose = "operacion")
    if (-not (Test-Path $File)) {
        Write-Color "❌ Error: Archivo no encontrado: $File" $script:RED
        Write-Color "   -- Necesario para: $Purpose" $script:YELLOW
        return $false
    }
    return $true
}

# ==================================================
# SELECCION DE SERVICIOS (reemplaza ask_service_groups)
# ==================================================

function Select-ServiceGroups {
    $script:SELECTED_PROFILE_ARGS = ""
    $script:SELECTED_SERVICE_ARGS = ""

    $coreServices       = Get-ServicesByGroup "core"
    $dependencyServices = Get-ServicesByGroup "dependency"
    $toolsServices      = Get-ServicesByGroup "tools"

    $selected = @() + $coreServices

    Write-Host ""
    Write-Color "🧩 ALCANCE DEL LEVANTE" "$($script:CYAN)$($script:BOLD)"
    Write-Color "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" $script:CYAN
    Write-Host "El grupo base para el entorno $($script:BOLD)$($script:ENV_NAME)$($script:NC) sera siempre $($script:BOLD)core$($script:NC)."
    Write-Host ""

    if ($dependencyServices.Count -gt 0) {
        Write-Host "Dependencias disponibles:"
        foreach ($s in $dependencyServices) { Write-Host "   * $s" }
        Write-Host ""
        $r = Read-Host "$($script:CYAN)¿Desea anexar tambien dependency? [s/N]$($script:NC)"
        if ($r -match '^[Ss]$') { $selected += $dependencyServices }
    }

    if ($toolsServices.Count -gt 0) {
        Write-Host ""
        Write-Host "Herramientas disponibles:"
        foreach ($s in $toolsServices) { Write-Host "   * $s" }
        Write-Host ""
        $r = Read-Host "$($script:CYAN)¿Desea anexar tambien tools? [s/N]$($script:NC)"
        if ($r -match '^[Ss]$') {
            $script:SELECTED_PROFILE_ARGS = "--profile tools"
            $selected += $toolsServices
        }
    }

    Write-Host ""
    Write-Color "Nota: Docker Compose puede iniciar dependencias tecnicas adicionales cuando corresponda." $script:YELLOW

    if ($selected.Count -gt 0) {
        $script:SELECTED_SERVICE_ARGS = $selected -join " "
    }
}

# ==================================================
# LISTAR CONTENEDORES DEL STACK
# ==================================================

function Get-StackContainers {
    param([switch]$All)
    $args_ = '--filter', "label=$($script:LABEL_FILTER)", '--format', '{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}'
    if ($All) {
        return docker ps -a @args_ 2>$null
    }
    return docker ps @args_ 2>$null
}

function Show-StackContainers {
    param([string]$Format = "simple", [switch]$IncludeAll)
    $raw = Get-StackContainers -All:$IncludeAll
    $containers = @($raw | Where-Object { $_ -ne "" })

    if ($containers.Count -eq 0) {
        Write-Color "⚠️  No se encontraron contenedores con etiqueta: $($script:LABEL_FILTER)" $script:YELLOW
        $script:STACK_CONTAINERS      = @()
        $script:STACK_CONTAINER_COUNT = 0
        return $false
    }

    $script:STACK_CONTAINERS      = $containers
    $script:STACK_CONTAINER_COUNT = $containers.Count

    Write-Host ""
    switch ($Format) {
        "simple" {
            Write-Host "$($script:BOLD)$('{0,-4} {1,-25} {2,-15}' -f '#','NOMBRE','ESTADO')$($script:NC)"
            Write-Host "----------------------------------------------------"
            for ($i = 0; $i -lt $containers.Count; $i++) {
                $parts  = $containers[$i] -split '\|'
                $name   = $parts[1]; $status = $parts[3]
                $color  = $script:GREEN
                if ($status -match 'Exited') { $color = $script:RED }
                elseif ($status -match 'Paused') { $color = $script:YELLOW }
                $nameT   = if ($name.Length -gt 25)   { $name.Substring(0,25) }   else { $name }
                $statusT = if ($status.Length -gt 15) { $status.Substring(0,15) } else { $status }
                Write-Host "$($i+1)   $($nameT.PadRight(25)) $color$statusT$($script:NC)"
            }
        }
        "detailed" {
            Write-Host "$($script:BOLD)$('{0,-4} {1,-25} {2,-30} {3,-15} {4,-25}' -f '#','NOMBRE','IMAGEN','ESTADO','PUERTOS')$($script:NC)"
            Write-Host "------------------------------------------------------------------------------------------"
            for ($i = 0; $i -lt $containers.Count; $i++) {
                $parts  = $containers[$i] -split '\|'
                $name   = $parts[1]; $image = $parts[2]; $status = $parts[3]; $ports = $parts[4]
                $color  = $script:GREEN
                if ($status -match 'Exited') { $color = $script:RED }
                elseif ($status -match 'Paused') { $color = $script:YELLOW }
                $nT = if ($name.Length   -gt 25) { $name.Substring(0,25) }   else { $name }
                $iT = if ($image.Length  -gt 30) { $image.Substring(0,30) }  else { $image }
                $sT = if ($status.Length -gt 15) { $status.Substring(0,15) } else { $status }
                $pT = if ($ports.Length  -gt 25) { $ports.Substring(0,25) }  else { $ports }
                Write-Host "$($i+1)   $($nT.PadRight(25)) $($iT.PadRight(30)) $color$($sT.PadRight(15))$($script:NC) $pT"
            }
        }
    }
    return $true
}

function Select-ContainerFromStack {
    param(
        [string]$Prompt     = "Seleccione el numero del contenedor",
        [bool]$AllowExit    = $true,
        [bool]$ShowAll      = $false
    )
    Write-Host ""
    Write-Color "📋 CONTENEDORES DISPONIBLES:" "$($script:CYAN)$($script:BOLD)"

    if (-not (Show-StackContainers -Format "detailed" -IncludeAll:$ShowAll)) {
        return "error"
    }

    $exitIndex = $script:STACK_CONTAINER_COUNT + 1
    Write-Host ""
    if ($AllowExit) {
        Write-Color "$exitIndex) ⬅️ Volver al menu anterior" $script:YELLOW
    }
    Write-Host ""

    $index = Read-Host "$($script:CYAN)$Prompt$($script:NC)"
    if ($AllowExit -and ($index -eq "$exitIndex" -or $index -eq "0")) {
        return "back"
    }

    $i = 0
    if (-not [int]::TryParse($index, [ref]$i) -or $i -lt 1 -or $i -gt $script:STACK_CONTAINER_COUNT) {
        Write-Color "❌ Indice invalido. Debe ser un numero entre 1 y $($script:STACK_CONTAINER_COUNT)" $script:RED
        Start-Sleep -Seconds 2
        return "error"
    }

    $parts = $script:STACK_CONTAINERS[$i - 1] -split '\|'
    $script:SELECTED_CONTAINER_ID   = $parts[0]
    $script:SELECTED_CONTAINER_NAME = $parts[1]
    Write-Color "✅ Seleccionado: $($script:SELECTED_CONTAINER_NAME)" $script:GREEN
    return "ok"
}

# ==================================================
# LIMPIEZA DE DIRECTORIOS (reemplaza remove_directory_contents)
# ==================================================

function Remove-DirectoryContents {
    param([string]$TargetDir, [string]$Label = "")
    if (-not (Test-Path $TargetDir)) {
        Write-Color "⚠️  No existe el directorio $TargetDir" $script:YELLOW
        return
    }
    $items = Get-ChildItem $TargetDir -Force | Where-Object { $_.Name -ne ".gitkeep" }
    if ($items.Count -eq 0) {
        Write-Color "⚠️  $Label ya esta vacio" $script:YELLOW
        return
    }
    foreach ($item in $items) {
        try {
            Remove-Item $item.FullName -Recurse -Force -ErrorAction Stop
            Write-Color "✅ Eliminado: $($item.FullName)" $script:GREEN
        } catch {
            Write-Color "❌ Error al eliminar $($item.FullName)" $script:RED
        }
    }
}

function Remove-RuntimeArtifacts {
    $volumesRoot = Get-RuntimeVolumesRoot
    Write-Color "Buscando artefactos de runtime en $volumesRoot..." $script:BLUE
    if (-not (Test-Path $volumesRoot)) {
        Write-Color "⚠️  No existe el directorio $volumesRoot" $script:YELLOW
        return
    }
    $targets = @("node_modules","__pycache__",".pytest_cache",".mypy_cache",".ruff_cache",".venv","venv","dist","build","coverage")
    $removedAny = $false
    foreach ($target in $targets) {
        $found = Get-ChildItem $volumesRoot -Recurse -Filter $target -Force -ErrorAction SilentlyContinue |
                 Where-Object { $_.FullName -notmatch '[\\/]\.git[\\/]' }
        foreach ($f in $found) {
            $removedAny = $true
            try {
                Remove-Item $f.FullName -Recurse -Force -ErrorAction Stop
                Write-Color "✅ Eliminado: $($f.FullName)" $script:GREEN
            } catch {
                Write-Color "❌ Error al eliminar $($f.FullName)" $script:RED
            }
        }
    }
    # Archivos .pyc .pyo
    $pyFiles = Get-ChildItem $volumesRoot -Recurse -Include "*.pyc","*.pyo" -Force -ErrorAction SilentlyContinue |
               Where-Object { $_.FullName -notmatch '[\\/]\.git[\\/]' }
    foreach ($f in $pyFiles) {
        $removedAny = $true
        try {
            Remove-Item $f.FullName -Force -ErrorAction Stop
            Write-Color "✅ Eliminado: $($f.FullName)" $script:GREEN
        } catch {
            Write-Color "❌ Error al eliminar $($f.FullName)" $script:RED
        }
    }
    if (-not $removedAny) {
        Write-Color "⚠️  No se encontraron artefactos de runtime para limpiar" $script:YELLOW
    }
}

# ==================================================
# BACKUP / RESTORE
# ==================================================

function Get-BackupFileSize {
    param([string]$FilePath)
    if (Test-Path $FilePath) {
        $size = (Get-Item $FilePath).Length
        if ($size -gt 1MB) { return "$([math]::Round($size/1MB,1)) MB" }
        return "$([math]::Round($size/1KB,1)) KB"
    }
    return "?"
}

# ==================================================
# MENU PRINCIPAL
# ==================================================

function Show-Menu {
    Show-Banner "MENU PRINCIPAL"
    Write-Color "OPCIONES DISPONIBLES:" $script:BOLD
    Write-Host ""
    Write-Host "  $($script:CYAN)1)$($script:NC) 📦 MANEJADOR DE CONTENEDORES"
    Write-Host "  $($script:CYAN)2)$($script:NC) 📊 MONITOREO Y DIAGNOSTICO"
    Write-Host "  $($script:CYAN)3)$($script:NC) 🧹 LIMPIEZA Y MANTENIMIENTO"
    Write-Host "  $($script:CYAN)4)$($script:NC) ⚙️ CONFIGURACION DEL SISTEMA"
    Write-Host "  $($script:CYAN)5)$($script:NC) 📱 HERRAMIENTAS EXPO"
    Write-Host "  $($script:CYAN)6)$($script:NC) 📄 GESTION DE TEMPLATES .ENV"
    Write-Host "  $($script:CYAN)7)$($script:NC) 🐳 ESTADO Y SERVICIOS DOCKER"
    Write-Host "  $($script:CYAN)8)$($script:NC) 🧰 PORTAINER"
    Write-Host "  $($script:CYAN)9)$($script:NC) 💾 BACKUP Y RESTORE"
    Write-Host ""
    Write-Host "  $($script:CYAN)S)$($script:NC) 🚪 Salir"
    Write-Host ""
    $choice = Read-Host "$($script:CYAN)👉 Seleccione una opcion$($script:NC)"
    switch ($choice.ToUpper()) {
        "1" { Show-MenuContenedores }
        "2" { Show-MenuMonitoreo }
        "3" { Show-MenuLimpieza }
        "4" { Show-MenuConfiguracion }
        "5" { Show-MenuExpo }
        "6" { Show-MenuTemplates }
        "7" { Show-MenuDockerServices }
        "8" { Show-MenuPortainer }
        "9" { Show-MenuBackup }
        "S" { Invoke-Exit }
        default {
            Write-Color "❌ Opcion invalida" $script:RED
            Start-Sleep -Seconds 2
            Show-Menu
        }
    }
}

# ==================================================
# MENU CONTENEDORES
# ==================================================

function Show-MenuContenedores {
    Show-Banner "MANEJADOR DE CONTENEDORES"
    Write-Color "OPCIONES DISPONIBLES:" $script:BOLD
    Write-Host ""
    Write-Host "  $($script:CYAN)1)$($script:NC) 🚀 Iniciar contenedores y construir imagenes"
    Write-Host "  $($script:CYAN)2)$($script:NC) 🛑 Detener y eliminar contenedores"
    Write-Host "  $($script:CYAN)3)$($script:NC) 🔄 Reiniciar contenedores"
    Write-Host "  $($script:CYAN)4)$($script:NC) 🔃 Reiniciar contenedor unico"
    Write-Host "  $($script:CYAN)5)$($script:NC) 🔨 Construir imagenes"
    Write-Host "  $($script:CYAN)6)$($script:NC) 🔍 Validar Docker Compose"
    Write-Host "  $($script:CYAN)7)$($script:NC) 📏 Validar reglas del proyecto"
    Write-Host ""
    Write-Host "  $($script:CYAN)V)$($script:NC) ⬅️ Volver"
    Write-Host "  $($script:CYAN)S)$($script:NC) 🚪 Salir"
    Write-Host ""
    $choice = Read-Host "$($script:CYAN)👉 Seleccione una opcion$($script:NC)"
    switch ($choice.ToUpper()) {
        "1" { Invoke-Up }
        "2" { Invoke-Down }
        "3" { Invoke-Restart }
        "4" { Invoke-RestartSingle }
        "5" { Invoke-Build }
        "6" { Invoke-ValidateCompose }
        "7" { Invoke-ValidateComposeRules }
        "V" { Show-Menu }
        "S" { Invoke-Exit }
        default {
            Write-Color "❌ Opcion invalida" $script:RED
            Start-Sleep -Seconds 2
            Show-MenuContenedores
        }
    }
}

# ==================================================
# MENU MONITOREO
# ==================================================

function Show-MenuMonitoreo {
    Show-Banner "MONITOREO Y DIAGNOSTICO"
    Write-Color "OPCIONES DISPONIBLES:" $script:BOLD
    Write-Host ""
    Write-Host "  $($script:CYAN)1)$($script:NC) 📋 Ver logs"
    Write-Host "  $($script:CYAN)2)$($script:NC) 🔎 Ver logs de un contenedor"
    Write-Host "  $($script:CYAN)3)$($script:NC) 📊 Estado de los contenedores"
    Write-Host "  $($script:CYAN)4)$($script:NC) 📦 Listar contenedores de stack"
    Write-Host "  $($script:CYAN)5)$($script:NC) 💻 Abrir terminal en contenedor"
    Write-Host "  $($script:CYAN)6)$($script:NC) 📈 Monitoreo de recursos"
    Write-Host ""
    Write-Host "  $($script:CYAN)V)$($script:NC) ⬅️ Volver"
    Write-Host "  $($script:CYAN)S)$($script:NC) 🚪 Salir"
    Write-Host ""
    $choice = Read-Host "$($script:CYAN)👉 Seleccione una opcion$($script:NC)"
    switch ($choice.ToUpper()) {
        "1" { Invoke-Logs }
        "2" { Invoke-LogsSingle }
        "3" { Invoke-Ps }
        "4" { Invoke-ListStack }
        "5" { Invoke-ExecStack }
        "6" { Invoke-MonitorResources }
        "V" { Show-Menu }
        "S" { Invoke-Exit }
        default {
            Write-Color "❌ Opcion invalida" $script:RED
            Start-Sleep -Seconds 2
            Show-MenuMonitoreo
        }
    }
}

# ==================================================
# MENU LIMPIEZA
# ==================================================

function Show-MenuLimpieza {
    Show-Banner "LIMPIEZA Y MANTENIMIENTO"
    Write-Color "OPCIONES DISPONIBLES:" $script:BOLD
    Write-Host ""
    Write-Host "  $($script:CYAN)1)$($script:NC) 🧹 Limpiar contenedores, redes y volumenes"
    Write-Host "  $($script:CYAN)2)$($script:NC) 🖼️ Limpiar imagenes no utilizadas"
    Write-Host "  $($script:CYAN)3)$($script:NC) 💾 Limpiar volumenes no utilizados"
    Write-Host "  $($script:CYAN)4)$($script:NC) 🗑️ Limpiar todo"
    Write-Host "  $($script:CYAN)5)$($script:NC) 🔥 Eliminar Persistencias"
    Write-Host ""
    Write-Host "  $($script:CYAN)V)$($script:NC) ⬅️ Volver"
    Write-Host "  $($script:CYAN)S)$($script:NC) 🚪 Salir"
    Write-Host ""
    $choice = Read-Host "$($script:CYAN)👉 Seleccione una opcion$($script:NC)"
    switch ($choice.ToUpper()) {
        "1" { Invoke-Clean }
        "2" { Invoke-CleanImagesEnhanced }
        "3" { Invoke-CleanVolumes }
        "4" { Invoke-CleanAll }
        "5" { Invoke-DropPersistence }
        "V" { Show-Menu }
        "S" { Invoke-Exit }
        default {
            Write-Color "❌ Opcion invalida" $script:RED
            Start-Sleep -Seconds 2
            Show-MenuLimpieza
        }
    }
}

# ==================================================
# MENU CONFIGURACION
# ==================================================

function Show-MenuConfiguracion {
    Show-Banner "CONFIGURACION DEL SISTEMA"
    Write-Color "OPCIONES DISPONIBLES:" $script:BOLD
    Write-Host ""
    Write-Host "  $($script:CYAN)1)$($script:NC) 🔧 Cambiar entorno (dev, qa, prd)"
    Write-Host "  $($script:CYAN)2)$($script:NC) 🌐 Actualizar IP para Expo / Android"
    Write-Host "  $($script:CYAN)3)$($script:NC) 🔍 Verificar IP de Expo / Android"
    Write-Host "  $($script:CYAN)4)$($script:NC) 📋 Listar variables de entorno"
    Write-Host ""
    Write-Host "  $($script:CYAN)V)$($script:NC) ⬅️ Volver"
    Write-Host "  $($script:CYAN)S)$($script:NC) 🚪 Salir"
    Write-Host ""
    $choice = Read-Host "$($script:CYAN)👉 Seleccione una opcion$($script:NC)"
    switch ($choice.ToUpper()) {
        "1" { Invoke-ChangeEnv }
        "2" { Invoke-UpdateIPMenu }
        "3" { Invoke-CheckIPMenu }
        "4" { Invoke-ValidateContainerEnv }
        "V" { Show-Menu }
        "S" { Invoke-Exit }
        default {
            Write-Color "❌ Opcion invalida" $script:RED
            Start-Sleep -Seconds 2
            Show-MenuConfiguracion
        }
    }
}

# ==================================================
# MENU BACKUP
# ==================================================

function Show-MenuBackup {
    Show-Banner "BACKUP Y RESTORE"
    Write-Color "OPCIONES DISPONIBLES:" $script:BOLD
    Write-Host ""
    Write-Host "  $($script:CYAN)1)$($script:NC) 💾 Backup de volumenes"
    Write-Host "  $($script:CYAN)2)$($script:NC) 🔄 Restaurar volumen"
    Write-Host ""
    Write-Host "  $($script:CYAN)V)$($script:NC) ⬅️ Volver"
    Write-Host "  $($script:CYAN)S)$($script:NC) 🚪 Salir"
    Write-Host ""
    $choice = Read-Host "$($script:CYAN)👉 Seleccione una opcion$($script:NC)"
    switch ($choice.ToUpper()) {
        "1" { Invoke-BackupVolumes }
        "2" { Invoke-RestoreVolume }
        "V" { Show-Menu }
        "S" { Invoke-Exit }
        default {
            Write-Color "❌ Opcion invalida" $script:RED
            Start-Sleep -Seconds 2
            Show-MenuBackup
        }
    }
}

# ==================================================
# MENU EXPO
# ==================================================

function Show-MenuExpo {
    Show-Banner "HERRAMIENTAS EXPO"
    Write-Color "OPCIONES DISPONIBLES:" $script:BOLD
    Write-Host ""
    Write-Host "  $($script:CYAN)1)$($script:NC) 🚀 Iniciar Expo Development Server"
    Write-Host "  $($script:CYAN)2)$($script:NC) 🏗️ EAS Build"
    Write-Host ""
    Write-Host "  $($script:CYAN)V)$($script:NC) ⬅️ Volver"
    Write-Host "  $($script:CYAN)S)$($script:NC) 🚪 Salir"
    Write-Host ""
    $choice = Read-Host "$($script:CYAN)👉 Seleccione una opcion$($script:NC)"
    switch ($choice.ToUpper()) {
        "1" { Write-Color "⚠️  Funcion en desarrollo" $script:YELLOW; Start-Sleep 2; Show-MenuExpo }
        "2" { Write-Color "⚠️  Funcion en desarrollo" $script:YELLOW; Start-Sleep 2; Show-MenuExpo }
        "V" { Show-Menu }
        "S" { Invoke-Exit }
        default {
            Write-Color "❌ Opcion invalida" $script:RED
            Start-Sleep -Seconds 2
            Show-MenuExpo
        }
    }
}

# ==================================================
# MENU TEMPLATES
# ==================================================

function Show-MenuTemplates {
    Show-Banner "GESTION DE TEMPLATES .ENV"
    Write-Color "OPCIONES DISPONIBLES:" $script:BOLD
    Write-Host ""
    Write-Host "  $($script:CYAN)1)$($script:NC) 🔨 Generar .env.template"
    Write-Host "  $($script:CYAN)2)$($script:NC) 📋 Generar archivos .env desde template"
    Write-Host "  $($script:CYAN)3)$($script:NC) 🔍 Verificar archivos .env"
    Write-Host ""
    Write-Host "  $($script:CYAN)V)$($script:NC) ⬅️ Volver"
    Write-Host "  $($script:CYAN)S)$($script:NC) 🚪 Salir"
    Write-Host ""
    $choice = Read-Host "$($script:CYAN)👉 Seleccione una opcion$($script:NC)"
    switch ($choice.ToUpper()) {
        "1" { Write-Color "⚠️  Funcion en desarrollo" $script:YELLOW; Start-Sleep 2; Show-MenuTemplates }
        "2" { Write-Color "⚠️  Funcion en desarrollo" $script:YELLOW; Start-Sleep 2; Show-MenuTemplates }
        "3" { Write-Color "⚠️  Funcion en desarrollo" $script:YELLOW; Start-Sleep 2; Show-MenuTemplates }
        "V" { Show-Menu }
        "S" { Invoke-Exit }
        default {
            Write-Color "❌ Opcion invalida" $script:RED
            Start-Sleep -Seconds 2
            Show-MenuTemplates
        }
    }
}

# ==================================================
# MENU DOCKER SERVICES
# ==================================================

function Show-MenuDockerServices {
    Show-Banner "ESTADO Y SERVICIOS DOCKER"
    Write-Color "OPCIONES DISPONIBLES:" $script:BOLD
    Write-Host ""
    Write-Host "  $($script:CYAN)1)$($script:NC) 🔍 Estado Docker Engine"
    Write-Host "  $($script:CYAN)2)$($script:NC) 🖥️ Estado Docker Desktop"
    Write-Host "  $($script:CYAN)3)$($script:NC) 🔄 Reiniciar Docker Engine"
    Write-Host "  $($script:CYAN)4)$($script:NC) 🔄 Reiniciar Docker Desktop"
    Write-Host "  $($script:CYAN)5)$($script:NC) ♻️ Reiniciar Ambos"
    Write-Host ""
    Write-Host "  $($script:CYAN)V)$($script:NC) ⬅️ Volver"
    Write-Host "  $($script:CYAN)S)$($script:NC) 🚪 Salir"
    Write-Host ""
    $choice = Read-Host "$($script:CYAN)👉 Seleccione una opcion$($script:NC)"
    switch ($choice.ToUpper()) {
        "1" {
            docker info
            Invoke-Pause
            Show-MenuDockerServices
        }
        "2" {
            # Estado Docker Desktop via proceso Windows
            $dd = Get-Process -Name "Docker Desktop" -ErrorAction SilentlyContinue
            if ($dd) {
                Write-Color "✅ Docker Desktop esta en ejecucion (PID: $($dd.Id))" $script:GREEN
            } else {
                Write-Color "⚠️  Docker Desktop no esta en ejecucion" $script:YELLOW
            }
            Invoke-Pause
            Show-MenuDockerServices
        }
        "3" {
            if (Confirm-Action "¿Reiniciar Docker Engine (servicio com.docker.service)?" "no") {
                try {
                    Restart-Service -Name "com.docker.service" -ErrorAction Stop
                    Write-Color "✅ Docker Engine reiniciado" $script:GREEN
                } catch {
                    Write-Color "❌ No se pudo reiniciar. Ejecute como Administrador." $script:RED
                }
            }
            Invoke-Pause
            Show-MenuDockerServices
        }
        "4" {
            if (Confirm-Action "¿Reiniciar Docker Desktop?" "no") {
                $dd = Get-Process -Name "Docker Desktop" -ErrorAction SilentlyContinue
                if ($dd) {
                    Stop-Process -Name "Docker Desktop" -Force
                    Start-Sleep -Seconds 3
                    $ddPath = "${env:ProgramFiles}\Docker\Docker\Docker Desktop.exe"
                    if (Test-Path $ddPath) {
                        Start-Process $ddPath
                        Write-Color "✅ Docker Desktop reiniciando..." $script:GREEN
                    } else {
                        Write-Color "⚠️  No se encontro Docker Desktop.exe. Inicielo manualmente." $script:YELLOW
                    }
                } else {
                    Write-Color "⚠️  Docker Desktop no estaba en ejecucion" $script:YELLOW
                }
            }
            Invoke-Pause
            Show-MenuDockerServices
        }
        "5" {
            if (Confirm-Action "¿Reiniciar Docker Engine y Docker Desktop?" "no") {
                try { Restart-Service -Name "com.docker.service" -ErrorAction Stop } catch {}
                $dd = Get-Process -Name "Docker Desktop" -ErrorAction SilentlyContinue
                if ($dd) { Stop-Process -Name "Docker Desktop" -Force; Start-Sleep 3 }
                $ddPath = "${env:ProgramFiles}\Docker\Docker\Docker Desktop.exe"
                if (Test-Path $ddPath) { Start-Process $ddPath }
                Write-Color "✅ Reinicio solicitado" $script:GREEN
            }
            Invoke-Pause
            Show-MenuDockerServices
        }
        "V" { Show-Menu }
        "S" { Invoke-Exit }
        default {
            Write-Color "❌ Opcion invalida" $script:RED
            Start-Sleep -Seconds 2
            Show-MenuDockerServices
        }
    }
}

# ==================================================
# MENU PORTAINER
# ==================================================

$script:PORTAINER_NAME  = "portainer"
$script:PORTAINER_IMAGE = "portainer/portainer-ce:latest"

function Show-MenuPortainer {
    Show-Banner "PORTAINER"
    Write-Color "OPCIONES DISPONIBLES:" $script:BOLD
    Write-Host ""
    Write-Host "  $($script:CYAN)1)$($script:NC) ▶️ Iniciar Portainer"
    Write-Host "  $($script:CYAN)2)$($script:NC) ⏹️ Detener Portainer"
    Write-Host "  $($script:CYAN)3)$($script:NC) 🔄 Reiniciar Portainer"
    Write-Host "  $($script:CYAN)4)$($script:NC) 🌐 Abrir en navegador"
    Write-Host "  $($script:CYAN)5)$($script:NC) 📋 Ver logs"
    Write-Host "  $($script:CYAN)6)$($script:NC) ♻️ Recrear Portainer"
    Write-Host ""
    Write-Host "  $($script:CYAN)V)$($script:NC) ⬅️ Volver"
    Write-Host "  $($script:CYAN)S)$($script:NC) 🚪 Salir"
    Write-Host ""
    $choice = Read-Host "$($script:CYAN)👉 Seleccione una opcion$($script:NC)"
    switch ($choice.ToUpper()) {
        "1" {
            $exists = docker ps -a --format '{{.Names}}' 2>$null | Where-Object { $_ -eq $script:PORTAINER_NAME }
            if (-not $exists) {
                docker run -d --name $script:PORTAINER_NAME --restart unless-stopped `
                    -p 9000:9000 `
                    -v /var/run/docker.sock:/var/run/docker.sock `
                    -v portainer_data:/data `
                    $script:PORTAINER_IMAGE | Out-Null
            } else {
                docker start $script:PORTAINER_NAME | Out-Null
            }
            if ($LASTEXITCODE -eq 0) {
                Write-Color "✅ Portainer iniciado en http://localhost:9000" $script:GREEN
            } else {
                Write-Color "❌ Error al iniciar Portainer" $script:RED
            }
            Invoke-Pause; Show-MenuPortainer
        }
        "2" {
            docker stop $script:PORTAINER_NAME | Out-Null
            if ($LASTEXITCODE -eq 0) { Write-Color "✅ Portainer detenido" $script:GREEN }
            else { Write-Color "❌ Error al detener" $script:RED }
            Invoke-Pause; Show-MenuPortainer
        }
        "3" {
            docker restart $script:PORTAINER_NAME | Out-Null
            if ($LASTEXITCODE -eq 0) { Write-Color "✅ Portainer reiniciado" $script:GREEN }
            else { Write-Color "❌ Error al reiniciar" $script:RED }
            Invoke-Pause; Show-MenuPortainer
        }
        "4" {
            Start-Process "http://localhost:9000"
            Invoke-Pause; Show-MenuPortainer
        }
        "5" {
            docker logs $script:PORTAINER_NAME --tail 50
            Invoke-Pause; Show-MenuPortainer
        }
        "6" {
            if (Confirm-Action "¿Recrear contenedor Portainer?" "no") {
                docker stop $script:PORTAINER_NAME 2>$null | Out-Null
                docker rm $script:PORTAINER_NAME 2>$null | Out-Null
                docker volume create portainer_data | Out-Null
                docker run -d --name $script:PORTAINER_NAME --restart unless-stopped `
                    -p 9000:9000 `
                    -v /var/run/docker.sock:/var/run/docker.sock `
                    -v portainer_data:/data `
                    $script:PORTAINER_IMAGE | Out-Null
                if ($LASTEXITCODE -eq 0) { Write-Color "✅ Portainer recreado" $script:GREEN }
                else { Write-Color "❌ Error al recrear" $script:RED }
            }
            Invoke-Pause; Show-MenuPortainer
        }
        "V" { Show-Menu }
        "S" { Invoke-Exit }
        default {
            Write-Color "❌ Opcion invalida" $script:RED
            Start-Sleep -Seconds 2
            Show-MenuPortainer
        }
    }
}

# ==================================================
# ACCIONES DE CONTENEDORES
# ==================================================

function Invoke-Up {
    Show-Banner "INICIAR CONTENEDORES"
    if (-not (Test-ComposeEnvFiles)) { Invoke-Pause; Show-MenuContenedores; return }
    Select-ServiceGroups
    Invoke-DockerCmd (Build-ComposeCmd "up -d --build" $script:SELECTED_PROFILE_ARGS $script:SELECTED_SERVICE_ARGS) `
        "Error al iniciar contenedores" "Contenedores iniciados exitosamente" | Out-Null
    Invoke-Pause; Show-MenuContenedores
}

function Invoke-Down {
    Show-Banner "DETENER CONTENEDORES"
    if (-not (Test-ComposeEnvFiles)) { Invoke-Pause; Show-MenuContenedores; return }
    if (Confirm-Action "¿Detener y eliminar todos los contenedores del stack?" "no") {
        Invoke-DockerCmd (Build-FullStackDownCmd "down") "Error al detener contenedores" "Contenedores detenidos exitosamente" | Out-Null
    }
    Invoke-Pause; Show-MenuContenedores
}

function Invoke-Restart {
    Show-Banner "REINICIAR CONTENEDORES"
    if (-not (Test-ComposeEnvFiles)) { Invoke-Pause; Show-MenuContenedores; return }
    if (Confirm-Action "¿Reiniciar todos los contenedores del stack?" "no") {
        Select-ServiceGroups
        Invoke-DockerCmd (Build-FullStackDownCmd "down") "Error al detener contenedores" | Out-Null
        Invoke-DockerCmd (Build-ComposeCmd "up -d --build" $script:SELECTED_PROFILE_ARGS $script:SELECTED_SERVICE_ARGS) `
            "Error al iniciar contenedores" "Contenedores reiniciados exitosamente" | Out-Null
    }
    Invoke-Pause; Show-MenuContenedores
}

function Invoke-RestartSingle {
    Show-Banner "REINICIAR CONTENEDOR UNICO"
    $result = Select-ContainerFromStack "Seleccione contenedor a reiniciar" $true $false
    if ($result -ne "ok") { Show-MenuContenedores; return }
    if (Confirm-Action "¿Reiniciar contenedor $($script:SELECTED_CONTAINER_NAME)?" "no") {
        Invoke-DockerCmd "docker restart $($script:SELECTED_CONTAINER_ID)" `
            "Error al reiniciar contenedor" "Contenedor reiniciado exitosamente" | Out-Null
    }
    Invoke-Pause; Show-MenuContenedores
}

function Invoke-Build {
    Show-Banner "CONSTRUIR IMAGENES"
    if (-not (Test-ComposeEnvFiles)) { Invoke-Pause; Show-MenuContenedores; return }
    Select-ServiceGroups
    Invoke-DockerCmd (Build-ComposeCmd "build" $script:SELECTED_PROFILE_ARGS $script:SELECTED_SERVICE_ARGS) `
        "Error al construir imagenes" "Imagenes construidas exitosamente" | Out-Null
    Invoke-Pause; Show-MenuContenedores
}

# ==================================================
# VALIDACIONES COMPOSE
# ==================================================

function Invoke-ValidateCompose {
    Show-Banner "VALIDAR DOCKER COMPOSE"
    if (-not (Test-FileExists $script:COMPOSE_FILE "validacion de sintaxis")) { Invoke-Pause; Show-MenuContenedores; return }
    if (-not (Test-ComposeEnvFiles)) { Invoke-Pause; Show-MenuContenedores; return }
    Write-Color "Validando configuracion..." $script:BLUE
    Write-Host ""
    $cmd = Build-ComposeCmd "config"
    $output = Invoke-Expression "$cmd" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Color "✅ VALIDACION EXITOSA" "$($script:GREEN)$($script:BOLD)"
        Write-Host ""
        Write-Color "📋 SERVICIOS CONFIGURADOS:" $script:CYAN
        $svcCmd = Build-ComposeCmd "config --services"
        Invoke-Expression $svcCmd | ForEach-Object { Write-Host "   * $_" }
    } else {
        Write-Color "❌ ERROR DE VALIDACION" "$($script:RED)$($script:BOLD)"
        Write-Host $output
    }
    Invoke-Pause; Show-MenuContenedores
}

function Invoke-ValidateComposeRules {
    Show-Banner "VALIDAR REGLAS DEL COMPOSE"
    if (-not (Test-FileExists $script:COMPOSE_FILE "validacion de reglas")) { Invoke-Pause; Show-MenuContenedores; return }
    if (-not (Test-ComposeEnvFiles)) { Invoke-Pause; Show-MenuContenedores; return }

    $tmpConfig = [System.IO.Path]::GetTempFileName()
    try {
        $expandCmd = Build-ComposeCmd "config" "--profile tools"
        Invoke-Expression "$expandCmd" 2>$null | Out-File $tmpConfig -Encoding utf8
        if ($LASTEXITCODE -ne 0) {
            Write-Color "❌ No se pudo expandir la configuracion de Compose para validar reglas" $script:RED
            Invoke-Pause; Show-MenuContenedores; return
        }
    } catch {
        Write-Color "❌ Error al expandir la configuracion" $script:RED
        Remove-Item $tmpConfig -Force -ErrorAction SilentlyContinue
        Invoke-Pause; Show-MenuContenedores; return
    }

    $services = Get-AllComposeServices "--profile tools"
    $errors   = 0
    $warnings = 0
    $tmpContent = Get-Content $tmpConfig -Raw

    Write-Color "📋 REGLAS EVALUADAS:" "$($script:CYAN)$($script:BOLD)"
    Write-Host "   * container_name debe usar $($script:PROJECT_NAME)-<servicio>"
    Write-Host "   * labels requeridos: stack, env, service.group, service.lifecycle"
    Write-Host "   * service.group debe ser: core, dependency o tools"
    Write-Host "   * no deben existir rutas legacy del layout anterior"
    Write-Host ""

    foreach ($svc in $services) {
        $expectedName = "$($script:PROJECT_NAME)-$svc"
        $sourceBlock  = Get-ServiceBlockFromCompose $script:COMPOSE_FILE $svc

        Write-Color "Servicio: $svc" "$($script:BLUE)$($script:BOLD)"

        if ($sourceBlock -eq "") {
            Write-Color "   ❌ No se pudo localizar el bloque del servicio en $($script:COMPOSE_FILE)" $script:RED
            $errors++; continue
        }

        # container_name
        if ($tmpContent -match "container_name:\s*$([regex]::Escape($expectedName))") {
            Write-Color "   ✅ container_name correcto ($expectedName)" $script:GREEN
        } else {
            Write-Color "   ❌ container_name invalido. Se espera $expectedName" $script:RED; $errors++
        }

        # label stack
        if ($tmpContent -match "stack:\s*$([regex]::Escape($script:PROJECT_NAME))") {
            Write-Color "   ✅ label stack correcto" $script:GREEN
        } else {
            Write-Color "   ❌ falta label stack=$($script:PROJECT_NAME)" $script:RED; $errors++
        }

        # label env
        if ($tmpContent -match "env:\s*$([regex]::Escape($script:ENV_NAME))") {
            Write-Color "   ✅ label env correcto" $script:GREEN
        } else {
            Write-Color "   ❌ falta label env=$($script:ENV_NAME)" $script:RED; $errors++
        }

        # service.group
        $groupMatch = [regex]::Match($sourceBlock, 'service\.group:\s*(\S+)')
        if ($groupMatch.Success -and $groupMatch.Groups[1].Value -match '^(core|dependency|tools)$') {
            Write-Color "   ✅ service.group valido ($($groupMatch.Groups[1].Value))" $script:GREEN
        } else {
            Write-Color "   ❌ service.group invalido o ausente" $script:RED; $errors++
        }

        # service.lifecycle
        if ($sourceBlock -match 'service\.lifecycle:') {
            Write-Color "   ✅ service.lifecycle presente" $script:GREEN
        } else {
            Write-Color "   ❌ falta service.lifecycle" $script:RED; $errors++
        }

        # rutas legacy
        if ($sourceBlock -match 'Data/dokerFile|persistence/|APP/data-prd|APP/data-qa|APP/logs-prd|APP/logs-qa|APP/data/settings') {
            Write-Color "   ❌ el servicio usa rutas legacy del layout anterior" $script:RED; $errors++
        }

        # mounts hardcodeados
        if ($sourceBlock -match '^\s+- \./' ) {
            Write-Color "   ⚠️  hay mounts hardcodeados con rutas relativas directas" $script:YELLOW; $warnings++
        }
        Write-Host ""
    }

    Remove-Item $tmpConfig -Force -ErrorAction SilentlyContinue

    Write-Color "==========================================================" $script:CYAN
    if ($errors -eq 0) {
        Write-Color "✅ VALIDACION DE REGLAS SUPERADA" "$($script:GREEN)$($script:BOLD)"
    } else {
        Write-Color "❌ VALIDACION DE REGLAS CON ERRORES" "$($script:RED)$($script:BOLD)"
    }
    Write-Host "$($script:CYAN)Errores:$($script:NC) $errors"
    Write-Host "$($script:CYAN)Advertencias:$($script:NC) $warnings"
    Write-Color "==========================================================" $script:CYAN

    Invoke-Pause; Show-MenuContenedores
}

# ==================================================
# ACCIONES DE MONITOREO
# ==================================================

function Invoke-Logs {
    Show-Banner "VER LOGS"
    if (-not (Test-ComposeEnvFiles)) { Invoke-Pause; Show-MenuMonitoreo; return }
    $cmd = Build-ComposeCmd "logs -f"
    Write-Color "Presione Ctrl+C para salir" $script:YELLOW
    try { Invoke-Expression $cmd } catch {}
    Invoke-Pause; Show-MenuMonitoreo
}

function Invoke-LogsSingle {
    Show-Banner "LOGS DE CONTENEDOR"
    $result = Select-ContainerFromStack "Seleccione contenedor para ver logs" $true $true
    if ($result -ne "ok") { Show-MenuMonitoreo; return }
    Write-Color "Presione Ctrl+C para salir" $script:YELLOW
    try { docker logs -f $script:SELECTED_CONTAINER_ID } catch {}
    Invoke-Pause; Show-MenuMonitoreo
}

function Invoke-Ps {
    Show-Banner "ESTADO DE CONTENEDORES"
    if (-not (Test-ComposeEnvFiles)) { Invoke-Pause; Show-MenuMonitoreo; return }
    $cmd = Build-ComposeCmd "ps"
    Invoke-Expression $cmd
    Invoke-Pause; Show-MenuMonitoreo
}

function Invoke-ListStack {
    Show-Banner "LISTAR CONTENEDORES"
    Show-StackContainers -Format "detailed" -IncludeAll | Out-Null
    Invoke-Pause; Show-MenuMonitoreo
}

function Invoke-MonitorResources {
    Show-Banner "MONITOREO DE RECURSOS"
    $count = (docker ps --filter "label=$($script:LABEL_FILTER)" -q 2>$null | Measure-Object).Count
    if ($count -eq 0) {
        Write-Color "⚠️  No hay contenedores activos con etiqueta: $($script:LABEL_FILTER)" $script:YELLOW
        Invoke-Pause; Show-MenuMonitoreo; return
    }
    Write-Color "📊 ESTADISTICAS DE CONTENEDORES" "$($script:CYAN)$($script:BOLD)"
    Write-Color "Presione Ctrl+C para salir" $script:YELLOW
    Write-Host ""
    try {
        docker stats --filter "label=$($script:LABEL_FILTER)" --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}\t{{.BlockIO}}"
    } catch {}
    Invoke-Pause; Show-MenuMonitoreo
}

function Invoke-ExecStack {
    Show-Banner "TERMINAL EN CONTENEDOR"
    $result = Select-ContainerFromStack "Seleccione contenedor para acceder" $true $false
    if ($result -ne "ok") { Show-MenuMonitoreo; return }

    Write-Host ""
    Write-Color "MODO DE ACCESO A LA TERMINAL" "$($script:CYAN)$($script:BOLD)"
    Write-Host "  $($script:CYAN)1)$($script:NC) Usuario normal del contenedor"
    Write-Host "  $($script:CYAN)2)$($script:NC) root"
    Write-Host ""
    $modeChoice = Read-Host "$($script:CYAN)Seleccione el usuario [1/2]$($script:NC)"
    switch ($modeChoice) {
        "2" {
            $script:TERMINAL_EXEC_USER  = "root"
            $script:TERMINAL_EXEC_LABEL = "root"
        }
        default {
            $script:TERMINAL_EXEC_USER  = ""
            $script:TERMINAL_EXEC_LABEL = "usuario normal"
        }
    }

    Write-Color "Conectando a $($script:SELECTED_CONTAINER_NAME) como $($script:TERMINAL_EXEC_LABEL)..." $script:GREEN
    if ($script:TERMINAL_EXEC_USER -ne "") {
        # Probar bash primero, luego sh
        docker exec -it -u $script:TERMINAL_EXEC_USER $script:SELECTED_CONTAINER_ID bash 2>$null
        if ($LASTEXITCODE -ne 0) {
            docker exec -it -u $script:TERMINAL_EXEC_USER $script:SELECTED_CONTAINER_ID sh
        }
    } else {
        docker exec -it $script:SELECTED_CONTAINER_ID bash 2>$null
        if ($LASTEXITCODE -ne 0) {
            docker exec -it $script:SELECTED_CONTAINER_ID sh
        }
    }
    Invoke-Pause; Show-MenuMonitoreo
}

# ==================================================
# ACCIONES DE LIMPIEZA
# ==================================================

function Invoke-Clean {
    Show-Banner "LIMPIEZA DE RECURSOS"
    if (-not (Test-ComposeEnvFiles)) { Invoke-Pause; Show-MenuLimpieza; return }
    if (Confirm-Action "¿Limpiar contenedores, redes y volumenes del stack?" "no") {
        Invoke-DockerCmd (Build-FullStackDownCmd "down --volumes --remove-orphans") `
            "Error durante la limpieza" "Limpieza completada" | Out-Null
    }
    Invoke-Pause; Show-MenuLimpieza
}

function Invoke-CleanVolumes {
    Show-Banner "LIMPIAR VOLUMENES"
    if (Confirm-Action "¿Eliminar todos los volumenes no utilizados?" "no") {
        Invoke-DockerCmd "docker volume prune -f" "Error al limpiar volumenes" "Volumenes no utilizados eliminados" | Out-Null
    }
    Invoke-Pause; Show-MenuLimpieza
}

function Invoke-CleanImagesEnhanced {
    Show-Banner "LIMPIEZA DE IMAGENES"
    Write-Color "📊 ANALISIS DE IMAGENES DOCKER" "$($script:CYAN)$($script:BOLD)"
    Write-Color "==========================================================" $script:CYAN
    Write-Host ""
    $totalImages    = (docker images -q 2>$null | Measure-Object).Count
    $danglingImages = (docker images -f "dangling=true" -q 2>$null | Measure-Object).Count
    Write-Host "   $($script:BOLD)Total de imagenes:$($script:NC) $totalImages"
    Write-Host "   $($script:YELLOW)Imagenes huerfanas:$($script:NC) $danglingImages"
    Write-Host ""
    if ($danglingImages -gt 0) {
        Write-Color "🗑️  IMAGENES HUERFANAS:" "$($script:YELLOW)$($script:BOLD)"
        docker images -f "dangling=true" --format "   * {{.ID}} ({{.Size}}) - Creada: {{.CreatedSince}}"
        Write-Host ""
        if (Confirm-Action "¿Eliminar imagenes huerfanas?" "si") {
            Invoke-DockerCmd "docker image prune -f" "Error al limpiar" "Imagenes huerfanas eliminadas" | Out-Null
        }
    }
    Write-Host ""
    if (Confirm-Action "¿Eliminar todas las imagenes no utilizadas?" "no") {
        Invoke-DockerCmd "docker image prune -af" "Error al limpiar" "Imagenes no utilizadas eliminadas" | Out-Null
    }
    Invoke-Pause; Show-MenuLimpieza
}

function Invoke-CleanAll {
    Show-Banner "LIMPIEZA COMPLETA"
    if (-not (Test-ComposeEnvFiles)) { Invoke-Pause; Show-MenuLimpieza; return }

    Write-Color "⚠️  ADVERTENCIA: Esta accion realizara una limpieza profunda del sistema" "$($script:RED)$($script:BOLD)"
    Write-Color "Se eliminaran:" $script:YELLOW
    Write-Host "   * Contenedores, redes y volumenes del stack actual"
    Write-Host "   * Volumenes huerfanos relacionados con el stack"
    Write-Host "   * Imagenes base e Imagenes proyecto (Confirmacion)"
    Write-Host "   * Cache de builds de Docker"
    Write-Host ""

    if (-not (Confirm-Action "¿Iniciar limpieza completa?" "no")) {
        Show-MenuLimpieza; return
    }

    # PASO 1
    Write-Color "`n📦 PASO 1/3: Limpiando recursos del stack..." "$($script:CYAN)$($script:BOLD)"
    Invoke-DockerCmd (Build-FullStackDownCmd "down --volumes --remove-orphans") `
        "Error al limpiar recursos del stack" "Recursos del stack eliminados" | Out-Null

    # PASO 2
    Write-Color "`n💾 PASO 2/3: Buscando volumenes huerfanos del stack..." "$($script:CYAN)$($script:BOLD)"
    $stackVolumes = docker volume ls --filter "dangling=true" --filter "label=$($script:LABEL_FILTER)" --format "{{.Name}}" 2>$null |
                    Where-Object { $_ -ne "" }
    if ($stackVolumes -and @($stackVolumes).Count -gt 0) {
        Write-Color "Se encontraron $(@($stackVolumes).Count) volumenes huerfanos del stack:" $script:YELLOW
        foreach ($v in $stackVolumes) { Write-Host "   * $v" }
        Write-Host ""
        foreach ($v in $stackVolumes) {
            docker volume rm $v 2>$null | Out-Null
            if ($LASTEXITCODE -eq 0) { Write-Color "   ✅ Eliminado: $v" $script:GREEN }
            else { Write-Color "   ❌ Error al eliminar: $v" $script:RED }
        }
    } else {
        Write-Color "✅ No se encontraron volumenes huerfanos del stack" $script:GREEN
    }

    # Imagenes huerfanas automatico
    Write-Color "`n🗑️  Eliminando imagenes huerfanas..." "$($script:CYAN)$($script:BOLD)"
    docker image prune -f 2>$null | Out-Null
    Write-Color "✅ Imagenes huerfanas eliminadas" $script:GREEN

    # PASO 3
    Write-Color "`n🖼️  PASO 3/3: Limpieza de imagenes Docker" "$($script:CYAN)$($script:BOLD)"
    $projectName = if ($script:PROJECT_NAME -ne "") { $script:PROJECT_NAME } else { "inventario" }

    $allImages = docker images --format "{{.Repository}}:{{.Tag}}" 2>$null |
                 Where-Object { $_ -ne "" -and $_ -ne "<none>:<none>" }
    $baseImages    = $allImages | Where-Object { $_ -notmatch "^$([regex]::Escape($projectName))/" -and $_ -notmatch "<none>" }
    $projectImages = $allImages | Where-Object { $_ -match "^$([regex]::Escape($projectName))/" }

    # Imagenes base
    if ($baseImages -and @($baseImages).Count -gt 0) {
        Write-Color "`n📦 IMAGENES BASE (EXTERNAS) - $(@($baseImages).Count) encontradas" "$($script:BLUE)$($script:BOLD)"
        foreach ($img in $baseImages) {
            $size = docker images --format "{{.Size}}" $img 2>$null | Select-Object -First 1
            Write-Host "   * $img $($script:CYAN)($size)$($script:NC)"
        }
        Write-Host ""
        if (Confirm-Action "¿Eliminar TODAS las imagenes base?" "no") {
            $deleted = 0
            foreach ($img in $baseImages) {
                docker rmi -f $img 2>$null | Out-Null
                if ($LASTEXITCODE -eq 0) { Write-Color "   ✅ Eliminada: $img" $script:GREEN; $deleted++ }
                else { Write-Color "   ❌ Error al eliminar: $img" $script:RED }
            }
            Write-Color "✅ Imagenes base eliminadas: $deleted de $(@($baseImages).Count)" $script:GREEN
        } else {
            Write-Color "⏭️  Imagenes base conservadas" $script:BLUE
        }
    }

    # Imagenes proyecto
    if ($projectImages -and @($projectImages).Count -gt 0) {
        Write-Color "`n🏗️  IMAGENES DEL PROYECTO - $(@($projectImages).Count) encontradas" "$($script:MAGENTA)$($script:BOLD)"
        foreach ($img in $projectImages) {
            $size = docker images --format "{{.Size}}" $img 2>$null | Select-Object -First 1
            Write-Host "   * $img $($script:CYAN)($size)$($script:NC)"
        }
        Write-Host ""
        if (Confirm-Action "¿Eliminar TODAS las imagenes del proyecto?" "no") {
            $deleted = 0
            foreach ($img in $projectImages) {
                docker rmi -f $img 2>$null | Out-Null
                if ($LASTEXITCODE -eq 0) { Write-Color "   ✅ Eliminada: $img" $script:GREEN; $deleted++ }
                else { Write-Color "   ❌ Error al eliminar: $img" $script:RED }
            }
            Write-Color "✅ Imagenes del proyecto eliminadas: $deleted de $(@($projectImages).Count)" $script:GREEN
        } else {
            Write-Color "⏭️  Imagenes del proyecto conservadas" $script:BLUE
        }
    }

    # Cache builds
    Write-Color "`n🧹 Limpiando cache de builds..." "$($script:CYAN)$($script:BOLD)"
    docker builder prune -af 2>$null | Out-Null
    Write-Color "✅ Cache de builds eliminada" $script:GREEN

    Write-Host ""
    Write-Color "==========================================================" $script:CYAN
    Write-Color "✅ LIMPIEZA COMPLETA FINALIZADA" "$($script:GREEN)$($script:BOLD)"
    Write-Color "==========================================================" $script:CYAN

    Invoke-Pause; Show-MenuLimpieza
}

function Invoke-DropPersistence {
    Show-Banner "ELIMINAR PERSISTENCIAS"
    $dataRoot    = Get-RuntimeDataRoot
    $logsRoot    = Get-RuntimeLogsRoot
    $volumesRoot = Get-RuntimeVolumesRoot

    Write-Color "⚠️  ADVERTENCIA: Esta accion eliminara:" "$($script:RED)$($script:BOLD)"
    Write-Host "   * Volumenes Docker nombrados del proyecto"
    Write-Host "   * Artefactos de runtime en $volumesRoot"
    Write-Host "   * Datos de $dataRoot"
    Write-Host "   * Logs de $logsRoot"
    Write-Host ""

    if (-not (Confirm-Action "¿Eliminar todas las persistencias?" "no")) {
        Invoke-Pause; Show-MenuLimpieza; return
    }

    # 1. Volumenes Docker nombrados
    if (Confirm-Action "¿Eliminar volumenes Docker nombrados del proyecto?" "no") {
        $namedVolumes = @("$($script:PROJECT_NAME)_frontend_node_modules")
        $deletedNamed = $false
        foreach ($v in $namedVolumes) {
            $exists = docker volume inspect $v 2>$null
            if ($LASTEXITCODE -eq 0) {
                docker volume rm $v 2>$null | Out-Null
                if ($LASTEXITCODE -eq 0) {
                    $deletedNamed = $true
                    Write-Color "✅ Eliminado: $v" $script:GREEN
                } else {
                    Write-Color "⚠️  No se pudo eliminar $v (puede estar en uso)" $script:YELLOW
                }
            }
        }
        if (-not $deletedNamed) {
            Write-Color "⚠️  No se encontraron volumenes Docker nombrados del proyecto para eliminar" $script:YELLOW
        }
    } else {
        Write-Color "⏭️  Omitida eliminacion de volumenes Docker nombrados" $script:YELLOW
    }

    # 2. Artefactos de runtime
    if (Confirm-Action "¿Eliminar artefactos de runtime de Node/Python en $volumesRoot?" "no") {
        Remove-RuntimeArtifacts
    } else {
        Write-Color "⏭️  Omitida eliminacion de artefactos de runtime" $script:YELLOW
    }

    # 3. Datos persistentes
    if (Confirm-Action "¿Eliminar carpetas de $dataRoot?" "no") {
        Remove-DirectoryContents $dataRoot $dataRoot
    } else {
        Write-Color "⏭️  Omitida eliminacion de $dataRoot" $script:YELLOW
    }

    # 4. Logs persistentes
    if (Confirm-Action "¿Eliminar contenido de $logsRoot?" "no") {
        Remove-DirectoryContents $logsRoot $logsRoot
    } else {
        Write-Color "⏭️  Omitida eliminacion de $logsRoot" $script:YELLOW
    }

    Invoke-Pause; Show-MenuLimpieza
}

# ==================================================
# CONFIGURACION
# ==================================================

function Invoke-ChangeEnv {
    Show-Banner "CAMBIAR ENTORNO"
    Write-Host "Entorno actual: $(Get-EnvColor)"
    Write-Host ""
    Write-Host "Opciones disponibles:"
    Write-Host "  $($script:CYAN)1)$($script:NC) $($script:GREEN)dev$($script:NC)"
    Write-Host "  $($script:CYAN)2)$($script:NC) $($script:YELLOW)qa$($script:NC)"
    Write-Host "  $($script:CYAN)3)$($script:NC) $($script:RED)prd$($script:NC)"
    Write-Host ""
    $envChoice = Read-Host "$($script:CYAN)Seleccione nuevo entorno$($script:NC)"
    switch ($envChoice) {
        "1" { $script:ENV_NAME = "dev" }
        "2" { $script:ENV_NAME = "qa" }
        "3" { $script:ENV_NAME = "prd" }
        default {
            Write-Color "❌ Opcion invalida" $script:RED
            Start-Sleep -Seconds 2
            Show-MenuConfiguracion; return
        }
    }
    Set-ComposeFile
    Write-Color "✅ Entorno cambiado a: $(Get-EnvColor)" $script:GREEN
    Invoke-Pause; Show-MenuConfiguracion
}

function Invoke-UpdateIPMenu {
    Show-Banner "ACTUALIZAR IP EXPO / ANDROID"
    $currentIP = Get-CurrentIP
    $envFile = ".env"
    if (-not (Test-Path $envFile)) {
        Write-Color "❌ Error: Archivo .env no encontrado" $script:RED
        Invoke-Pause; Show-MenuConfiguracion; return
    }
    Write-Host "IP actual detectada: $($script:CYAN)$currentIP$($script:NC)"
    Write-Color "Se usara para REACT_NATIVE_PACKAGER_HOSTNAME en Expo / android_app." $script:BLUE
    if ($currentIP -eq "No detectada" -or $currentIP -eq "") {
        Write-Color "⚠️  No se pudo detectar IP automaticamente" $script:YELLOW
        $currentIP = Read-Host "Ingrese IP manualmente"
    }
    if (Confirm-Action "¿Actualizar REACT_NATIVE_PACKAGER_HOSTNAME en .env a $currentIP?" "si") {
        $content = Get-Content $envFile
        $found = $false
        $newContent = $content | ForEach-Object {
            if ($_ -match '^REACT_NATIVE_PACKAGER_HOSTNAME=') {
                $found = $true
                "REACT_NATIVE_PACKAGER_HOSTNAME=$currentIP"
            } else { $_ }
        }
        if (-not $found) { $newContent += "REACT_NATIVE_PACKAGER_HOSTNAME=$currentIP" }
        $newContent | Set-Content $envFile -Encoding UTF8
        Write-Color "✅ IP actualizada exitosamente" $script:GREEN
    }
    Invoke-Pause; Show-MenuConfiguracion
}

function Invoke-CheckIPMenu {
    Show-Banner "VERIFICAR IP EXPO / ANDROID"
    $currentIP = Get-CurrentIP
    $envFile = ".env"
    Write-Host "IP actual del equipo: $($script:CYAN)$currentIP$($script:NC)"
    if (Test-Path $envFile) {
        $data = Read-EnvFile $envFile
        $envIP = if ($data.ContainsKey("REACT_NATIVE_PACKAGER_HOSTNAME")) { $data["REACT_NATIVE_PACKAGER_HOSTNAME"] } else { "" }
        Write-Host "REACT_NATIVE_PACKAGER_HOSTNAME en .env: $($script:CYAN)$(if ($envIP -ne '') { $envIP } else { 'No configurada' })$($script:NC)"
        if ($currentIP -ne "" -and $envIP -ne "") {
            if ($currentIP -eq $envIP) { Write-Color "✅ Las IPs coinciden" $script:GREEN }
            else { Write-Color "⚠️  Las IPs NO coinciden" $script:YELLOW }
        }
    }
    Invoke-Pause; Show-MenuConfiguracion
}

function Invoke-ValidateContainerEnv {
    Show-Banner "VARIABLES DE ENTORNO"
    $result = Select-ContainerFromStack "Seleccione contenedor" $true $false
    if ($result -ne "ok") { Show-MenuConfiguracion; return }
    Write-Host ""
    Write-Color "📋 Variables de entorno en $($script:SELECTED_CONTAINER_NAME):" "$($script:CYAN)$($script:BOLD)"
    Write-Host "=========================================================="
    $envVars = docker exec $script:SELECTED_CONTAINER_ID env 2>$null | Sort-Object
    $i = 1
    foreach ($line in $envVars) {
        Write-Host "   $i`t$line"
        $i++
    }
    Invoke-Pause; Show-MenuConfiguracion
}

# ==================================================
# BACKUP Y RESTORE
# ==================================================

function Invoke-BackupVolumes {
    Show-Banner "BACKUP DE VOLUMENES"
    if (-not (Test-Path $script:BACKUP_DIR)) {
        New-Item -ItemType Directory -Path $script:BACKUP_DIR -Force | Out-Null
    }
    Write-Color "📦 VOLUMENES DEL PROYECTO:" "$($script:CYAN)$($script:BOLD)"
    Write-Host ""
    $volumes = @(Get-ProjectNamedVolumes | Where-Object { $_ -ne "" })
    if ($volumes.Count -eq 0) {
        Write-Color "⚠️  No hay volumenes nombrados del proyecto disponibles" $script:YELLOW
        Invoke-Pause; Show-MenuBackup; return
    }
    for ($i = 0; $i -lt $volumes.Count; $i++) {
        Write-Host "  $($script:CYAN)$($i+1))$($script:NC) $($volumes[$i])"
    }
    Write-Host ""
    Write-Host "  $($script:CYAN)T)$($script:NC) Todos los volumenes"
    Write-Host "  $($script:CYAN)V)$($script:NC) ⬅️ Volver"
    Write-Host ""
    $volChoice = Read-Host "$($script:CYAN)Seleccione volumen a respaldar$($script:NC)"

    if ($volChoice -match '^[Vv]$') { Show-MenuBackup; return }

    $volumesToBackup = @()
    if ($volChoice -match '^[Tt]$') {
        $volumesToBackup = $volumes
    } else {
        $idx = 0
        if ([int]::TryParse($volChoice, [ref]$idx) -and $idx -ge 1 -and $idx -le $volumes.Count) {
            $volumesToBackup = @($volumes[$idx - 1])
        } else {
            Write-Color "❌ Opcion invalida. Las opciones validas son: numero del 1 al $($volumes.Count), T o V" $script:RED
            Invoke-Pause; Invoke-BackupVolumes; return
        }
    }

    $timestamp    = Get-Date -Format "yyyyMMdd_HHmmss"
    $successCount = 0
    $errorCount   = 0
    $pwd_path     = (Get-Location).Path -replace '\\', '/'

    foreach ($volume in $volumesToBackup) {
        $backupFile = "$($script:BACKUP_DIR)/${volume}_${timestamp}.tar.gz"
        Write-Color "⏳ Respaldando volumen: $volume" $script:BLUE
        docker run --rm -v "${volume}:/source" -v "${pwd_path}/$($script:BACKUP_DIR):/backup" `
            alpine tar czf "/backup/${volume}_${timestamp}.tar.gz" -C /source . 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) {
            $size = Get-BackupFileSize $backupFile
            Write-Color "✅ Backup creado: $backupFile ($size)" $script:GREEN
            $successCount++
        } else {
            Write-Color "❌ Error al respaldar $volume" $script:RED
            $errorCount++
        }
    }

    Write-Host ""
    Write-Color "==========================================================" $script:CYAN
    Write-Color "✅ Backup completado: $successCount exitosos, $errorCount errores" $script:GREEN
    Write-Color "==========================================================" $script:CYAN
    Invoke-Pause; Show-MenuBackup
}

function Invoke-RestoreVolume {
    Show-Banner "RESTAURAR VOLUMEN"
    if (-not (Test-Path $script:BACKUP_DIR)) {
        Write-Color "⚠️  No hay backups disponibles" $script:YELLOW
        Invoke-Pause; Show-MenuBackup; return
    }
    $backupFiles = @(Get-ChildItem $script:BACKUP_DIR -Filter "*.tar.gz" -ErrorAction SilentlyContinue |
                     Select-Object -ExpandProperty Name)
    if ($backupFiles.Count -eq 0) {
        Write-Color "⚠️  No hay backups disponibles" $script:YELLOW
        Invoke-Pause; Show-MenuBackup; return
    }

    Write-Color "📦 BACKUPS DISPONIBLES:" "$($script:CYAN)$($script:BOLD)"
    Write-Host ""
    for ($i = 0; $i -lt $backupFiles.Count; $i++) {
        $size = Get-BackupFileSize "$($script:BACKUP_DIR)\$($backupFiles[$i])"
        Write-Host "  $($script:CYAN)$($i+1))$($script:NC) $($backupFiles[$i].PadRight(45)) $($script:YELLOW)[$size]$($script:NC)"
    }
    Write-Host ""
    $backupChoice = Read-Host "$($script:CYAN)Seleccione backup a restaurar$($script:NC)"
    $idx = 0
    if (-not [int]::TryParse($backupChoice, [ref]$idx) -or $idx -lt 1 -or $idx -gt $backupFiles.Count) {
        Write-Color "❌ Opcion invalida" $script:RED
        Invoke-Pause; return
    }

    $selectedBackup = $backupFiles[$idx - 1]
    $volumeName = Get-VolumeNameFromBackup $selectedBackup
    if ($volumeName -eq "") {
        Write-Color "❌ No se pudo determinar el volumen a restaurar desde $selectedBackup" $script:RED
        Invoke-Pause; Show-MenuBackup; return
    }

    Write-Host ""
    Write-Color "⚠️  Se restaurara el volumen: $volumeName" $script:YELLOW
    if (-not (Confirm-Action "¿Continuar con la restauracion?" "no")) {
        Show-MenuBackup; return
    }

    # Verificar si el volumen existe
    docker volume ls -q 2>$null | Where-Object { $_ -eq $volumeName } | ForEach-Object {
        if (Confirm-Action "¿Eliminar volumen existente antes de restaurar?" "no") {
            docker volume rm $volumeName 2>$null | Out-Null
        } else {
            Write-Color "⏭️  Restauracion cancelada" $script:BLUE
            Invoke-Pause; return
        }
    }

    docker volume create $volumeName | Out-Null
    Write-Color "✅ Volumen creado: $volumeName" $script:GREEN
    $pwd_path = (Get-Location).Path -replace '\\', '/'
    docker run --rm -v "${volumeName}:/target" -v "${pwd_path}/$($script:BACKUP_DIR):/backup" `
        alpine tar xzf "/backup/$selectedBackup" -C /target 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Color "✅ Volumen restaurado exitosamente" $script:GREEN
    } else {
        Write-Color "❌ Error al restaurar el volumen" $script:RED
    }
    Invoke-Pause; Show-MenuBackup
}

# ==================================================
# SALIDA
# ==================================================

function Invoke-Exit {
    Clear-Host
    Write-Color "==========================================================" $script:CYAN
    Write-Color "   ¡Gracias por usar Docker Tools!" "$($script:GREEN)$($script:BOLD)"
    Write-Color "==========================================================" $script:CYAN
    Write-Host ""
    Write-Color "Todos los procesos han sido cerrados correctamente." $script:BLUE
    Write-Host ""
    exit 0
}

# ==================================================
# MAIN
# ==================================================

function Main {
    Clear-Host
    Initialize-Colors
    Test-Dependencies

    $script:ENV_NAME     = "dev"
    $script:PROJECT_NAME = Read-ProjectName
    $script:STACK        = if ($script:PROJECT_NAME -ne "") { $script:PROJECT_NAME } else { "NoExisteStackName" }
    $script:LABEL_FILTER = "stack=$($script:STACK)"
    $script:BACKUP_DIR   = "docker-backups"
    $script:CURRENT_IP   = ""

    Set-ComposeFile
    Show-Menu
}

Main