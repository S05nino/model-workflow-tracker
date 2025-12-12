import { useState } from 'react';
import { useProjects } from '@/hooks/useProjects';
import { useReleases } from '@/hooks/useReleases';
import { useCountries } from '@/hooks/useCountries';
import { ProjectCard } from '@/components/ProjectCard';
import { NewProjectDialog } from '@/components/NewProjectDialog';
import { DashboardStats } from '@/components/DashboardStats';
import { FilterBar } from '@/components/FilterBar';
import { ReleasesSection } from '@/components/ReleasesSection';
import { ProjectStatus, Segment, TestType } from '@/types/project';
import { Brain, Workflow, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { exportDashboardReport } from '@/lib/exportReport';

const Index = () => {
  const {
    projects,
    addProject,
    updateProjectStep,
    startNewRound,
    confirmProject,
    updateProjectStatus,
    deleteProject,
  } = useProjects();

  const { releases } = useReleases();
  const { countries } = useCountries();

  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all');
  const [countryFilter, setCountryFilter] = useState<string | 'all'>('all');

  const activeProjects = projects.filter(p => p.status !== 'completed');
  const completedProjects = projects.filter(p => p.status === 'completed');

  const filteredActiveProjects = activeProjects.filter((project) => {
    if (statusFilter !== 'all' && project.status !== statusFilter) return false;
    if (countryFilter !== 'all' && project.country !== countryFilter) return false;
    return true;
  });

  const filteredCompletedProjects = completedProjects.filter((project) => {
    if (countryFilter !== 'all' && project.country !== countryFilter) return false;
    return true;
  });

  const handleAddProject = (country: string, segment: Segment, testType: TestType) => {
    addProject(country, segment, testType);
    const countryName = countries.find(c => c.code === country)?.name || country;
    toast.success('Progetto creato', {
      description: `${countryName} aggiunto con successo`,
    });
  };

  const handleConfirmProject = (projectId: string, country: string) => {
    confirmProject(projectId);
    toast.success('Modello confermato!', {
      description: `Il modello per ${country} è stato approvato`,
    });
  };

  const handleDeleteProject = (projectId: string, country: string) => {
    deleteProject(projectId);
    toast.info('Progetto eliminato', {
      description: `${country} rimosso dalla lista`,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <header className="mb-8 animate-fade-in">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-primary/10 glow-primary">
                <Brain className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                  ML Workflow Tracker
                </h1>
                <p className="text-muted-foreground flex items-center gap-2">
                  <Workflow className="w-4 h-4" />
                  Gestione fine-tuning modelli
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={async () => {
                  const fileName = await exportDashboardReport(projects, releases);
                  toast.success('Report esportato', {
                    description: `File ${fileName} scaricato`,
                  });
                }}
              >
                <Download className="w-4 h-4 mr-2" />
                Esporta Report
              </Button>
              <NewProjectDialog onAdd={handleAddProject} countries={countries} />
            </div>
          </div>
        </header>

        {/* Stats */}
        <section className="mb-8 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <DashboardStats projects={projects} />
        </section>

        {/* Tabs for Projects and Releases */}
        <Tabs defaultValue="projects" className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <TabsList className="mb-6">
            <TabsTrigger value="projects">Progetti</TabsTrigger>
            <TabsTrigger value="releases">Rilasci</TabsTrigger>
          </TabsList>

          <TabsContent value="projects" className="space-y-6">
            {/* Filters */}
            <FilterBar
              statusFilter={statusFilter}
              countryFilter={countryFilter}
              countries={countries}
              onStatusChange={setStatusFilter}
              onCountryChange={setCountryFilter}
              onClearFilters={() => {
                setStatusFilter('all');
                setCountryFilter('all');
              }}
            />

            {/* Projects Grid */}
            {filteredActiveProjects.length === 0 && filteredCompletedProjects.length === 0 ? (
              <div className="text-center py-16 glass-card rounded-xl">
                <Brain className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  {projects.length === 0 ? 'Nessun progetto' : 'Nessun risultato'}
                </h3>
                <p className="text-muted-foreground">
                  {projects.length === 0
                    ? 'Crea il tuo primo progetto per iniziare a tracciare i workflow'
                    : 'Prova a modificare i filtri di ricerca'}
                </p>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Active Projects */}
                {filteredActiveProjects.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                      In Corso ({filteredActiveProjects.length})
                    </h3>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {filteredActiveProjects.map((project) => (
                        <ProjectCard
                          key={project.id}
                          project={project}
                          countries={countries}
                          onUpdateStep={(step) => updateProjectStep(project.id, step)}
                          onStartNewRound={(testType) => startNewRound(project.id, testType)}
                          onConfirm={() => handleConfirmProject(project.id, project.country)}
                          onUpdateStatus={(status) => updateProjectStatus(project.id, status)}
                          onDelete={() => handleDeleteProject(project.id, project.country)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Completed Projects */}
                {filteredCompletedProjects.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                      Completati ({filteredCompletedProjects.length})
                    </h3>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {filteredCompletedProjects.map((project) => (
                        <ProjectCard
                          key={project.id}
                          project={project}
                          countries={countries}
                          onUpdateStep={(step) => updateProjectStep(project.id, step)}
                          onStartNewRound={(testType) => startNewRound(project.id, testType)}
                          onConfirm={() => handleConfirmProject(project.id, project.country)}
                          onUpdateStatus={(status) => updateProjectStatus(project.id, status)}
                          onDelete={() => handleDeleteProject(project.id, project.country)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="releases">
            <ReleasesSection />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
