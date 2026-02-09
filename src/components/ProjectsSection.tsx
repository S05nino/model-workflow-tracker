import { useState } from 'react';
import { useProjectsAdapter as useProjects, useCountriesAdapter as useCountries, useReleasesAdapter as useReleases } from '@/hooks/adapters';
import { ProjectCard } from './ProjectCard';
import { NewProjectDialog } from './NewProjectDialog';
import { ConfirmModelDialog } from './ConfirmModelDialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, FolderOpen } from 'lucide-react';
import { toast } from 'sonner';
import { Project, TestType, SEGMENT_LABELS } from '@/types/project';
import { ReleaseModelIds } from '@/types/release';

interface ProjectsSectionProps {
  onNavigateToRelease?: (releaseId: string) => void;
}

export function ProjectsSection({ onNavigateToRelease }: ProjectsSectionProps) {
  const projectsHook = useProjects();
  const { 
    projects, 
    addProject, 
    updateProjectStep, 
    startNewRound,
    confirmProject, 
    updateProjectStatus,
    deleteProject 
  } = projectsHook;
  const loading = 'loading' in projectsHook ? projectsHook.loading : false;
  const { countries } = useCountries();
  const { releases } = useReleases();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmingProject, setConfirmingProject] = useState<{
    id: string;
    country: string;
    segment: string;
  } | null>(null);

  // Filter projects by search term
  const filteredProjects = projects.filter(p => {
    const countryName = countries.find(c => c.code === p.country)?.name || p.country;
    const searchLower = searchTerm.toLowerCase();
    return countryName.toLowerCase().includes(searchLower) || 
           p.country.toLowerCase().includes(searchLower) ||
           p.segment.toLowerCase().includes(searchLower);
  });

  // Separate active and completed projects
  const activeProjects = filteredProjects.filter(p => p.status !== 'completed');
  const completedProjects = filteredProjects.filter(p => p.status === 'completed');

  const handleAddProject = async (country: string, segment: Project['segment'], testType: TestType) => {
    const result = await addProject(country, segment, testType);
    if (result) {
      toast.success('Progetto creato', {
        description: `${country} - ${SEGMENT_LABELS[segment]}`,
      });
    }
  };

  const handleConfirmProject = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const countryName = countries.find(c => c.code === project.country)?.name || project.country;
    
    // Check if this project/country+segment is in any release
    const releaseWithModel = releases.find(r => 
      r.models.some(m => m.country === project.country && m.segment === project.segment && !m.confirmed)
    );

    if (releaseWithModel) {
      // Navigate to the release for final confirmation
      toast.info('Conferma nel Rilascio', {
        description: `Vai al rilascio v${releaseWithModel.version} per confermare il modello con gli ID`,
      });
      onNavigateToRelease?.(releaseWithModel.id);
    } else {
      // Open confirmation dialog for standalone projects
      setConfirmingProject({
        id: projectId,
        country: countryName,
        segment: SEGMENT_LABELS[project.segment],
      });
    }
  };

  const handleConfirmWithIds = async (modelIds: ReleaseModelIds) => {
    if (!confirmingProject) return;
    
    await confirmProject(confirmingProject.id);
    toast.success('Modello confermato', {
      description: `${confirmingProject.country} - ${confirmingProject.segment}`,
    });
    setConfirmingProject(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Progetti</h2>
          <p className="text-sm text-muted-foreground">
            Gestisci i progetti di fine-tuning standalone
          </p>
        </div>
        <NewProjectDialog
          countries={countries}
          onAdd={handleAddProject}
        />
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Cerca per paese o segmento..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Tabs for Active/Completed */}
      <Tabs defaultValue="active" className="w-full">
        <TabsList>
          <TabsTrigger value="active">
            In Corso ({activeProjects.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completati ({completedProjects.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-6">
          {activeProjects.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FolderOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nessun progetto attivo</p>
              <p className="text-sm">Crea un nuovo progetto per iniziare</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {activeProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  countries={countries}
                  onUpdateStep={(step) => updateProjectStep(project.id, step)}
                  onStartNewRound={(testType) => startNewRound(project.id, testType)}
                  onConfirm={() => handleConfirmProject(project.id)}
                  onUpdateStatus={(status) => updateProjectStatus(project.id, status)}
                  onDelete={() => deleteProject(project.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-6">
          {completedProjects.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FolderOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nessun progetto completato</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {completedProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  countries={countries}
                  onUpdateStep={(step) => updateProjectStep(project.id, step)}
                  onStartNewRound={(testType) => startNewRound(project.id, testType)}
                  onConfirm={() => handleConfirmProject(project.id)}
                  onUpdateStatus={(status) => updateProjectStatus(project.id, status)}
                  onDelete={() => deleteProject(project.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Confirm Model Dialog */}
      <ConfirmModelDialog
        open={!!confirmingProject}
        onOpenChange={(open) => !open && setConfirmingProject(null)}
        countryName={confirmingProject?.country || ''}
        segment={confirmingProject?.segment || ''}
        onConfirm={handleConfirmWithIds}
      />
    </section>
  );
}
