import { useState, useEffect } from 'react';
import { Project, WorkflowRound, TestType, WorkflowStep } from '@/types/project';

const STORAGE_KEY = 'ml-workflow-projects';

const generateId = () => Math.random().toString(36).substring(2, 9);

const INITIAL_PROJECTS: Project[] = [
  {
    id: 'austria-1',
    country: 'Austria',
    status: 'in-progress',
    currentRound: 1,
    rounds: [{
      id: 'r-austria-1',
      roundNumber: 1,
      testType: 'test-suite',
      currentStep: 4,
      startedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    }],
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'rep-ceca-1',
    country: 'Rep. Ceca',
    status: 'waiting',
    currentRound: 1,
    rounds: [{
      id: 'r-rep-ceca-1',
      roundNumber: 1,
      testType: 'test-suite',
      currentStep: 6,
      startedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      completedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    }],
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    awaitingConfirmation: true,
  },
  {
    id: 'belgio-1',
    country: 'Belgio',
    status: 'in-progress',
    currentRound: 1,
    rounds: [{
      id: 'r-belgio-1',
      roundNumber: 1,
      testType: 'categorization',
      currentStep: 1,
      startedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    }],
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setProjects(JSON.parse(stored));
    } else {
      // Load initial demo projects
      setProjects(INITIAL_PROJECTS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_PROJECTS));
    }
  }, []);

  const saveProjects = (newProjects: Project[]) => {
    setProjects(newProjects);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newProjects));
  };

  const addProject = (country: string, testType: TestType) => {
    const now = new Date().toISOString();
    const newRound: WorkflowRound = {
      id: generateId(),
      roundNumber: 1,
      testType,
      currentStep: 1,
      startedAt: now,
    };

    const newProject: Project = {
      id: generateId(),
      country,
      status: 'in-progress',
      currentRound: 1,
      rounds: [newRound],
      createdAt: now,
      updatedAt: now,
    };

    saveProjects([...projects, newProject]);
    return newProject;
  };

  const updateProjectStep = (projectId: string, step: WorkflowStep) => {
    const updated = projects.map(project => {
      if (project.id !== projectId) return project;

      const currentRoundIndex = project.rounds.findIndex(
        r => r.roundNumber === project.currentRound
      );

      if (currentRoundIndex === -1) return project;

      const updatedRounds = [...project.rounds];
      updatedRounds[currentRoundIndex] = {
        ...updatedRounds[currentRoundIndex],
        currentStep: step,
        ...(step === 6 ? { completedAt: new Date().toISOString() } : {}),
      };

      return {
        ...project,
        rounds: updatedRounds,
        updatedAt: new Date().toISOString(),
      };
    });

    saveProjects(updated);
  };

  const startNewRound = (projectId: string, testType: TestType) => {
    const updated = projects.map(project => {
      if (project.id !== projectId) return project;

      const newRoundNumber = project.currentRound + 1;
      const newRound: WorkflowRound = {
        id: generateId(),
        roundNumber: newRoundNumber,
        testType,
        currentStep: 1,
        startedAt: new Date().toISOString(),
      };

      return {
        ...project,
        currentRound: newRoundNumber,
        rounds: [...project.rounds, newRound],
        status: 'in-progress' as const,
        updatedAt: new Date().toISOString(),
      };
    });

    saveProjects(updated);
  };

  const confirmProject = (projectId: string) => {
    const updated = projects.map(project => {
      if (project.id !== projectId) return project;

      return {
        ...project,
        status: 'completed' as const,
        confirmedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    });

    saveProjects(updated);
  };

  const updateProjectStatus = (projectId: string, status: Project['status']) => {
    const updated = projects.map(project => {
      if (project.id !== projectId) return project;

      return {
        ...project,
        status,
        updatedAt: new Date().toISOString(),
      };
    });

    saveProjects(updated);
  };

  const deleteProject = (projectId: string) => {
    saveProjects(projects.filter(p => p.id !== projectId));
  };

  const addRoundNotes = (projectId: string, roundNumber: number, notes: string) => {
    const updated = projects.map(project => {
      if (project.id !== projectId) return project;

      const updatedRounds = project.rounds.map(round => {
        if (round.roundNumber !== roundNumber) return round;
        return { ...round, notes };
      });

      return {
        ...project,
        rounds: updatedRounds,
        updatedAt: new Date().toISOString(),
      };
    });

    saveProjects(updated);
  };

  return {
    projects,
    addProject,
    updateProjectStep,
    startNewRound,
    confirmProject,
    updateProjectStatus,
    deleteProject,
    addRoundNotes,
  };
}
