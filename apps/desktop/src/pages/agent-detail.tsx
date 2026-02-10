/**
 * Agent Detail Page - Agent Configuration Editor
 *
 * Three-column layout for agent configuration:
 * - Left: Persona (System Prompt, Append Prompt)
 * - Middle: Configuration (Model, Executor, Capabilities, Memory)
 * - Right: Preview & Debug
 *
 * Supports both global and workspace-scoped agents:
 * - Global: /agents/:agentId
 * - Workspace: /workspace/:workspaceId/agent/:agentId
 */
import * as React from "react";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Save,
  Loader2,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  Cpu,
  Settings2,
  Sparkles,
  Brain,
  Database,
  Plus,
  FileText,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Info,
  Globe,
  FolderOpen,
  Trash2,
  HelpCircle,
  Terminal,
  Server,
  Command,
  MessageSquare,
  GripVertical,
  Copy,
  Check,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import {
  useAgents,
  useModels,
  useAgent,
  useCloudSkillPackages,
  useLocalWorkspaces,
  useWorkspaceAgents,
  useWorkspaceMcpServers,
  useWorkspaceSkills,
  useWorkspaceAgentConfigs,
  useWorkspaceCommands,
} from "@/hooks";
import { homeDir } from "@tauri-apps/api/path";
import { invoke } from "@tauri-apps/api/core";
import { MessageList, ChatInput, type SlashCommand } from "@/components/chat";
import { AgentMcpDialog, AgentSkillsDialog, AgentMemoryDialog } from "@/components/agent";
import {
  type BaseCodingAgent,
  AGENT_TYPES,
} from "@/types";
import { getGatewayClient, getAvailabilityStatus } from "@/lib/gateway";
import type { AvailabilityInfo, VibenAgentResponse, AgentInfo } from "@/lib/gateway";
import { useAppStore } from "@/stores/app-store";

// ============================================================================
// Panel Width Constants
// ============================================================================

const MIN_LEFT_PANEL_WIDTH = 200;
const MAX_LEFT_PANEL_WIDTH = 400;
const DEFAULT_LEFT_PANEL_WIDTH = 288; // w-72

const MIN_RIGHT_PANEL_WIDTH = 240;
const MAX_RIGHT_PANEL_WIDTH = 480;
const DEFAULT_RIGHT_PANEL_WIDTH = 320; // w-80

// ============================================================================
// Resize Handle Component
// ============================================================================

interface ResizeHandleProps {
  side: "left" | "right";
  onResize: (delta: number) => void;
  className?: string;
}

function ResizeHandle({ side, onResize, className }: ResizeHandleProps) {
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startXRef.current = e.clientX;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startXRef.current;
      startXRef.current = moveEvent.clientX;
      // For left panel, positive delta = expand; for right panel, negative delta = expand
      onResize(side === "left" ? delta : -delta);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  return (
    <div
      className={cn(
        "group absolute top-0 bottom-0 w-1 cursor-col-resize z-10",
        "flex items-center justify-center",
        side === "left" ? "right-0" : "left-0",
        isDragging && "bg-primary/30",
        className
      )}
      onMouseDown={handleMouseDown}
    >
      {/* Hover/drag indicator line */}
      <div
        className={cn(
          "absolute inset-y-0 w-0.5 transition-colors",
          isDragging ? "bg-primary" : "bg-transparent group-hover:bg-border"
        )}
      />
      {/* Grip handle - vertically centered */}
      <div
        className={cn(
          "absolute flex items-center justify-center w-4 h-8 rounded-md transition-all",
          isDragging
            ? "bg-primary text-primary-foreground"
            : "bg-muted/80 text-muted-foreground opacity-0 group-hover:opacity-100"
        )}
      >
        <GripVertical className="h-4 w-4" />
      </div>
    </div>
  );
}

// ============================================================================
// Collapsible Section Component
// ============================================================================

