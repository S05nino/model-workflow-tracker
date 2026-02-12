import { useState, useEffect, useCallback } from "react";
import { Release, ReleaseModel, ReleaseModelIds } from "@/types/release";
import { Segment, WorkflowStep, WorkflowRound, TestType, ProjectStatus } from "@/types/project";

const API_URL = import.meta.env.VITE_API_URL || '';

const isLocalMode = !!API_URL;

const generateId = () => crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9);

export function useReleasesLocal() {
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReleases = useCallback(async () => {
    if (!isLocalMode) return;
    
    try {
      const response = await fetch(`${API_URL}/releases`);
      if (!response.ok) throw new Error('Failed to fetch');
      const data: Release[] = await response.json();
      setReleases(data);
    } catch (error) {
      console.error('Error fetching releases:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReleases();
    const interval = setInterval(fetchReleases, 5000);
    return () => clearInterval(interval);
  }, [fetchReleases]);

  const saveRelease = async (release: Partial<Release>) => {
    try {
      const response = await fetch(`${API_URL}/releases/${release.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(release),
      });
      if (!response.ok) throw new Error('Failed to save');
      await fetchReleases();
    } catch (error) {
      console.error('Error saving release:', error);
    }
  };

  const addRelease = async (version: string, targetDate: string, models: { country: string; segment: Segment }[]) => {
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
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completed: false,
    };

    try {
      const response = await fetch(`${API_URL}/releases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRelease),
      });
      if (!response.ok) throw new Error('Failed to create');
      await fetchReleases();
      return newRelease;
    } catch (error) {
      console.error('Error creating release:', error);
      return null;
    }
  };

  const toggleModelInclusion = async (releaseId: string, modelId: string) => {
    const release = releases.find(r => r.id === releaseId);
    if (!release) return;

    await saveRelease({
      id: releaseId,
      models: release.models.map(m => m.id === modelId ? { ...m, included: !m.included } : m),
      updatedAt: new Date().toISOString(),
    });
  };

  const confirmModelInRelease = async (releaseId: string, modelId: string, modelIds: ReleaseModelIds) => {
    const release = releases.find(r => r.id === releaseId);
    if (!release) return;

    await saveRelease({
      id: releaseId,
      models: release.models.map(m =>
        m.id === modelId ? { ...m, confirmed: true, modelIds, confirmedAt: new Date().toISOString() } : m
      ),
      updatedAt: new Date().toISOString(),
    });
  };

  const addModelToRelease = async (releaseId: string, country: string, segment: Segment) => {
    const release = releases.find(r => r.id === releaseId);
    if (!release) return;

    const exists = release.models.some(m => m.country === country && m.segment === segment);
    if (exists) return;

    await saveRelease({
      id: releaseId,
      models: [
        ...release.models,
        {
          id: generateId(),
          country,
          segment,
          included: true,
          confirmed: false,
        },
      ],
      updatedAt: new Date().toISOString(),
    });
  };

  const removeModelFromRelease = async (releaseId: string, modelId: string) => {
    const release = releases.find(r => r.id === releaseId);
    if (!release) return;

    await saveRelease({
      id: releaseId,
      models: release.models.filter(m => m.id !== modelId),
      updatedAt: new Date().toISOString(),
    });
  };

  const deleteRelease = async (releaseId: string) => {
    try {
      const response = await fetch(`${API_URL}/releases/${releaseId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete');
      await fetchReleases();
    } catch (error) {
      console.error('Error deleting release:', error);
    }
  };

  const completeRelease = async (releaseId: string) => {
    await saveRelease({
      id: releaseId,
      completed: true,
      updatedAt: new Date().toISOString(),
    });
  };

  const updateReleaseDate = async (releaseId: string, newDate: string) => {
    await saveRelease({
      id: releaseId,
      targetDate: newDate,
      updatedAt: new Date().toISOString(),
    });
  };

  const updateModelStep = async (releaseId: string, modelId: string, step: WorkflowStep) => {
    const release = releases.find(r => r.id === releaseId);
    if (!release) return;
    const model = release.models.find(m => m.id === modelId);
    if (!model) return;
    const rounds = model.rounds || [];
    const currentRoundIdx = rounds.findIndex(r => r.roundNumber === (model.currentRound || 1));
    if (currentRoundIdx === -1) return;
    const updatedRounds = [...rounds];
    updatedRounds[currentRoundIdx] = {
      ...updatedRounds[currentRoundIdx],
      currentStep: step,
      ...(step === 3 ? { completedAt: new Date().toISOString() } : {}),
    };
    await saveRelease({
      id: releaseId,
      models: release.models.map(m => m.id === modelId ? {
        ...m,
        rounds: updatedRounds,
        status: step === 3 ? 'waiting' as ProjectStatus : m.status,
        awaitingConfirmation: step === 3 ? true : m.awaitingConfirmation,
      } : m),
      updatedAt: new Date().toISOString(),
    });
  };

  const startModelNewRound = async (releaseId: string, modelId: string, testType: TestType) => {
    const release = releases.find(r => r.id === releaseId);
    if (!release) return;
    const model = release.models.find(m => m.id === modelId);
    if (!model) return;
    const newRoundNumber = (model.currentRound || 1) + 1;
    const newRound: WorkflowRound = {
      id: generateId(),
      roundNumber: newRoundNumber,
      testType,
      currentStep: 1,
      startedAt: new Date().toISOString(),
    };
    await saveRelease({
      id: releaseId,
      models: release.models.map(m => m.id === modelId ? {
        ...m,
        currentRound: newRoundNumber,
        rounds: [...(m.rounds || []), newRound],
        status: 'in-progress' as ProjectStatus,
        awaitingConfirmation: false,
      } : m),
      updatedAt: new Date().toISOString(),
    });
  };

  const updateModelStatus = async (releaseId: string, modelId: string, status: ProjectStatus) => {
    const release = releases.find(r => r.id === releaseId);
    if (!release) return;
    await saveRelease({
      id: releaseId,
      models: release.models.map(m => m.id === modelId ? { ...m, status } : m),
      updatedAt: new Date().toISOString(),
    });
  };

  return {
    releases,
    loading,
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
    refetch: fetchReleases,
  };
}
