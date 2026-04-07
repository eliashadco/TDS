$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

# Stop only node processes started from this workspace.
Get-CimInstance Win32_Process |
  Where-Object {
    $_.Name -eq "node.exe" -and
    $_.CommandLine -match [regex]::Escape($projectRoot)
  } |
  ForEach-Object {
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
  }

# Remove stale Next.js build artifacts.
if (Test-Path ".next") {
  Remove-Item ".next" -Recurse -Force
}

npm run dev
