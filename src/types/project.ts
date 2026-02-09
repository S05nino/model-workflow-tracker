export type WorkflowStep = 1 | 2 | 3;

export type Segment = "consumer" | "business" | "tagger";

export type TestType = "categorization" | "test-suite" | "tagging";

export type ProjectStatus = "waiting" | "in-progress" | "completed" | "on-hold";

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
  segment: Segment;
  status: ProjectStatus;
  currentRound: number;
  rounds: WorkflowRound[];
  createdAt: string;
  updatedAt: string;
  confirmedAt?: string;
  awaitingConfirmation?: boolean;
}

export const WORKFLOW_STEPS: Record<WorkflowStep, { label: string; description: string }> = {
  1: { label: "Generazione Modelli", description: "Generazione dei modelli ML" },
  2: { label: "Test Suite", description: "Esecuzione test suite / categorizzazione / tagging" },
  3: { label: "Conferma Modello", description: "Conferma e approvazione del modello" },
};

export interface CountryConfig {
  code: string;
  name: string;
  segments: Segment[];
}

export const COUNTRIES: CountryConfig[] = [
  { code: "AUT", name: "Austria", segments: ["consumer"] },
  { code: "BEL", name: "Belgio", segments: ["consumer", "business"] },
  { code: "CZK", name: "Rep. Ceca", segments: ["consumer", "business"] },
  { code: "DEU", name: "Germania", segments: ["consumer", "business", "tagger"] },
  { code: "ESP", name: "Spagna", segments: ["consumer", "business", "tagger"] },
  { code: "FRA", name: "Francia", segments: ["consumer", "business", "tagger"] },
  { code: "GBR", name: "Regno Unito", segments: ["consumer", "business", "tagger"] },
  { code: "IND", name: "India", segments: ["consumer", "business", "tagger"] },
  { code: "IRL", name: "Irlanda", segments: ["consumer", "business"] },
  { code: "ITA", name: "Italia", segments: ["consumer", "business", "tagger"] },
  { code: "ITA2", name: "Italia 2", segments: ["consumer", "business"] },
  { code: "MEX", name: "Messico", segments: ["tagger"] },
  { code: "POL", name: "Polonia", segments: ["consumer"] },
  { code: "POR", name: "Portogallo", segments: ["consumer"] },
  { code: "USA", name: "USA", segments: ["consumer"] },
];

export const SEGMENT_LABELS: Record<Segment, string> = {
  consumer: "Consumer",
  business: "Business",
  tagger: "Tagger",
};

export const TEST_TYPE_LABELS: Record<TestType, string> = {
  categorization: "Categorizzazione",
  "test-suite": "Test Suite",
  tagging: "Tagging",
};

export const getTestTypesForSegment = (segment: Segment): TestType[] => {
  if (segment === "tagger") {
    return ["tagging", "test-suite"];
  }
  return ["categorization", "test-suite"];
};
