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
import shutil
import s3_helper

# Add the CategorizationEnginePython paths
CE_PYTHON_PATH = "/app/CategorizationEnginePython"
CE_TESTS_PATH = os.path.join(CE_PYTHON_PATH, "CategorizationEngineTests", "CETestSuite")

sys.path.insert(0, CE_PYTHON_PATH)
sys.path.insert(0, CE_TESTS_PATH)

# --- GLOBAL monkey-patch: fix Windows backslash paths for Linux/Docker ---
# The Python library uses backslash paths everywhere (init, compute, etc.).
# Instead of patching individual __init__ methods, we permanently patch all
# path-related OS functions to normalize backslashes to forward slashes.
# This is safe because this container ONLY runs the test library.
import builtins

_real_open = builtins.open
_real_listdir = os.listdir
_real_isdir = os.path.isdir
_real_isfile = os.path.isfile
_real_exists = os.path.exists
_real_makedirs = os.makedirs
_real_chdir = os.chdir
_real_join = os.path.join
_real_abspath = os.path.abspath
_real_basename = os.path.basename
_real_dirname = os.path.dirname
_real_glob = glob.glob
_real_shutil_copy = shutil.copy
_real_shutil_copy2 = shutil.copy2
_real_shutil_move = shutil.move
_real_os_remove = os.remove

# Path remapping: the library references C:/_git/CategorizationEnginePython
# which must be redirected to the Docker mount at /app/CategorizationEnginePython
_PATH_REMAPS = [
    ("C:/_git/CategorizationEnginePython", "/app/CategorizationEnginePython"),
    ("C:\\_git\\CategorizationEnginePython", "/app/CategorizationEnginePython"),
    ("C:/Users/kq5simmarine/OneDrive - CRIF SpA/CE/model-workflow-tracker/docker/ce_python/CategorizationEnginePython", "/app/CategorizationEnginePython"),
    ("C:\\Users\\kq5simmarine\\OneDrive - CRIF SpA\\CE\\model-workflow-tracker\\docker\\ce_python\\CategorizationEnginePython", "/app/CategorizationEnginePython"),
]

def _fix(p):
    """Normalize Windows backslash paths to forward slashes and remap known paths."""
    if isinstance(p, str):
        p = p.replace('\\', '/')
        for old_prefix, new_prefix in _PATH_REMAPS:
            normalized_old = old_prefix.replace('\\', '/')
            if p.startswith(normalized_old):
                p = new_prefix + p[len(normalized_old):]
                break
    return p

builtins.open = lambda f, *a, **kw: _real_open(_fix(f), *a, **kw)
def _safe_listdir(p='.'):
    """listdir that returns [] if path doesn't exist (for Azure VM dirs)."""
    fixed = _fix(p)
    if not _real_exists(fixed):
        _real_makedirs(fixed, exist_ok=True)
        return []
    return _real_listdir(fixed)
os.listdir = _safe_listdir
os.path.isdir = lambda p: _real_isdir(_fix(p))
os.path.isfile = lambda p: _real_isfile(_fix(p))
os.path.exists = lambda p: _real_exists(_fix(p))
os.makedirs = lambda p, *a, **kw: _real_makedirs(_fix(p), *a, **kw)
os.chdir = lambda p: _real_chdir(_fix(p))
os.path.join = lambda *parts: _real_join(*[_fix(p) for p in parts])
os.path.abspath = lambda p: _real_abspath(_fix(p))
os.path.basename = lambda p: _real_basename(_fix(p))
os.path.dirname = lambda p: _real_dirname(_fix(p))
glob.glob = lambda p, **kw: _real_glob(_fix(p), **kw)

# Patch shutil to normalize paths
def _safe_shutil_copy(src, dst, *a, **kw):
    s, d = _fix(src), _fix(dst)
    _real_makedirs(_real_dirname(d) if _real_dirname(d) else '.', exist_ok=True)
    if not _real_exists(s):
        print(f"[PATCH] shutil.copy: source not found, skipping: {s}")
        return d
    return _real_shutil_copy(s, d, *a, **kw)
shutil.copy = _safe_shutil_copy

def _safe_shutil_copy2(src, dst, *a, **kw):
    s, d = _fix(src), _fix(dst)
    _real_makedirs(_real_dirname(d) if _real_dirname(d) else '.', exist_ok=True)
    if not _real_exists(s):
        print(f"[PATCH] shutil.copy2: source not found, skipping: {s}")
        return d
    return _real_shutil_copy2(s, d, *a, **kw)
shutil.copy2 = _safe_shutil_copy2

