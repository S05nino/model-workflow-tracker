# Test Suite Python Backend

Questo container espone le API REST per eseguire la Test Suite ML.

## Struttura richiesta

Per far funzionare la Test Suite, devi copiare il codice Python nella cartella:

```
docker/ce_python/CategorizationEnginePython/
├── CategorizationEngine_release/
│   ├── Classifier/
│   ├── Commons/
│   ├── Taxonomy/
│   └── Trainer/
└── CategorizationEngineTests/
    └── CETestSuite/
        ├── data/
        ├── suite_tests/
        │   ├── testRunner.py
        │   └── testRunner_tagger.py
        └── utils/
```

## API Endpoints

### Health Check
```
GET /health
```
Verifica che il backend sia online e che il codice Python sia disponibile.

### Lista Countries
```
GET /api/testsuite/countries
```
Restituisce la lista dei paesi disponibili nella cartella TEST_SUITE.

### Lista Segments
```
GET /api/testsuite/segments/{country}
```
Restituisce i segmenti disponibili per un paese (Consumer, Business, Tagger).

### Lista Files
```
GET /api/testsuite/files/{country}/{segment}
```
Restituisce i file disponibili (modelli, sample, expert rules) per un paese/segmento.

### Esegui Test Consumer/Business
```
POST /api/testsuite/run/consumer-business
Content-Type: application/json

{
  "country": "ITA",
  "segment": "Consumer",
  "version": "1.0.0",
  "old_model": "model_old.zip",
  "new_model": "model_new.zip",
  "old_expert_rules": "rules_old.zip",
  "new_expert_rules": "rules_new.zip",
  "accuracy_files": ["file1.tsv.gz", "file2.tsv.gz"],
  "anomalies_files": [],
  "precision_files": [],
  "stability_files": [],
  "vm_bench": 1,
  "vm_dev": 2
}
```

### Esegui Test Tagger
```
POST /api/testsuite/run/tagger
Content-Type: application/json

{
  "country": "ITA",
  "segment": "Tagger",
  "version": "1.0.0",
  "old_model": "model_old.zip",
  "new_model": "model_new.zip",
  "company_list": "list_companies.xlsx",
  "distribution_data": "data.tsv.gz",
  "vm_bench": 1,
  "vm_dev": 2
}
```

### Stato Test Run
```
GET /api/testsuite/status/{run_id}
```
Restituisce lo stato di un test run (pending, running, completed, failed).

### Lista Test Runs
```
GET /api/testsuite/runs
```
Restituisce la lista di tutti i test run.

## Volumi Docker

Il container richiede due volumi:
1. `/data/TEST_SUITE` - Cartella con i dati di test (da OneDrive)
2. `/app/CategorizationEnginePython` - Codice Python del progetto

## Variabili d'ambiente

- `TEST_SUITE_DATA_PATH` - Path della cartella TEST_SUITE (default: `/data/TEST_SUITE`)
- `AZURE_BATCH_VM_PATH` - Path del batch Azure
- `CERT_THUMBPRINT` - Thumbprint del certificato
- `APP_ID` - Application ID per Azure
