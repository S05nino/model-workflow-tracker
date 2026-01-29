"""
TestSuite API Backend
Exposes REST endpoints for the React frontend to run ML model tests
"""
import os
import sys
import glob
import shutil
import datetime
from pathlib import Path
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Add ce_python to path (CategorizationEnginePython code)
# Support both structures:
# 1. ce_python/CategorizationEnginePython/... (user copied the folder)
# 2. ce_python/CategorizationEngineTests/... (user copied contents)
CE_PYTHON_PATH = os.environ.get("CE_PYTHON_PATH", "/app/ce_python")

# Check if CategorizationEnginePython subfolder exists
if os.path.isdir(os.path.join(CE_PYTHON_PATH, "CategorizationEnginePython")):
    CE_PYTHON_PATH = os.path.join(CE_PYTHON_PATH, "CategorizationEnginePython")

sys.path.append(CE_PYTHON_PATH)
sys.path.append(os.path.join(CE_PYTHON_PATH, "CategorizationEngineTests", "CETestSuite"))

# Import TestRunner modules (will fail gracefully if not present)
try:
    from suite_tests.testRunner import TestRunner
    from suite_tests.testRunner_tagger import TestRunner as TestRunnerTagger
    TESTRUNNER_AVAILABLE = True
except ImportError as e:
    print(f"Warning: TestRunner not available: {e}")
    TESTRUNNER_AVAILABLE = False

app = FastAPI(title="TestSuite API", version="1.0.0")

# CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration from environment
ROOT_FOLDER = os.environ.get("TEST_SUITE_PATH", "/data/TEST_SUITE")
AZURE_BATCH_VM_PATH = os.environ.get("AZURE_BATCH_VM_PATH", "/app/azure_batch")
BATCH_DATA_PATH = os.environ.get("BATCH_DATA_PATH", "/app/ce_python/CategorizationEngineTests/CETestSuite/data/batch")

# Azure configuration
AZURE_BATCH = os.environ.get("AZURE_BATCH", "true").lower() == "true"
SERVICE_PRINCIPAL_CERT_THUMBPRINT = os.environ.get(
    "SERVICE_PRINCIPAL_CERT_THUMBPRINT", 
    "D0E4EB9FB0506DEF78ECF1283319760E980C1736"
)
SERVICE_PRINCIPAL_APP_ID = os.environ.get(
    "SERVICE_PRINCIPAL_APP_ID",
    "5fd0a365-b1c7-48c4-ba16-bdc211ddad84"
)


# --- Pydantic Models ---

class FileInfo(BaseModel):
    name: str
    path: str
    is_directory: bool


class CountryInfo(BaseModel):
    code: str
    segments: List[str]


class ModelFiles(BaseModel):
    prod_models: List[str]
    dev_models: List[str]
    expert_rules_old: List[str]
    expert_rules_new: List[str]
    has_old_new_folders: bool


class TaggerFiles(BaseModel):
    models: List[str]
    company_lists: List[str]
    distribution_files: List[str]


class SampleFiles(BaseModel):
    tsv_files: List[str]


class RunTestRequest(BaseModel):
    country: str
    segment: str
    version: str
    old_model: str
    new_model: str
    old_expert_rules: Optional[str] = None
    new_expert_rules: Optional[str] = None
    accuracy_files: List[str] = []
    anomalies_files: List[str] = []
    precision_files: List[str] = []
    stability_files: List[str] = []
    vm_bench: int = 1
    vm_dev: int = 2


class RunTaggerTestRequest(BaseModel):
    country: str
    version: str
    old_model: str
    new_model: str
    company_list: str
    distribution_data: str
    vm_bench: int = 1
    vm_dev: int = 2


class TestResult(BaseModel):
    success: bool
    message: str
    output_folder: Optional[str] = None
    report_path: Optional[str] = None


# --- Helper Functions ---

def safe_listdir(path: str) -> List[str]:
    """Safely list directory contents"""
    if os.path.isdir(path):
        return sorted(os.listdir(path))
    return []


