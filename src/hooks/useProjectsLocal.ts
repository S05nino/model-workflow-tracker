import { useState, useEffect, useCallback } from "react";
import { Project, WorkflowRound, TestType, WorkflowStep, Segment } from "@/types/project";

const API_URL = import.meta.env.VITE_API_URL || '';

// Check if running in Docker/local mode
const isLocalMode = !!API_URL;

const generateId = () => crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9);

interface DBProject {
  id: string;
  country: string;
  segment: string;
  test_type: string;
  current_round: number;
  status: string;
  created_at: string;
  updated_at: string;
  awaiting_confirmation?: boolean;
  confirmed_at?: string;
  rounds?: WorkflowRound[];
}

// Convert DB format to app format
const dbToProject = (db: DBProject): Project => ({
  id: db.id,
  country: db.country,
  segment: db.segment as Segment,
  status: db.status as Project['status'],
  currentRound: db.current_round,
  rounds: db.rounds || [{
    id: generateId(),
    roundNumber: db.current_round,
    testType: db.test_type as TestType,
    currentStep: 1,
    startedAt: db.created_at,
  }],
  createdAt: db.created_at,
  updatedAt: db.updated_at,
  awaitingConfirmation: db.awaiting_confirmation,
  confirmedAt: db.confirmed_at,
});

// Convert app format to DB format
const projectToDb = (project: Partial<Project>): Partial<DBProject> => ({
  id: project.id,
  country: project.country,
  segment: project.segment,
  test_type: project.rounds?.[0]?.testType || 'test-suite',
  current_round: project.currentRound,
  status: project.status,
  created_at: project.createdAt,
  updated_at: project.updatedAt,
  awaiting_confirmation: project.awaitingConfirmation,
  confirmed_at: project.confirmedAt,
  rounds: project.rounds,
});

export function useProjectsLocal() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProjects = useCallback(async () => {
    if (!isLocalMode) return;
    
    try {
      const response = await fetch(`${API_URL}/projects`);
      if (!response.ok) throw new Error('Failed to fetch');
      const data: DBProject[] = await response.json();
      setProjects(data.map(dbToProject));
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
    // Poll for updates every 5 seconds (since no realtime in local mode)
    const interval = setInterval(fetchProjects, 5000);
    return () => clearInterval(interval);
  }, [fetchProjects]);

  const saveProject = async (project: Partial<DBProject>) => {
    try {
      const response = await fetch(`${API_URL}/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(project),
      });
      if (!response.ok) throw new Error('Failed to save');
      await fetchProjects();
    } catch (error) {
      console.error('Error saving project:', error);
    }
  };

  const addProject = async (country: string, segment: Segment, testType: TestType) => {
    const now = new Date().toISOString();
    const id = generateId();
    const newRound: WorkflowRound = {
      id: generateId(),
      roundNumber: 1,
      testType,
      currentStep: 1,
      startedAt: now,
    };

    const newProject: DBProject = {
      id,
      country,
      segment,
      test_type: testType,
      current_round: 1,
      status: 'in-progress',
      created_at: now,
      updated_at: now,
      rounds: [newRound],
    };

    try {
      const response = await fetch(`${API_URL}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProject),
      });
      if (!response.ok) throw new Error('Failed to create');
      await fetchProjects();
      return dbToProject(newProject);
    } catch (error) {
      console.error('Error creating project:', error);
      return null;
    }
  };

  const updateProjectStep = async (projectId: string, step: WorkflowStep) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const currentRoundIndex = project.rounds.findIndex(r => r.roundNumber === project.currentRound);
    if (currentRoundIndex === -1) return;

    const updatedRounds = [...project.rounds];
    updatedRounds[currentRoundIndex] = {
      ...updatedRounds[currentRoundIndex],
      currentStep: step,
      ...(step === 3 ? { completedAt: new Date().toISOString() } : {}),
    };

    await saveProject({
      id: projectId,
      rounds: updatedRounds,
      status: step === 3 ? 'waiting' : project.status,
      awaiting_confirmation: step === 3 ? true : project.awaitingConfirmation,
      updated_at: new Date().toISOString(),
    });
  };

  const startNewRound = async (projectId: string, testType: TestType) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const newRoundNumber = project.currentRound + 1;
    const newRound: WorkflowRound = {
      id: generateId(),
      roundNumber: newRoundNumber,
      testType,
      currentStep: 1,
      startedAt: new Date().toISOString(),
    };

    await saveProject({
      id: projectId,
      current_round: newRoundNumber,
      rounds: [...project.rounds, newRound],
      status: 'in-progress',
      awaiting_confirmation: false,
      updated_at: new Date().toISOString(),
    });
  };

  const confirmProject = async (projectId: string) => {
    await saveProject({
      id: projectId,
      status: 'completed',
      awaiting_confirmation: false,
      confirmed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  };

  const updateProjectStatus = async (projectId: string, status: Project["status"]) => {
    await saveProject({
      id: projectId,
      status,
      updated_at: new Date().toISOString(),
    });
  };

  const deleteProject = async (projectId: string) => {
    try {
      const response = await fetch(`${API_URL}/projects/${projectId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete');
      await fetchProjects();
    } catch (error) {
      console.error('Error deleting project:', error);
    }
  };

  const addRoundNotes = async (projectId: string, roundNumber: number, notes: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const updatedRounds = project.rounds.map(round => {
      if (round.roundNumber !== roundNumber) return round;
      return { ...round, notes };
    });

    await saveProject({
      id: projectId,
      rounds: updatedRounds,
      updated_at: new Date().toISOString(),
    });
  };

  const addProjectFromModel = async (country: string, segment: Segment, status: string, currentRound: number, rounds: WorkflowRound[]) => {
    const now = new Date().toISOString();
    const id = generateId();
    const projectRounds = rounds.length > 0 ? rounds : [{
      id: generateId(),
      roundNumber: 1,
      testType: 'test-suite' as TestType,
      currentStep: 1 as WorkflowStep,
      startedAt: now,
    }];

    const newProject: DBProject = {
      id,
      country,
      segment,
      test_type: projectRounds[0]?.testType || 'test-suite',
      current_round: currentRound || 1,
      status: status || 'in-progress',
      created_at: now,
      updated_at: now,
      rounds: projectRounds,
      awaiting_confirmation: status === 'waiting',
    };

    try {
      const response = await fetch(`${API_URL}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProject),
      });
      if (!response.ok) throw new Error('Failed to create');
      await fetchProjects();
    } catch (error) {
      console.error('Error creating project from model:', error);
    }
  };

  return {
    projects,
    loading,
    addProject,
    addProjectFromModel,
    updateProjectStep,
    startNewRound,
    confirmProject,
    updateProjectStatus,
    deleteProject,
    addRoundNotes,
    refetch: fetchProjects,
  };
}
