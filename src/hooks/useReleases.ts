import { useState, useEffect } from 'react';
import { Release, ReleaseModel, ReleaseModelIds } from '@/types/release';
import { Segment } from '@/types/project';

const STORAGE_KEY = 'ml-workflow-releases';

const generateId = () => Math.random().toString(36).substring(2, 9);

const INITIAL_RELEASES: Release[] = [
  {
    id: 'release-1',
    version: '7.6.6',
    targetDate: '2025-12-19',
    models: [
      { id: 'm1', country: 'AUT', segment: 'consumer', included: true, confirmed: false },
      { id: 'm2', country: 'CZE', segment: 'consumer', included: true, confirmed: false },
      { id: 'm3', country: 'BEL', segment: 'business', included: true, confirmed: false },
      { id: 'm4', country: 'FRA', segment: 'consumer', included: true, confirmed: false },
      { id: 'm5', country: 'DEU', segment: 'consumer', included: true, confirmed: false },
      { id: 'm6', country: 'ITA', segment: 'business', included: true, confirmed: false },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completed: false,
  },
];

export function useReleases() {
  const [releases, setReleases] = useState<Release[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setReleases(JSON.parse(stored));
    } else {
      setReleases(INITIAL_RELEASES);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_RELEASES));
    }
  }, []);

  const saveReleases = (newReleases: Release[]) => {
    setReleases(newReleases);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newReleases));
  };

  const addRelease = (version: string, targetDate: string, models: { country: string; segment: Segment }[]) => {
    const newRelease: Release = {
      id: generateId(),
      version,
      targetDate,
      models: models.map(m => ({
        id: generateId(),
        country: m.country,
        segment: m.segment,
        included: true,
        confirmed: false,
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completed: false,
    };

    saveReleases([...releases, newRelease]);
    return newRelease;
  };

  const toggleModelInclusion = (releaseId: string, modelId: string) => {
    const updated = releases.map(release => {
      if (release.id !== releaseId) return release;

      return {
        ...release,
        models: release.models.map(m => 
          m.id === modelId ? { ...m, included: !m.included } : m
        ),
        updatedAt: new Date().toISOString(),
      };
    });

    saveReleases(updated);
  };

  const confirmModelInRelease = (releaseId: string, modelId: string, modelIds: ReleaseModelIds) => {
    const updated = releases.map(release => {
      if (release.id !== releaseId) return release;

      return {
        ...release,
        models: release.models.map(m => 
          m.id === modelId 
            ? { ...m, confirmed: true, modelIds, confirmedAt: new Date().toISOString() } 
            : m
        ),
        updatedAt: new Date().toISOString(),
      };
    });

    saveReleases(updated);
  };

  const addModelToRelease = (releaseId: string, country: string, segment: Segment) => {
    const updated = releases.map(release => {
      if (release.id !== releaseId) return release;

      const exists = release.models.some(m => m.country === country && m.segment === segment);
      if (exists) return release;

      return {
        ...release,
        models: [...release.models, {
          id: generateId(),
          country,
          segment,
          included: true,
          confirmed: false,
        }],
        updatedAt: new Date().toISOString(),
      };
    });

    saveReleases(updated);
  };

  const removeModelFromRelease = (releaseId: string, modelId: string) => {
    const updated = releases.map(release => {
      if (release.id !== releaseId) return release;

      return {
        ...release,
        models: release.models.filter(m => m.id !== modelId),
        updatedAt: new Date().toISOString(),
      };
    });

    saveReleases(updated);
  };

  const deleteRelease = (releaseId: string) => {
    saveReleases(releases.filter(r => r.id !== releaseId));
  };

  const completeRelease = (releaseId: string) => {
    const updated = releases.map(release => {
      if (release.id !== releaseId) return release;

      return {
        ...release,
        completed: true,
        updatedAt: new Date().toISOString(),
      };
    });

    saveReleases(updated);
  };

  return {
    releases,
    addRelease,
    toggleModelInclusion,
    confirmModelInRelease,
    addModelToRelease,
    removeModelFromRelease,
    deleteRelease,
    completeRelease,
  };
}
