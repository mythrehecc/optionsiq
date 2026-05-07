# start_backend.ps1
# Always run the backend with venv312 which has TensorFlow installed.
# Usage: from the options-iq root, run:  .\start_backend.ps1

$venvPython = "$PSScriptRoot\venv312\Scripts\python.exe"
$backendDir  = "$PSScriptRoot\backend"

if (-not (Test-Path $venvPython)) {
    Write-Error "venv312 not found at $venvPython"
    exit 1
}

Write-Host "Using Python: $venvPython" -ForegroundColor Cyan
Write-Host "Backend dir : $backendDir"  -ForegroundColor Cyan

Set-Location $backendDir
& $venvPython run.py
