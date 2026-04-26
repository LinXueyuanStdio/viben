/**
 * Skills tab content for the right sidebar
 */
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Folder, Sparkles } from "lucide-react";
import type { SkillsTabContentProps } from "./types";
import { groupSkillsByFolder } from "./utils";

/**
 * Empty state component
 */
function EmptyState({
  icon: Icon,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="bg-muted/30 rounded-full p-3 mb-3">
        <Icon className="h-5 w-5 text-muted-foreground/40" />
      </div>
      <p className="text-sm text-muted-foreground/60">{description}</p>
    </div>
  );
}

/**
 * Skills tab content
 */
export function SkillsTabContent({ skills }: SkillsTabContentProps) {
  const { t } = useTranslation();

  if (skills.length === 0) {
    return (
      <EmptyState
        icon={Sparkles}
        description={t("chat.sidebar.noSkills", "No skills used")}
      />
    );
  }

  const groupedSkills = groupSkillsByFolder(skills);

  return (
    <div className="space-y-3">
      {Array.from(groupedSkills.entries()).map(([folder, folderSkills]) => (
        <div key={folder}>
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Folder className="h-3 w-3" />
            <span>{folder === "root" ? t("skills.rootFolder") : folder}</span>
          </div>
          <div className="space-y-1 rounded-md border border-border/30 bg-muted/20 p-2">
            {folderSkills.map((skill, idx) => (
              <div
                key={`${skill.name}-${idx}`}
                className="flex items-center gap-2 rounded-md py-1.5 px-2"
              >
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                <span className="truncate text-sm text-foreground/80 flex-1">
                  {skill.name}
                </span>
                {skill.callCount > 1 && (
                  <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    x{skill.callCount}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
