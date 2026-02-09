"""
FastAPI server that wraps the TestRunner for ML model testing.
This server exposes REST APIs that the frontend can call to execute tests.
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict
import os
import sys
import json
import datetime
import traceback
import glob

# Add the CategorizationEnginePython paths
CE_PYTHON_PATH = "/app/CategorizationEnginePython"
CE_TESTS_PATH = os.path.join(CE_PYTHON_PATH, "CategorizationEngineTests", "CETestSuite")

sys.path.insert(0, CE_PYTHON_PATH)
sys.path.insert(0, CE_TESTS_PATH)

# --- Monkey-patch: fix Windows-only path parsing in multiple library classes ---
# Classes like MetricTrainTest and MetricValidationTestScore use path.split('\\')
# to extract model folder names, which fails on Linux/Docker.
# We patch all such classes with a generic wrapper.
import builtins

def _make_patched_init(orig_init, class_name):
    """Create a patched __init__ that converts paths to backslash for parsing,
    while patching all I/O functions to normalize back to forward slash."""
    def _patched_init(self, old_model_path, new_model_path, output_folder, *args, **kwargs):
        old_bs = old_model_path.replace('/', '\\') if old_model_path else old_model_path
        new_bs = new_model_path.replace('/', '\\') if new_model_path else new_model_path
        out_bs = output_folder.replace('/', '\\') if output_folder else output_folder

        def _fix(p):
            return p.replace('\\', '/') if isinstance(p, str) else p

        _real_chdir = os.chdir
        _real_isdir = os.path.isdir
        _real_exists = os.path.exists
        _real_isfile = os.path.isfile
        _real_listdir = os.listdir
        _real_makedirs = os.makedirs
        _real_join = os.path.join
        _real_open = builtins.open

        os.chdir = lambda p: _real_chdir(_fix(p))
        os.path.isdir = lambda p: _real_isdir(_fix(p))
        os.path.exists = lambda p: _real_exists(_fix(p))
        os.path.isfile = lambda p: _real_isfile(_fix(p))
        os.listdir = lambda p: _real_listdir(_fix(p))
        os.makedirs = lambda p, **kw: _real_makedirs(_fix(p), **kw)
        os.path.join = lambda *parts: _real_join(*[_fix(p) for p in parts])
        builtins.open = lambda f, *a, **kw: _real_open(_fix(f), *a, **kw)

        print(f"[PATCH] Calling {class_name} with backslash paths for parsing")
        try:
            orig_init(self, old_bs, new_bs, out_bs, *args, **kwargs)
        finally:
            os.chdir = _real_chdir
            os.path.isdir = _real_isdir
            os.path.exists = _real_exists
            os.path.isfile = _real_isfile
            os.listdir = _real_listdir
            os.makedirs = _real_makedirs
            os.path.join = _real_join
            builtins.open = _real_open

        self.old_model_path = old_model_path
        self.new_model_path = new_model_path
        self.output_folder = output_folder
        print(f"[PATCH] {class_name} init complete, Linux paths restored")
    return _patched_init

# Patch MetricTrainTest
try:
    from suite_tests import MetricTrainTest as _MTT
    _MTT.MetricTrainTest.__init__ = _make_patched_init(_MTT.MetricTrainTest.__init__, "MetricTrainTest")
    print("[PATCH] MetricTrainTest.__init__ patched for Linux path compatibility")
except Exception as e:
    print(f"[PATCH] Warning: Could not patch MetricTrainTest: {e}")

# Patch MetricValidationTestScore
try:
    from suite_tests import MetricValidationTestScore as _MVTS
    _MVTS.MetricValidationTestScore.__init__ = _make_patched_init(_MVTS.MetricValidationTestScore.__init__, "MetricValidationTestScore")
    print("[PATCH] MetricValidationTestScore.__init__ patched for Linux path compatibility")
except Exception as e:
    print(f"[PATCH] Warning: Could not patch MetricValidationTestScore: {e}")

app = FastAPI(title="CE Test Suite API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Data path for test suite files (mounted volume)
DATA_ROOT = os.environ.get("TEST_SUITE_DATA_PATH", "/data/TEST_SUITE")

# Azure Batch settings (can be overridden via environment)
AZURE_BATCH_VM_PATH = os.environ.get(
    "AZURE_BATCH_VM_PATH",
    r"C:\Users\kq5simmarine\AppData\Local\Categorization.Classifier.NoJWT\Utils\Categorization.Classifier.Batch.AzureDataScience"
)
CERT_THUMBPRINT = os.environ.get("CERT_THUMBPRINT", "D0E4EB9FB0506DEF78ECF1283319760E980C1736")
APP_ID = os.environ.get("APP_ID", "5fd0a365-b1c7-48c4-ba16-bdc211ddad84")

# Store running tests status
test_runs = {}


class TestConfigBase(BaseModel):
    country: str
    segment: str  # Consumer, Business, Tagger
    version: str
    old_model: str
    new_model: str
    vm_bench: int = 1
    vm_dev: int = 2
    azure_batch: bool = True


class ConsumerBusinessConfig(TestConfigBase):
    old_expert_rules: Optional[str] = None
    new_expert_rules: Optional[str] = None
    accuracy_files: List[str] = []
    anomalies_files: List[str] = []
    precision_files: List[str] = []
    stability_files: List[str] = []


class TaggerConfig(TestConfigBase):
    company_list: str
    distribution_data: str


class TestRunResponse(BaseModel):
    run_id: str
    status: str
    message: str


class TestStatusResponse(BaseModel):
    run_id: str
    status: str  # pending, running, completed, failed
    progress: Optional[int] = None
    message: Optional[str] = None
    result: Optional[dict] = None
    error_traceback: Optional[str] = None


@app.get("/health")
def health_check():
    """Health check endpoint"""
    ce_available = os.path.exists(CE_TESTS_PATH)
    data_available = os.path.exists(DATA_ROOT)
    
    return {
        "status": "ok",
        "ce_python_available": ce_available,
        "ce_python_path": CE_TESTS_PATH,
        "data_available": data_available,
        "data_root": DATA_ROOT
    }


@app.get("/api/testsuite/countries")
def list_countries():
    """List available countries in the test suite folder"""
    if not os.path.exists(DATA_ROOT):
        return {"countries": [], "error": f"Data root not found: {DATA_ROOT}"}
    
    countries = [
        d for d in os.listdir(DATA_ROOT)
        if os.path.isdir(os.path.join(DATA_ROOT, d))
    ]
    return {"countries": sorted(countries)}


@app.get("/api/testsuite/segments/{country}")
def list_segments(country: str):
    """List available segments for a country (case-insensitive)"""
    country_path = os.path.join(DATA_ROOT, country)
    if not os.path.exists(country_path):
        raise HTTPException(status_code=404, detail=f"Country not found: {country}")
    
    # Map lowercase folder names to proper segment names
    segment_map = {
        "consumer": "Consumer",
        "business": "Business",
        "tagger": "Tagger"
    }
    
    segments = [
        segment_map.get(d.lower(), d)
        for d in os.listdir(country_path)
        if os.path.isdir(os.path.join(country_path, d)) and d.lower() in segment_map
    ]
    return {"segments": segments}


def find_segment_folder(country_path: str, segment: str) -> Optional[str]:
    """Find the actual folder name for a segment (case-insensitive)"""
    for d in os.listdir(country_path):
        if d.lower() == segment.lower():
            return d
    return None


def find_latest_date_folder(segment_path: str) -> Optional[str]:
    """Find the most recent date folder in a segment path.
    
    Looks for folders that contain 'model' subfolder (the date folders).
    Structure: country/segment/date_folder/model/
    """
    date_folders = []
    try:
        for d in os.listdir(segment_path):
            folder_path = os.path.join(segment_path, d)
            if os.path.isdir(folder_path):
                # Check if it looks like a date folder (contains model subfolder)
                if os.path.exists(os.path.join(folder_path, "model")):
                    date_folders.append(d)
        
        if date_folders:
            # Sort descending to get most recent
            date_folders.sort(reverse=True)
            return date_folders[0]
    except Exception as e:
        print(f"Error finding date folder in {segment_path}: {e}")
    return None


@app.get("/api/testsuite/files/{country}/{segment}")
def list_files(country: str, segment: str):
    """List available files for a country/segment combination.
    
    NEW Structure (sample inside date folder):
    country/segment/date_folder/sample/           <- input files (.tsv.gz)
    country/segment/date_folder/model/prod/       <- old models
    country/segment/date_folder/model/develop/    <- new models
    country/segment/date_folder/model/expertrules/  <- expert rules
    country/segment/date_folder/output/           <- output folder
    """
    country_path = os.path.join(DATA_ROOT, country)
    if not os.path.exists(country_path):
        # Return empty result instead of 404 to prevent frontend crash
        print(f"Country path not found: {country_path}")
        return {
            "sample_files": [],
            "prod_models": [],
            "dev_models": [],
            "expert_rules_old": [],
            "expert_rules_new": [],
            "tagger_models": [],
            "company_lists": [],
            "date_folder": None,
            "segment_folder": None,
            "error": f"Country folder not found: {country}"
        }
    
    # Find actual segment folder (case-insensitive)
    actual_segment = find_segment_folder(country_path, segment)
    if not actual_segment:
        print(f"Segment not found: {segment} in {country_path}")
        return {
            "sample_files": [],
            "prod_models": [],
            "dev_models": [],
            "expert_rules_old": [],
            "expert_rules_new": [],
            "tagger_models": [],
            "company_lists": [],
            "date_folder": None,
            "segment_folder": None,
            "error": f"Segment folder not found: {segment}"
        }
    
    segment_path = os.path.join(country_path, actual_segment)
    
    # Find the latest date folder
    date_folder = find_latest_date_folder(segment_path)
    
    result = {
        "sample_files": [],
        "prod_models": [],
        "dev_models": [],
        "expert_rules_old": [],
        "expert_rules_new": [],
        "tagger_models": [],
        "company_lists": [],
        "date_folder": date_folder,
        "segment_folder": actual_segment
    }
    
    if not date_folder:
        print(f"No date folder found in {segment_path}")
        result["error"] = "No date folder found with 'model' subdirectory"
        return result
    
    work_path = os.path.join(segment_path, date_folder)
    
    # Input files (.tsv.gz) - from 'sample' folder INSIDE the date folder
    sample_path = os.path.join(work_path, "sample")
    if os.path.exists(sample_path):
        try:
            result["sample_files"] = sorted([
                f for f in os.listdir(sample_path)
                if f.endswith(".tsv.gz") or f.endswith(".tsv")
            ])
            result["company_lists"] = sorted([
                f for f in os.listdir(sample_path)
                if f.endswith(".xlsx") and "compan" in f.lower()
            ])
            print(f"Found {len(result['sample_files'])} sample files in {sample_path}")
        except Exception as e:
            print(f"Error reading sample folder {sample_path}: {e}")
    else:
        print(f"Sample folder not found: {sample_path}")
    
    # Model path - from date folder
    model_path = os.path.join(work_path, "model")
    
    if segment.lower() in ["consumer", "business"]:
        # Prod models (old)
        prod_path = os.path.join(model_path, "prod")
        if os.path.exists(prod_path):
            try:
                result["prod_models"] = sorted([f for f in os.listdir(prod_path) if f.endswith(".zip")])
                print(f"Found {len(result['prod_models'])} prod models in {prod_path}")
            except Exception as e:
                print(f"Error reading prod folder {prod_path}: {e}")
        
        # Dev models (new)
        dev_path = os.path.join(model_path, "develop")
        if os.path.exists(dev_path):
            try:
                result["dev_models"] = sorted([f for f in os.listdir(dev_path) if f.endswith(".zip")])
                print(f"Found {len(result['dev_models'])} dev models in {dev_path}")
            except Exception as e:
                print(f"Error reading develop folder {dev_path}: {e}")
        
        # Expert rules
        expert_path = os.path.join(model_path, "expertrules")
        if os.path.exists(expert_path):
            try:
                # Check for old/new subfolders
                old_path = os.path.join(expert_path, "old")
                new_path = os.path.join(expert_path, "new")
                
                if os.path.exists(old_path):
                    result["expert_rules_old"] = sorted([f for f in os.listdir(old_path) if f.endswith(".zip")])
                if os.path.exists(new_path):
                    result["expert_rules_new"] = sorted([f for f in os.listdir(new_path) if f.endswith(".zip")])
                
                # If no old/new folders, list files directly from expertrules
                if not result["expert_rules_old"] and not result["expert_rules_new"]:
                    all_rules = sorted([f for f in os.listdir(expert_path) if f.endswith(".zip")])
                    result["expert_rules_old"] = all_rules
                    result["expert_rules_new"] = all_rules
                    
                print(f"Found {len(result['expert_rules_old'])} old rules, {len(result['expert_rules_new'])} new rules")
            except Exception as e:
                print(f"Error reading expertrules folder {expert_path}: {e}")
    
    elif segment.lower() == "tagger":
        # Tagger models are directly in model folder
        if os.path.exists(model_path):
            try:
                result["tagger_models"] = sorted([f for f in os.listdir(model_path) if f.endswith(".zip")])
            except Exception as e:
                print(f"Error reading tagger models: {e}")
    
    return result


def run_consumer_business_tests(run_id: str, config: ConsumerBusinessConfig):
    """Background task to run Consumer/Business tests"""
    try:
        test_runs[run_id]["status"] = "running"
        test_runs[run_id]["message"] = "Initializing TestRunner..."
        
        # Import TestRunner
        from suite_tests.testRunner import TestRunner
        
        today = datetime.date.today().strftime("%y%m%d")
        segment_path = os.path.join(DATA_ROOT, config.country, config.segment)
        
        # Find the latest date folder (e.g. 251219)
        date_folder = find_latest_date_folder(segment_path)
        if not date_folder:
            raise Exception(f"No date folder found in {segment_path}")
        
        work_path = os.path.join(segment_path, date_folder)
        output_folder = os.path.join(work_path, "output")
        os.makedirs(output_folder, exist_ok=True)
        
        # Model paths - inside date_folder/model/
        model_path = os.path.join(work_path, "model")
        old_model_path = os.path.join(model_path, "prod", config.old_model)
        new_model_path = os.path.join(model_path, "develop", config.new_model)
        
        # Expert rules paths - inside date_folder/model/expertrules/
        expert_path = os.path.join(model_path, "expertrules")
        old_expert = None
        new_expert = None
        
        if config.old_expert_rules:
            # Try old subfolder first, then main folder
            old_subfolder = os.path.join(expert_path, "old", config.old_expert_rules)
            if os.path.exists(old_subfolder):
                old_expert = old_subfolder
            else:
                old_expert = os.path.join(expert_path, config.old_expert_rules)
        
        if config.new_expert_rules:
            new_subfolder = os.path.join(expert_path, "new", config.new_expert_rules)
            if os.path.exists(new_subfolder):
                new_expert = new_subfolder
            else:
                new_expert = os.path.join(expert_path, config.new_expert_rules)
        
        test_runs[run_id]["message"] = "Creating TestRunner instance..."
        print(f"[DEBUG] old_model_path: {old_model_path}")
        print(f"[DEBUG] new_model_path: {new_model_path}")
        print(f"[DEBUG] output_folder: {output_folder}")
        
        runner = TestRunner(
            old_model_path,
            new_model_path,
            output_folder,
            old_expert,
            new_expert
        )
        
        # Crossvalidation
        test_runs[run_id]["message"] = "Running crossvalidation..."
        test_runs[run_id]["progress"] = 10
        runner.compute_crossvalidation_score(
            old_expert_rules_zip_path=old_expert,
            new_expert_rules_zip_path=new_expert,
            save=True
        )
        
        sample_path = os.path.join(work_path, "sample")
        total_tests = len(config.accuracy_files) + len(config.anomalies_files) + \
                     len(config.precision_files) + len(config.stability_files)
        current_test = 0
        
        # Accuracy tests
        for i, f in enumerate(config.accuracy_files, start=1):
            current_test += 1
            test_runs[run_id]["message"] = f"Running accuracy test {i}/{len(config.accuracy_files)}..."
            test_runs[run_id]["progress"] = 10 + int((current_test / total_tests) * 80)
            
            runner.compute_validation_scores(
                os.path.join(sample_path, f),
                save=True,
                tag=f"A_{i}",
                azure_batch=config.azure_batch,
                azure_batch_vm_path=AZURE_BATCH_VM_PATH,
                old_expert_rules_zip_path=old_expert,
                new_expert_rules_zip_path=new_expert,
                ServicePrincipal_CertificateThumbprint=CERT_THUMBPRINT,
                ServicePrincipal_ApplicationId=APP_ID,
                vm_for_bench=config.vm_bench,
                vm_for_dev=config.vm_dev
            )
        
        # Anomalies tests
        for f in config.anomalies_files:
            current_test += 1
            test_runs[run_id]["message"] = f"Running anomalies test..."
            test_runs[run_id]["progress"] = 10 + int((current_test / total_tests) * 80)
            
            runner.compute_validation_scores(
                os.path.join(sample_path, f),
                save=True,
                tag="ANOM",
                azure_batch=config.azure_batch,
                azure_batch_vm_path=AZURE_BATCH_VM_PATH,
                old_expert_rules_zip_path=old_expert,
                new_expert_rules_zip_path=new_expert,
                ServicePrincipal_CertificateThumbprint=CERT_THUMBPRINT,
                ServicePrincipal_ApplicationId=APP_ID,
                vm_for_bench=config.vm_bench,
                vm_for_dev=config.vm_dev
            )
        
        # Precision tests
        for f in config.precision_files:
            current_test += 1
            test_runs[run_id]["message"] = f"Running precision test..."
            test_runs[run_id]["progress"] = 10 + int((current_test / total_tests) * 80)
            
            runner.compute_validation_scores(
                os.path.join(sample_path, f),
                save=True,
                tag="PREC",
                azure_batch=config.azure_batch,
                azure_batch_vm_path=AZURE_BATCH_VM_PATH,
                old_expert_rules_zip_path=old_expert,
                new_expert_rules_zip_path=new_expert,
                ServicePrincipal_CertificateThumbprint=CERT_THUMBPRINT,
                ServicePrincipal_ApplicationId=APP_ID,
                vm_for_bench=config.vm_bench,
                vm_for_dev=config.vm_dev
            )
        
        # Stability tests
        for i, f in enumerate(config.stability_files, start=1):
            current_test += 1
            test_runs[run_id]["message"] = f"Running stability test {i}/{len(config.stability_files)}..."
            test_runs[run_id]["progress"] = 10 + int((current_test / total_tests) * 80)
            
            runner.compute_validation_distribution(
                os.path.join(sample_path, f),
                save=True,
                tag=f"S_{i}",
                azure_batch=config.azure_batch,
                azure_batch_vm_path=AZURE_BATCH_VM_PATH,
                old_expert_rules_zip_path=old_expert,
                new_expert_rules_zip_path=new_expert,
                ServicePrincipal_CertificateThumbprint=CERT_THUMBPRINT,
                ServicePrincipal_ApplicationId=APP_ID,
                vm_for_bench=config.vm_bench,
                vm_for_dev=config.vm_dev
            )
        
        # Save reports
        test_runs[run_id]["message"] = "Saving reports..."
        test_runs[run_id]["progress"] = 95
        runner.save_reports(weights=None, excel=True, pdf=False)
        
        test_runs[run_id]["status"] = "completed"
        test_runs[run_id]["progress"] = 100
        test_runs[run_id]["message"] = "Tests completed successfully!"
        test_runs[run_id]["result"] = {
            "output_folder": output_folder,
            "report_path": os.path.join(output_folder, runner.old_uid, f"{runner.new_uid}_final_report_{runner.now}.xlsx")
        }
        
    except Exception as e:
        test_runs[run_id]["status"] = "failed"
        test_runs[run_id]["message"] = f"Error: {str(e)}"
        test_runs[run_id]["error"] = traceback.format_exc()


def run_tagger_tests(run_id: str, config: TaggerConfig):
    """Background task to run Tagger tests"""
    try:
        test_runs[run_id]["status"] = "running"
        test_runs[run_id]["message"] = "Initializing Tagger TestRunner..."
        
        from suite_tests.testRunner_tagger import TestRunner as TestRunnerTagger
        
        segment_path = os.path.join(DATA_ROOT, config.country, "Tagger")
        
        # Find the latest date folder
        date_folder = find_latest_date_folder(segment_path)
        if not date_folder:
            raise Exception(f"No date folder found in {segment_path}")
        
        work_path = os.path.join(segment_path, date_folder)
        output_folder = os.path.join(work_path, "output")
        os.makedirs(output_folder, exist_ok=True)
        
        # Model paths - inside date_folder/model/
        model_path = os.path.join(work_path, "model")
        old_model_path = os.path.join(model_path, config.old_model)
        new_model_path = os.path.join(model_path, config.new_model)
        
        sample_path = os.path.join(work_path, "sample")
        company_list_path = os.path.join(sample_path, config.company_list)
        distribution_path = os.path.join(sample_path, config.distribution_data)
        
        test_runs[run_id]["message"] = "Creating Tagger TestRunner..."
        test_runs[run_id]["progress"] = 10
        
        runner = TestRunnerTagger(old_model_path, new_model_path, output_folder)
        
        # Crossvalidation
        test_runs[run_id]["message"] = "Running tagger crossvalidation..."
        test_runs[run_id]["progress"] = 30
        runner.compute_tagger_crossvalidation_score(save=True)
        
        # Validation distribution
        test_runs[run_id]["message"] = "Running tagger validation distribution..."
        test_runs[run_id]["progress"] = 60
        runner.compute_tagger_validation_distribution(
            validation_data_path=distribution_path,
            save=True,
            azure_batch=config.azure_batch,
            azure_batch_vm_path=AZURE_BATCH_VM_PATH,
            path_list_companies=company_list_path,
            ServicePrincipal_CertificateThumbprint=CERT_THUMBPRINT,
            ServicePrincipal_ApplicationId=APP_ID,
            vm_for_bench=config.vm_bench,
            vm_for_dev=config.vm_dev
        )
        
        # Save reports
        test_runs[run_id]["message"] = "Saving reports..."
        test_runs[run_id]["progress"] = 90
        runner.save_tagger_reports(excel=True)
        
        test_runs[run_id]["status"] = "completed"
        test_runs[run_id]["progress"] = 100
        test_runs[run_id]["message"] = "Tagger tests completed successfully!"
        test_runs[run_id]["result"] = {
            "output_folder": output_folder
        }
        
    except Exception as e:
        test_runs[run_id]["status"] = "failed"
        test_runs[run_id]["message"] = f"Error: {str(e)}"
        test_runs[run_id]["error"] = traceback.format_exc()


@app.post("/api/testsuite/run/consumer-business", response_model=TestRunResponse)
async def run_consumer_business(config: ConsumerBusinessConfig, background_tasks: BackgroundTasks):
    """Start a Consumer/Business test run"""
    run_id = f"{config.country}_{config.segment}_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}"
    
    test_runs[run_id] = {
        "status": "pending",
        "progress": 0,
        "message": "Test queued...",
        "config": config.dict()
    }
    
    background_tasks.add_task(run_consumer_business_tests, run_id, config)
    
    return TestRunResponse(
        run_id=run_id,
        status="pending",
        message="Test run started"
    )


@app.post("/api/testsuite/run/tagger", response_model=TestRunResponse)
async def run_tagger(config: TaggerConfig, background_tasks: BackgroundTasks):
    """Start a Tagger test run"""
    run_id = f"{config.country}_Tagger_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}"
    
    test_runs[run_id] = {
        "status": "pending",
        "progress": 0,
        "message": "Tagger test queued...",
        "config": config.dict()
    }
    
    background_tasks.add_task(run_tagger_tests, run_id, config)
    
    return TestRunResponse(
        run_id=run_id,
        status="pending",
        message="Tagger test run started"
    )


@app.get("/api/testsuite/status/{run_id}", response_model=TestStatusResponse)
def get_test_status(run_id: str):
    """Get the status of a test run"""
    if run_id not in test_runs:
        raise HTTPException(status_code=404, detail="Test run not found")
    
    run = test_runs[run_id]
    return TestStatusResponse(
        run_id=run_id,
        status=run.get("status", "unknown"),
        progress=run.get("progress"),
        message=run.get("message"),
        result=run.get("result"),
        error_traceback=run.get("error")
    )


@app.get("/api/testsuite/runs")
def list_test_runs():
    """List all test runs"""
    return {
        "runs": [
            {
                "run_id": run_id,
                "status": run.get("status"),
                "progress": run.get("progress"),
                "message": run.get("message")
            }
            for run_id, run in test_runs.items()
        ]
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3002)
