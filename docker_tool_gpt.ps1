[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ==================================================
# Docker Tools - Versión Windows nativa
# Reescritura PowerShell sin grep/awk/sed/cut/find/tput
# ==================================================

# -----------------------------
# Estado global
# -----------------------------
$script:EnvName = 'dev'
$script:ComposeFile = ''
$script:ComposeCmd = @('docker', 'compose')
$script:ProjectName = ''
$script:Stack = ''
$script:LabelFilter = ''
$script:CurrentIP = ''
$script:BackupDir = 'docker-backups'
$script:PortainerName = 'portainer'
$script:PortainerImage = 'portainer/portainer-ce:latest'
$script:StackContainers = @()
$script:SelectedProfileArgs = @()
$script:SelectedServiceArgs = @()

# -----------------------------
# Utilidad visual
# -----------------------------
function Write-Color {
    param(
        [string]$Message,
        [ConsoleColor]$Color = [ConsoleColor]::White,
        [switch]$NoNewLine
    )

    if ($NoNewLine) {
        Write-Host $Message -ForegroundColor $Color -NoNewline
    }
    else {
        Write-Host $Message -ForegroundColor $Color
    }
}

function Clear-Safely {
    try { Clear-Host } catch {}
}

function Pause-Script {
    Write-Host ''
    [void](Read-Host 'Presione Enter para continuar')
}

function Show-Header {
    param([string]$Title)

    Clear-Safely
    Write-Color '╔═══════════════════════════════════════════════════════════╗' Cyan
    Write-Color ('║              DOCKER TOOLS - ' + $Title.PadRight(25) + '║') Cyan
    Write-Color '╚═══════════════════════════════════════════════════════════╝' Cyan
    Write-Host ''
    Write-Color '📋 INFORMACIÓN DEL ENTORNO:' Blue
    Write-Host ('   Archivo: ' + $script:ComposeFile)
    Write-Host ('   Stack:   ' + $(if ([string]::IsNullOrWhiteSpace($script:Stack)) { 'NoExiteStackName' } else { $script:Stack }))
    Write-Host ('   Entorno: ' + $script:EnvName)
    Write-Host ('   IP:      ' + $(if ([string]::IsNullOrWhiteSpace($script:CurrentIP)) { 'No detectada' } else { $script:CurrentIP }))
    try {
        $gitBranch = (& git rev-parse --abbrev-ref HEAD 2>$null)
        if ($LASTEXITCODE -eq 0 -and $gitBranch) {
            Write-Host ('   Git:     ' + ($gitBranch | Select-Object -First 1))
        }
    }
    catch {}
    Write-Host ''
}

function Confirm-Action {
    param(
        [Parameter(Mandatory = $true)][string]$Message,
        [ValidateSet('yes', 'no')][string]$Default = 'no'
    )

    Write-Host ''
    Write-Color '⚠️  CONFIRMACIÓN REQUERIDA' Yellow
    Write-Color $Message Yellow

    if ($Default -eq 'yes') {
        $answer = Read-Host '¿Continuar? [S/n]'
        if ([string]::IsNullOrWhiteSpace($answer)) { $answer = 'S' }
    }
    else {
        $answer = Read-Host '¿Continuar? [s/N]'
        if ([string]::IsNullOrWhiteSpace($answer)) { $answer = 'N' }
    }

    return ($answer -match '^[sS]$')
}

# -----------------------------
# Ejecución de comandos
# -----------------------------
function Invoke-NativeCommand {
    param(
        [Parameter(Mandatory = $true)][string[]]$Command,
        [string]$ErrorMessage = 'Error al ejecutar el comando',
        [string]$SuccessMessage = 'Comando ejecutado exitosamente',
        [switch]$Passthru,
        [switch]$IgnoreExitCode
    )

    Write-Host ''
    Write-Color ('▶ Ejecutando: ' + ($Command -join ' ')) Cyan
    Write-Color '────────────────────────────────────────────────' DarkCyan

    $output = & $Command[0] $Command[1..($Command.Count - 1)] 2>&1
    $exitCode = $LASTEXITCODE

    if ($output) {
        $output | ForEach-Object { Write-Host $_ }
    }

    Write-Color '────────────────────────────────────────────────' DarkCyan

    if (-not $IgnoreExitCode -and $exitCode -ne 0) {
        Write-Color ("❌ $ErrorMessage (código: $exitCode)") Red
        if ($Passthru) {
            return [pscustomobject]@{
                ExitCode = $exitCode
                Output   = @($output)
            }
        }
        return $false
    }

    if ($SuccessMessage) {
        Write-Color ("✅ $SuccessMessage") Green
    }

    if ($Passthru) {
        return [pscustomobject]@{
            ExitCode = $exitCode
            Output   = @($output)
        }
    }

    return $true
}

function Invoke-NativeCommandQuiet {
    param([Parameter(Mandatory = $true)][string[]]$Command)

    $output = & $Command[0] $Command[1..($Command.Count - 1)] 2>&1
    $exitCode = $LASTEXITCODE
    return [pscustomobject]@{
        ExitCode = $exitCode
        Output   = @($output)
    }
}

function Invoke-Compose {
    param(
        [Parameter(Mandatory = $true)][string[]]$Args,
        [string]$ErrorMessage = 'Error al ejecutar docker compose',
        [string]$SuccessMessage = 'Operación completada',
        [switch]$Passthru,
        [switch]$IgnoreExitCode
    )

    $cmd = New-Object System.Collections.Generic.List[string]
    $script:ComposeCmd | ForEach-Object { [void]$cmd.Add($_) }
    if (-not [string]::IsNullOrWhiteSpace($script:ComposeFile)) {
        [void]$cmd.Add('-f')
        [void]$cmd.Add($script:ComposeFile)
    }
    if (Test-Path '.env') {
        [void]$cmd.Add('--env-file')
        [void]$cmd.Add('.env')
    }
    $envSpecific = ".env.$($script:EnvName)"
    if (Test-Path $envSpecific) {
        [void]$cmd.Add('--env-file')
        [void]$cmd.Add($envSpecific)
    }
    $Args | ForEach-Object { [void]$cmd.Add($_) }

    Invoke-NativeCommand -Command $cmd.ToArray() -ErrorMessage $ErrorMessage -SuccessMessage $SuccessMessage -Passthru:$Passthru -IgnoreExitCode:$IgnoreExitCode
}

# -----------------------------
# Lectura de .env
# -----------------------------
function Get-EnvFileMap {
    param([Parameter(Mandatory = $true)][string]$Path)

    $map = @{}
    if (-not (Test-Path $Path)) {
        return $map
    }

    foreach ($line in Get-Content -Path $Path -Encoding UTF8) {
        if ([string]::IsNullOrWhiteSpace($line)) { continue }
        $trimmed = $line.Trim()
        if ($trimmed.StartsWith('#')) { continue }

        $idx = $trimmed.IndexOf('=')
        if ($idx -lt 1) { continue }

        $key = $trimmed.Substring(0, $idx).Trim()
        $value = $trimmed.Substring($idx + 1).Trim()

        if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
            $value = $value.Substring(1, $value.Length - 2)
        }

        $map[$key] = $value
    }

    return $map
}

function Get-EnvValue {
    param(
        [Parameter(Mandatory = $true)][string]$Key,
        [string]$DefaultValue = ''
    )

    $result = $null
    foreach ($file in @('.env', ".env.$($script:EnvName)")) {
        if (Test-Path $file) {
            $map = Get-EnvFileMap -Path $file
            if ($map.ContainsKey($Key)) {
                $result = $map[$Key]
            }
        }
    }

    if ([string]::IsNullOrWhiteSpace($result)) {
        return $DefaultValue
    }
    return $result
}

