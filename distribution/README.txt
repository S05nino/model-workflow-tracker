========================================
  ML WORKFLOW DASHBOARD - GUIDA RAPIDA
========================================

PREREQUISITI:
- Docker Desktop installato e in esecuzione
- Accesso alla cartella OneDrive condivisa con data.json

PRIMO AVVIO:
1. Doppio click su "setup.ps1"
2. Lo script rileva automaticamente il tuo utente Windows
3. Attendi il completamento
4. Apri il browser su http://localhost:8080

AVVII SUCCESSIVI:
- Doppio click su "start.ps1"

PER FERMARE:
- Doppio click su "stop.ps1"
- Oppure: docker compose down (da terminale)

STRUTTURA CARTELLA:
- setup.ps1    = Primo setup (esegui solo la prima volta)
- start.ps1    = Avvia la dashboard
- stop.ps1     = Ferma la dashboard
- images/      = Immagini Docker pre-compilate

NOTE:
- I dati sono salvati nel file data.json su OneDrive
- Le modifiche si sincronizzano automaticamente tra colleghi
- Evitate modifiche simultanee allo stesso record

PROBLEMI?
- Verifica che Docker Desktop sia in esecuzione
- Verifica il percorso OneDrive sia corretto
- Controlla i log: docker compose logs
