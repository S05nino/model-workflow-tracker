import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { COUNTRIES, TestType } from '@/types/project';
import { Plus } from 'lucide-react';

interface NewProjectDialogProps {
  onAdd: (country: string, clientName: string, testType: TestType) => void;
}

export function NewProjectDialog({ onAdd }: NewProjectDialogProps) {
  const [open, setOpen] = useState(false);
  const [country, setCountry] = useState('');
  const [clientName, setClientName] = useState('');
  const [testType, setTestType] = useState<TestType>('categorization');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (country && clientName) {
      onAdd(country, clientName, testType);
      setCountry('');
      setClientName('');
      setTestType('categorization');
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 glow-primary">
          <Plus className="w-4 h-4" />
          Nuovo Progetto
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Nuovo Progetto ML</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="country">Paese</Label>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona paese" />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="clientName">Nome Cliente</Label>
            <Input
              id="clientName"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Es. Azienda XYZ"
            />
          </div>

          <div className="space-y-2">
            <Label>Tipo di Test</Label>
            <RadioGroup 
              value={testType} 
              onValueChange={(v) => setTestType(v as TestType)}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="categorization" id="cat" />
                <Label htmlFor="cat" className="cursor-pointer">Categorizzazione</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="test-suite" id="test" />
                <Label htmlFor="test" className="cursor-pointer">Test Suite</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annulla
            </Button>
            <Button type="submit" disabled={!country || !clientName}>
              Crea Progetto
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