function Set-EnvValue {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Key,
        [Parameter(Mandatory = $true)][string]$Value
    )

    $lines = @()
    if (Test-Path $Path) {
        $lines = Get-Content -Path $Path -Encoding UTF8
    }

    $updated = $false
    $newLines = foreach ($line in $lines) {
        if ($line -match ('^\s*' + [regex]::Escape($Key) + '\s*=')) {
            $updated = $true
            "$Key=$Value"
        }
        else {
            $line
        }
    }

    if (-not $updated) {
        $newLines += "$Key=$Value"
    }

    Set-Content -Path $Path -Value $newLines -Encoding UTF8
}

# -----------------------------
# Detección de entorno / IP
# -----------------------------
function Set-ComposeFile {
    switch ($script:EnvName) {
        'dev' { $script:ComposeFile = 'docker-compose-dev.yml' }
        'qa'  { $script:ComposeFile = 'docker-compose-qa.yml' }
        'prd' { $script:ComposeFile = 'docker-compose.yml' }
        default { $script:ComposeFile = 'docker-compose-dev.yml' }
    }
}

function Get-CurrentIPAddress {
    try {
        $route = Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction Stop |
            Sort-Object RouteMetric |
            Select-Object -First 1

        if ($route) {
            $ip = Get-NetIPAddress -InterfaceIndex $route.IfIndex -AddressFamily IPv4 -ErrorAction Stop |
                Where-Object {
                    $_.IPAddress -notlike '127.*' -and
                    $_.IPAddress -notlike '169.254.*'
                } |
                Select-Object -ExpandProperty IPAddress -First 1

            if ($ip) { return $ip }
        }
    }
    catch {}

    try {
        $fallback = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
            Where-Object {
                $_.IPAddress -notlike '127.*' -and
                $_.IPAddress -notlike '169.254.*'
            } |
            Select-Object -ExpandProperty IPAddress -First 1
        return $fallback
    }
    catch {
        return ''
    }
}

# -----------------------------
# Docker / compose
# -----------------------------
function Test-Dependencies {
    Show-Header 'VERIFICACIÓN'

    $missing = New-Object System.Collections.Generic.List[string]

    if (Get-Command docker -ErrorAction SilentlyContinue) {
        Write-Color '✅ Docker CLI: Encontrado' Green
    }
    else {
        [void]$missing.Add('docker')
    }

    $dockerInfo = Invoke-NativeCommandQuiet -Command @('docker', 'info')
    if ($dockerInfo.ExitCode -eq 0) {
        Write-Color '✅ Docker daemon: En ejecución' Green
    }
    else {
        Write-Color '❌ Docker daemon: No está en ejecución' Red
    }

    $composePlugin = Invoke-NativeCommandQuiet -Command @('docker', 'compose', 'version')
    if ($composePlugin.ExitCode -eq 0) {
        $script:ComposeCmd = @('docker', 'compose')
        Write-Color '✅ Docker Compose: Plugin detectado' Green
    }
    else {
        $composeStandalone = Get-Command docker-compose -ErrorAction SilentlyContinue
        if ($composeStandalone) {
            $script:ComposeCmd = @('docker-compose')
            Write-Color '✅ Docker Compose: Standalone detectado' Green
        }
        else {
            [void]$missing.Add('docker compose / docker-compose')
        }
    }

    if ($missing.Count -gt 0) {
        Write-Color '' Yellow
        Write-Color '❌ Dependencias faltantes:' Red
        $missing | ForEach-Object { Write-Color ("   - $_") Red }
        throw 'Faltan dependencias críticas.'
    }

    Write-Host ''
    Write-Color '✅ Verificación completada' Green
    Start-Sleep -Seconds 1
}

function Test-ComposeEnvFiles {
    $requiredFiles = @('.env', ".env.$($script:EnvName)")
    $missingFiles = @($requiredFiles | Where-Object { -not (Test-Path $_) })

    if ($missingFiles.Count -gt 0) {
        Write-Color '❌ Faltan archivos de entorno requeridos:' Red
        $missingFiles | ForEach-Object { Write-Color ("   - $_") Red }
        return $false
    }

    if (-not (Test-Path $script:ComposeFile)) {
        Write-Color ("❌ No existe el archivo compose: $($script:ComposeFile)") Red
        return $false
    }

    $composeText = Get-Content -Path $script:ComposeFile -Raw -Encoding UTF8
    $matches = [regex]::Matches($composeText, '\$\{([A-Z0-9_]+)(:-[^}]*)?\}')
    $requiredVars = New-Object System.Collections.Generic.HashSet[string]
    foreach ($m in $matches) {
        [void]$requiredVars.Add($m.Groups[1].Value)
    }

    $optionalEmpty = @('ITOP_PACKAGE_URL')
    $missingVars = New-Object System.Collections.Generic.List[string]
    foreach ($varName in $requiredVars) {
        if ($optionalEmpty -contains $varName) { continue }
        $value = Get-EnvValue -Key $varName
        if ([string]::IsNullOrWhiteSpace($value)) {
            [void]$missingVars.Add($varName)
        }
    }

    if ($missingVars.Count -gt 0) {
        Write-Color ("❌ Hay variables requeridas sin valor para $($script:ComposeFile):") Red
        $missingVars | Sort-Object | ForEach-Object { Write-Color ("   - $_") Red }
        return $false
    }

    return $true
}

function Get-ComposeServices {
    $result = Invoke-Compose -Args @('config', '--services') -Passthru -IgnoreExitCode
    if ($result.ExitCode -ne 0) {
        return @()
    }

    return @($result.Output | ForEach-Object { $_.ToString().Trim() } | Where-Object { $_ })
}

function Get-AllProfileArgs {
    if (-not (Test-Path $script:ComposeFile)) {
        return @()
    }

    $text = Get-Content -Path $script:ComposeFile -Raw -Encoding UTF8
    $rx = [regex]'profiles:\s*\[([^\]]+)\]'
    $names = New-Object System.Collections.Generic.HashSet[string]

    foreach ($m in $rx.Matches($text)) {
        $raw = $m.Groups[1].Value
        foreach ($part in ($raw -split ',')) {
            $name = $part.Trim().Trim("'").Trim('"')
            if (-not [string]::IsNullOrWhiteSpace($name)) {
                [void]$names.Add($name)
            }
        }
    }

    $args = New-Object System.Collections.Generic.List[string]
    foreach ($name in ($names | Sort-Object)) {
        [void]$args.Add('--profile')
        [void]$args.Add($name)
    }
    return $args.ToArray()
}

function Get-ServiceBlockFromComposeText {
    param(
        [Parameter(Mandatory = $true)][string]$ComposeText,
        [Parameter(Mandatory = $true)][string]$ServiceName
    )

    $lines = $ComposeText -split "`r?`n"
    $inServices = $false
    $capturing = $false
    $buffer = New-Object System.Collections.Generic.List[string]

    foreach ($line in $lines) {
        if (-not $inServices) {
            if ($line -match '^services:\s*$') {
                $inServices = $true
            }
            continue
        }

        if (-not $capturing) {
            if ($line -match ('^\s{2}' + [regex]::Escape($ServiceName) + ':\s*$')) {
                $capturing = $true
                [void]$buffer.Add($line)
                continue
            }

            if ($line -match '^[^\s]') {
                break
            }
            continue
        }

        if ($line -match '^\s{2}[A-Za-z0-9_-]+:\s*$') {
            break
        }
        if ($line -match '^[^\s]' ) {
            break
        }
        [void]$buffer.Add($line)
    }

    return ($buffer -join [Environment]::NewLine)
}

