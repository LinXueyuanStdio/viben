/**
 * Agent Detail Page - Agent Configuration Editor
 *
 * Two-tab layout for agent configuration:
 * - Debug Tab: Conversation area with trace visualization
 * - Settings Tab: Overview and configuration panels
 *
 * Supports both global and workspace-scoped agents:
 * - Global: /agents/:agentId
 * - Workspace: /workspace/:workspaceId/agent/:agentId
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useDebounceFn } from "ahooks";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Save,
  Loader2,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTranslation } from "react-i18next";
import { filterModelsByExecutor } from "@/lib/executor-constraints";
import {
  useAgents,
  useModels,
  useAgentConversation,
  useLocalWorkspaces,
  useExecutors,
  useWorkspaceParam,
} from "@/hooks";
import {
  AgentMcpDialog,
  AgentSkillsDialog,
  AgentMemoryDialog,
  AgentDebugTab,
  AgentSettingsTab,
} from "@/components/agent";
import type { CustomVariable } from "@/components/agent";
import type { ExecutorType } from "@viben/core/shared";
import { getGatewayClient } from "@/lib/gateway";
import type { AvailabilityInfo, AgentResponse } from "@/lib/gateway";
import type { TraceSpanNode, TraceTree } from "@/components/observability";
import type { AgentMessage } from "@/types";
import { toast } from "@/hooks/use-toast";
import { uiMessageToAgentMessage } from "./utils";

// ============================================================================
// Main Component
// ============================================================================

export function AgentDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { agentId, workspaceId } = useParams<{ agentId: string; workspaceId?: string }>();

  // Get workspace from query params (new routing) or path params (legacy routing)
  const { workspacePath, workspace, isGlobal } = useWorkspaceParam({ workspaceId });
  const { isLoading: workspacesLoading } = useLocalWorkspaces();

  // Determine if this is a workspace-scoped agent
  const isWorkspaceScoped = !isGlobal;

  // Use Gateway API for all agents (global + workspace)
  const {
    loading: agentsLoading,
    error: agentsError,
    updateAgent,
  } = useAgents({ workspacePath: workspace?.path });

  const { models } = useModels();
  const { executors: availableExecutors } = useExecutors();

  // Helper to get executor name by type (using Gateway API data)
  const _getExecutorName = useCallback(
    (executorType: ExecutorType) => {
      const executor = availableExecutors.find((e) => e.type === executorType);
      return executor?.name || executorType;
    },
    [availableExecutors]
  );
  void _getExecutorName; // Reserved for future use

  // Determine workdir: workspace path for workspace-scoped, ~/.viben for global
  const [globalVibenDir, setGlobalVibenDir] = useState<string>("");
  useEffect(() => {
    if (!isWorkspaceScoped) {
      getGatewayClient().getSystemInfo().then((info) => {
        setGlobalVibenDir(info.viben_dir);
      }).catch(() => {
        // Fallback to default path
        setGlobalVibenDir("~/.viben");
      });
    }
  }, [isWorkspaceScoped]);

  // Full agent details (loaded from Gateway API)
  const [fullAgent, setFullAgent] = useState<AgentResponse | null>(null);
  const [loadingFullAgent, setLoadingFullAgent] = useState(false);

  // Load full agent details when agent ID changes
  useEffect(() => {
    if (!agentId) {
      setFullAgent(null);
      return;
    }

    const loadFullAgent = async () => {
      setLoadingFullAgent(true);
      try {
        const gateway = getGatewayClient();
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
  }, [agentId, workspace?.path]);

  // Map VibenAgentResponse to expected agent interface with backwards-compatible fields
  const agent = useMemo(() => {
    if (!fullAgent) return null;
    return {
      ...fullAgent,
      // Use agent_dir from API (agent directory path)
      path: fullAgent.agent_dir,
      // Use config_path from API (full path to AGENTS.md)
      configPath: fullAgent.config_path,
    };
  }, [fullAgent]);

  // ============================================================================
  // Form state
  // ============================================================================

  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formSystemPrompt, setFormSystemPrompt] = useState("");
  const [formAppendPrompt, setFormAppendPrompt] = useState("");
  const [formTemperature, setFormTemperature] = useState(0.7);
  const [formModel, setFormModel] = useState("");
  const [formExecutorType, setFormExecutorType] = useState<ExecutorType>("CLAUDE_CODE");
  const [formPlanMode, setFormPlanMode] = useState(false);
  const [formApprovals, setFormApprovals] = useState(false);

  // Template settings
  const [formIsTemplate, setFormIsTemplate] = useState(false);
  const [formTemplateDescription, setFormTemplateDescription] = useState("");
  const [formTemplateTags, setFormTemplateTags] = useState<string[]>([]);

  // Variables
  const [formCustomVariables, setFormCustomVariables] = useState<CustomVariable[]>([]);
  const [formEnvVariables, setFormEnvVariables] = useState<string[]>([]);

  // State
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [availability, setAvailability] = useState<AvailabilityInfo | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<"debug" | "settings">("debug");

  // Dialog states
  const [mcpDialogOpen, setMcpDialogOpen] = useState(false);
  const [skillsDialogOpen, setSkillsDialogOpen] = useState(false);
  const [memoryDialogOpen, setMemoryDialogOpen] = useState(false);

  // MCP and Skills selection
  const [selectedMcpServers, setSelectedMcpServers] = useState<string[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);

  // Trace visualization state
  const [traceTree, setTraceTree] = useState<TraceTree | null>(null);
  const [selectedSpan, setSelectedSpan] = useState<TraceSpanNode | null>(null);
  const [isLoadingTrace, setIsLoadingTrace] = useState(false);

  // Session management state
  const [debugSessions, setDebugSessions] = useState<Array<{
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    messageCount?: number;
  }>>([]);
  const [isLoadingDebugSessions, setIsLoadingDebugSessions] = useState(false);

  // Get agent folder path
  const agentFolderPath = useMemo(() => {
    if (agent?.path) {
      return agent.path;
    }
    if (isWorkspaceScoped && workspace) {
      return `${workspace.path}/.viben/agents/${agentId}`;
    }
    return globalVibenDir ? `${globalVibenDir}/agents/${agentId}` : "";
  }, [agent?.path, isWorkspaceScoped, workspace, globalVibenDir, agentId]);

  // Get config file path (from API if available, otherwise derive from folder path)
  const configPath = useMemo(() => {
    if (agent?.configPath) {
      return agent.configPath;
    }
    if (agentFolderPath) {
      return `${agentFolderPath}/AGENTS.md`;
    }
    return "";
  }, [agent?.configPath, agentFolderPath]);

  // Copy path to clipboard
  const handleCopyPath = useCallback(async (path: string) => {
    if (!path) return;
    await navigator.clipboard.writeText(path);
  }, []);

  // Open folder in file manager
  const handleOpenFolder = useCallback(async () => {
    if (!agentFolderPath) return;
    try {
      const client = getGatewayClient();
      await client.revealFile(agentFolderPath);
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
      setFormModel(agent.model || "");
      setFormExecutorType((agent.executor_type as ExecutorType) || "CLAUDE_CODE");
      setFormPlanMode(agent.plan_mode ?? false);
      setFormApprovals(agent.approvals ?? false);
      setSelectedMcpServers(agent.mcp_servers || []);
      setSelectedSkills(agent.skills || []);
      setFormIsTemplate(agent.is_template ?? false);
      setFormTemplateDescription(agent.template_description || "");
      setFormTemplateTags(agent.template_tags || []);
      setFormCustomVariables(
        agent.custom_variables?.map(v => ({
          name: v.name,
          defaultValue: v.default_value,
          description: v.description,
        })) || []
      );
      setFormEnvVariables(agent.env_variables || []);
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
        formModel !== (agent.model || "") ||
        formExecutorType !== (agent.executor_type || "CLAUDE_CODE") ||
        formPlanMode !== (agent.plan_mode ?? false) ||
        formApprovals !== (agent.approvals ?? false) ||
        JSON.stringify(selectedMcpServers) !== JSON.stringify(agent.mcp_servers || []) ||
        JSON.stringify(selectedSkills) !== JSON.stringify(agent.skills || []) ||
        formIsTemplate !== (agent.is_template ?? false) ||
        formTemplateDescription !== (agent.template_description || "") ||
        JSON.stringify(formTemplateTags) !== JSON.stringify(agent.template_tags || []) ||
        JSON.stringify(formCustomVariables) !== JSON.stringify(
          agent.custom_variables?.map(v => ({
            name: v.name,
            defaultValue: v.default_value,
            description: v.description,
          })) || []
        ) ||
        JSON.stringify(formEnvVariables) !== JSON.stringify(agent.env_variables || []);
      setIsDirty(hasChanges);
    }
  }, [
    agent,
    formName,
    formDescription,
    formSystemPrompt,
    formAppendPrompt,
    formTemperature,
    formModel,
    formExecutorType,
    formPlanMode,
    formApprovals,
    selectedMcpServers,
    selectedSkills,
    formIsTemplate,
    formTemplateDescription,
    formTemplateTags,
    formCustomVariables,
    formEnvVariables,
  ]);

  // Form validation
  const validateForm = useCallback(() => {
    const errors: string[] = [];
    if (!formModel) errors.push(t("settingsAgents.modelRequired", "Model is required"));
    if (!formExecutorType) errors.push(t("settingsAgents.executorRequired", "Executor is required"));
    return { isValid: errors.length === 0, errors };
  }, [formModel, formExecutorType, t]);

  const { isValid: formIsValid, errors: validationErrors } = validateForm();

  // Save agent with toast feedback
  const handleSave = useCallback(async () => {
    if (!agentId) return;

    // Validate form first
    const { isValid, errors } = validateForm();
    if (!isValid) {
      toast.error(t("settingsAgents.validationError", "Validation failed"), {
        description: errors.join(", "),
      });
      return;
    }

    setSaving(true);
    try {
      // Build update payload, excluding undefined values to avoid YAML serialization errors
      const updatePayload: Parameters<typeof updateAgent>[1] = {
        name: formName,
        temperature: formTemperature,
        executor_type: formExecutorType,
        plan_mode: formPlanMode,
        approvals: formApprovals,
        mcp_servers: selectedMcpServers,
        skills: selectedSkills,
        is_template: formIsTemplate,
      };

      // Only include optional fields if they have values
      if (formDescription) updatePayload.description = formDescription;
      if (formSystemPrompt) updatePayload.system_prompt = formSystemPrompt;
      if (formAppendPrompt) updatePayload.append_prompt = formAppendPrompt;
      if (formModel) updatePayload.model = formModel;
      if (formTemplateDescription) updatePayload.template_description = formTemplateDescription;
      if (formTemplateTags.length > 0) updatePayload.template_tags = formTemplateTags;
      if (formEnvVariables.length > 0) updatePayload.env_variables = formEnvVariables;

      // Handle custom variables - filter out undefined values in each variable
      if (formCustomVariables.length > 0) {
        updatePayload.custom_variables = formCustomVariables.map(v => {
          const variable: { name: string; default_value?: string; description?: string } = {
            name: v.name,
          };
          if (v.defaultValue) variable.default_value = v.defaultValue;
          if (v.description) variable.description = v.description;
          return variable;
        });
      }

      // Debug: log the payload to find undefined values
      console.log("[agent-detail] Save payload:", JSON.stringify(updatePayload, (_key, value) => {
        if (value === undefined) return `__UNDEFINED__`;
        return value;
      }, 2));

      // Also check each field individually
      console.log("[agent-detail] Field check:", {
        name: formName,
        temperature: formTemperature,
        executor_type: formExecutorType,
        plan_mode: formPlanMode,
        approvals: formApprovals,
        mcp_servers: selectedMcpServers,
        skills: selectedSkills,
        is_template: formIsTemplate,
        formDescription,
        formSystemPrompt,
        formAppendPrompt,
        formModel,
        formTemplateDescription,
        formTemplateTags,
        formEnvVariables,
        formCustomVariables,
      });

      await updateAgent(agentId, updatePayload);
      setIsDirty(false);
      setLastSaved(new Date());
      toast.success(t("settingsAgents.saveSuccess", "Agent saved successfully"));
    } catch (err) {
      console.error("Failed to save agent:", err);
      toast.error(t("settingsAgents.saveFailed", "Failed to save agent"), {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSaving(false);
    }
  }, [
    agentId,
    updateAgent,
    validateForm,
    t,
    formName,
    formDescription,
    formSystemPrompt,
    formAppendPrompt,
    formTemperature,
    formModel,
    formExecutorType,
    formPlanMode,
    formApprovals,
    selectedMcpServers,
    selectedSkills,
    formIsTemplate,
    formTemplateDescription,
    formTemplateTags,
    formCustomVariables,
    formEnvVariables,
  ]);

  // Debounced save for keyboard shortcut (Cmd+S) to avoid multiple rapid saves
  const { run: debouncedSave, cancel: cancelDebouncedSave } = useDebounceFn(
    handleSave,
    { wait: 300, leading: true, trailing: false }
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

  // Check availability
  const checkAvailability = useCallback(async () => {
    setCheckingAvailability(true);
    try {
      const client = getGatewayClient();
      const isConnected = await client.ping();

      if (!isConnected) {
        setAvailability(null);
        return;
      }

      const result = await client.checkAvailability(formExecutorType);
      setAvailability(result);
    } catch {
      setAvailability(null);
    } finally {
      setCheckingAvailability(false);
    }
  }, [formExecutorType]);

  // Filter models by executor type constraints, then map to ModelOption format
  const modelOptions = useMemo(() => {
    const filteredModels = filterModelsByExecutor(models, formExecutorType);
    return filteredModels
      .filter(m => m.is_available)
      .map(m => ({
        id: m.id,
        name: m.name,
        provider: m.provider_id,
      }));
  }, [models, formExecutorType]);

  // Executor options
  const executorOptions = useMemo(
    () =>
      availableExecutors.map((e) => ({
        id: e.type as ExecutorType,
        name: e.name,
        description: e.description,
      })),
    [availableExecutors]
  );

  // Debug chat
  const debugWorkdir = isWorkspaceScoped
    ? workspace?.path || ""
    : globalVibenDir;

  const {
    messages,
    isStreaming,
    pendingPlan,
    pendingQuestions,
    sendMessage,
    approvePlan,
    rejectPlan,
    answerQuestions,
    cancel,
    clearMessages,
    loadMessages,
    sessionId,
    traceId: conversationTraceId,
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

  // Fetch trace data after stream completes
  // Trace data is only flushed to disk AFTER spans end, so we need to:
  // 1. Wait for stream to complete (isStreaming becomes false)
  // 2. Retry a few times since there's a flush delay
  useEffect(() => {
    // Only fetch when we have a traceId AND streaming has stopped
    if (!conversationTraceId || isStreaming) {
      return;
    }

    let cancelled = false;
    let retryCount = 0;
    const maxRetries = 10;
    const retryDelay = 1000; // 1 second between retries

    const fetchTrace = async (): Promise<boolean> => {
      if (cancelled) return false;

      console.log("[agent-detail] Fetching trace for ID:", conversationTraceId, "attempt:", retryCount + 1);
      try {
        const client = getGatewayClient();
        const response = await client.getTrace(conversationTraceId);
        console.log("[agent-detail] Trace response:", response);
        if (response.tree && !cancelled) {
          setTraceTree(response.tree);
          return true;
        }
      } catch (error) {
        // File not found is expected - trace hasn't been flushed yet
        const isNotFound = error instanceof Error && error.message.includes("not found");
        if (!isNotFound) {
          console.error("[agent-detail] Failed to fetch trace:", error);
        } else {
          console.log("[agent-detail] Trace file not ready yet, will retry...");
        }
      }
      return false;
    };

    const fetchWithRetry = async () => {
      setIsLoadingTrace(true);

      while (retryCount < maxRetries && !cancelled) {
        const success = await fetchTrace();
        if (success || cancelled) break;

        retryCount++;
        if (retryCount < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }

      if (!cancelled) {
        setIsLoadingTrace(false);
        if (retryCount >= maxRetries) {
          console.warn("[agent-detail] Failed to fetch trace after", maxRetries, "attempts");
        }
      }
    };

    // Start fetching after a small initial delay
    const timer = setTimeout(fetchWithRetry, 500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [conversationTraceId, isStreaming]);

  // Navigate back to appropriate location based on scope
  const handleNavigateBack = useCallback(() => {
    if (isWorkspaceScoped && workspace) {
      navigate(`/workspace/${workspace.id}/agents`);
    } else {
      navigate("/settings/agents");
    }
  }, [navigate, isWorkspaceScoped, workspace]);

  // Handle span selection for trace visualization
  const handleSelectSpan = useCallback((span: TraceSpanNode | null) => {
    setSelectedSpan(span);
  }, []);

  // Handle manual refresh of trace data
  const handleRefreshTrace = useCallback(async () => {
    if (!conversationTraceId) return;

    setIsLoadingTrace(true);
    console.log("[agent-detail] Manual refresh trace for ID:", conversationTraceId);
    try {
      const client = getGatewayClient();
      const response = await client.getTrace(conversationTraceId);
      console.log("[agent-detail] Manual refresh trace response:", response);
      if (response.tree) {
        setTraceTree(response.tree);
      }
    } catch (error) {
      console.error("[agent-detail] Manual refresh trace failed:", error);
    } finally {
      setIsLoadingTrace(false);
    }
  }, [conversationTraceId]);

  // Load debug sessions for this agent
  const loadDebugSessions = useCallback(async () => {
    if (!agentId) return;
    setIsLoadingDebugSessions(true);
    try {
      const client = getGatewayClient();
      const sessions = await client.listAgentSessions(agentId, debugWorkdir);
      setDebugSessions(
        sessions.map((s) => ({
          id: s.id,
          name: s.prompt || `Session ${s.id.slice(0, 8)}`,
          createdAt: s.created_at,
          updatedAt: s.updated_at,
          messageCount: 0,
        }))
      );
    } catch (error) {
      console.error("[agent-detail] Failed to load debug sessions:", error);
    } finally {
      setIsLoadingDebugSessions(false);
    }
  }, [agentId, debugWorkdir]);

  // Load sessions when agent changes
  useEffect(() => {
    loadDebugSessions();
  }, [loadDebugSessions]);

  // Session management handlers
  const handleSelectDebugSession = useCallback(async (session: { id: string }) => {
    if (!agentId) return;
    try {
      // Fetch session UI messages from gateway
      const client = getGatewayClient();
      const uiMessages = await client.listSessionUIMessages(agentId, session.id, debugWorkdir);
      // Convert UIMessage[] to AgentMessage[] using the proper converter
      const agentMessages = uiMessages
        .map(uiMessageToAgentMessage)
        .filter((msg): msg is AgentMessage => msg !== null);
      loadMessages(agentMessages, session.id);
    } catch (error) {
      console.error("[agent-detail] Failed to load session messages:", error);
    }
  }, [agentId, debugWorkdir, loadMessages]);

  const handleCreateDebugSession = useCallback(() => {
    clearMessages();
  }, [clearMessages]);

  const handleRenameDebugSession = useCallback(async (sessionIdToRename: string, newName: string) => {
    if (!agentId) return;
    try {
      const client = getGatewayClient();
      await client.updateSession(agentId, sessionIdToRename, {
        metadata: { name: newName },
      });
      // Reload sessions to reflect the change
      loadDebugSessions();
      toast.success(t("errors.sessions.renamed", "Session renamed"));
    } catch (error) {
      console.error("[agent-detail] Failed to rename session:", error);
      toast.error(t("errors.sessions.renameFailed", "Failed to rename session"));
    }
  }, [agentId, loadDebugSessions, t]);

  const handleDeleteDebugSession = useCallback(async (sessionIdToDelete: string) => {
    if (!agentId) return;
    try {
      const client = getGatewayClient();
      await client.deleteAgentSession(agentId, sessionIdToDelete);
      // Reload sessions to reflect the change
      loadDebugSessions();
      // If the deleted session is the current one, clear messages
      if (sessionIdToDelete === sessionId) {
        clearMessages();
      }
      toast.success(t("errors.sessions.deleted", "Session deleted"));
    } catch (error) {
      console.error("[agent-detail] Failed to delete session:", error);
      toast.error(t("errors.sessions.deleteFailed", "Failed to delete session"));
    }
  }, [agentId, sessionId, loadDebugSessions, clearMessages, t]);

  const handleOpenSessionFolder = useCallback(async () => {
    console.log("[agent-detail] handleOpenSessionFolder called", { agentFolderPath, sessionId, agentId });
    if (!agentFolderPath) {
      console.warn("[agent-detail] agentFolderPath is empty, cannot open folder");
      toast.error(t("common.openFolderFailed", "Failed to open folder"), {
        description: t("common.agentPathNotAvailable", "Agent path is not available yet"),
      });
      return;
    }
    try {
      const client = getGatewayClient();
      // If there's an active session, open its folder; otherwise open the agent's sessions directory
      const folderPath = sessionId
        ? `${agentFolderPath}/sessions/${sessionId}`
        : `${agentFolderPath}/sessions`;
      console.log("[agent-detail] Opening session folder:", folderPath);
      await client.revealFile(folderPath);
    } catch (error) {
      console.error("[agent-detail] Failed to open session folder:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error(t("common.openFolderFailed", "Failed to open folder"), {
        description: errorMessage,
      });
    }
  }, [sessionId, agentFolderPath, agentId, t]);

  // ============================================================================
  // Loading and Error States
  // ============================================================================

  if (workspacesLoading || agentsLoading || loadingFullAgent) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
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

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="h-full flex flex-col">
      {/* Header with Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "debug" | "settings")}
        className="flex-1 flex flex-col min-h-0"
      >
        <div className="flex items-center justify-between px-4 border-b h-14">
          {/* Left side: Back button + Tabs */}
          <div className="flex items-center gap-2 h-full">
            <Button variant="ghost" size="icon" onClick={handleNavigateBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <TabsList className="h-full border-b-0">
              <TabsTrigger value="debug" className="h-full rounded-none">
                {t("agentDetail.debugTab", "Debug")}
              </TabsTrigger>
              <TabsTrigger value="settings" className="h-full rounded-none">
                {t("agentDetail.settingsTab", "Settings")}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Right side: Status + Actions */}
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
            <Button
              onClick={handleSave}
              disabled={saving || !isDirty}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {saving ? t("common.saving", "Saving...") : t("common.save")}
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

        {/* Debug Tab */}
        <TabsContent value="debug" className="flex-1 min-h-0 mt-0">
          <AgentDebugTab
            agentId={agentId || ""}
            agentName={formName}
            agentConfigPath={configPath}
            sessionId={sessionId ?? undefined}
            sessions={debugSessions}
            isLoadingSessions={isLoadingDebugSessions}
            onSelectSession={handleSelectDebugSession}
            onCreateSession={handleCreateDebugSession}
            onRefreshSessions={loadDebugSessions}
            onRenameSession={handleRenameDebugSession}
            onDeleteSession={handleDeleteDebugSession}
            onOpenSessionFolder={handleOpenSessionFolder}
            onClearMessages={clearMessages}
            messages={messages}
            onSendMessage={sendMessage}
            isStreaming={isStreaming}
            pendingPlan={pendingPlan}
            pendingQuestions={pendingQuestions}
            onApprovePlan={approvePlan}
            onRejectPlan={rejectPlan}
            onAnswerQuestions={answerQuestions}
            onCancel={cancel}
            traceId={conversationTraceId ?? undefined}
            traceTree={traceTree}
            selectedSpan={selectedSpan}
            onSelectSpan={handleSelectSpan}
            isLoadingTrace={isLoadingTrace}
            onRefreshTrace={handleRefreshTrace}
            className="h-full"
          />
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="flex-1 min-h-0 mt-0">
          <AgentSettingsTab
            // Overview panel props
            name={formName}
            description={formDescription}
            isTemplate={formIsTemplate}
            templateDescription={formTemplateDescription}
            templateTags={formTemplateTags}
            agentDir={agentFolderPath}
            configPath={configPath}
            isWorkspaceScoped={isWorkspaceScoped}
            onNameChange={setFormName}
            onDescriptionChange={setFormDescription}
            onIsTemplateChange={setFormIsTemplate}
            onTemplateDescriptionChange={setFormTemplateDescription}
            onTemplateTagsChange={setFormTemplateTags}
            onOpenFolder={handleOpenFolder}
            onCopyPath={handleCopyPath}
            // Config panel props
            systemPrompt={formSystemPrompt}
            appendPrompt={formAppendPrompt}
            model={formModel}
            temperature={formTemperature}
            executorType={formExecutorType}
            planMode={formPlanMode}
            approvals={formApprovals}
            models={modelOptions}
            executors={executorOptions}
            selectedMcpServers={selectedMcpServers}
            selectedSkills={selectedSkills}
            customVariables={formCustomVariables}
            envVariables={formEnvVariables}
            workspaceName={workspace?.name || ""}
            workspacePath={workspacePath || ""}
            onSystemPromptChange={setFormSystemPrompt}
            onAppendPromptChange={setFormAppendPrompt}
            onModelChange={setFormModel}
            onTemperatureChange={setFormTemperature}
            onExecutorTypeChange={setFormExecutorType}
            onPlanModeChange={setFormPlanMode}
            onApprovalsChange={setFormApprovals}
            onCheckAvailability={checkAvailability}
            availability={availability}
            checkingAvailability={checkingAvailability}
            onConfigureMcp={() => setMcpDialogOpen(true)}
            onConfigureSkills={() => setSkillsDialogOpen(true)}
            onEditMemory={() => setMemoryDialogOpen(true)}
            onViewTodayLog={() => setMemoryDialogOpen(true)}
            onViewYesterdayLog={() => setMemoryDialogOpen(true)}
            onCustomVariablesChange={setFormCustomVariables}
            onEnvVariablesChange={setFormEnvVariables}
            className="h-full"
          />
        </TabsContent>
      </Tabs>

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
