/**
 * Executor List Item Component
 *
 * Displays an executor in a list with avatar, name, session count,
 * and action menu. Used in workspace chat sidebar and agents page.
 */

import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { Settings } from "lucide-react";
import type { Executor, ExecutorType } from "@/types";
import type { ChatListItem } from "@/lib/gateway";
import { getExecutorIcon } from "@/lib/model-icons";
import {
  ListItem,
  gradients,
  type ListItemSource,
  type ListItemBadge,
} from "./list-item";

// ============================================================================
// Types
// ============================================================================

/** ExecutorListItem can accept either ChatListItem or legacy Executor type */
export type ExecutorItemData = ChatListItem | Executor;

export interface ExecutorListItemProps {
  /** The executor to display (ChatListItem or legacy Executor type) */
  executor: ExecutorItemData;
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
  const gradientMap: Partial<Record<ExecutorType, string>> = {
    CLAUDE_CODE: gradients.claudeCode,
    AMP: gradients.amp,
    GEMINI: gradients.gemini,
    CODEX: gradients.codex,
    OPENCODE: gradients.opencode,
    CURSOR_AGENT: gradients.cursor,
    QWEN_CODE: gradients.qwen,
    COPILOT: gradients.copilot,
    DROID: gradients.droid,
    UNKNOWN: gradients.unknown,
  };
  return gradientMap[type] || gradients.unknown;
}

/**
 * Get display name for executor type
 */
export function getExecutorDisplayName(type: ExecutorType): string {
  const names: Partial<Record<ExecutorType, string>> = {
    CLAUDE_CODE: "Claude Code",
    AMP: "Amp",
    GEMINI: "Gemini",
    CODEX: "Codex",
    OPENCODE: "OpenCode",
    CURSOR_AGENT: "Cursor",
    QWEN_CODE: "Qwen Coder",
    COPILOT: "GitHub Copilot",
    DROID: "Droid",
    UNKNOWN: i18n.t("common.unknown", "Unknown"),
  };
  return names[type] || type;
}

// ============================================================================
// Component
// ============================================================================

/** Type guard to check if executor is ChatListItem */
function isChatListItem(executor: ExecutorItemData): executor is ChatListItem {
  return "item_type" in executor;
}

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

  // Get executor type from icon_type (ChatListItem) or type (legacy Executor)
  const executorType = isChatListItem(executor)
    ? (executor.icon_type || "unknown") as ExecutorType
    : executor.type;
  const displayName = executor.name || getExecutorDisplayName(executorType);

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
        icon: getExecutorIcon(executorType, { size: 20, className: "text-white" }),
        gradient: getExecutorGradient(executorType),
      }}
      indicators={{
        online: true,
        source,
      }}
      badges={additionalBadges}
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
