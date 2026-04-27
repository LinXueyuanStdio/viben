/**
 * Skills Configuration Popover
 *
 * Shows a list of available skills with enable/disable toggles.
 */

import * as React from "react";
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Search, Sparkles } from "lucide-react";
import { cn, Input, Switch, ScrollArea } from "@viben/ui";
import type { SkillConfig } from "./types";

export interface SkillsConfigPopoverProps {
  skills: SkillConfig[];
  onToggleSkill: (skillId: string, enabled: boolean) => void;
  className?: string;
}

export function SkillsConfigPopover({
  skills,
  onToggleSkill,
  className,
}: SkillsConfigPopoverProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredSkills = useMemo(() => {
    if (!searchQuery.trim()) return skills;
    const query = searchQuery.toLowerCase();
    return skills.filter(
      (skill) =>
        skill.name.toLowerCase().includes(query) ||
        skill.description?.toLowerCase().includes(query)
    );
  }, [skills, searchQuery]);

  const enabledCount = skills.filter((s) => s.enabled).length;

  return (
    <div className={cn("w-[320px]", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">
            {t("chat.configureSkills", "Configure Skills")}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          {enabledCount}/{skills.length} {t("common.enabled", "enabled")}
        </span>
      </div>

      {/* Search */}
      {skills.length > 5 && (
        <div className="relative mb-3">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("common.search", "Search...")}
            className="h-8 pl-8 text-sm"
          />
        </div>
      )}

      {/* Skills list */}
      <ScrollArea className="max-h-[300px]">
        {filteredSkills.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            {skills.length === 0
              ? t("settingsAgents.noSkillsAvailable", "No skills available")
              : t("common.noResults", "No results found")}
          </div>
        ) : (
          <div className="space-y-1">
            {filteredSkills.map((skill) => (
              <div
                key={skill.id}
                className="flex items-start gap-3 p-2 rounded-md hover:bg-accent/50 transition-colors"
              >
                <Switch
                  checked={skill.enabled}
                  onCheckedChange={(checked) => onToggleSkill(skill.id, checked)}
                  className="mt-0.5 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{skill.name}</div>
                  {skill.description && (
                    <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                      {skill.description}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
