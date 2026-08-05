"use client";

import { useTranslation } from "react-i18next";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import type { GlobalSkillRef } from "@/lib/skills/global-skill-refs";
import type { UserPreferences } from "@/hooks/assistant/use-user-preferences";

export function SkillsSectionSkeleton() {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {t("settings.assistant.skills.skills")}
      </h3>
      <div className="space-y-3">
        <div className="space-y-1">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-[28rem] max-w-full" />
        </div>
        <div className="rounded-lg border border-border/70">
          {Array.from({ length: 2 }).map((_, index) => (
            <div
              key={index}
              className="flex items-center gap-3 border-b border-border/60 px-3 py-2.5 last:border-b-0"
            >
              <div className="grid min-w-0 flex-1 gap-1">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-44" />
              </div>
              <Skeleton className="size-8 rounded-md" />
            </div>
          ))}
        </div>
        <div className="grid gap-2.5 rounded-lg border border-dashed border-border/60 p-3">
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div className="grid gap-1.5">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="grid gap-1.5">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-10 w-full" />
            </div>
            <Skeleton className="h-10 w-20" />
          </div>
          <Skeleton className="h-4 w-[30rem] max-w-full" />
        </div>
      </div>
    </div>
  );
}

export function SkillsSection({
  loading,
  preferences,
  isSaving,
  globalSkillSource,
  onGlobalSkillSourceChange,
  globalSkillName,
  onGlobalSkillNameChange,
  globalSkillsError,
  onAddGlobalSkillRef,
  onRemoveGlobalSkillRef,
}: {
  loading: boolean;
  preferences: UserPreferences | undefined;
  isSaving: boolean;
  globalSkillSource: string;
  onGlobalSkillSourceChange: (value: string) => void;
  globalSkillName: string;
  onGlobalSkillNameChange: (value: string) => void;
  globalSkillsError: string | null;
  onAddGlobalSkillRef: () => Promise<void>;
  onRemoveGlobalSkillRef: (index: number) => Promise<void>;
}) {
  const { t } = useTranslation();

  if (loading) {
    return <SkillsSectionSkeleton />;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {t("settings.assistant.skills.skills")}
      </h3>

      <div className="grid gap-3">
        <div className="space-y-1">
          <Label>{t("settings.assistant.skills.globalSkills")}</Label>
          <p className="text-xs text-muted-foreground">
            {t("settings.assistant.skills.globalSkillsHint")}
          </p>
        </div>

        {(preferences?.globalSkillRefs ?? []).length > 0 ? (
          <div className="divide-y divide-border/60 rounded-lg border border-border/70">
            {(preferences?.globalSkillRefs ?? []).map(
              (globalSkillRef, index) => (
                <div
                  key={`${globalSkillRef.source}-${globalSkillRef.skillName}`}
                  className="flex items-center gap-3 px-3 py-2.5"
                >
                  <div className="grid min-w-0 flex-1 gap-0.5">
                    <span className="truncate text-sm font-medium">
                      {globalSkillRef.skillName}
                    </span>
                    <span className="truncate font-mono text-xs text-muted-foreground">
                      {globalSkillRef.source}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => onRemoveGlobalSkillRef(index)}
                    disabled={isSaving}
                    aria-label={t("settings.assistant.skills.removeSkill", { name: globalSkillRef.skillName })}
                  >
                    <Trash2 />
                  </Button>
                </div>
              ),
            )}
          </div>
        ) : (
          <p className="text-xs italic text-muted-foreground">
            {t("settings.assistant.skills.noGlobalSkills")}
          </p>
        )}

        <div className="grid gap-2.5 rounded-lg border border-dashed border-border/60 p-3">
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div className="grid gap-1.5">
              <Label
                htmlFor="global-skill-source"
                className="text-xs font-medium"
              >
                {t("settings.assistant.skills.repositorySource")}
              </Label>
              <Input
                id="global-skill-source"
                value={globalSkillSource}
                onChange={(event) => onGlobalSkillSourceChange(event.target.value)}
                placeholder={t("settings.assistant.skills.repositorySourcePlaceholder")}
                disabled={isSaving}
              />
            </div>
            <div className="grid gap-1.5">
              <Label
                htmlFor="global-skill-name"
                className="text-xs font-medium"
              >
                {t("settings.assistant.skills.skillName")}
              </Label>
              <Input
                id="global-skill-name"
                value={globalSkillName}
                onChange={(event) => onGlobalSkillNameChange(event.target.value)}
                placeholder={t("settings.assistant.skills.skillNamePlaceholder")}
                disabled={isSaving}
              />
            </div>
            <Button
              type="button"
              onClick={onAddGlobalSkillRef}
              disabled={isSaving}
            >
              <Plus />
              {t("settings.assistant.skills.add")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("settings.assistant.skills.addHint")}
          </p>
          {globalSkillsError && (
            <p className="text-xs text-destructive">{globalSkillsError}</p>
          )}
        </div>
      </div>
    </div>
  );
}
