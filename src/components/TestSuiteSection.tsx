import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useState, useEffect, useCallback } from "react";
import { useS3Browser } from "@/hooks/useS3Browser";
import {
  Globe, Layers, Calendar, FileArchive, FlaskConical,
  FolderOpen, Download, Loader2, RefreshCw, ChevronRight,
  AlertCircle, CheckCircle2, FileSpreadsheet
} from "lucide-react";

type Segment = "consumer" | "business" | "tagger";

interface FileSelection {
  accuracy: string[];
  anomalies: string[];
  precision: string[];
  stability: string[];
}

export const TestSuiteSection = () => {
  const s3 = useS3Browser();

  // Navigation state
  const [countries, setCountries] = useState<string[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string>("");
  const [segments, setSegments] = useState<string[]>([]);
  const [selectedSegment, setSelectedSegment] = useState<string>("");
  const [dates, setDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");

  // Model state
  const [prodModels, setProdModels] = useState<string[]>([]);
  const [devModels, setDevModels] = useState<string[]>([]);
  const [selectedProdModel, setSelectedProdModel] = useState<string>("");
  const [selectedDevModel, setSelectedDevModel] = useState<string>("");

  // Expert rules state
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

  // Loading states
  const [loadingStep, setLoadingStep] = useState<string | null>(null);

  // Load countries on mount
  useEffect(() => {
    loadCountries();
  }, []);

  const loadCountries = async () => {
    setLoadingStep("countries");
    const result = await s3.listCountries();
    setCountries(result.folders.map(f => f.name).sort());
    setLoadingStep(null);
  };

  // When country changes, load segments
  useEffect(() => {
    if (!selectedCountry) return;
    setSelectedSegment("");
    setSelectedDate("");
    resetSelections();
    (async () => {
      setLoadingStep("segments");
      const result = await s3.listSegments(selectedCountry);
      setSegments(result.folders.map(f => f.name).sort());
      setLoadingStep(null);
    })();
  }, [selectedCountry]);

  // When segment changes, load dates
  useEffect(() => {
    if (!selectedCountry || !selectedSegment) return;
    setSelectedDate("");
    resetSelections();
    (async () => {
      setLoadingStep("dates");
      const result = await s3.listDates(selectedCountry, selectedSegment);
      setDates(result.folders.map(f => f.name).sort().reverse());
      setLoadingStep(null);
    })();
  }, [selectedCountry, selectedSegment]);

  // When date changes, load models + samples + expert rules
  useEffect(() => {
    if (!selectedCountry || !selectedSegment || !selectedDate) return;
    resetSelections();
    loadDateContents();
  }, [selectedCountry, selectedSegment, selectedDate]);

  const resetSelections = () => {
    setProdModels([]);
    setDevModels([]);
    setSelectedProdModel("");
    setSelectedDevModel("");
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
      s3.listSubfolder(country, segment, date, "sample").then(result => {
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
        s3.listModelSubfolder(country, segment, date, "prod").then(result => {
          setProdModels(result.files.filter(f => f.name.endsWith(".zip")).map(f => f.name));
        })
      );

      // Dev models
      promises.push(
        s3.listModelSubfolder(country, segment, date, "develop").then(result => {
          setDevModels(result.files.filter(f => f.name.endsWith(".zip")).map(f => f.name));
        })
      );

      // Expert rules - check for old/new structure
      promises.push(
        (async () => {
          const erResult = await s3.listModelSubfolder(country, segment, date, "expertrules");
          const hasOldNew = erResult.folders.some(f => f.name === "old" || f.name === "new");
          setHasOldNewStructure(hasOldNew);

          if (hasOldNew) {
            const [oldResult, newResult] = await Promise.all([
              s3.listPrefix(`TEST_SUITE/${country}/${segment}/${date}/model/expertrules/old/`),
              s3.listPrefix(`TEST_SUITE/${country}/${segment}/${date}/model/expertrules/new/`),
            ]);
            setExpertRulesOld(oldResult.files.map(f => f.name));
            setExpertRulesNew(newResult.files.map(f => f.name));
          } else {
            const zips = erResult.files.filter(f => f.name.endsWith(".zip")).map(f => f.name);
            setExpertRulesOld(zips);
            setExpertRulesNew(zips);
          }
        })()
      );
    } else {
      // Tagger: models are directly in model/
      promises.push(
        s3.listSubfolder(country, segment, date, "model").then(result => {
          const zips = result.files.filter(f => f.name.endsWith(".zip")).map(f => f.name);
          setProdModels(zips);
          setDevModels(zips);
        })
      );
    }

    // Output files
    promises.push(
      s3.listSubfolder(country, segment, date, "output").then(result => {
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
    toast.info(`Generazione link per ${name}...`);
    const url = await s3.getPresignedUrl(key);
    if (url) {
      window.open(url, "_blank");
      toast.success(`Download avviato: ${name}`);
    } else {
      toast.error("Errore nella generazione del link");
    }
  };

  const isTagger = selectedSegment.toLowerCase() === "tagger";
  const hasFullSelection = selectedCountry && selectedSegment && selectedDate;

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
            Sfoglia i dati su S3, seleziona modelli e file per i test
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          </div>

          {/* Breadcrumb */}
          {selectedCountry && (
            <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
              <FolderOpen className="w-3 h-3" />
              <span>s3://cateng/TEST_SUITE</span>
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
                  <span className="text-muted-foreground block">Data</span>
                  <span className="font-medium">{selectedDate || "—"}</span>
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

              <div className="mt-4 p-3 rounded-md bg-muted/50 text-sm text-muted-foreground">
                <AlertCircle className="w-4 h-4 inline mr-2" />
                L'esecuzione dei test richiede l'ambiente Windows locale con le dipendenze .NET.
                Usa questa dashboard per configurare e navigare i file, poi esegui lo script Python dal PC locale.
              </div>
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
