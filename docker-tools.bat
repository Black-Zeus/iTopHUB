@echo off
title Docker Tools
color 0A

:menu
cls
echo ========================================
echo       DOCKER TOOLS - SELECTOR
echo ========================================
echo.
echo 1) DeepSeek Tool
echo 2) Claude Tool
echo 3) GPT Tool
echo ----------------------------------------
echo 9) Normalizar codificacion de scripts
echo 0) Salir
echo.
echo ========================================
set /p opt="Opcion: "
if "%opt%"=="1" goto deepseek
if "%opt%"=="2" goto claude
if "%opt%"=="3" goto gpt
if "%opt%"=="9" goto normalizar
if "%opt%"=="0" goto salir
echo Opcion invalida
timeout /t 2 >nul
goto menu

:deepseek
cls
echo Iniciando Docker Tool - DeepSeek...
echo.
call :check_encoding "%~dp0docker_tool_deepSeek.ps1"
if "%ENCODING_OK%"=="0" (
    echo [WARN] El script tiene problemas de codificacion. Use opcion 9 para normalizar.
    pause
)
if exist "%~dp0docker_tool_deepSeek.ps1" (
    powershell -ExecutionPolicy Bypass -NoExit -File "%~dp0docker_tool_deepSeek.ps1"
) else (
    echo [ERROR] Script no encontrado
    pause
)
goto menu

:claude
cls
echo Iniciando Docker Tool - Claude...
echo.
call :check_encoding "%~dp0docker_tool_claude.ps1"
if "%ENCODING_OK%"=="0" (
    echo [WARN] El script tiene problemas de codificacion. Use opcion 9 para normalizar.
    pause
)
if exist "%~dp0docker_tool_claude.ps1" (
    powershell -ExecutionPolicy Bypass -NoExit -File "%~dp0docker_tool_claude.ps1"
) else (
    echo [ERROR] Script no encontrado
    pause
)
goto menu

:gpt
cls
echo Iniciando Docker Tool - GPT...
echo.
call :check_encoding "%~dp0docker_tool_gpt.ps1"
if "%ENCODING_OK%"=="0" (
    echo [WARN] El script tiene problemas de codificacion. Use opcion 9 para normalizar.
    pause
)
if exist "%~dp0docker_tool_gpt.ps1" (
    powershell -ExecutionPolicy Bypass -NoExit -File "%~dp0docker_tool_gpt.ps1"
) else (
    echo [ERROR] Script no encontrado
    pause
)
goto menu

:normalizar
cls
echo ========================================
echo     NORMALIZACION DE CODIFICACION
echo ========================================
echo.
echo Convirtiendo scripts a UTF-8 con BOM...
echo.
powershell -ExecutionPolicy Bypass -Command ^
    "$scripts = @('docker_tool_deepSeek.ps1','docker_tool_claude.ps1','docker_tool_gpt.ps1');" ^
    "$dir = '%~dp0';" ^
    "$bom = [System.Text.UTF8Encoding]::new($true);" ^
    "foreach ($s in $scripts) {" ^
    "    $path = Join-Path $dir $s;" ^
    "    if (Test-Path $path) {" ^
    "        $content = Get-Content $path -Raw -Encoding UTF8;" ^
    "        [System.IO.File]::WriteAllText($path, $content, $bom);" ^
    "        Write-Host '[OK] Normalizado: ' $s -ForegroundColor Green;" ^
    "    } else {" ^
    "        Write-Host '[--] No encontrado: ' $s -ForegroundColor Yellow;" ^
    "    }" ^
    "}"
echo.
echo Normalizacion completada.
pause
goto menu

:check_encoding
set ENCODING_OK=1
powershell -ExecutionPolicy Bypass -Command ^
    "$path = '%~1';" ^
    "if (Test-Path $path) {" ^
    "    $bytes = [System.IO.File]::ReadAllBytes($path);" ^
    "    $text = [System.Text.Encoding]::UTF8.GetString($bytes);" ^
    "    if ($text -match 'â€|â•|Ã|â€™|â€œ') {" ^
    "        exit 1" ^
    "    }" ^
    "}" ^
    "exit 0"
if %ERRORLEVEL%==1 set ENCODING_OK=0
exit /b

:salir
color
exit