function Get-ServiceGroup {
    param([string]$ServiceBlock)
    if ([string]::IsNullOrWhiteSpace($ServiceBlock)) { return '' }

    $match = [regex]::Match($ServiceBlock, '^\s*service\.group:\s*(.+)$', [System.Text.RegularExpressions.RegexOptions]::Multiline)
    if ($match.Success) {
        return $match.Groups[1].Value.Trim().Trim("'").Trim('"')
    }
    return ''
}

function Get-ServicesByGroup {
    param([ValidateSet('all', 'core', 'dependency', 'tools')][string]$TargetGroup = 'all')

    if (-not (Test-Path $script:ComposeFile)) { return @() }
    $composeText = Get-Content -Path $script:ComposeFile -Raw -Encoding UTF8
    $services = Get-ComposeServices
    $filtered = New-Object System.Collections.Generic.List[string]

    foreach ($service in $services) {
        $block = Get-ServiceBlockFromComposeText -ComposeText $composeText -ServiceName $service
        $group = Get-ServiceGroup -ServiceBlock $block
        if ($TargetGroup -eq 'all' -or $group -eq $TargetGroup) {
            [void]$filtered.Add($service)
        }
    }

    return $filtered.ToArray()
}

function Select-ServiceGroups {
    $script:SelectedProfileArgs = @()
    $script:SelectedServiceArgs = @()

    $core = @(Get-ServicesByGroup -TargetGroup 'core')
    $dependency = @(Get-ServicesByGroup -TargetGroup 'dependency')
    $tools = @(Get-ServicesByGroup -TargetGroup 'tools')

    $selected = New-Object System.Collections.Generic.List[string]
    $core | ForEach-Object { [void]$selected.Add($_) }

    Write-Host ''
    Write-Color '🧩 ALCANCE DEL LEVANTE' Cyan
    Write-Host "El grupo base para el entorno $($script:EnvName) será siempre core."
    Write-Host ''

    if ($dependency.Count -gt 0) {
        Write-Color 'Dependencias disponibles:' White
        $dependency | ForEach-Object { Write-Host ("   • $_") }
        if (Confirm-Action -Message '¿Desea anexar también dependency?' -Default 'no') {
            $dependency | ForEach-Object { [void]$selected.Add($_) }
        }
    }

    if ($tools.Count -gt 0) {
        Write-Host ''
        Write-Color 'Herramientas disponibles:' White
        $tools | ForEach-Object { Write-Host ("   • $_") }
        if (Confirm-Action -Message '¿Desea anexar también tools?' -Default 'no') {
            $script:SelectedProfileArgs = @('--profile', 'tools')
            $tools | ForEach-Object { [void]$selected.Add($_) }
        }
    }

    $script:SelectedServiceArgs = $selected.ToArray()
}

function Get-StackContainers {
    param([switch]$IncludeAll)

    $cmd = @('docker', 'ps', '--format', '{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}')
    if ($IncludeAll) {
        $cmd = @('docker', 'ps', '-a', '--format', '{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}')
    }
    if (-not [string]::IsNullOrWhiteSpace($script:LabelFilter)) {
        $cmd = $cmd[0..1] + @('--filter', "label=$($script:LabelFilter)") + $cmd[2..($cmd.Count-1)]
    }

    $result = Invoke-NativeCommandQuiet -Command $cmd
    if ($result.ExitCode -ne 0) {
        return @()
    }

    $containers = foreach ($line in $result.Output) {
        $text = $line.ToString().Trim()
        if (-not $text) { continue }
        $parts = $text -split '\|', 5
        [pscustomobject]@{
            Id     = if ($parts.Count -ge 1) { $parts[0] } else { '' }
            Name   = if ($parts.Count -ge 2) { $parts[1] } else { '' }
            Image  = if ($parts.Count -ge 3) { $parts[2] } else { '' }
            Status = if ($parts.Count -ge 4) { $parts[3] } else { '' }
            Ports  = if ($parts.Count -ge 5) { $parts[4] } else { '' }
        }
    }

    $script:StackContainers = @($containers)
    return $script:StackContainers
}

function Show-StackContainers {
    param([switch]$IncludeAll)

    $containers = Get-StackContainers -IncludeAll:$IncludeAll
    if ($containers.Count -eq 0) {
        Write-Color ("⚠️  No se encontraron contenedores con la etiqueta: $($script:LabelFilter)") Yellow
        return $false
    }

    $index = 1
    $table = foreach ($c in $containers) {
        [pscustomobject]@{
            '#'     = $index++
            Nombre  = $c.Name
            Imagen  = $c.Image
            Estado  = $c.Status
            Puertos = $c.Ports
        }
    }
    $table | Format-Table -AutoSize
    return $true
}

function Select-Container {
    param([switch]$IncludeAll)

    if (-not (Show-StackContainers -IncludeAll:$IncludeAll)) {
        return $null
    }

    Write-Host ''
    $answer = Read-Host 'Seleccione el número del contenedor (0 para volver)'
    if ($answer -eq '0') { return $null }

    $parsed = 0
    if (-not [int]::TryParse($answer, [ref]$parsed)) {
        Write-Color '❌ Índice inválido' Red
        return $null
    }

    if ($parsed -lt 1 -or $parsed -gt $script:StackContainers.Count) {
        Write-Color '❌ Índice fuera de rango' Red
        return $null
    }

    return $script:StackContainers[$parsed - 1]
}

function Validate-Compose {
    Show-Header 'VALIDAR DOCKER COMPOSE'
    if (-not (Test-ComposeEnvFiles)) {
        Pause-Script
        return
    }

    $result = Invoke-Compose -Args @('config') -Passthru -IgnoreExitCode
    if ($result.ExitCode -eq 0) {
        Write-Color '✅ VALIDACIÓN EXITOSA' Green
        Write-Host ''
        Write-Color '📋 SERVICIOS CONFIGURADOS:' Cyan
        Get-ComposeServices | ForEach-Object { Write-Host ("   • $_") }
    }
    else {
        Write-Color '❌ ERROR DE VALIDACIÓN' Red
    }

    Pause-Script
}

