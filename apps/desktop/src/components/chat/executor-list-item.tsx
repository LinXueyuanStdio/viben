/**
 * Executor List Item Component
 *
 * Displays an executor in a list with avatar, name, session count,
 * and action menu. Used in workspace chat sidebar and agents page.
 */

import { useTranslation } from "react-i18next";
import { Terminal, Settings } from "lucide-react";
import type { Executor, ExecutorType } from "@/types";
import {
  ListItem,
  gradients,
  type ListItemSource,
  type ListItemBadge,
} from "./list-item";

// ============================================================================
// Types
// ============================================================================

export interface ExecutorListItemProps {
  /** The executor to display */
  executor: Executor;
  /** Whether this executor is selected */
  isSelected: boolean;
  /** Number of sessions for this executor */
  sessionCount?: number;
  /** Source info for workspace badge */
  source?: ListItemSource;
  /** Additional badges to display */
  badges?: ListItemBadge[];
  /** Called when the executor is clicked */
  onSelect: () => void;
  /** Called when settings are clicked */
  onSettings?: () => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get gradient colors for executor avatar based on type
 */
export function getExecutorGradient(type: ExecutorType): string {
  const gradientMap: Record<ExecutorType, string> = {
    "claude-code": gradients.claudeCode,
    codex: gradients.codex,
    cursor: gradients.cursor,
    windsurf: gradients.windsurf,
    vscode: gradients.vscode,
    continue: gradients.continue,
    zed: gradients.zed,
    unknown: gradients.unknown,
  };
  return gradientMap[type] || gradients.unknown;
}

/**
 * Get display name for executor type
 */
export function getExecutorDisplayName(type: ExecutorType): string {
  const names: Record<ExecutorType, string> = {
    "claude-code": "Claude Code",
    codex: "Codex",
    cursor: "Cursor",
    windsurf: "Windsurf",
    vscode: "VS Code",
    continue: "Continue",
    zed: "Zed",
    unknown: "Unknown",
  };
  return names[type] || type;
}

// ============================================================================
// Component
// ============================================================================

export function ExecutorListItem({
  executor,
  isSelected,
  sessionCount = 0,
  source,
  badges: additionalBadges,
  onSelect,
  onSettings,
}: ExecutorListItemProps) {
  const { t } = useTranslation();

  const displayName = executor.name || getExecutorDisplayName(executor.type);

  // Build badges
  const badges: ListItemBadge[] = [
    { label: executor.type, variant: "outline" },
  ];
  if (additionalBadges) {
    badges.push(...additionalBadges);
  }

  return (
    <ListItem
      name={displayName}
      description={
        sessionCount > 0
          ? t("executor.sessionCount", "{{count}} sessions", {
              count: sessionCount,
            })
          : t("executor.noSessions", "No sessions")
      }
      avatar={{
        icon: Terminal,
        gradient: getExecutorGradient(executor.type),
      }}
      indicators={{
        online: true,
        source,
      }}
      badges={badges}
      isSelected={isSelected}
      onClick={onSelect}
      actions={
        onSettings
          ? [
              {
                label: t("executor.settings", "Executor Settings"),
                icon: Settings,
                onClick: onSettings,
              },
            ]
          : undefined
      }
      contextMenu={!!onSettings}
    />
  );
}
