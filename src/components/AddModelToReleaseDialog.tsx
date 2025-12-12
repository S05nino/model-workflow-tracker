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
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Plus } from 'lucide-react';
import { CountryConfig, Segment, SEGMENT_LABELS } from '@/types/project';
import { ReleaseModel } from '@/types/release';

interface AddModelToReleaseDialogProps {
  existingModels: ReleaseModel[];
  countries: CountryConfig[];
  onAdd: (country: string, segment: Segment) => void;
}

export function AddModelToReleaseDialog({ existingModels, countries, onAdd }: AddModelToReleaseDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedModels, setSelectedModels] = useState<{ country: string; segment: Segment }[]>([]);

  const isModelInRelease = (country: string, segment: Segment) => {
    return existingModels.some(m => m.country === country && m.segment === segment);
  };

  const isModelSelected = (country: string, segment: Segment) => {
    return selectedModels.some(m => m.country === country && m.segment === segment);
  };

  const toggleModel = (country: string, segment: Segment) => {
    const exists = selectedModels.some(m => m.country === country && m.segment === segment);
    if (exists) {
      setSelectedModels(selectedModels.filter(m => !(m.country === country && m.segment === segment)));
    } else {
      setSelectedModels([...selectedModels, { country, segment }]);
    }
  };

  const handleSubmit = () => {
    selectedModels.forEach(m => {
      onAdd(m.country, m.segment);
    });
    setSelectedModels([]);
    setOpen(false);
  };

  // Filter to only show countries/segments not already in the release
  const availableOptions = countries.filter(country => 
    country.segments.some(segment => !isModelInRelease(country.code, segment))
  );

  if (availableOptions.length === 0) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Plus className="w-4 h-4" />
          Aggiungi Modello
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Aggiungi Modelli al Rilascio</DialogTitle>
          <DialogDescription>
            Seleziona i modelli da aggiungere a questo rilascio.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Modelli disponibili</Label>
            <div className="grid gap-2 max-h-64 overflow-y-auto border rounded-lg p-3">
              {availableOptions.map((country) => {
                const availableSegments = country.segments.filter(
                  segment => !isModelInRelease(country.code, segment)
                );
                
                if (availableSegments.length === 0) return null;

                return (
                  <div key={country.code} className="space-y-1">
                    <p className="font-medium text-sm text-foreground">{country.name}</p>
                    <div className="flex flex-wrap gap-2 pl-4">
                      {availableSegments.map((segment) => (
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
                );
              })}
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
            disabled={selectedModels.length === 0}
          >
            Aggiungi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
