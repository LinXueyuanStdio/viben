import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "@/hooks/use-toast";
import {
  downloadAndInstallClawhubSkill,
  downloadAndInstallSkill,
} from "@/lib/skill-installer";
import type {
  InstallErrorCode,
  InstallProgress,
  InstallSkillResult,
  ProgressCallback,
} from "@/lib/skill-installer";
import type { InstallableSkill } from "@/components/skills/types";

export interface InstallFailureInput {
  errorCode?: InstallErrorCode;
  code?: InstallErrorCode;
  error?: string;
  message?: string;
}

export interface SkillInstallProgress {
  stage: string;
  progress: number;
  message?: string;
}

export function getSkillInstallId(skill: InstallableSkill): string {
  return skill.data.id;
}

export function getInstallErrorTranslationKey(
  error: InstallFailureInput
): string {
  const errorCode = error.errorCode ?? error.code;

  switch (errorCode) {
    case "ALREADY_EXISTS":
    case "FILE_CONFLICT":
      return "skillsMarket.installErrorDuplicate";
    case "NETWORK_ERROR":
      return "skillsMarket.installErrorNetwork";
    case "VALIDATION_ERROR":
      return "skillsMarket.installErrorCorrupt";
    case "PERMISSION_ERROR":
      return "skillsMarket.installErrorPermission";
    default:
      break;
  }

  const message = (error.error ?? error.message ?? "").toLowerCase();

  if (message.includes("already exists") || message.includes("duplicate")) {
    return "skillsMarket.installErrorDuplicate";
  }
  if (
    message.includes("corrupt") ||
    message.includes("invalid") ||
    message.includes("zip")
  ) {
    return "skillsMarket.installErrorCorrupt";
  }
  if (
    message.includes("permission") ||
    message.includes("access") ||
    message.includes("eacces")
  ) {
    return "skillsMarket.installErrorPermission";
  }
  if (
    message.includes("network") ||
    message.includes("fetch") ||
    message.includes("download")
  ) {
    return "skillsMarket.installErrorNetwork";
  }

  return "skillsMarket.installErrorUnknown";
}

export function useSkillInstall() {
  const { t } = useTranslation();
  const installingIdsRef = useRef<Set<string>>(new Set());
  const progressCleanupTimersRef = useRef<Map<string, number>>(new Map());
  const [installingIds, setInstallingIds] = useState<Set<string>>(new Set());
  const [installedIds, setInstalledIds] = useState<Set<string>>(new Set());
  const [installProgress, setInstallProgress] = useState<
    Map<string, SkillInstallProgress>
  >(new Map());

  const install = useCallback(
    async (skill: InstallableSkill): Promise<InstallSkillResult | null> => {
      const id = getSkillInstallId(skill);

      if (installingIdsRef.current.has(id)) {
        return null;
      }

      installingIdsRef.current.add(id);
      const cleanupTimer = progressCleanupTimersRef.current.get(id);
      if (cleanupTimer !== undefined) {
        window.clearTimeout(cleanupTimer);
        progressCleanupTimersRef.current.delete(id);
      }

      setInstallingIds((prev) => new Set(prev).add(id));

      const onProgress: ProgressCallback = (progress: InstallProgress) => {
        setInstallProgress((prev) => {
          const next = new Map(prev);
          next.set(id, {
            stage: progress.stage,
            progress: progress.progress,
            message: progress.message,
          });
          return next;
        });
      };

      try {
        const result =
          skill.source === "community"
            ? await downloadAndInstallSkill({
                package: {
                  id: skill.data.id,
                  name: skill.data.name,
                  slug: skill.data.slug,
                  version: skill.data.version,
                },
                onProgress,
                force: false,
              })
            : await downloadAndInstallClawhubSkill({
                slug: skill.data.slug,
                name: skill.data.name,
                version: skill.data.version,
                onProgress,
                force: false,
              });

        if (result.success) {
          setInstalledIds((prev) => new Set(prev).add(id));
          toast.success(t("skillsMarket.installSuccess"), {
            description: t("skillsMarket.installSuccessDescription", {
              name: skill.data.name,
              version: skill.data.version,
            }),
          });
        } else {
          toast.error(t("skillsMarket.installError"), {
            description: t(getInstallErrorTranslationKey(result), {
              name: skill.data.name,
            }),
          });
        }

        return result;
      } catch (error) {
        const failure =
          error instanceof Error
            ? { message: error.message }
            : { message: String(error) };

        toast.error(t("skillsMarket.installError"), {
          description: t(getInstallErrorTranslationKey(failure), {
            name: skill.data.name,
          }),
        });

        return {
          success: false,
          name: skill.data.name,
          version: skill.data.version,
          path: "",
          message: t("installation.failed"),
          error: failure.message,
          errorCode: "UNKNOWN_ERROR",
        };
      } finally {
        installingIdsRef.current.delete(id);
        setInstallingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });

        const nextCleanupTimer = window.setTimeout(() => {
          progressCleanupTimersRef.current.delete(id);
          setInstallProgress((prev) => {
            const next = new Map(prev);
            next.delete(id);
            return next;
          });
        }, 2000);
        progressCleanupTimersRef.current.set(id, nextCleanupTimer);
      }
    },
    [t]
  );

  const isInstalling = useCallback(
    (skill: InstallableSkill | string): boolean => {
      const id = typeof skill === "string" ? skill : getSkillInstallId(skill);
      return installingIds.has(id);
    },
    [installingIds]
  );

  const isInstalled = useCallback(
    (skill: InstallableSkill | string): boolean => {
      const id = typeof skill === "string" ? skill : getSkillInstallId(skill);
      return installedIds.has(id);
    },
    [installedIds]
  );

  const getProgress = useCallback(
    (skill: InstallableSkill | string): SkillInstallProgress | undefined => {
      const id = typeof skill === "string" ? skill : getSkillInstallId(skill);
      return installProgress.get(id);
    },
    [installProgress]
  );

  return {
    installingIds,
    installedIds,
    installProgress,
    install,
    isInstalling,
    isInstalled,
    getProgress,
  };
}
