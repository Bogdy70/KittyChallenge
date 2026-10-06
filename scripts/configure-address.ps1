param(
  [ValidateSet('tailscale','local','custom')][string]$Mode = 'tailscale',
  [string]$Address,
  [int]$Port = 3001
)
$ErrorActionPreference = 'Stop'
Push-Location (Join-Path $PSScriptRoot '..')
try {
  if ($Mode -eq 'custom') {
    if (!$Address) { throw 'Pentru custom, specifică -Address.' }
    node scripts/network.mjs configure --host $Address --port $Port
  } elseif ($Mode -eq 'local') { node scripts/network.mjs configure --local --port $Port
  } else { node scripts/network.mjs configure --tailscale --port $Port }
  if ($LASTEXITCODE -ne 0) { throw 'Configurarea adresei a eșuat.' }
} finally { Pop-Location }