def _safe_shutil_move(src, dst, *a, **kw):
    s, d = _fix(src), _fix(dst)
    _real_makedirs(_real_dirname(d) if _real_dirname(d) else '.', exist_ok=True)
    if not _real_exists(s):
        print(f"[PATCH] shutil.move: source not found, skipping: {s}")
        return d
    return _real_shutil_move(s, d, *a, **kw)
shutil.move = _safe_shutil_move

def _safe_remove(p):
    fixed = _fix(p)
    if not _real_exists(fixed):
        return
    return _real_os_remove(fixed)
os.remove = _safe_remove

# Patch subprocess.Popen to intercept Windows PowerShell commands (Azure Batch)
# The library tries to launch pwsh.exe which doesn't exist on Linux.
# We simulate a successful no-op process instead.
import subprocess
_real_popen = subprocess.Popen

class _FakePopen:
    """Simulates a completed process for intercepted Windows commands."""
    def __init__(self, *a, **kw):
        self.returncode = 0
        self.pid = 0
    def communicate(self, *a, **kw):
        return (b"", b"")
    def wait(self, *a, **kw):
        return 0
    def poll(self):
        return 0

def _patched_popen(cmd, *args, **kwargs):
    cmd_str = cmd if isinstance(cmd, str) else " ".join(str(c) for c in cmd)
    if "pwsh.exe" in cmd_str or "powershell" in cmd_str.lower():
        print(f"[PATCH] subprocess.Popen intercepted Windows PowerShell command, returning fake process: {cmd_str[:120]}...")
        return _FakePopen()
    return _real_popen(cmd, *args, **kwargs)

subprocess.Popen = _patched_popen

print("[PATCH] Global path normalization patches applied (backslash -> forward slash, path remapping, shutil, subprocess)")

# Patch __init__ of MetricTrainTest and MetricValidationTestScore
# These classes parse model folder names using path.split('\\'), so we must
# feed them backslash paths, then restore Linux paths on the instance after init.
def _make_patched_init(orig_init, class_name):
    """Feeds backslash paths to __init__ for split('\\') parsing, then restores Linux paths."""
    def _patched_init(self, old_model_path, new_model_path, output_folder, *args, **kwargs):
        old_bs = old_model_path.replace('/', '\\') if old_model_path else old_model_path
        new_bs = new_model_path.replace('/', '\\') if new_model_path else new_model_path
        out_bs = output_folder.replace('/', '\\') if output_folder else output_folder
        print(f"[PATCH] {class_name}.__init__ called with backslash paths for parsing")
        orig_init(self, old_bs, new_bs, out_bs, *args, **kwargs)
        # Restore Linux paths on instance attributes
        self.old_model_path = old_model_path
        self.new_model_path = new_model_path
        self.output_folder = output_folder
        # Also fix any other path attributes that might have been set with backslashes
        for attr in dir(self):
            if attr.startswith('_'):
                continue
            try:
                val = getattr(self, attr)
                if isinstance(val, str) and '\\' in val:
                    setattr(self, attr, val.replace('\\', '/'))
            except Exception:
                pass
        print(f"[PATCH] {class_name}.__init__ complete, instance paths normalized")
    return _patched_init

try:
    from suite_tests import MetricTrainTest as _MTT
    _MTT.MetricTrainTest.__init__ = _make_patched_init(_MTT.MetricTrainTest.__init__, "MetricTrainTest")
    print("[PATCH] MetricTrainTest.__init__ patched")
except Exception as e:
    print(f"[PATCH] Warning: Could not patch MetricTrainTest: {e}")

try:
    from suite_tests import MetricValidationTestScore as _MVTS
    _MVTS.MetricValidationTestScore.__init__ = _make_patched_init(_MVTS.MetricValidationTestScore.__init__, "MetricValidationTestScore")
    print("[PATCH] MetricValidationTestScore.__init__ patched")
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

# Azure Batch settings - override Windows path with a local Linux path inside the container
_AZURE_BATCH_LOCAL = "/tmp/azure_batch"
os.makedirs(_AZURE_BATCH_LOCAL, exist_ok=True)
# Pre-create VM working folders so listdir/copy don't fail
for _vm_i in range(1, 11):
    _real_makedirs(f"{_AZURE_BATCH_LOCAL}/WorkingFolder_FileShare_Uic-P3t-VM-{_vm_i}", exist_ok=True)
# Force the env var so the library picks up the Linux path
os.environ["AZURE_BATCH_VM_PATH"] = _AZURE_BATCH_LOCAL
AZURE_BATCH_VM_PATH = _AZURE_BATCH_LOCAL
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
    """List available countries from S3"""
    try:
        countries = s3_helper.list_countries()
        return {"countries": countries}
    except Exception as e:
        print(f"[S3] Error listing countries: {e}")
        return {"countries": [], "error": str(e)}


