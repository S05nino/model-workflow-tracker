import { useState } from 'react';
import { ReleaseCard } from './ReleaseCard';
import { AssignToReleaseDialog } from './AssignToReleaseDialog';
import { Segment, TestType, WorkflowStep, SEGMENT_LABELS, TEST_TYPE_LABELS, WORKFLOW_STEPS, getTestTypesForSegment, Project, CountryConfig } from '@/types/project';
import { Release, ReleaseModelIds } from '@/types/release';
import { Package, Globe, MoreVertical, Trash2, Plus, Pause, Play, ChevronRight, CheckCircle2, RefreshCw, Link } from 'lucide-react';
import { RELEASE_TO_TESTSUITE_COUNTRY, navigateToTestSuite } from '@/lib/countryMapping';
import { parseISO, compareAsc } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { WorkflowProgress } from './WorkflowProgress';
import { ConfirmModelDialog } from './ConfirmModelDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface ReleasesSectionProps {
  releases: Release[];
  countries: CountryConfig[];
  projects: Project[];
  toggleModelInclusion: (releaseId: string, modelId: string) => void;
  confirmModelInRelease: (releaseId: string, modelId: string, modelIds: ReleaseModelIds) => void;
  addModelToRelease: (releaseId: string, country: string, segment: Segment) => void;
  deleteRelease: (releaseId: string) => void;
  completeRelease: (releaseId: string) => void;
  updateReleaseDate: (releaseId: string, newDate: string) => void;
  updateModelStep: (releaseId: string, modelId: string, step: WorkflowStep) => void;
  startModelNewRound: (releaseId: string, modelId: string, testType: TestType) => void;
  updateModelStatus: (releaseId: string, modelId: string, status: string) => void;
  updateProjectStep: (projectId: string, step: WorkflowStep) => void;
  startNewRound: (projectId: string, testType: TestType) => void;
  confirmProject: (projectId: string) => void;
  updateProjectStatus: (projectId: string, status: Project["status"]) => void;
  deleteProject: (projectId: string) => void;
}

