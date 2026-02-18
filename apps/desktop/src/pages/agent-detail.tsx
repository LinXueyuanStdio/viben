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
import { useDebounceFn } from "ahooks";
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
  useAgentConversation,
  useCloudSkillPackages,
  useLocalWorkspaces,
  useWorkspaceMcpServers,
  useWorkspaceSkills,
  useWorkspaceAgentConfigs,
  useWorkspaceCommands,
  useExecutors,
  useWorkspaceParam,
} from "@/hooks";
import { homeDir } from "@tauri-apps/api/path";
import { invoke } from "@tauri-apps/api/core";
import { MessageList, ChatInput, type SlashCommand, ExecutorCapabilities } from "@/components/chat";
import { AgentMcpDialog, AgentSkillsDialog, AgentMemoryDialog } from "@/components/agent";
import type { ExecutorType } from "@viben/core/shared";
import { getGatewayClient, getAvailabilityStatus } from "@/lib/gateway";
import type { AvailabilityInfo, AgentResponse } from "@/lib/gateway";
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
  const { agentId } = useParams<{ agentId: string }>();

  // Get workspace from query params (new routing) or path params (legacy routing)
  const { workspacePath, workspace, isGlobal } = useWorkspaceParam();
  const { isLoading: workspacesLoading } = useLocalWorkspaces();

  // Determine if this is a workspace-scoped agent
  const isWorkspaceScoped = !isGlobal;

  // Use Gateway API for all agents (global + workspace)
  // Note: "agents" are user-created configurations, "executors" are underlying AI tools
  const {
    loading: agentsLoading,
    error: agentsError,
    updateAgent,
    getWorkspaceAgents,
    getGlobalAgents,
  } = useAgents({ workspacePath: workspace?.path });

  // All agents from useAgents are user-created agents (not executors)
  // They may use different executor types (claude_code, cursor, etc.)
  const globalAgents = getGlobalAgents();
  const workspaceAgents = getWorkspaceAgents();
  const workspaceAgentsLoading = agentsLoading;

  // Workspace executors (auto-discovered from .claude, .cursor, etc.)
  // These are read-only executor configurations, not user-created agents
  // Use useExecutors with workspacePath (not workspaceId) per API convention
  const {
    executors: workspaceExecutorsRaw,
    loading: executorsLoading,
  } = useExecutors({ workspacePath: workspace?.path });

  // Transform ExecutorInfo to the format expected by ExecutorDetailView
  const workspaceExecutors = useMemo(() => {
    return workspaceExecutorsRaw.map((e) => ({
      id: e.type, // Use type as ID for matching URL param (e.g., "CLAUDE_CODE")
      workspace_id: workspace?.id || "",
      name: e.name,
      type: e.type,
      // Use workspace_config_path for workspace config (empty if none)
      config_path: e.workspace_config_path || "",
      global_config_path: e.global_config_path,
      mcp_config_file: null,
      skills_config_file: null,
    }));
  }, [workspaceExecutorsRaw, workspace?.id]);

  const { models } = useModels();
  const { executors: availableExecutors } = useExecutors();

  // Helper to get executor name by type (using Gateway API data)
  const getExecutorName = useCallback(
    (executorType: ExecutorType) => {
      const executor = availableExecutors.find((e) => e.type === executorType);
      return executor?.name || executorType;
    },
    [availableExecutors]
  );

  // List of executor types for Select dropdown (from Gateway API)
  const executorTypeOptions = useMemo(
    () =>
      availableExecutors.map((e) => ({
        id: e.type,
        name: e.name,
      })),
    [availableExecutors]
  );

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

  // Find the current agent (user-created) or executor (auto-discovered)
  // First try to find in global agents (from list - minimal info)
  const globalAgentInfo = useMemo(
    () => globalAgents.find((a) => a.id === agentId) || null,
    [globalAgents, agentId]
  );

  // Then try to find in workspace-scoped agents (from list - minimal info)
  const workspaceAgentInfo = useMemo(
    () => workspaceAgents.find((a) => a.id === agentId) || null,
    [workspaceAgents, agentId]
  );

  // Then try to find in workspace executors (auto-discovered, read-only)
  // Note: agentId from URL can be either:
  // 1. An executor type (e.g., "CLAUDE_CODE") - used by useAgentList
  // 2. An actual executor ID (UUID) - used by legacy useWorkspaceAgents
  // We need to search by both type and id to handle both cases
  const workspaceExecutor = useMemo(
    () => workspaceExecutors.find((a) => a.type === agentId || a.id === agentId) || null,
    [workspaceExecutors, agentId]
  );

  // Use workspace agent if found, otherwise fall back to global
  const agentInfo = workspaceAgentInfo || globalAgentInfo;

  // Full agent details (loaded from Gateway API)
  const [fullAgent, setFullAgent] = useState<AgentResponse | null>(null);
  const [loadingFullAgent, setLoadingFullAgent] = useState(false);

  // Load full agent details when agent ID changes
  // Skip loading if we already found a matching executor (executors don't need API loading)
  // We don't require agentInfo pre-check because:
  // 1. The agent list might not have loaded yet
  // 2. We want to try loading the agent directly from API
  useEffect(() => {
    if (!agentId) {
      setFullAgent(null);
      return;
    }

    // If we found a matching executor, don't try to load as agent
    // Note: workspaceExecutor is memoized, so this check is safe
    if (workspaceExecutor) {
      setFullAgent(null);
      setLoadingFullAgent(false);
      return;
    }

    const loadFullAgent = async () => {
      setLoadingFullAgent(true);
      try {
        const gateway = getGatewayClient();
        // Pass workspace path to find workspace-scoped agents
        const agentData = await gateway.getAgent(agentId, {
          workspacePath: workspace?.path,
        });
        setFullAgent(agentData);
      } catch (err) {
        console.error("Failed to load agent details:", err);
        setFullAgent(null);
      } finally {
        setLoadingFullAgent(false);
      }
    };

    loadFullAgent();
  }, [agentId, workspaceExecutor, workspace?.path]);

  // Determine if we're viewing an executor or an agent
  // If we found a matching executor AND no matching agent, it's an executor
  const isExecutor = Boolean(workspaceExecutor && !agentInfo && !fullAgent);
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
  const [formExecutorType, setFormExecutorType] = useState<ExecutorType>("CLAUDE_CODE");
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
      setFormExecutorType((agent.executor_type as ExecutorType) || "CLAUDE_CODE");
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

  // Form validation
  const validateForm = useCallback(() => {
    const errors: string[] = [];
    if (!formModel) errors.push(t("settingsAgents.modelRequired", "Model is required"));
    if (!formExecutorType) errors.push(t("settingsAgents.executorRequired", "Executor is required"));
    return { isValid: errors.length === 0, errors };
  }, [formModel, formExecutorType, t]);

  const { isValid: formIsValid, errors: validationErrors } = validateForm();

  // Save agent
  const handleSave = useCallback(async () => {
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
  }, [agentId, updateAgent, formName, formDescription, formSystemPrompt, formAppendPrompt, formTemperature, formMaxTokens, formModel, formExecutorType, formPlanMode, formApprovals, selectedMcpServers, selectedSkills]);

  // Debounced save with backpressure protection (using ahooks)
  // - wait: 300ms debounce delay
  // - leading: false - don't execute on first call
  // - trailing: true - execute after wait period
  const { run: debouncedSave, cancel: cancelDebouncedSave } = useDebounceFn(
    () => {
      if (formIsValid) {
        handleSave();
      }
    },
    { wait: 300, leading: false, trailing: true }
  );

  // Keyboard shortcut: Cmd+S to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (isDirty && !saving && formIsValid) {
          debouncedSave();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDirty, saving, formIsValid, debouncedSave]);

  // Cancel debounced save on unmount
  useEffect(() => {
    return () => cancelDebouncedSave();
  }, [cancelDebouncedSave]);

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
  } = useAgentConversation(debugWorkdir, {
    agentConfig: {
      name: formName || undefined,
      model: formModel || undefined,
      systemPrompt: formSystemPrompt || undefined,
      appendPrompt: formAppendPrompt || undefined,
      executorType: formExecutorType,
      planMode: formPlanMode,
      approvals: formApprovals,
      mcpServers: selectedMcpServers.length > 0 ? selectedMcpServers : undefined,
      skills: selectedSkills.length > 0 ? selectedSkills : undefined,
    },
  });

  // Navigate back to appropriate location based on scope
  // Must be before early returns to maintain hooks order
  const handleNavigateBack = useCallback(() => {
    if (isWorkspaceScoped && workspace) {
      navigate(`/workspace/${workspace.id}/agents`);
    } else {
      navigate("/settings/agents");
    }
  }, [navigate, isWorkspaceScoped, workspace]);

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
        workspacePath={workspacePath || ""}
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
            {getExecutorName(formExecutorType)}
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
          {/* Validation errors */}
          {!formIsValid && isDirty && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="destructive" className="text-xs gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {t("settingsAgents.validationError", "Validation failed")}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <ul className="text-xs space-y-1">
                    {validationErrors.map((error, i) => (
                      <li key={i}>{error}</li>
                    ))}
                  </ul>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
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
          <Button onClick={debouncedSave} disabled={saving || !isDirty || !formIsValid}>
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
                        {getExecutorName(formExecutorType)}
                      </Badge>
                    </div>
                  }
                >
                  <div className="space-y-3">
                    <Select
                      value={formExecutorType}
                      onValueChange={(v) => setFormExecutorType(v as ExecutorType)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {executorTypeOptions.map((type) => (
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
                  title={t("settingsAgents.mcpTitle", "MCP")}
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
                  title={t("settingsAgents.memoryFileTitle", "MEMORY.md")}
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
    global_config_path?: string;
    mcp_config_file: string | null;
    skills_config_file: string | null;
  };
  workspacePath: string;
  onNavigateBack: () => void;
}

// Get executor icon color based on type
function getExecutorColor(type: string) {
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    CLAUDE_CODE: { bg: "bg-amber-500/10", text: "text-amber-600", border: "border-amber-500/30" },
    CODEX: { bg: "bg-emerald-500/10", text: "text-emerald-600", border: "border-emerald-500/30" },
    GEMINI_CLI: { bg: "bg-blue-500/10", text: "text-blue-600", border: "border-blue-500/30" },
    AIDER: { bg: "bg-violet-500/10", text: "text-violet-600", border: "border-violet-500/30" },
  };
  return colors[type] || { bg: "bg-muted", text: "text-foreground", border: "border-border" };
}

function ExecutorDetailView({
  executor,
  workspacePath,
  onNavigateBack,
}: ExecutorDetailViewProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Navigate to skill detail page
  const handleSkillClick = (skillId: string) => {
    const params = new URLSearchParams();
    if (workspacePath) {
      params.set("workspace_path", workspacePath);
    }
    params.set("agent_id", executor.type);
    navigate(`/skill/${encodeURIComponent(skillId)}?${params.toString()}`);
  };

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

  // Chat functionality - use executor type directly (already uppercase)
  const executorTypeString = useMemo((): string => {
    // executor.type is already in uppercase format (CLAUDE_CODE, CODEX, etc.)
    if (executor.type === "CLAUDE_CODE") return "CLAUDE_CODE";
    if (executor.type === "CODEX") return "CODEX";
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
  } = useAgentConversation(workspacePath, {
    agentConfig: {
      executorType: executorTypeString,
      planMode: false,
      approvals: false,
    },
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

  // Get executor colors
  const executorColor = getExecutorColor(executor.type);

  // Determine config source
  const hasWorkspaceConfig = !!executor.config_path;
  const hasGlobalConfig = !!executor.global_config_path;
  const configSource = hasWorkspaceConfig && hasGlobalConfig
    ? "merged" as const
    : hasWorkspaceConfig
      ? "workspace" as const
      : "global" as const;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-muted/10">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onNavigateBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Avatar className="h-8 w-8">
            <AvatarFallback className={cn(executorColor.bg, executorColor.text, "text-xs")}>
              {executor.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h1 className="font-semibold">{executor.name}</h1>
              <Badge variant="secondary" className="text-xs font-mono">
                {executor.type}
              </Badge>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="text-xs gap-1">
                      {configSource === "workspace" ? (
                        <FolderOpen className="h-3 w-3" />
                      ) : configSource === "global" ? (
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
                    {configSource === "workspace"
                      ? t("settingsAgents.workspaceConfig")
                      : configSource === "global"
                        ? t("settingsAgents.globalConfig")
                        : t("settingsAgents.mergedConfig")}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
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
          <Badge variant="outline" className={cn("text-xs", executorColor.border, executorColor.text)}>
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
              {/* Config Section - show if any config path exists */}
              {(executor.config_path?.trim() || executor.global_config_path?.trim()) && (
                <div className="mb-4">
                  <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                    {t("workspace.configuration")}
                  </h4>

                  {/* Workspace Config */}
                  {executor.config_path?.trim() && (
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
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 shrink-0"
                                  onClick={handleOpenFolder}
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>{t("common.openInExplorer")}</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                    </CollapsibleSection>
                  )}

                  {/* Global Config */}
                  {executor.global_config_path?.trim() && (
                    <CollapsibleSection
                      title={t("settingsAgents.globalConfig")}
                      icon={<Globe className="h-4 w-4" />}
                      defaultOpen={!executor.config_path?.trim()}
                    >
                      <div className="py-2">
                        <div className="flex items-center gap-2">
                          <code className="flex-1 text-xs bg-muted px-2 py-1.5 rounded font-mono break-all">
                            {executor.global_config_path}
                          </code>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 shrink-0"
                                  onClick={async () => {
                                    try {
                                      const dir = executor.global_config_path!.replace(/\/[^/]+$/, "");
                                      await invoke("open_path", { path: dir });
                                    } catch (err) {
                                      console.error("Failed to open folder:", err);
                                    }
                                  }}
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>{t("common.openInExplorer")}</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                    </CollapsibleSection>
                  )}
                </div>
              )}

              {/* Capabilities Section - using reusable component */}
              <ExecutorCapabilities
                executorType={executor.type}
                workspacePath={workspacePath}
                className="mb-4"
                sectionHeaderText={t("settingsAgents.tools")}
              />

              {/* Info Section */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                  {t("common.overview")}
                </h4>

                <div className="p-3 rounded-xl bg-muted/50 border">
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
                <AvatarFallback className={cn(executorColor.bg, executorColor.text, "text-xs")}>
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
