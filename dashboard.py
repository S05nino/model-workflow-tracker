import pandas as pd
import streamlit as st
import os
import sys
import datetime
import shutil
import glob

# --- PATH ---
root_folder = os.environ.get("TEST_SUITE_ROOT", r"\\sassrv04\DA_WWCC1\1_Global_Analytics_Consultancy\R1_2\PRODUCT\CE\01_Data\TEST_SUITE")
st.sidebar.info(f"Root folder: {root_folder}")

# Import TestRunner
ce_python_path = os.environ.get("CE_PYTHON_PATH", r"C:\_git\CategorizationEnginePython")
sys.path.append(ce_python_path)
sys.path.append(os.path.join(ce_python_path, "CategorizationEngineTests", "CETestSuite"))
from suite_tests.testRunner import TestRunner
from suite_tests.testRunner_tagger import TestRunner as TestRunnerTagger

azure_batch = True
azure_batch_vm_path = r"C:\Users\kq5simmarine\AppData\Local\Categorization.Classifier.NoJWT\Utils\Categorization.Classifier.Batch.AzureDataScience"
ServicePrincipal_CertificateThumbprint = 'D0E4EB9FB0506DEF78ECF1283319760E980C1736'
ServicePrincipal_ApplicationId = '5fd0a365-b1c7-48c4-ba16-bdc211ddad84'


# --- Utility ---
def safe_listdir(path):
    if os.path.isdir(path):
        return os.listdir(path)
    else:
        st.warning(f"⚠️ Cartella non trovata: {path}")
        return []


# --- Funzione per copiare output ---
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

    batch_dir = r"C:\_git\CategorizationEnginePython\CategorizationEngineTests\CETestSuite\data\batch"
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


# --- UI ---
st.title("📊 Model Performance Test Suite Dashboard")

# --- Country selection ---
countries = [c for c in safe_listdir(root_folder) if os.path.isdir(os.path.join(root_folder, c))]
country = st.sidebar.selectbox("Select Country", countries)
country_path = os.path.join(root_folder, country)

# --- Segment selection ---
segment = st.sidebar.radio("Select source account type", ["Consumer", "Business", "Tagger"])
segment_path = os.path.join(country_path, segment)

st.header(f"{country} → {segment}")

# --- Paths ---
sample_path = os.path.join(segment_path, "sample")
model_path = os.path.join(segment_path, "model")

# --- Version + Output folder ---
version = st.text_input("Model version (x.x.x)", "x.x.x")
today = datetime.date.today().strftime("%y%m%d")


# --- Segment-specific logic ---
if segment in ["Consumer", "Business"]:

    # Expert Rules
    expertrules_path = os.path.join(model_path, "expertrules")
    expert_old_path = os.path.join(expertrules_path, "old")
    expert_new_path = os.path.join(expertrules_path, "new")

    # Caso 1: cartelle old/new esistono
    if os.path.isdir(expert_old_path) and os.path.isdir(expert_new_path):

        expert_old_files = safe_listdir(expert_old_path)
        expert_new_files = safe_listdir(expert_new_path)

        expert_old = st.selectbox("Old Expert Rules", expert_old_files) if expert_old_files else None
        expert_new = st.selectbox("New Expert Rules", expert_new_files) if expert_new_files else None

        old_expert_path = os.path.join(expert_old_path, expert_old) if expert_old else None
        new_expert_path = os.path.join(expert_new_path, expert_new) if expert_new else None

    # Caso 2: NON esistono old/new → usiamo i file nella cartella principale
    else:
        expert_files = [f for f in safe_listdir(expertrules_path) if f.endswith(".zip")]

        expert_selected_old = st.selectbox("Expert Rules (OLD)", expert_files) if expert_files else None
        expert_selected_new = st.selectbox("Expert Rules (NEW)", expert_files) if expert_files else None

        old_expert_path = os.path.join(expertrules_path, expert_selected_old) if expert_selected_old else None
        new_expert_path = os.path.join(expertrules_path, expert_selected_new) if expert_selected_new else None

    # Models
    prod_models_path = os.path.join(model_path, "prod")
    dev_models_path = os.path.join(model_path, "develop")

    prod_models = [f for f in safe_listdir(prod_models_path) if f.endswith(".zip")]
    dev_models = [f for f in safe_listdir(dev_models_path) if f.endswith(".zip")]

    old_model = st.selectbox("Old model (prod)", prod_models)
    new_model = st.selectbox("New model (develop)", dev_models)

    old_model_path = os.path.join(prod_models_path, old_model)
    new_model_path = os.path.join(dev_models_path, new_model)

    # Input files
    tsv_files = [f for f in safe_listdir(sample_path) if f.endswith(".tsv.gz")]

    accuracy_files = st.multiselect("Accuracy files", tsv_files)
    anomalies_files = st.multiselect("Anomalies files", tsv_files)
    precision_files = st.multiselect("Precision files", tsv_files)
    stability_files = st.multiselect("Stability files", tsv_files)

    # Azure Batch settings
    st.subheader("⚙️ Azure Batch Settings")
    vm_bench = st.radio("VM for Benchmark", options=[1, 2, 3, 4], index=0, horizontal=True)
    vm_dev = st.radio("VM for Development", options=[x for x in [1, 2, 3, 4] if x != vm_bench], index=0, horizontal=True)

    if st.button("🚀 Run Tests"):

        # Creazione cartella output
        output_folder = os.path.join(segment_path, f"{version}_{today}")
        os.makedirs(output_folder, exist_ok=True)

        # Modelli obbligatori
        if not (old_model_path and new_model_path):
            st.error("⚠️ Devi selezionare i modelli!")
            st.stop()

        # Almeno un file di input obbligatorio
        if not (accuracy_files or anomalies_files or precision_files or stability_files):
            st.error("⚠️ Devi selezionare almeno un file di input!")
            st.stop()

        # Regole opzionali → se non selezionate diventano None
        if not old_expert_path:
            old_expert_path = None
        if not new_expert_path:
            new_expert_path = None

        st.write("⏳ Running tests...")

        # Runner identico allo script
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

        # --- Show model_information instead of metrics table ---
        report_path = os.path.join(runner.output_folder, runner.old_uid,
                                   f"{runner.new_uid}_final_report_{runner.now}.xlsx")
        try:
            model_info_df = pd.read_excel(report_path, sheet_name="model_information")
            st.subheader("📄 Model Information")
            st.dataframe(model_info_df)
        except Exception as e:
            st.warning(f"⚠️ Impossibile leggere lo sheet 'model_information': {e}")


