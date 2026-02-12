"""
Headless Test Suite Runner — reads config JSON and executes tests locally.
Usage:
    python dashboard.py --config path/to/config.json   # runs a specific config
    python dashboard.py --watch                         # watches config folder for new files
    streamlit run dashboard.py                          # same, with Streamlit log UI
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
NETWORK_ROOT = r"\\sassrv04\DA_WWCC1\1_Global_Analytics_Consultancy\R1_2\PRODUCT\CE\01_Data\TEST_SUITE"
CONFIG_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "docker", "backend", "configs")
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


def run_from_config(config: dict):
    """Execute the test suite based on a config dictionary, using network share paths."""
    country = config["country"]
    segment = config["segment"]
    date = config["date"]
    version = config["version"]
    output_folder_name = config["output_folder_name"]
    data_root = config.get("data_root", f"{country}/{segment}/{date}")
    is_tagger = segment.lower() == "tagger"

    # Base path on network share
    base_path = os.path.join(NETWORK_ROOT, data_root.replace("/", os.sep))

    log(f"\n{'='*60}")
    log(f"🧪 Test Suite: {country} / {segment} / {date}")
    log(f"📦 Versione: {version} | Output: {output_folder_name}")
    log(f"📁 Base path: {base_path}")
    log(f"{'='*60}\n")

    # Verify base path exists
    if not os.path.exists(base_path):
        log(f"❌ ERRORE: Il percorso base non esiste: {base_path}")
        return

    # --- Resolve model paths ---
    model_dir = os.path.join(base_path, "model")

    if not is_tagger:
        old_model_path = os.path.join(model_dir, "prod", config["old_model"])
        new_model_path = os.path.join(model_dir, "develop", config["new_model"])

        # Verify models exist
        for p, label in [(old_model_path, "Old model (prod)"), (new_model_path, "New model (develop)")]:
            if not os.path.exists(p):
                log(f"❌ ERRORE: {label} non trovato: {p}")
                return
            log(f"✅ {label}: {p}")

        # Expert rules
        old_expert_path = None
        new_expert_path = None

        if config.get("old_expert_rules"):
            er_base = os.path.join(model_dir, "expertrules")
            if config.get("has_old_new_expert_structure"):
                old_expert_path = os.path.join(er_base, "old", config["old_expert_rules"])
                new_expert_path = os.path.join(er_base, "new", config.get("new_expert_rules", config["old_expert_rules"]))
            else:
                old_expert_path = os.path.join(er_base, config["old_expert_rules"])
                new_expert_path = os.path.join(er_base, config.get("new_expert_rules", config["old_expert_rules"]))

            for p, label in [(old_expert_path, "Expert OLD"), (new_expert_path, "Expert NEW")]:
                if p and os.path.exists(p):
                    log(f"✅ {label}: {p}")
                elif p:
                    log(f"⚠️ {label} non trovato: {p}")
    else:
        old_model_path = os.path.join(model_dir, config["old_model"])
        new_model_path = os.path.join(model_dir, config["new_model"])

        for p, label in [(old_model_path, "Old model"), (new_model_path, "New model")]:
            if not os.path.exists(p):
                log(f"❌ ERRORE: {label} non trovato: {p}")
                return
            log(f"✅ {label}: {p}")

    # --- Sample files ---
    sample_dir = os.path.join(base_path, "Sample")
    sample_files_config = config.get("sample_files", {})

    # --- Create output directory on network share ---
    output_dir = os.path.join(base_path, "output", output_folder_name)
    os.makedirs(output_dir, exist_ok=True)
    log(f"📁 Output directory: {output_dir}")

    # --- Run tests ---
    log("\n⏳ Esecuzione test in corso...\n")

    try:
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
                sample_path = os.path.join(sample_dir, f)
                log(f"🎯 Accuracy test {i}: {f}")
                if not os.path.exists(sample_path):
                    log(f"⚠️ File non trovato, skip: {sample_path}")
                    continue
                runner.compute_validation_scores(
                    sample_path,
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
                sample_path = os.path.join(sample_dir, f)
                log(f"🔍 Anomalies test: {f}")
                if not os.path.exists(sample_path):
                    log(f"⚠️ File non trovato, skip: {sample_path}")
                    continue
                runner.compute_validation_scores(
                    sample_path,
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
                sample_path = os.path.join(sample_dir, f)
                log(f"🎯 Precision test: {f}")
                if not os.path.exists(sample_path):
                    log(f"⚠️ File non trovato, skip: {sample_path}")
                    continue
                runner.compute_validation_scores(
                    sample_path,
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
                sample_path = os.path.join(sample_dir, f)
                log(f"📈 Stability test {i}: {f}")
                if not os.path.exists(sample_path):
                    log(f"⚠️ File non trovato, skip: {sample_path}")
                    continue
                runner.compute_validation_distribution(
                    sample_path,
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
                dist_path = os.path.join(sample_dir, distribution_file)
                log(f"📈 Tagger validation distribution: {distribution_file}")
                if not os.path.exists(dist_path):
                    log(f"⚠️ File non trovato: {dist_path}")
                else:
                    runner.compute_tagger_validation_distribution(
                        validation_data_path=dist_path,
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

        log(f"\n🎉 Test completati! Output salvato in: {output_dir}")

    except Exception as e:
        log(f"\n❌ ERRORE durante l'esecuzione: {str(e)}")
        import traceback
        log(traceback.format_exc())


def find_pending_configs():
    """Find config files in the config directory that haven't been processed."""
    if not os.path.exists(CONFIG_DIR):
        return []
    configs = []
    for f in os.listdir(CONFIG_DIR):
        if f.endswith(".json") and not f.endswith(".done.json"):
            done_marker = f.replace(".json", ".done")
            if not os.path.exists(os.path.join(CONFIG_DIR, done_marker)):
                configs.append(os.path.join(CONFIG_DIR, f))
    return configs


