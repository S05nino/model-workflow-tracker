import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Play, Settings2, FlaskConical, FolderOpen, Loader2, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { ErrorBoundary } from './ErrorBoundary';

// Python backend URL
const PYTHON_API_URL = import.meta.env.VITE_PYTHON_API_URL || 'http://localhost:3002';

type Segment = 'Consumer' | 'Business' | 'Tagger';

interface TestConfig {
  country: string;
  segment: Segment;
  version: string;
  oldModel: string;
  newModel: string;
  oldExpertRules: string;
  newExpertRules: string;
  accuracyFiles: string[];
  anomaliesFiles: string[];
  precisionFiles: string[];
  stabilityFiles: string[];
  vmBench: number;
  vmDev: number;
  // Tagger specific
  companyList: string;
  distributionData: string;
}

interface FileOptions {
  sample_files: string[];
  prod_models: string[];
  dev_models: string[];
  expert_rules_old: string[];
  expert_rules_new: string[];
  tagger_models: string[];
  company_lists: string[];
  date_folder?: string;
  segment_folder?: string;
}

interface TestRun {
  run_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress?: number;
  message?: string;
  result?: {
    output_folder?: string;
    report_path?: string;
  };
}

const defaultConfig: TestConfig = {
  country: '',
  segment: 'Consumer',
  version: '',
  oldModel: '',
  newModel: '',
  oldExpertRules: '',
  newExpertRules: '',
  accuracyFiles: [],
  anomaliesFiles: [],
  precisionFiles: [],
  stabilityFiles: [],
  vmBench: 1,
  vmDev: 2,
  companyList: '',
  distributionData: '',
};

