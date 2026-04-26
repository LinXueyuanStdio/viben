/**
 * Executor Capabilities Component
 *
 * Reusable component for displaying executor capabilities:
 * - MCP servers
 * - Skills
 * - SubAgents (.claude/agents/*.md)
 * - Prompts (.claude/prompts/*.md)
 * - Commands (.claude/commands/)
 *
 * Two modes:
 * - Read-only (default): Items are clickable and navigate to detail pages
 * - Editable: Shows add/configure buttons for MCP and Skills
 *
 * Used in:
 * - ExecutorDetailPanel (read-only)
 * - ExecutorDetailView in agent-detail page (read-only)
 * - AgentDetailPage editing section (editable)
 */

import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Loader2,
  Database,
  Server,
  Sparkles,
  Bot,
  Quote,
  Command,
  ChevronRight,
  Plus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CollapsibleSection } from "./collapsible-section";
import {
  useWorkspaceMcpServers,
  useWorkspaceSkills,
} from "@/hooks/use-workspaces";
import {
  useWorkspaceAgentConfigs,
  useWorkspaceCommands,
  useWorkspacePrompts,
} from "@/hooks/use-agent-configs";

// ============================================================================
// Types
// ============================================================================

/** MCP Server info for editable mode */
export interface McpServerInfo {
  id: string;
  name: string;
  transport: string;
}