function Validate-ComposeRules {
    Show-Header 'VALIDAR REGLAS DEL COMPOSE'
    if (-not (Test-ComposeEnvFiles)) {
        Pause-Script
        return
    }

    $services = Get-ComposeServices
    $composeText = Get-Content -Path $script:ComposeFile -Raw -Encoding UTF8
    $errors = 0

    Write-Color '📋 REGLAS EVALUADAS:' Cyan
    Write-Host '   • container_name debe usar <PROJECT_NAME>-<servicio>'
    Write-Host '   • labels requeridos: stack, env, service.group, service.lifecycle'
    Write-Host '   • service.group debe ser: core, dependency o tools'
    Write-Host ''

    foreach ($service in $services) {
        $block = Get-ServiceBlockFromComposeText -ComposeText $composeText -ServiceName $service
        $expectedContainer = "$($script:ProjectName)-$service"
        Write-Color ("Servicio: $service") Blue

        if ($block -match ('container_name:\s*' + [regex]::Escape($expectedContainer) + '\s*$')) {
            Write-Color ("   ✅ container_name correcto ($expectedContainer)") Green
        }
        else {
            Write-Color ("   ❌ container_name inválido. Se espera $expectedContainer") Red
            $errors++
        }

        foreach ($label in @("stack: $($script:ProjectName)", "env: $($script:EnvName)")) {
            if ($block -match [regex]::Escape($label)) {
                Write-Color ("   ✅ label correcto: $label") Green
            }
            else {
                Write-Color ("   ❌ falta label: $label") Red
                $errors++
            }
        }

        $group = Get-ServiceGroup -ServiceBlock $block
        if ($group -in @('core', 'dependency', 'tools')) {
            Write-Color ("   ✅ service.group correcto: $group") Green
        }
        else {
            Write-Color '   ❌ service.group inválido o ausente' Red
            $errors++
        }

        if ($block -match 'service\.lifecycle:\s*.+$') {
            Write-Color '   ✅ service.lifecycle presente' Green
        }
        else {
            Write-Color '   ❌ falta service.lifecycle' Red
            $errors++
        }
        Write-Host ''
    }

    if ($errors -eq 0) {
        Write-Color '✅ Validación de reglas completada sin errores' Green
    }
    else {
        Write-Color ("❌ Validación finalizada con $errors error(es)") Red
    }

    Pause-Script
}

# -----------------------------
# Contenedores / compose actions
# -----------------------------
function Up-Stack {
    Show-Header 'INICIAR CONTENEDORES'
    if (-not (Test-ComposeEnvFiles)) { Pause-Script; return }
    Select-ServiceGroups

    $args = @()
    $args += $script:SelectedProfileArgs
    $args += @('up', '-d', '--build')
    $args += $script:SelectedServiceArgs
    [void](Invoke-Compose -Args $args -ErrorMessage 'Error al iniciar contenedores' -SuccessMessage 'Contenedores iniciados exitosamente')

    Pause-Script
}

function Down-Stack {
    Show-Header 'DETENER CONTENEDORES'
    if (-not (Test-ComposeEnvFiles)) { Pause-Script; return }

    if (Confirm-Action -Message '¿Detener y eliminar todos los contenedores del stack?' -Default 'no') {
        $args = @()
        $args += Get-AllProfileArgs
        $args += 'down'
        [void](Invoke-Compose -Args $args -ErrorMessage 'Error al detener contenedores' -SuccessMessage 'Contenedores detenidos exitosamente')
    }

    Pause-Script
}

function Restart-Stack {
    Show-Header 'REINICIAR CONTENEDORES'
    if (-not (Test-ComposeEnvFiles)) { Pause-Script; return }

    if (Confirm-Action -Message '¿Reiniciar todos los contenedores del stack?' -Default 'no') {
        Select-ServiceGroups
        $downArgs = @()
        $downArgs += Get-AllProfileArgs
        $downArgs += 'down'
        [void](Invoke-Compose -Args $downArgs -ErrorMessage 'Error al detener contenedores' -SuccessMessage '')

        $upArgs = @()
        $upArgs += $script:SelectedProfileArgs
        $upArgs += @('up', '-d', '--build')
        $upArgs += $script:SelectedServiceArgs
        [void](Invoke-Compose -Args $upArgs -ErrorMessage 'Error al iniciar contenedores' -SuccessMessage 'Contenedores reiniciados exitosamente')
    }

    Pause-Script
}

function Restart-SingleContainer {
    Show-Header 'REINICIAR CONTENEDOR ÚNICO'
    $container = Select-Container
    if (-not $container) { return }

    if (Confirm-Action -Message ("¿Reiniciar contenedor $($container.Name)?") -Default 'no') {
        [void](Invoke-NativeCommand -Command @('docker', 'restart', $container.Id) -ErrorMessage 'Error al reiniciar contenedor' -SuccessMessage 'Contenedor reiniciado exitosamente')
    }

    Pause-Script
}

function Build-Images {
    Show-Header 'CONSTRUIR IMÁGENES'
    if (-not (Test-ComposeEnvFiles)) { Pause-Script; return }
    Select-ServiceGroups

    $args = @()
    $args += $script:SelectedProfileArgs
    $args += 'build'
    $args += $script:SelectedServiceArgs
    [void](Invoke-Compose -Args $args -ErrorMessage 'Error al construir imágenes' -SuccessMessage 'Imágenes construidas exitosamente')

    Pause-Script
}

function Show-ComposeLogs {
    Show-Header 'VER LOGS'
    if (-not (Test-ComposeEnvFiles)) { Pause-Script; return }

    Write-Color 'Presione Ctrl+C para salir de los logs.' Yellow
    try {
        $args = @('logs', '-f')
        $cmd = New-Object System.Collections.Generic.List[string]
        $script:ComposeCmd | ForEach-Object { [void]$cmd.Add($_) }
        [void]$cmd.Add('-f')
        [void]$cmd.Add($script:ComposeFile)
        if (Test-Path '.env') { [void]$cmd.Add('--env-file'); [void]$cmd.Add('.env') }
        $envSpecific = ".env.$($script:EnvName)"
        if (Test-Path $envSpecific) { [void]$cmd.Add('--env-file'); [void]$cmd.Add($envSpecific) }
        $args | ForEach-Object { [void]$cmd.Add($_) }
        & $cmd[0] $cmd[1..($cmd.Count - 1)]
    }
    catch {}

    Pause-Script
}

function Show-SingleContainerLogs {
    Show-Header 'LOGS DE CONTENEDOR'
    $container = Select-Container -IncludeAll
    if (-not $container) { return }

    Write-Color 'Presione Ctrl+C para salir de los logs.' Yellow
    try { & docker logs -f $container.Id } catch {}
    Pause-Script
}

function Show-ComposePs {
    Show-Header 'ESTADO DE CONTENEDORES'
    if (-not (Test-ComposeEnvFiles)) { Pause-Script; return }
    [void](Invoke-Compose -Args @('ps') -ErrorMessage 'Error al consultar el estado' -SuccessMessage '')
    Pause-Script
}

function Show-StackContainerList {
    Show-Header 'LISTAR CONTENEDORES'
    [void](Show-StackContainers -IncludeAll)
    Pause-Script
}

function Enter-ContainerShell {
    Show-Header 'TERMINAL EN CONTENEDOR'
    $container = Select-Container
    if (-not $container) { return }

    Write-Host ''
    Write-Host '1) Usuario normal del contenedor'
    Write-Host '2) root'
    $answer = Read-Host 'Seleccione el usuario para la terminal [1/2]'
    if ([string]::IsNullOrWhiteSpace($answer)) { $answer = '1' }

    $execArgs = @('exec', '-it')
    if ($answer -eq '2') {
        $execArgs += @('-u', 'root')
    }
    $execArgs += @($container.Id, 'bash')

    $test = Invoke-NativeCommandQuiet -Command @('docker', 'exec', $container.Id, 'bash', '-lc', 'echo ok')
    if ($test.ExitCode -ne 0) {
        $execArgs[-1] = 'sh'
    }

    try { & docker $execArgs } catch {}
    Pause-Script
}

