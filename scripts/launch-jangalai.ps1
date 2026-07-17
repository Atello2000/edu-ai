$root = Split-Path -Parent $PSScriptRoot

# Libere les ports d'un lancement precedent mal ferme (evite EADDRINUSE / scan de ports par Vite)
foreach ($port in 3001, 5173, 5174, 5175, 5176, 5177, 5178) {
    Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
        ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
}

Start-Process pwsh -ArgumentList "-NoExit", "-Command", "Set-Location `"$root`"; npm run dev"
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "Set-Location `"$root\client`"; npm run dev -- --open"
