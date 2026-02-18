/**
 * Executor Detail Panel Component
 *
 * Displays detailed information about an executor including:
 * - Header with avatar, name, type badge
 * - Configuration section with config paths (workspace/global)
 * - Capabilities section with MCP servers, skills, prompts, commands
 *
 * Used in workspace-agents page and workspace-chat right sidebar.
 */

import { useTranslation } from "react-i18next";
import {
  Terminal,
  Settings2,
  Loader2,
  Database,
  Server,
  Sparkles,
  MessageSquare,
  FileText,
  Command,
  FolderOpen,
  Globe,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { CollapsibleSection } from "./collapsible-section";
import {
  useWorkspaceMcpServers,
  useWorkspaceSkills,
} from "@/hooks/use-workspaces";
import {
  useWorkspaceAgentConfigs,
  useWorkspaceCommands,
} from "@/hooks/use-agent-configs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ============================================================================
// Types
// ============================================================================

export interface ExecutorDetailData {
  id: string;
  name: string;
  type: string;
  config_path?: string;
  /** Global config path for executors */
  global_config_path?: string;
  /** Source of config: "global", "workspace", or "merged" */
  source?: "global" | "workspace" | "merged";
}

export interface ExecutorDetailPanelProps {
  /** Executor data to display */
  executor: ExecutorDetailData;
  /** Workspace path for loading related data (e.g., "/Users/foo/project") */
  workspacePath: string;
  /** Called when navigate to edit is requested */
  onNavigateToEdit?: () => void;
  /** Whether to show the header */
  showHeader?: boolean;
  /** Whether to show the configuration button */
  showConfigButton?: boolean;
  /** Custom class name */
  className?: string;
  /** Compact mode for sidebar display */
  compact?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function ExecutorDetailPanel({
  executor,
  workspacePath,
  onNavigateToEdit,
  showHeader = true,
  showConfigButton = true,
  className,
  compact = false,
}: ExecutorDetailPanelProps) {
  const { t } = useTranslation();

  // Load data for executor using workspacePath and executor.type
  const { servers: mcpServers, loading: mcpLoading } = useWorkspaceMcpServers(
    workspacePath || null,
    executor.type
  );
  const { skills, loading: skillsLoading } = useWorkspaceSkills(
    workspacePath || null,
    executor.type
  );
  const { configs: agentConfigs, loading: configsLoading } = useWorkspaceAgentConfigs(
    workspacePath || null,
    executor.type
  );
  const { commands, loading: commandsLoading } = useWorkspaceCommands(
    workspacePath || null,
    executor.type
  );

  // Get executor icon color based on type
  const getExecutorColor = (type: string) => {
    const colors: Record<string, { bg: string; text: string; border: string }> = {
      CLAUDE_CODE: { bg: "bg-amber-500/10", text: "text-amber-600", border: "border-amber-500/30" },
      CODEX: { bg: "bg-emerald-500/10", text: "text-emerald-600", border: "border-emerald-500/30" },
      GEMINI_CLI: { bg: "bg-blue-500/10", text: "text-blue-600", border: "border-blue-500/30" },
      AIDER: { bg: "bg-violet-500/10", text: "text-violet-600", border: "border-violet-500/30" },
    };
    return colors[type] || { bg: "bg-muted", text: "text-foreground", border: "border-border" };
  };

  const executorColor = getExecutorColor(executor.type);

  // Helper to open path in system file explorer
  const openInExplorer = async (path: string) => {
    try {
      const { open } = await import("@tauri-apps/plugin-shell");
      // Get directory from file path
      const dir = path.replace(/\/[^/]+$/, "");
      await open(dir);
    } catch (err) {
      console.error("Failed to open in explorer:", err);
    }
  };

  return (
    <div className={cn("flex-1 flex flex-col overflow-hidden", className)}>
      {/* Header */}
      {showHeader && (
        <div className={cn("border-b bg-muted/10", compact ? "p-4" : "p-6")}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <Avatar className={cn(compact ? "h-12 w-12" : "h-16 w-16")}>
                <AvatarFallback className={cn(executorColor.bg, executorColor.text, "text-xl font-semibold")}>
                  {executor.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className={cn("font-semibold", compact ? "text-lg" : "text-xl")}>
                    {executor.name}
                  </h2>
                  <Badge variant="outline" className={cn("text-xs", executorColor.border, executorColor.text)}>
                    <Terminal className="h-3 w-3 mr-1" />
                    {t("settingsAgents.executors")}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="text-xs font-mono">
                    {executor.type}
                  </Badge>
                  {executor.source && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="outline" className="text-xs gap-1">
                          {executor.source === "workspace" ? (
                            <FolderOpen className="h-3 w-3" />
                          ) : executor.source === "global" ? (
                            <Globe className="h-3 w-3" />
                          ) : (
                            <>
                              <FolderOpen className="h-3 w-3" />
                              <span>+</span>
                              <Globe className="h-3 w-3" />
                            </>
                          )}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        {executor.source === "workspace"
                          ? t("settingsAgents.workspaceConfig")
                          : executor.source === "global"
                            ? t("settingsAgents.globalConfig")
                            : t("settingsAgents.mergedConfig")}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>
            </div>
            {showConfigButton && onNavigateToEdit && (
              <Button onClick={onNavigateToEdit} size={compact ? "sm" : "default"}>
                <Settings2 className="h-4 w-4 mr-2" />
                {t("settingsAgents.configuration")}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className={cn("space-y-1", compact ? "p-4" : "p-6")}>
          {/* Config Section */}
          {(executor.config_path || executor.global_config_path) && (
            <div className="mb-4">
              <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                {t("workspace.configuration")}
              </h4>

              {/* Workspace Config */}
              {executor.config_path && (
                <CollapsibleSection
                  title={t("settingsAgents.workspaceConfig")}
                  icon={<FolderOpen className="h-4 w-4" />}
                  defaultOpen
                >
                  <div className="py-2">
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs bg-muted px-2 py-1.5 rounded font-mono break-all">
                        {executor.config_path}
                      </code>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            onClick={() => openInExplorer(executor.config_path!)}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t("common.openInExplorer")}</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </CollapsibleSection>
              )}

              {/* Global Config */}
              {executor.global_config_path && (
                <CollapsibleSection
                  title={t("settingsAgents.globalConfig")}
                  icon={<Globe className="h-4 w-4" />}
                  defaultOpen={!executor.config_path}
                >
                  <div className="py-2">
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs bg-muted px-2 py-1.5 rounded font-mono break-all">
                        {executor.global_config_path}
                      </code>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            onClick={() => openInExplorer(executor.global_config_path!)}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t("common.openInExplorer")}</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </CollapsibleSection>
              )}
            </div>
          )}

          {/* Capabilities Section */}
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
              {t("settingsAgents.capabilities")}
            </h4>

            {/* MCP */}
            <CollapsibleSection
              title={t("settingsAgents.mcpTitle", "MCP")}
              icon={<Database className="h-4 w-4" />}
              badge={
                mcpLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Badge variant="secondary" className="text-xs">{mcpServers.length}</Badge>
                )
              }
              defaultOpen
            >
              <div className="py-2 space-y-1">
                {mcpServers.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {t("settingsAgents.noMcp")}
                  </p>
                ) : (
                  mcpServers.map((server) => (
                    <div
                      key={server.name}
                      className={cn(
                        "flex items-center gap-2 text-xs px-2 py-1.5 rounded-md bg-muted/50",
                        server.disabled && "opacity-60"
                      )}
                    >
                      <Server className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="truncate">{server.name}</span>
                      {server.transport && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 ml-auto shrink-0">
                          {server.transport}
                        </Badge>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CollapsibleSection>

            {/* Skills */}
            <CollapsibleSection
              title={t("chat.skills")}
              icon={<Sparkles className="h-4 w-4" />}
              badge={
                skillsLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Badge variant="secondary" className="text-xs">{skills.length}</Badge>
                )
              }
            >
              <div className="py-2 space-y-1">
                {skills.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {t("settingsAgents.noSkills")}
                  </p>
                ) : (
                  skills.map((skill) => (
                    <div
                      key={skill.id}
                      className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-md bg-muted/50"
                    >
                      <Sparkles className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="truncate">{skill.name}</span>
                      <Badge variant="outline" className="text-[10px] px-1 py-0 ml-auto shrink-0">
                        v{skill.version}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </CollapsibleSection>

            {/* Prompts */}
            <CollapsibleSection
              title={t("settingsAgents.prompts")}
              icon={<MessageSquare className="h-4 w-4" />}
              badge={
                configsLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Badge variant="secondary" className="text-xs">{agentConfigs.length}</Badge>
                )
              }
            >
              <div className="py-2 space-y-1">
                {agentConfigs.length === 0 ? (
                  <>
                    <p className="text-xs text-muted-foreground">
                      {t("settingsAgents.noPrompts")}
                    </p>
                    <p className="text-[10px] text-muted-foreground/70">
                      {t("settingsAgents.noPromptsHint")}
                    </p>
                  </>
                ) : (
                  agentConfigs.map((config) => (
                    <div
                      key={config.id}
                      className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-md bg-muted/50"
                    >
                      <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="truncate">{config.name}</span>
                      {config.model && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 ml-auto shrink-0">
                          {config.model}
                        </Badge>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CollapsibleSection>

            {/* Commands */}
            <CollapsibleSection
              title={t("settingsAgents.commands")}
              icon={<Command className="h-4 w-4" />}
              badge={
                commandsLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Badge variant="secondary" className="text-xs">{commands.length}</Badge>
                )
              }
            >
              <div className="py-2 space-y-1">
                {commands.length === 0 ? (
                  <>
                    <p className="text-xs text-muted-foreground">
                      {t("settingsAgents.noCommands")}
                    </p>
                    <p className="text-[10px] text-muted-foreground/70">
                      {t("settingsAgents.noCommandsHint")}
                    </p>
                  </>
                ) : (
                  commands.map((command) => (
                    <div
                      key={command.id}
                      className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-md bg-muted/50"
                    >
                      <Command className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="truncate font-mono">/{command.id}</span>
                      <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
                        {command.namespace}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </CollapsibleSection>
          </div>

          {/* Info */}
          <div className="p-3 rounded-xl bg-muted/50 border">
            <p className="text-xs text-muted-foreground">
              {t("settingsAgents.executorsDesc")}
            </p>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
