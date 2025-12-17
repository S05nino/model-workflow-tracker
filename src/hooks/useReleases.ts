import { useState, useEffect, useCallback } from "react";
import { Release, ReleaseModel, ReleaseModelIds } from "@/types/release";
import { Segment } from "@/types/project";
import { supabase } from "@/integrations/supabase/client";

export function useReleases() {
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReleases = useCallback(async () => {
    try {
      // Fetch releases with their models
      const { data: releasesData, error: releasesError } = await supabase
        .from("releases")
        .select("*")
        .order("target_date", { ascending: true });

      if (releasesError) throw releasesError;

      const { data: modelsData, error: modelsError } = await supabase
        .from("release_models")
        .select("*");

      if (modelsError) throw modelsError;

      // Map to Release type
      const mappedReleases: Release[] = (releasesData || []).map((release) => {
        const releaseModels = (modelsData || [])
          .filter((m) => m.release_id === release.id)
          .map((m): ReleaseModel => ({
            id: m.id,
            country: m.country,
            segment: m.segment as Segment,
            included: m.is_included,
            confirmed: m.is_confirmed,
            modelIds: m.is_confirmed
              ? {
                  modelOut: m.model_out_id || undefined,
                  modelIn: m.model_in_id || undefined,
                  rulesOut: m.rules_out_id || undefined,
                  rulesIn: m.rules_in_id || undefined,
                }
              : undefined,
            confirmedAt: m.is_confirmed ? m.updated_at : undefined,
          }));

        return {
          id: release.id,
          version: release.version,
          targetDate: release.target_date,
          models: releaseModels,
          createdAt: release.created_at,
          updatedAt: release.updated_at,
          completed: release.is_completed,
        };
      });

      setReleases(mappedReleases);
    } catch (err) {
      console.error("Error fetching releases:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReleases();

    // Subscribe to realtime changes
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
  }, [fetchReleases]);

  const addRelease = async (version: string, targetDate: string, models: { country: string; segment: Segment }[]) => {
    try {
      const { data: release, error: releaseError } = await supabase
        .from("releases")
        .insert({ version, target_date: targetDate })
        .select()
        .single();

      if (releaseError) throw releaseError;

      if (models.length > 0) {
        const { error: modelsError } = await supabase.from("release_models").insert(
          models.map((m) => ({
            release_id: release.id,
            country: m.country,
            segment: m.segment,
          }))
        );

        if (modelsError) throw modelsError;
      }

      return release;
    } catch (err) {
      console.error("Error adding release:", err);
      throw err;
    }
  };

  const toggleModelInclusion = async (releaseId: string, modelId: string) => {
    try {
      const release = releases.find((r) => r.id === releaseId);
      const model = release?.models.find((m) => m.id === modelId);
      if (!model) return;

      const { error } = await supabase
        .from("release_models")
        .update({ is_included: !model.included, updated_at: new Date().toISOString() })
        .eq("id", modelId);

      if (error) throw error;
    } catch (err) {
      console.error("Error toggling model inclusion:", err);
      throw err;
    }
  };

  const confirmModelInRelease = async (releaseId: string, modelId: string, modelIds: ReleaseModelIds) => {
    try {
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

      if (error) throw error;

      // Check if all models are confirmed to auto-complete the release
      await checkAndCompleteRelease(releaseId);
    } catch (err) {
      console.error("Error confirming model:", err);
      throw err;
    }
  };

  const checkAndCompleteRelease = async (releaseId: string) => {
    try {
      const { data: models, error } = await supabase
        .from("release_models")
        .select("*")
        .eq("release_id", releaseId);

      if (error) throw error;

      const allConfirmed = models?.every((m) => !m.is_included || m.is_confirmed);
      if (allConfirmed && models?.some((m) => m.is_included)) {
        await supabase
          .from("releases")
          .update({ is_completed: true, updated_at: new Date().toISOString() })
          .eq("id", releaseId);
      }
    } catch (err) {
      console.error("Error checking release completion:", err);
    }
  };

  const addModelToRelease = async (releaseId: string, country: string, segment: Segment) => {
    try {
      // Check if model already exists
      const release = releases.find((r) => r.id === releaseId);
      if (release?.models.some((m) => m.country === country && m.segment === segment)) {
        return;
      }

      const { error } = await supabase.from("release_models").insert({
        release_id: releaseId,
        country,
        segment,
      });

      if (error) throw error;
    } catch (err) {
      console.error("Error adding model to release:", err);
      throw err;
    }
  };

  const removeModelFromRelease = async (releaseId: string, modelId: string) => {
    try {
      const { error } = await supabase.from("release_models").delete().eq("id", modelId);
      if (error) throw error;
    } catch (err) {
      console.error("Error removing model from release:", err);
      throw err;
    }
  };

  const deleteRelease = async (releaseId: string) => {
    try {
      // Delete models first
      await supabase.from("release_models").delete().eq("release_id", releaseId);
      // Then delete release
      const { error } = await supabase.from("releases").delete().eq("id", releaseId);
      if (error) throw error;
    } catch (err) {
      console.error("Error deleting release:", err);
      throw err;
    }
  };

  const completeRelease = async (releaseId: string) => {
    try {
      const { error } = await supabase
        .from("releases")
        .update({ is_completed: true, updated_at: new Date().toISOString() })
        .eq("id", releaseId);

      if (error) throw error;
    } catch (err) {
      console.error("Error completing release:", err);
      throw err;
    }
  };

  const updateReleaseDate = async (releaseId: string, newDate: string) => {
    try {
      const { error } = await supabase
        .from("releases")
        .update({ target_date: newDate, updated_at: new Date().toISOString() })
        .eq("id", releaseId);

      if (error) throw error;
    } catch (err) {
      console.error("Error updating release date:", err);
      throw err;
    }
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
  };
}
