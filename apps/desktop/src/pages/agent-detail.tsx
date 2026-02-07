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
import { useState, useEffect, useCallback, useMemo } from "react";
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
  useVibenAgents,
  useVibenModels,
  useAgent,
  useCloudSkillPackages,
  useLocalWorkspaces,
} from "@/hooks";
import { homeDir } from "@tauri-apps/api/path";
import { MessageList, ChatInput } from "@/components/chat";
import { AgentMcpDialog, AgentSkillsDialog, AgentMemoryDialog } from "@/components/agent";
import {
  type BaseCodingAgent,
  AGENT_TYPES,
} from "@/types";
import { getGatewayClient, getAvailabilityStatus } from "@/lib/gateway";
import type { AvailabilityInfo } from "@/lib/gateway";
import { useAppStore } from "@/stores/app-store";

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

  const {
    agents,
    loading: agentsLoading,
    error: agentsError,
    updateAgent,
  } = useVibenAgents();

  const { models } = useVibenModels();
  const mcpServers = useAppStore((state) => state.mcpServers);
  const { packages: skillPackages } = useCloudSkillPackages();

  // Get workspace info for workspace-scoped agents
  const { workspaces } = useLocalWorkspaces();
  const workspace = isWorkspaceScoped
    ? workspaces.find((w) => w.id === workspaceId)
    : null;

  // Determine workdir: workspace path for workspace-scoped, ~/.viben for global
  const [globalVibenDir, setGlobalVibenDir] = useState<string>("");
  useEffect(() => {
    if (!isWorkspaceScoped) {
      homeDir().then((home) => {
        setGlobalVibenDir(`${home}.viben`);
      });
    }
  }, [isWorkspaceScoped]);

  // Find the current agent
  const agent = useMemo(
    () => agents.find((a) => a.id === agentId) || null,
    [agents, agentId]
  );

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

  // Dialog states
  const [mcpDialogOpen, setMcpDialogOpen] = useState(false);
  const [skillsDialogOpen, setSkillsDialogOpen] = useState(false);
  const [memoryDialogOpen, setMemoryDialogOpen] = useState(false);

  // MCP and Skills selection
  const [selectedMcpServers, setSelectedMcpServers] = useState<string[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);

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
      if (!grouped[model.provider]) {
        grouped[model.provider] = [];
      }
      grouped[model.provider].push(model);
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

  if (agentsLoading) {
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
          <div>
            <Input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="h-7 px-2 font-semibold border-none shadow-none focus-visible:ring-0"
              placeholder={t("settingsAgents.namePlaceholder")}
            />
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
            LEFT COLUMN: Persona
            ================================================================ */}
        <div className="w-72 border-r flex flex-col">
          <div className="p-4 border-b">
            <h3 className="font-semibold text-sm">{t("settingsAgents.persona")}</h3>
            <p className="text-xs text-muted-foreground mt-1">
              {t("settingsAgents.personaDesc")}
            </p>
          </div>

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
                            {providerModels.filter((m) => m.enabled).map((model) => (
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
            RIGHT COLUMN: Preview & Debug (reusing workspace chat components)
            ================================================================ */}
        <div className="w-80 flex flex-col bg-muted/30">
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
          <div className="border-t border-border bg-background p-4">
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
              variant="compact"
              autoFocus
            />
            <p className="text-xs text-muted-foreground mt-2 text-center">
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
