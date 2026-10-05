$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
if (!(Test-Path node_modules)) { npm.cmd ci; if ($LASTEXITCODE -ne 0) { throw 'Instalarea a eșuat.' } }
npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw 'Compilarea a eșuat.' }
npm.cmd start
