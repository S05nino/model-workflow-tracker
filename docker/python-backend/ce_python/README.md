# Placeholder for CategorizationEnginePython

This folder should contain the CategorizationEnginePython repository.

## Required Structure

```
ce_python/
├── CategorizationEngineTests/
│   └── CETestSuite/
│       └── suite_tests/
│           ├── testRunner.py
│           └── testRunner_tagger.py
└── ... (other files from the repository)
```

## Setup Instructions

1. Clone or copy the CategorizationEnginePython repository here
2. The backend will automatically import TestRunner and TestRunnerTagger
3. If the modules are not found, the API will return `testrunner_available: false`
