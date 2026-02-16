# Lambda TestSuite Runner

Questa Lambda sostituisce `dashboard.py` (Streamlit) per l'esecuzione automatica della Test Suite.

## Architettura

```
Dashboard TSX → Edge Function (run-testsuite) → AWS Lambda → Azure Batch VMs
                                                    ↕
                                                 S3 Bucket
```

## Prerequisiti

1. **CategorizationEnginePython**: Copia la directory `CategorizationEnginePython` nella cartella `lambda/` prima del build
2. **AWS ECR**: Un repository ECR per l'immagine Docker
3. **AWS IAM Role**: Con permessi per S3 (read/write sul bucket) e CloudWatch Logs

## Build & Deploy

```bash
cd lambda/

# Copia CategorizationEnginePython nella cartella lambda
cp -r /path/to/CategorizationEnginePython ./CategorizationEnginePython

# Build Docker image
docker build -t testsuite-runner .

# Tag e push su ECR
aws ecr get-login-password --region eu-west-1 | docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.eu-west-1.amazonaws.com
docker tag testsuite-runner:latest <ACCOUNT_ID>.dkr.ecr.eu-west-1.amazonaws.com/testsuite-runner:latest
docker push <ACCOUNT_ID>.dkr.ecr.eu-west-1.amazonaws.com/testsuite-runner:latest

# Crea/aggiorna la Lambda
aws lambda create-function \
  --function-name testsuite-runner \
  --package-type Image \
  --code ImageUri=<ACCOUNT_ID>.dkr.ecr.eu-west-1.amazonaws.com/testsuite-runner:latest \
  --role arn:aws:iam::<ACCOUNT_ID>:role/lambda-testsuite-role \
  --timeout 900 \
  --memory-size 3008 \
  --environment "Variables={S3_BUCKET=s3-crif-studio-wwcc1mnt-de-prd-datalake,S3_PREFIX=CategorizationEngineTestSuite/TEST_SUITE/}"
```

## Variabili d'Ambiente Lambda

| Variabile | Valore |
|-----------|--------|
| `S3_BUCKET` | `s3-crif-studio-wwcc1mnt-de-prd-datalake` |
| `S3_PREFIX` | `CategorizationEngineTestSuite/TEST_SUITE/` |

## IAM Policy (minima)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::s3-crif-studio-wwcc1mnt-de-prd-datalake",
        "arn:aws:s3:::s3-crif-studio-wwcc1mnt-de-prd-datalake/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": "logs:*",
      "Resource": "*"
    }
  ]
}
```

## Timeout

La Lambda è configurata con timeout di 15 minuti (massimo). Se i test richiedono più tempo, considera l'uso di **ECS Fargate** al posto di Lambda:

1. Cambia l'edge function `run-testsuite` per usare `ECSClient` + `RunTaskCommand` invece di `LambdaClient`
2. Usa lo stesso Dockerfile ma come task ECS
3. Nessun limite di timeout

## Flow

1. L'utente clicca "Run Tests" nella dashboard
2. L'edge function `run-testsuite` invoca la Lambda in modo asincrono
3. La Lambda scarica modelli e sample da S3 in `/tmp`
4. Esegue il TestRunner che usa Azure Batch VMs
5. Carica i risultati (report Excel) su S3 nella cartella output
6. La dashboard TSX rileva i nuovi file tramite polling e li visualizza
