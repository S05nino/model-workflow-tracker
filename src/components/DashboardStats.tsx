import { Project } from '@/types/project';
import { Card, CardContent } from '@/components/ui/card';
import { Activity, CheckCircle2, Clock, Pause, Globe } from 'lucide-react';

interface DashboardStatsProps {
  projects: Project[];
}

export function DashboardStats({ projects }: DashboardStatsProps) {
  const activeProjects = projects.filter(p => p.status === 'in-progress').length;
  const completedProjects = projects.filter(p => p.status === 'completed').length;
  const onHoldProjects = projects.filter(p => p.status === 'on-hold').length;
  const uniqueCountries = new Set(projects.map(p => p.country)).size;

  const stats = [
    {
      label: 'In Corso',
      value: activeProjects,
      icon: Activity,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      label: 'Completati',
      value: completedProjects,
      icon: CheckCircle2,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      label: 'In Pausa',
      value: onHoldProjects,
      icon: Pause,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
    },
    {
      label: 'Paesi Attivi',
      value: uniqueCountries,
      icon: Globe,
      color: 'text-accent',
      bgColor: 'bg-accent/10',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <Card key={stat.label} className="glass-card">
          <CardContent className="flex items-center gap-4 p-4">
            <div className={`p-3 rounded-xl ${stat.bgColor}`}>
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