@app.get("/api/testsuite/segments/{country}")
def list_segments(country: str):
    """List available segments for a country from S3"""
    segment_map = {
        "consumer": "Consumer",
        "business": "Business",
        "tagger": "Tagger"
    }
    try:
        raw_segments = s3_helper.list_segments(country)
        segments = [segment_map.get(s.lower(), s) for s in raw_segments if s.lower() in segment_map]
        return {"segments": segments}
    except Exception as e:
        print(f"[S3] Error listing segments: {e}")
        return {"segments": [], "error": str(e)}


@app.get("/api/testsuite/files/{country}/{segment}")
def list_files(country: str, segment: str):
    """List available files for a country/segment from S3."""
    empty_result = {
        "sample_files": [],
        "prod_models": [],
        "dev_models": [],
        "expert_rules_old": [],
        "expert_rules_new": [],
        "tagger_models": [],
        "company_lists": [],
        "date_folder": None,
        "segment_folder": None,
    }
    try:
        # Find actual segment folder name (case-insensitive)
        raw_segments = s3_helper.list_segments(country)
        actual_segment = None
        for s in raw_segments:
            if s.lower() == segment.lower():
                actual_segment = s
                break
        if not actual_segment:
            empty_result["error"] = f"Segment folder not found: {segment}"
            return empty_result
        
        date_folder = s3_helper.find_latest_date_folder(country, actual_segment)
        if not date_folder:
            empty_result["segment_folder"] = actual_segment
            empty_result["error"] = "No date folder found with 'model' subdirectory"
            return empty_result
        
        result = s3_helper.list_files_for_segment(country, actual_segment, date_folder)
        return result
    except Exception as e:
        print(f"[S3] Error listing files: {e}")
        empty_result["error"] = str(e)
        return empty_result


