"""
Headless Test Suite Runner — reads config from S3 and executes tests.
Usage:
    python dashboard.py                          # polls S3 for new config files
    python dashboard.py --config path/to/config.json  # runs a specific local config
    streamlit run dashboard.py                    # same, with Streamlit log UI
"""

import json
import os
import sys
import datetime
import shutil
import glob
import tempfile
import time
import argparse

try:
    import boto3
except ImportError:
    print("❌ boto3 non trovato. Installa con: pip install boto3")
    sys.exit(1)

try:
    import streamlit as st
    HAS_STREAMLIT = True
except ImportError:
    HAS_STREAMLIT = False

# --- Import TestRunner ---
sys.path.append(r"C:\_git\CategorizationEnginePython")
sys.path.append(r"C:\_git\CategorizationEnginePython\CategorizationEngineTests\CETestSuite")
from suite_tests.testRunner import TestRunner
from suite_tests.testRunner_tagger import TestRunner as TestRunnerTagger

# --- Constants ---
BUCKET = "cateng"
S3_ROOT = "TEST_SUITE"
AZURE_BATCH = True
AZURE_BATCH_VM_PATH = r"C:\Users\kq5simmarine\AppData\Local\Categorization.Classifier.NoJWT\Utils\Categorization.Classifier.Batch.AzureDataScience"
CERT_THUMBPRINT = 'D0E4EB9FB0506DEF78ECF1283319760E980C1736'
APP_ID = '5fd0a365-b1c7-48c4-ba16-bdc211ddad84'


# --- Logging helper ---
def log(msg: str):
    """Log to Streamlit or stdout."""
    if HAS_STREAMLIT:
        st.write(msg)
    print(msg)


def get_s3_client():
    return boto3.client(
        "s3",
        region_name=os.environ.get("AWS_REGION", "eu-west-1"),
        aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.environ.get("AWS_SECRET_ACCESS_KEY"),
    )


def download_s3_file(s3, key: str, local_path: str):
    """Download a file from S3 to a local path."""
    os.makedirs(os.path.dirname(local_path), exist_ok=True)
    log(f"⬇️  Scarico {key} → {local_path}")
    s3.download_file(BUCKET, key, local_path)


def upload_folder_to_s3(s3, local_folder: str, s3_prefix: str):
    """Upload all files in a local folder to S3."""
    for root, dirs, files in os.walk(local_folder):
        for f in files:
            local_path = os.path.join(root, f)
            rel_path = os.path.relpath(local_path, local_folder)
            s3_key = f"{s3_prefix}{rel_path}".replace("\\", "/")
            log(f"⬆️  Carico {rel_path} → s3://{BUCKET}/{s3_key}")
            s3.upload_file(local_path, BUCKET, s3_key)


def find_pending_configs(s3, prefix: str = S3_ROOT + "/"):
    """Find config files that haven't been processed yet."""
    paginator = s3.get_paginator("list_objects_v2")
    configs = []
    for page in paginator.paginate(Bucket=BUCKET, Prefix=prefix):
        for obj in page.get("Contents", []):
            key = obj["Key"]
            if key.endswith(".json") and "/config_" in key:
                # Check if a corresponding .done marker exists
                done_key = key.replace(".json", ".done")
                try:
                    s3.head_object(Bucket=BUCKET, Key=done_key)
                except s3.exceptions.ClientError:
                    configs.append(key)
    return configs


def mark_config_done(s3, config_key: str):
    """Create a .done marker for a processed config."""
    done_key = config_key.replace(".json", ".done")
    s3.put_object(Bucket=BUCKET, Key=done_key, Body=b"done")


