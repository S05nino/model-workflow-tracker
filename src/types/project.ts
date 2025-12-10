export type WorkflowStep = 1 | 2 | 3 | 4 | 5 | 6;

export type TestType = 'categorization' | 'test-suite';

export type ProjectStatus = 'waiting' | 'in-progress' | 'completed' | 'on-hold';

export interface WorkflowRound {
  id: string;
  roundNumber: number;
  testType: TestType;
  currentStep: WorkflowStep;
  startedAt: string;
  completedAt?: string;
  notes?: string;
}

export interface Project {
  id: string;
  country: string;
  clientName: string;
  status: ProjectStatus;
  currentRound: number;
  rounds: WorkflowRound[];
  createdAt: string;
  updatedAt: string;
  confirmedAt?: string;
}

export const WORKFLOW_STEPS: Record<WorkflowStep, { label: string; description: string }> = {
  1: { label: 'Analisi Team', description: 'Il team esegue le analisi sul cliente' },
  2: { label: 'Email Ricevuta', description: 'Email ricevuta con le informazioni per il modello' },
  3: { label: 'Tipo Test', description: 'Categorizzazione o Test Suite completa' },
  4: { label: 'Generazione Modello', description: 'Generazione modello e esecuzione test' },
  5: { label: 'Upload ZIP', description: 'Creazione e upload ZIP sul server condiviso' },
  6: { label: 'Email Inviata', description: 'Email di notifica inviata al team' },
};

export const COUNTRIES = [
  'Italia',
  'Francia',
  'Germania',
  'Spagna',
  'Regno Unito',
  'Portogallo',
  'Olanda',
  'Belgio',
  'Svizzera',
  'Austria',
];
