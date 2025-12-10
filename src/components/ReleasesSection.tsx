import { useReleases } from '@/hooks/useReleases';
import { ReleaseCard } from './ReleaseCard';
import { NewReleaseDialog } from './NewReleaseDialog';
import { Segment } from '@/types/project';
import { ReleaseModelIds } from '@/types/release';
import { Package } from 'lucide-react';
import { toast } from 'sonner';
import { parseISO, compareAsc } from 'date-fns';

export function ReleasesSection() {
  const {
    releases,
    addRelease,
    toggleModelInclusion,
    confirmModelInRelease,
    deleteRelease,
    completeRelease,
  } = useReleases();

  const handleAddRelease = (version: string, targetDate: string, models: { country: string; segment: Segment }[]) => {
    addRelease(version, targetDate, models);
    toast.success('Rilascio creato', {
      description: `Versione ${version} aggiunta con ${models.length} modelli`,
    });
  };

  const handleConfirmModel = (releaseId: string, modelId: string, modelIds: ReleaseModelIds) => {
    confirmModelInRelease(releaseId, modelId, modelIds);
    toast.success('Modello confermato nel rilascio');
  };

  const handleDeleteRelease = (releaseId: string, version: string) => {
    deleteRelease(releaseId);
    toast.info('Rilascio eliminato', {
      description: `Versione ${version} rimossa`,
    });
  };

  const handleCompleteRelease = (releaseId: string, version: string) => {
    completeRelease(releaseId);
    toast.success('Rilascio completato!', {
      description: `Versione ${version} completata con successo`,
    });
  };

  const activeReleases = releases
    .filter(r => !r.completed)
    .sort((a, b) => compareAsc(parseISO(a.targetDate), parseISO(b.targetDate)));
  
  const completedReleases = releases
    .filter(r => r.completed)
    .sort((a, b) => compareAsc(parseISO(b.targetDate), parseISO(a.targetDate)));

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-accent/10">
            <Package className="w-6 h-6 text-accent" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Rilasci</h2>
            <p className="text-sm text-muted-foreground">
              Gestisci le versioni e i modelli da rilasciare
            </p>
          </div>
        </div>
        <NewReleaseDialog onAdd={handleAddRelease} />
      </div>

      {releases.length === 0 ? (
        <div className="text-center py-12 glass-card rounded-xl">
          <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Nessun rilascio
          </h3>
          <p className="text-muted-foreground">
            Crea il tuo primo rilascio per iniziare a tracciare le versioni
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {activeReleases.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                In Corso ({activeReleases.length})
              </h3>
              <div className="space-y-4">
                {activeReleases.map((release) => (
                  <ReleaseCard
                    key={release.id}
                    release={release}
                    onToggleInclusion={(modelId) => toggleModelInclusion(release.id, modelId)}
                    onConfirmModel={(modelId, modelIds) => handleConfirmModel(release.id, modelId, modelIds)}
                    onDelete={() => handleDeleteRelease(release.id, release.version)}
                    onComplete={() => handleCompleteRelease(release.id, release.version)}
                  />
                ))}
              </div>
            </div>
          )}

          {completedReleases.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Completati ({completedReleases.length})
              </h3>
              <div className="space-y-4">
                {completedReleases.map((release) => (
                  <ReleaseCard
                    key={release.id}
                    release={release}
                    onToggleInclusion={(modelId) => toggleModelInclusion(release.id, modelId)}
                    onConfirmModel={(modelId, modelIds) => handleConfirmModel(release.id, modelId, modelIds)}
                    onDelete={() => handleDeleteRelease(release.id, release.version)}
                    onComplete={() => handleCompleteRelease(release.id, release.version)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
