import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { COUNTRIES, ProjectStatus } from '@/types/project';
import { Filter, X } from 'lucide-react';

interface FilterBarProps {
  statusFilter: ProjectStatus | 'all';
  countryFilter: string | 'all';
  onStatusChange: (status: ProjectStatus | 'all') => void;
  onCountryChange: (country: string | 'all') => void;
  onClearFilters: () => void;
}

const STATUS_OPTIONS: { value: ProjectStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Tutti gli stati' },
  { value: 'in-progress', label: 'In Corso' },
  { value: 'waiting', label: 'In Attesa' },
  { value: 'on-hold', label: 'Sospesi' },
  { value: 'completed', label: 'Completati' },
];

export function FilterBar({
  statusFilter,
  countryFilter,
  onStatusChange,
  onCountryChange,
  onClearFilters,
}: FilterBarProps) {
  const hasFilters = statusFilter !== 'all' || countryFilter !== 'all';

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Filter className="w-4 h-4" />
        <span className="text-sm font-medium">Filtri:</span>
      </div>

      <Select value={statusFilter} onValueChange={(v) => onStatusChange(v as ProjectStatus | 'all')}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Stato" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={countryFilter} onValueChange={onCountryChange}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Paese" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tutti i paesi</SelectItem>
          {COUNTRIES.map((c) => (
            <SelectItem key={c.code} value={c.code}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={onClearFilters} className="gap-1">
          <X className="w-4 h-4" />
          Rimuovi filtri
        </Button>
      )}
    </div>
  );
}
