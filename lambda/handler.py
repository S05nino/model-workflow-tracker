"""
AWS Lambda handler that replaces dashboard.py (Streamlit).
Receives test configuration as event payload, downloads files from S3,
runs TestRunner, and uploads results back to S3.

Deployment:
  1. Package this with CategorizationEnginePython and dependencies
  2. Use a Docker-based Lambda with .NET runtime support
  3. Set environment variables: S3_BUCKET, S3_PREFIX
"""

import os
import sys
import json
import glob
import shutil
import datetime
import logging
import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# ============================================================
#  CONSTANTS
# ============================================================

S3_BUCKET = os.environ.get("S3_BUCKET", "s3-crif-studio-wwcc1mnt-de-prd-datalake")
S3_PREFIX = os.environ.get("S3_PREFIX", "CategorizationEngineTestSuite/TEST_SUITE/")
LOCAL_ROOT = "/tmp/TEST_SUITE"

s3 = boto3.client("s3")


# ============================================================
#  S3 HELPERS
# ============================================================

def s3_download_prefix(prefix: str, local_dir: str):
    """Download all files under an S3 prefix to a local directory."""
    paginator = s3.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=S3_BUCKET, Prefix=prefix):
        for obj in page.get("Contents", []):
            key = obj["Key"]
            rel = key[len(prefix):]
            if not rel or rel.endswith("/"):
                continue
            local_path = os.path.join(local_dir, rel)
            os.makedirs(os.path.dirname(local_path), exist_ok=True)
            logger.info(f"Downloading s3://{S3_BUCKET}/{key} -> {local_path}")
            s3.download_file(S3_BUCKET, key, local_path)


def s3_upload_dir(local_dir: str, prefix: str):
    """Upload all files in a local directory to S3."""
    for root, dirs, files in os.walk(local_dir):
        for fname in files:
            local_path = os.path.join(root, fname)
            rel = os.path.relpath(local_path, local_dir)
            s3_key = prefix + rel.replace("\\", "/")
            logger.info(f"Uploading {local_path} -> s3://{S3_BUCKET}/{s3_key}")
            s3.upload_file(local_path, S3_BUCKET, s3_key)


def s3_download_file(s3_key: str, local_path: str):
    """Download a single file from S3."""
    os.makedirs(os.path.dirname(local_path), exist_ok=True)
    logger.info(f"Downloading s3://{S3_BUCKET}/{s3_key} -> {local_path}")
    s3.download_file(S3_BUCKET, s3_key, local_path)


# ============================================================
#  COPY OUTPUTS (adapted from dashboard.py)
# ============================================================

def copy_latest_outputs(output_folder, segment, report_type, country_code, model_name, date_str):
    messages = {
        "ACC": "Report di Accuracy generato!",
        "ANOM": "Report di Anomalie generato!",
        "PREC": "Report di Precision generato!",
        "STAB": "Report di Stabilità generato!",
    }
    suffix_map = {
        "ACC": "_ACC.xlsx",
        "ANOM": "_ANOM.xlsx",
        "PREC": "_PREC.xlsx",
        "STAB": "_STAB.xlsx",
    }
    suffix = suffix_map.get(report_type, "")

    value = "OUT"
    try:
        parts = model_name.split("_")
        idx = parts.index(country_code) + 1
        if parts[idx] == "1":
            value = "IN"
    except Exception:
        pass

    # Copy report Excel files
    for root, dirs, files in os.walk(output_folder):
        if root != output_folder:
            for f in files:
                if suffix and f.endswith(suffix):
                    src = os.path.join(root, f)
                    new_name = f"report_{messages[report_type].split()[2]}_{country_code}_CE_{segment}_{value}_{date_str}.xlsx"
                    dst = os.path.join(output_folder, new_name)
                    try:
                        shutil.copy2(src, dst)
                        logger.info(f"Copied report: {new_name}")
                    except Exception as e:
                        logger.warning(f"Failed to copy {src}: {e}")

    # Copy batch CSV
    batch_dir = get_batch_dir()
    if batch_dir is None:
        logger.warning("Batch directory not found, skipping batch CSV copy")
        return

    pattern = "*categorized.csv" if segment in ["Consumer", "Business"] else "*tagged.csv"
    files = glob.glob(os.path.join(batch_dir, pattern))

    if files:
        latest = max(files, key=os.path.getmtime)
        new_batch_name = f"{messages[report_type].split()[2]}_{country_code}_CE_{segment}_{value}_{date_str}.csv"
        dst = os.path.join(output_folder, new_batch_name)
        try:
            shutil.copy2(latest, dst)
            logger.info(f"Copied batch file: {new_batch_name}")
        except Exception as e:
            logger.warning(f"Failed to copy {latest}: {e}")