export const TestSuiteSection = () => {
  const [config, setConfig] = useState<TestConfig>(defaultConfig);
  const [countries, setCountries] = useState<string[]>([]);
  const [segments, setSegments] = useState<string[]>([]);
  const [fileOptions, setFileOptions] = useState<FileOptions>({
    sample_files: [],
    prod_models: [],
    dev_models: [],
    expert_rules_old: [],
    expert_rules_new: [],
    tagger_models: [],
    company_lists: [],
    date_folder: undefined,
    segment_folder: undefined
  });
  const [isLoading, setIsLoading] = useState(false);
  const [currentRun, setCurrentRun] = useState<TestRun | null>(null);
  const [apiAvailable, setApiAvailable] = useState<boolean | null>(null);
  const [loadingSegments, setLoadingSegments] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  
  // Refs to track current country/segment to avoid race conditions
  const currentCountryRef = useRef<string>('');
  const currentSegmentRef = useRef<string>('');

  // Check API availability
  const checkApiHealth = useCallback(async () => {
    try {
      const response = await fetch(`${PYTHON_API_URL}/health`, { 
        signal: AbortSignal.timeout(5000) 
      });
      const data = await response.json();
      setApiAvailable(data.status === 'ok' && data.ce_python_available);
      return data;
    } catch (err) {
      console.error('API health check failed:', err);
      setApiAvailable(false);
      return null;
    }
  }, []);

  // Load countries on mount
  useEffect(() => {
    const controller = new AbortController();
    
    const init = async () => {
      const health = await checkApiHealth();
      if (health?.status === 'ok' && !controller.signal.aborted) {
        try {
          const response = await fetch(`${PYTHON_API_URL}/api/testsuite/countries`, {
            signal: controller.signal
          });
          const data = await response.json();
          if (!controller.signal.aborted) {
            setCountries(Array.isArray(data.countries) ? data.countries : []);
          }
        } catch (err) {
          if (!controller.signal.aborted) {
            console.error('Failed to load countries:', err);
          }
        }
      }
    };
    init();
    
    return () => controller.abort();
  }, [checkApiHealth]);

  // Load segments when country changes
  useEffect(() => {
    const controller = new AbortController();
    
    // Track the country this effect is for
    const effectCountry = config.country;
    currentCountryRef.current = effectCountry;
    
    if (!effectCountry) {
      setSegments([]);
      setFileOptions({
        sample_files: [],
        prod_models: [],
        dev_models: [],
        expert_rules_old: [],
        expert_rules_new: [],
        tagger_models: [],
        company_lists: [],
        date_folder: undefined,
        segment_folder: undefined
      });
      return;
    }
    
    // Reset files when country changes
    setFileOptions({
      sample_files: [],
      prod_models: [],
      dev_models: [],
      expert_rules_old: [],
      expert_rules_new: [],
      tagger_models: [],
      company_lists: [],
      date_folder: undefined,
      segment_folder: undefined
    });
    
    const loadSegments = async () => {
      setLoadingSegments(true);
      try {
        const response = await fetch(`${PYTHON_API_URL}/api/testsuite/segments/${effectCountry}`, {
          signal: controller.signal
        });
        
        // Check if this effect is still valid
        if (controller.signal.aborted || currentCountryRef.current !== effectCountry) {
          return;
        }
        
        if (!response.ok) {
          console.error('Failed to load segments:', response.status, response.statusText);
          setSegments([]);
          toast.error('Errore caricamento segmenti', {
            description: `Impossibile caricare i segmenti per ${effectCountry}`
          });
          return;
        }
        
        const data = await response.json();
        
        // Double-check we're still on the same country
        if (currentCountryRef.current !== effectCountry) {
          return;
        }
        
        const loadedSegments = Array.isArray(data.segments) ? data.segments : [];
        console.log('Loaded segments:', loadedSegments);
        setSegments(loadedSegments);
        
        // Reset segment if not available, or set first available
        if (loadedSegments.length > 0) {
          setConfig(prev => {
            if (!loadedSegments.includes(prev.segment)) {
              return { ...prev, segment: loadedSegments[0] as Segment };
            }
            return prev;
          });
        } else {
          toast.warning('Nessun segmento trovato', {
            description: `Il paese ${effectCountry} non contiene cartelle Consumer/Business/Tagger`
          });
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error('Failed to load segments:', err);
        setSegments([]);
        toast.error('Errore di connessione', {
          description: 'Impossibile connettersi al backend Python'
        });
      } finally {
        if (!controller.signal.aborted) {
          setLoadingSegments(false);
        }
      }
    };
    
    loadSegments();
    
    return () => controller.abort();
  }, [config.country]);

  // Load files when country/segment changes
  useEffect(() => {
    const controller = new AbortController();
    
    const emptyOptions: FileOptions = {
      sample_files: [],
      prod_models: [],
      dev_models: [],
      expert_rules_old: [],
      expert_rules_new: [],
      tagger_models: [],
      company_lists: [],
      date_folder: undefined,
      segment_folder: undefined
    };
    
    const effectCountry = config.country;
    const effectSegment = config.segment;
    currentSegmentRef.current = effectSegment;
    
    // Don't load files if we're still loading segments or if no segments available
    if (!effectCountry || !effectSegment || segments.length === 0 || loadingSegments) {
      setFileOptions(emptyOptions);
      return;
    }

    const loadFiles = async () => {
      setLoadingFiles(true);
      try {
        console.log(`Loading files for ${effectCountry}/${effectSegment}...`);
        const response = await fetch(`${PYTHON_API_URL}/api/testsuite/files/${effectCountry}/${effectSegment}`, {
          signal: controller.signal
        });
        
        // Check if this effect is still valid
        if (controller.signal.aborted || currentSegmentRef.current !== effectSegment) {
          return;
        }
        
        if (!response.ok) {
          console.error('Failed to load files:', response.status, response.statusText);
          setFileOptions(emptyOptions);
          toast.error('Errore caricamento file', {
            description: `Impossibile caricare i file per ${effectCountry}/${effectSegment}`
          });
          return;
        }
        
        const data = await response.json();
        console.log('Loaded file data:', data);
        
        // Double-check we're still on the same segment
        if (currentSegmentRef.current !== effectSegment) {
          return;
        }
        
        // Check for error in response
        if (data.error) {
          console.warn('Backend warning:', data.error);
          toast.warning('Attenzione', { description: data.error });
        }
        
        // Ensure all arrays exist with defaults
        const newOptions: FileOptions = {
          sample_files: Array.isArray(data.sample_files) ? data.sample_files : [],
          prod_models: Array.isArray(data.prod_models) ? data.prod_models : [],
          dev_models: Array.isArray(data.dev_models) ? data.dev_models : [],
          expert_rules_old: Array.isArray(data.expert_rules_old) ? data.expert_rules_old : [],
          expert_rules_new: Array.isArray(data.expert_rules_new) ? data.expert_rules_new : [],
          tagger_models: Array.isArray(data.tagger_models) ? data.tagger_models : [],
          company_lists: Array.isArray(data.company_lists) ? data.company_lists : [],
          date_folder: data.date_folder || undefined,
          segment_folder: data.segment_folder || undefined
        };
        
        setFileOptions(newOptions);
        
        if (newOptions.date_folder) {
          console.log(`Working folder detected: ${newOptions.date_folder}`);
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error('Failed to load files:', err);
        setFileOptions(emptyOptions);
        toast.error('Errore di connessione', {
          description: 'Impossibile connettersi al backend Python per caricare i file'
        });
      } finally {
        if (!controller.signal.aborted) {
          setLoadingFiles(false);
        }
      }
    };
    
    loadFiles();
    
    return () => controller.abort();
  }, [config.country, config.segment, segments, loadingSegments]);


  // Poll for test status
  useEffect(() => {
    if (!currentRun || currentRun.status === 'completed' || currentRun.status === 'failed') {
      return;
    }

    const pollStatus = async () => {
      try {
        const response = await fetch(`${PYTHON_API_URL}/api/testsuite/status/${currentRun.run_id}`);
        const data = await response.json();
        setCurrentRun(data);

        if (data.status === 'completed') {
          toast.success('Test completati!', {
            description: `Report salvato in: ${data.result?.output_folder || 'cartella output'}`,
          });
        } else if (data.status === 'failed') {
          toast.error('Test falliti', {
            description: data.message,
          });
        }
      } catch (err) {
        console.error('Failed to poll status:', err);
      }
    };

    const interval = setInterval(pollStatus, 2000);
    return () => clearInterval(interval);
  }, [currentRun]);

  const updateConfig = (key: keyof TestConfig, value: string | number | string[]) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const toggleFileInList = (type: 'accuracyFiles' | 'anomaliesFiles' | 'precisionFiles' | 'stabilityFiles', fileName: string) => {
    const currentList = config[type];
    if (currentList.includes(fileName)) {
      updateConfig(type, currentList.filter(f => f !== fileName));
    } else {
      updateConfig(type, [...currentList, fileName]);
    }
  };

  const runTests = async () => {
    if (!isConfigValid()) {
      toast.error('Configurazione incompleta', {
        description: 'Compila tutti i campi obbligatori',
      });
      return;
    }

    setIsLoading(true);

    try {
      const endpoint = config.segment === 'Tagger' 
        ? `${PYTHON_API_URL}/api/testsuite/run/tagger`
        : `${PYTHON_API_URL}/api/testsuite/run/consumer-business`;

      const payload = config.segment === 'Tagger'
        ? {
            country: config.country,
            segment: config.segment,
            version: config.version,
            old_model: config.oldModel,
            new_model: config.newModel,
            vm_bench: config.vmBench,
            vm_dev: config.vmDev,
            company_list: config.companyList,
            distribution_data: config.distributionData,
          }
        : {
            country: config.country,
            segment: config.segment,
            version: config.version,
            old_model: config.oldModel,
            new_model: config.newModel,
            old_expert_rules: config.oldExpertRules || null,
            new_expert_rules: config.newExpertRules || null,
            accuracy_files: config.accuracyFiles,
            anomalies_files: config.anomaliesFiles,
            precision_files: config.precisionFiles,
            stability_files: config.stabilityFiles,
            vm_bench: config.vmBench,
            vm_dev: config.vmDev,
          };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      
      if (response.ok) {
        setCurrentRun({
          run_id: data.run_id,
          status: 'pending',
          progress: 0,
          message: 'Test avviati...',
        });
        toast.success('Test avviati!', {
          description: `Run ID: ${data.run_id}`,
        });
      } else {
        throw new Error(data.detail || 'Errore durante l\'avvio dei test');
      }
    } catch (err) {
      toast.error('Errore', {
        description: err instanceof Error ? err.message : 'Impossibile avviare i test',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const isConfigValid = () => {
    if (!config.country || !config.version) return false;
    
    if (config.segment === 'Tagger') {
      return !!(config.oldModel && config.newModel && config.distributionData);
    }
    
    return !!(config.oldModel && config.newModel && 
      (config.accuracyFiles.length > 0 || config.anomaliesFiles.length > 0 || 
       config.precisionFiles.length > 0 || config.stabilityFiles.length > 0));
  };

  const getStatusIcon = () => {
    if (!currentRun) return null;
    switch (currentRun.status) {
      case 'pending':
      case 'running':
        return <Loader2 className="w-4 h-4 animate-spin" />;
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-destructive" />;
      default:
        return null;
    }
  };

  if (apiAvailable === null) {
    return (
      <Card className="glass-card">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          <span className="ml-3 text-muted-foreground">Connessione al backend Python...</span>
        </CardContent>
      </Card>
    );
  }

  if (apiAvailable === false) {
    return (
      <Card className="glass-card border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <XCircle className="w-5 h-5" />
            Backend Python non disponibile
          </CardTitle>
          <CardDescription>
            Il container Python non è raggiungibile. Assicurati che Docker sia in esecuzione.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Per avviare la Test Suite, esegui:
            </p>
            <code className="block p-3 bg-muted rounded-md text-sm">
              docker-compose up -d
            </code>
            <Button variant="outline" onClick={checkApiHealth}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Riprova connessione
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <Card className="glass-card border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <FlaskConical className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Model Performance Test Suite</CardTitle>
              <CardDescription className="flex items-center gap-2 mt-1">
                <FolderOpen className="w-4 h-4" />
                <span className="text-xs">Backend Python connesso</span>
                <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/30">
                  Online
                </Badge>
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Current Run Status */}
      {currentRun && (
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              {getStatusIcon()}
              Test Run: {currentRun.run_id}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{currentRun.message}</span>
              <Badge variant={currentRun.status === 'completed' ? 'default' : currentRun.status === 'failed' ? 'destructive' : 'secondary'}>
                {currentRun.status}
              </Badge>
            </div>
            {currentRun.progress !== undefined && currentRun.status !== 'completed' && currentRun.status !== 'failed' && (
              <Progress value={currentRun.progress} className="h-2" />
            )}
            {currentRun.result?.output_folder && (
              <p className="text-xs text-muted-foreground">
                Output: <code className="bg-muted px-1 py-0.5 rounded">{currentRun.result.output_folder}</code>
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Configuration Panel */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="w-5 h-5" />
              Configurazione Test
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Country & Segment */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Country</Label>
                <Select value={config.country} onValueChange={(v) => updateConfig('country', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona paese" />
                  </SelectTrigger>
                  <SelectContent>
                    {countries.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Segment</Label>
                {loadingSegments ? (
                  <div className="flex items-center gap-2 py-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">Caricamento segmenti...</span>
                  </div>
                ) : segments.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">
                    {config.country ? 'Nessun segmento trovato' : 'Seleziona prima un paese'}
                  </p>
                ) : (
                  <RadioGroup 
                    value={config.segment} 
                    onValueChange={(v) => updateConfig('segment', v as Segment)}
                    className="flex gap-4"
                  >
                    {segments.includes('Consumer') && (
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Consumer" id="consumer" />
                        <Label htmlFor="consumer" className="cursor-pointer">Consumer</Label>
                      </div>
                    )}
                    {segments.includes('Business') && (
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Business" id="business" />
                        <Label htmlFor="business" className="cursor-pointer">Business</Label>
                      </div>
                    )}
                    {segments.includes('Tagger') && (
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Tagger" id="tagger" />
                        <Label htmlFor="tagger" className="cursor-pointer">Tagger</Label>
                      </div>
                    )}
                  </RadioGroup>
                )}
              </div>
            </div>
            
            {/* Date folder info */}
            {fileOptions.date_folder && (
              <div className="p-3 bg-muted/50 rounded-md">
                <p className="text-xs text-muted-foreground">
                  📁 Cartella di lavoro: <code className="bg-background px-1 py-0.5 rounded">{config.country}/{fileOptions.segment_folder}/{fileOptions.date_folder}</code>
                </p>
              </div>
            )}

            {/* Version */}
            <div className="space-y-2">
              <Label>Model Version</Label>
              <Input 
                value={config.version}
                onChange={(e) => updateConfig('version', e.target.value)}
                placeholder="es. 1.2.3"
              />
            </div>

            <Separator />

            {/* Models */}
            <div className="space-y-4">
              <Label className="text-base font-semibold">Modelli</Label>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">
                    {config.segment === 'Tagger' ? 'Old Model' : 'Old Model (prod)'}
                  </Label>
                  <Select value={config.oldModel} onValueChange={(v) => updateConfig('oldModel', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona modello" />
                    </SelectTrigger>
                    <SelectContent>
                      {(config.segment === 'Tagger' ? fileOptions.tagger_models : fileOptions.prod_models).map(m => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">
                    {config.segment === 'Tagger' ? 'New Model' : 'New Model (develop)'}
                  </Label>
                  <Select value={config.newModel} onValueChange={(v) => updateConfig('newModel', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona modello" />
                    </SelectTrigger>
                    <SelectContent>
                      {(config.segment === 'Tagger' ? fileOptions.tagger_models : fileOptions.dev_models).map(m => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Expert Rules (only for Consumer/Business) */}
            {config.segment !== 'Tagger' && fileOptions.expert_rules_old.length > 0 && (
              <>
                <Separator />
                <div className="space-y-4">
                  <Label className="text-base font-semibold">Expert Rules (opzionale)</Label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">Old Expert Rules</Label>
                      <Select value={config.oldExpertRules} onValueChange={(v) => updateConfig('oldExpertRules', v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Nessuna" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Nessuna</SelectItem>
                          {fileOptions.expert_rules_old.map(r => (
                            <SelectItem key={r} value={r}>{r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">New Expert Rules</Label>
                      <Select value={config.newExpertRules} onValueChange={(v) => updateConfig('newExpertRules', v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Nessuna" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Nessuna</SelectItem>
                          {fileOptions.expert_rules_new.map(r => (
                            <SelectItem key={r} value={r}>{r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Tagger specific fields */}
            {config.segment === 'Tagger' && (
              <>
                <Separator />
                <div className="space-y-4">
                  <Label className="text-base font-semibold">Tagger Files</Label>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">Company Normalization List</Label>
                      <Select value={config.companyList} onValueChange={(v) => updateConfig('companyList', v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona file" />
                        </SelectTrigger>
                        <SelectContent>
                          {fileOptions.company_lists.map(f => (
                            <SelectItem key={f} value={f}>{f}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">Distribution Data</Label>
                      <Select value={config.distributionData} onValueChange={(v) => updateConfig('distributionData', v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona file" />
                        </SelectTrigger>
                        <SelectContent>
                          {fileOptions.sample_files.map(f => (
                            <SelectItem key={f} value={f}>{f}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Azure Batch VMs */}
            <Separator />
            <div className="space-y-4">
              <Label className="text-base font-semibold">Azure Batch Settings</Label>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">VM for Benchmark</Label>
                  <RadioGroup 
                    value={String(config.vmBench)} 
                    onValueChange={(v) => updateConfig('vmBench', parseInt(v))}
                    className="flex gap-2"
                  >
                    {[1, 2, 3, 4].map(n => (
                      <div key={n} className="flex items-center space-x-1">
                        <RadioGroupItem value={String(n)} id={`vm-bench-${n}`} disabled={n === config.vmDev} />
                        <Label htmlFor={`vm-bench-${n}`} className="cursor-pointer text-sm">{n}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">VM for Development</Label>
                  <RadioGroup 
                    value={String(config.vmDev)} 
                    onValueChange={(v) => updateConfig('vmDev', parseInt(v))}
                    className="flex gap-2"
                  >
                    {[1, 2, 3, 4].map(n => (
                      <div key={n} className="flex items-center space-x-1">
                        <RadioGroupItem value={String(n)} id={`vm-dev-${n}`} disabled={n === config.vmBench} />
                        <Label htmlFor={`vm-dev-${n}`} className="cursor-pointer text-sm">{n}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Test Files Panel (Consumer/Business only) */}
        {config.segment !== 'Tagger' && (
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="w-5 h-5" />
                Test Files
              </CardTitle>
              <CardDescription>
                Seleziona i file per ogni tipo di test
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Accuracy Files */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Accuracy Files</Label>
                <div className="flex flex-wrap gap-1 min-h-[2rem] p-2 border rounded-md bg-muted/30">
                  {fileOptions.sample_files.length === 0 ? (
                    <span className="text-xs text-muted-foreground">Nessun file disponibile</span>
                  ) : (
                    fileOptions.sample_files.map(f => (
                      <Badge 
                        key={f} 
                        variant={config.accuracyFiles.includes(f) ? "default" : "outline"}
                        className="cursor-pointer text-xs"
                        onClick={() => toggleFileInList('accuracyFiles', f)}
                      >
                        {f}
                      </Badge>
                    ))
                  )}
                </div>
              </div>

              {/* Anomalies Files */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Anomalies Files</Label>
                <div className="flex flex-wrap gap-1 min-h-[2rem] p-2 border rounded-md bg-muted/30">
                  {fileOptions.sample_files.length === 0 ? (
                    <span className="text-xs text-muted-foreground">Nessun file disponibile</span>
                  ) : (
                    fileOptions.sample_files.map(f => (
                      <Badge 
                        key={f} 
                        variant={config.anomaliesFiles.includes(f) ? "default" : "outline"}
                        className="cursor-pointer text-xs"
                        onClick={() => toggleFileInList('anomaliesFiles', f)}
                      >
                        {f}
                      </Badge>
                    ))
                  )}
                </div>
              </div>

              {/* Precision Files */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Precision Files</Label>
                <div className="flex flex-wrap gap-1 min-h-[2rem] p-2 border rounded-md bg-muted/30">
                  {fileOptions.sample_files.length === 0 ? (
                    <span className="text-xs text-muted-foreground">Nessun file disponibile</span>
                  ) : (
                    fileOptions.sample_files.map(f => (
                      <Badge 
                        key={f} 
                        variant={config.precisionFiles.includes(f) ? "default" : "outline"}
                        className="cursor-pointer text-xs"
                        onClick={() => toggleFileInList('precisionFiles', f)}
                      >
                        {f}
                      </Badge>
                    ))
                  )}
                </div>
              </div>

              {/* Stability Files */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Stability Files</Label>
                <div className="flex flex-wrap gap-1 min-h-[2rem] p-2 border rounded-md bg-muted/30">
                  {fileOptions.sample_files.length === 0 ? (
                    <span className="text-xs text-muted-foreground">Nessun file disponibile</span>
                  ) : (
                    fileOptions.sample_files.map(f => (
                      <Badge 
                        key={f} 
                        variant={config.stabilityFiles.includes(f) ? "default" : "outline"}
                        className="cursor-pointer text-xs"
                        onClick={() => toggleFileInList('stabilityFiles', f)}
                      >
                        {f}
                      </Badge>
                    ))
                  )}
                </div>
              </div>

              {/* Summary */}
              <Separator />
              <div className="text-sm text-muted-foreground">
                <p>Test selezionati:</p>
                <ul className="list-disc list-inside mt-1">
                  {config.accuracyFiles.length > 0 && <li>Accuracy: {config.accuracyFiles.length} file</li>}
                  {config.anomaliesFiles.length > 0 && <li>Anomalies: {config.anomaliesFiles.length} file</li>}
                  {config.precisionFiles.length > 0 && <li>Precision: {config.precisionFiles.length} file</li>}
                  {config.stabilityFiles.length > 0 && <li>Stability: {config.stabilityFiles.length} file</li>}
                  {config.accuracyFiles.length === 0 && config.anomaliesFiles.length === 0 && 
                   config.precisionFiles.length === 0 && config.stabilityFiles.length === 0 && (
                    <li className="text-yellow-600">Nessun file selezionato</li>
                  )}
                </ul>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Run Button */}
      <Card className="glass-card">
        <CardContent className="pt-6">
          <Button 
            size="lg" 
            className="w-full"
            disabled={!isConfigValid() || isLoading || (currentRun?.status === 'running' || currentRun?.status === 'pending')}
            onClick={runTests}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Avvio in corso...
              </>
            ) : currentRun?.status === 'running' || currentRun?.status === 'pending' ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Test in esecuzione...
              </>
            ) : (
              <>
                <Play className="w-5 h-5 mr-2" />
                Esegui Test Suite
              </>
            )}
          </Button>
          {!isConfigValid() && (
            <p className="text-sm text-muted-foreground text-center mt-2">
              Compila tutti i campi obbligatori per abilitare l'esecuzione
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