interface CollapsibleSectionProps {
  title: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function CollapsibleSection({
  title,
  icon,
  badge,
  action,
  defaultOpen = false,
  children,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button
          className={cn(
            "w-full flex items-center gap-2 py-2.5 px-1 text-sm hover:bg-muted/50 rounded-lg transition-colors",
            isOpen && "text-foreground",
            !isOpen && "text-muted-foreground"
          )}
        >
          {isOpen ? (
            <ChevronDown className="h-4 w-4 shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0" />
          )}
          {icon && <span className="shrink-0">{icon}</span>}
          <span className="font-medium">{title}</span>
          {badge && <span className="ml-auto mr-2">{badge}</span>}
          {action && (
            <span className="ml-auto" onClick={(e) => e.stopPropagation()}>
              {action}
            </span>
          )}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-6 pr-1 pb-2">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function AgentDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { agentId, workspaceId } = useParams<{ agentId: string; workspaceId?: string }>();

  // Determine if this is a workspace-scoped agent
  const isWorkspaceScoped = Boolean(workspaceId);

  // Get workspace info first (needed for workspace agent hook)
  const { workspaces, isLoading: workspacesLoading } = useLocalWorkspaces();
  const workspace = isWorkspaceScoped
    ? workspaces.find((w) => w.id === workspaceId)
    : null;

  // Use Gateway API for all agents (global + workspace)
  const {
    loading: agentsLoading,
    error: agentsError,
    updateAgent,
    getWorkspaceAgents,
    getGlobalAgents,
  } = useAgents({ workspacePath: workspace?.path });

  // Filter agents by source
  const vibenAgents = getGlobalAgents().filter((a: AgentInfo) => a.agent_type === "viben");
  const workspaceVibenAgents = getWorkspaceAgents().filter((a: AgentInfo) => a.agent_type === "viben");
  const workspaceAgentsLoading = agentsLoading;

  // Workspace executors (auto-discovered from .claude, .cursor, etc.)
  const {
    agents: workspaceExecutors,
    loading: executorsLoading,
  } = useWorkspaceAgents(workspaceId || null);

  const { models } = useModels();
  const mcpServers = useAppStore((state) => state.mcpServers);
  const { packages: skillPackages } = useCloudSkillPackages();

  // Determine workdir: workspace path for workspace-scoped, ~/.viben for global
  const [globalVibenDir, setGlobalVibenDir] = useState<string>("");
  useEffect(() => {
    if (!isWorkspaceScoped) {
      homeDir().then((home) => {
        setGlobalVibenDir(`${home}.viben`);
      });
    }
  }, [isWorkspaceScoped]);

  // Find the current agent or executor
  // First try to find in global Viben Agents (from list - minimal info)
  const globalVibenAgentInfo = useMemo(
    () => vibenAgents.find((a) => a.id === agentId) || null,
    [vibenAgents, agentId]
  );

  // Then try to find in workspace-scoped Viben Agents (from list - minimal info)
  const workspaceVibenAgentInfo = useMemo(
    () => workspaceVibenAgents.find((a) => a.id === agentId) || null,
    [workspaceVibenAgents, agentId]
  );

  // Then try to find in workspace executors (auto-discovered)
  const workspaceExecutor = useMemo(
    () => workspaceExecutors.find((a) => a.id === agentId) || null,
    [workspaceExecutors, agentId]
  );

  // Use workspace agent if found, otherwise fall back to global (just to check if it exists)
  const vibenAgentInfo = workspaceVibenAgentInfo || globalVibenAgentInfo;

  // Full agent details (loaded from Gateway API)
  const [fullAgent, setFullAgent] = useState<VibenAgentResponse | null>(null);
  const [loadingFullAgent, setLoadingFullAgent] = useState(false);

  // Load full agent details when agent ID changes
  useEffect(() => {
    if (!agentId || !vibenAgentInfo) {
      setFullAgent(null);
      return;
    }

    const loadFullAgent = async () => {
      setLoadingFullAgent(true);
      try {
        const gateway = getGatewayClient();
        const agentData = await gateway.getVibenAgent(agentId);
        setFullAgent(agentData);
      } catch (err) {
        console.error("Failed to load agent details:", err);
        setFullAgent(null);
      } finally {
        setLoadingFullAgent(false);
      }
    };

    loadFullAgent();
  }, [agentId, vibenAgentInfo]);

  // Determine if we're viewing an executor or an agent
  const isExecutor = Boolean(workspaceExecutor && !vibenAgentInfo);
  // Map VibenAgentResponse to expected agent interface with backwards-compatible fields
  const agent = fullAgent ? {
    ...fullAgent,
    // Map config_path to path for backwards compatibility
    path: fullAgent.config_path,
  } : null;
  const executor = workspaceExecutor;

  // Form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formSystemPrompt, setFormSystemPrompt] = useState("");
  const [formAppendPrompt, setFormAppendPrompt] = useState("");
  const [formTemperature, setFormTemperature] = useState(0.7);
  const [formMaxTokens, setFormMaxTokens] = useState(4096);
  const [formModel, setFormModel] = useState("");
  const [formExecutorType, setFormExecutorType] = useState<BaseCodingAgent>("CLAUDE_CODE");
  const [formPlanMode, setFormPlanMode] = useState(false);
  const [formApprovals, setFormApprovals] = useState(false);

  // State
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [availability, setAvailability] = useState<AvailabilityInfo | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);

  // Panel width state for resizable panels
  const [leftPanelWidth, setLeftPanelWidth] = useState(DEFAULT_LEFT_PANEL_WIDTH);
  const [rightPanelWidth, setRightPanelWidth] = useState(DEFAULT_RIGHT_PANEL_WIDTH);

  // Resize handlers
  const handleLeftResize = useCallback((delta: number) => {
    setLeftPanelWidth((prev) =>
      Math.max(MIN_LEFT_PANEL_WIDTH, Math.min(MAX_LEFT_PANEL_WIDTH, prev + delta))
    );
  }, []);

  const handleRightResize = useCallback((delta: number) => {
    setRightPanelWidth((prev) =>
      Math.max(MIN_RIGHT_PANEL_WIDTH, Math.min(MAX_RIGHT_PANEL_WIDTH, prev + delta))
    );
  }, []);

  // Dialog states
  const [mcpDialogOpen, setMcpDialogOpen] = useState(false);
  const [skillsDialogOpen, setSkillsDialogOpen] = useState(false);
  const [memoryDialogOpen, setMemoryDialogOpen] = useState(false);

  // MCP and Skills selection
  const [selectedMcpServers, setSelectedMcpServers] = useState<string[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);

  // Copy path state
  const [pathCopied, setPathCopied] = useState(false);

  // Get agent folder path - use agent.path if available (reliable), otherwise fallback to computed path
  const agentFolderPath = useMemo(() => {
    // Prefer the actual path from the agent object (set by backend)
    if (agent?.path) {
      return agent.path;
    }
    // Fallback: compute path based on scope (less reliable)
    if (isWorkspaceScoped && workspace) {
      return `${workspace.path}/.viben/agents/${agentId}`;
    }
    return globalVibenDir ? `${globalVibenDir}/agents/${agentId}` : "";
  }, [agent?.path, isWorkspaceScoped, workspace, globalVibenDir, agentId]);

  // Copy path to clipboard
  const handleCopyPath = useCallback(async () => {
    if (!agentFolderPath) return;
    await navigator.clipboard.writeText(agentFolderPath);
    setPathCopied(true);
    setTimeout(() => setPathCopied(false), 2000);
  }, [agentFolderPath]);

  // Open folder in file manager
  const handleOpenFolder = useCallback(async () => {
    if (!agentFolderPath) return;
    try {
      await invoke("open_path", { path: agentFolderPath });
    } catch (err) {
      console.error("Failed to open folder:", err);
    }
  }, [agentFolderPath]);

  // Load form from agent
  useEffect(() => {
    if (agent) {
      setFormName(agent.name);
      setFormDescription(agent.description || "");
      setFormSystemPrompt(agent.system_prompt || "");
      setFormAppendPrompt(agent.append_prompt || "");
      setFormTemperature(agent.temperature ?? 0.7);
      setFormMaxTokens(agent.max_tokens ?? 4096);
      setFormModel(agent.model || "");
      setFormExecutorType((agent.executor_type as BaseCodingAgent) || "CLAUDE_CODE");
      setFormPlanMode(agent.plan_mode ?? false);
      setFormApprovals(agent.approvals ?? false);
      setSelectedMcpServers(agent.mcp_servers || []);
      setSelectedSkills(agent.skills || []);
      setIsDirty(false);
    }
  }, [agent]);

  // Auto-check availability when executor type changes
  useEffect(() => {
    checkAvailability();
  }, [formExecutorType]);

  // Keyboard shortcut: Cmd+S to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (isDirty && !saving) {
          handleSave();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDirty, saving]);

  // Mark as dirty when form changes
  useEffect(() => {
    if (agent) {
      const hasChanges =
        formName !== agent.name ||
        formDescription !== (agent.description || "") ||
        formSystemPrompt !== (agent.system_prompt || "") ||
        formAppendPrompt !== (agent.append_prompt || "") ||
        formTemperature !== (agent.temperature ?? 0.7) ||
        formMaxTokens !== (agent.max_tokens ?? 4096) ||
        formModel !== (agent.model || "") ||
        formExecutorType !== (agent.executor_type || "CLAUDE_CODE") ||
        formPlanMode !== (agent.plan_mode ?? false) ||
        formApprovals !== (agent.approvals ?? false) ||
        JSON.stringify(selectedMcpServers) !== JSON.stringify(agent.mcp_servers || []) ||
        JSON.stringify(selectedSkills) !== JSON.stringify(agent.skills || []);
      setIsDirty(hasChanges);
    }
  }, [agent, formName, formDescription, formSystemPrompt, formAppendPrompt, formTemperature, formMaxTokens, formModel, formExecutorType, formPlanMode, formApprovals, selectedMcpServers, selectedSkills]);

  // Save agent
  const handleSave = async () => {
    if (!agentId) return;
    setSaving(true);
    try {
      await updateAgent(agentId, {
        name: formName,
        description: formDescription || undefined,
        system_prompt: formSystemPrompt || undefined,
        append_prompt: formAppendPrompt || undefined,
        temperature: formTemperature,
        max_tokens: formMaxTokens,
        model: formModel || undefined,
        executor_type: formExecutorType,
        plan_mode: formPlanMode,
        approvals: formApprovals,
        mcp_servers: selectedMcpServers,
        skills: selectedSkills,
      });
      setIsDirty(false);
      setLastSaved(new Date());
    } catch (err) {
      console.error("Failed to save agent:", err);
    } finally {
      setSaving(false);
    }
  };

  // Gateway connection state
  const [gatewayConnected, setGatewayConnected] = useState<boolean | null>(null);

  // Check availability
  const checkAvailability = useCallback(async () => {
    setCheckingAvailability(true);
    try {
      const client = getGatewayClient();
      // First check if gateway is reachable
      const isConnected = await client.ping();
      setGatewayConnected(isConnected);

      if (!isConnected) {
        setAvailability(null);
        return;
      }

      const result = await client.checkAvailability(formExecutorType);
      setAvailability(result);
    } catch {
      setGatewayConnected(false);
      setAvailability(null);
    } finally {
      setCheckingAvailability(false);
    }
  }, [formExecutorType]);

  // Group models by provider
  const modelsByProvider = useMemo(() => {
    const grouped: Record<string, typeof models> = {};
    for (const model of models) {
      if (!grouped[model.provider_id]) {
        grouped[model.provider_id] = [];
      }
      grouped[model.provider_id].push(model);
    }
    return grouped;
  }, [models]);

  // Debug chat (using shared chat components)
  // Workdir: workspace path for workspace-scoped agents, ~/.viben for global agents
  const debugWorkdir = isWorkspaceScoped
    ? workspace?.path || ""
    : globalVibenDir;

  const {
    messages,
    phase,
    isStreaming,
    pendingPlan,
    pendingQuestions,
    sendMessage,
    approvePlan,
    rejectPlan,
    answerQuestions,
    cancel,
    clearMessages,
  } = useAgent(debugWorkdir, {
    agentType: formExecutorType,
    executorConfig: formExecutorType === "CLAUDE_CODE" ? {
      type: "CLAUDE_CODE",
      config: {
        plan: formPlanMode,
        approvals: formApprovals,
        append_prompt: formAppendPrompt || undefined,
        model: formModel || undefined,
      },
    } : undefined,
  });

  // Navigate back to appropriate location based on scope
  // Must be before early returns to maintain hooks order
  const handleNavigateBack = useCallback(() => {
    if (isWorkspaceScoped) {
      navigate(`/workspace/${workspaceId}/agents`);
    } else {
      navigate("/settings/agents");
    }
  }, [navigate, isWorkspaceScoped, workspaceId]);

  // Slash commands for agent debug chat
  const slashCommands = useMemo<SlashCommand[]>(() => [
    {
      id: "clear",
      name: t("chat.slashCommands.clear", "clear"),
      description: t("chat.slashCommands.clearDesc", "Clear conversation history"),
      icon: <Trash2 className="h-4 w-4" />,
    },
    {
      id: "help",
      name: t("chat.slashCommands.help", "help"),
      description: t("chat.slashCommands.helpDesc", "Show available commands"),
      icon: <HelpCircle className="h-4 w-4" />,
    },
  ], [t]);

  // Handle slash command execution
  const handleSlashCommand = useCallback((command: SlashCommand) => {
    switch (command.id) {
      case "clear":
        clearMessages();
        break;
      case "help":
        // Could show a help modal or inject a help message
        break;
    }
  }, [clearMessages]);

  if (workspacesLoading || agentsLoading || workspaceAgentsLoading || executorsLoading || loadingFullAgent) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // If we found an executor, show a read-only executor detail view with tabs
  if (isExecutor && executor) {
    return (
      <ExecutorDetailView
        executor={executor}
        workspaceId={workspaceId || ""}
        onNavigateBack={handleNavigateBack}
      />
    );
  }

  if (!agent) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <AlertCircle className="h-12 w-12 mb-3 opacity-50" />
        <p>{t("settingsAgents.agentNotFound")}</p>
        <Button variant="outline" className="mt-4" onClick={handleNavigateBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t("common.back")}
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleNavigateBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary/20 text-primary text-xs">
              {formName.slice(0, 2).toUpperCase() || "AG"}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <Input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="h-7 px-2 font-semibold border-none shadow-none focus-visible:ring-0"
              placeholder={t("settingsAgents.namePlaceholder")}
            />
            {/* Path with copy button */}
            {agentFolderPath && (
              <div className="flex items-center gap-1 px-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-xs text-muted-foreground truncate max-w-[200px] cursor-default">
                        {agentFolderPath.split("/").slice(-3).join("/")}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[400px]">
                      <code className="text-xs break-all">{agentFolderPath}</code>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={handleCopyPath}
                      >
                        {pathCopied ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {pathCopied ? t("common.copied") : t("common.copyPath")}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            )}
          </div>
          {/* Scope indicator */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant={isWorkspaceScoped ? "default" : "secondary"}
                  className={cn(
                    "text-xs gap-1",
                    isWorkspaceScoped
                      ? "bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 border-blue-500/30"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {isWorkspaceScoped ? (
                    <>
                      <FolderOpen className="h-3 w-3" />
                      {t("settingsAgents.workspaceScoped")}
                    </>
                  ) : (
                    <>
                      <Globe className="h-3 w-3" />
                      {t("settingsAgents.globalScoped")}
                    </>
                  )}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                {isWorkspaceScoped
                  ? t("settingsAgents.workspaceScopedDesc")
                  : t("settingsAgents.globalScopedDesc")}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Badge variant="outline" className="text-xs">
            {AGENT_TYPES.find((t) => t.id === formExecutorType)?.name || formExecutorType}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {lastSaved && (
            <span className="text-xs text-muted-foreground">
              {t("settingsAgents.lastSaved", {
                time: lastSaved.toLocaleTimeString(),
              })}
            </span>
          )}
          {isDirty && (
            <Badge variant="secondary" className="text-xs">
              {t("settingsAgents.unsaved")}
            </Badge>
          )}
          {/* Open folder button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleOpenFolder}
                  disabled={!agentFolderPath}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("settingsAgents.openFolder")}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button onClick={handleSave} disabled={saving || !isDirty}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {t("common.save")}
          </Button>
        </div>
      </div>

      {/* Error Banner */}
      {agentsError && (
        <div className="mx-4 mt-4 p-4 rounded-xl bg-destructive/10 text-destructive text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {agentsError}
        </div>
      )}

      {/* Three Column Layout */}
      <div className="flex-1 flex min-h-0">
        {/* ================================================================
            LEFT COLUMN: Persona (Resizable)
            ================================================================ */}
        <div
          className="relative flex flex-col shrink-0"
          style={{ width: leftPanelWidth }}
        >
          <div className="p-4 border-b">
            <h3 className="font-semibold text-sm">{t("settingsAgents.persona")}</h3>
            <p className="text-xs text-muted-foreground mt-1">
              {t("settingsAgents.personaDesc")}
            </p>
          </div>
          <ResizeHandle side="left" onResize={handleLeftResize} />

          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              {/* System Prompt */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("settingsAgents.systemPrompt")}
                  </Label>
                  <span className="text-xs text-muted-foreground">
                    {formSystemPrompt.length.toLocaleString()}
                  </span>
                </div>
                <Textarea
                  value={formSystemPrompt}
                  onChange={(e) => setFormSystemPrompt(e.target.value)}
                  placeholder={t("settingsAgents.systemPromptPlaceholder")}
                  rows={12}
                  className="resize-none text-sm"
                />
              </div>

              {/* Append Prompt */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("settingsAgents.appendPrompt")}
                  </Label>
                  <span className="text-xs text-muted-foreground">
                    {formAppendPrompt.length.toLocaleString()}
                  </span>
                </div>
                <Textarea
                  value={formAppendPrompt}
                  onChange={(e) => setFormAppendPrompt(e.target.value)}
                  placeholder={t("settingsAgents.appendPromptPlaceholder")}
                  rows={4}
                  className="resize-none text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  {t("settingsAgents.appendPromptHint")}
                </p>
              </div>
            </div>
          </ScrollArea>
        </div>

        {/* ================================================================
            MIDDLE COLUMN: Configuration
            ================================================================ */}
        <div className="flex-1 flex flex-col min-w-0 border-r">
          <div className="p-4 border-b">
            <h3 className="font-semibold text-sm">{t("settingsAgents.configuration")}</h3>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-4 space-y-1">
              {/* Model Settings Section */}
              <div className="mb-4">
                <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                  {t("settingsAgents.modelSettings")}
                </h4>

                <CollapsibleSection
                  title={t("settingsAgents.model")}
                  icon={<Cpu className="h-4 w-4" />}
                  badge={
                    formModel && (
                      <Badge variant="secondary" className="text-xs">
                        {formModel.split("/").pop()}
                      </Badge>
                    )
                  }
                  defaultOpen
                >
                  <div className="space-y-3">
                    <Select value={formModel} onValueChange={setFormModel}>
                      <SelectTrigger>
                        <SelectValue placeholder={t("settingsAgents.selectModel")} />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(modelsByProvider).map(([provider, providerModels]) => (
                          <div key={provider}>
                            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                              {provider}
                            </div>
                            {providerModels.filter((m) => m.is_available).map((model) => (
                              <SelectItem key={model.id} value={model.id}>
                                {model.name}
                              </SelectItem>
                            ))}
                          </div>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className="flex items-center justify-between">
                      <Label className="text-xs">{t("settingsAgents.temperature")}</Label>
                      <span className="text-xs text-muted-foreground">
                        {formTemperature.toFixed(2)}
                      </span>
                    </div>
                    <Slider
                      value={[formTemperature]}
                      onValueChange={([v]) => setFormTemperature(v)}
                      min={0}
                      max={2}
                      step={0.01}
                    />
                  </div>
                </CollapsibleSection>

                <CollapsibleSection
                  title={t("settingsAgents.executorType")}
                  icon={<Settings2 className="h-4 w-4" />}
                  badge={
                    <div className="flex items-center gap-1">
                      {availability?.type === "LOGIN_DETECTED" && (
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                      )}
                      {availability?.type === "NOT_FOUND" && (
                        <XCircle className="h-3 w-3 text-red-500" />
                      )}
                      <Badge variant="outline" className="text-xs">
                        {AGENT_TYPES.find((t) => t.id === formExecutorType)?.name}
                      </Badge>
                    </div>
                  }
                >
                  <div className="space-y-3">
                    <Select
                      value={formExecutorType}
                      onValueChange={(v) => setFormExecutorType(v as BaseCodingAgent)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {AGENT_TYPES.map((type) => (
                          <SelectItem key={type.id} value={type.id}>
                            {type.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={checkAvailability}
                      disabled={checkingAvailability}
                      className="w-full"
                    >
                      {checkingAvailability ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      {t("settingsAgents.checkAvailability")}
                    </Button>

                    {/* Gateway disconnected */}
                    {gatewayConnected === false && (
                      <div className="p-2 rounded-md text-xs bg-orange-500/10 text-orange-700 dark:text-orange-400">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-3.5 w-3.5" />
                          <span className="font-medium">{t("gateway.disconnected")}</span>
                        </div>
                        <p className="mt-1 opacity-80">
                          {t("settingsAgents.gatewayNotRunningHint", { defaultValue: "Gateway 服务未运行。请先在设置中启动 Gateway。" })}
                        </p>
                      </div>
                    )}

                    {/* Gateway connected - show availability */}
                    {gatewayConnected === true && availability && (
                      <div
                        className={cn(
                          "p-2 rounded-md text-xs",
                          availability.type === "LOGIN_DETECTED" && "bg-green-500/10 text-green-700 dark:text-green-400",
                          availability.type === "INSTALLATION_FOUND" && "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
                          availability.type === "NOT_FOUND" && "bg-red-500/10 text-red-700 dark:text-red-400"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          {availability.type === "LOGIN_DETECTED" && <CheckCircle2 className="h-3.5 w-3.5" />}
                          {availability.type === "INSTALLATION_FOUND" && <AlertCircle className="h-3.5 w-3.5" />}
                          {availability.type === "NOT_FOUND" && <XCircle className="h-3.5 w-3.5" />}
                          <span className="font-medium">{getAvailabilityStatus(availability).label}</span>
                        </div>
                        {availability.type === "NOT_FOUND" && (
                          <p className="mt-1 opacity-80">
                            {t("settingsAgents.executorNotFoundHint")}
                          </p>
                        )}
                        {availability.type === "INSTALLATION_FOUND" && (
                          <p className="mt-1 opacity-80">
                            {t("settingsAgents.executorNotLoggedInHint")}
                          </p>
                        )}
                      </div>
                    )}

                    {formExecutorType === "CLAUDE_CODE" && (
                      <div className="space-y-2 pt-2 border-t">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">{t("settingsAgents.planMode")}</Label>
                          <Switch checked={formPlanMode} onCheckedChange={setFormPlanMode} />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">{t("settingsAgents.approvals")}</Label>
                          <Switch checked={formApprovals} onCheckedChange={setFormApprovals} />
                        </div>
                      </div>
                    )}
                  </div>
                </CollapsibleSection>
              </div>

              {/* Capabilities Section */}
              <div className="mb-4">
                <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                  {t("settingsAgents.capabilities")}
                </h4>

                <CollapsibleSection
                  title="MCP"
                  icon={<Database className="h-4 w-4" />}
                  badge={<Badge variant="secondary" className="text-xs">{selectedMcpServers.length}</Badge>}
                  action={
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMcpDialogOpen(true);
                      }}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  }
                >
                  <div className="py-2 space-y-2">
                    {selectedMcpServers.length === 0 ? (
                      <>
                        <p className="text-xs text-muted-foreground">
                          {t("settingsAgents.noMcp")}
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full text-xs h-7"
                          onClick={() => setMcpDialogOpen(true)}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          {t("settingsAgents.addMcp")}
                        </Button>
                      </>
                    ) : (
                      <>
                        <div className="space-y-1">
                          {selectedMcpServers.map((serverId) => {
                            const server = mcpServers.find((s) => s.id === serverId);
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
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full text-xs h-7 mt-2"
                          onClick={() => setMcpDialogOpen(true)}
                        >
                          {t("common.configure")}
                        </Button>
                      </>
                    )}
                  </div>
                </CollapsibleSection>

                <CollapsibleSection
                  title={t("settingsAgents.skills")}
                  icon={<Sparkles className="h-4 w-4" />}
                  badge={<Badge variant="secondary" className="text-xs">{selectedSkills.length}</Badge>}
                  action={
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSkillsDialogOpen(true);
                      }}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  }
                >
                  <div className="py-2 space-y-2">
                    {selectedSkills.length === 0 ? (
                      <>
                        <p className="text-xs text-muted-foreground">
                          {t("settingsAgents.noSkills")}
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full text-xs h-7"
                          onClick={() => setSkillsDialogOpen(true)}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          {t("settingsAgents.addSkill")}
                        </Button>
                      </>
                    ) : (
                      <>
                        <div className="space-y-1">
                          {selectedSkills.map((skillId) => {
                            const skill = skillPackages.find((s) => s.id === skillId);
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
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full text-xs h-7 mt-2"
                          onClick={() => setSkillsDialogOpen(true)}
                        >
                          {t("common.configure")}
                        </Button>
                      </>
                    )}
                  </div>
                </CollapsibleSection>

                {/* Prompts Section */}
                <CollapsibleSection
                  title={t("settingsAgents.prompts")}
                  icon={<MessageSquare className="h-4 w-4" />}
                  badge={<Badge variant="secondary" className="text-xs">0</Badge>}
                >
                  <div className="py-2 space-y-2">
                    <p className="text-xs text-muted-foreground">
                      {t("settingsAgents.noPrompts")}
                    </p>
                    <p className="text-[10px] text-muted-foreground/70">
                      {t("settingsAgents.noPromptsHint")}
                    </p>
                  </div>
                </CollapsibleSection>

                {/* Commands Section */}
                <CollapsibleSection
                  title={t("settingsAgents.commands")}
                  icon={<Command className="h-4 w-4" />}
                  badge={<Badge variant="secondary" className="text-xs">0</Badge>}
                >
                  <div className="py-2 space-y-2">
                    <p className="text-xs text-muted-foreground">
                      {t("settingsAgents.noCommands")}
                    </p>
                    <p className="text-[10px] text-muted-foreground/70">
                      {t("settingsAgents.noCommandsHint")}
                    </p>
                  </div>
                </CollapsibleSection>
              </div>

              {/* Memory Section */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                  {t("settingsAgents.memory")}
                </h4>

                <CollapsibleSection
                  title="MEMORY.md"
                  icon={<Brain className="h-4 w-4" />}
                  action={
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMemoryDialogOpen(true);
                      }}
                    >
                      {t("common.edit")}
                    </Button>
                  }
                  defaultOpen
                >
                  <p className="text-xs text-muted-foreground py-2">
                    {t("settingsAgents.memoryDesc")}
                  </p>
                </CollapsibleSection>

                <CollapsibleSection
                  title={t("settingsAgents.todayLog")}
                  icon={<FileText className="h-4 w-4" />}
                  action={
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMemoryDialogOpen(true);
                      }}
                    >
                      {t("common.view")}
                    </Button>
                  }
                >
                  <p className="text-xs text-muted-foreground py-2">
                    {t("settingsAgents.noLogToday")}
                  </p>
                </CollapsibleSection>

                <CollapsibleSection
                  title={t("settingsAgents.yesterdayLog")}
                  icon={<FileText className="h-4 w-4" />}
                  action={
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMemoryDialogOpen(true);
                      }}
                    >
                      {t("common.view")}
                    </Button>
                  }
                >
                  <p className="text-xs text-muted-foreground py-2">
                    {t("settingsAgents.noLogYesterday")}
                  </p>
                </CollapsibleSection>
              </div>
            </div>
          </ScrollArea>
        </div>

        {/* ================================================================
            RIGHT COLUMN: Preview & Debug (Resizable)
            ================================================================ */}
        <div
          className="relative flex flex-col bg-muted/30 shrink-0"
          style={{ width: rightPanelWidth }}
        >
          <ResizeHandle side="right" onResize={handleRightResize} />
          {/* Header with actions */}
          <div className="p-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/20 text-primary text-xs">
                  {formName.slice(0, 2).toUpperCase() || "AG"}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-semibold text-sm">{formName || t("settingsAgents.unnamed")}</h3>
                <p className="text-xs text-muted-foreground">{t("settingsAgents.previewDebug")}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={clearMessages}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t("settingsAgents.clearChat")}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <Info className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("settingsAgents.contextDetails")}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          {/* Chat Messages - using shared MessageList component */}
          <MessageList
            messages={messages}
            isStreaming={isStreaming}
            pendingPlan={pendingPlan}
            pendingQuestions={pendingQuestions}
            onApprovePlan={approvePlan}
            onRejectPlan={rejectPlan}
            onAnswerQuestions={answerQuestions}
            className="flex-1"
          />

          {/* Chat Input - using shared ChatInput component */}
          <div className="border-t border-border bg-background">
            <ChatInput
              onSend={sendMessage}
              onCancel={cancel}
              isLoading={isStreaming}
              disabled={phase === "awaiting_approval" || phase === "awaiting_input"}
              placeholder={
                phase === "awaiting_approval"
                  ? t("chat.waitingForApproval")
                  : phase === "awaiting_input"
                    ? t("chat.waitingForInput")
                    : t("settingsAgents.sendMessage")
              }
              autoFocus
              showTopToolbar
              showConfigBar
              showResizeHandle
              enableWritingMode
              hideAgentSelector
              hideModelSelector
              slashCommands={slashCommands}
              onSlashCommand={handleSlashCommand}
            />
            <p className="text-xs text-muted-foreground py-2 text-center">
              {t("settingsAgents.aiDisclaimer")}
            </p>
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <AgentMcpDialog
        open={mcpDialogOpen}
        onOpenChange={setMcpDialogOpen}
        selectedServerIds={selectedMcpServers}
        onServersChange={setSelectedMcpServers}
      />

      <AgentSkillsDialog
        open={skillsDialogOpen}
        onOpenChange={setSkillsDialogOpen}
        selectedSkillIds={selectedSkills}
        onSkillsChange={setSelectedSkills}
      />

      <AgentMemoryDialog
        open={memoryDialogOpen}
        onOpenChange={setMemoryDialogOpen}
        agentId={agentId || ""}
        agentName={formName || t("settingsAgents.unnamed")}
      />
    </div>
  );
}

// ============================================================================
// Executor Detail View Component (Three-Column Layout)
// ============================================================================

interface ExecutorDetailViewProps {
  executor: {
    id: string;
    name: string;
    type: string;
    config_path: string;
    mcp_config_file: string | null;
    skills_config_file: string | null;
  };
  workspaceId: string;
  onNavigateBack: () => void;
}

function ExecutorDetailView({
  executor,
  workspaceId,
  onNavigateBack,
}: ExecutorDetailViewProps) {
  const { t } = useTranslation();

  // Get workspace path for chat and CLAUDE.md
  const { workspaces } = useLocalWorkspaces();
  const workspace = workspaces.find((w) => w.id === workspaceId);
  const workspacePath = workspace?.path || "";

  // State for CLAUDE.md content
  const [claudeMdContent, setClaudeMdContent] = useState<string>("");
  const [claudeMdLoading, setClaudeMdLoading] = useState(true);
  const [claudeMdError, setClaudeMdError] = useState<string | null>(null);

  // Load CLAUDE.md content
  useEffect(() => {
    async function loadClaudeMd() {
      if (!workspacePath) {
        setClaudeMdLoading(false);
        return;
      }

      setClaudeMdLoading(true);
      setClaudeMdError(null);

      try {
        // Try different possible locations for CLAUDE.md
        const possiblePaths = [
          `${workspacePath}/CLAUDE.md`,
          `${workspacePath}/.claude/CLAUDE.md`,
          `${workspacePath}/claude.md`,
        ];

        let content = "";
        for (const path of possiblePaths) {
          try {
            const { readTextFile } = await import("@tauri-apps/plugin-fs");
            content = await readTextFile(path);
            if (content) break;
          } catch {
            // File doesn't exist, try next path
          }
        }

        setClaudeMdContent(content);
      } catch (err) {
        setClaudeMdError(err instanceof Error ? err.message : String(err));
      } finally {
        setClaudeMdLoading(false);
      }
    }

    loadClaudeMd();
  }, [workspacePath]);

  // Load MCP servers for this executor
  const {
    servers: mcpServers,
    loading: mcpLoading,
  } = useWorkspaceMcpServers(workspaceId, executor.id);

  // Load skills for this executor
  const {
    skills,
    loading: skillsLoading,
  } = useWorkspaceSkills(workspaceId, executor.id);

  // Load agent configs (prompts) for this executor
  const {
    configs: agentConfigs,
    loading: configsLoading,
  } = useWorkspaceAgentConfigs(workspaceId, executor.id);

  // Load commands for this executor
  const {
    commands,
    loading: commandsLoading,
  } = useWorkspaceCommands(workspaceId, executor.id);

  // Chat functionality - map executor type to agent type
  // Only CLAUDE_CODE and CODEX have corresponding BaseCodingAgent types
  const agentType = useMemo((): BaseCodingAgent => {
    if (executor.type === "claude-code") return "CLAUDE_CODE";
    if (executor.type === "codex") return "CODEX";
    // All other executor types default to CLAUDE_CODE for chat
    return "CLAUDE_CODE";
  }, [executor.type]);

  const {
    messages,
    phase,
    isStreaming,
    pendingPlan,
    pendingQuestions,
    sendMessage,
    approvePlan,
    rejectPlan,
    answerQuestions,
    cancel,
    clearMessages,
  } = useAgent(workspacePath, {
    agentType,
    executorConfig: agentType === "CLAUDE_CODE" ? {
      type: "CLAUDE_CODE",
      config: {
        plan: false,
        approvals: false,
      },
    } : undefined,
  });

  // Panel width state for resizable panels
  const [leftPanelWidth, setLeftPanelWidth] = useState(DEFAULT_LEFT_PANEL_WIDTH);
  const [rightPanelWidth, setRightPanelWidth] = useState(DEFAULT_RIGHT_PANEL_WIDTH);

  // Resize handlers
  const handleLeftResize = useCallback((delta: number) => {
    setLeftPanelWidth((prev) =>
      Math.max(MIN_LEFT_PANEL_WIDTH, Math.min(MAX_LEFT_PANEL_WIDTH, prev + delta))
    );
  }, []);

  const handleRightResize = useCallback((delta: number) => {
    setRightPanelWidth((prev) =>
      Math.max(MIN_RIGHT_PANEL_WIDTH, Math.min(MAX_RIGHT_PANEL_WIDTH, prev + delta))
    );
  }, []);

  // Copy path state
  const [pathCopied, setPathCopied] = useState(false);

  // Get executor config folder path (parent of config_path)
  const executorFolderPath = useMemo(() => {
    if (executor.config_path) {
      // Get parent directory of config file
      const parts = executor.config_path.split("/");
      parts.pop(); // Remove filename
      return parts.join("/");
    }
    return workspacePath;
  }, [executor.config_path, workspacePath]);

  // Copy path to clipboard
  const handleCopyPath = useCallback(async () => {
    if (!executorFolderPath) return;
    await navigator.clipboard.writeText(executorFolderPath);
    setPathCopied(true);
    setTimeout(() => setPathCopied(false), 2000);
  }, [executorFolderPath]);

  // Open folder in file manager
  const handleOpenFolder = useCallback(async () => {
    if (!executorFolderPath) return;
    try {
      await invoke("open_path", { path: executorFolderPath });
    } catch (err) {
      console.error("Failed to open folder:", err);
    }
  }, [executorFolderPath]);

  // Slash commands for executor chat
  const slashCommands = useMemo<SlashCommand[]>(() => [
    {
      id: "clear",
      name: t("chat.slashCommands.clear", "clear"),
      description: t("chat.slashCommands.clearDesc", "Clear conversation history"),
      icon: <Trash2 className="h-4 w-4" />,
    },
  ], [t]);

  // Handle slash command execution
  const handleSlashCommand = useCallback((command: SlashCommand) => {
    if (command.id === "clear") {
      clearMessages();
    }
  }, [clearMessages]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-orange-500/5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onNavigateBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-orange-500/20 text-orange-600 text-xs">
              {executor.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <h1 className="font-semibold">{executor.name}</h1>
            {/* Path with copy button */}
            {executorFolderPath && (
              <div className="flex items-center gap-1">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-xs text-muted-foreground truncate max-w-[200px] cursor-default">
                        {executorFolderPath.split("/").slice(-3).join("/")}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[400px]">
                      <code className="text-xs break-all">{executorFolderPath}</code>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={handleCopyPath}
                      >
                        {pathCopied ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {pathCopied ? t("common.copied") : t("common.copyPath")}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            )}
          </div>
          <Badge variant="outline" className="border-orange-500/30 text-orange-600">
            <Terminal className="h-3 w-3 mr-1" />
            {t("settingsAgents.executors")}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {/* Open folder button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleOpenFolder}
                  disabled={!executorFolderPath}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("settingsAgents.openFolder")}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Three Column Layout */}
      <div className="flex-1 flex min-h-0">
        {/* ================================================================
            LEFT COLUMN: CLAUDE.md Content (System Prompt) - Resizable
            ================================================================ */}
        <div
          className="relative flex flex-col shrink-0"
          style={{ width: leftPanelWidth }}
        >
          <div className="p-4 border-b">
            <h3 className="font-semibold text-sm">{t("settingsAgents.systemPrompt")}</h3>
            <p className="text-xs text-muted-foreground mt-1">CLAUDE.md</p>
          </div>
          <ResizeHandle side="left" onResize={handleLeftResize} />

          <ScrollArea className="flex-1">
            <div className="p-4">
              {claudeMdLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : claudeMdError ? (
                <div className="text-xs text-destructive">
                  {claudeMdError}
                </div>
              ) : claudeMdContent ? (
                <pre className="text-xs whitespace-pre-wrap font-mono text-muted-foreground bg-muted/30 p-3 rounded-lg">
                  {claudeMdContent}
                </pre>
              ) : (
                <div className="text-center py-8">
                  <FileText className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-xs text-muted-foreground">
                    {t("settingsAgents.noClaudeMd")}
                  </p>
                  <p className="text-[10px] text-muted-foreground/70 mt-1">
                    {t("settingsAgents.noClaudeMdHint")}
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* ================================================================
            MIDDLE COLUMN: Configuration & Capabilities
            ================================================================ */}
        <div className="flex-1 flex flex-col min-w-0 border-r">
          <div className="p-4 border-b">
            <h3 className="font-semibold text-sm">{t("settingsAgents.capabilities")}</h3>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-4 space-y-1">
              {/* Config Section */}
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

              {/* Capabilities Section */}
              <div className="mb-4">
                <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                  {t("settingsAgents.tools")}
                </h4>

                {/* MCP Section */}
                <CollapsibleSection
                  title="MCP"
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
                  <div className="py-2 space-y-2">
                    {mcpServers.length === 0 ? (
                      <>
                        <p className="text-xs text-muted-foreground">
                          {t("settingsAgents.noMcp")}
                        </p>
                        {executor.mcp_config_file && (
                          <code className="block text-[10px] bg-muted px-2 py-1 rounded font-mono break-all text-muted-foreground">
                            {executor.mcp_config_file}
                          </code>
                        )}
                      </>
                    ) : (
                      <div className="space-y-1">
                        {mcpServers.map((server) => (
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
                            {server.disabled && (
                              <Badge variant="secondary" className="text-[10px] px-1 py-0 shrink-0">
                                {t("common.disabled")}
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CollapsibleSection>

                {/* Skills Section */}
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
                  <div className="py-2 space-y-2">
                    {skills.length === 0 ? (
                      <>
                        <p className="text-xs text-muted-foreground">
                          {t("settingsAgents.noSkills")}
                        </p>
                        {executor.skills_config_file && (
                          <code className="block text-[10px] bg-muted px-2 py-1 rounded font-mono break-all text-muted-foreground">
                            {executor.skills_config_file}
                          </code>
                        )}
                      </>
                    ) : (
                      <div className="space-y-1">
                        {skills.map((skill) => (
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
                        ))}
                      </div>
                    )}
                  </div>
                </CollapsibleSection>

                {/* Prompts Section */}
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
                  <div className="py-2 space-y-2">
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
                      <div className="space-y-1">
                        {agentConfigs.map((config) => (
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
                        ))}
                      </div>
                    )}
                  </div>
                </CollapsibleSection>

                {/* Commands Section */}
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
                  <div className="py-2 space-y-2">
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
                      <div className="space-y-1">
                        {commands.map((command) => (
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
                        ))}
                      </div>
                    )}
                  </div>
                </CollapsibleSection>
              </div>

              {/* Info Section */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                  {t("common.overview")}
                </h4>

                <div className="p-3 rounded-xl bg-orange-500/5 border border-orange-500/20">
                  <p className="text-xs text-muted-foreground">
                    {t("settingsAgents.executorsDesc")}
                  </p>
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>

        {/* ================================================================
            RIGHT COLUMN: Chat Preview - Resizable
            ================================================================ */}
        <div
          className="relative flex flex-col bg-muted/30 shrink-0"
          style={{ width: rightPanelWidth }}
        >
          <ResizeHandle side="right" onResize={handleRightResize} />
          {/* Header with actions */}
          <div className="p-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-orange-500/20 text-orange-600 text-xs">
                  {executor.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-semibold text-sm">{executor.name}</h3>
                <p className="text-xs text-muted-foreground">{t("settingsAgents.previewDebug")}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={clearMessages}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t("settingsAgents.clearChat")}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>

          {/* Chat Messages */}
          <MessageList
            messages={messages}
            isStreaming={isStreaming}
            pendingPlan={pendingPlan}
            pendingQuestions={pendingQuestions}
            onApprovePlan={approvePlan}
            onRejectPlan={rejectPlan}
            onAnswerQuestions={answerQuestions}
            className="flex-1"
          />

          {/* Chat Input */}
          <div className="border-t border-border bg-background">
            <ChatInput
              onSend={sendMessage}
              onCancel={cancel}
              isLoading={isStreaming}
              disabled={phase === "awaiting_approval" || phase === "awaiting_input"}
              placeholder={
                phase === "awaiting_approval"
                  ? t("chat.waitingForApproval")
                  : phase === "awaiting_input"
                    ? t("chat.waitingForInput")
                    : t("settingsAgents.sendMessage")
              }
              autoFocus
              showTopToolbar
              showConfigBar
              showResizeHandle
              enableWritingMode
              hideAgentSelector
              hideModelSelector
              slashCommands={slashCommands}
              onSlashCommand={handleSlashCommand}
            />
            <p className="text-xs text-muted-foreground py-2 text-center">
              {t("settingsAgents.aiDisclaimer")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
