import { Segment, TestType, WorkflowStep } from './project';

export interface ReleaseModelIds {
  modelOut?: string;
  modelIn?: string;
  rulesOut?: string;
  rulesIn?: string;
}

export interface WorkflowRound {
  id: string;
  roundNumber: number;
  testType: TestType;
  currentStep: WorkflowStep;
  startedAt: string;
  completedAt?: string;
}

export interface ReleaseModel {
  id: string;
  country: string;
  segment: Segment;
  included: boolean;
  confirmed: boolean;
  modelIds?: ReleaseModelIds;
  confirmedAt?: string;
  // Workflow tracking
  currentRound: number;
  rounds: WorkflowRound[];
  status: 'waiting' | 'in-progress' | 'completed' | 'on-hold';
}

export interface Release {
  id: string;
  version: string;
  targetDate: string;
  models: ReleaseModel[];
  createdAt: string;
  updatedAt: string;
  completed: boolean;
}
