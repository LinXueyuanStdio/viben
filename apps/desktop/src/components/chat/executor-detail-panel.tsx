/**
 * Executor Detail Panel Component
 *
 * Displays detailed information about an executor including:
 * - Header with avatar, name, type badge, and config path
 * - Configuration section with config path
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PathPopover } from "@/components/ui/path-popover";
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

// ============================================================================
// Types
// ============================================================================

export interface ExecutorDetailData {
  id: string;
  name: string;
  type: string;
  config_path?: string;
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

  return (
    <div className={cn("flex-1 flex flex-col overflow-hidden", className)}>
      {/* Header */}
      {showHeader && (
        <div className={cn("border-b bg-orange-500/5", compact ? "p-4" : "p-6")}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <Avatar className={compact ? "h-12 w-12" : "h-16 w-16"}>
                <AvatarFallback className="bg-orange-500/20 text-orange-600 text-xl font-semibold">
                  {executor.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className={cn("font-semibold", compact ? "text-lg" : "text-xl")}>
                    {executor.name}
                  </h2>
                  <Badge variant="outline" className="text-xs border-orange-500/30 text-orange-600">
                    <Terminal className="h-3 w-3 mr-1" />
                    {t("settingsAgents.executors")}
                  </Badge>
                  {executor.config_path && (
                    <PathPopover
                      path={executor.config_path}
                      locationType="workspace"
                      side="top"
                    />
                  )}
                </div>
                <p className="text-muted-foreground text-sm mt-1">
                  {executor.type}
                </p>
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
          {executor.config_path && (
            <div className="mb-4">
              <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                {t("workspace.configuration")}
              </h4>

              <CollapsibleSection
                title={t("workspace.configPath")}
                icon={<Terminal className="h-4 w-4" />}
                defaultOpen
              >
                <code className="block text-xs bg-muted px-2 py-1.5 rounded font-mono break-all">
                  {executor.config_path}
                </code>
              </CollapsibleSection>
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
          <div className="p-3 rounded-xl bg-orange-500/5 border border-orange-500/20">
            <p className="text-xs text-muted-foreground">
              {t("settingsAgents.executorsDesc")}
            </p>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
