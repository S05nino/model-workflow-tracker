import { useState } from 'react';
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
import { ReleaseModelIds } from '@/types/release';

interface ConfirmModelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  countryName: string;
  segment: string;
  onConfirm: (modelIds: ReleaseModelIds) => void;
}

export function ConfirmModelDialog({
  open,
  onOpenChange,
  countryName,
  segment,
  onConfirm,
}: ConfirmModelDialogProps) {
  const [modelIds, setModelIds] = useState<ReleaseModelIds>({
    modelOut: '',
    modelIn: '',
    rulesOut: '',
    rulesIn: '',
  });

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
          </DialogDescription>
        </DialogHeader>
        
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

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button onClick={handleConfirm} disabled={!hasAnyId}>
            Conferma
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