def copy_latest_outputs(output_folder: str, segment: str, report_type: str,
                        country_code: str, model_name: str, date_str: str) -> List[str]:
    """Copy output files to the output folder"""
    messages = {
        "ACC": "Accuracy",
        "ANOM": "Anomalie",
        "PREC": "Precision",
        "STAB": "Stabilità"
    }
    suffix_map = {
        "ACC": "_ACC.xlsx",
        "ANOM": "_ANOM.xlsx",
        "PREC": "_PREC.xlsx",
        "STAB": "_STAB.xlsx"
    }
    suffix = suffix_map.get(report_type, "")
    copied_files = []

    # Determine IN/OUT
    value = "OUT"
    try:
        parts = model_name.split("_")
        idx = parts.index(country_code) + 1
        if parts[idx] == "1":
            value = "IN"
    except Exception:
        pass

    # Copy report files
    for root, dirs, files in os.walk(output_folder):
        if root != output_folder:
            for f in files:
                if suffix and f.endswith(suffix):
                    src = os.path.join(root, f)
                    new_name = f"report_{messages[report_type]}_{country_code}_CE_{segment}_{value}_{date_str}.xlsx"
                    dst = os.path.join(output_folder, new_name)
                    try:
                        shutil.copy2(src, dst)
                        copied_files.append(new_name)
                    except Exception:
                        pass

    # Copy batch files
    pattern = "*categorized.csv" if segment in ["Consumer", "Business"] else "*tagged.csv"
    files = glob.glob(os.path.join(BATCH_DATA_PATH, pattern))
    if files:
        latest = max(files, key=os.path.getmtime)
        new_batch_name = f"{messages[report_type]}_{country_code}_CE_{segment}_{value}_{date_str}.csv"
        dst = os.path.join(output_folder, new_batch_name)
        try:
            shutil.copy2(latest, dst)
            copied_files.append(new_batch_name)
        except Exception:
            pass

    return copied_files


# --- API Endpoints ---

@app.get("/api/testsuite/status")
def get_status():
    """Check if TestRunner is available"""
    return {
        "testrunner_available": TESTRUNNER_AVAILABLE,
        "root_folder": ROOT_FOLDER,
        "root_exists": os.path.exists(ROOT_FOLDER),
        "azure_batch": AZURE_BATCH
    }


@app.get("/api/testsuite/countries", response_model=List[CountryInfo])
def get_countries():
    """List available countries"""
    countries = []
    for c in safe_listdir(ROOT_FOLDER):
        country_path = os.path.join(ROOT_FOLDER, c)
        if os.path.isdir(country_path):
            segments = []
            for seg in ["Consumer", "Business", "Tagger"]:
                if os.path.isdir(os.path.join(country_path, seg)):
                    segments.append(seg)
            if segments:
                countries.append(CountryInfo(code=c, segments=segments))
    return countries


@app.get("/api/testsuite/{country}/{segment}/models", response_model=ModelFiles)
def get_model_files(country: str, segment: str):
    """Get available model files for a country/segment"""
    segment_path = os.path.join(ROOT_FOLDER, country, segment)
    model_path = os.path.join(segment_path, "model")
    
    if not os.path.isdir(segment_path):
        raise HTTPException(status_code=404, detail=f"Segment path not found: {segment_path}")

    # Expert rules paths
    expertrules_path = os.path.join(model_path, "expertrules")
    expert_old_path = os.path.join(expertrules_path, "old")
    expert_new_path = os.path.join(expertrules_path, "new")
    
    has_old_new = os.path.isdir(expert_old_path) and os.path.isdir(expert_new_path)
    
    if has_old_new:
        expert_old_files = [f for f in safe_listdir(expert_old_path) if f.endswith(".zip")]
        expert_new_files = [f for f in safe_listdir(expert_new_path) if f.endswith(".zip")]
    else:
        expert_files = [f for f in safe_listdir(expertrules_path) if f.endswith(".zip")]
        expert_old_files = expert_files
        expert_new_files = expert_files

    # Model paths
    prod_path = os.path.join(model_path, "prod")
    dev_path = os.path.join(model_path, "develop")
    
    return ModelFiles(
        prod_models=[f for f in safe_listdir(prod_path) if f.endswith(".zip")],
        dev_models=[f for f in safe_listdir(dev_path) if f.endswith(".zip")],
        expert_rules_old=expert_old_files,
        expert_rules_new=expert_new_files,
        has_old_new_folders=has_old_new
    )


@app.get("/api/testsuite/{country}/Tagger/files", response_model=TaggerFiles)
def get_tagger_files(country: str):
    """Get available files for Tagger segment"""
    segment_path = os.path.join(ROOT_FOLDER, country, "Tagger")
    model_path = os.path.join(segment_path, "model")
    sample_path = os.path.join(segment_path, "sample")
    
    if not os.path.isdir(segment_path):
        raise HTTPException(status_code=404, detail=f"Tagger path not found")

    return TaggerFiles(
        models=[f for f in safe_listdir(model_path) if f.endswith(".zip")],
        company_lists=[f for f in safe_listdir(sample_path) if f.endswith("list_companies.xlsx")],
        distribution_files=[f for f in safe_listdir(sample_path) if f.endswith(".tsv.gz")]
    )


