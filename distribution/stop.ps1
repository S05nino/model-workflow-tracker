# ML Workflow Dashboard - Stop Script
# Esegui questo script per fermare la dashboard

Write-Host "Arresto ML Workflow Dashboard..." -ForegroundColor Yellow
Set-Location $PSScriptRoot
docker compose down

if ($?) {
    Write-Host "Dashboard fermata." -ForegroundColor Green
} else {
    Write-Host "Errore durante l'arresto." -ForegroundColor Red
}

Read-Host "Premi INVIO per chiudere"
