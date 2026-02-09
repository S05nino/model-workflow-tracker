import { useReleasesAdapter as useReleases, useCountriesAdapter as useCountries } from '@/hooks/adapters';
import { ReleaseCard } from './ReleaseCard';
import { NewReleaseDialog } from './NewReleaseDialog';
import { ManageCountriesDialog } from './ManageCountriesDialog';
import { Segment } from '@/types/project';
import { ReleaseModelIds } from '@/types/release';
import { Package } from 'lucide-react';
import { parseISO, compareAsc } from 'date-fns';

export function ReleasesSection() {
  const {
    releases,
    addRelease,
    toggleModelInclusion,
    confirmModelInRelease,
    addModelToRelease,
    deleteRelease,
    completeRelease,
    updateReleaseDate,
  } = useReleases();

  const { countries, addCountry, removeCountry } = useCountries();

  const handleAddRelease = (version: string, targetDate: string, models: { country: string; segment: Segment }[]) => {
    addRelease(version, targetDate, models);
  };

  const handleConfirmModel = (releaseId: string, modelId: string, modelIds: ReleaseModelIds) => {
    confirmModelInRelease(releaseId, modelId, modelIds);
  };

  const handleAddModel = (releaseId: string, country: string, segment: Segment) => {
    addModelToRelease(releaseId, country, segment);
  };

  const handleUpdateDate = (releaseId: string, newDate: string) => {
    updateReleaseDate(releaseId, newDate);
  };

  const handleDeleteRelease = (releaseId: string) => {
    deleteRelease(releaseId);
  };

  const handleCompleteRelease = (releaseId: string) => {
    completeRelease(releaseId);
  };

  const handleAddCountry = (country: { code: string; name: string; segments: Segment[] }) => {
    addCountry(country);
  };

  const handleRemoveCountry = (countryCode: string) => {
    removeCountry(countryCode);
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
        <div className="flex gap-2">
          <ManageCountriesDialog
            countries={countries}
            onAddCountry={handleAddCountry}
            onRemoveCountry={handleRemoveCountry}
          />
          <NewReleaseDialog onAdd={handleAddRelease} countries={countries} />
        </div>
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
                    countries={countries}
                    onToggleInclusion={(modelId) => toggleModelInclusion(release.id, modelId)}
                    onConfirmModel={(modelId, modelIds) => handleConfirmModel(release.id, modelId, modelIds)}
                    onAddModel={(country, segment) => handleAddModel(release.id, country, segment)}
                    onUpdateDate={(newDate) => handleUpdateDate(release.id, newDate)}
                    onDelete={() => handleDeleteRelease(release.id)}
                    onComplete={() => handleCompleteRelease(release.id)}
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
                    countries={countries}
                    onToggleInclusion={(modelId) => toggleModelInclusion(release.id, modelId)}
                    onConfirmModel={(modelId, modelIds) => handleConfirmModel(release.id, modelId, modelIds)}
                    onAddModel={(country, segment) => handleAddModel(release.id, country, segment)}
                    onUpdateDate={(newDate) => handleUpdateDate(release.id, newDate)}
                    onDelete={() => handleDeleteRelease(release.id)}
                    onComplete={() => handleCompleteRelease(release.id)}
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
