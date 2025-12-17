import { useState, useEffect, useCallback } from "react";
import { Project, WorkflowRound, TestType, WorkflowStep, Segment } from "@/types/project";
import { supabase } from "@/integrations/supabase/client";

const generateId = () => Math.random().toString(36).substring(2, 9);

// Map DB test_type to TypeScript TestType
const mapTestType = (dbTestType: string): TestType => {
  const mapping: Record<string, TestType> = {
    'testsuite': 'test-suite',
    'test-suite': 'test-suite',
    'categorization': 'categorization',
    'tagging': 'tagging',
  };
  return mapping[dbTestType] || 'test-suite';
};

// Map database row to Project type
const mapDbToProject = (row: any): Project => ({
  id: row.id,
  country: row.country,
  segment: row.segment as Segment,
  status: row.status as Project["status"],
  currentRound: row.current_round,
  rounds: [{
    id: `round-${row.id}`,
    roundNumber: row.current_round,
    testType: mapTestType(row.test_type),
    currentStep: parseInt(row.status === "waiting" ? "5" : row.status === "completed" ? "5" : "3") as WorkflowStep,
    startedAt: row.created_at,
    completedAt: row.status === "completed" || row.status === "waiting" ? row.updated_at : undefined,
  }],
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  awaitingConfirmation: row.status === "waiting",
  confirmedAt: row.status === "completed" ? row.updated_at : undefined,
});

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProjects = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const mappedProjects = (data || []).map(mapDbToProject);
      setProjects(mappedProjects);
    } catch (err) {
      console.error("Error fetching projects:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();

    // Subscribe to realtime changes
    const channel = supabase
      .channel("projects-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "projects" },
        () => fetchProjects()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchProjects]);

  const addProject = async (country: string, segment: Segment, testType: TestType) => {
    try {
      const { data, error } = await supabase
        .from("projects")
        .insert({
          country,
          segment,
          test_type: testType,
          status: "in-progress",
          current_round: 1,
        })
        .select()
        .single();

      if (error) throw error;
      return mapDbToProject(data);
    } catch (err) {
      console.error("Error adding project:", err);
      throw err;
    }
  };

  const updateProjectStep = async (projectId: string, step: WorkflowStep) => {
    try {
      const newStatus = step === 5 ? "waiting" : "in-progress";
      const { error } = await supabase
        .from("projects")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", projectId);

      if (error) throw error;
    } catch (err) {
      console.error("Error updating project step:", err);
      throw err;
    }
  };

  const startNewRound = async (projectId: string, testType: TestType) => {
    try {
      const project = projects.find((p) => p.id === projectId);
      if (!project) return;

      const { error } = await supabase
        .from("projects")
        .update({
          current_round: project.currentRound + 1,
          test_type: testType,
          status: "in-progress",
          updated_at: new Date().toISOString(),
        })
        .eq("id", projectId);

      if (error) throw error;
    } catch (err) {
      console.error("Error starting new round:", err);
      throw err;
    }
  };

  const confirmProject = async (projectId: string) => {
    try {
      const { error } = await supabase
        .from("projects")
        .update({ status: "completed", updated_at: new Date().toISOString() })
        .eq("id", projectId);

      if (error) throw error;
    } catch (err) {
      console.error("Error confirming project:", err);
      throw err;
    }
  };

  const updateProjectStatus = async (projectId: string, status: Project["status"]) => {
    try {
      const { error } = await supabase
        .from("projects")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", projectId);

      if (error) throw error;
    } catch (err) {
      console.error("Error updating project status:", err);
      throw err;
    }
  };

  const deleteProject = async (projectId: string) => {
    try {
      const { error } = await supabase.from("projects").delete().eq("id", projectId);
      if (error) throw error;
    } catch (err) {
      console.error("Error deleting project:", err);
      throw err;
    }
  };

  const addRoundNotes = async (projectId: string, roundNumber: number, notes: string) => {
    // Notes not currently supported in DB schema - could be added as a field
    console.log("Notes feature not yet implemented in DB:", { projectId, roundNumber, notes });
  };

  return {
    projects,
    loading,
    addProject,
    updateProjectStep,
    startNewRound,
    confirmProject,
    updateProjectStatus,
    deleteProject,
    addRoundNotes,
  };
}
