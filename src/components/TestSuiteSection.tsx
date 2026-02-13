import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useState, useEffect, useCallback } from "react";
import { useLocalBrowser } from "@/hooks/useLocalBrowser";
import {
  Globe, Layers, FileArchive, FlaskConical,
  FolderOpen, Download, Loader2, RefreshCw, ChevronRight,
  AlertCircle, CheckCircle2, FileSpreadsheet, Play, Clock,
  Settings, Server
} from "lucide-react";

type Segment = "consumer" | "business" | "tagger";
type ValueSign = "OUT" | "IN";

interface FileSelection {
  accuracy: string[];
  anomalies: string[];
  precision: string[];
  stability: string[];
}

/** Country → available segments */
const COUNTRY_SEGMENTS: Record<string, Segment[]> = {
  "at-AT": ["consumer", "tagger"],
  "nl-BE": ["consumer", "business"],
  "cs-CZ": ["consumer", "business"],
  "de-DE": ["consumer", "tagger"],
  "es-ES": ["consumer", "business", "tagger"],
  "fr-FR": ["consumer", "business", "tagger"],
  "en-GB": ["consumer", "business", "tagger"],
  "en-IN": ["consumer", "business", "tagger"],
  "en-IE": ["consumer", "business"],
  "it-IT": ["consumer", "business", "tagger"],
  "es-MX": ["tagger"],
  "pl-PL": ["consumer"],
  "pt-PT": ["consumer"],
};

const COUNTRIES = Object.keys(COUNTRY_SEGMENTS).sort();

/** Build the segment_sign pattern from segment name + value sign */
function getSignPattern(segment: string, valueSign: ValueSign): string {
  const segCode = segment.toLowerCase() === "business" ? "3" : "1";
  const signCode = valueSign === "IN" ? "1" : "0";
  return `${segCode}_${signCode}`;
}

/** Filter file names that contain the expected segment_sign pattern */
function filterBySign(files: string[], pattern: string): string[] {
  return files.filter(f => f.includes(`_${pattern}_`));
}

