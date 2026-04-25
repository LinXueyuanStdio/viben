/**
 * Executor detail tab content for the right sidebar
 *
 * Wraps ExecutorDetailPanel with sidebar-specific settings.
 */
import { ExecutorDetailPanel } from "../executor-detail-panel";
import type { ExecutorDetailTabContentProps } from "./types";

/**
 * Executor detail tab content
 *
 * Shows executor details using ExecutorDetailPanel with:
 * - showHeader=false (header handled by tab bar)
 * - showConfigButton=false (use onSettings callback instead)
 * - compact=true (optimized for sidebar)
 */
export function ExecutorDetailTabContent({
  executor,
  workspacePath,
  onSettings,
}: ExecutorDetailTabContentProps) {
  return (
    <ExecutorDetailPanel
      executor={executor}
      workspacePath={workspacePath}
      onNavigateToEdit={onSettings ? () => onSettings(executor.id) : undefined}
      showHeader={false}
      showConfigButton={false}
      compact={true}
    />
  );
}