def run_from_config(config: dict, s3):
    """Execute the test suite based on a config dictionary."""
    country = config["country"]
    segment = config["segment"]
    date = config["date"]
    version = config["version"]
    output_folder_name = config["output_folder_name"]
    s3_root = config["s3_root"]
    is_tagger = segment.lower() == "tagger"

    log(f"\n{'='*60}")
    log(f"🧪 Test Suite: {country} / {segment} / {date}")
    log(f"📦 Versione: {version} | Output: {output_folder_name}")
    log(f"{'='*60}\n")

    # Create temp working directory
    work_dir = tempfile.mkdtemp(prefix=f"testsuite_{country}_{segment}_")
    log(f"📁 Directory di lavoro: {work_dir}")

    try:
        # --- Download models ---
        model_dir = os.path.join(work_dir, "model")

        if not is_tagger:
            prod_dir = os.path.join(model_dir, "prod")
            dev_dir = os.path.join(model_dir, "develop")
            os.makedirs(prod_dir, exist_ok=True)
            os.makedirs(dev_dir, exist_ok=True)

            old_model_key = f"{s3_root}/model/prod/{config['old_model']}"
            new_model_key = f"{s3_root}/model/develop/{config['new_model']}"
            old_model_path = os.path.join(prod_dir, config["old_model"])
            new_model_path = os.path.join(dev_dir, config["new_model"])

            download_s3_file(s3, old_model_key, old_model_path)
            download_s3_file(s3, new_model_key, new_model_path)

            # --- Download expert rules ---
            old_expert_path = None
            new_expert_path = None

            if config.get("old_expert_rules"):
                er_base = f"{s3_root}/model/expertrules"
                if config.get("has_old_new_expert_structure"):
                    er_old_key = f"{er_base}/old/{config['old_expert_rules']}"
                    er_new_key = f"{er_base}/new/{config['new_expert_rules']}"
                else:
                    er_old_key = f"{er_base}/{config['old_expert_rules']}"
                    er_new_key = f"{er_base}/{config['new_expert_rules']}"

                er_dir = os.path.join(model_dir, "expertrules")
                os.makedirs(er_dir, exist_ok=True)
                old_expert_path = os.path.join(er_dir, config["old_expert_rules"])
                new_expert_path = os.path.join(er_dir, config.get("new_expert_rules", config["old_expert_rules"]))

                download_s3_file(s3, er_old_key, old_expert_path)
                if config.get("new_expert_rules"):
                    download_s3_file(s3, er_new_key, new_expert_path)
        else:
            os.makedirs(model_dir, exist_ok=True)
            old_model_key = f"{s3_root}/model/{config['old_model']}"
            new_model_key = f"{s3_root}/model/{config['new_model']}"
            old_model_path = os.path.join(model_dir, config["old_model"])
            new_model_path = os.path.join(model_dir, config["new_model"])

            download_s3_file(s3, old_model_key, old_model_path)
            download_s3_file(s3, new_model_key, new_model_path)

        # --- Download sample files ---
        sample_dir = os.path.join(work_dir, "sample")
        os.makedirs(sample_dir, exist_ok=True)

        sample_files_config = config.get("sample_files", {})
        all_sample_files = set()

        if is_tagger:
            if sample_files_config.get("distribution"):
                all_sample_files.add(sample_files_config["distribution"])
            if sample_files_config.get("company_list"):
                cl_key = f"{s3_root}/sample/{sample_files_config['company_list']}"
                cl_path = os.path.join(sample_dir, sample_files_config["company_list"])
                download_s3_file(s3, cl_key, cl_path)
        else:
            for category in ["accuracy", "anomalies", "precision", "stability"]:
                for f in sample_files_config.get(category, []):
                    all_sample_files.add(f)

        for f in all_sample_files:
            sample_key = f"{s3_root}/sample/{f}"
            sample_path = os.path.join(sample_dir, f)
            download_s3_file(s3, sample_key, sample_path)

        # --- Create output directory ---
        output_dir = os.path.join(work_dir, "output")
        os.makedirs(output_dir, exist_ok=True)

        # --- Run tests ---
        log("\n⏳ Esecuzione test in corso...\n")

        if not is_tagger:
            runner = TestRunner(
                old_model_path,
                new_model_path,
                output_dir,
                old_expert_path,
                new_expert_path,
            )

            # Crossvalidation
            log("📊 Calcolo crossvalidation...")
            runner.compute_crossvalidation_score(
                old_expert_rules_zip_path=old_expert_path,
                new_expert_rules_zip_path=new_expert_path,
                save=True,
            )

            vm_bench = 1
            vm_dev = 2

            # Accuracy
            for i, f in enumerate(sample_files_config.get("accuracy", []), start=1):
                tag = f"A_{i}"
                log(f"🎯 Accuracy test {i}: {f}")
                runner.compute_validation_scores(
                    os.path.join(sample_dir, f),
                    save=True, tag=tag,
                    azure_batch=AZURE_BATCH,
                    azure_batch_vm_path=AZURE_BATCH_VM_PATH,
                    old_expert_rules_zip_path=old_expert_path,
                    new_expert_rules_zip_path=new_expert_path,
                    ServicePrincipal_CertificateThumbprint=CERT_THUMBPRINT,
                    ServicePrincipal_ApplicationId=APP_ID,
                    vm_for_bench=vm_bench, vm_for_dev=vm_dev,
                )

            # Anomalies
            for f in sample_files_config.get("anomalies", []):
                log(f"🔍 Anomalies test: {f}")
                runner.compute_validation_scores(
                    os.path.join(sample_dir, f),
                    save=True, tag="ANOM",
                    azure_batch=AZURE_BATCH,
                    azure_batch_vm_path=AZURE_BATCH_VM_PATH,
                    old_expert_rules_zip_path=old_expert_path,
                    new_expert_rules_zip_path=new_expert_path,
                    ServicePrincipal_CertificateThumbprint=CERT_THUMBPRINT,
                    ServicePrincipal_ApplicationId=APP_ID,
                    vm_for_bench=vm_bench, vm_for_dev=vm_dev,
                )

            # Precision
            for f in sample_files_config.get("precision", []):
                log(f"🎯 Precision test: {f}")
                runner.compute_validation_scores(
                    os.path.join(sample_dir, f),
                    save=True, tag="PREC",
                    azure_batch=AZURE_BATCH,
                    azure_batch_vm_path=AZURE_BATCH_VM_PATH,
                    old_expert_rules_zip_path=old_expert_path,
                    new_expert_rules_zip_path=new_expert_path,
                    ServicePrincipal_CertificateThumbprint=CERT_THUMBPRINT,
                    ServicePrincipal_ApplicationId=APP_ID,
                    vm_for_bench=vm_bench, vm_for_dev=vm_dev,
                )

            # Stability
            for i, f in enumerate(sample_files_config.get("stability", []), start=1):
                tag = f"S_{i}"
                log(f"📈 Stability test {i}: {f}")
                runner.compute_validation_distribution(
                    os.path.join(sample_dir, f),
                    save=True, tag=tag,
                    azure_batch=AZURE_BATCH,
                    azure_batch_vm_path=AZURE_BATCH_VM_PATH,
                    old_expert_rules_zip_path=old_expert_path,
                    new_expert_rules_zip_path=new_expert_path,
                    ServicePrincipal_CertificateThumbprint=CERT_THUMBPRINT,
                    ServicePrincipal_ApplicationId=APP_ID,
                    vm_for_bench=vm_bench, vm_for_dev=vm_dev,
                )

            # Save reports
            log("💾 Salvataggio report...")
            runner.save_reports(weights=None, excel=True, pdf=False)

        else:
            # Tagger
            runner = TestRunnerTagger(old_model_path, new_model_path, output_dir)

            log("📊 Tagger crossvalidation...")
            runner.compute_tagger_crossvalidation_score(save=True)

            distribution_file = sample_files_config.get("distribution")
            company_list = sample_files_config.get("company_list")
            path_list_companies = os.path.join(sample_dir, company_list) if company_list else None

            if distribution_file:
                log(f"📈 Tagger validation distribution: {distribution_file}")
                runner.compute_tagger_validation_distribution(
                    validation_data_path=os.path.join(sample_dir, distribution_file),
                    save=True,
                    azure_batch=AZURE_BATCH,
                    azure_batch_vm_path=AZURE_BATCH_VM_PATH,
                    path_list_companies=path_list_companies,
                    ServicePrincipal_CertificateThumbprint=CERT_THUMBPRINT,
                    ServicePrincipal_ApplicationId=APP_ID,
                    vm_for_bench=1, vm_for_dev=2,
                )

            log("💾 Salvataggio report tagger...")
            runner.save_tagger_reports(excel=True)

        # --- Upload output to S3 ---
        s3_output_prefix = f"{s3_root}/output/{output_folder_name}/"
        log(f"\n⬆️  Upload output su s3://{BUCKET}/{s3_output_prefix}")
        upload_folder_to_s3(s3, output_dir, s3_output_prefix)

        log("\n🎉 Test completati! Output caricato su S3.")

    finally:
        # Cleanup temp dir
        try:
            shutil.rmtree(work_dir)
            log(f"🧹 Pulizia directory temporanea: {work_dir}")
        except Exception:
            pass


