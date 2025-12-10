import { useState, useEffect } from "react";
import { Release, ReleaseModel, ReleaseModelIds } from "@/types/release";
import { Segment } from "@/types/project";
import { supabase } from "@/integrations/supabase/client";

interface ReleaseRow {
  id: string;
  version: string;
  target_date: string;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
}

interface ReleaseModelRow {
  id: string;
  release_id: string;
  country: string;
  segment: string;
  is_included: boolean;
  is_confirmed: boolean;
  model_out_id: string | null;
  model_in_id: string | null;
  rules_out_id: string | null;
  rules_in_id: string | null;
  created_at: string;
  updated_at: string;
}

const modelRowToReleaseModel = (row: ReleaseModelRow): ReleaseModel => ({
  id: row.id,
  country: row.country,
  segment: row.segment as Segment,
  included: row.is_included,
  confirmed: row.is_confirmed,
  modelIds: row.model_out_id || row.model_in_id || row.rules_out_id || row.rules_in_id
    ? {
        modelOut: row.model_out_id || undefined,
        modelIn: row.model_in_id || undefined,
        rulesOut: row.rules_out_id || undefined,
        rulesIn: row.rules_in_id || undefined,
      }
    : undefined,
  confirmedAt: row.is_confirmed ? row.updated_at : undefined,
});

export function useReleases() {
  const [releases, setReleases] = useState<Release[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchReleases = async () => {
    // Fetch releases
    const { data: releasesData, error: releasesError } = await supabase
      .from("releases")
      .select("*")
      .order("target_date", { ascending: true });

    if (releasesError) {
      console.error("Error fetching releases:", releasesError);
      return;
    }

    // Fetch all models
    const { data: modelsData, error: modelsError } = await supabase
      .from("release_models")
      .select("*");

    if (modelsError) {
      console.error("Error fetching release models:", modelsError);
      return;
    }

    // Combine data
    const combinedReleases: Release[] = (releasesData || []).map((release: ReleaseRow) => ({
      id: release.id,
      version: release.version,
      targetDate: release.target_date,
      models: (modelsData || [])
        .filter((m: ReleaseModelRow) => m.release_id === release.id)
        .map(modelRowToReleaseModel),
      createdAt: release.created_at,
      updatedAt: release.updated_at,
      completed: release.is_completed,
    }));

    setReleases(combinedReleases);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchReleases();

    // Subscribe to realtime updates
    const releasesChannel = supabase
      .channel("releases-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "releases" },
        () => fetchReleases()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "release_models" },
        () => fetchReleases()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(releasesChannel);
    };
  }, []);

  const addRelease = async (version: string, targetDate: string, models: { country: string; segment: Segment }[]) => {
    // Insert release
    const { data: releaseData, error: releaseError } = await supabase
      .from("releases")
      .insert({
        version,
        target_date: targetDate,
        is_completed: false,
      })
      .select()
      .single();

    if (releaseError) {
      console.error("Error adding release:", releaseError);
      return null;
    }

    // Insert models
    if (models.length > 0) {
      const { error: modelsError } = await supabase.from("release_models").insert(
        models.map((m) => ({
          release_id: releaseData.id,
          country: m.country,
          segment: m.segment,
          is_included: true,
          is_confirmed: false,
        }))
      );

      if (modelsError) {
        console.error("Error adding release models:", modelsError);
      }
    }

    return {
      id: releaseData.id,
      version: releaseData.version,
      targetDate: releaseData.target_date,
      models: [],
      createdAt: releaseData.created_at,
      updatedAt: releaseData.updated_at,
      completed: releaseData.is_completed,
    };
  };

  const toggleModelInclusion = async (releaseId: string, modelId: string) => {
    const release = releases.find((r) => r.id === releaseId);
    const model = release?.models.find((m) => m.id === modelId);
    if (!model) return;

    const { error } = await supabase
      .from("release_models")
      .update({
        is_included: !model.included,
        updated_at: new Date().toISOString(),
      })
      .eq("id", modelId);

    if (error) {
      console.error("Error toggling model inclusion:", error);
    }
  };

  const confirmModelInRelease = async (releaseId: string, modelId: string, modelIds: ReleaseModelIds) => {
    const { error } = await supabase
      .from("release_models")
      .update({
        is_confirmed: true,
        model_out_id: modelIds.modelOut || null,
        model_in_id: modelIds.modelIn || null,
        rules_out_id: modelIds.rulesOut || null,
        rules_in_id: modelIds.rulesIn || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", modelId);

    if (error) {
      console.error("Error confirming model:", error);
    }
  };

  const addModelToRelease = async (releaseId: string, country: string, segment: Segment) => {
    const { error } = await supabase.from("release_models").insert({
      release_id: releaseId,
      country,
      segment,
      is_included: true,
      is_confirmed: false,
    });

    if (error) {
      console.error("Error adding model to release:", error);
    }
  };

  const removeModelFromRelease = async (releaseId: string, modelId: string) => {
    const { error } = await supabase.from("release_models").delete().eq("id", modelId);

    if (error) {
      console.error("Error removing model from release:", error);
    }
  };

  const deleteRelease = async (releaseId: string) => {
    const { error } = await supabase.from("releases").delete().eq("id", releaseId);

    if (error) {
      console.error("Error deleting release:", error);
    }
  };

  const completeRelease = async (releaseId: string) => {
    const { error } = await supabase
      .from("releases")
      .update({
        is_completed: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", releaseId);

    if (error) {
      console.error("Error completing release:", error);
    }
  };

  return {
    releases,
    isLoading,
    addRelease,
    toggleModelInclusion,
    confirmModelInRelease,
    addModelToRelease,
    removeModelFromRelease,
    deleteRelease,
    completeRelease,
  };
}
