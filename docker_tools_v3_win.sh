#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Docker Tools Windows ahora usa una implementacion nativa de PowerShell."
echo "Se abrira docker_tools_v3_win.ps1."
echo ""

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "${SCRIPT_DIR}/docker_tools_v3_win.ps1"