# --- TAGGER ---
elif segment == "Tagger":

    # --- Version ---
    version = st.text_input("Model version (x.x.x)", "1.0.0")
    today = datetime.date.today().strftime("%y%m%d")

    # --- Model paths ---
    old_model_path = model_path
    new_model_path = model_path

    old_models = [f for f in safe_listdir(old_model_path) if f.endswith(".zip")]
    new_models = [f for f in safe_listdir(new_model_path) if f.endswith(".zip")]

    old_model_zip = st.selectbox("Old Model (.zip)", old_models)
    new_model_zip = st.selectbox("New Model (.zip)", new_models)

    old_model_zip_path = os.path.join(old_model_path, old_model_zip)
    new_model_zip_path = os.path.join(new_model_path, new_model_zip)

    # --- Company normalization list ---
    company_lists = [f for f in safe_listdir(sample_path) if f.endswith("list_companies.xlsx")]
    path_list_companies = st.selectbox("Company Normalization List (.xlsx)", company_lists)
    path_list_companies = os.path.join(sample_path, path_list_companies)

    # --- Distribution data ---
    distribution_files = [f for f in safe_listdir(sample_path) if f.endswith(".tsv.gz")]
    distribution_data = st.selectbox("Distribution Data (.tsv.gz)", distribution_files)
    distribution_data_path = os.path.join(sample_path, distribution_data)

    # --- Azure Batch settings ---
    st.subheader("⚙️ Azure Batch Settings")
    vm_bench = st.radio("VM for Benchmark", options=[1, 2, 3, 4], index=0, horizontal=True)
    vm_dev = st.radio("VM for Development", options=[x for x in [1, 2, 3, 4] if x != vm_bench], index=0, horizontal=True)

    # --- Run Tagger Tests ---
    if st.button("🚀 Run Tagger Tests"):
        # Creazione cartella output SOLO al click
        output_folder = os.path.join(segment_path, f"{version}_{today}")
        os.makedirs(output_folder, exist_ok=True)

        st.write("⏳ Running Tagger tests...")

        # Runner corretto
        runner = TestRunnerTagger(
            old_model_zip_path,
            new_model_zip_path,
            output_folder
        )

        # --- Crossvalidation ---
        df_result_crossval = runner.compute_tagger_crossvalidation_score(
            save=True
        )

        # --- Validation distribution ---
        df_val, df_report = runner.compute_tagger_validation_distribution(
            validation_data_path=distribution_data_path,
            save=True,
            azure_batch=azure_batch,
            azure_batch_vm_path=azure_batch_vm_path,
            path_list_companies=path_list_companies,
            ServicePrincipal_CertificateThumbprint=ServicePrincipal_CertificateThumbprint,
            ServicePrincipal_ApplicationId=ServicePrincipal_ApplicationId,
            vm_for_bench=vm_bench,
            vm_for_dev=vm_dev
        )

        # --- Save reports ---
        final = runner.save_tagger_reports(excel=True)

        st.success("🎉 Tagger Tests completed!")

        # --- Show model_information instead of metrics table ---
        report_path = os.path.join(runner.output_folder, runner.old_uid,
                                   f"{runner.new_uid}_final_report_{runner.now}.xlsx")
        try:
            model_info_df = pd.read_excel(report_path, sheet_name="model_information")
            st.subheader("📄 Model Information")
            st.dataframe(model_info_df)
        except Exception as e:
            st.warning(f"⚠️ Impossibile leggere lo sheet 'model_information': {e}")
