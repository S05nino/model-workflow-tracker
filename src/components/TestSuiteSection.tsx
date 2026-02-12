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
  Globe, Layers, Calendar, FileArchive, FlaskConical,
  FolderOpen, Download, Loader2, RefreshCw, ChevronRight,
  AlertCircle, CheckCircle2, FileSpreadsheet, Play, Clock
} from "lucide-react";

type Segment = "consumer" | "business" | "tagger";
type ValueSign = "OUT" | "IN";

interface FileSelection {
  accuracy: string[];
  anomalies: string[];
  precision: string[];
  stability: string[];
}

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

  // Navigation state
  const [countries, setCountries] = useState<string[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string>("");
  const [segments, setSegments] = useState<string[]>([]);
  const [selectedSegment, setSelectedSegment] = useState<string>("");
  const [dates, setDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedValueSign, setSelectedValueSign] = useState<ValueSign | "">("");

  // Model state - raw (all files) and filtered
  const [allProdModels, setAllProdModels] = useState<string[]>([]);
  const [allDevModels, setAllDevModels] = useState<string[]>([]);
  const [prodModels, setProdModels] = useState<string[]>([]);
  const [devModels, setDevModels] = useState<string[]>([]);
  const [selectedProdModel, setSelectedProdModel] = useState<string>("");
  const [selectedDevModel, setSelectedDevModel] = useState<string>("");

  // Expert rules state - raw and filtered
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

  // Run test state
  const [isRunning, setIsRunning] = useState(false);
  const [runStatus, setRunStatus] = useState<string | null>(null);
  const [pollingForOutput, setPollingForOutput] = useState(false);
  const [runLogs, setRunLogs] = useState<{ time: string; msg: string; level: 'info' | 'error' | 'success' }[]>([]);
  const [pollProgress, setPollProgress] = useState(0);
  const [pollCount, setPollCount] = useState(0);

  // Load countries on mount
  useEffect(() => {
    loadCountries();
  }, []);

  const loadCountries = async () => {
    setLoadingStep("countries");
    const result = await browser.listCountries();
    setCountries(result.folders.map(f => f.name).sort());
    setLoadingStep(null);
  };

  // When country changes, load segments
  useEffect(() => {
    if (!selectedCountry) return;
    setSelectedSegment("");
    setSelectedDate("");
    setSelectedValueSign("");
    resetSelections();
    (async () => {
      setLoadingStep("segments");
      const result = await browser.listSegments(selectedCountry);
      setSegments(result.folders.map(f => f.name).sort());
      setLoadingStep(null);
    })();
  }, [selectedCountry]);

  // When segment changes, load dates
  useEffect(() => {
    if (!selectedCountry || !selectedSegment) return;
    setSelectedDate("");
    setSelectedValueSign("");
    resetSelections();
    (async () => {
      setLoadingStep("dates");
      const result = await browser.listDates(selectedCountry, selectedSegment);
      setDates(result.folders.map(f => f.name).sort().reverse());
      setLoadingStep(null);
    })();
  }, [selectedCountry, selectedSegment]);

  // When date changes, load models + samples + expert rules
  useEffect(() => {
    if (!selectedCountry || !selectedSegment || !selectedDate) return;
    setSelectedValueSign("");
    resetSelections();
    loadDateContents();
  }, [selectedCountry, selectedSegment, selectedDate]);

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

    // Auto-select if only one match
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

  const loadDateContents = async () => {
    setLoadingStep("contents");
    const country = selectedCountry;
    const segment = selectedSegment;
    const date = selectedDate;

    const isTagger = segment.toLowerCase() === "tagger";

    // Load in parallel
    const promises: Promise<void>[] = [];

    // Sample files
    promises.push(
      browser.listSubfolder(country, segment, date, "Sample").then(result => {
        const tsv = result.files.filter(f => f.name.endsWith(".tsv.gz")).map(f => f.name);
        setSampleFiles(tsv);
        if (!isTagger) {
          // nothing extra
        } else {
          const lists = result.files.filter(f => f.name.endsWith("list_companies.xlsx")).map(f => f.name);
          setCompanyLists(lists);
        }
      })
    );

    if (!isTagger) {
      // Prod models
      promises.push(
        browser.listModelSubfolder(country, segment, date, "prod").then(result => {
          const zips = result.files.filter(f => f.name.endsWith(".zip")).map(f => f.name);
          setAllProdModels(zips);
          setProdModels(zips);
        })
      );

      // Dev models
      promises.push(
        browser.listModelSubfolder(country, segment, date, "develop").then(result => {
          const zips = result.files.filter(f => f.name.endsWith(".zip")).map(f => f.name);
          setAllDevModels(zips);
          setDevModels(zips);
        })
      );

      // Expert rules - check for old/new structure
      promises.push(
        (async () => {
          const erResult = await browser.listModelSubfolder(country, segment, date, "expertrules");
          const hasOldNew = erResult.folders.some(f => f.name === "old" || f.name === "new");
          setHasOldNewStructure(hasOldNew);

          if (hasOldNew) {
            const [oldResult, newResult] = await Promise.all([
              browser.listPath(`${country}/${segment}/${date}/model/expertrules/old`),
              browser.listPath(`${country}/${segment}/${date}/model/expertrules/new`),
            ]);
            const oldFiles = oldResult.files.map(f => f.name);
            const newFiles = newResult.files.map(f => f.name);
            setAllExpertRulesOld(oldFiles);
            setAllExpertRulesNew(newFiles);
            setExpertRulesOld(oldFiles);
            setExpertRulesNew(newFiles);
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
      // Tagger: models are directly in model/
      promises.push(
        browser.listSubfolder(country, segment, date, "model").then(result => {
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
      browser.listSubfolder(country, segment, date, "output").then(result => {
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

  const isTagger = selectedSegment.toLowerCase() === "tagger";
  const hasFullSelection = selectedCountry && selectedSegment && selectedDate && (isTagger || selectedValueSign);

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
      country: selectedCountry,
      segment: selectedSegment,
      date: selectedDate,
      value_sign: selectedValueSign,
      sign_pattern: !isTagger ? getSignPattern(selectedSegment, selectedValueSign as ValueSign) : null,
      version,
      output_folder_name: outputFolderName,
      old_model: selectedProdModel,
      new_model: selectedDevModel,
      old_expert_rules: selectedExpertOld && selectedExpertOld !== "__none__" ? selectedExpertOld : null,
      new_expert_rules: selectedExpertNew && selectedExpertNew !== "__none__" ? selectedExpertNew : null,
      has_old_new_expert_structure: hasOldNewStructure,
      sample_files: isTagger
        ? { distribution: fileSelection.accuracy[0] || null, company_list: selectedCompanyList || null }
        : fileSelection,
      data_root: `${selectedCountry}/${selectedSegment}/${selectedDate}`,
      created_at: new Date().toISOString(),
    };

    setIsRunning(true);
    setRunStatus("Salvataggio configurazione locale...");
    addLog("📝 Preparazione configurazione test...");
    addLog(`📍 Country: ${selectedCountry}, Segmento: ${selectedSegment}, Data: ${selectedDate}, Value Sign: ${selectedValueSign}`);
    addLog(`📦 Old Model: ${selectedProdModel}`);
    addLog(`📦 New Model: ${selectedDevModel}`);

    const configFilename = `config_${outputFolderName}.json`;
    addLog(`💾 Salvataggio config locale: ${configFilename}`);

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
    setRunStatus("Configurazione salvata. Avvia dashboard.py per eseguire i test.");
    addLog("⏳ In attesa che dashboard.py rilevi la configurazione e avvii i test...");
    addLog(`💡 Esegui: python dashboard.py --config ${result.path}`);
    setPollingForOutput(true);

    // Start polling for output files on network share
    const outputRelPath = `${selectedCountry}/${selectedSegment}/${selectedDate}/output/${outputFolderName}`;
    const MAX_POLLS = 720; // 2 hours at 10s intervals
    let count = 0;

    const pollInterval = setInterval(async () => {
      count++;
      setPollCount(count);
      setPollProgress(Math.min((count / MAX_POLLS) * 100, 99));

      try {
        const outputFiles = await browser.checkOutput(outputRelPath);
        if (outputFiles.length > 0) {
          clearInterval(pollInterval);
          setPollingForOutput(false);
          setIsRunning(false);
          setPollProgress(100);
          setRunStatus("Test completati! Output disponibili.");
          addLog(`🎉 Test completati! ${outputFiles.length} file di output trovati.`, 'success');
          setOutputFiles(outputFiles.map(f => ({ name: f.name, key: f.key, size: f.size })));
          toast.success("Output dei test disponibili!", {
            description: `${outputFiles.length} file trovati`,
          });
        } else if (count % 6 === 0) {
          // Log every ~60s
          addLog(`🔄 Polling #${count} - nessun output ancora (${Math.floor(count * 10 / 60)} min trascorsi)`);
        }
      } catch (pollErr: any) {
        addLog(`⚠️ Errore polling: ${pollErr.message}`, 'error');
      }

      if (count >= MAX_POLLS) {
        clearInterval(pollInterval);
        setPollingForOutput(false);
        setRunStatus("Polling interrotto dopo 2 ore. Ricarica manualmente per verificare l'output.");
        addLog("⏰ Polling interrotto dopo 2 ore.", 'error');
      }
    }, 10000);
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
            Sfoglia i dati sulla rete, seleziona modelli e file per i test
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadCountries} disabled={!!loadingStep}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loadingStep ? 'animate-spin' : ''}`} />
          Ricarica
        </Button>
      </div>

      {/* Step 1: Country + Segment + Date selectors */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="w-4 h-4" />
            Selezione Ambiente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Country */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Country</label>
              <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingStep === "countries" ? "Caricamento..." : "Seleziona country"} />
                </SelectTrigger>
                <SelectContent>
                  {countries.map(c => (
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
                  <SelectValue placeholder={loadingStep === "segments" ? "Caricamento..." : "Seleziona segmento"} />
                </SelectTrigger>
                <SelectContent>
                  {segments.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Data</label>
              <Select
                value={selectedDate}
                onValueChange={setSelectedDate}
                disabled={!selectedSegment}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingStep === "dates" ? "Caricamento..." : "Seleziona data"} />
                </SelectTrigger>
                <SelectContent>
                  {dates.map(d => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
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
                disabled={!selectedDate || isTagger}
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
              <span>\\sassrv04\...\TEST_SUITE</span>
              <ChevronRight className="w-3 h-3" />
              <span className="text-foreground font-medium">{selectedCountry}</span>
              {selectedSegment && (
                <>
                  <ChevronRight className="w-3 h-3" />
                  <span className="text-foreground font-medium">{selectedSegment}</span>
                </>
              )}
              {selectedDate && (
                <>
                  <ChevronRight className="w-3 h-3" />
                  <span className="text-foreground font-medium">{selectedDate}</span>
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

      {/* Step 2: Models & Rules (only when date selected) */}
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
                      <AlertCircle className="w-3 h-3" /> Nessun modello trovato
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
                      <AlertCircle className="w-3 h-3" /> Nessun modello trovato
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
                    <label className="text-sm font-medium text-muted-foreground">
                      Expert Rules (OLD)
                    </label>
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
                    <label className="text-sm font-medium text-muted-foreground">
                      Expert Rules (NEW)
                    </label>
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
                /* Tagger: single distribution file */
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
                /* Consumer/Business: multi-select per category */
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

          {/* Run summary / config recap */}
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Riepilogo Configurazione</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground block">Country</span>
                  <span className="font-medium">{selectedCountry || "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Segmento</span>
                  <span className="font-medium">{selectedSegment || "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Data</span>
                  <span className="font-medium">{selectedDate || "—"}</span>
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

              {!isTagger && (
                <div className="mt-3 text-xs text-muted-foreground">
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
                    Output atteso in: <code className="font-mono bg-muted px-1 rounded">output/{outputFolderName}/</code>
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
