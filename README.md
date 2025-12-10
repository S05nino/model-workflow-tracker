# ML Workflow Tracker

Dashboard per la gestione del workflow di fine-tuning di modelli ML multi-paese.

## Panoramica

Questa applicazione permette di tracciare e gestire il processo di fine-tuning dei modelli ML per diversi paesi e segmenti. Include:

- **Gestione Progetti**: Tracciamento dello stato di avanzamento per ogni paese/segmento
- **Gestione Rilasci**: Organizzazione dei modelli confermati per versione di rilascio
- **Export Report**: Generazione di report Excel completi per la condivisione con il team

## Requisiti

- Node.js 18+ 
- npm o bun

## Installazione

```bash
# Clona il repository
git clone <YOUR_GIT_URL>

# Entra nella directory del progetto
cd <YOUR_PROJECT_NAME>

# Installa le dipendenze
npm install
# oppure
bun install
```

## Avvio

```bash
# Avvia il server di sviluppo
npm run dev
# oppure
bun dev
```

L'applicazione sarà disponibile su `http://localhost:5173`

## Utilizzo

### Tab Progetti

#### Creare un nuovo progetto
1. Clicca sul pulsante **"Nuovo Progetto"** in alto a destra
2. Seleziona il **Paese** dal menu dropdown
3. Seleziona il **Segmento** (Consumer, Business, Tagger)
4. Seleziona il **Tipo di Test** (Categorizzazione, Test Suite, Tagging)
5. Clicca **"Crea Progetto"**

#### Workflow Steps
Ogni progetto attraversa 5 step:
1. **Ricezione Info** - Ricezione informazioni dal team
2. **Generazione Modelli** - Generazione dei modelli ML
3. **TestSuite** - Esecuzione test suite / categorizzazione / tagging
4. **Upload ZIP** - Creazione e upload ZIP sul server condiviso
5. **Output Inviato** - Output inviato al team

#### Gestire un progetto
- Usa i pulsanti **freccia** per avanzare/tornare indietro negli step
- Clicca **"Nuovo Giro"** per iniziare un nuovo round iterativo
- Clicca **"Conferma Modello"** quando il modello è approvato
- Usa il menu **⋮** per cambiare stato o eliminare il progetto

#### Filtri
Usa la barra filtri per visualizzare progetti per:
- **Stato**: In Corso, In Attesa, In Pausa
- **Paese**: Filtra per singolo paese

### Tab Rilasci

#### Creare un nuovo rilascio
1. Clicca su **"Nuovo Rilascio"**
2. Inserisci la **Versione** (es. 7.6.6)
3. Seleziona la **Data Target** di scadenza
4. Seleziona i **Modelli** da includere (paese + segmento)
5. Clicca **"Crea Rilascio"**

#### Gestire un rilascio
- **Includi/Escludi modelli**: Usa il toggle per includere o escludere un modello dal rilascio
- **Conferma modello**: Clicca sul pulsante di conferma e inserisci gli ID:
  - Model Out ID
  - Model In ID
  - Rules Out ID
  - Rules In ID
  (non tutti sono obbligatori)
- **Completa rilascio**: Quando tutti i modelli sono confermati, clicca "Completa Rilascio"

I rilasci sono ordinati per scadenza (il più vicino in primo).

### Export Report Excel

1. Clicca sul pulsante **"Esporta Report"** nell'header
2. Verrà scaricato un file Excel con 5 fogli:
   - **Riepilogo**: Statistiche generali
   - **Progetti Attivi**: Lista progetti in corso
   - **Progetti Completati**: Storico progetti completati
   - **Rilasci Attivi**: Dettaglio rilasci in corso con tutti gli ID
   - **Rilasci Completati**: Storico rilasci completati

## Paesi Supportati

| Codice | Paese | Segmenti Disponibili |
|--------|-------|---------------------|
| AUT | Austria | Consumer |
| BEL | Belgio | Consumer, Business |
| CZK | Rep. Ceca | Consumer, Business |
| DEU | Germania | Consumer, Business, Tagger |
| ESP | Spagna | Consumer, Business, Tagger |
| FRA | Francia | Consumer, Business, Tagger |
| GBR | Regno Unito | Consumer, Business, Tagger |
| IND | India | Consumer, Business, Tagger |
| IRL | Irlanda | Consumer, Business |
| ITA | Italia | Consumer, Business, Tagger |
| ITA2 | Italia 2 | Consumer, Business |
| MEX | Messico | Tagger |
| POL | Polonia | Consumer |
| POR | Portogallo | Consumer |
| USA | USA | Consumer |

## Tipi di Test per Segmento

- **Consumer / Business**: Categorizzazione, Test Suite
- **Tagger**: Tagging, Test Suite

## Persistenza Dati

I dati sono salvati nel `localStorage` del browser. Per condividere lo stato con i colleghi, usa la funzione **Export Report**.

## Tecnologie

- **React** + **TypeScript**
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **shadcn/ui** - Componenti UI
- **date-fns** - Gestione date
- **xlsx** - Generazione Excel
- **Lucide React** - Icone

## Build per Produzione

```bash
npm run build
# oppure
bun run build
```

I file di output saranno nella cartella `dist/`.
