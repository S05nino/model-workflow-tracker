import pandas as pd
import streamlit as st
import os
import sys
import datetime
import shutil
import glob
import json

# ============================================================
#  CONFIG LOADER
# ============================================================

def load_config(config_path="config.json"):
    try:
        with open(config_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        st.error(f"Errore nel leggere il file di configurazione: {e}")
        st.stop()


config = load_config("config.json")

# ============================================================
#  CONFIG PARAMETERS
# ============================================================

root_folder = config.get("root_folder")
azure_batch_vm_path = config.get("azure_batch_vm_path")
ServicePrincipal_CertificateThumbprint = config.get("ServicePrincipal_CertificateThumbprint")
ServicePrincipal_ApplicationId = config.get("ServicePrincipal_ApplicationId")

country = config.get("country")
segment = config.get("segment").capitalize()  # consumer → Consumer
version = config.get("version")
output_folder_name = config.get("output_folder_name")

sample_files_cfg = config.get("sample_files", {})
has_old_new_expert_structure = config.get("has_old_new_expert_structure", False)

st.sidebar.info(f"Root folder: {root_folder}")

# ============================================================
#  IMPORT TEST RUNNERS
# ============================================================

sys.path.append(r"C:\_git\CategorizationEnginePython")
sys.path.append(r"C:\_git\CategorizationEnginePython\CategorizationEngineTests\CETestSuite")

from suite_tests.testRunner import TestRunner
from suite_tests.testRunner_tagger import TestRunner as TestRunnerTagger


# ============================================================
#  UTILITY
# ============================================================

def safe_listdir(path):
    if os.path.isdir(path):
        return os.listdir(path)
    else:
        st.warning(f"⚠️ Cartella non trovata: {path}")
        return []


def get_batch_dir():
    """Trova automaticamente la cartella data/batch relativa al TestSuite."""
    import suite_tests
    suite_root = os.path.dirname(os.path.abspath(suite_tests.__file__))
    return os.path.join(suite_root, "data", "batch")


# ============================================================
#  COPY OUTPUTS
# ============================================================

def copy_latest_outputs(output_folder: str, segment: str, report_type: str,
                        country_code: str, model_name: str, date_str: str):

    messages = {
        "ACC": "Report di Accuracy generato!",
        "ANOM": "Report di Anomalie generato!",
        "PREC": "Report di Precision generato!",
        "STAB": "Report di Stabilità generato!"
    }
    suffix_map = {
        "ACC": "_ACC.xlsx",
        "ANOM": "_ANOM.xlsx",
        "PREC": "_PREC.xlsx",
        "STAB": "_STAB.xlsx"
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

    # Copia report Excel
    for root, dirs, files in os.walk(output_folder):
        if root != output_folder:
            for f in files:
                if suffix and f.endswith(suffix):
                    src = os.path.join(root, f)
                    new_name = f"report_{messages[report_type].split()[2]}_{country_code}_CE_{segment}_{value}_{date_str}.xlsx"
                    dst = os.path.join(output_folder, new_name)
                    try:
                        shutil.copy2(src, dst)
                        st.success(f"📄 {messages.get(report_type)} → {new_name}")
                    except Exception as e:
                        st.warning(f"⚠️ Non riesco a copiare {src}: {e}")

    # Copia batch CSV
    batch_dir = get_batch_dir()
    pattern = "*categorized.csv" if segment in ["Consumer", "Business"] else "*tagged.csv"
    files = glob.glob(os.path.join(batch_dir, pattern))

    if files:
        latest = max(files, key=os.path.getmtime)
        new_batch_name = f"{messages[report_type].split()[2]}_{country_code}_CE_{segment}_{value}_{date_str}.csv"
        dst = os.path.join(output_folder, new_batch_name)
        try:
            shutil.copy2(latest, dst)
            st.info(f"📄 File batch copiato: {new_batch_name}")
        except Exception as e:
            st.warning(f"⚠️ Non riesco a copiare {latest}: {e}")


# ============================================================
#  UI
# ============================================================

st.title("📊 Model Performance Test Suite Dashboard")
st.header(f"{country} → {segment}")

# ============================================================
#  PATHS
# ============================================================

country_path = os.path.join(root_folder, country)
segment_path = os.path.join(country_path, segment)

sample_path = os.path.join(segment_path, "sample")
model_path = os.path.join(segment_path, "model")

today = datetime.date.today().strftime("%y%m%d")

# ============================================================
#  MODELS & EXPERT RULES
# ============================================================

old_model = config.get("old_model")
new_model = config.get("new_model")

old_model_path = os.path.join(model_path, "prod", old_model)
new_model_path = os.path.join(model_path, "develop", new_model)

if has_old_new_expert_structure:
    old_expert_path = os.path.join(model_path, "expertrules", "old", config.get("old_expert_rules"))
    new_expert_path = os.path.join(model_path, "expertrules", "new", config.get("new_expert_rules"))
else:
    old_expert_path = os.path.join(model_path, "expertrules", config.get("old_expert_rules"))
    new_expert_path = os.path.join(model_path, "expertrules", config.get("new_expert_rules"))

# ============================================================
#  SAMPLE FILES
# ============================================================

accuracy_files = sample_files_cfg.get("accuracy", [])
anomalies_files = sample_files_cfg.get("anomalies", [])
precision_files = sample_files_cfg.get("precision", [])
stability_files = sample_files_cfg.get("stability", [])

# ============================================================
#  AZURE BATCH SETTINGS
# ============================================================

st.subheader("⚙️ Azure Batch Settings")
vm_bench = st.radio("VM for Benchmark", options=[1, 2, 3, 4], index=0, horizontal=True)
vm_dev = st.radio("VM for Development", options=[x for x in [1, 2, 3, 4] if x != vm_bench], index=0, horizontal=True)

azure_batch = True

# ============================================================
#  RUN TESTS
# ============================================================

if st.button("🚀 Run Tests"):

    output_folder = os.path.join(segment_path, output_folder_name)
    os.makedirs(output_folder, exist_ok=True)

    st.write("⏳ Running tests...")

    runner = TestRunner(
        old_model_path,
        new_model_path,
        output_folder,
        old_expert_path,
        new_expert_path
    )

    # --- Crossvalidation ---
    runner.compute_crossvalidation_score(
        old_expert_rules_zip_path=old_expert_path,
        new_expert_rules_zip_path=new_expert_path,
        save=True
    )

    # --- Accuracy ---
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
            ServicePrincipal_CertificateThumbprint=ServicePrincipal_CertificateThumbprint,
            ServicePrincipal_ApplicationId=ServicePrincipal_ApplicationId,
            vm_for_bench=vm_bench,
            vm_for_dev=vm_dev
        )
        copy_latest_outputs(output_folder, segment, "ACC", country, new_model, today)

    # --- Anomalie ---
    for f in anomalies_files:
        runner.compute_validation_scores(
            os.path.join(sample_path, f),
            save=True,
            tag="ANOM",
            azure_batch=azure_batch,
            azure_batch_vm_path=azure_batch_vm_path,
            old_expert_rules_zip_path=old_expert_path,
            new_expert_rules_zip_path=new_expert_path,
            ServicePrincipal_CertificateThumbprint=ServicePrincipal_CertificateThumbprint,
            ServicePrincipal_ApplicationId=ServicePrincipal_ApplicationId,
            vm_for_bench=vm_bench,
            vm_for_dev=vm_dev
        )
        copy_latest_outputs(output_folder, segment, "ANOM", country, new_model, today)

    # --- Precision ---
    for f in precision_files:
        runner.compute_validation_scores(
            os.path.join(sample_path, f),
            save=True,
            tag="PREC",
            azure_batch=azure_batch,
            azure_batch_vm_path=azure_batch_vm_path,
            old_expert_rules_zip_path=old_expert_path,
            new_expert_rules_zip_path=new_expert_path,
            ServicePrincipal_CertificateThumbprint=ServicePrincipal_CertificateThumbprint,
            ServicePrincipal_ApplicationId=ServicePrincipal_ApplicationId,
            vm_for_bench=vm_bench,
            vm_for_dev=vm_dev
        )
        copy_latest_outputs(output_folder, segment, "PREC", country, new_model, today)

    # --- Stability ---
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
            ServicePrincipal_CertificateThumbprint=ServicePrincipal_CertificateThumbprint,
            ServicePrincipal_ApplicationId=ServicePrincipal_ApplicationId,
            vm_for_bench=vm_bench,
            vm_for_dev=vm_dev
        )
        copy_latest_outputs(output_folder, segment, "STAB", country, new_model, today)

    # --- Save reports ---
    final = runner.save_reports(weights=None, excel=True, pdf=False)

    st.success("🎉 Tests completed!")

    # --- Show model_information ---
    report_path = os.path.join(runner.output_folder, runner.old_uid,
                               f"{runner.new_uid}_final_report_{runner.now}.xlsx")
    try:
        model_info_df = pd.read_excel(report_path, sheet_name="model_information")
        st.subheader("📄 Model Information")
        st.dataframe(model_info_df)
    except Exception as e:
        st.warning(f"⚠️ Impossibile leggere lo sheet 'model_information': {e}")