@app.get("/api/testsuite/{country}/{segment}/samples", response_model=SampleFiles)
def get_sample_files(country: str, segment: str):
    """Get available sample files"""
    sample_path = os.path.join(ROOT_FOLDER, country, segment, "sample")
    return SampleFiles(
        tsv_files=[f for f in safe_listdir(sample_path) if f.endswith(".tsv.gz")]
    )


@app.post("/api/testsuite/run", response_model=TestResult)
def run_tests(request: RunTestRequest):
    """Run Consumer/Business tests"""
    if not TESTRUNNER_AVAILABLE:
        raise HTTPException(status_code=503, detail="TestRunner not available")

    segment_path = os.path.join(ROOT_FOLDER, request.country, request.segment)
    model_path = os.path.join(segment_path, "model")
    sample_path = os.path.join(segment_path, "sample")
    
    # Determine expert rules paths
    expertrules_path = os.path.join(model_path, "expertrules")
    expert_old_path = os.path.join(expertrules_path, "old")
    expert_new_path = os.path.join(expertrules_path, "new")
    has_old_new = os.path.isdir(expert_old_path) and os.path.isdir(expert_new_path)

    if request.old_expert_rules:
        if has_old_new:
            old_expert_full = os.path.join(expert_old_path, request.old_expert_rules)
        else:
            old_expert_full = os.path.join(expertrules_path, request.old_expert_rules)
    else:
        old_expert_full = None

    if request.new_expert_rules:
        if has_old_new:
            new_expert_full = os.path.join(expert_new_path, request.new_expert_rules)
        else:
            new_expert_full = os.path.join(expertrules_path, request.new_expert_rules)
    else:
        new_expert_full = None

    # Model paths
    old_model_path = os.path.join(model_path, "prod", request.old_model)
    new_model_path = os.path.join(model_path, "develop", request.new_model)

    # Validate
    if not os.path.exists(old_model_path):
        raise HTTPException(status_code=400, detail=f"Old model not found: {request.old_model}")
    if not os.path.exists(new_model_path):
        raise HTTPException(status_code=400, detail=f"New model not found: {request.new_model}")

    if not any([request.accuracy_files, request.anomalies_files, 
                request.precision_files, request.stability_files]):
        raise HTTPException(status_code=400, detail="At least one input file required")

    # Create output folder
    today = datetime.date.today().strftime("%y%m%d")
    output_folder = os.path.join(segment_path, f"{request.version}_{today}")
    os.makedirs(output_folder, exist_ok=True)

    try:
        # Initialize runner
        runner = TestRunner(
            old_model_path,
            new_model_path,
            output_folder,
            old_expert_full,
            new_expert_full
        )

        # Crossvalidation
        runner.compute_crossvalidation_score(
            old_expert_rules_zip_path=old_expert_full,
            new_expert_rules_zip_path=new_expert_full,
            save=True
        )

        # Accuracy tests
        for i, f in enumerate(request.accuracy_files, start=1):
            tag = f"A_{i}"
            runner.compute_validation_scores(
                os.path.join(sample_path, f),
                save=True,
                tag=tag,
                azure_batch=AZURE_BATCH,
                azure_batch_vm_path=AZURE_BATCH_VM_PATH,
                old_expert_rules_zip_path=old_expert_full,
                new_expert_rules_zip_path=new_expert_full,
                ServicePrincipal_CertificateThumbprint=SERVICE_PRINCIPAL_CERT_THUMBPRINT,
                ServicePrincipal_ApplicationId=SERVICE_PRINCIPAL_APP_ID,
                vm_for_bench=request.vm_bench,
                vm_for_dev=request.vm_dev
            )
            copy_latest_outputs(output_folder, request.segment, "ACC", 
                              request.country, request.new_model, today)

        # Anomalies tests
        for f in request.anomalies_files:
            runner.compute_validation_scores(
                os.path.join(sample_path, f),
                save=True,
                tag="ANOM",
                azure_batch=AZURE_BATCH,
                azure_batch_vm_path=AZURE_BATCH_VM_PATH,
                old_expert_rules_zip_path=old_expert_full,
                new_expert_rules_zip_path=new_expert_full,
                ServicePrincipal_CertificateThumbprint=SERVICE_PRINCIPAL_CERT_THUMBPRINT,
                ServicePrincipal_ApplicationId=SERVICE_PRINCIPAL_APP_ID,
                vm_for_bench=request.vm_bench,
                vm_for_dev=request.vm_dev
            )
            copy_latest_outputs(output_folder, request.segment, "ANOM",
                              request.country, request.new_model, today)

        # Precision tests
        for f in request.precision_files:
            runner.compute_validation_scores(
                os.path.join(sample_path, f),
                save=True,
                tag="PREC",
                azure_batch=AZURE_BATCH,
                azure_batch_vm_path=AZURE_BATCH_VM_PATH,
                old_expert_rules_zip_path=old_expert_full,
                new_expert_rules_zip_path=new_expert_full,
                ServicePrincipal_CertificateThumbprint=SERVICE_PRINCIPAL_CERT_THUMBPRINT,
                ServicePrincipal_ApplicationId=SERVICE_PRINCIPAL_APP_ID,
                vm_for_bench=request.vm_bench,
                vm_for_dev=request.vm_dev
            )
            copy_latest_outputs(output_folder, request.segment, "PREC",
                              request.country, request.new_model, today)

        # Stability tests
        for i, f in enumerate(request.stability_files, start=1):
            tag = f"S_{i}"
            runner.compute_validation_distribution(
                os.path.join(sample_path, f),
                save=True,
                tag=tag,
                azure_batch=AZURE_BATCH,
                azure_batch_vm_path=AZURE_BATCH_VM_PATH,
                old_expert_rules_zip_path=old_expert_full,
                new_expert_rules_zip_path=new_expert_full,
                ServicePrincipal_CertificateThumbprint=SERVICE_PRINCIPAL_CERT_THUMBPRINT,
                ServicePrincipal_ApplicationId=SERVICE_PRINCIPAL_APP_ID,
                vm_for_bench=request.vm_bench,
                vm_for_dev=request.vm_dev
            )
            copy_latest_outputs(output_folder, request.segment, "STAB",
                              request.country, request.new_model, today)

        # Save final reports
        runner.save_reports(weights=None, excel=True, pdf=False)

        # Get report path
        report_path = os.path.join(runner.output_folder, runner.old_uid,
                                   f"{runner.new_uid}_final_report_{runner.now}.xlsx")

        return TestResult(
            success=True,
            message="Tests completed successfully!",
            output_folder=output_folder,
            report_path=report_path if os.path.exists(report_path) else None
        )

    except Exception as e:
        return TestResult(
            success=False,
            message=f"Error running tests: {str(e)}",
            output_folder=output_folder
        )


