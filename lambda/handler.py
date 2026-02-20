"""
TestSuite handler – runs locally OR on AWS Lambda.
Always uses S3 for input (download) and output (upload).

Usage:
  Local:   python handler.py --config /path/to/config.json
  Lambda:  Set CMD ["handler.handler"] in Dockerfile
"""

import os
import sys
import json
import glob
import shutil
import datetime
import logging
import argparse

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

# ============================================================
#  S3 HELPERS
# ============================================================

def _get_s3():
    import boto3
    return boto3.client("s3")


def s3_download_prefix(s3, bucket, prefix, local_dir):
    paginator = s3.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
        for obj in page.get("Contents", []):
            key = obj["Key"]
            rel = key[len(prefix):]
            if not rel or rel.endswith("/"):
                continue
            local_path = os.path.join(local_dir, rel)
            os.makedirs(os.path.dirname(local_path), exist_ok=True)
            logger.info(f"S3 download: s3://{bucket}/{key} -> {local_path}")
            s3.download_file(bucket, key, local_path)


def s3_upload_dir(s3, bucket, local_dir, prefix):
    for root, _dirs, files in os.walk(local_dir):
        for fname in files:
            local_path = os.path.join(root, fname)
            rel = os.path.relpath(local_path, local_dir)
            s3_key = prefix + rel.replace("\\", "/")
            logger.info(f"S3 upload: {local_path} -> s3://{bucket}/{s3_key}")
            s3.upload_file(local_path, bucket, s3_key)


# ============================================================
#  COPY OUTPUTS  (adapted from dashboard.py)
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

    batch_dir = _get_batch_dir()
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


def _get_batch_dir():
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
#  RESOLVE PATHS  (always S3-based)
# ============================================================

def resolve_paths(config):
    """
    Always download from S3 into a local temp directory, run tests there,
    then upload results back to S3.
    Returns (segment_path, sample_path, model_path, output_folder, date_str, cleanup_fn).
    """
    country = config["country"]
    segment = config["segment"].capitalize()
    data_root = config.get("data_root", f"{country}/{segment.lower()}")
    version = config.get("version", "x.x.x")
    output_folder_name = config.get("output_folder_name", "output")

    today = datetime.date.today().strftime("%y%m%d")

    s3_bucket = config.get("s3_bucket", os.environ.get("S3_BUCKET", ""))
    s3_prefix = config.get("s3_prefix", os.environ.get("S3_PREFIX", ""))

    if not s3_bucket or not s3_prefix:
        raise ValueError("s3_bucket and s3_prefix are required")

    local_root = "/tmp/TEST_SUITE"
    if os.path.exists(local_root):
        shutil.rmtree(local_root)

    s3 = _get_s3()
    s3_base = f"{s3_prefix}{data_root}/"
    local_base = os.path.join(local_root, data_root)

    # Download sample and model directories from S3
    for subdir in ["sample", "model"]:
        s3_download_prefix(s3, s3_bucket, f"{s3_base}{subdir}/", os.path.join(local_base, subdir))

    segment_path = local_base
    cleanup = lambda: shutil.rmtree(local_root, ignore_errors=True)

    sample_path = os.path.join(segment_path, "sample")
    model_path = os.path.join(segment_path, "model")
    output_folder = os.path.join(segment_path, output_folder_name)
    os.makedirs(output_folder, exist_ok=True)

    return segment_path, sample_path, model_path, output_folder, today, cleanup


# ============================================================
#  UPLOAD RESULTS
# ============================================================

def upload_results(config, output_folder):
    """Upload results to S3."""
    s3_bucket = config.get("s3_bucket")
    s3_prefix = config.get("s3_prefix")
    data_root = config.get("data_root", f"{config['country']}/{config['segment'].lower()}")
    output_folder_name = config.get("output_folder_name", "output")

    if not s3_bucket or not s3_prefix:
        logger.warning("No S3 config provided, skipping upload.")
        return

    try:
        s3 = _get_s3()
        s3_output_prefix = f"{s3_prefix}{data_root}/{output_folder_name}/"
        logger.info(f"Uploading results to s3://{s3_bucket}/{s3_output_prefix}")
        s3_upload_dir(s3, s3_bucket, output_folder, s3_output_prefix)
        logger.info("Upload complete!")
    except Exception as e:
        logger.error(f"Failed to upload results to S3: {e}")


# ============================================================
#  RUN TESTS
# ============================================================

