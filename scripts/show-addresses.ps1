$ErrorActionPreference = 'Stop'
Push-Location (Join-Path $PSScriptRoot '..')
try { node scripts/network.mjs addresses; if ($LASTEXITCODE -ne 0) { throw 'Nu am putut afișa adresele.' } } finally { Pop-Location }
