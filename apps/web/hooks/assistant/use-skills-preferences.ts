"use client";

import { useCallback, useState } from "react";
import { useUserPreferences } from "@/hooks/assistant/use-user-preferences";
import {
  globalSkillRefSchema,
  type GlobalSkillRef,
} from "@/lib/skills/global-skill-refs";

function getGlobalSkillRefError(params: {
  source: string;
  skillName: string;
  existingRefs: GlobalSkillRef[];
}): string | null {
  const parsedRef = globalSkillRefSchema.safeParse({
    source: params.source,
    skillName: params.skillName,
  });

  if (!parsedRef.success) {
    return parsedRef.error.issues[0]?.message ?? "Invalid global skill ref";
  }

  const duplicateExists = params.existingRefs.some(
    (ref) =>
      ref.source.toLowerCase() === parsedRef.data.source.toLowerCase() &&
      ref.skillName.toLowerCase() === parsedRef.data.skillName.toLowerCase(),
  );

  return duplicateExists ? "That global skill has already been added" : null;
}

export function useSkillsPreferences() {
  const { preferences, loading, updatePreferences } = useUserPreferences();
  const [isSaving, setIsSaving] = useState(false);
  const [globalSkillSource, setGlobalSkillSource] = useState("");
  const [globalSkillName, setGlobalSkillName] = useState("");
  const [globalSkillsError, setGlobalSkillsError] = useState<string | null>(
    null,
  );

  const handleAddGlobalSkillRef = useCallback(async () => {
    const existingRefs = preferences?.globalSkillRefs ?? [];
    const errorMessage = getGlobalSkillRefError({
      source: globalSkillSource,
      skillName: globalSkillName,
      existingRefs,
    });

    if (errorMessage) {
      setGlobalSkillsError(errorMessage);
      return;
    }

    setIsSaving(true);
    setGlobalSkillsError(null);
    try {
      const nextRef = globalSkillRefSchema.parse({
        source: globalSkillSource,
        skillName: globalSkillName,
      });
      await updatePreferences({
        globalSkillRefs: [...existingRefs, nextRef],
      });
      setGlobalSkillSource("");
      setGlobalSkillName("");
    } catch (error) {
      console.error("Failed to add global skill preference:", error);
      setGlobalSkillsError("Failed to add global skill");
    } finally {
      setIsSaving(false);
    }
  }, [globalSkillSource, globalSkillName, preferences?.globalSkillRefs, updatePreferences]);

  const handleRemoveGlobalSkillRef = useCallback(
    async (index: number) => {
      const existingRefs = preferences?.globalSkillRefs ?? [];
      setIsSaving(true);
      setGlobalSkillsError(null);
      try {
        await updatePreferences({
          globalSkillRefs: existingRefs.filter(
            (_, refIndex) => refIndex !== index,
          ),
        });
      } catch (error) {
        console.error("Failed to remove global skill preference:", error);
        setGlobalSkillsError("Failed to remove global skill");
      } finally {
        setIsSaving(false);
      }
    },
    [preferences?.globalSkillRefs, updatePreferences],
  );

  return {
    loading,
    isSaving,
    preferences,
    globalSkillSource,
    setGlobalSkillSource,
    globalSkillName,
    setGlobalSkillName,
    globalSkillsError,
    handleAddGlobalSkillRef,
    handleRemoveGlobalSkillRef,
  };
}
