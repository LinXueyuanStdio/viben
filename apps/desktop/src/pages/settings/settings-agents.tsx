/**
 * Settings Agents Page - Reuses WorkspaceAgentsPage
 *
 * 设置页面中的智能体管理完全复用全局工作空间的智能体页面
 * Settings > Agents section simply wraps the WorkspaceAgentsPage component
 */
import { Loader2, Bot } from "lucide-react";
import { useLocalWorkspaces } from "@/hooks/use-workspaces";
import { WorkspaceAgentsPage } from "@/pages/agents/workspace-agents";
import { useTranslation } from "react-i18next";

export function SettingsAgentsPage() {
  const { t } = useTranslation();
  const { workspaces, isLoading } = useLocalWorkspaces();
  const globalWorkspace = workspaces.find((w) => w.type === "global");

  // Show loading while workspaces are loading
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Global workspace not found - show message
  if (!globalWorkspace) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <Bot className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">
          {t("settingsAgents.noGlobalWorkspace", { defaultValue: "Global workspace not found" })}
        </h2>
        <p className="text-muted-foreground">
          {t("settingsAgents.noGlobalWorkspaceDesc", { defaultValue: "Please create or initialize the global workspace first" })}
        </p>
      </div>
    );
  }

  // Render workspace agents page with global workspace context
  // Pass the full workspace object so it has access to the path
  return <WorkspaceAgentsPage settingsMode workspaceOverride={globalWorkspace} />;
}
