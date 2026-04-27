/**
 * Agent List Item Component
 *
 * Displays an agent in a list with avatar, name, description,
 * and action menu. Used in workspace chat sidebar and agents page.
 */

import { useTranslation } from "react-i18next";
import { Settings, History, Copy, Trash2, Star, Tag, Upload } from "lucide-react";
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
  /** Called when toggle template is clicked */
  onToggleTemplate?: () => void;
  /** Called when promote to global is clicked (workspace templates only) */
  onPromoteToGlobal?: () => void;
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
  onToggleTemplate,
  onPromoteToGlobal,
}: AgentListItemProps) {
  const { t } = useTranslation();

  // Check if this is a template by looking at badges
  const isTemplate = additionalBadges?.some(b => b.label === t("agent.template", "Template"));

  // Build actions list
  const actions: ListItemAction[] = [];

  if (onSettings) {
    actions.push({
      label: t("agent.settings", "Agent Settings"),
      icon: Settings,
      onClick: onSettings,
    });
  }

  if (onCopy) {
    actions.push({
      label: t("common.copy", "Copy"),
      icon: Copy,
      onClick: onCopy,
    });
  }

  if (onSetDefault && !isDefault) {
    actions.push({
      label: t("agent.setAsDefault", "Set as Default"),
      icon: Star,
      onClick: onSetDefault,
    });
  }

  // Template management actions
  if (onToggleTemplate) {
    actions.push({
      label: isTemplate
        ? t("agent.unmarkAsTemplate", "Unmark as Template")
        : t("agent.markAsTemplate", "Mark as Template"),
      icon: Tag,
      onClick: onToggleTemplate,
      separator: true,
    });
  }

  if (onPromoteToGlobal) {
    actions.push({
      label: t("agent.promoteToGlobal", "Promote to Global"),
      icon: Upload,
      onClick: onPromoteToGlobal,
    });
  }

  if (sessionCount !== undefined) {
    actions.push({
      label: t("agent.sessionCount", { defaultValue: "{{count}} sessions", count: sessionCount }),
      icon: History,
      onClick: () => {},
      disabled: true,
      separator: true,
    });
  }

  if (onDelete) {
    actions.push({
      label: t("common.delete", "Delete"),
      icon: Trash2,
      onClick: onDelete,
      destructive: true,
      separator: sessionCount === undefined && !onToggleTemplate && !onPromoteToGlobal,
    });
  }

  // Build badges
  const badges: ListItemBadge[] = [];
  if (isDefault) {
    badges.push({ label: t("agent.default", "Default"), variant: "primary" });
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
        t("agent.noDescription", "No description")
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
