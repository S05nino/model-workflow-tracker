# Python Backend for TestSuite

This backend provides REST APIs for running ML model tests from the React dashboard.

## Setup

### 1. Copy CategorizationEnginePython

Copy the entire `CategorizationEnginePython` repository into this folder as `ce_python/`:

```
docker/python-backend/
├── ce_python/                    <- Copy CategorizationEnginePython here
│   ├── CategorizationEngineTests/
│   │   └── CETestSuite/
│   │       └── suite_tests/
│   │           ├── testRunner.py
│   │           └── testRunner_tagger.py
│   └── ...
├── main.py
├── requirements.txt
└── Dockerfile.python
```

### 2. Create TEST_SUITE folder structure

Create a local copy of the network share structure:

```
C:\Users\<username>\OneDrive - CRIF SpA\CE\TEST_SUITE\
├── AT/
│   └── Consumer/
│       ├── model/
│       │   ├── prod/          <- .zip model files
│       │   ├── develop/       <- .zip model files
│       │   └── expertrules/
│       │       ├── old/       <- .zip rule files (optional)
│       │       └── new/       <- .zip rule files (optional)
│       └── sample/            <- .tsv.gz input files
├── DE/
│   ├── Consumer/
│   ├── Business/
│   └── Tagger/
│       ├── model/             <- .zip model files
│       └── sample/            <- .tsv.gz and list_companies.xlsx
└── ...
```

### 3. Azure Batch Tools (optional)

Copy Azure Batch tools to `azure_batch/` folder if you need Azure Batch execution.

## Building

The image is built as part of the main build process:

```powershell
.\build-distribution.ps1
```

## API Endpoints

- `GET /api/testsuite/status` - Check if TestRunner is available
- `GET /api/testsuite/countries` - List available countries
- `GET /api/testsuite/{country}/{segment}/models` - Get model files
- `GET /api/testsuite/{country}/{segment}/samples` - Get sample files
- `GET /api/testsuite/{country}/Tagger/files` - Get Tagger-specific files
- `POST /api/testsuite/run` - Run Consumer/Business tests
- `POST /api/testsuite/run-tagger` - Run Tagger tests
