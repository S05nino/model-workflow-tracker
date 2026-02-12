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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Release } from '@/types/release';

interface AssignToReleaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  releases: Release[];
  countryName: string;
  onAssign: (releaseId: string) => void;
}

export function AssignToReleaseDialog({
  open,
  onOpenChange,
  releases,
  countryName,
  onAssign,
}: AssignToReleaseDialogProps) {
  const [selectedRelease, setSelectedRelease] = useState('');

  const activeReleases = releases.filter(r => !r.completed);

  const handleAssign = () => {
    if (selectedRelease) {
      onAssign(selectedRelease);
      setSelectedRelease('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[350px]">
        <DialogHeader>
          <DialogTitle>Associa a Rilascio</DialogTitle>
          <DialogDescription>
            Associa {countryName} a un rilascio attivo.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <Select value={selectedRelease} onValueChange={setSelectedRelease}>
            <SelectTrigger>
              <SelectValue placeholder="Seleziona rilascio" />
            </SelectTrigger>
            <SelectContent>
              {activeReleases.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  v{r.version}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button onClick={handleAssign} disabled={!selectedRelease}>
            Associa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