function Monitor-Resources {
    Show-Header 'MONITOREO DE RECURSOS'
    $containers = Get-StackContainers
    if ($containers.Count -eq 0) {
        Write-Color ("⚠️  No hay contenedores activos con etiqueta: $($script:LabelFilter)") Yellow
        Pause-Script
        return
    }

    Write-Color 'Presione Ctrl+C para salir del monitoreo.' Yellow
    try {
        & docker stats --filter "label=$($script:LabelFilter)" --format 'table {{.Name}}	{{.CPUPerc}}	{{.MemUsage}}	{{.MemPerc}}	{{.NetIO}}	{{.BlockIO}}'
    }
    catch {}
    Pause-Script
}

# -----------------------------
# Limpieza
# -----------------------------
function Remove-RuntimeArtifacts {
    $volumesRoot = Get-EnvValue -Key 'VOLUMES_ROOT' -DefaultValue './APP/volumes'
    if (-not (Test-Path $volumesRoot)) {
        Write-Color ("⚠️  No existe el directorio $volumesRoot") Yellow
        return
    }

    $targets = @('node_modules', '__pycache__', '.pytest_cache', '.mypy_cache', '.ruff_cache', '.venv', 'venv', 'dist', 'build', 'coverage')
    $removed = $false

    foreach ($name in $targets) {
        Get-ChildItem -Path $volumesRoot -Directory -Recurse -Force -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -eq $name -and $_.FullName -notmatch '\\.git(\\|$)' } |
            ForEach-Object {
                $removed = $true
                try {
                    Remove-Item -LiteralPath $_.FullName -Recurse -Force -ErrorAction Stop
                    Write-Color ("✅ Eliminado: $($_.FullName)") Green
                }
                catch {
                    Write-Color ("❌ Error al eliminar: $($_.FullName)") Red
                }
            }
    }

    Get-ChildItem -Path $volumesRoot -File -Recurse -Force -ErrorAction SilentlyContinue |
        Where-Object {
            ($_.Extension -in '.pyc', '.pyo') -and $_.FullName -notmatch '\\.git(\\|$)'
        } |
        ForEach-Object {
            $removed = $true
            try {
                Remove-Item -LiteralPath $_.FullName -Force -ErrorAction Stop
                Write-Color ("✅ Eliminado: $($_.FullName)") Green
            }
            catch {
                Write-Color ("❌ Error al eliminar: $($_.FullName)") Red
            }
        }

    if (-not $removed) {
        Write-Color '⚠️  No se encontraron artefactos de runtime para limpiar' Yellow
    }
}

function Remove-DirectoryContents {
    param([Parameter(Mandatory = $true)][string]$Path)

    if (-not (Test-Path $Path)) {
        Write-Color ("⚠️  No existe el directorio $Path") Yellow
        return
    }

    $items = Get-ChildItem -Path $Path -Force -ErrorAction SilentlyContinue | Where-Object { $_.Name -ne '.gitkeep' }
    if (-not $items) {
        Write-Color ("⚠️  $Path ya está vacío") Yellow
        return
    }

    foreach ($item in $items) {
        try {
            Remove-Item -LiteralPath $item.FullName -Recurse -Force -ErrorAction Stop
            Write-Color ("✅ Eliminado: $($item.FullName)") Green
        }
        catch {
            Write-Color ("❌ Error al eliminar: $($item.FullName)") Red
        }
    }
}

function Clean-StackResources {
    Show-Header 'LIMPIEZA DE RECURSOS'
    if (-not (Test-ComposeEnvFiles)) { Pause-Script; return }

    if (Confirm-Action -Message '¿Limpiar contenedores, redes y volúmenes del stack?' -Default 'no') {
        $args = @()
        $args += Get-AllProfileArgs
        $args += @('down', '--volumes', '--remove-orphans')
        [void](Invoke-Compose -Args $args -ErrorMessage 'Error durante la limpieza' -SuccessMessage 'Limpieza completada')
    }

    Pause-Script
}

function Clean-UnusedImages {
    Show-Header 'LIMPIAR IMÁGENES'
    if (Confirm-Action -Message '¿Eliminar imágenes no utilizadas?' -Default 'no') {
        [void](Invoke-NativeCommand -Command @('docker', 'image', 'prune', '-af') -ErrorMessage 'Error al limpiar imágenes' -SuccessMessage 'Imágenes no utilizadas eliminadas')
    }
    Pause-Script
}

function Clean-UnusedVolumes {
    Show-Header 'LIMPIAR VOLÚMENES'
    if (Confirm-Action -Message '¿Eliminar todos los volúmenes no utilizados?' -Default 'no') {
        [void](Invoke-NativeCommand -Command @('docker', 'volume', 'prune', '-f') -ErrorMessage 'Error al limpiar volúmenes' -SuccessMessage 'Volúmenes no utilizados eliminados')
    }
    Pause-Script
}

function Clean-All {
    Show-Header 'LIMPIEZA COMPLETA'
    if (-not (Test-ComposeEnvFiles)) { Pause-Script; return }

    Write-Color '⚠️  ADVERTENCIA: Esta acción realizará una limpieza profunda del sistema' Red
    Write-Host '   • Contenedores, redes y volúmenes del stack actual'
    Write-Host '   • Imágenes no utilizadas'
    Write-Host '   • Caché de builds'
    Write-Host ''

    if (-not (Confirm-Action -Message '¿Iniciar limpieza completa?' -Default 'no')) {
        return
    }

    $args = @()
    $args += Get-AllProfileArgs
    $args += @('down', '--volumes', '--remove-orphans')
    [void](Invoke-Compose -Args $args -ErrorMessage 'Error al limpiar recursos del stack' -SuccessMessage 'Recursos del stack eliminados')
    [void](Invoke-NativeCommand -Command @('docker', 'image', 'prune', '-af') -ErrorMessage 'Error al limpiar imágenes' -SuccessMessage 'Imágenes huérfanas eliminadas')
    [void](Invoke-NativeCommand -Command @('docker', 'builder', 'prune', '-af') -ErrorMessage 'Error al limpiar caché de builds' -SuccessMessage 'Caché de builds eliminada')

    Pause-Script
}

function Drop-Persistence {
    Show-Header 'ELIMINAR PERSISTENCIAS'

    $dataRoot = Get-EnvValue -Key 'DATA_ROOT' -DefaultValue "./APP/data/$($script:EnvName)"
    $logsRoot = Get-EnvValue -Key 'LOGS_ROOT' -DefaultValue "./APP/logs/$($script:EnvName)"
    $volumesRoot = Get-EnvValue -Key 'VOLUMES_ROOT' -DefaultValue './APP/volumes'

    Write-Color '⚠️  ADVERTENCIA: Esta acción eliminará:' Red
    Write-Host '   • Volúmenes Docker nombrados del proyecto'
    Write-Host ("   • Artefactos de runtime en $volumesRoot")
    Write-Host ("   • Datos de $dataRoot")
    Write-Host ("   • Logs de $logsRoot")
    Write-Host ''

    if (-not (Confirm-Action -Message '¿Eliminar todas las persistencias?' -Default 'no')) {
        Pause-Script
        return
    }

    if (Confirm-Action -Message '¿Eliminar volúmenes Docker nombrados del proyecto?' -Default 'no') {
        $volName = "$($script:ProjectName)_frontend_node_modules"
        $inspect = Invoke-NativeCommandQuiet -Command @('docker', 'volume', 'inspect', $volName)
        if ($inspect.ExitCode -eq 0) {
            [void](Invoke-NativeCommand -Command @('docker', 'volume', 'rm', $volName) -ErrorMessage 'Error al eliminar volumen' -SuccessMessage "Volumen eliminado: $volName")
        }
        else {
            Write-Color '⚠️  No se encontraron volúmenes Docker nombrados del proyecto para eliminar' Yellow
        }
    }

    if (Confirm-Action -Message ("¿Eliminar artefactos de runtime en $volumesRoot?") -Default 'no') {
        Remove-RuntimeArtifacts
    }

    if (Confirm-Action -Message ("¿Eliminar carpetas de $dataRoot?") -Default 'no') {
        Remove-DirectoryContents -Path $dataRoot
    }

    if (Confirm-Action -Message ("¿Eliminar contenido de $logsRoot?") -Default 'no') {
        Remove-DirectoryContents -Path $logsRoot
    }

    Pause-Script
}