@app.post("/api/testsuite/run-tagger", response_model=TestResult)
def run_tagger_tests(request: RunTaggerTestRequest):
    """Run Tagger tests"""
    if not TESTRUNNER_AVAILABLE:
        raise HTTPException(status_code=503, detail="TestRunner not available")

    segment_path = os.path.join(ROOT_FOLDER, request.country, "Tagger")
    model_path = os.path.join(segment_path, "model")
    sample_path = os.path.join(segment_path, "sample")

    old_model_path = os.path.join(model_path, request.old_model)
    new_model_path = os.path.join(model_path, request.new_model)
    company_list_path = os.path.join(sample_path, request.company_list)
    distribution_path = os.path.join(sample_path, request.distribution_data)

    # Validate
    if not os.path.exists(old_model_path):
        raise HTTPException(status_code=400, detail=f"Old model not found: {request.old_model}")
    if not os.path.exists(new_model_path):
        raise HTTPException(status_code=400, detail=f"New model not found: {request.new_model}")

    # Create output folder
    today = datetime.date.today().strftime("%y%m%d")
    output_folder = os.path.join(segment_path, f"{request.version}_{today}")
    os.makedirs(output_folder, exist_ok=True)

    try:
        runner = TestRunnerTagger(
            old_model_path,
            new_model_path,
            output_folder
        )

        # Crossvalidation
        runner.compute_tagger_crossvalidation_score(save=True)

        # Validation distribution
        runner.compute_tagger_validation_distribution(
            validation_data_path=distribution_path,
            save=True,
            azure_batch=AZURE_BATCH,
            azure_batch_vm_path=AZURE_BATCH_VM_PATH,
            path_list_companies=company_list_path,
            ServicePrincipal_CertificateThumbprint=SERVICE_PRINCIPAL_CERT_THUMBPRINT,
            ServicePrincipal_ApplicationId=SERVICE_PRINCIPAL_APP_ID,
            vm_for_bench=request.vm_bench,
            vm_for_dev=request.vm_dev
        )

        # Save reports
        runner.save_tagger_reports(excel=True)

        # Get report path
        report_path = os.path.join(runner.output_folder, runner.old_uid,
                                   f"{runner.new_uid}_final_report_{runner.now}.xlsx")

        return TestResult(
            success=True,
            message="Tagger tests completed successfully!",
            output_folder=output_folder,
            report_path=report_path if os.path.exists(report_path) else None
        )

    except Exception as e:
        return TestResult(
            success=False,
            message=f"Error running Tagger tests: {str(e)}",
            output_folder=output_folder
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3002)
