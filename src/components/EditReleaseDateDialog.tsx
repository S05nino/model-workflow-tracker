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

interface EditReleaseDateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentDate: string;
  version: string;
  onSave: (newDate: string) => void;
}

export function EditReleaseDateDialog({
  open,
  onOpenChange,
  currentDate,
  version,
  onSave,
}: EditReleaseDateDialogProps) {
  const [date, setDate] = useState(currentDate);

  const handleSave = () => {
    if (date) {
      onSave(date);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[350px]">
        <DialogHeader>
          <DialogTitle>Modifica Data Rilascio</DialogTitle>
          <DialogDescription>
            Modifica la data target per la versione {version}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="targetDate">Nuova Data Target</Label>
            <Input
              id="targetDate"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button onClick={handleSave} disabled={!date}>
            Salva
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