def run_tests(config):
    """Core logic: download from S3, import TestRunner, execute tests, upload results."""
    country = config["country"]
    segment = config["segment"].capitalize()
    is_tagger = segment.lower() == "tagger"

    # Add CategorizationEnginePython to sys.path if provided
    ce_path = config.get("ce_python_path")
    if ce_path:
        paths_to_add = [
            ce_path,
            os.path.join(ce_path, "CategorizationEngineTests", "CETestSuite"),
        ]
        for p in paths_to_add:
            if p not in sys.path:
                sys.path.insert(0, p)
                logger.info(f"Added to sys.path: {p}")

    segment_path, sample_path, model_path, output_folder, today, cleanup = resolve_paths(config)

    old_model = config["old_model"]
    new_model = config["new_model"]
    old_expert_rules = config.get("old_expert_rules")
    new_expert_rules = config.get("new_expert_rules")
    has_old_new = config.get("has_old_new_expert_structure", False)
    sample_files_cfg = config.get("sample_files", {})

    azure_batch_vm_path = config.get("azure_batch_vm_path")
    cert_thumbprint = config.get("ServicePrincipal_CertificateThumbprint")
    app_id = config.get("ServicePrincipal_ApplicationId")
    vm_bench = config.get("vm_for_bench", 1)
    vm_dev = config.get("vm_for_dev", 2)

    # Resolve model paths
    if is_tagger:
        old_model_path = os.path.join(model_path, old_model)
        new_model_path = os.path.join(model_path, new_model)
        old_expert_path = None
        new_expert_path = None
    else:
        old_model_path = os.path.join(model_path, "prod", old_model)
        new_model_path = os.path.join(model_path, "develop", new_model)

        if old_expert_rules:
            sub = os.path.join("old", old_expert_rules) if has_old_new else old_expert_rules
            old_expert_path = os.path.join(model_path, "expertrules", sub)
        else:
            old_expert_path = None

        if new_expert_rules:
            sub = os.path.join("new", new_expert_rules) if has_old_new else new_expert_rules
            new_expert_path = os.path.join(model_path, "expertrules", sub)
        else:
            new_expert_path = None

    logger.info(f"Old model: {old_model_path}")
    logger.info(f"New model: {new_model_path}")

    azure_batch = True

    # Import TestRunner
    if is_tagger:
        from suite_tests.testRunner_tagger import TestRunner as TestRunnerTagger
        runner = TestRunnerTagger(old_model_path, new_model_path, output_folder)

        accuracy_files = [sample_files_cfg.get("distribution")] if sample_files_cfg.get("distribution") else []
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
        from suite_tests.testRunner import TestRunner
        runner = TestRunner(old_model_path, new_model_path, output_folder, old_expert_path, new_expert_path)

        runner.compute_crossvalidation_score(
            old_expert_rules_zip_path=old_expert_path,
            new_expert_rules_zip_path=new_expert_path,
            save=True,
        )

        accuracy_files = sample_files_cfg.get("accuracy", [])
        anomalies_files = sample_files_cfg.get("anomalies", [])
        precision_files = sample_files_cfg.get("precision", [])
        stability_files = sample_files_cfg.get("stability", [])

        batch_kwargs = dict(
            azure_batch=azure_batch,
            azure_batch_vm_path=azure_batch_vm_path,
            old_expert_rules_zip_path=old_expert_path,
            new_expert_rules_zip_path=new_expert_path,
            ServicePrincipal_CertificateThumbprint=cert_thumbprint,
            ServicePrincipal_ApplicationId=app_id,
            vm_for_bench=vm_bench,
            vm_for_dev=vm_dev,
        )

        for i, f in enumerate(accuracy_files, 1):
            runner.compute_validation_scores(os.path.join(sample_path, f), save=True, tag=f"A_{i}", **batch_kwargs)
            copy_latest_outputs(output_folder, segment, "ACC", country, new_model, today)

        for f in anomalies_files:
            runner.compute_validation_scores(os.path.join(sample_path, f), save=True, tag="ANOM", **batch_kwargs)
            copy_latest_outputs(output_folder, segment, "ANOM", country, new_model, today)

        for f in precision_files:
            runner.compute_validation_scores(os.path.join(sample_path, f), save=True, tag="PREC", **batch_kwargs)
            copy_latest_outputs(output_folder, segment, "PREC", country, new_model, today)

        for i, f in enumerate(stability_files, 1):
            runner.compute_validation_distribution(os.path.join(sample_path, f), save=True, tag=f"S_{i}", **batch_kwargs)
            copy_latest_outputs(output_folder, segment, "STAB", country, new_model, today)

        runner.save_reports(weights=None, excel=True, pdf=False)

    # Upload results to S3
    upload_results(config, output_folder)

    # Cleanup temp files
    cleanup()

    result = {
        "status": "completed",
        "country": country,
        "segment": segment,
        "version": config.get("version", "x.x.x"),
        "output_folder": output_folder,
    }
    logger.info(f"Execution completed: {json.dumps(result)}")
    return result


# ============================================================
#  ENTRY POINTS
# ============================================================

def handler(event, context):
    """AWS Lambda entry point."""
    logger.info(f"Lambda event: {json.dumps(event, default=str)}")
    return run_tests(event)


def main():
    """CLI entry point for local execution."""
    parser = argparse.ArgumentParser(description="Run TestSuite")
    parser.add_argument("--config", required=True, help="Path to config JSON file")
    args = parser.parse_args()

    with open(args.config, "r") as f:
        config = json.load(f)

    result = run_tests(config)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