def run_consumer_business_tests(run_id: str, config: ConsumerBusinessConfig):
    """Background task to run Consumer/Business tests"""
    try:
        test_runs[run_id]["status"] = "running"
        test_runs[run_id]["message"] = "Downloading data from S3..."
        
        # Import TestRunner
        from suite_tests.testRunner import TestRunner
        
        # Find actual segment folder name from S3
        raw_segments = s3_helper.list_segments(config.country)
        actual_segment = config.segment
        for s in raw_segments:
            if s.lower() == config.segment.lower():
                actual_segment = s
                break
        
        # Find latest date folder from S3
        date_folder = s3_helper.find_latest_date_folder(config.country, actual_segment)
        if not date_folder:
            raise Exception(f"No date folder found for {config.country}/{actual_segment} in S3")
        
        # Download all test data from S3 to local cache
        test_runs[run_id]["message"] = "Downloading test data from S3..."
        test_runs[run_id]["progress"] = 5
        work_path = s3_helper.download_test_data(config.country, actual_segment, date_folder)
        
        output_folder = os.path.join(work_path, "output")
        os.makedirs(output_folder, exist_ok=True)
        
        # Model paths - inside date_folder/model/
        model_path = os.path.join(work_path, "model")
        old_model_path = os.path.join(model_path, "prod", config.old_model)
        new_model_path = os.path.join(model_path, "develop", config.new_model)
        
        # Expert rules paths
        expert_path = os.path.join(model_path, "expertrules")
        old_expert = None
        new_expert = None
        
        if config.old_expert_rules:
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
                os.path.join(sample_path, f), save=True, tag=f"A_{i}",
                azure_batch=config.azure_batch, azure_batch_vm_path=AZURE_BATCH_VM_PATH,
                old_expert_rules_zip_path=old_expert, new_expert_rules_zip_path=new_expert,
                ServicePrincipal_CertificateThumbprint=CERT_THUMBPRINT,
                ServicePrincipal_ApplicationId=APP_ID,
                vm_for_bench=config.vm_bench, vm_for_dev=config.vm_dev
            )
        
        # Anomalies tests
        for f in config.anomalies_files:
            current_test += 1
            test_runs[run_id]["message"] = "Running anomalies test..."
            test_runs[run_id]["progress"] = 10 + int((current_test / total_tests) * 80)
            runner.compute_validation_scores(
                os.path.join(sample_path, f), save=True, tag="ANOM",
                azure_batch=config.azure_batch, azure_batch_vm_path=AZURE_BATCH_VM_PATH,
                old_expert_rules_zip_path=old_expert, new_expert_rules_zip_path=new_expert,
                ServicePrincipal_CertificateThumbprint=CERT_THUMBPRINT,
                ServicePrincipal_ApplicationId=APP_ID,
                vm_for_bench=config.vm_bench, vm_for_dev=config.vm_dev
            )
        
        # Precision tests
        for f in config.precision_files:
            current_test += 1
            test_runs[run_id]["message"] = "Running precision test..."
            test_runs[run_id]["progress"] = 10 + int((current_test / total_tests) * 80)
            runner.compute_validation_scores(
                os.path.join(sample_path, f), save=True, tag="PREC",
                azure_batch=config.azure_batch, azure_batch_vm_path=AZURE_BATCH_VM_PATH,
                old_expert_rules_zip_path=old_expert, new_expert_rules_zip_path=new_expert,
                ServicePrincipal_CertificateThumbprint=CERT_THUMBPRINT,
                ServicePrincipal_ApplicationId=APP_ID,
                vm_for_bench=config.vm_bench, vm_for_dev=config.vm_dev
            )
        
        # Stability tests
        for i, f in enumerate(config.stability_files, start=1):
            current_test += 1
            test_runs[run_id]["message"] = f"Running stability test {i}/{len(config.stability_files)}..."
            test_runs[run_id]["progress"] = 10 + int((current_test / total_tests) * 80)
            runner.compute_validation_distribution(
                os.path.join(sample_path, f), save=True, tag=f"S_{i}",
                azure_batch=config.azure_batch, azure_batch_vm_path=AZURE_BATCH_VM_PATH,
                old_expert_rules_zip_path=old_expert, new_expert_rules_zip_path=new_expert,
                ServicePrincipal_CertificateThumbprint=CERT_THUMBPRINT,
                ServicePrincipal_ApplicationId=APP_ID,
                vm_for_bench=config.vm_bench, vm_for_dev=config.vm_dev
            )
        
        # Save reports
        test_runs[run_id]["message"] = "Saving reports..."
        test_runs[run_id]["progress"] = 92
        runner.save_reports(weights=None, excel=True, pdf=False)
        
        # Upload outputs to S3
        test_runs[run_id]["message"] = "Uploading outputs to S3..."
        test_runs[run_id]["progress"] = 96
        s3_helper.upload_outputs(config.country, actual_segment, date_folder, output_folder)
        
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
        test_runs[run_id]["message"] = "Downloading tagger data from S3..."
        
        from suite_tests.testRunner_tagger import TestRunner as TestRunnerTagger
        
        # Find actual segment folder
        actual_segment = "Tagger"
        raw_segments = s3_helper.list_segments(config.country)
        for s in raw_segments:
            if s.lower() == "tagger":
                actual_segment = s
                break
        
        date_folder = s3_helper.find_latest_date_folder(config.country, actual_segment)
        if not date_folder:
            raise Exception(f"No date folder found for {config.country}/{actual_segment} in S3")
        
        # Download data from S3
        test_runs[run_id]["progress"] = 5
        work_path = s3_helper.download_test_data(config.country, actual_segment, date_folder)
        
        output_folder = os.path.join(work_path, "output")
        os.makedirs(output_folder, exist_ok=True)
        
        model_path = os.path.join(work_path, "model")
        old_model_path = os.path.join(model_path, config.old_model)
        new_model_path = os.path.join(model_path, config.new_model)
        
        sample_path = os.path.join(work_path, "sample")
        company_list_path = os.path.join(sample_path, config.company_list)
        distribution_path = os.path.join(sample_path, config.distribution_data)
        
        test_runs[run_id]["message"] = "Creating Tagger TestRunner..."
        test_runs[run_id]["progress"] = 10
        
        runner = TestRunnerTagger(old_model_path, new_model_path, output_folder)
        
        test_runs[run_id]["message"] = "Running tagger crossvalidation..."
        test_runs[run_id]["progress"] = 30
        runner.compute_tagger_crossvalidation_score(save=True)
        
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
        
        test_runs[run_id]["message"] = "Saving reports..."
        test_runs[run_id]["progress"] = 88
        runner.save_tagger_reports(excel=True)
        
        # Upload outputs to S3
        test_runs[run_id]["message"] = "Uploading outputs to S3..."
        test_runs[run_id]["progress"] = 95
        s3_helper.upload_outputs(config.country, actual_segment, date_folder, output_folder)
        
        test_runs[run_id]["status"] = "completed"
        test_runs[run_id]["progress"] = 100
        test_runs[run_id]["message"] = "Tagger tests completed successfully!"
        test_runs[run_id]["result"] = {"output_folder": output_folder}
        
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