# --- Main ---
def main():
    parser = argparse.ArgumentParser(description="Test Suite Runner (headless)")
    parser.add_argument("--config", help="Path to a local config JSON file")
    parser.add_argument("--poll", action="store_true", help="Poll S3 for pending config files")
    args = parser.parse_args()

    s3 = get_s3_client()

    if args.config:
        # Run a specific config file
        with open(args.config, "r") as f:
            config = json.load(f)
        run_from_config(config, s3)
    elif args.poll:
        # Poll mode: check for pending configs
        log("🔄 Polling S3 per configurazioni pendenti...")
        while True:
            configs = find_pending_configs(s3)
            if configs:
                for config_key in configs:
                    log(f"\n📋 Trovata configurazione: {config_key}")
                    # Download config
                    response = s3.get_object(Bucket=BUCKET, Key=config_key)
                    config = json.loads(response["Body"].read().decode("utf-8"))
                    # Run
                    run_from_config(config, s3)
                    # Mark done
                    mark_config_done(s3, config_key)
                    log(f"✅ Configurazione completata: {config_key}")
                break  # Exit after processing
            else:
                log("⏳ Nessuna configurazione pendente. Riprovo tra 5 secondi...")
                time.sleep(5)
    else:
        # Default: poll once
        configs = find_pending_configs(s3)
        if configs:
            config_key = configs[0]
            log(f"📋 Trovata configurazione: {config_key}")
            response = s3.get_object(Bucket=BUCKET, Key=config_key)
            config = json.loads(response["Body"].read().decode("utf-8"))
            run_from_config(config, s3)
            mark_config_done(s3, config_key)
            log("✅ Completato!")
        else:
            log("ℹ️  Nessuna configurazione pendente trovata su S3.")
            log("   Usa la dashboard TSX per creare una nuova configurazione.")


if __name__ == "__main__":
    main()


# --- Streamlit UI mode ---
if HAS_STREAMLIT:
    st.title("🧪 Test Suite Runner")
    st.info("Questa dashboard legge automaticamente le configurazioni da S3 e esegue i test.")

    if st.button("▶️ Cerca ed esegui configurazioni pendenti"):
        s3 = get_s3_client()
        configs = find_pending_configs(s3)
        if not configs:
            st.warning("Nessuna configurazione pendente trovata su S3.")
        else:
            for config_key in configs:
                st.subheader(f"📋 {config_key}")
                response = s3.get_object(Bucket=BUCKET, Key=config_key)
                config = json.loads(response["Body"].read().decode("utf-8"))
                st.json(config)
                with st.spinner("Esecuzione test..."):
                    run_from_config(config, s3)
                mark_config_done(s3, config_key)
                st.success(f"✅ Completato: {config_key}")
            st.balloons()
