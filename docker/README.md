# ML Workflow Dashboard - Docker Setup

Questa guida spiega come eseguire la dashboard ML Workflow in locale usando Docker, con i dati condivisi tramite OneDrive.

## Prerequisiti

- Docker Desktop installato
- OneDrive configurato e sincronizzato

## Configurazione

### 1. Configura la cartella dati condivisa

Crea una cartella su OneDrive per i dati condivisi:
```
OneDrive/ML-Workflow-Data/
```

### 2. Modifica docker-compose.yml

Aggiorna il percorso del volume nel file `docker-compose.yml` per puntare alla tua cartella OneDrive:

**Windows:**
```yaml
volumes:
  - C:/Users/TUO_USERNAME/OneDrive/ML-Workflow-Data:/data
```

**Mac:**
```yaml
volumes:
  - /Users/TUO_USERNAME/OneDrive/ML-Workflow-Data:/data
```

**Linux:**
```yaml
volumes:
  - /home/TUO_USERNAME/OneDrive/ML-Workflow-Data:/data
```

### 3. Avvia i container

```bash
# Dalla cartella principale del progetto
docker-compose up -d
```

### 4. Accedi alla dashboard

Apri il browser e vai su: **http://localhost:8080**

## Comandi utili

```bash
# Avvia i container
docker-compose up -d

# Ferma i container
docker-compose down

# Visualizza i log
docker-compose logs -f

# Ricostruisci dopo modifiche
docker-compose up -d --build
```

## Struttura dei dati

Il file `data.json` viene creato automaticamente al primo avvio e contiene:

```json
{
  "projects": [],
  "releases": [],
  "release_models": [],
  "app_config": []
}
```

## Sincronizzazione OneDrive

- I dati vengono salvati immediatamente nel file JSON
- OneDrive sincronizza automaticamente le modifiche
- Ogni collega vedrà i dati aggiornati al refresh della pagina

⚠️ **Nota importante**: OneDrive potrebbe impiegare qualche secondo per sincronizzare. Evitate modifiche simultanee allo stesso record per prevenire conflitti.

## Risoluzione problemi

### La dashboard non si carica
- Verifica che Docker sia in esecuzione
- Controlla i log: `docker-compose logs frontend`

### I dati non si salvano
- Verifica i permessi sulla cartella OneDrive
- Controlla i log: `docker-compose logs backend`

### Conflitti di sincronizzazione
- OneDrive potrebbe creare file "conflitto". In caso, mantieni la versione più recente.
