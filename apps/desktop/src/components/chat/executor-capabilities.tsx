/**
 * Executor Capabilities Component
 *
 * Reusable component for displaying executor capabilities:
 * - MCP servers
 * - Skills
 * - Prompts (agent configs)
 * - Commands
 *
 * Each item is clickable and navigates to its detail page.
 * Used in ExecutorDetailPanel and ExecutorDetailView (agent-detail page).
 */

import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Loader2,
  Database,
  Server,
  Sparkles,
  MessageSquare,
  FileText,
  Command,
  ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

export interface ExecutorCapabilitiesProps {
  /** Executor type (e.g., "CLAUDE_CODE") */
  executorType: string;
  /** Workspace path for loading data */
  workspacePath: string;
  /** Custom class name */
  className?: string;
  /** Whether to show section headers */
  showSectionHeader?: boolean;
  /** Section header text */
  sectionHeaderText?: string;
}

// ============================================================================
// Clickable Item Component
// ============================================================================

interface CapabilityItemProps {
  icon: React.ReactNode;
  name: string;
  badge?: React.ReactNode;
  secondaryBadge?: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
}

function CapabilityItem({
  icon,
  name,
  badge,
  secondaryBadge,
  disabled,
  onClick,
}: CapabilityItemProps) {
  const content = (
    <>
      <span className="shrink-0">{icon}</span>
      <span className="truncate flex-1">{name}</span>
      {badge}
      {secondaryBadge}
      {onClick && (
        <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      )}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded-md bg-muted/50 hover:bg-muted transition-colors cursor-pointer text-left group",
          disabled && "opacity-60"
        )}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 text-xs px-2 py-1.5 rounded-md bg-muted/50",
        disabled && "opacity-60"
      )}
    >
      {content}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ExecutorCapabilities({
  executorType,
  workspacePath,
  className,
  showSectionHeader = true,
  sectionHeaderText,
}: ExecutorCapabilitiesProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Load data for executor
  const { servers: mcpServers, loading: mcpLoading } = useWorkspaceMcpServers(
    workspacePath || null,
    executorType
  );
  const { skills, loading: skillsLoading } = useWorkspaceSkills(
    workspacePath || null,
    executorType
  );
  const { configs: agentConfigs, loading: configsLoading } = useWorkspaceAgentConfigs(
    workspacePath || null,
    executorType
  );
  const { commands, loading: commandsLoading } = useWorkspaceCommands(
    workspacePath || null,
    executorType
  );

  // Navigation handlers
  const handleSkillClick = (skillId: string) => {
    const params = new URLSearchParams();
    if (workspacePath) {
      params.set("workspace_path", workspacePath);
    }
    params.set("agent_id", executorType);
    navigate(`/skill/${encodeURIComponent(skillId)}?${params.toString()}`);
  };

  const handleMcpServerClick = (serverName: string) => {
    const params = new URLSearchParams();
    if (workspacePath) {
      params.set("workspace_path", workspacePath);
    }
    params.set("executor_type", executorType);
    navigate(`/mcp-server/${encodeURIComponent(serverName)}?${params.toString()}`);
  };

  const handlePromptClick = (configId: string) => {
    const params = new URLSearchParams();
    if (workspacePath) {
      params.set("workspace_path", workspacePath);
    }
    params.set("executor_type", executorType);
    navigate(`/prompt/${encodeURIComponent(configId)}?${params.toString()}`);
  };

  const handleCommandClick = (commandId: string) => {
    const params = new URLSearchParams();
    if (workspacePath) {
      params.set("workspace_path", workspacePath);
    }
    params.set("executor_type", executorType);
    navigate(`/command/${encodeURIComponent(commandId)}?${params.toString()}`);
  };

  return (
    <div className={cn("space-y-1", className)}>
      {showSectionHeader && (
        <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
          {sectionHeaderText || t("settingsAgents.capabilities")}
        </h4>
      )}

      {/* MCP Servers */}
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
              <CapabilityItem
                key={server.name}
                icon={<Server className="h-3 w-3 text-muted-foreground" />}
                name={server.name}
                badge={
                  server.transport && (
                    <Badge variant="outline" className="text-[10px] px-1 py-0 shrink-0">
                      {server.transport}
                    </Badge>
                  )
                }
                disabled={server.disabled}
                onClick={() => handleMcpServerClick(server.name)}
              />
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
              <CapabilityItem
                key={skill.id}
                icon={<Sparkles className="h-3 w-3 text-muted-foreground" />}
                name={skill.name}
                badge={
                  <Badge variant="outline" className="text-[10px] px-1 py-0 shrink-0">
                    v{skill.version}
                  </Badge>
                }
                onClick={() => handleSkillClick(skill.id)}
              />
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
              <CapabilityItem
                key={config.id}
                icon={<FileText className="h-3 w-3 text-muted-foreground" />}
                name={config.name}
                badge={
                  config.model && (
                    <Badge variant="outline" className="text-[10px] px-1 py-0 shrink-0">
                      {config.model}
                    </Badge>
                  )
                }
                onClick={() => handlePromptClick(config.id)}
              />
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
              <CapabilityItem
                key={command.id}
                icon={<Command className="h-3 w-3 text-muted-foreground" />}
                name={`/${command.id}`}
                badge={
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {command.namespace}
                  </span>
                }
                onClick={() => handleCommandClick(command.id)}
              />
            ))
          )}
        </div>
      </CollapsibleSection>
    </div>
  );
}
