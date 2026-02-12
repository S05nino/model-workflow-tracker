import { Segment, WorkflowRound, ProjectStatus } from './project';

export interface ReleaseModelIds {
  modelOut?: string;
  modelIn?: string;
  rulesOut?: string;
  rulesIn?: string;
}

export interface ReleaseModel {
  id: string;
  country: string;
  segment: Segment;
  included: boolean;
  confirmed: boolean;
  modelIds?: ReleaseModelIds;
  confirmedAt?: string;
  // Workflow fields
  status?: ProjectStatus;
  currentRound?: number;
  rounds?: WorkflowRound[];
  awaitingConfirmation?: boolean;
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