/** Skill package info for editable mode */
export interface SkillPackageInfo {
  id: string;
  name: string;
}

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

  // ========== Editable mode props ==========
  /** Enable editable mode for MCP and Skills */
  editable?: boolean;
  /** Selected MCP server IDs (editable mode) */
  selectedMcpServers?: string[];
  /** Selected skill IDs (editable mode) */
  selectedSkills?: string[];
  /** Available MCP servers for selection (editable mode) */
  mcpServerOptions?: McpServerInfo[];
  /** Available skill packages for selection (editable mode) */
  skillPackageOptions?: SkillPackageInfo[];
  /** Called when MCP configure button is clicked (editable mode) */
  onConfigureMcp?: () => void;
  /** Called when Skills configure button is clicked (editable mode) */
  onConfigureSkills?: () => void;
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
  // Editable mode props
  editable = false,
  selectedMcpServers = [],
  selectedSkills = [],
  mcpServerOptions = [],
  skillPackageOptions = [],
  onConfigureMcp,
  onConfigureSkills,
}: ExecutorCapabilitiesProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Load data for executor (used in read-only mode)
  const { servers: mcpServers, loading: mcpLoading } = useWorkspaceMcpServers(
    workspacePath || null,
    executorType
  );
  const { skills, loading: skillsLoading } = useWorkspaceSkills(
    workspacePath || null,
    executorType
  );
  const { configs: subAgentConfigs, loading: subAgentsLoading } = useWorkspaceAgentConfigs(
    workspacePath || null,
    executorType
  );
  const { prompts, loading: promptsLoading } = useWorkspacePrompts(
    workspacePath || null,
    executorType
  );
  const { commands, loading: commandsLoading } = useWorkspaceCommands(
    workspacePath || null,
    executorType
  );

  // Navigation handlers (read-only mode)
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

  const handleSubAgentClick = (configId: string) => {
    const params = new URLSearchParams();
    if (workspacePath) {
      params.set("workspace_path", workspacePath);
    }
    params.set("executor_type", executorType);
    navigate(`/subagent/${encodeURIComponent(configId)}?${params.toString()}`);
  };

  const handlePromptClick = (promptId: string) => {
    const params = new URLSearchParams();
    if (workspacePath) {
      params.set("workspace_path", workspacePath);
    }
    params.set("executor_type", executorType);
    navigate(`/prompt/${encodeURIComponent(promptId)}?${params.toString()}`);
  };

  const handleCommandClick = (commandId: string) => {
    const params = new URLSearchParams();
    if (workspacePath) {
      params.set("workspace_path", workspacePath);
    }
    params.set("executor_type", executorType);
    navigate(`/command/${encodeURIComponent(commandId)}?${params.toString()}`);
  };

  // ========== Render editable MCP section ==========
  const renderEditableMcp = () => (
    <CollapsibleSection
      title={t("settingsAgents.mcpTitle", "MCP")}
      icon={<Database className="h-4 w-4" />}
      badge={<Badge variant="secondary" className="text-xs">{selectedMcpServers.length}</Badge>}
      action={
        onConfigureMcp && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              onConfigureMcp();
            }}
          >
            <Plus className="h-3 w-3" />
          </Button>
        )
      }
      defaultOpen
    >
      <div className="py-2 space-y-2">
        {selectedMcpServers.length === 0 ? (
          <>
            <p className="text-xs text-muted-foreground">
              {t("settingsAgents.noMcp")}
            </p>
            {onConfigureMcp && (
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs h-7"
                onClick={onConfigureMcp}
              >
                <Plus className="h-3 w-3 mr-1" />
                {t("settingsAgents.addMcp")}
              </Button>
            )}
          </>
        ) : (
          <>
            <div className="space-y-1">
              {selectedMcpServers.map((serverId) => {
                const server = mcpServerOptions.find((s) => s.id === serverId);
                return (
                  <div
                    key={serverId}
                    className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-md bg-muted/50"
                  >
                    <Database className="h-3 w-3 text-muted-foreground" />
                    <span className="truncate">{server?.name || serverId}</span>
                    {server && (
                      <Badge variant="outline" className="text-[10px] px-1 py-0 ml-auto shrink-0">
                        {server.transport.toUpperCase()}
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
            {onConfigureMcp && (
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs h-7 mt-2"
                onClick={onConfigureMcp}
              >
                {t("common.configure")}
              </Button>
            )}
          </>
        )}
      </div>
    </CollapsibleSection>
  );

  // ========== Render editable Skills section ==========
  const renderEditableSkills = () => (
    <CollapsibleSection
      title={t("settingsAgents.skills")}
      icon={<Sparkles className="h-4 w-4" />}
      badge={<Badge variant="secondary" className="text-xs">{selectedSkills.length}</Badge>}
      action={
        onConfigureSkills && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              onConfigureSkills();
            }}
          >
            <Plus className="h-3 w-3" />
          </Button>
        )
      }
    >
      <div className="py-2 space-y-2">
        {selectedSkills.length === 0 ? (
          <>
            <p className="text-xs text-muted-foreground">
              {t("settingsAgents.noSkills")}
            </p>
            {onConfigureSkills && (
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs h-7"
                onClick={onConfigureSkills}
              >
                <Plus className="h-3 w-3 mr-1" />
                {t("settingsAgents.addSkill")}
              </Button>
            )}
          </>
        ) : (
          <>
            <div className="space-y-1">
              {selectedSkills.map((skillId) => {
                const skill = skillPackageOptions.find((s) => s.id === skillId);
                return (
                  <div
                    key={skillId}
                    className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-md bg-muted/50"
                  >
                    <Sparkles className="h-3 w-3 text-muted-foreground" />
                    <span className="truncate">{skill?.name || skillId}</span>
                  </div>
                );
              })}
            </div>
            {onConfigureSkills && (
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs h-7 mt-2"
                onClick={onConfigureSkills}
              >
                {t("common.configure")}
              </Button>
            )}
          </>
        )}
      </div>
    </CollapsibleSection>
  );

  // ========== Render read-only MCP section ==========
  const renderReadOnlyMcp = () => (
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
  );

  // ========== Render read-only Skills section ==========
  const renderReadOnlySkills = () => (
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
  );

  // ========== Render SubAgents section (always read-only) ==========
  const renderSubAgents = () => (
    <CollapsibleSection
      title={t("settingsAgents.subAgents", "SubAgents")}
      icon={<Bot className="h-4 w-4" />}
      badge={
        subAgentsLoading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Badge variant="secondary" className="text-xs">{subAgentConfigs.length}</Badge>
        )
      }
    >
      <div className="py-2 space-y-1">
        {subAgentConfigs.length === 0 ? (
          <>
            <p className="text-xs text-muted-foreground">
              {t("settingsAgents.noSubAgents", "No subagent configurations found.")}
            </p>
            <p className="text-[10px] text-muted-foreground/70">
              {t("settingsAgents.noSubAgentsHint", "Create .claude/agents/*.md files to add subagent configurations.")}
            </p>
          </>
        ) : (
          subAgentConfigs.map((config) => (
            <CapabilityItem
              key={config.id}
              icon={<Bot className="h-3 w-3 text-violet-500" />}
              name={config.name}
              badge={
                config.model && (
                  <Badge variant="outline" className="text-[10px] px-1 py-0 shrink-0">
                    {config.model}
                  </Badge>
                )
              }
              onClick={() => handleSubAgentClick(config.id)}
            />
          ))
        )}
      </div>
    </CollapsibleSection>
  );

  // ========== Render Prompts section (always read-only) ==========
  const renderPrompts = () => (
    <CollapsibleSection
      title={t("settingsAgents.prompts", "Prompts")}
      icon={<Quote className="h-4 w-4" />}
      badge={
        promptsLoading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Badge variant="secondary" className="text-xs">{prompts.length}</Badge>
        )
      }
    >
      <div className="py-2 space-y-1">
        {prompts.length === 0 ? (
          <>
            <p className="text-xs text-muted-foreground">
              {t("settingsAgents.noPrompts", "No prompt templates found.")}
            </p>
            <p className="text-[10px] text-muted-foreground/70">
              {t("settingsAgents.noPromptsHint", "Create .claude/prompts/*.md files to add reusable prompts.")}
            </p>
          </>
        ) : (
          prompts.map((prompt) => (
            <CapabilityItem
              key={prompt.id}
              icon={<Quote className="h-3 w-3 text-amber-500" />}
              name={prompt.name}
              badge={
                <span className="text-[10px] text-muted-foreground shrink-0">
                  @{prompt.id}
                </span>
              }
              onClick={() => handlePromptClick(prompt.id)}
            />
          ))
        )}
      </div>
    </CollapsibleSection>
  );

  // ========== Render Commands section (always read-only) ==========
  const renderCommands = () => (
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
  );

  return (
    <div className={cn("space-y-1", className)}>
      {showSectionHeader && (
        <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
          {sectionHeaderText || t("settingsAgents.capabilities")}
        </h4>
      )}

      {/* MCP Servers - editable or read-only */}
      {editable ? renderEditableMcp() : renderReadOnlyMcp()}

      {/* Skills - editable or read-only */}
      {editable ? renderEditableSkills() : renderReadOnlySkills()}

      {/* SubAgents - always read-only with navigation */}
      {renderSubAgents()}

      {/* Prompts - always read-only with navigation */}
      {renderPrompts()}

      {/* Commands - always read-only with navigation */}
      {renderCommands()}
    </div>
  );
}
