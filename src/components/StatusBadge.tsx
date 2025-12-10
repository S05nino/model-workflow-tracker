import { Badge } from '@/components/ui/badge';
import { ProjectStatus } from '@/types/project';

const STATUS_CONFIG: Record<ProjectStatus, { label: string; variant: ProjectStatus }> = {
  waiting: { label: 'In Attesa', variant: 'waiting' },
  'in-progress': { label: 'In Corso', variant: 'in-progress' },
  completed: { label: 'Completato', variant: 'completed' },
  'on-hold': { label: 'Sospeso', variant: 'on-hold' },
};

interface StatusBadgeProps {
  status: ProjectStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <Badge variant={config.variant}>
      {config.label}
    </Badge>
  );
}