export function ReleasesSection({
  releases,
  countries,
  projects,
  toggleModelInclusion,
  confirmModelInRelease,
  addModelToRelease,
  deleteRelease,
  completeRelease,
  updateReleaseDate,
  updateModelStep,
  startModelNewRound,
  updateModelStatus,
  updateProjectStep,
  startNewRound,
  confirmProject,
  updateProjectStatus,
  deleteProject,
}: ReleasesSectionProps) {
  const [assigningProject, setAssigningProject] = useState<{ projectId: string; country: string; segment: Segment } | null>(null);

  // Find standalone projects (all non-completed projects are shown here)
  const standaloneProjects = projects.filter(p => p.status !== 'completed');

  const handleAssignToRelease = (releaseId: string) => {
    if (!assigningProject) return;
    addModelToRelease(releaseId, assigningProject.country, assigningProject.segment);
    deleteProject(assigningProject.projectId);
    setAssigningProject(null);
  };

  const activeReleases = releases
    .filter(r => !r.completed)
    .sort((a, b) => compareAsc(parseISO(a.targetDate), parseISO(b.targetDate)));

  const completedReleases = releases
    .filter(r => r.completed)
    .sort((a, b) => compareAsc(parseISO(b.targetDate), parseISO(a.targetDate)));

  return (
    <section className="space-y-6">
      {/* Active Releases */}
      {activeReleases.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Rilasci In Corso ({activeReleases.length})
          </h3>
          <div className="space-y-4">
            {activeReleases.map((release) => (
              <ReleaseCard
                key={release.id}
                release={release}
                countries={countries}
                onToggleInclusion={(modelId) => toggleModelInclusion(release.id, modelId)}
                onConfirmModel={(modelId, modelIds) => confirmModelInRelease(release.id, modelId, modelIds)}
                onAddModel={(country, segment) => addModelToRelease(release.id, country, segment)}
                onUpdateDate={(newDate) => updateReleaseDate(release.id, newDate)}
                onDelete={() => deleteRelease(release.id)}
                onComplete={() => completeRelease(release.id)}
                onUpdateModelStep={(modelId, step) => updateModelStep(release.id, modelId, step)}
                onStartModelNewRound={(modelId, testType) => startModelNewRound(release.id, modelId, testType)}
                onUpdateModelStatus={(modelId, status) => updateModelStatus(release.id, modelId, status)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Completed Releases */}
      {completedReleases.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Rilasci Completati ({completedReleases.length})
          </h3>
          <div className="space-y-4">
            {completedReleases.map((release) => (
              <ReleaseCard
                key={release.id}
                release={release}
                countries={countries}
                onToggleInclusion={(modelId) => toggleModelInclusion(release.id, modelId)}
                onConfirmModel={(modelId, modelIds) => confirmModelInRelease(release.id, modelId, modelIds)}
                onAddModel={(country, segment) => addModelToRelease(release.id, country, segment)}
                onUpdateDate={(newDate) => updateReleaseDate(release.id, newDate)}
                onDelete={() => deleteRelease(release.id)}
                onComplete={() => completeRelease(release.id)}
                onUpdateModelStep={(modelId, step) => updateModelStep(release.id, modelId, step)}
                onStartModelNewRound={(modelId, testType) => startModelNewRound(release.id, modelId, testType)}
                onUpdateModelStatus={(modelId, status) => updateModelStatus(release.id, modelId, status)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Standalone Projects */}
      {standaloneProjects.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Progetti Senza Rilascio ({standaloneProjects.length})
          </h3>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {standaloneProjects.map((project) => {
              const countryName = countries.find(c => c.code === project.country)?.name || project.country;
              const currentRound = project.rounds.find(r => r.roundNumber === project.currentRound);
              const isRoundCompleted = currentRound?.currentStep === 3;
              const availableTestTypes = getTestTypesForSegment(project.segment);

              return (
                <Card key={project.id} className="glass-card">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-primary" />
                        <span className="font-semibold text-foreground">{countryName}</span>
                        <span className="text-xs text-muted-foreground">({project.country})</span>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setAssigningProject({
                            projectId: project.id,
                            country: project.country,
                            segment: project.segment,
                          })}>
                            <Link className="w-4 h-4 mr-2" />
                            Associa a Rilascio
                          </DropdownMenuItem>
                          {project.status === 'in-progress' && (
                            <DropdownMenuItem onClick={() => updateProjectStatus(project.id, 'on-hold')}>
                              <Pause className="w-4 h-4 mr-2" />
                              Metti in pausa
                            </DropdownMenuItem>
                          )}
                          {project.status === 'on-hold' && (
                            <DropdownMenuItem onClick={() => updateProjectStatus(project.id, 'in-progress')}>
                              <Play className="w-4 h-4 mr-2" />
                              Riprendi
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => deleteProject(project.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Elimina
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{SEGMENT_LABELS[project.segment]}</Badge>
                      {currentRound && (
                        <Badge variant="secondary" className="text-xs">
                          R{project.currentRound} - {TEST_TYPE_LABELS[currentRound.testType]}
                        </Badge>
                      )}
                    </div>

                    {currentRound && (
                      <>
                        <WorkflowProgress
                          currentStep={currentRound.currentStep}
                          isCompleted={isRoundCompleted}
                          onStepClick={(step) => updateProjectStep(project.id, step)}
                          interactive={project.status === 'in-progress'}
                        />

                        {project.status === 'in-progress' && (
                          <div className="flex gap-2">
                            {!isRoundCompleted ? (
                              <Button
                                onClick={() => {
                                  if (currentRound.currentStep < 3) {
                                    const nextStep = (currentRound.currentStep + 1) as WorkflowStep;
                                    updateProjectStep(project.id, nextStep);
                                    if (currentRound.currentStep === 1) {
                                      const testSuiteCountry = RELEASE_TO_TESTSUITE_COUNTRY[project.country];
                                      if (testSuiteCountry) {
                                        navigateToTestSuite({
                                          country: testSuiteCountry,
                                          segment: project.segment,
                                          valueSign: "OUT",
                                        });
                                      }
                                    }
                                  }
                                }}
                                className="flex-1 gap-2"
                                size="sm"
                              >
                                Prossimo Step
                                <ChevronRight className="w-4 h-4" />
                              </Button>
                            ) : (
                              <>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm" className="flex-1 gap-2">
                                      <Plus className="w-4 h-4" />
                                      Nuovo Round
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent>
                                    {availableTestTypes.map((tt) => (
                                      <DropdownMenuItem key={tt} onClick={() => startNewRound(project.id, tt)}>
                                        {TEST_TYPE_LABELS[tt]}
                                      </DropdownMenuItem>
                                    ))}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                                <Button
                                  onClick={() => confirmProject(project.id)}
                                  variant="default"
                                  size="sm"
                                  className="flex-1 gap-2 bg-success hover:bg-success/90"
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                  Conferma
                                </Button>
                              </>
                            )}
                          </div>
                        )}

                        {project.status === 'waiting' && project.awaitingConfirmation && (
                          <div className="flex gap-2">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="flex-1 gap-2">
                                  <Plus className="w-4 h-4" />
                                  Nuovo Round
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent>
                                {availableTestTypes.map((tt) => (
                                  <DropdownMenuItem key={tt} onClick={() => startNewRound(project.id, tt)}>
                                    {TEST_TYPE_LABELS[tt]}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                            <Button
                              onClick={() => confirmProject(project.id)}
                              variant="default"
                              size="sm"
                              className="flex-1 gap-2 bg-success hover:bg-success/90"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              Conferma
                            </Button>
                          </div>
                        )}

                        {project.status === 'on-hold' && (
                          <div className="text-center py-1 text-sm text-warning">
                            <Pause className="w-4 h-4 inline mr-1" />
                            In pausa
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {releases.length === 0 && standaloneProjects.length === 0 && (
        <div className="text-center py-12 glass-card rounded-xl">
          <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Nessun rilascio o progetto
          </h3>
          <p className="text-muted-foreground">
            Crea un nuovo rilascio o progetto per iniziare
          </p>
        </div>
      )}

      {/* Assign to release dialog */}
      {assigningProject && (
        <AssignToReleaseDialog
          open={!!assigningProject}
          onOpenChange={(open) => !open && setAssigningProject(null)}
          releases={releases}
          countryName={countries.find(c => c.code === assigningProject.country)?.name || assigningProject.country}
          onAssign={handleAssignToRelease}
        />
      )}
    </section>
  );
}