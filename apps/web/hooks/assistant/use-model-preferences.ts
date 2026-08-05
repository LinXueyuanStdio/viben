"use client";

import { useCallback, useMemo, useState } from "react";
import { useModelOptions } from "@/hooks/assistant/use-model-options";
import { useUserPreferences } from "@/hooks/assistant/use-user-preferences";
import {
  getDefaultModelOptionId,
  withMissingModelOption,
} from "@/lib/model-options";

export function useModelPreferences() {
  const { preferences, loading, updatePreferences } = useUserPreferences();
  const { modelOptions, loading: modelOptionsLoading } = useModelOptions();
  const [isSaving, setIsSaving] = useState(false);

  const selectedDefaultModelId =
    preferences?.defaultModelId ?? getDefaultModelOptionId(modelOptions);
  const selectedSubagentModelId = preferences?.defaultSubagentModelId ?? "auto";

  const defaultModelOptions = useMemo(
    () => withMissingModelOption(modelOptions, selectedDefaultModelId),
    [modelOptions, selectedDefaultModelId],
  );
  const subagentModelOptions = useMemo(
    () =>
      withMissingModelOption(modelOptions, preferences?.defaultSubagentModelId),
    [modelOptions, preferences?.defaultSubagentModelId],
  );

  const enabledModelIds = useMemo(
    () => new Set(preferences?.enabledModelIds),
    [preferences?.enabledModelIds],
  );

  const handleModelChange = useCallback(
    async (modelId: string) => {
      setIsSaving(true);
      try {
        await updatePreferences({ defaultModelId: modelId });
      } catch (error) {
        console.error("Failed to update model preference:", error);
      } finally {
        setIsSaving(false);
      }
    },
    [updatePreferences],
  );

  const handleSubagentModelChange = useCallback(
    async (value: string) => {
      setIsSaving(true);
      try {
        await updatePreferences({
          defaultSubagentModelId: value === "auto" ? null : value,
        });
      } catch (error) {
        console.error("Failed to update subagent model preference:", error);
      } finally {
        setIsSaving(false);
      }
    },
    [updatePreferences],
  );

  const handleAddModel = useCallback(
    async (modelId: string) => {
      const currentIds = preferences?.enabledModelIds ?? [];
      if (currentIds.includes(modelId)) return;
      setIsSaving(true);
      try {
        await updatePreferences({ enabledModelIds: [...currentIds, modelId] });
      } catch (error) {
        console.error("Failed to update enabled models:", error);
      } finally {
        setIsSaving(false);
      }
    },
    [preferences?.enabledModelIds, updatePreferences],
  );

  const handleRemoveModel = useCallback(
    async (modelId: string) => {
      const currentIds = preferences?.enabledModelIds ?? [];
      setIsSaving(true);
      try {
        await updatePreferences({
          enabledModelIds: currentIds.filter((id) => id !== modelId),
        });
      } catch (error) {
        console.error("Failed to update enabled models:", error);
      } finally {
        setIsSaving(false);
      }
    },
    [preferences?.enabledModelIds, updatePreferences],
  );

  const handleSetEnabledModels = useCallback(
    async (nextIds: string[]) => {
      setIsSaving(true);
      try {
        await updatePreferences({ enabledModelIds: nextIds });
      } catch (error) {
        console.error("Failed to update enabled models:", error);
      } finally {
        setIsSaving(false);
      }
    },
    [updatePreferences],
  );

  return {
    loading,
    isSaving,
    defaultModelOptions,
    selectedDefaultModelId,
    selectedSubagentModelId,
    subagentModelOptions,
    modelOptions,
    modelOptionsLoading,
    enabledModelIds,
    handleModelChange,
    handleSubagentModelChange,
    handleAddModel,
    handleRemoveModel,
    handleSetEnabledModels,
  };
}
