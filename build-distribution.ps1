# Build Distribution Package
# Esegui questo script per creare il pacchetto da distribuire ai colleghi

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Build Distribution Package" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verifica Docker
Write-Host "Verifica Docker..." -ForegroundColor Yellow
$dockerRunning = docker info 2>$null
if (-not $?) {
    Write-Host "ERRORE: Docker non e' in esecuzione." -ForegroundColor Red
    exit 1
}

# Build delle immagini
Write-Host ""
Write-Host "Build immagine frontend..." -ForegroundColor Yellow
docker build -t ml-workflow-frontend:latest -f docker/frontend/Dockerfile .
if (-not $?) {
    Write-Host "ERRORE nel build frontend" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Build immagine backend..." -ForegroundColor Yellow
docker build -t ml-workflow-backend:latest -f docker/backend/Dockerfile docker/backend
if (-not $?) {
    Write-Host "ERRORE nel build backend" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Build immagine python..." -ForegroundColor Yellow
docker build -t ml-workflow-python:latest -f docker/ce_python/Dockerfile docker/ce_python
if (-not $?) {
    Write-Host "ERRORE nel build python" -ForegroundColor Red
    exit 1
}

# Crea cartella images nella distribution
$imagesFolder = "distribution\images"
if (-not (Test-Path $imagesFolder)) {
    New-Item -ItemType Directory -Path $imagesFolder | Out-Null
}

# Esporta le immagini
Write-Host ""
Write-Host "Esportazione immagine frontend..." -ForegroundColor Yellow
docker save -o "$imagesFolder\frontend.tar" ml-workflow-frontend:latest

Write-Host "Esportazione immagine backend..." -ForegroundColor Yellow
docker save -o "$imagesFolder\backend.tar" ml-workflow-backend:latest

Write-Host "Esportazione immagine python..." -ForegroundColor Yellow
docker save -o "$imagesFolder\python.tar" ml-workflow-python:latest

# Calcola dimensione totale
$frontendSize = (Get-Item "$imagesFolder\frontend.tar").Length / 1MB
$backendSize = (Get-Item "$imagesFolder\backend.tar").Length / 1MB
$pythonSize = (Get-Item "$imagesFolder\python.tar").Length / 1MB
$totalSize = $frontendSize + $backendSize + $pythonSize

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Pacchetto creato con successo!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Cartella da distribuire: distribution\" -ForegroundColor Cyan
Write-Host "Dimensione totale: $([math]::Round($totalSize, 1)) MB" -ForegroundColor Gray
Write-Host "  - Frontend: $([math]::Round($frontendSize, 1)) MB" -ForegroundColor Gray
Write-Host "  - Backend:  $([math]::Round($backendSize, 1)) MB" -ForegroundColor Gray
Write-Host "  - Python:   $([math]::Round($pythonSize, 1)) MB" -ForegroundColor Gray
Write-Host ""
Write-Host "Contenuto:" -ForegroundColor Yellow
Get-ChildItem -Path "distribution" -Recurse | ForEach-Object {
    $relativePath = $_.FullName.Replace((Get-Location).Path + "\distribution\", "")
    Write-Host "  - $relativePath"
}
Write-Host ""
Write-Host "Istruzioni:" -ForegroundColor Yellow
Write-Host "1. Comprimi la cartella 'distribution' in uno ZIP"
Write-Host "2. Condividi lo ZIP con i colleghi"
Write-Host "3. I colleghi devono estrarre e eseguire setup.ps1"
Write-Host ""
Write-Host "NOTA: I colleghi devono avere il codice CategorizationEnginePython" -ForegroundColor Yellow
Write-Host "      sul proprio PC per usare la Test Suite." -ForegroundColor Yellow
Write-Host ""
Read-Host "Premi INVIO per chiudere"
