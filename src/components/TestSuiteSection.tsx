import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Copy, FileText, Play, Settings2, FlaskConical, FolderOpen } from 'lucide-react';

// Countries available in the test suite (matching the Python root folder structure)
const TEST_SUITE_COUNTRIES = [
  'AUT', 'BEL', 'CZK', 'DEU', 'ESP', 'FRA', 'GBR', 'IND', 'IRL', 'ITA', 'ITA2', 'MEX', 'POL', 'PRT', 'USA'
];

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

const defaultConfig: TestConfig = {
  country: '',
  segment: 'Consumer',
  version: 'x.x.x',
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
  const [fileInputs, setFileInputs] = useState({
    accuracy: '',
    anomalies: '',
    precision: '',
    stability: '',
  });

  const rootFolder = '\\\\sassrv04\\DA_WWCC1\\1_Global_Analytics_Consultancy\\R1_2\\PRODUCT\\CE\\01_Data\\TEST_SUITE';

  const updateConfig = (key: keyof TestConfig, value: string | number | string[]) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const addFileToList = (type: 'accuracyFiles' | 'anomaliesFiles' | 'precisionFiles' | 'stabilityFiles', inputKey: keyof typeof fileInputs) => {
    const fileName = fileInputs[inputKey].trim();
    if (fileName && !config[type].includes(fileName)) {
      updateConfig(type, [...config[type], fileName]);
      setFileInputs(prev => ({ ...prev, [inputKey]: '' }));
    }
  };

  const removeFileFromList = (type: 'accuracyFiles' | 'anomaliesFiles' | 'precisionFiles' | 'stabilityFiles', fileName: string) => {
    updateConfig(type, config[type].filter(f => f !== fileName));
  };

  const generatePythonCommand = (): string => {
    const today = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const segmentPath = `${rootFolder}\\${config.country}\\${config.segment}`;
    const outputFolder = `${segmentPath}\\${config.version}_${today}`;
    
    if (config.segment === 'Tagger') {
      return `# Tagger Test Configuration
# ===========================
# Country: ${config.country}
# Segment: ${config.segment}
# Version: ${config.version}
# Date: ${today}

from suite_tests.testRunner_tagger import TestRunner

old_model_path = r"${segmentPath}\\model\\${config.oldModel}"
new_model_path = r"${segmentPath}\\model\\${config.newModel}"
output_folder = r"${outputFolder}"
path_list_companies = r"${segmentPath}\\sample\\${config.companyList}"
distribution_data_path = r"${segmentPath}\\sample\\${config.distributionData}"

runner = TestRunner(old_model_path, new_model_path, output_folder)

# Crossvalidation
runner.compute_tagger_crossvalidation_score(save=True)

# Validation distribution
runner.compute_tagger_validation_distribution(
    validation_data_path=distribution_data_path,
    save=True,
    azure_batch=True,
    azure_batch_vm_path=r"C:\\Users\\kq5simmarine\\AppData\\Local\\Categorization.Classifier.NoJWT\\Utils\\Categorization.Classifier.Batch.AzureDataScience",
    path_list_companies=path_list_companies,
    ServicePrincipal_CertificateThumbprint='D0E4EB9FB0506DEF78ECF1283319760E980C1736',
    ServicePrincipal_ApplicationId='5fd0a365-b1c7-48c4-ba16-bdc211ddad84',
    vm_for_bench=${config.vmBench},
    vm_for_dev=${config.vmDev}
)

# Save reports
runner.save_tagger_reports(excel=True)
`;
    }

    // Consumer/Business
    const modelProdPath = `${segmentPath}\\model\\prod\\${config.oldModel}`;
    const modelDevPath = `${segmentPath}\\model\\develop\\${config.newModel}`;
    const expertOldPath = config.oldExpertRules ? `r"${segmentPath}\\model\\expertrules\\${config.oldExpertRules}"` : 'None';
    const expertNewPath = config.newExpertRules ? `r"${segmentPath}\\model\\expertrules\\${config.newExpertRules}"` : 'None';

    let testBlocks = '';

    if (config.accuracyFiles.length > 0) {
      config.accuracyFiles.forEach((f, i) => {
        testBlocks += `
# Accuracy test ${i + 1}
runner.compute_validation_scores(
    r"${segmentPath}\\sample\\${f}",
    save=True,
    tag="A_${i + 1}",
    azure_batch=True,
    azure_batch_vm_path=azure_batch_vm_path,
    old_expert_rules_zip_path=${expertOldPath},
    new_expert_rules_zip_path=${expertNewPath},
    ServicePrincipal_CertificateThumbprint=thumbprint,
    ServicePrincipal_ApplicationId=app_id,
    vm_for_bench=${config.vmBench},
    vm_for_dev=${config.vmDev}
)
`;
      });
    }

    if (config.anomaliesFiles.length > 0) {
      config.anomaliesFiles.forEach((f) => {
        testBlocks += `
# Anomalies test
runner.compute_validation_scores(
    r"${segmentPath}\\sample\\${f}",
    save=True,
    tag="ANOM",
    azure_batch=True,
    azure_batch_vm_path=azure_batch_vm_path,
    old_expert_rules_zip_path=${expertOldPath},
    new_expert_rules_zip_path=${expertNewPath},
    ServicePrincipal_CertificateThumbprint=thumbprint,
    ServicePrincipal_ApplicationId=app_id,
    vm_for_bench=${config.vmBench},
    vm_for_dev=${config.vmDev}
)
`;
      });
    }

    if (config.precisionFiles.length > 0) {
      config.precisionFiles.forEach((f) => {
        testBlocks += `
# Precision test
runner.compute_validation_scores(
    r"${segmentPath}\\sample\\${f}",
    save=True,
    tag="PREC",
    azure_batch=True,
    azure_batch_vm_path=azure_batch_vm_path,
    old_expert_rules_zip_path=${expertOldPath},
    new_expert_rules_zip_path=${expertNewPath},
    ServicePrincipal_CertificateThumbprint=thumbprint,
    ServicePrincipal_ApplicationId=app_id,
    vm_for_bench=${config.vmBench},
    vm_for_dev=${config.vmDev}
)
`;
      });
    }

    if (config.stabilityFiles.length > 0) {
      config.stabilityFiles.forEach((f, i) => {
        testBlocks += `
# Stability test ${i + 1}
runner.compute_validation_distribution(
    r"${segmentPath}\\sample\\${f}",
    save=True,
    tag="S_${i + 1}",
    azure_batch=True,
    azure_batch_vm_path=azure_batch_vm_path,
    old_expert_rules_zip_path=${expertOldPath},
    new_expert_rules_zip_path=${expertNewPath},
    ServicePrincipal_CertificateThumbprint=thumbprint,
    ServicePrincipal_ApplicationId=app_id,
    vm_for_bench=${config.vmBench},
    vm_for_dev=${config.vmDev}
)
`;
      });
    }

    return `# Test Configuration
# ==================
# Country: ${config.country}
# Segment: ${config.segment}
# Version: ${config.version}
# Date: ${today}

from suite_tests.testRunner import TestRunner
import os

# Paths
old_model_path = r"${modelProdPath}"
new_model_path = r"${modelDevPath}"
output_folder = r"${outputFolder}"
old_expert_rules = ${expertOldPath}
new_expert_rules = ${expertNewPath}

# Azure Batch config
azure_batch_vm_path = r"C:\\Users\\kq5simmarine\\AppData\\Local\\Categorization.Classifier.NoJWT\\Utils\\Categorization.Classifier.Batch.AzureDataScience"
thumbprint = 'D0E4EB9FB0506DEF78ECF1283319760E980C1736'
app_id = '5fd0a365-b1c7-48c4-ba16-bdc211ddad84'

# Create output folder
os.makedirs(output_folder, exist_ok=True)

# Initialize runner
runner = TestRunner(
    old_model_path,
    new_model_path,
    output_folder,
    old_expert_rules,
    new_expert_rules
)

# Crossvalidation
runner.compute_crossvalidation_score(
    old_expert_rules_zip_path=old_expert_rules,
    new_expert_rules_zip_path=new_expert_rules,
    save=True
)
${testBlocks}
# Save reports
runner.save_reports(weights=None, excel=True, pdf=False)
`;
  };

  const copyToClipboard = () => {
    const command = generatePythonCommand();
    navigator.clipboard.writeText(command);
    toast.success('Script Python copiato!', {
      description: 'Incollalo nel tuo ambiente Python per eseguire i test',
    });
  };

  const isConfigValid = () => {
    if (!config.country || !config.version || config.version === 'x.x.x') return false;
    
    if (config.segment === 'Tagger') {
      return !!(config.oldModel && config.newModel && config.distributionData);
    }
    
    return !!(config.oldModel && config.newModel && 
      (config.accuracyFiles.length > 0 || config.anomaliesFiles.length > 0 || 
       config.precisionFiles.length > 0 || config.stabilityFiles.length > 0));
  };

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
                <code className="text-xs bg-muted px-2 py-0.5 rounded">{rootFolder}</code>
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

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
                    {TEST_SUITE_COUNTRIES.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Segment</Label>
                <RadioGroup 
                  value={config.segment} 
                  onValueChange={(v) => updateConfig('segment', v as Segment)}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Consumer" id="consumer" />
                    <Label htmlFor="consumer" className="cursor-pointer">Consumer</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Business" id="business" />
                    <Label htmlFor="business" className="cursor-pointer">Business</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Tagger" id="tagger" />
                    <Label htmlFor="tagger" className="cursor-pointer">Tagger</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>

            {/* Version */}
            <div className="space-y-2">
              <Label>Model Version</Label>
              <Input 
                value={config.version}
                onChange={(e) => updateConfig('version', e.target.value)}
                placeholder="x.x.x"
              />
            </div>

            <Separator />

            {/* Models */}
            <div className="space-y-4">
              <Label className="text-base font-semibold">Modelli</Label>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">
                    {config.segment === 'Tagger' ? 'Old Model (.zip)' : 'Old Model (prod)'}
                  </Label>
                  <Input 
                    value={config.oldModel}
                    onChange={(e) => updateConfig('oldModel', e.target.value)}
                    placeholder="model_name.zip"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">
                    {config.segment === 'Tagger' ? 'New Model (.zip)' : 'New Model (develop)'}
                  </Label>
                  <Input 
                    value={config.newModel}
                    onChange={(e) => updateConfig('newModel', e.target.value)}
                    placeholder="model_name.zip"
                  />
                </div>
              </div>
            </div>

            {/* Expert Rules (only for Consumer/Business) */}
            {config.segment !== 'Tagger' && (
              <>
                <Separator />
                <div className="space-y-4">
                  <Label className="text-base font-semibold">Expert Rules (opzionale)</Label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">Old Expert Rules</Label>
                      <Input 
                        value={config.oldExpertRules}
                        onChange={(e) => updateConfig('oldExpertRules', e.target.value)}
                        placeholder="rules.zip"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">New Expert Rules</Label>
                      <Input 
                        value={config.newExpertRules}
                        onChange={(e) => updateConfig('newExpertRules', e.target.value)}
                        placeholder="rules.zip"
                      />
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
                      <Input 
                        value={config.companyList}
                        onChange={(e) => updateConfig('companyList', e.target.value)}
                        placeholder="list_companies.xlsx"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">Distribution Data</Label>
                      <Input 
                        value={config.distributionData}
                        onChange={(e) => updateConfig('distributionData', e.target.value)}
                        placeholder="data.tsv.gz"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Test Files (only for Consumer/Business) */}
            {config.segment !== 'Tagger' && (
              <>
                <Separator />
                <div className="space-y-4">
                  <Label className="text-base font-semibold">Test Files (.tsv.gz)</Label>
                  
                  {/* Accuracy Files */}
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Accuracy Files</Label>
                    <div className="flex gap-2">
                      <Input 
                        value={fileInputs.accuracy}
                        onChange={(e) => setFileInputs(prev => ({ ...prev, accuracy: e.target.value }))}
                        placeholder="file.tsv.gz"
                        onKeyDown={(e) => e.key === 'Enter' && addFileToList('accuracyFiles', 'accuracy')}
                      />
                      <Button variant="outline" size="icon" onClick={() => addFileToList('accuracyFiles', 'accuracy')}>+</Button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {config.accuracyFiles.map(f => (
                        <Badge key={f} variant="secondary" className="cursor-pointer" onClick={() => removeFileFromList('accuracyFiles', f)}>
                          {f} ×
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Anomalies Files */}
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Anomalies Files</Label>
                    <div className="flex gap-2">
                      <Input 
                        value={fileInputs.anomalies}
                        onChange={(e) => setFileInputs(prev => ({ ...prev, anomalies: e.target.value }))}
                        placeholder="file.tsv.gz"
                        onKeyDown={(e) => e.key === 'Enter' && addFileToList('anomaliesFiles', 'anomalies')}
                      />
                      <Button variant="outline" size="icon" onClick={() => addFileToList('anomaliesFiles', 'anomalies')}>+</Button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {config.anomaliesFiles.map(f => (
                        <Badge key={f} variant="secondary" className="cursor-pointer" onClick={() => removeFileFromList('anomaliesFiles', f)}>
                          {f} ×
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Precision Files */}
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Precision Files</Label>
                    <div className="flex gap-2">
                      <Input 
                        value={fileInputs.precision}
                        onChange={(e) => setFileInputs(prev => ({ ...prev, precision: e.target.value }))}
                        placeholder="file.tsv.gz"
                        onKeyDown={(e) => e.key === 'Enter' && addFileToList('precisionFiles', 'precision')}
                      />
                      <Button variant="outline" size="icon" onClick={() => addFileToList('precisionFiles', 'precision')}>+</Button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {config.precisionFiles.map(f => (
                        <Badge key={f} variant="secondary" className="cursor-pointer" onClick={() => removeFileFromList('precisionFiles', f)}>
                          {f} ×
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Stability Files */}
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Stability Files</Label>
                    <div className="flex gap-2">
                      <Input 
                        value={fileInputs.stability}
                        onChange={(e) => setFileInputs(prev => ({ ...prev, stability: e.target.value }))}
                        placeholder="file.tsv.gz"
                        onKeyDown={(e) => e.key === 'Enter' && addFileToList('stabilityFiles', 'stability')}
                      />
                      <Button variant="outline" size="icon" onClick={() => addFileToList('stabilityFiles', 'stability')}>+</Button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {config.stabilityFiles.map(f => (
                        <Badge key={f} variant="secondary" className="cursor-pointer" onClick={() => removeFileFromList('stabilityFiles', f)}>
                          {f} ×
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}

            <Separator />

            {/* Azure Batch Settings */}
            <div className="space-y-4">
              <Label className="text-base font-semibold">Azure Batch Settings</Label>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">VM for Benchmark</Label>
                  <RadioGroup 
                    value={String(config.vmBench)} 
                    onValueChange={(v) => updateConfig('vmBench', parseInt(v))}
                    className="flex gap-4"
                  >
                    {[1, 2, 3, 4].map(n => (
                      <div key={n} className="flex items-center space-x-1">
                        <RadioGroupItem value={String(n)} id={`vm-bench-${n}`} disabled={n === config.vmDev} />
                        <Label htmlFor={`vm-bench-${n}`} className="cursor-pointer">{n}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">VM for Development</Label>
                  <RadioGroup 
                    value={String(config.vmDev)} 
                    onValueChange={(v) => updateConfig('vmDev', parseInt(v))}
                    className="flex gap-4"
                  >
                    {[1, 2, 3, 4].map(n => (
                      <div key={n} className="flex items-center space-x-1">
                        <RadioGroupItem value={String(n)} id={`vm-dev-${n}`} disabled={n === config.vmBench} />
                        <Label htmlFor={`vm-dev-${n}`} className="cursor-pointer">{n}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Generated Script Panel */}
        <Card className="glass-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Script Python
              </CardTitle>
              <Button 
                onClick={copyToClipboard} 
                disabled={!isConfigValid()}
                className="gap-2"
              >
                <Copy className="w-4 h-4" />
                Copia Script
              </Button>
            </div>
            <CardDescription>
              Configura i parametri a sinistra, poi copia lo script generato per eseguirlo nel tuo ambiente Python
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted/50 p-4 rounded-lg overflow-auto max-h-[600px] text-xs font-mono whitespace-pre-wrap">
              {isConfigValid() ? generatePythonCommand() : '# Completa la configurazione per generare lo script\n# Campi obbligatori:\n# - Country\n# - Version (diversa da x.x.x)\n# - Old Model e New Model\n# - Almeno un file di test (o distribution data per Tagger)'}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
