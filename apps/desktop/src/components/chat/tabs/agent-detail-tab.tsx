/**
 * Agent detail tab content for the right sidebar
 *
 * Wraps AgentDetailPanel with sidebar-specific settings.
 */
import { AgentDetailPanel } from "@/components/chat/agent-detail-panel";
import type { AgentDetailTabContentProps } from "./types";

/**
 * Agent detail tab content
 *
 * Shows agent details using AgentDetailPanel with:
 * - showHeader=false (header handled by tab bar)
 * - showConfigButton=false (use onSettings callback instead)
 * - showDangerZone=false (no delete/set default in sidebar)
 * - compact=true (optimized for sidebar)
 */
export function AgentDetailTabContent({
  agent,
  workspacePath,
  isDefault,
  models,
  onUpdate,
  onSetDefault,
  onDelete,
  onSettings,
  isWorkspaceScoped,
}: AgentDetailTabContentProps) {
  return (
    <AgentDetailPanel
      agent={agent}
      workspacePath={workspacePath}
      isDefault={isDefault}
      models={models}
      onUpdate={onUpdate}
      onSetDefault={onSetDefault}
      onDelete={onDelete}
      onNavigateToEdit={onSettings ? () => onSettings(agent.id) : undefined}
      isWorkspaceScoped={isWorkspaceScoped}
      showHeader={false}
      showConfigButton={false}
      showDangerZone={false}
      compact={true}
    />
  );
}
