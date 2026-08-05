"use client";

import { useCallback, useState } from "react";
import { useSession } from "@/hooks/assistant/use-session";
import {
  type DiffMode,
  useUserPreferences,
} from "@/hooks/assistant/use-user-preferences";
import type { SandboxType } from "@/components/assistant/sandbox-selector-compact";

export function useGeneralPreferences() {
  const { session } = useSession();
  const { preferences, loading, updatePreferences } = useUserPreferences();
  const [isSaving, setIsSaving] = useState(false);
  const [copiedPublicProfile, setCopiedPublicProfile] = useState(false);

  const publicProfilePath = session?.user?.username
    ? `/u/${session.user.username}`
    : null;

  const handleSandboxChange = useCallback(
    async (sandboxType: SandboxType) => {
      setIsSaving(true);
      try {
        await updatePreferences({ defaultSandboxType: sandboxType });
      } catch (error) {
        console.error("Failed to update sandbox preference:", error);
      } finally {
        setIsSaving(false);
      }
    },
    [updatePreferences],
  );

  const handleDiffModeChange = useCallback(
    async (diffMode: DiffMode) => {
      setIsSaving(true);
      try {
        await updatePreferences({ defaultDiffMode: diffMode });
      } catch (error) {
        console.error("Failed to update diff mode preference:", error);
      } finally {
        setIsSaving(false);
      }
    },
    [updatePreferences],
  );

  const handleAutoCommitPushChange = useCallback(
    async (enabled: boolean) => {
      setIsSaving(true);
      try {
        await updatePreferences({ autoCommitPush: enabled });
      } catch (error) {
        console.error("Failed to update auto-commit preference:", error);
      } finally {
        setIsSaving(false);
      }
    },
    [updatePreferences],
  );

  const handleAutoCreatePrChange = useCallback(
    async (enabled: boolean) => {
      setIsSaving(true);
      try {
        await updatePreferences({ autoCreatePr: enabled });
      } catch (error) {
        console.error("Failed to update auto-PR preference:", error);
      } finally {
        setIsSaving(false);
      }
    },
    [updatePreferences],
  );

  const handleAlertsEnabledChange = useCallback(
    async (enabled: boolean) => {
      setIsSaving(true);
      try {
        await updatePreferences({ alertsEnabled: enabled });
      } catch (error) {
        console.error("Failed to update alerts preference:", error);
      } finally {
        setIsSaving(false);
      }
    },
    [updatePreferences],
  );

  const handleAlertSoundEnabledChange = useCallback(
    async (enabled: boolean) => {
      setIsSaving(true);
      try {
        await updatePreferences({ alertSoundEnabled: enabled });
      } catch (error) {
        console.error("Failed to update alert sound preference:", error);
      } finally {
        setIsSaving(false);
      }
    },
    [updatePreferences],
  );

  const handlePublicUsageEnabledChange = useCallback(
    async (enabled: boolean) => {
      setIsSaving(true);
      try {
        await updatePreferences({ publicUsageEnabled: enabled });
        if (!enabled) {
          setCopiedPublicProfile(false);
        }
      } catch (error) {
        console.error("Failed to update public usage preference:", error);
      } finally {
        setIsSaving(false);
      }
    },
    [updatePreferences],
  );

  const handleCopyPublicProfileUrl = useCallback(async () => {
    if (!publicProfilePath || typeof window === "undefined") {
      return;
    }
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}${publicProfilePath}`,
      );
      setCopiedPublicProfile(true);
      window.setTimeout(() => setCopiedPublicProfile(false), 1500);
    } catch (error) {
      console.error("Failed to copy public usage URL:", error);
    }
  }, [publicProfilePath]);

  return {
    loading,
    isSaving,
    preferences,
    copiedPublicProfile,
    publicProfilePath,
    handleSandboxChange,
    handleDiffModeChange,
    handleAutoCommitPushChange,
    handleAutoCreatePrChange,
    handleAlertsEnabledChange,
    handleAlertSoundEnabledChange,
    handlePublicUsageEnabledChange,
    handleCopyPublicProfileUrl,
  };
}
