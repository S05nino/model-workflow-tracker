import { useState, useEffect } from 'react';
import { Brain, Workflow, Play, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';
import { NavLink } from '@/components/NavLink';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// API base URL - uses same pattern as local client
const TESTSUITE_API = import.meta.env.VITE_TESTSUITE_API_URL || 'http://localhost:3002/api/testsuite';

interface CountryInfo {
  code: string;
  segments: string[];
}

interface ModelFiles {
  prod_models: string[];
  dev_models: string[];
  expert_rules_old: string[];
  expert_rules_new: string[];
  has_old_new_folders: boolean;
}

interface TaggerFiles {
  models: string[];
  company_lists: string[];
  distribution_files: string[];
}

interface SampleFiles {
  tsv_files: string[];
}

interface TestResult {
  success: boolean;
  message: string;
  output_folder?: string;
  report_path?: string;
}

interface StatusInfo {
  testrunner_available: boolean;
  root_folder: string;
  root_exists: boolean;
  azure_batch: boolean;
}

const TestSuitePage = () => {
  // Status
  const [status, setStatus] = useState<StatusInfo | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Selection state
  const [countries, setCountries] = useState<CountryInfo[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [selectedSegment, setSelectedSegment] = useState<string>('Consumer');
  const [version, setVersion] = useState('x.x.x');

  // Model files
  const [modelFiles, setModelFiles] = useState<ModelFiles | null>(null);
  const [taggerFiles, setTaggerFiles] = useState<TaggerFiles | null>(null);
  const [sampleFiles, setSampleFiles] = useState<SampleFiles | null>(null);

  // Selected files for Consumer/Business
  const [oldModel, setOldModel] = useState<string>('');
  const [newModel, setNewModel] = useState<string>('');
  const [oldExpertRules, setOldExpertRules] = useState<string>('');
  const [newExpertRules, setNewExpertRules] = useState<string>('');
  const [accuracyFiles, setAccuracyFiles] = useState<string[]>([]);
  const [anomaliesFiles, setAnomaliesFiles] = useState<string[]>([]);
  const [precisionFiles, setPrecisionFiles] = useState<string[]>([]);
  const [stabilityFiles, setStabilityFiles] = useState<string[]>([]);

  // Selected files for Tagger
  const [taggerOldModel, setTaggerOldModel] = useState<string>('');
  const [taggerNewModel, setTaggerNewModel] = useState<string>('');
  const [companyList, setCompanyList] = useState<string>('');
  const [distributionData, setDistributionData] = useState<string>('');

  // Azure Batch settings
  const [vmBench, setVmBench] = useState<number>(1);
  const [vmDev, setVmDev] = useState<number>(2);

  // Running state
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  // Check status on mount
  useEffect(() => {
    fetchStatus();
    fetchCountries();
  }, []);

  // Fetch models when country/segment changes
  useEffect(() => {
    if (selectedCountry && selectedSegment) {
      if (selectedSegment === 'Tagger') {
        fetchTaggerFiles();
      } else {
        fetchModelFiles();
        fetchSampleFiles();
      }
    }
  }, [selectedCountry, selectedSegment]);

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${TESTSUITE_API}/status`);
      if (!res.ok) throw new Error('Failed to fetch status');
      setStatus(await res.json());
      setStatusError(null);
    } catch (e) {
      setStatusError('Impossibile connettersi al backend TestSuite. Assicurati che il container Python sia in esecuzione.');
    }
  };

  const fetchCountries = async () => {
    try {
      const res = await fetch(`${TESTSUITE_API}/countries`);
      if (!res.ok) throw new Error('Failed to fetch countries');
      const data = await res.json();
      setCountries(data);
      if (data.length > 0) {
        setSelectedCountry(data[0].code);
        if (data[0].segments.length > 0) {
          setSelectedSegment(data[0].segments[0]);
        }
      }
    } catch (e) {
      console.error('Error fetching countries:', e);
    }
  };

  const fetchModelFiles = async () => {
    try {
      const res = await fetch(`${TESTSUITE_API}/${selectedCountry}/${selectedSegment}/models`);
      if (!res.ok) throw new Error('Failed to fetch models');
      const data = await res.json();
      setModelFiles(data);
      // Reset selections
      setOldModel('');
      setNewModel('');
      setOldExpertRules('');
      setNewExpertRules('');
    } catch (e) {
      console.error('Error fetching models:', e);
      setModelFiles(null);
    }
  };

  const fetchTaggerFiles = async () => {
    try {
      const res = await fetch(`${TESTSUITE_API}/${selectedCountry}/Tagger/files`);
      if (!res.ok) throw new Error('Failed to fetch tagger files');
      const data = await res.json();
      setTaggerFiles(data);
      setTaggerOldModel('');
      setTaggerNewModel('');
      setCompanyList('');
      setDistributionData('');
    } catch (e) {
      console.error('Error fetching tagger files:', e);
      setTaggerFiles(null);
    }
  };

  const fetchSampleFiles = async () => {
    try {
      const res = await fetch(`${TESTSUITE_API}/${selectedCountry}/${selectedSegment}/samples`);
      if (!res.ok) throw new Error('Failed to fetch samples');
      const data = await res.json();
      setSampleFiles(data);
      // Reset selections
      setAccuracyFiles([]);
      setAnomaliesFiles([]);
      setPrecisionFiles([]);
      setStabilityFiles([]);
    } catch (e) {
      console.error('Error fetching samples:', e);
      setSampleFiles(null);
    }
  };

  const toggleFileSelection = (
    file: string,
    selected: string[],
    setSelected: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    if (selected.includes(file)) {
      setSelected(selected.filter(f => f !== file));
    } else {
      setSelected([...selected, file]);
    }
  };

  const runTests = async () => {
    if (selectedSegment === 'Tagger') {
      await runTaggerTests();
    } else {
      await runConsumerBusinessTests();
    }
  };

  const runConsumerBusinessTests = async () => {
    if (!oldModel || !newModel) {
      toast.error('Seleziona i modelli old e new');
      return;
    }
    if (!accuracyFiles.length && !anomaliesFiles.length && 
        !precisionFiles.length && !stabilityFiles.length) {
      toast.error('Seleziona almeno un file di input');
      return;
    }

    setIsRunning(true);
    setResult(null);

    try {
      const res = await fetch(`${TESTSUITE_API}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          country: selectedCountry,
          segment: selectedSegment,
          version,
          old_model: oldModel,
          new_model: newModel,
          old_expert_rules: oldExpertRules || null,
          new_expert_rules: newExpertRules || null,
          accuracy_files: accuracyFiles,
          anomalies_files: anomaliesFiles,
          precision_files: precisionFiles,
          stability_files: stabilityFiles,
          vm_bench: vmBench,
          vm_dev: vmDev
        })
      });

      const data = await res.json();
      setResult(data);

      if (data.success) {
        toast.success('Test completati con successo!');
      } else {
        toast.error(data.message);
      }
    } catch (e) {
      toast.error('Errore durante l\'esecuzione dei test');
      setResult({ success: false, message: String(e) });
    } finally {
      setIsRunning(false);
    }
  };

  const runTaggerTests = async () => {
    if (!taggerOldModel || !taggerNewModel || !companyList || !distributionData) {
      toast.error('Seleziona tutti i file richiesti');
      return;
    }

    setIsRunning(true);
    setResult(null);

    try {
      const res = await fetch(`${TESTSUITE_API}/run-tagger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          country: selectedCountry,
          version,
          old_model: taggerOldModel,
          new_model: taggerNewModel,
          company_list: companyList,
          distribution_data: distributionData,
          vm_bench: vmBench,
          vm_dev: vmDev
        })
      });

      const data = await res.json();
      setResult(data);

      if (data.success) {
        toast.success('Test Tagger completati con successo!');
      } else {
        toast.error(data.message);
      }
    } catch (e) {
      toast.error('Errore durante l\'esecuzione dei test Tagger');
      setResult({ success: false, message: String(e) });
    } finally {
      setIsRunning(false);
    }
  };

  const availableSegments = countries.find(c => c.code === selectedCountry)?.segments || [];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <header className="mb-8 animate-fade-in">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-primary/10 glow-primary">
                <Brain className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                  TestSuite Dashboard
                </h1>
                <p className="text-muted-foreground flex items-center gap-2">
                  <Workflow className="w-4 h-4" />
                  Model Performance Testing
                </p>
              </div>
            </div>
            <NavLink to="/">← Torna alla Dashboard</NavLink>
          </div>
        </header>

        {/* Status Alert */}
        {statusError && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Errore di connessione</AlertTitle>
            <AlertDescription>{statusError}</AlertDescription>
          </Alert>
        )}

        {status && !status.testrunner_available && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>TestRunner non disponibile</AlertTitle>
            <AlertDescription>
              Il modulo TestRunner non è stato trovato. Verifica che il codice CategorizationEnginePython
              sia stato copiato correttamente in docker/python-backend/ce_python/
            </AlertDescription>
          </Alert>
        )}

        {status && !status.root_exists && (
          <Alert className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Cartella TEST_SUITE non trovata</AlertTitle>
            <AlertDescription>
              La cartella {status.root_folder} non esiste. Verifica il mount dei volumi Docker.
            </AlertDescription>
          </Alert>
        )}

        {/* Main Content */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Panel - Selection */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Configurazione</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Country */}
              <div className="space-y-2">
                <Label>Country</Label>
                <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona paese" />
                  </SelectTrigger>
                  <SelectContent>
                    {countries.map(c => (
                      <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Segment */}
              <div className="space-y-2">
                <Label>Segment</Label>
                <RadioGroup value={selectedSegment} onValueChange={setSelectedSegment}>
                  {availableSegments.map(seg => (
                    <div key={seg} className="flex items-center space-x-2">
                      <RadioGroupItem value={seg} id={seg} />
                      <Label htmlFor={seg}>{seg}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              {/* Version */}
              <div className="space-y-2">
                <Label>Model Version</Label>
                <Input 
                  value={version} 
                  onChange={(e) => setVersion(e.target.value)}
                  placeholder="x.x.x"
                />
              </div>

              {/* Azure Batch Settings */}
              <div className="space-y-2 pt-4 border-t">
                <Label className="text-sm font-medium">Azure Batch VMs</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Benchmark</Label>
                    <Select value={String(vmBench)} onValueChange={(v) => setVmBench(Number(v))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4].map(n => (
                          <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Development</Label>
                    <Select value={String(vmDev)} onValueChange={(v) => setVmDev(Number(v))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4].filter(n => n !== vmBench).map(n => (
                          <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Right Panel - Files & Run */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>{selectedCountry} → {selectedSegment}</CardTitle>
            </CardHeader>
            <CardContent>
              {selectedSegment === 'Tagger' ? (
                // Tagger UI
                <div className="space-y-4">
                  {taggerFiles && (
                    <>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Old Model</Label>
                          <Select value={taggerOldModel} onValueChange={setTaggerOldModel}>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleziona..." />
                            </SelectTrigger>
                            <SelectContent>
                              {taggerFiles.models.map(f => (
                                <SelectItem key={f} value={f}>{f}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>New Model</Label>
                          <Select value={taggerNewModel} onValueChange={setTaggerNewModel}>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleziona..." />
                            </SelectTrigger>
                            <SelectContent>
                              {taggerFiles.models.map(f => (
                                <SelectItem key={f} value={f}>{f}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Company Normalization List</Label>
                        <Select value={companyList} onValueChange={setCompanyList}>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona..." />
                          </SelectTrigger>
                          <SelectContent>
                            {taggerFiles.company_lists.map(f => (
                              <SelectItem key={f} value={f}>{f}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Distribution Data</Label>
                        <Select value={distributionData} onValueChange={setDistributionData}>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona..." />
                          </SelectTrigger>
                          <SelectContent>
                            {taggerFiles.distribution_files.map(f => (
                              <SelectItem key={f} value={f}>{f}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                // Consumer/Business UI
                <Tabs defaultValue="models" className="space-y-4">
                  <TabsList>
                    <TabsTrigger value="models">Modelli</TabsTrigger>
                    <TabsTrigger value="files">File Input</TabsTrigger>
                  </TabsList>

                  <TabsContent value="models" className="space-y-4">
                    {modelFiles && (
                      <>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Old Model (prod)</Label>
                            <Select value={oldModel} onValueChange={setOldModel}>
                              <SelectTrigger>
                                <SelectValue placeholder="Seleziona..." />
                              </SelectTrigger>
                              <SelectContent>
                                {modelFiles.prod_models.map(f => (
                                  <SelectItem key={f} value={f}>{f}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>New Model (develop)</Label>
                            <Select value={newModel} onValueChange={setNewModel}>
                              <SelectTrigger>
                                <SelectValue placeholder="Seleziona..." />
                              </SelectTrigger>
                              <SelectContent>
                                {modelFiles.dev_models.map(f => (
                                  <SelectItem key={f} value={f}>{f}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Old Expert Rules (opzionale)</Label>
                            <Select value={oldExpertRules} onValueChange={setOldExpertRules}>
                              <SelectTrigger>
                                <SelectValue placeholder="Nessuno" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">Nessuno</SelectItem>
                                {modelFiles.expert_rules_old.map(f => (
                                  <SelectItem key={f} value={f}>{f}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>New Expert Rules (opzionale)</Label>
                            <Select value={newExpertRules} onValueChange={setNewExpertRules}>
                              <SelectTrigger>
                                <SelectValue placeholder="Nessuno" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">Nessuno</SelectItem>
                                {modelFiles.expert_rules_new.map(f => (
                                  <SelectItem key={f} value={f}>{f}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </>
                    )}
                  </TabsContent>

                  <TabsContent value="files" className="space-y-4">
                    {sampleFiles && sampleFiles.tsv_files.length > 0 ? (
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Accuracy Files</Label>
                          <div className="border rounded-md p-2 max-h-32 overflow-y-auto space-y-1">
                            {sampleFiles.tsv_files.map(f => (
                              <div key={`acc-${f}`} className="flex items-center space-x-2">
                                <Checkbox 
                                  id={`acc-${f}`}
                                  checked={accuracyFiles.includes(f)}
                                  onCheckedChange={() => toggleFileSelection(f, accuracyFiles, setAccuracyFiles)}
                                />
                                <Label htmlFor={`acc-${f}`} className="text-xs truncate">{f}</Label>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Anomalies Files</Label>
                          <div className="border rounded-md p-2 max-h-32 overflow-y-auto space-y-1">
                            {sampleFiles.tsv_files.map(f => (
                              <div key={`anom-${f}`} className="flex items-center space-x-2">
                                <Checkbox 
                                  id={`anom-${f}`}
                                  checked={anomaliesFiles.includes(f)}
                                  onCheckedChange={() => toggleFileSelection(f, anomaliesFiles, setAnomaliesFiles)}
                                />
                                <Label htmlFor={`anom-${f}`} className="text-xs truncate">{f}</Label>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Precision Files</Label>
                          <div className="border rounded-md p-2 max-h-32 overflow-y-auto space-y-1">
                            {sampleFiles.tsv_files.map(f => (
                              <div key={`prec-${f}`} className="flex items-center space-x-2">
                                <Checkbox 
                                  id={`prec-${f}`}
                                  checked={precisionFiles.includes(f)}
                                  onCheckedChange={() => toggleFileSelection(f, precisionFiles, setPrecisionFiles)}
                                />
                                <Label htmlFor={`prec-${f}`} className="text-xs truncate">{f}</Label>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Stability Files</Label>
                          <div className="border rounded-md p-2 max-h-32 overflow-y-auto space-y-1">
                            {sampleFiles.tsv_files.map(f => (
                              <div key={`stab-${f}`} className="flex items-center space-x-2">
                                <Checkbox 
                                  id={`stab-${f}`}
                                  checked={stabilityFiles.includes(f)}
                                  onCheckedChange={() => toggleFileSelection(f, stabilityFiles, setStabilityFiles)}
                                />
                                <Label htmlFor={`stab-${f}`} className="text-xs truncate">{f}</Label>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm">Nessun file .tsv.gz trovato nella cartella sample</p>
                    )}
                  </TabsContent>
                </Tabs>
              )}

              {/* Run Button */}
              <div className="pt-6 border-t mt-6">
                <Button 
                  onClick={runTests} 
                  disabled={isRunning || !status?.testrunner_available}
                  className="w-full"
                  size="lg"
                >
                  {isRunning ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Esecuzione in corso...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Esegui Test
                    </>
                  )}
                </Button>
              </div>

              {/* Result */}
              {result && (
                <Alert variant={result.success ? 'default' : 'destructive'} className="mt-4">
                  {result.success ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                  <AlertTitle>{result.success ? 'Completato!' : 'Errore'}</AlertTitle>
                  <AlertDescription>
                    {result.message}
                    {result.output_folder && (
                      <p className="mt-2 text-xs">Output: {result.output_folder}</p>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default TestSuitePage;
