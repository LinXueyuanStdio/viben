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
  Globe,
  FolderOpen,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
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
  const getExecutorName = useCallback(
    (executorType: ExecutorType) => {
      const executor = availableExecutors.find((e) => e.type === executorType);
      return executor?.name || executorType;
    },
    [availableExecutors]
  );

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
        model: formModel || undefined,
        executor_type: formExecutorType,
        plan_mode: formPlanMode,
        approvals: formApprovals,
        mcp_servers: selectedMcpServers,
        skills: selectedSkills,
        is_template: formIsTemplate,
        template_description: formTemplateDescription || undefined,
        template_tags: formTemplateTags.length > 0 ? formTemplateTags : undefined,
        custom_variables: formCustomVariables.length > 0
          ? formCustomVariables.map(v => ({
              name: v.name,
              default_value: v.defaultValue,
              description: v.description,
            }))
          : undefined,
        env_variables: formEnvVariables.length > 0 ? formEnvVariables : undefined,
      });
      setIsDirty(false);
      setLastSaved(new Date());
    } catch (err) {
      console.error("Failed to save agent:", err);
    } finally {
      setSaving(false);
    }
  }, [
    agentId,
    updateAgent,
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

  // Debounced save
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

  // Fetch trace data when traceId changes
  useEffect(() => {
    if (!conversationTraceId) {
      setTraceTree(null);
      return;
    }

    const fetchTrace = async () => {
      setIsLoadingTrace(true);
      try {
        const client = getGatewayClient();
        const response = await client.getTrace(conversationTraceId);
        if (response.tree) {
          setTraceTree(response.tree);
        }
      } catch (error) {
        console.error("[agent-detail] Failed to fetch trace:", error);
        setTraceTree(null);
      } finally {
        setIsLoadingTrace(false);
      }
    };

    // Add a small delay to let the trace data be written to disk
    const timer = setTimeout(fetchTrace, 500);
    return () => clearTimeout(timer);
  }, [conversationTraceId]);

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
            <span className="font-semibold text-sm">{formName || t("settingsAgents.unnamed")}</span>
            {formDescription && (
              <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                {formDescription}
              </span>
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

      {/* Tab Layout */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "debug" | "settings")}
        className="flex-1 flex flex-col min-h-0"
      >
        <div className="px-4 border-b">
          <TabsList>
            <TabsTrigger value="debug">
              {t("agentDetail.debugTab", "Debug")}
            </TabsTrigger>
            <TabsTrigger value="settings">
              {t("agentDetail.settingsTab", "Settings")}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Debug Tab */}
        <TabsContent value="debug" className="flex-1 min-h-0 mt-0">
          <AgentDebugTab
            agentId={agentId || ""}
            agentPath={agentFolderPath}
            sessionId={sessionId ?? undefined}
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
