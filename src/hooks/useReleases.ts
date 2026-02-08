import { useState, useEffect } from "react";
import { Release, ReleaseModel, ReleaseModelIds, WorkflowRound } from "@/types/release";
import { Segment, TestType, WorkflowStep } from "@/types/project";

const STORAGE_KEY = "ml-workflow-releases";

const generateId = () => Math.random().toString(36).substring(2, 9);

const createInitialRound = (testType: TestType): WorkflowRound => ({
  id: generateId(),
  roundNumber: 1,
  testType,
  currentStep: 1,
  startedAt: new Date().toISOString(),
});

const createNewModel = (country: string, segment: Segment, testType: TestType = 'categorization'): ReleaseModel => ({
  id: generateId(),
  country,
  segment,
  included: true,
  confirmed: false,
  currentRound: 1,
  rounds: [createInitialRound(testType)],
  status: 'in-progress',
});

const INITIAL_RELEASES: Release[] = [];

export function useReleases() {
  const [releases, setReleases] = useState<Release[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      // Migrate old data if needed
      const parsed = JSON.parse(stored);
      const migrated = parsed.map((release: Release) => ({
        ...release,
        models: release.models.map((m: ReleaseModel) => ({
          ...m,
          currentRound: m.currentRound ?? 1,
          rounds: m.rounds ?? [createInitialRound('categorization')],
          status: m.status ?? (m.confirmed ? 'completed' : 'in-progress'),
        })),
      }));
      setReleases(migrated);
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
      models: models.map((m) => createNewModel(m.country, m.segment)),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completed: false,
    };

    saveReleases([...releases, newRelease]);
    return newRelease;
  };

  const toggleModelInclusion = (releaseId: string, modelId: string) => {
    const updated = releases.map((release) => {
      if (release.id !== releaseId) return release;

      return {
        ...release,
        models: release.models.map((m) => (m.id === modelId ? { ...m, included: !m.included } : m)),
        updatedAt: new Date().toISOString(),
      };
    });

    saveReleases(updated);
  };

  const confirmModelInRelease = (releaseId: string, modelId: string, modelIds: ReleaseModelIds) => {
    const updated = releases.map((release) => {
      if (release.id !== releaseId) return release;

      return {
        ...release,
        models: release.models.map((m) =>
          m.id === modelId
            ? { ...m, confirmed: true, modelIds, confirmedAt: new Date().toISOString(), status: 'completed' as const }
            : m,
        ),
        updatedAt: new Date().toISOString(),
      };
    });

    saveReleases(updated);
  };

  const updateModelStep = (releaseId: string, modelId: string, step: WorkflowStep) => {
    const updated = releases.map((release) => {
      if (release.id !== releaseId) return release;

      return {
        ...release,
        models: release.models.map((m) => {
          if (m.id !== modelId) return m;

          const currentRoundIndex = m.rounds.findIndex((r) => r.roundNumber === m.currentRound);
          if (currentRoundIndex === -1) return m;

          const updatedRounds = [...m.rounds];
          updatedRounds[currentRoundIndex] = {
            ...updatedRounds[currentRoundIndex],
            currentStep: step,
            ...(step === 3 ? { completedAt: new Date().toISOString() } : {}),
          };

          return {
            ...m,
            rounds: updatedRounds,
            status: step === 3 ? ('waiting' as const) : ('in-progress' as const),
          };
        }),
        updatedAt: new Date().toISOString(),
      };
    });

    saveReleases(updated);
  };

  const startNewRound = (releaseId: string, modelId: string, testType: TestType) => {
    const updated = releases.map((release) => {
      if (release.id !== releaseId) return release;

      return {
        ...release,
        models: release.models.map((m) => {
          if (m.id !== modelId) return m;

          const newRoundNumber = m.currentRound + 1;
          return {
            ...m,
            currentRound: newRoundNumber,
            rounds: [
              ...m.rounds,
              {
                id: generateId(),
                roundNumber: newRoundNumber,
                testType,
                currentStep: 1 as WorkflowStep,
                startedAt: new Date().toISOString(),
              },
            ],
            status: 'in-progress' as const,
          };
        }),
        updatedAt: new Date().toISOString(),
      };
    });

    saveReleases(updated);
  };

  const updateModelStatus = (releaseId: string, modelId: string, status: ReleaseModel['status']) => {
    const updated = releases.map((release) => {
      if (release.id !== releaseId) return release;

      return {
        ...release,
        models: release.models.map((m) => (m.id === modelId ? { ...m, status } : m)),
        updatedAt: new Date().toISOString(),
      };
    });

    saveReleases(updated);
  };

  const addModelToRelease = (releaseId: string, country: string, segment: Segment) => {
    const updated = releases.map((release) => {
      if (release.id !== releaseId) return release;

      const exists = release.models.some((m) => m.country === country && m.segment === segment);
      if (exists) return release;

      return {
        ...release,
        models: [...release.models, createNewModel(country, segment)],
        updatedAt: new Date().toISOString(),
      };
    });

    saveReleases(updated);
  };

  const removeModelFromRelease = (releaseId: string, modelId: string) => {
    const updated = releases.map((release) => {
      if (release.id !== releaseId) return release;

      return {
        ...release,
        models: release.models.filter((m) => m.id !== modelId),
        updatedAt: new Date().toISOString(),
      };
    });

    saveReleases(updated);
  };

  const deleteRelease = (releaseId: string) => {
    saveReleases(releases.filter((r) => r.id !== releaseId));
  };

  const completeRelease = (releaseId: string) => {
    const updated = releases.map((release) => {
      if (release.id !== releaseId) return release;

      return {
        ...release,
        completed: true,
        updatedAt: new Date().toISOString(),
      };
    });

    saveReleases(updated);
  };

  const updateReleaseDate = (releaseId: string, newDate: string) => {
    const updated = releases.map((release) => {
      if (release.id !== releaseId) return release;

      return {
        ...release,
        targetDate: newDate,
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
    updateReleaseDate,
    updateModelStep,
    startNewRound,
    updateModelStatus,
  };
}