# -----------------------------
# Configuración
# -----------------------------
function Change-Environment {
    Show-Header 'CAMBIAR ENTORNO'
    Write-Host '1) dev'
    Write-Host '2) qa'
    Write-Host '3) prd'
    $choice = Read-Host 'Seleccione nuevo entorno'

    switch ($choice) {
        '1' { $script:EnvName = 'dev' }
        '2' { $script:EnvName = 'qa' }
        '3' { $script:EnvName = 'prd' }
        default {
            Write-Color '❌ Opción inválida' Red
            Pause-Script
            return
        }
    }

    Set-ComposeFile
    $script:CurrentIP = Get-CurrentIPAddress
    Write-Color ("✅ Entorno cambiado a: $($script:EnvName)") Green
    Pause-Script
}

function Update-IPMenu {
    Show-Header 'ACTUALIZAR IP EXPO / ANDROID'

    $envFile = '.env'
    if (-not (Test-Path $envFile)) {
        Write-Color '❌ Error: Archivo .env no encontrado' Red
        Pause-Script
        return
    }

    $currentIP = Get-CurrentIPAddress
    if ([string]::IsNullOrWhiteSpace($currentIP)) {
        $currentIP = Read-Host 'No se pudo detectar IP automáticamente. Ingrese IP manualmente'
    }

    Write-Host ("IP actual detectada: $currentIP")
    if (Confirm-Action -Message ("¿Actualizar REACT_NATIVE_PACKAGER_HOSTNAME en .env a $currentIP?") -Default 'yes') {
        Set-EnvValue -Path $envFile -Key 'REACT_NATIVE_PACKAGER_HOSTNAME' -Value $currentIP
        $script:CurrentIP = $currentIP
        Write-Color '✅ IP actualizada exitosamente' Green
    }

    Pause-Script
}

function Check-IPMenu {
    Show-Header 'VERIFICAR IP EXPO / ANDROID'

    $currentIP = Get-CurrentIPAddress
    Write-Host ('IP actual del equipo: ' + $(if ($currentIP) { $currentIP } else { 'No detectada' }))

    if (Test-Path '.env') {
        $envIP = Get-EnvValue -Key 'REACT_NATIVE_PACKAGER_HOSTNAME'
        Write-Host ('REACT_NATIVE_PACKAGER_HOSTNAME en .env: ' + $(if ($envIP) { $envIP } else { 'No configurada' }))
        if ($currentIP -and $envIP) {
            if ($currentIP -eq $envIP) {
                Write-Color '✅ Las IPs coinciden' Green
            }
            else {
                Write-Color '⚠️  Las IPs no coinciden' Yellow
            }
        }
    }

    Pause-Script
}

function Show-ContainerEnv {
    Show-Header 'VARIABLES DE ENTORNO'
    $container = Select-Container
    if (-not $container) { return }

    $result = Invoke-NativeCommandQuiet -Command @('docker', 'exec', $container.Id, 'env')
    if ($result.ExitCode -eq 0) {
        $i = 1
        $result.Output | Sort-Object | ForEach-Object {
            Write-Host (('{0,4} {1}' -f $i, $_))
            $i++
        }
    }
    else {
        Write-Color '❌ No se pudieron leer las variables de entorno del contenedor' Red
    }

    Pause-Script
}

# -----------------------------
# Backup / restore
# -----------------------------
function Ensure-BackupDirectory {
    if (-not (Test-Path $script:BackupDir)) {
        New-Item -ItemType Directory -Path $script:BackupDir | Out-Null
    }
}

function Get-ProjectNamedVolumes {
    $result = Invoke-NativeCommandQuiet -Command @('docker', 'volume', 'ls', '--format', '{{.Name}}')
    if ($result.ExitCode -ne 0) { return @() }
    return @($result.Output | Where-Object { $_ -match ('^' + [regex]::Escape($script:ProjectName) + '_') })
}

function Backup-Volumes {
    Show-Header 'BACKUP DE VOLÚMENES'
    Ensure-BackupDirectory

    $volumes = Get-ProjectNamedVolumes
    if ($volumes.Count -eq 0) {
        Write-Color '⚠️  No se encontraron volúmenes del proyecto para respaldar' Yellow
        Pause-Script
        return
    }

    Write-Color 'Volúmenes detectados:' Cyan
    $volumes | ForEach-Object { Write-Host ("   • $_") }
    Write-Host ''

    foreach ($volume in $volumes) {
        $timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
        $safeName = "$volume`_$timestamp.tar.gz"
        $targetFile = Join-Path $script:BackupDir $safeName

        Write-Color ("Respaldando volumen: $volume") Blue
        $cmd = @(
            'docker', 'run', '--rm',
            '-v', "$volume`:/source",
            '-v', "${PWD}`:/backup",
            'alpine', 'sh', '-c',
            "cd /source && tar -czf /backup/$targetFile ."
        )

        $result = Invoke-NativeCommandQuiet -Command $cmd
        if ($result.ExitCode -eq 0) {
            Write-Color ("✅ Backup generado: $targetFile") Green
        }
        else {
            Write-Color ("❌ Error al generar backup de $volume") Red
            $result.Output | ForEach-Object { Write-Host $_ }
        }
    }

    Pause-Script
}

function Restore-Volume {
    Show-Header 'RESTAURAR VOLUMEN'
    Ensure-BackupDirectory

    $files = Get-ChildItem -Path $script:BackupDir -File -Filter '*.tar.gz' -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending
    if (-not $files) {
        Write-Color '⚠️  No se encontraron archivos de backup' Yellow
        Pause-Script
        return
    }

    $idx = 1
    foreach ($file in $files) {
        Write-Host ("$idx) $($file.Name)")
        $idx++
    }

    $choice = Read-Host 'Seleccione el backup a restaurar (0 para volver)'
    if ($choice -eq '0') { return }

    $selectedIndex = 0
    if (-not [int]::TryParse($choice, [ref]$selectedIndex) -or $selectedIndex -lt 1 -or $selectedIndex -gt $files.Count) {
        Write-Color '❌ Selección inválida' Red
        Pause-Script
        return
    }

    $selected = $files[$selectedIndex - 1]
    $defaultVolumeName = ($selected.BaseName -replace '_\d{8}_\d{6}$', '')
    $volumeName = Read-Host "Nombre del volumen destino [$defaultVolumeName]"
    if ([string]::IsNullOrWhiteSpace($volumeName)) {
        $volumeName = $defaultVolumeName
    }

    if (-not (Confirm-Action -Message ("¿Restaurar $($selected.Name) sobre el volumen $volumeName?") -Default 'no')) {
        Pause-Script
        return
    }

    [void](Invoke-NativeCommand -Command @('docker', 'volume', 'create', $volumeName) -ErrorMessage 'Error al crear el volumen destino' -SuccessMessage '')

    $relativeBackup = Join-Path $script:BackupDir $selected.Name
    $cmd = @(
        'docker', 'run', '--rm',
        '-v', "$volumeName`:/target",
        '-v', "${PWD}`:/backup",
        'alpine', 'sh', '-c',
        "cd /target && tar -xzf /backup/$relativeBackup"
    )
    $result = Invoke-NativeCommandQuiet -Command $cmd
    if ($result.ExitCode -eq 0) {
        Write-Color '✅ Restauración completada' Green
    }
    else {
        Write-Color '❌ Error durante la restauración' Red
        $result.Output | ForEach-Object { Write-Host $_ }
    }

    Pause-Script
}

