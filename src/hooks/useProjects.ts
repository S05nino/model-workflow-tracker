import { useState, useEffect } from "react";
import { Project, WorkflowRound, TestType, WorkflowStep, Segment } from "@/types/project";
import { supabase } from "@/integrations/supabase/client";

// Database row type (flat structure)
interface ProjectRow {
  id: string;
  country: string;
  segment: string;
  test_type: string;
  status: string;
  current_round: number;
  created_at: string;
  updated_at: string;
}

// Convert database row to Project type (simplified - single round per project)
const rowToProject = (row: ProjectRow): Project => ({
  id: row.id,
  country: row.country,
  segment: row.segment as Segment,
  status: row.status as Project["status"],
  currentRound: row.current_round,
  rounds: [
    {
      id: `round-${row.id}`,
      roundNumber: row.current_round,
      testType: row.test_type as TestType,
      currentStep: (row.status === "completed" ? 5 : row.status === "waiting" ? 5 : 1) as WorkflowStep,
      startedAt: row.created_at,
      completedAt: row.status === "completed" || row.status === "waiting" ? row.updated_at : undefined,
    },
  ],
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  awaitingConfirmation: row.status === "waiting",
});

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProjects = async () => {
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching projects:", error);
      return;
    }

    setProjects((data || []).map(rowToProject));
    setIsLoading(false);
  };

  useEffect(() => {
    fetchProjects();

    // Subscribe to realtime updates
    const channel = supabase
      .channel("projects-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "projects" },
        () => {
          fetchProjects();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const addProject = async (country: string, segment: Segment, testType: TestType) => {
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

    if (error) {
      console.error("Error adding project:", error);
      return null;
    }

    return rowToProject(data);
  };

  const updateProjectStep = async (projectId: string, step: WorkflowStep) => {
    const newStatus = step === 5 ? "waiting" : "in-progress";

    const { error } = await supabase
      .from("projects")
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId);

    if (error) {
      console.error("Error updating project step:", error);
    }
  };

  const startNewRound = async (projectId: string, testType: TestType) => {
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

    if (error) {
      console.error("Error starting new round:", error);
    }
  };

  const confirmProject = async (projectId: string) => {
    const { error } = await supabase
      .from("projects")
      .update({
        status: "completed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId);

    if (error) {
      console.error("Error confirming project:", error);
    }
  };

  const updateProjectStatus = async (projectId: string, status: Project["status"]) => {
    const { error } = await supabase
      .from("projects")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId);

    if (error) {
      console.error("Error updating project status:", error);
    }
  };

  const deleteProject = async (projectId: string) => {
    const { error } = await supabase.from("projects").delete().eq("id", projectId);

    if (error) {
      console.error("Error deleting project:", error);
    }
  };

  const addRoundNotes = async (projectId: string, roundNumber: number, notes: string) => {
    // Notes are simplified - stored in updated_at comment or separate table if needed
    console.log("Notes feature requires separate table implementation", { projectId, roundNumber, notes });
  };

  return {
    projects,
    isLoading,
    addProject,
    updateProjectStep,
    startNewRound,
    confirmProject,
    updateProjectStatus,
    deleteProject,
    addRoundNotes,
  };
}
