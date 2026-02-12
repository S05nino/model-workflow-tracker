import { useState, useEffect } from "react";
import { Release, ReleaseModel, ReleaseModelIds } from "@/types/release";
import { Segment, WorkflowStep, WorkflowRound, TestType } from "@/types/project";

const STORAGE_KEY = "ml-workflow-releases";

const generateId = () => Math.random().toString(36).substring(2, 9);

const INITIAL_RELEASES: Release[] = [
  {
    id: "release-1",
    version: "7.6.6",
    targetDate: "2025-12-19",
    models: [
      { id: "m1", country: "AUT", segment: "consumer", included: true, confirmed: false, status: "in-progress", currentRound: 1, rounds: [{ id: "r1", roundNumber: 1, testType: "test-suite", currentStep: 1, startedAt: new Date().toISOString() }] },
      { id: "m2", country: "CZK", segment: "consumer", included: true, confirmed: false, status: "in-progress", currentRound: 1, rounds: [{ id: "r2", roundNumber: 1, testType: "test-suite", currentStep: 2, startedAt: new Date().toISOString() }] },
      { id: "m3", country: "BEL", segment: "business", included: true, confirmed: false, status: "in-progress", currentRound: 1, rounds: [{ id: "r3", roundNumber: 1, testType: "categorization", currentStep: 1, startedAt: new Date().toISOString() }] },
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
      const parsed = JSON.parse(stored);
      // Migrate old data: if models don't have rounds, add them
      const migrated = parsed.map((r: Release) => ({
        ...r,
        models: r.models.map((m: ReleaseModel) => ({
          ...m,
          status: m.status || (m.confirmed ? 'completed' : 'in-progress'),
          currentRound: m.currentRound || 1,
          rounds: m.rounds || [{
            id: generateId(),
            roundNumber: 1,
            testType: 'test-suite' as TestType,
            currentStep: (m.confirmed ? 3 : 1) as WorkflowStep,
            startedAt: new Date().toISOString(),
          }],
        })),
      }));
      setReleases(migrated);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
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
      models: models.map((m) => ({
        id: generateId(),
        country: m.country,
        segment: m.segment,
        included: true,
        confirmed: false,
        status: 'in-progress' as const,
        currentRound: 1,
        rounds: [{
          id: generateId(),
          roundNumber: 1,
          testType: 'test-suite' as TestType,
          currentStep: 1 as WorkflowStep,
          startedAt: new Date().toISOString(),
        }],
      })),
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
          m.id === modelId ? { ...m, confirmed: true, modelIds, confirmedAt: new Date().toISOString(), status: 'completed' as const, awaitingConfirmation: false } : m,
        ),
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
        models: [
          ...release.models,
          {
            id: generateId(),
            country,
            segment,
            included: true,
            confirmed: false,
            status: 'in-progress' as const,
            currentRound: 1,
            rounds: [{
              id: generateId(),
              roundNumber: 1,
              testType: 'test-suite' as TestType,
              currentStep: 1 as WorkflowStep,
              startedAt: new Date().toISOString(),
            }],
          },
        ],
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
      return { ...release, completed: true, updatedAt: new Date().toISOString() };
    });
    saveReleases(updated);
  };

  const updateReleaseDate = (releaseId: string, newDate: string) => {
    const updated = releases.map((release) => {
      if (release.id !== releaseId) return release;
      return { ...release, targetDate: newDate, updatedAt: new Date().toISOString() };
    });
    saveReleases(updated);
  };

  // Workflow operations on release models
  const updateModelStep = (releaseId: string, modelId: string, step: WorkflowStep) => {
    const updated = releases.map((release) => {
      if (release.id !== releaseId) return release;
      return {
        ...release,
        models: release.models.map((m) => {
          if (m.id !== modelId) return m;
          const rounds = m.rounds || [];
          const currentRoundIdx = rounds.findIndex(r => r.roundNumber === (m.currentRound || 1));
          if (currentRoundIdx === -1) return m;
          const updatedRounds = [...rounds];
          updatedRounds[currentRoundIdx] = {
            ...updatedRounds[currentRoundIdx],
            currentStep: step,
            ...(step === 3 ? { completedAt: new Date().toISOString() } : {}),
          };
          return {
            ...m,
            rounds: updatedRounds,
            status: step === 3 ? 'waiting' as const : m.status,
            awaitingConfirmation: step === 3 ? true : m.awaitingConfirmation,
          };
        }),
        updatedAt: new Date().toISOString(),
      };
    });
    saveReleases(updated);
  };

  const startModelNewRound = (releaseId: string, modelId: string, testType: TestType) => {
    const updated = releases.map((release) => {
      if (release.id !== releaseId) return release;
      return {
        ...release,
        models: release.models.map((m) => {
          if (m.id !== modelId) return m;
          const newRoundNumber = (m.currentRound || 1) + 1;
          const newRound: WorkflowRound = {
            id: generateId(),
            roundNumber: newRoundNumber,
            testType,
            currentStep: 1,
            startedAt: new Date().toISOString(),
          };
          return {
            ...m,
            currentRound: newRoundNumber,
            rounds: [...(m.rounds || []), newRound],
            status: 'in-progress' as const,
            awaitingConfirmation: false,
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
        models: release.models.map((m) => m.id === modelId ? { ...m, status } : m),
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
    startModelNewRound,
    updateModelStatus,
  };
}