# -----------------------------
# Expo / templates
# -----------------------------
function Show-ExpoMenu {
    Show-Header 'HERRAMIENTAS EXPO'
    Write-Host '1) Iniciar Expo Development Server'
    Write-Host '2) EAS Build'
    Write-Host 'V) Volver'
    Write-Host 'S) Salir'
    $choice = Read-Host 'Seleccione una opción'

    switch ($choice.ToUpperInvariant()) {
        '1' {
            Write-Color '⚠️  Función en desarrollo para Windows nativo.' Yellow
            Pause-Script
        }
        '2' {
            Write-Color '⚠️  Función en desarrollo para Windows nativo.' Yellow
            Pause-Script
        }
        'V' { return }
        'S' { Exit-Script }
        default {
            Write-Color '❌ Opción inválida' Red
            Start-Sleep -Seconds 1
        }
    }
}

function Show-TemplatesMenu {
    Show-Header 'GESTIÓN DE TEMPLATES .ENV'
    Write-Host '1) Listar archivos .env disponibles'
    Write-Host '2) Mostrar diferencias simples'
    Write-Host '3) Función en desarrollo'
    Write-Host 'V) Volver'
    Write-Host 'S) Salir'
    $choice = Read-Host 'Seleccione una opción'

    switch ($choice.ToUpperInvariant()) {
        '1' {
            Get-ChildItem -Path . -File -Filter '.env*' -ErrorAction SilentlyContinue | Select-Object Name, Length, LastWriteTime | Format-Table -AutoSize
            Pause-Script
        }
        '2' {
            $base = '.env'
            $target = ".env.$($script:EnvName)"
            if ((Test-Path $base) -and (Test-Path $target)) {
                Compare-Object (Get-Content $base) (Get-Content $target) | Format-Table -AutoSize
            }
            else {
                Write-Color '⚠️  No existen ambos archivos para comparar.' Yellow
            }
            Pause-Script
        }
        '3' {
            Write-Color '⚠️  Función en desarrollo.' Yellow
            Pause-Script
        }
        'V' { return }
        'S' { Exit-Script }
        default {
            Write-Color '❌ Opción inválida' Red
            Start-Sleep -Seconds 1
        }
    }
}

# -----------------------------
# Docker Desktop / Portainer
# -----------------------------
function Show-DockerServicesMenu {
    Show-Header 'ESTADO Y SERVICIOS DOCKER'
    Write-Host '1) Estado Docker Engine'
    Write-Host '2) Estado Docker Desktop'
    Write-Host '3) Reiniciar Docker Desktop'
    Write-Host '4) Abrir Docker Desktop'
    Write-Host 'V) Volver'
    Write-Host 'S) Salir'
    $choice = Read-Host 'Seleccione una opción'

    switch ($choice.ToUpperInvariant()) {
        '1' {
            [void](Invoke-NativeCommand -Command @('docker', 'info') -ErrorMessage 'Docker Engine no disponible' -SuccessMessage '')
            Pause-Script
        }
        '2' {
            $proc = Get-Process -Name 'Docker Desktop' -ErrorAction SilentlyContinue
            if ($proc) {
                Write-Color '✅ Docker Desktop está en ejecución' Green
            }
            else {
                Write-Color '⚠️  Docker Desktop no parece estar en ejecución' Yellow
            }
            Pause-Script
        }
        '3' {
            if (Confirm-Action -Message '¿Reiniciar Docker Desktop?' -Default 'no') {
                Get-Process -Name 'Docker Desktop' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
                Start-Sleep -Seconds 2
                $desktopExe = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'
                if (Test-Path $desktopExe) {
                    Start-Process -FilePath $desktopExe | Out-Null
                    Write-Color '✅ Docker Desktop iniciado' Green
                }
                else {
                    Write-Color '❌ No se encontró Docker Desktop.exe' Red
                }
            }
            Pause-Script
        }
        '4' {
            $desktopExe = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'
            if (Test-Path $desktopExe) {
                Start-Process -FilePath $desktopExe | Out-Null
                Write-Color '✅ Docker Desktop abierto' Green
            }
            else {
                Write-Color '❌ No se encontró Docker Desktop.exe' Red
            }
            Pause-Script
        }
        'V' { return }
        'S' { Exit-Script }
        default {
            Write-Color '❌ Opción inválida' Red
            Start-Sleep -Seconds 1
        }
    }
}

function Start-Portainer {
    $existing = Invoke-NativeCommandQuiet -Command @('docker', 'ps', '-a', '--format', '{{.Names}}')
    $exists = $false
    if ($existing.ExitCode -eq 0) {
        $exists = @($existing.Output) -contains $script:PortainerName
    }

    if (-not $exists) {
        $cmd = @(
            'docker', 'run', '-d',
            '--name', $script:PortainerName,
            '--restart', 'unless-stopped',
            '-p', '9000:9000',
            '-v', 'portainer_data:/data',
            $script:PortainerImage
        )
        [void](Invoke-NativeCommand -Command $cmd -ErrorMessage 'Error al iniciar Portainer' -SuccessMessage 'Portainer iniciado en http://localhost:9000')
    }
    else {
        [void](Invoke-NativeCommand -Command @('docker', 'start', $script:PortainerName) -ErrorMessage 'Error al iniciar Portainer' -SuccessMessage 'Portainer iniciado')
    }
}

function Show-PortainerMenu {
    Show-Header 'PORTAINER'
    Write-Color 'Nota: en Windows se omite el bind directo a /var/run/docker.sock del host Linux.' Yellow
    Write-Host '1) Iniciar Portainer'
    Write-Host '2) Detener Portainer'
    Write-Host '3) Reiniciar Portainer'
    Write-Host '4) Abrir en navegador'
    Write-Host '5) Ver logs'
    Write-Host '6) Recrear Portainer'
    Write-Host 'V) Volver'
    Write-Host 'S) Salir'
    $choice = Read-Host 'Seleccione una opción'

    switch ($choice.ToUpperInvariant()) {
        '1' {
            Start-Portainer
            Pause-Script
        }
        '2' {
            [void](Invoke-NativeCommand -Command @('docker', 'stop', $script:PortainerName) -ErrorMessage 'Error al detener Portainer' -SuccessMessage 'Portainer detenido')
            Pause-Script
        }
        '3' {
            [void](Invoke-NativeCommand -Command @('docker', 'restart', $script:PortainerName) -ErrorMessage 'Error al reiniciar Portainer' -SuccessMessage 'Portainer reiniciado')
            Pause-Script
        }
        '4' {
            Start-Process 'http://localhost:9000'
            Pause-Script
        }
        '5' {
            [void](Invoke-NativeCommand -Command @('docker', 'logs', '--tail', '50', $script:PortainerName) -ErrorMessage 'Error al leer logs de Portainer' -SuccessMessage '')
            Pause-Script
        }
        '6' {
            if (Confirm-Action -Message '¿Recrear contenedor Portainer?' -Default 'no') {
                [void](Invoke-NativeCommandQuiet -Command @('docker', 'stop', $script:PortainerName))
                [void](Invoke-NativeCommandQuiet -Command @('docker', 'rm', $script:PortainerName))
                [void](Invoke-NativeCommandQuiet -Command @('docker', 'volume', 'create', 'portainer_data'))
                Start-Portainer
            }
            Pause-Script
        }
        'V' { return }
        'S' { Exit-Script }
        default {
            Write-Color '❌ Opción inválida' Red
            Start-Sleep -Seconds 1
        }
    }
}

