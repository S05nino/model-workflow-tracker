# ML Workflow Dashboard - Setup Script
# Esegui questo script per configurare e avviare la dashboard

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ML Workflow Dashboard - Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verifica che Docker sia in esecuzione
Write-Host "Verifica Docker..." -ForegroundColor Yellow
$dockerRunning = docker info 2>$null
if (-not $?) {
    Write-Host "ERRORE: Docker non e' in esecuzione. Avvia Docker Desktop e riprova." -ForegroundColor Red
    Read-Host "Premi INVIO per uscire"
    exit 1
}
Write-Host "Docker OK!" -ForegroundColor Green

# Chiedi il nome utente Windows
Write-Host ""
Write-Host "Inserisci il tuo nome utente" -ForegroundColor Yellow
Write-Host "Esempio: se il tuo percorso e' C:\Users\xx0nomeutente\... inserisci: xx0nomeutente" -ForegroundColor Gray
Write-Host "Premi INVIO per usare l'utente corrente ($env:USERNAME)" -ForegroundColor Gray
$inputUsername = Read-Host "Nome utente"

# Usa l'utente corrente se non specificato
if ([string]::IsNullOrWhiteSpace($inputUsername)) {
    $inputUsername = $env:USERNAME
}

# Costruisci il percorso automaticamente
$dataFolder = "C:\Users\$inputUsername\OneDrive - CRIF SpA\CE"

Write-Host "Percorso utilizzato: $dataFolder" -ForegroundColor Cyan

# Verifica che il percorso esista
if (-not (Test-Path $dataFolder)) {
    Write-Host "ERRORE: Il percorso '$dataFolder' non esiste." -ForegroundColor Red
    Write-Host "Verifica che:" -ForegroundColor Yellow
    Write-Host "  1. Il nome utente sia corretto" -ForegroundColor Yellow
    Write-Host "  2. OneDrive sia configurato e sincronizzato" -ForegroundColor Yellow
    Write-Host "  3. La cartella 'CE' esista in OneDrive" -ForegroundColor Yellow
    Read-Host "Premi INVIO per uscire"
    exit 1
}

# Verifica che data.json esista, altrimenti lo crea
$dataFile = Join-Path $dataFolder "data.json"
if (-not (Test-Path $dataFile)) {
    Write-Host "File data.json non trovato. Creazione file iniziale..." -ForegroundColor Yellow
    $initialData = @{
        projects = @()
        releases = @()
        release_models = @()
        app_config = @(
            @{
                key = "shared_password"
                value = "workflow2024"
            },
            @{
                key = "countries"
                value = '[{"code":"AT","name":"Austria","segments":["consumer"]},{"code":"BE","name":"Belgium","segments":["consumer","business"]},{"code":"CZ","name":"Czech Republic","segments":["consumer","business"]},{"code":"DE","name":"Germany","segments":["consumer","business","tagger"]},{"code":"ES","name":"Spain","segments":["consumer","business","tagger"]},{"code":"FR","name":"France","segments":["consumer","business","tagger"]},{"code":"GB","name":"United Kingdom","segments":["consumer","business","tagger"]},{"code":"IN","name":"India","segments":["consumer","business","tagger"]},{"code":"IE","name":"Ireland","segments":["consumer","business"]},{"code":"IT","name":"Italy","segments":["consumer","business","tagger"]},{"code":"IT2","name":"Italy2","segments":["consumer","business"]},{"code":"MX","name":"Mexico","segments":["consumer","tagger"]},{"code":"PL","name":"Poland","segments":["consumer","business"]},{"code":"PT","name":"Portugal","segments":["consumer","business"]},{"code":"US","name":"United States","segments":["consumer"]}]'
            }
        )
    } | ConvertTo-Json -Depth 10
    $initialData | Out-File -FilePath $dataFile -Encoding UTF8
    Write-Host "File data.json creato!" -ForegroundColor Green
}

Write-Host "Percorso dati OK!" -ForegroundColor Green

# Importa le immagini Docker se presenti
$frontendImage = Join-Path $PSScriptRoot "images\frontend.tar"
$backendImage = Join-Path $PSScriptRoot "images\backend.tar"

if (Test-Path $frontendImage) {
    Write-Host ""
    Write-Host "Importazione immagine frontend..." -ForegroundColor Yellow
    docker load -i $frontendImage
    Write-Host "Frontend importato!" -ForegroundColor Green
} else {
    Write-Host "ERRORE: Immagine frontend.tar non trovata in 'images\'" -ForegroundColor Red
    Read-Host "Premi INVIO per uscire"
    exit 1
}

if (Test-Path $backendImage) {
    Write-Host "Importazione immagine backend..." -ForegroundColor Yellow
    docker load -i $backendImage
    Write-Host "Backend importato!" -ForegroundColor Green
} else {
    Write-Host "ERRORE: Immagine backend.tar non trovata in 'images\'" -ForegroundColor Red
    Read-Host "Premi INVIO per uscire"
    exit 1
}

# Salva il percorso in un file .env per docker-compose
$envFile = Join-Path $PSScriptRoot ".env"
"DATA_FOLDER=$dataFolder" | Out-File -FilePath $envFile -Encoding UTF8

# Avvia i container
Write-Host ""
Write-Host "Avvio container Docker..." -ForegroundColor Yellow
Set-Location $PSScriptRoot
docker compose down 2>$null
docker compose up -d

if ($?) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  Dashboard avviata con successo!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Apri il browser e vai su: http://localhost:8080" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Per fermare la dashboard: docker compose down" -ForegroundColor Gray
    Write-Host "Per riavviare: docker compose up -d" -ForegroundColor Gray
} else {
    Write-Host "ERRORE durante l'avvio dei container." -ForegroundColor Red
}

Write-Host ""
Read-Host "Premi INVIO per chiudere"