export const TestSuiteSection = () => {
  const browser = useLocalBrowser();

  // Navigation state (no date selector)
  const [selectedCountry, setSelectedCountry] = useState<string>("");
  const [selectedSegment, setSelectedSegment] = useState<string>("");
  const [selectedValueSign, setSelectedValueSign] = useState<ValueSign | "">("");

  // Model state
  const [allProdModels, setAllProdModels] = useState<string[]>([]);
  const [allDevModels, setAllDevModels] = useState<string[]>([]);
  const [prodModels, setProdModels] = useState<string[]>([]);
  const [devModels, setDevModels] = useState<string[]>([]);
  const [selectedProdModel, setSelectedProdModel] = useState<string>("");
  const [selectedDevModel, setSelectedDevModel] = useState<string>("");

  // Expert rules state
  const [allExpertRulesOld, setAllExpertRulesOld] = useState<string[]>([]);
  const [allExpertRulesNew, setAllExpertRulesNew] = useState<string[]>([]);
  const [expertRulesOld, setExpertRulesOld] = useState<string[]>([]);
  const [expertRulesNew, setExpertRulesNew] = useState<string[]>([]);
  const [selectedExpertOld, setSelectedExpertOld] = useState<string>("");
  const [selectedExpertNew, setSelectedExpertNew] = useState<string>("");
  const [hasOldNewStructure, setHasOldNewStructure] = useState(false);

  // Sample files
  const [sampleFiles, setSampleFiles] = useState<string[]>([]);
  const [fileSelection, setFileSelection] = useState<FileSelection>({
    accuracy: [], anomalies: [], precision: [], stability: [],
  });

  // Output files
  const [outputFiles, setOutputFiles] = useState<{ name: string; key: string; size: number }[]>([]);

  // Version
  const [version, setVersion] = useState("x.x.x");

  // Tagger-specific
  const [companyLists, setCompanyLists] = useState<string[]>([]);
  const [selectedCompanyList, setSelectedCompanyList] = useState<string>("");

  const [loadingStep, setLoadingStep] = useState<string | null>(null);

  // Azure Batch settings
  const [azureBatchVmPath, setAzureBatchVmPath] = useState(
    String.raw`C:\Users\kq5simmarine\AppData\Local\Categorization.Classifier.NoJWT\Utils\Categorization.Classifier.Batch.AzureDataScience`
  );
  const [certThumbprint, setCertThumbprint] = useState("D0E4EB9FB0506DEF78ECF1283319760E980C1736");
  const [appId, setAppId] = useState("5fd0a365-b1c7-48c4-ba16-bdc211ddad84");
  const [vmForBench, setVmForBench] = useState<number>(1);
  const [vmForDev, setVmForDev] = useState<number>(2);

  const VM_OPTIONS = [1, 2, 3, 4];

  // Run test state
  const [isRunning, setIsRunning] = useState(false);
  const [runStatus, setRunStatus] = useState<string | null>(null);
  const [pollingForOutput, setPollingForOutput] = useState(false);
  const [runLogs, setRunLogs] = useState<{ time: string; msg: string; level: 'info' | 'error' | 'success' }[]>([]);
  const [pollProgress, setPollProgress] = useState(0);
  const [pollCount, setPollCount] = useState(0);

  const segments = selectedCountry ? (COUNTRY_SEGMENTS[selectedCountry] || []) : [];

  // When country changes, reset
  useEffect(() => {
    setSelectedSegment("");
    setSelectedValueSign("");
    resetSelections();
  }, [selectedCountry]);

  // When segment changes, load contents
  useEffect(() => {
    if (!selectedCountry || !selectedSegment) return;
    setSelectedValueSign("");
    resetSelections();
    loadContents();
  }, [selectedCountry, selectedSegment]);

  // When valueSign changes, filter models and rules
  useEffect(() => {
    if (!selectedValueSign || !selectedSegment) return;
    const pattern = getSignPattern(selectedSegment, selectedValueSign);

    const filteredProd = filterBySign(allProdModels, pattern);
    const filteredDev = filterBySign(allDevModels, pattern);
    const filteredEROld = filterBySign(allExpertRulesOld, pattern);
    const filteredERNew = filterBySign(allExpertRulesNew, pattern);

    setProdModels(filteredProd);
    setDevModels(filteredDev);
    setExpertRulesOld(filteredEROld);
    setExpertRulesNew(filteredERNew);

    setSelectedProdModel(filteredProd.length === 1 ? filteredProd[0] : "");
    setSelectedDevModel(filteredDev.length === 1 ? filteredDev[0] : "");
    setSelectedExpertOld(filteredEROld.length === 1 ? filteredEROld[0] : "");
    setSelectedExpertNew(filteredERNew.length === 1 ? filteredERNew[0] : "");
  }, [selectedValueSign, allProdModels, allDevModels, allExpertRulesOld, allExpertRulesNew, selectedSegment]);

  const resetSelections = () => {
    setAllProdModels([]);
    setAllDevModels([]);
    setProdModels([]);
    setDevModels([]);
    setSelectedProdModel("");
    setSelectedDevModel("");
    setAllExpertRulesOld([]);
    setAllExpertRulesNew([]);
    setExpertRulesOld([]);
    setExpertRulesNew([]);
    setSelectedExpertOld("");
    setSelectedExpertNew("");
    setSampleFiles([]);
    setFileSelection({ accuracy: [], anomalies: [], precision: [], stability: [] });
    setOutputFiles([]);
    setCompanyLists([]);
    setSelectedCompanyList("");
  };

  const basePath = `${selectedCountry}/${selectedSegment}`;
  const isTagger = selectedSegment.toLowerCase() === "tagger";

  const loadContents = async () => {
    setLoadingStep("contents");
    const country = selectedCountry;
    const segment = selectedSegment;
    const base = `${country}/${segment}`;

    const promises: Promise<void>[] = [];

    // Sample files
    promises.push(
      browser.listPath(`${base}/sample`).then(result => {
        const tsv = result.files.filter(f => f.name.endsWith(".tsv.gz")).map(f => f.name);
        setSampleFiles(tsv);
        if (segment.toLowerCase() === "tagger") {
          const lists = result.files.filter(f => f.name.endsWith("list_companies.xlsx")).map(f => f.name);
          setCompanyLists(lists);
        }
      })
    );

    if (segment.toLowerCase() !== "tagger") {
      // Prod models
      promises.push(
        browser.listPath(`${base}/model/prod`).then(result => {
          const zips = result.files.filter(f => f.name.endsWith(".zip")).map(f => f.name);
          setAllProdModels(zips);
          setProdModels(zips);
        })
      );

      // Dev models
      promises.push(
        browser.listPath(`${base}/model/develop`).then(result => {
          const zips = result.files.filter(f => f.name.endsWith(".zip")).map(f => f.name);
          setAllDevModels(zips);
          setDevModels(zips);
        })
      );

      // Expert rules
      promises.push(
        (async () => {
          const erResult = await browser.listPath(`${base}/model/expertrules`);
          const hasOldNew = erResult.folders.some(f => f.name === "old" || f.name === "new");
          setHasOldNewStructure(hasOldNew);

          if (hasOldNew) {
            const [oldResult, newResult] = await Promise.all([
              browser.listPath(`${base}/model/expertrules/old`),
              browser.listPath(`${base}/model/expertrules/new`),
            ]);
            setAllExpertRulesOld(oldResult.files.map(f => f.name));
            setAllExpertRulesNew(newResult.files.map(f => f.name));
            setExpertRulesOld(oldResult.files.map(f => f.name));
            setExpertRulesNew(newResult.files.map(f => f.name));
          } else {
            const zips = erResult.files.filter(f => f.name.endsWith(".zip")).map(f => f.name);
            setAllExpertRulesOld(zips);
            setAllExpertRulesNew(zips);
            setExpertRulesOld(zips);
            setExpertRulesNew(zips);
          }
        })()
      );
    } else {
      // Tagger: models directly in model/
      promises.push(
        browser.listPath(`${base}/model`).then(result => {
          const zips = result.files.filter(f => f.name.endsWith(".zip")).map(f => f.name);
          setAllProdModels(zips);
          setAllDevModels(zips);
          setProdModels(zips);
          setDevModels(zips);
        })
      );
    }

    // Output files
    promises.push(
      browser.listPath(`${base}/output`).then(result => {
        // List output subfolders (each is a run)
        setOutputFiles(result.files.map(f => ({ name: f.name, key: f.key, size: f.size })));
      })
    );

    await Promise.all(promises);
    setLoadingStep(null);
  };

  const toggleFileSelection = (category: keyof FileSelection, fileName: string) => {
    setFileSelection(prev => {
      const current = prev[category];
      const updated = current.includes(fileName)
        ? current.filter(f => f !== fileName)
        : [...current, fileName];
      return { ...prev, [category]: updated };
    });
  };

  const handleDownloadFile = async (key: string, name: string) => {
    const url = browser.getDownloadUrl(key);
    window.open(url, "_blank");
    toast.success(`Download avviato: ${name}`);
  };

  const hasFullSelection = selectedCountry && selectedSegment && (isTagger || selectedValueSign);

  const today = new Date();
  const dateStr = `${String(today.getFullYear()).slice(2)}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
  const outputFolderName = `${version}_${dateStr}`;

  const addLog = (msg: string, level: 'info' | 'error' | 'success' = 'info') => {
    const time = new Date().toLocaleTimeString('it-IT');
    setRunLogs(prev => [...prev, { time, msg, level }]);
  };

  const handleRunTest = async () => {
    setRunLogs([]);
    setPollProgress(0);
    setPollCount(0);

    if (!selectedProdModel || !selectedDevModel) {
      toast.error("Devi selezionare entrambi i modelli (prod e develop)");
      return;
    }
    if (version === "x.x.x" || !version) {
      toast.error("Inserisci la versione del modello");
      return;
    }

    const config: Record<string, unknown> = {
      root_folder: `C:\\_git\\model-workflow-tracker\\data\\TEST_SUITE`,
      azure_batch_vm_path: azureBatchVmPath,
      ServicePrincipal_CertificateThumbprint: certThumbprint,
      ServicePrincipal_ApplicationId: appId,
      country: selectedCountry,
      segment: selectedSegment,
      value_sign: selectedValueSign,
      sign_pattern: !isTagger ? getSignPattern(selectedSegment, selectedValueSign as ValueSign) : null,
      version,
      output_folder_name: `output/${outputFolderName}`,
      old_model: selectedProdModel,
      new_model: selectedDevModel,
      old_expert_rules: selectedExpertOld && selectedExpertOld !== "__none__" ? selectedExpertOld : null,
      new_expert_rules: selectedExpertNew && selectedExpertNew !== "__none__" ? selectedExpertNew : null,
      has_old_new_expert_structure: hasOldNewStructure,
      sample_files: isTagger
        ? { distribution: fileSelection.accuracy[0] || null, company_list: selectedCompanyList || null }
        : fileSelection,
      data_root: basePath,
      vm_for_bench: vmForBench,
      vm_for_dev: vmForDev,
      created_at: new Date().toISOString(),
    };

    setIsRunning(true);
    setRunStatus("Salvataggio configurazione...");
    addLog("📝 Preparazione configurazione test...");
    addLog(`📍 Country: ${selectedCountry}, Segmento: ${selectedSegment}, Value Sign: ${selectedValueSign}`);
    addLog(`📦 Old Model: ${selectedProdModel}`);
    addLog(`📦 New Model: ${selectedDevModel}`);

    const configFilename = `config_${outputFolderName}.json`;
    addLog(`💾 Salvataggio config: ${configFilename}`);

    const result = await browser.saveConfig(configFilename, config);

    if (!result.ok) {
      const errMsg = result.error || "Errore sconosciuto nel salvataggio della configurazione";
      addLog(`❌ Errore salvataggio configurazione: ${errMsg}`, 'error');
      toast.error("Errore nel salvataggio della configurazione", {
        description: errMsg,
        duration: 10000,
      });
      setIsRunning(false);
      setRunStatus(`Errore: ${errMsg}`);
      return;
    }

    addLog(`✅ Configurazione salvata: ${result.path}`, 'success');
    toast.success("Configurazione salvata", {
      description: `File: ${configFilename}`,
    });

    // Save config.json to host via backend and open Streamlit
    addLog("🚀 Salvataggio config.json e avvio Streamlit...");
    setRunStatus("Salvataggio config.json...");
    try {
      const API_BASE = import.meta.env.VITE_BACKEND_URL || '';
      const runRes = await fetch(`${API_BASE}/api/testsuite/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      });
      const runData = await runRes.json();
      if (runData.ok) {
        addLog(`✅ config.json salvato in: ${runData.configPath}`, 'success');
        
        // Open Streamlit in a new browser tab
        const streamlitUrl = 'http://localhost:8501';
        addLog(`🌐 Apertura Streamlit: ${streamlitUrl}`);
        window.open(streamlitUrl, '_blank');
        
        toast.success("config.json salvato!", {
          description: "Streamlit aperto in una nuova scheda. Assicurati che sia in esecuzione: streamlit run dashboard.py",
        });
        setRunStatus("config.json salvato. Streamlit aperto in nuova scheda.");
        addLog("✅ Controlla la scheda Streamlit per l'andamento dei test.", 'success');
      } else {
        addLog(`⚠️ Errore: ${runData.error}`, 'error');
        toast.error("Errore nel salvataggio della configurazione");
      }
    } catch (err: any) {
      addLog(`⚠️ Errore connessione: ${err.message}`, 'error');
      toast.error("Errore di connessione al backend");
    }

    setIsRunning(false);
  };

  return (
    <div className="space-y-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FlaskConical className="w-6 h-6 text-primary" />
            Test Suite Dashboard
          </h2>
          <p className="text-sm text-muted-foreground">
            Seleziona country e segmento, popola le cartelle con modelli e sample, poi lancia i test
          </p>
        </div>
        {selectedCountry && selectedSegment && (
          <Button variant="outline" size="sm" onClick={loadContents} disabled={!!loadingStep}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loadingStep ? 'animate-spin' : ''}`} />
            Ricarica
          </Button>
        )}
      </div>

      {/* Step 1: Country + Segment + Value Sign */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="w-4 h-4" />
            Selezione Ambiente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Country */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Country</label>
              <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona country" />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Segment */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Segmento</label>
              <Select
                value={selectedSegment}
                onValueChange={setSelectedSegment}
                disabled={!selectedCountry}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona segmento" />
                </SelectTrigger>
                <SelectContent>
                  {segments.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Value Sign (IN/OUT) */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Value Sign</label>
              <Select
                value={selectedValueSign}
                onValueChange={(v) => setSelectedValueSign(v as ValueSign)}
                disabled={!selectedSegment || isTagger}
              >
                <SelectTrigger>
                  <SelectValue placeholder={isTagger ? "N/A" : "Seleziona IN/OUT"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OUT">
                    OUT {selectedSegment && !isTagger && (
                      <span className="text-muted-foreground ml-1">({getSignPattern(selectedSegment, "OUT")})</span>
                    )}
                  </SelectItem>
                  <SelectItem value="IN">
                    IN {selectedSegment && !isTagger && (
                      <span className="text-muted-foreground ml-1">({getSignPattern(selectedSegment, "IN")})</span>
                    )}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Breadcrumb */}
          {selectedCountry && (
            <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
              <FolderOpen className="w-3 h-3" />
              <span>data/TEST_SUITE</span>
              <ChevronRight className="w-3 h-3" />
              <span className="text-foreground font-medium">{selectedCountry}</span>
              {selectedSegment && (
                <>
                  <ChevronRight className="w-3 h-3" />
                  <span className="text-foreground font-medium">{selectedSegment}</span>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Loading indicator */}
      {loadingStep === "contents" && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <span className="text-sm">Caricamento contenuti cartella...</span>
        </div>
      )}

      {/* Step 2: Models & Rules */}
      {hasFullSelection && loadingStep !== "contents" && (
        <>
          {/* Models */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileArchive className="w-4 h-4" />
                Modelli
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    {isTagger ? "Old Model (.zip)" : "Old model (prod)"}
                  </label>
                  <Select value={selectedProdModel} onValueChange={setSelectedProdModel}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona modello" />
                    </SelectTrigger>
                    <SelectContent>
                      {prodModels.map(m => (
                        <SelectItem key={m} value={m}>
                          <span className="font-mono text-xs">{m}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {prodModels.length === 0 && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Nessun modello trovato nella cartella
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    {isTagger ? "New Model (.zip)" : "New model (develop)"}
                  </label>
                  <Select value={selectedDevModel} onValueChange={setSelectedDevModel}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona modello" />
                    </SelectTrigger>
                    <SelectContent>
                      {devModels.map(m => (
                        <SelectItem key={m} value={m}>
                          <span className="font-mono text-xs">{m}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {devModels.length === 0 && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Nessun modello trovato nella cartella
                    </p>
                  )}
                </div>
              </div>

              {/* Version input */}
              <div className="mt-4 max-w-xs space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Model version</label>
                <Input
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  placeholder="x.x.x"
                  className="font-mono"
                />
              </div>
            </CardContent>
          </Card>

          {/* Expert Rules (Consumer/Business only) */}
          {!isTagger && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Layers className="w-4 h-4" />
                  Expert Rules
                  {hasOldNewStructure && (
                    <Badge variant="outline" className="text-xs ml-2">struttura old/new</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Expert Rules (OLD)</label>
                    <Select value={selectedExpertOld} onValueChange={setSelectedExpertOld}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona (opzionale)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Nessuno</SelectItem>
                        {expertRulesOld.map(f => (
                          <SelectItem key={f} value={f}>
                            <span className="font-mono text-xs">{f}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Expert Rules (NEW)</label>
                    <Select value={selectedExpertNew} onValueChange={setSelectedExpertNew}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona (opzionale)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Nessuno</SelectItem>
                        {expertRulesNew.map(f => (
                          <SelectItem key={f} value={f}>
                            <span className="font-mono text-xs">{f}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tagger: company list */}
          {isTagger && companyLists.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Company Normalization List</CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={selectedCompanyList} onValueChange={setSelectedCompanyList}>
                  <SelectTrigger className="max-w-md">
                    <SelectValue placeholder="Seleziona lista" />
                  </SelectTrigger>
                  <SelectContent>
                    {companyLists.map(f => (
                      <SelectItem key={f} value={f}>
                        <span className="font-mono text-xs">{f}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          )}

          {/* Sample files selection */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4" />
                File di Input (sample)
                {sampleFiles.length > 0 && (
                  <Badge variant="secondary" className="text-xs">{sampleFiles.length} file</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sampleFiles.length === 0 ? (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Nessun file .tsv.gz trovato nella cartella sample
                </p>
              ) : isTagger ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Distribution Data (.tsv.gz)</label>
                  <Select
                    value={fileSelection.accuracy[0] || ""}
                    onValueChange={(v) => setFileSelection(prev => ({ ...prev, accuracy: [v] }))}
                  >
                    <SelectTrigger className="max-w-md">
                      <SelectValue placeholder="Seleziona file" />
                    </SelectTrigger>
                    <SelectContent>
                      {sampleFiles.map(f => (
                        <SelectItem key={f} value={f}>
                          <span className="font-mono text-xs">{f}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {(["accuracy", "anomalies", "precision", "stability"] as const).map(category => (
                    <div key={category} className="space-y-2">
                      <label className="text-sm font-medium capitalize flex items-center gap-2">
                        {category}
                        {fileSelection[category].length > 0 && (
                          <Badge variant="default" className="text-xs">
                            {fileSelection[category].length}
                          </Badge>
                        )}
                      </label>
                      <div className="space-y-1 max-h-40 overflow-y-auto rounded-md border p-2">
                        {sampleFiles.map(file => (
                          <label key={file} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/50 rounded p-1">
                            <Checkbox
                              checked={fileSelection[category].includes(file)}
                              onCheckedChange={() => toggleFileSelection(category, file)}
                            />
                            <span className="font-mono truncate">{file}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Azure Batch Settings */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Server className="w-4 h-4" />
                Azure Batch Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Azure Batch VM Path</label>
                <Input
                  value={azureBatchVmPath}
                  onChange={(e) => setAzureBatchVmPath(e.target.value)}
                  placeholder="C:\path\to\batch"
                  className="font-mono text-xs"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Certificate Thumbprint</label>
                  <Input
                    value={certThumbprint}
                    onChange={(e) => setCertThumbprint(e.target.value)}
                    placeholder="Thumbprint"
                    className="font-mono text-xs"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Application ID</label>
                  <Input
                    value={appId}
                    onChange={(e) => setAppId(e.target.value)}
                    placeholder="App ID"
                    className="font-mono text-xs"
                  />
                </div>
              </div>

              {/* VM selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">VM for Benchmark</label>
                  <div className="flex gap-3">
                    {VM_OPTIONS.map(vm => (
                      <label key={`bench-${vm}`} className="flex items-center gap-1.5 text-sm cursor-pointer">
                        <Checkbox
                          checked={vmForBench === vm}
                          disabled={vmForDev === vm}
                          onCheckedChange={(checked) => {
                            if (checked) setVmForBench(vm);
                          }}
                        />
                        <span className={vmForDev === vm ? 'text-muted-foreground line-through' : ''}>{vm}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">VM for Development</label>
                  <div className="flex gap-3">
                    {VM_OPTIONS.map(vm => (
                      <label key={`dev-${vm}`} className="flex items-center gap-1.5 text-sm cursor-pointer">
                        <Checkbox
                          checked={vmForDev === vm}
                          disabled={vmForBench === vm}
                          onCheckedChange={(checked) => {
                            if (checked) setVmForDev(vm);
                          }}
                        />
                        <span className={vmForBench === vm ? 'text-muted-foreground line-through' : ''}>{vm}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Run summary / config recap */}
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Riepilogo Configurazione</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground block">Country</span>
                  <span className="font-medium">{selectedCountry || "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Segmento</span>
                  <span className="font-medium">{selectedSegment || "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Value Sign</span>
                  <span className="font-medium">{selectedValueSign || "—"} {selectedValueSign && !isTagger ? `(${getSignPattern(selectedSegment, selectedValueSign as ValueSign)})` : ""}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Versione</span>
                  <span className="font-mono font-medium">{version}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Old Model</span>
                  <span className="font-mono text-xs">{selectedProdModel || "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">New Model</span>
                  <span className="font-mono text-xs">{selectedDevModel || "—"}</span>
                </div>
                {!isTagger && (
                  <>
                    <div>
                      <span className="text-muted-foreground block">Expert OLD</span>
                      <span className="font-mono text-xs">{selectedExpertOld && selectedExpertOld !== "__none__" ? selectedExpertOld : "—"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Expert NEW</span>
                      <span className="font-mono text-xs">{selectedExpertNew && selectedExpertNew !== "__none__" ? selectedExpertNew : "—"}</span>
                    </div>
                  </>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-3">
                <div>
                  <span className="text-muted-foreground block">VM Benchmark</span>
                  <span className="font-medium">{vmForBench}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">VM Development</span>
                  <span className="font-medium">{vmForDev}</span>
                </div>
              </div>

              <div className="mt-3 text-xs text-muted-foreground">
                Output folder: <code className="font-mono bg-muted px-1 rounded">{basePath}/output/{outputFolderName}/</code>
              </div>

              {!isTagger && (
                <div className="mt-1 text-xs text-muted-foreground">
                  File selezionati: Accuracy ({fileSelection.accuracy.length}), Anomalie ({fileSelection.anomalies.length}), Precision ({fileSelection.precision.length}), Stabilità ({fileSelection.stability.length})
                </div>
              )}

              <Separator className="my-4" />

              <div className="flex items-center gap-4">
                <Button
                  onClick={handleRunTest}
                  disabled={isRunning || !selectedProdModel || !selectedDevModel || version === "x.x.x"}
                  className="gap-2"
                  size="lg"
                >
                  {isRunning ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  {isRunning ? "In esecuzione..." : "🚀 Run Tests"}
                </Button>

                {runStatus && (
                  <div className={`flex items-center gap-2 text-sm ${pollingForOutput ? 'text-amber-600' : runStatus.includes('Errore') ? 'text-destructive' : 'text-emerald-600'}`}>
                    {pollingForOutput && <Clock className="w-4 h-4 animate-pulse" />}
                    {!pollingForOutput && runStatus.includes("completati") && <CheckCircle2 className="w-4 h-4" />}
                    {runStatus.includes("Errore") && <AlertCircle className="w-4 h-4" />}
                    {runStatus}
                  </div>
                )}
              </div>

              {/* Progress bar during polling */}
              {pollingForOutput && (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Polling per output (ogni 10s)...</span>
                    <span>Check #{pollCount} • {Math.floor(pollCount * 10 / 60)} min</span>
                  </div>
                  <Progress value={pollProgress} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    Output atteso in: <code className="font-mono bg-muted px-1 rounded">{basePath}/output/{outputFolderName}/</code>
                  </p>
                </div>
              )}

              {/* Log panel */}
              {runLogs.length > 0 && (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Log esecuzione</label>
                    <Button variant="ghost" size="sm" onClick={() => setRunLogs([])}>
                      Pulisci
                    </Button>
                  </div>
                  <div className="max-h-48 overflow-y-auto rounded-md border bg-muted/30 p-3 space-y-1 font-mono text-xs">
                    {runLogs.map((log, i) => (
                      <div
                        key={i}
                        className={`${
                          log.level === 'error' ? 'text-destructive' :
                          log.level === 'success' ? 'text-emerald-600' :
                          'text-muted-foreground'
                        }`}
                      >
                        <span className="opacity-50">[{log.time}]</span> {log.msg}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Output files */}
          {outputFiles.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  Output ({outputFiles.length} file)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {outputFiles.map(file => (
                    <div
                      key={file.key}
                      className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 group"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileSpreadsheet className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="font-mono text-xs truncate">{file.name}</span>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {(file.size / 1024).toFixed(0)} KB
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleDownloadFile(file.key, file.name)}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};
