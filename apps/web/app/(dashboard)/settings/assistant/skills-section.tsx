"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { usePreferencesSectionState } from "./preferences-section";

export function SkillsSectionSkeleton() {
  return (
    <div className="space-y-4">
      <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Skills
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

export function SkillsSection() {
  const state = usePreferencesSectionState();

  if (state.loading) {
    return <SkillsSectionSkeleton />;
  }

  const {
    preferences,
    isSaving,
    globalSkillSource,
    setGlobalSkillSource,
    globalSkillName,
    setGlobalSkillName,
    globalSkillsError,
    handleAddGlobalSkillRef,
    handleRemoveGlobalSkillRef,
  } = state;

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Skills
      </h3>

      <div className="grid gap-3">
        <div className="space-y-1">
          <Label>Global Skills</Label>
          <p className="text-xs text-muted-foreground">
            Skills from GitHub installed outside the repo for every new
            session. Repo skills with the same name take precedence.
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
                    size="icon-sm"
                    className="text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => handleRemoveGlobalSkillRef(index)}
                    disabled={isSaving}
                    aria-label={`Remove ${globalSkillRef.skillName}`}
                  >
                    <Trash2 />
                  </Button>
                </div>
              ),
            )}
          </div>
        ) : (
          <p className="text-xs italic text-muted-foreground">
            No global skills configured yet.
          </p>
        )}

        <div className="grid gap-2.5 rounded-lg border border-dashed border-border/60 p-3">
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div className="grid gap-1.5">
              <Label
                htmlFor="global-skill-source"
                className="text-xs font-medium"
              >
                Repository source
              </Label>
              <Input
                id="global-skill-source"
                value={globalSkillSource}
                onChange={(event) => setGlobalSkillSource(event.target.value)}
                placeholder="vercel/ai"
                disabled={isSaving}
              />
            </div>
            <div className="grid gap-1.5">
              <Label
                htmlFor="global-skill-name"
                className="text-xs font-medium"
              >
                Skill name
              </Label>
              <Input
                id="global-skill-name"
                value={globalSkillName}
                onChange={(event) => setGlobalSkillName(event.target.value)}
                placeholder="ai-sdk"
                disabled={isSaving}
              />
            </div>
            <Button
              type="button"
              onClick={handleAddGlobalSkillRef}
              disabled={isSaving}
            >
              <Plus />
              Add
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Enter the GitHub <code>owner/repo</code> source and the skill
            name, e.g. <code>vercel/ai</code> + <code>ai-sdk</code>.
          </p>
          {globalSkillsError && (
            <p className="text-xs text-destructive">{globalSkillsError}</p>
          )}
        </div>
      </div>
    </div>
  );
}