# -----------------------------
# Menús principales
# -----------------------------
function Show-ContainersMenu {
    while ($true) {
        Show-Header 'MANEJADOR DE CONTENEDORES'
        Write-Host '1) Iniciar contenedores y construir imágenes'
        Write-Host '2) Detener y eliminar contenedores'
        Write-Host '3) Reiniciar contenedores'
        Write-Host '4) Reiniciar contenedor único'
        Write-Host '5) Construir imágenes'
        Write-Host '6) Validar Docker Compose'
        Write-Host '7) Validar reglas del proyecto'
        Write-Host 'V) Volver'
        Write-Host 'S) Salir'
        $choice = Read-Host 'Seleccione una opción'

        switch ($choice.ToUpperInvariant()) {
            '1' { Up-Stack }
            '2' { Down-Stack }
            '3' { Restart-Stack }
            '4' { Restart-SingleContainer }
            '5' { Build-Images }
            '6' { Validate-Compose }
            '7' { Validate-ComposeRules }
            'V' { return }
            'S' { Exit-Script }
            default { Write-Color '❌ Opción inválida' Red; Start-Sleep -Seconds 1 }
        }
    }
}

function Show-MonitoringMenu {
    while ($true) {
        Show-Header 'MONITOREO Y DIAGNÓSTICO'
        Write-Host '1) Ver logs'
        Write-Host '2) Ver logs de un contenedor'
        Write-Host '3) Estado de los contenedores'
        Write-Host '4) Listar contenedores del stack'
        Write-Host '5) Abrir terminal en contenedor'
        Write-Host '6) Monitoreo de recursos'
        Write-Host 'V) Volver'
        Write-Host 'S) Salir'
        $choice = Read-Host 'Seleccione una opción'

        switch ($choice.ToUpperInvariant()) {
            '1' { Show-ComposeLogs }
            '2' { Show-SingleContainerLogs }
            '3' { Show-ComposePs }
            '4' { Show-StackContainerList }
            '5' { Enter-ContainerShell }
            '6' { Monitor-Resources }
            'V' { return }
            'S' { Exit-Script }
            default { Write-Color '❌ Opción inválida' Red; Start-Sleep -Seconds 1 }
        }
    }
}

function Show-CleanupMenu {
    while ($true) {
        Show-Header 'LIMPIEZA Y MANTENIMIENTO'
        Write-Host '1) Limpiar contenedores, redes y volúmenes'
        Write-Host '2) Limpiar imágenes no utilizadas'
        Write-Host '3) Limpiar volúmenes no utilizados'
        Write-Host '4) Limpiar todo'
        Write-Host '5) Eliminar persistencias'
        Write-Host 'V) Volver'
        Write-Host 'S) Salir'
        $choice = Read-Host 'Seleccione una opción'

        switch ($choice.ToUpperInvariant()) {
            '1' { Clean-StackResources }
            '2' { Clean-UnusedImages }
            '3' { Clean-UnusedVolumes }
            '4' { Clean-All }
            '5' { Drop-Persistence }
            'V' { return }
            'S' { Exit-Script }
            default { Write-Color '❌ Opción inválida' Red; Start-Sleep -Seconds 1 }
        }
    }
}

function Show-ConfigurationMenu {
    while ($true) {
        Show-Header 'CONFIGURACIÓN DEL SISTEMA'
        Write-Host '1) Cambiar entorno (dev, qa, prd)'
        Write-Host '2) Actualizar IP para Expo / Android'
        Write-Host '3) Verificar IP de Expo / Android'
        Write-Host '4) Listar variables de entorno del contenedor'
        Write-Host 'V) Volver'
        Write-Host 'S) Salir'
        $choice = Read-Host 'Seleccione una opción'

        switch ($choice.ToUpperInvariant()) {
            '1' { Change-Environment }
            '2' { Update-IPMenu }
            '3' { Check-IPMenu }
            '4' { Show-ContainerEnv }
            'V' { return }
            'S' { Exit-Script }
            default { Write-Color '❌ Opción inválida' Red; Start-Sleep -Seconds 1 }
        }
    }
}

function Show-BackupMenu {
    while ($true) {
        Show-Header 'BACKUP Y RESTORE'
        Write-Host '1) Backup de volúmenes'
        Write-Host '2) Restaurar volumen'
        Write-Host 'V) Volver'
        Write-Host 'S) Salir'
        $choice = Read-Host 'Seleccione una opción'

        switch ($choice.ToUpperInvariant()) {
            '1' { Backup-Volumes }
            '2' { Restore-Volume }
            'V' { return }
            'S' { Exit-Script }
            default { Write-Color '❌ Opción inválida' Red; Start-Sleep -Seconds 1 }
        }
    }
}

function Show-MainMenu {
    while ($true) {
        Show-Header 'MENÚ PRINCIPAL'
        Write-Host '1) Manejador de contenedores'
        Write-Host '2) Monitoreo y diagnóstico'
        Write-Host '3) Limpieza y mantenimiento'
        Write-Host '4) Configuración del sistema'
        Write-Host '5) Herramientas Expo'
        Write-Host '6) Gestión de templates .env'
        Write-Host '7) Estado y servicios Docker'
        Write-Host '8) Portainer'
        Write-Host '9) Backup y restore'
        Write-Host 'S) Salir'
        $choice = Read-Host 'Seleccione una opción'

        switch ($choice.ToUpperInvariant()) {
            '1' { Show-ContainersMenu }
            '2' { Show-MonitoringMenu }
            '3' { Show-CleanupMenu }
            '4' { Show-ConfigurationMenu }
            '5' { Show-ExpoMenu }
            '6' { Show-TemplatesMenu }
            '7' { Show-DockerServicesMenu }
            '8' { Show-PortainerMenu }
            '9' { Show-BackupMenu }
            'S' { Exit-Script }
            default { Write-Color '❌ Opción inválida' Red; Start-Sleep -Seconds 1 }
        }
    }
}

function Exit-Script {
    Clear-Safely
    Write-Color '═══════════════════════════════════════════════════════════' Cyan
    Write-Color '   ¡Gracias por usar Docker Tools para Windows!' Green
    Write-Color '═══════════════════════════════════════════════════════════' Cyan
    exit 0
}

function Initialize-State {
    $script:ProjectName = Get-EnvValue -Key 'PROJECT_NAME'
    if ([string]::IsNullOrWhiteSpace($script:ProjectName)) {
        $script:ProjectName = 'NoExiteStackName'
    }
    $script:Stack = $script:ProjectName
    $script:LabelFilter = "stack=$($script:Stack)"
    Set-ComposeFile
    $script:CurrentIP = Get-CurrentIPAddress
}

function Main {
    Clear-Safely
    Test-Dependencies
    Initialize-State
    Show-MainMenu
}

Main
