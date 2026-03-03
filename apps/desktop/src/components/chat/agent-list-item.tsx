/**
 * Agent List Item Component
 *
 * Displays an agent in a list with avatar, name, description,
 * and action menu. Used in workspace chat sidebar and agents page.
 */

import { useTranslation } from "react-i18next";
import { Settings, History, Copy, Trash2, Star } from "lucide-react";
import {
  ListItem,
  getGradientByName,
  type ListItemAction,
  type ListItemSource,
  type ListItemBadge,
} from "./list-item";
import { getModelIcon } from "@/lib/model-icons";

// ============================================================================
// Types
// ============================================================================

export interface AgentListItemProps {
  /** Agent data */
  agent: {
    id: string;
    name: string;
    description?: string;
    model?: string;
    updated_at?: string;
  };
  /** Whether this agent is selected */
  isSelected: boolean;
  /** Whether this is the default agent */
  isDefault?: boolean;
  /** Number of sessions for this agent */
  sessionCount?: number;
  /** Source info for workspace badge */
  source?: ListItemSource;
  /** Additional badges to display */
  badges?: ListItemBadge[];
  /** Called when agent is clicked */
  onSelect: () => void;
  /** Called when settings is clicked */
  onSettings?: () => void;
  /** Called when set as default is clicked */
  onSetDefault?: () => void;
  /** Called when copy is clicked */
  onCopy?: () => void;
  /** Called when delete is clicked */
  onDelete?: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function AgentListItem({
  agent,
  isSelected,
  isDefault,
  sessionCount,
  source,
  badges: additionalBadges,
  onSelect,
  onSettings,
  onSetDefault,
  onCopy,
  onDelete,
}: AgentListItemProps) {
  const { t } = useTranslation();

  // Build actions list
  const actions: ListItemAction[] = [];

  if (onSettings) {
    actions.push({
      label: t("agent.settings", "智能体设置"),
      icon: Settings,
      onClick: onSettings,
    });
  }

  if (onCopy) {
    actions.push({
      label: t("common.copy", "复制"),
      icon: Copy,
      onClick: onCopy,
    });
  }

  if (onSetDefault && !isDefault) {
    actions.push({
      label: t("agent.setAsDefault", "设为默认"),
      icon: Star,
      onClick: onSetDefault,
    });
  }

  if (sessionCount !== undefined) {
    actions.push({
      label: `${sessionCount} ${t("agent.sessions", "个会话")}`,
      icon: History,
      onClick: () => {},
      disabled: true,
      separator: true,
    });
  }

  if (onDelete) {
    actions.push({
      label: t("common.delete", "删除"),
      icon: Trash2,
      onClick: onDelete,
      destructive: true,
      separator: sessionCount === undefined,
    });
  }

  // Build badges
  const badges: ListItemBadge[] = [];
  if (isDefault) {
    badges.push({ label: t("agent.default", "默认"), variant: "primary" });
  }
  if (additionalBadges) {
    badges.push(...additionalBadges);
  }

  return (
    <ListItem
      name={agent.name}
      description={
        agent.description ||
        agent.model ||
        t("agent.noDescription", "暂无描述")
      }
      avatar={{
        icon: getModelIcon(agent.model, { size: 20, className: "text-white" }),
        gradient: getGradientByName(agent.name),
      }}
      indicators={{
        online: true,
        source,
      }}
      badges={badges.length > 0 ? badges : undefined}
      isSelected={isSelected}
      onClick={onSelect}
      actions={actions.length > 0 ? actions : undefined}
      contextMenu={actions.length > 0}
    />
  );
}
