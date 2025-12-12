import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus } from 'lucide-react';
import { CountryConfig, Segment, SEGMENT_LABELS } from '@/types/project';

interface NewReleaseDialogProps {
  onAdd: (version: string, targetDate: string, models: { country: string; segment: Segment }[]) => void;
  countries: CountryConfig[];
}

export function NewReleaseDialog({ onAdd, countries }: NewReleaseDialogProps) {
  const [open, setOpen] = useState(false);
  const [version, setVersion] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [selectedModels, setSelectedModels] = useState<{ country: string; segment: Segment }[]>([]);

  const toggleModel = (country: string, segment: Segment) => {
    const exists = selectedModels.some(m => m.country === country && m.segment === segment);
    if (exists) {
      setSelectedModels(selectedModels.filter(m => !(m.country === country && m.segment === segment)));
    } else {
      setSelectedModels([...selectedModels, { country, segment }]);
    }
  };

  const isModelSelected = (country: string, segment: Segment) => {
    return selectedModels.some(m => m.country === country && m.segment === segment);
  };

  const handleSubmit = () => {
    if (!version.trim() || !targetDate || selectedModels.length === 0) return;
    
    onAdd(version.trim(), targetDate, selectedModels);
    setVersion('');
    setTargetDate('');
    setSelectedModels([]);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Nuovo Rilascio
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuovo Rilascio</DialogTitle>
          <DialogDescription>
            Crea un nuovo rilascio e seleziona i modelli da includere.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="version">Versione</Label>
              <Input
                id="version"
                placeholder="es. 7.6.6"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="targetDate">Data Target</Label>
              <Input
                id="targetDate"
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Modelli da includere</Label>
            <div className="grid gap-2 max-h-64 overflow-y-auto border rounded-lg p-3">
              {countries.map((country) => (
                <div key={country.code} className="space-y-1">
                  <p className="font-medium text-sm text-foreground">{country.name}</p>
                  <div className="flex flex-wrap gap-2 pl-4">
                    {country.segments.map((segment) => (
                      <label
                        key={`${country.code}-${segment}`}
                        className="flex items-center gap-2 text-sm cursor-pointer"
                      >
                        <Checkbox
                          checked={isModelSelected(country.code, segment)}
                          onCheckedChange={() => toggleModel(country.code, segment)}
                        />
                        {SEGMENT_LABELS[segment]}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {selectedModels.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {selectedModels.length} modelli selezionati
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Annulla
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={!version.trim() || !targetDate || selectedModels.length === 0}
          >
            Crea Rilascio
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
