import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { 
  COUNTRIES, 
  Segment, 
  TestType, 
  SEGMENT_LABELS, 
  TEST_TYPE_LABELS,
  getTestTypesForSegment 
} from '@/types/project';
import { Plus } from 'lucide-react';

interface NewProjectDialogProps {
  onAdd: (country: string, segment: Segment, testType: TestType) => void;
}

export function NewProjectDialog({ onAdd }: NewProjectDialogProps) {
  const [open, setOpen] = useState(false);
  const [countryCode, setCountryCode] = useState('');
  const [segment, setSegment] = useState<Segment | ''>('');
  const [testType, setTestType] = useState<TestType | ''>('');

  const selectedCountry = COUNTRIES.find(c => c.code === countryCode);
  const availableSegments = selectedCountry?.segments || [];
  const availableTestTypes = segment ? getTestTypesForSegment(segment) : [];

  // Reset dependent fields when parent changes
  useEffect(() => {
    setSegment('');
    setTestType('');
  }, [countryCode]);

  useEffect(() => {
    setTestType('');
  }, [segment]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (countryCode && segment && testType) {
      onAdd(countryCode, segment, testType);
      setCountryCode('');
      setSegment('');
      setTestType('');
      setOpen(false);
    }
  };

  const isValid = countryCode && segment && testType;

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
            <Select value={countryCode} onValueChange={setCountryCode}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona paese" />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.name} ({c.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {countryCode && (
            <div className="space-y-2 animate-fade-in">
              <Label>Segmento</Label>
              <RadioGroup 
                value={segment} 
                onValueChange={(v) => setSegment(v as Segment)}
                className="flex flex-wrap gap-4"
              >
                {availableSegments.map((seg) => (
                  <div key={seg} className="flex items-center space-x-2">
                    <RadioGroupItem value={seg} id={`seg-${seg}`} />
                    <Label htmlFor={`seg-${seg}`} className="cursor-pointer">
                      {SEGMENT_LABELS[seg]}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          )}

          {segment && (
            <div className="space-y-2 animate-fade-in">
              <Label>Tipo di Test</Label>
              <RadioGroup 
                value={testType} 
                onValueChange={(v) => setTestType(v as TestType)}
                className="flex flex-wrap gap-4"
              >
                {availableTestTypes.map((tt) => (
                  <div key={tt} className="flex items-center space-x-2">
                    <RadioGroupItem value={tt} id={`tt-${tt}`} />
                    <Label htmlFor={`tt-${tt}`} className="cursor-pointer">
                      {TEST_TYPE_LABELS[tt]}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annulla
            </Button>
            <Button type="submit" disabled={!isValid}>
              Crea Progetto
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
