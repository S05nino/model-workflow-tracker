import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { ReleaseModelIds } from '@/types/release';
import { RELEASE_TO_TESTSUITE_COUNTRY } from '@/lib/countryMapping';

interface ConfirmModelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  countryName: string;
  countryCode?: string;
  segment: string;
  onConfirm: (modelIds: ReleaseModelIds) => void;
}

/** Extract UUID from a model filename like modelcategory_7.6.3_it-IT_1_0_EUR_00000_20260127-134024_36299e7f-... */
function extractUUID(filename: string): string {
  // UUID pattern at end of filename (before .zip)
  const match = filename.replace(/\.zip$/i, '').match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  return match ? match[0] : filename;
}

export function ConfirmModelDialog({
  open,
  onOpenChange,
  countryName,
  countryCode,
  segment,
  onConfirm,
}: ConfirmModelDialogProps) {
  const [modelIds, setModelIds] = useState<ReleaseModelIds>({
    modelOut: '',
    modelIn: '',
    rulesOut: '',
    rulesIn: '',
  });
  const [loading, setLoading] = useState(false);

  // Auto-fetch model IDs from local folders when dialog opens
  useEffect(() => {
    if (!open || !countryCode) return;
    
    const fetchModelIds = async () => {
      setLoading(true);
      const API_BASE = (import.meta as any).env?.VITE_BACKEND_URL || '';
      const tsCountry = RELEASE_TO_TESTSUITE_COUNTRY[countryCode];
      if (!tsCountry) {
        setLoading(false);
        return;
      }
      
      const segLower = segment.toLowerCase();
      const basePath = `${tsCountry}/${segLower}`;
      
      try {
        // Fetch develop models
        const devRes = await fetch(`${API_BASE}/api/testsuite/list?path=${encodeURIComponent(`${basePath}/model/develop`)}`);
        const devData = await devRes.json();
        const devFiles = (devData.files || []).map((f: any) => f.name).filter((n: string) => n.endsWith('.zip'));
        
        // Fetch expert rules (check for new subfolder first)
        const erRes = await fetch(`${API_BASE}/api/testsuite/list?path=${encodeURIComponent(`${basePath}/model/expertrules`)}`);
        const erData = await erRes.json();
        const hasNewFolder = (erData.folders || []).some((f: any) => f.name === 'new');
        
        let newRules: string[] = [];
        if (hasNewFolder) {
          const newRes = await fetch(`${API_BASE}/api/testsuite/list?path=${encodeURIComponent(`${basePath}/model/expertrules/new`)}`);
          const newData = await newRes.json();
          newRules = (newData.files || []).map((f: any) => f.name).filter((n: string) => n.endsWith('.zip'));
        } else {
          newRules = (erData.files || []).map((f: any) => f.name).filter((n: string) => n.endsWith('.zip'));
        }
        
        // Filter by OUT (x_0) and IN (x_1) patterns
        const segCode = segLower === 'business' ? '3' : '1';
        const outPattern = `_${segCode}_0_`;
        const inPattern = `_${segCode}_1_`;
        
        const modelOut = devFiles.find((f: string) => f.includes(outPattern));
        const modelIn = devFiles.find((f: string) => f.includes(inPattern));
        const rulesOut = newRules.find((f: string) => f.includes(outPattern));
        const rulesIn = newRules.find((f: string) => f.includes(inPattern));
        
        setModelIds({
          modelOut: modelOut ? extractUUID(modelOut) : '',
          modelIn: modelIn ? extractUUID(modelIn) : '',
          rulesOut: rulesOut ? extractUUID(rulesOut) : '',
          rulesIn: rulesIn ? extractUUID(rulesIn) : '',
        });
      } catch (err) {
        console.error('Error fetching model IDs:', err);
      }
      setLoading(false);
    };
    
    fetchModelIds();
  }, [open, countryCode, segment]);

  const handleConfirm = () => {
    const cleanedIds: ReleaseModelIds = {};
    if (modelIds.modelOut?.trim()) cleanedIds.modelOut = modelIds.modelOut.trim();
    if (modelIds.modelIn?.trim()) cleanedIds.modelIn = modelIds.modelIn.trim();
    if (modelIds.rulesOut?.trim()) cleanedIds.rulesOut = modelIds.rulesOut.trim();
    if (modelIds.rulesIn?.trim()) cleanedIds.rulesIn = modelIds.rulesIn.trim();
    
    onConfirm(cleanedIds);
    setModelIds({ modelOut: '', modelIn: '', rulesOut: '', rulesIn: '' });
    onOpenChange(false);
  };

  const hasAnyId = modelIds.modelOut?.trim() || modelIds.modelIn?.trim() || 
                   modelIds.rulesOut?.trim() || modelIds.rulesIn?.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Conferma Modello</DialogTitle>
          <DialogDescription>
            Inserisci gli ID per {countryName} - {segment}. Non tutti i campi sono obbligatori.
            {loading && <span className="ml-2 text-primary">Caricamento automatico...</span>}
          </DialogDescription>
        </DialogHeader>
        
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="ml-2 text-sm text-muted-foreground">Lettura UUID dai modelli...</span>
          </div>
        ) : (
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="modelOut">Modello OUT</Label>
              <Input
                id="modelOut"
                placeholder="ID modello out..."
                value={modelIds.modelOut}
                onChange={(e) => setModelIds(prev => ({ ...prev, modelOut: e.target.value }))}
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="modelIn">Modello IN</Label>
              <Input
                id="modelIn"
                placeholder="ID modello in..."
                value={modelIds.modelIn}
                onChange={(e) => setModelIds(prev => ({ ...prev, modelIn: e.target.value }))}
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="rulesOut">Regole OUT</Label>
              <Input
                id="rulesOut"
                placeholder="ID regole out..."
                value={modelIds.rulesOut}
                onChange={(e) => setModelIds(prev => ({ ...prev, rulesOut: e.target.value }))}
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="rulesIn">Regole IN</Label>
              <Input
                id="rulesIn"
                placeholder="ID regole in..."
                value={modelIds.rulesIn}
                onChange={(e) => setModelIds(prev => ({ ...prev, rulesIn: e.target.value }))}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button onClick={handleConfirm} disabled={!hasAnyId || loading}>
            Conferma
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
