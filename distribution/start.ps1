# ML Workflow Dashboard - Start Script
# Esegui questo script per avviare la dashboard (dopo il primo setup)

Write-Host "Avvio ML Workflow Dashboard..." -ForegroundColor Yellow
Set-Location $PSScriptRoot
docker compose up -d

if ($?) {
    Write-Host ""
    Write-Host "Dashboard avviata!" -ForegroundColor Green
    Write-Host "Apri: http://localhost:8080" -ForegroundColor Cyan
} else {
    Write-Host "Errore durante l'avvio. Hai gia' eseguito setup.ps1?" -ForegroundColor Red
}

Write-Host ""
Read-Host "Premi INVIO per chiudere"