def get_batch_dir():
    """Find the batch directory relative to TestRunner."""
    try:
        import suite_tests
        suite_file = getattr(suite_tests, "__file__", None)
        if suite_file:
            suite_root = os.path.dirname(os.path.abspath(suite_file))
            return os.path.join(suite_root, "data", "batch")
        for p in sys.path:
            candidate = os.path.join(p, "suite_tests", "data", "batch")
            if os.path.isdir(candidate):
                return candidate
            candidate2 = os.path.join(p, "data", "batch")
            if os.path.isdir(candidate2):
                return candidate2
    except ImportError:
        pass
    return None


# ============================================================
#  MAIN HANDLER
# ============================================================

def handler(event, context):
    """
    Lambda handler. Receives config JSON as event payload.
    Downloads necessary files from S3, runs TestRunner, uploads results.
    """
    logger.info(f"Received event: {json.dumps(event, default=str)}")

    config = event  # The edge function sends config directly as payload

    country = config["country"]
    segment = config["segment"].capitalize()
    version = config.get("version", "x.x.x")
    output_folder_name = config.get("output_folder_name", "output")

    old_model = config["old_model"]
    new_model = config["new_model"]
    old_expert_rules = config.get("old_expert_rules")
    new_expert_rules = config.get("new_expert_rules")
    has_old_new_expert_structure = config.get("has_old_new_expert_structure", False)

    sample_files_cfg = config.get("sample_files", {})

    azure_batch_vm_path = config.get("azure_batch_vm_path")
    cert_thumbprint = config.get("ServicePrincipal_CertificateThumbprint")
    app_id = config.get("ServicePrincipal_ApplicationId")
    vm_bench = config.get("vm_for_bench", 1)
    vm_dev = config.get("vm_for_dev", 2)

    data_root = config.get("data_root", f"{country}/{segment.lower()}")

    # ---- Clean /tmp ----
    if os.path.exists(LOCAL_ROOT):
        shutil.rmtree(LOCAL_ROOT)

    # ---- Download files from S3 ----
    s3_base = f"{S3_PREFIX}{data_root}/"
    local_base = os.path.join(LOCAL_ROOT, data_root)

    logger.info(f"Downloading files from S3 prefix: {s3_base}")

    # Download sample, model directories
    for subdir in ["sample", "model"]:
        s3_download_prefix(f"{s3_base}{subdir}/", os.path.join(local_base, subdir))

    # ---- Setup paths ----
    segment_path = local_base
    sample_path = os.path.join(segment_path, "sample")
    model_path = os.path.join(segment_path, "model")

    old_model_path = os.path.join(model_path, "prod", old_model)
    new_model_path = os.path.join(model_path, "develop", new_model)

    if old_expert_rules:
        if has_old_new_expert_structure:
            old_expert_path = os.path.join(model_path, "expertrules", "old", old_expert_rules)
        else:
            old_expert_path = os.path.join(model_path, "expertrules", old_expert_rules)
    else:
        old_expert_path = None

    if new_expert_rules:
        if has_old_new_expert_structure:
            new_expert_path = os.path.join(model_path, "expertrules", "new", new_expert_rules)
        else:
            new_expert_path = os.path.join(model_path, "expertrules", new_expert_rules)
    else:
        new_expert_path = None

    today = datetime.date.today().strftime("%y%m%d")
    output_folder = os.path.join(segment_path, output_folder_name)
    os.makedirs(output_folder, exist_ok=True)

    # ---- Import TestRunner ----
    # These paths should be available in the Lambda Docker image
    ce_paths = [
        "/opt/CategorizationEnginePython",
        "/opt/CategorizationEnginePython/CategorizationEngineTests/CETestSuite",
    ]
    for p in ce_paths:
        if p not in sys.path:
            sys.path.append(p)

    is_tagger = segment.lower() == "tagger"

    if is_tagger:
        from suite_tests.testRunner_tagger import TestRunner as TestRunnerTagger
        runner_class = TestRunnerTagger
    else:
        from suite_tests.testRunner import TestRunner
        runner_class = TestRunner

    logger.info(f"Initializing {runner_class.__name__}...")
    logger.info(f"Old model: {old_model_path}")
    logger.info(f"New model: {new_model_path}")

    azure_batch = True

    # ---- Extract sample file lists ----
    if is_tagger:
        accuracy_files = [sample_files_cfg.get("distribution")] if sample_files_cfg.get("distribution") else []
        anomalies_files = []
        precision_files = []
        stability_files = []
    else:
        accuracy_files = sample_files_cfg.get("accuracy", [])
        anomalies_files = sample_files_cfg.get("anomalies", [])
        precision_files = sample_files_cfg.get("precision", [])
        stability_files = sample_files_cfg.get("stability", [])

    # ---- Run tests ----
    if is_tagger:
        runner = runner_class(
            old_model_path,
            new_model_path,
            output_folder,
        )

        for f in accuracy_files:
            if f:
                runner.compute_validation_distribution(
                    os.path.join(sample_path, f),
                    save=True,
                    azure_batch=azure_batch,
                    azure_batch_vm_path=azure_batch_vm_path,
                    ServicePrincipal_CertificateThumbprint=cert_thumbprint,
                    ServicePrincipal_ApplicationId=app_id,
                    vm_for_bench=vm_bench,
                    vm_for_dev=vm_dev,
                )
    else:
        runner = runner_class(
            old_model_path,
            new_model_path,
            output_folder,
            old_expert_path,
            new_expert_path,
        )

        # Crossvalidation
        runner.compute_crossvalidation_score(
            old_expert_rules_zip_path=old_expert_path,
            new_expert_rules_zip_path=new_expert_path,
            save=True,
        )

        # Accuracy
        for i, f in enumerate(accuracy_files, start=1):
            tag = "A_1" if i == 1 else f"A_{i}"
            runner.compute_validation_scores(
                os.path.join(sample_path, f),
                save=True,
                tag=tag,
                azure_batch=azure_batch,
                azure_batch_vm_path=azure_batch_vm_path,
                old_expert_rules_zip_path=old_expert_path,
                new_expert_rules_zip_path=new_expert_path,
                ServicePrincipal_CertificateThumbprint=cert_thumbprint,
                ServicePrincipal_ApplicationId=app_id,
                vm_for_bench=vm_bench,
                vm_for_dev=vm_dev,
            )
            copy_latest_outputs(output_folder, segment, "ACC", country, new_model, today)

        # Anomalies
        for f in anomalies_files:
            runner.compute_validation_scores(
                os.path.join(sample_path, f),
                save=True,
                tag="ANOM",
                azure_batch=azure_batch,
                azure_batch_vm_path=azure_batch_vm_path,
                old_expert_rules_zip_path=old_expert_path,
                new_expert_rules_zip_path=new_expert_path,
                ServicePrincipal_CertificateThumbprint=cert_thumbprint,
                ServicePrincipal_ApplicationId=app_id,
                vm_for_bench=vm_bench,
                vm_for_dev=vm_dev,
            )
            copy_latest_outputs(output_folder, segment, "ANOM", country, new_model, today)

        # Precision
        for f in precision_files:
            runner.compute_validation_scores(
                os.path.join(sample_path, f),
                save=True,
                tag="PREC",
                azure_batch=azure_batch,
                azure_batch_vm_path=azure_batch_vm_path,
                old_expert_rules_zip_path=old_expert_path,
                new_expert_rules_zip_path=new_expert_path,
                ServicePrincipal_CertificateThumbprint=cert_thumbprint,
                ServicePrincipal_ApplicationId=app_id,
                vm_for_bench=vm_bench,
                vm_for_dev=vm_dev,
            )
            copy_latest_outputs(output_folder, segment, "PREC", country, new_model, today)

        # Stability
        for i, f in enumerate(stability_files, start=1):
            tag = "S_1" if i == 1 else f"S_{i}"
            runner.compute_validation_distribution(
                os.path.join(sample_path, f),
                save=True,
                tag=tag,
                azure_batch=azure_batch,
                azure_batch_vm_path=azure_batch_vm_path,
                old_expert_rules_zip_path=old_expert_path,
                new_expert_rules_zip_path=new_expert_path,
                ServicePrincipal_CertificateThumbprint=cert_thumbprint,
                ServicePrincipal_ApplicationId=app_id,
                vm_for_bench=vm_bench,
                vm_for_dev=vm_dev,
            )
            copy_latest_outputs(output_folder, segment, "STAB", country, new_model, today)

        # Save final reports
        runner.save_reports(weights=None, excel=True, pdf=False)

    # ---- Upload results to S3 ----
    s3_output_prefix = f"{s3_base}{output_folder_name}/"
    logger.info(f"Uploading results to S3: {s3_output_prefix}")
    s3_upload_dir(output_folder, s3_output_prefix)

    # ---- Cleanup ----
    shutil.rmtree(LOCAL_ROOT, ignore_errors=True)

    result = {
        "status": "completed",
        "country": country,
        "segment": segment,
        "version": version,
        "output_s3_prefix": f"s3://{S3_BUCKET}/{s3_output_prefix}",
    }

    logger.info(f"Execution completed: {json.dumps(result)}")
    return result
