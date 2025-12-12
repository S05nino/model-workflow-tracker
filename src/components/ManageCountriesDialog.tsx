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
import { Settings, Plus, Trash2 } from 'lucide-react';
import { CountryConfig, Segment, SEGMENT_LABELS } from '@/types/project';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ManageCountriesDialogProps {
  countries: CountryConfig[];
  onAddCountry: (country: CountryConfig) => void;
  onRemoveCountry: (countryCode: string) => void;
}

export function ManageCountriesDialog({ 
  countries, 
  onAddCountry, 
  onRemoveCountry 
}: ManageCountriesDialogProps) {
  const [open, setOpen] = useState(false);
  const [newCountryCode, setNewCountryCode] = useState('');
  const [newCountryName, setNewCountryName] = useState('');
  const [newCountrySegments, setNewCountrySegments] = useState<Segment[]>(['consumer']);

  const allSegments: Segment[] = ['consumer', 'business', 'tagger'];

  const toggleSegment = (segment: Segment) => {
    if (newCountrySegments.includes(segment)) {
      if (newCountrySegments.length > 1) {
        setNewCountrySegments(newCountrySegments.filter(s => s !== segment));
      }
    } else {
      setNewCountrySegments([...newCountrySegments, segment]);
    }
  };

  const handleAddCountry = () => {
    if (!newCountryCode.trim() || !newCountryName.trim()) return;
    
    const exists = countries.some(c => c.code.toUpperCase() === newCountryCode.toUpperCase());
    if (exists) return;

    onAddCountry({
      code: newCountryCode.toUpperCase(),
      name: newCountryName.trim(),
      segments: newCountrySegments,
    });

    setNewCountryCode('');
    setNewCountryName('');
    setNewCountrySegments(['consumer']);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings className="w-4 h-4" />
          Gestisci Paesi
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Gestione Paesi</DialogTitle>
          <DialogDescription>
            Aggiungi o rimuovi paesi dalla lista disponibile.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Add new country */}
          <div className="space-y-4 p-4 border rounded-lg">
            <h4 className="font-medium text-sm text-foreground">Aggiungi nuovo paese</h4>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="countryCode">Codice</Label>
                <Input
                  id="countryCode"
                  placeholder="es. CHE"
                  value={newCountryCode}
                  onChange={(e) => setNewCountryCode(e.target.value.toUpperCase())}
                  maxLength={4}
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="countryName">Nome</Label>
                <Input
                  id="countryName"
                  placeholder="es. Svizzera"
                  value={newCountryName}
                  onChange={(e) => setNewCountryName(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Segmenti supportati</Label>
              <div className="flex gap-4">
                {allSegments.map((segment) => (
                  <label
                    key={segment}
                    className="flex items-center gap-2 text-sm cursor-pointer"
                  >
                    <Checkbox
                      checked={newCountrySegments.includes(segment)}
                      onCheckedChange={() => toggleSegment(segment)}
                    />
                    {SEGMENT_LABELS[segment]}
                  </label>
                ))}
              </div>
            </div>

            <Button 
              onClick={handleAddCountry}
              disabled={!newCountryCode.trim() || !newCountryName.trim()}
              className="gap-2"
              size="sm"
            >
              <Plus className="w-4 h-4" />
              Aggiungi Paese
            </Button>
          </div>

          {/* List existing countries */}
          <div className="space-y-2">
            <Label>Paesi esistenti ({countries.length})</Label>
            <ScrollArea className="h-64 border rounded-lg">
              <div className="p-3 space-y-2">
                {countries.map((country) => (
                  <div 
                    key={country.code}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div>
                      <p className="font-medium text-sm text-foreground">
                        {country.name} 
                        <span className="text-muted-foreground ml-1">({country.code})</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {country.segments.map(s => SEGMENT_LABELS[s]).join(', ')}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => onRemoveCountry(country.code)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Chiudi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