def mark_config_done(config_path: str):
    """Create a .done marker for a processed config."""
    done_path = config_path.replace(".json", ".done")
    with open(done_path, "w") as f:
        f.write("done")


# --- Main ---
def main():
    parser = argparse.ArgumentParser(description="Test Suite Runner (headless)")
    parser.add_argument("--config", help="Path to a local config JSON file")
    parser.add_argument("--watch", action="store_true", help="Watch config folder for pending configs")
    args = parser.parse_args()

    if args.config:
        # Run a specific config file
        log(f"📋 Caricamento config: {args.config}")
        with open(args.config, "r") as f:
            config = json.load(f)
        run_from_config(config)
    elif args.watch:
        # Watch mode: check for pending configs
        log(f"🔄 Watching cartella config: {CONFIG_DIR}")
        while True:
            configs = find_pending_configs()
            if configs:
                for config_path in configs:
                    log(f"\n📋 Trovata configurazione: {config_path}")
                    with open(config_path, "r") as f:
                        config = json.load(f)
                    run_from_config(config)
                    mark_config_done(config_path)
                    log(f"✅ Configurazione completata: {config_path}")
                break  # Exit after processing
            else:
                log("⏳ Nessuna configurazione pendente. Riprovo tra 5 secondi...")
                time.sleep(5)
    else:
        # Default: check once
        configs = find_pending_configs()
        if configs:
            config_path = configs[0]
            log(f"📋 Trovata configurazione: {config_path}")
            with open(config_path, "r") as f:
                config = json.load(f)
            run_from_config(config)
            mark_config_done(config_path)
            log("✅ Completato!")
        else:
            log(f"ℹ️  Nessuna configurazione pendente trovata in: {CONFIG_DIR}")
            log("   Usa la dashboard TSX per creare una nuova configurazione.")


if __name__ == "__main__":
    main()


# --- Streamlit UI mode ---
if HAS_STREAMLIT:
    st.title("🧪 Test Suite Runner")
    st.info(f"Questa dashboard legge le configurazioni da: {CONFIG_DIR}")

    if st.button("▶️ Cerca ed esegui configurazioni pendenti"):
        configs = find_pending_configs()
        if not configs:
            st.warning("Nessuna configurazione pendente trovata.")
        else:
            for config_path in configs:
                st.subheader(f"📋 {os.path.basename(config_path)}")
                with open(config_path, "r") as f:
                    config = json.load(f)
                st.json(config)
                with st.spinner("Esecuzione test..."):
                    run_from_config(config)
                mark_config_done(config_path)
                st.success(f"✅ Completato: {config_path}")
            st.balloons()
