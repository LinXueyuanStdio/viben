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
  Send,
  PlusCircle,
  List,
  Info,
  Globe,
  FolderOpen,
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
import { useVibenAgents } from "@/hooks/use-viben-agents";
import { useVibenModels } from "@/hooks/use-viben-models";
import { useAgent } from "@/hooks/use-agent";
import {
  type BaseCodingAgent,
  AGENT_TYPES,
} from "@/types";
import { getGatewayClient, getAvailabilityStatus } from "@/lib/gateway";
import type { AvailabilityInfo } from "@/lib/gateway";

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

  // Debug chat state
  const [debugMessage, setDebugMessage] = useState("");

  // Load form from agent
  useEffect(() => {
    if (agent) {
      setFormName(agent.name);
      setFormDescription(agent.description || "");
      setFormSystemPrompt(agent.system_prompt || "");
      setFormTemperature(agent.temperature ?? 0.7);
      setFormMaxTokens(agent.max_tokens ?? 4096);
      setFormModel(agent.model || "");
      // TODO: Load executor type and config from agent
      setIsDirty(false);
    }
  }, [agent]);

  // Mark as dirty when form changes
  useEffect(() => {
    if (agent) {
      const hasChanges =
        formName !== agent.name ||
        formDescription !== (agent.description || "") ||
        formSystemPrompt !== (agent.system_prompt || "") ||
        formTemperature !== (agent.temperature ?? 0.7) ||
        formMaxTokens !== (agent.max_tokens ?? 4096) ||
        formModel !== (agent.model || "");
      setIsDirty(hasChanges);
    }
  }, [agent, formName, formDescription, formSystemPrompt, formTemperature, formMaxTokens, formModel]);

  // Save agent
  const handleSave = async () => {
    if (!agentId) return;
    setSaving(true);
    try {
      await updateAgent(agentId, {
        name: formName,
        description: formDescription || undefined,
        system_prompt: formSystemPrompt || undefined,
        temperature: formTemperature,
        max_tokens: formMaxTokens,
        model: formModel || undefined,
      });
      setIsDirty(false);
      setLastSaved(new Date());
    } catch (err) {
      console.error("Failed to save agent:", err);
    } finally {
      setSaving(false);
    }
  };

  // Check availability
  const checkAvailability = useCallback(async () => {
    setCheckingAvailability(true);
    try {
      const client = getGatewayClient();
      const result = await client.checkAvailability(formExecutorType);
      setAvailability(result);
    } catch {
      setAvailability({ type: "NOT_FOUND" });
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

  // Debug chat
  const {
    messages,
    isStreaming,
    sendMessage,
    clearMessages,
  } = useAgent("debug-workspace", {
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

  const handleSendDebugMessage = async () => {
    if (!debugMessage.trim() || isStreaming) return;
    const msg = debugMessage;
    setDebugMessage("");
    await sendMessage(msg);
  };

  if (agentsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Navigate back to appropriate location based on scope
  const handleNavigateBack = useCallback(() => {
    if (isWorkspaceScoped) {
      navigate(`/workspace/${workspaceId}/agents`);
    } else {
      navigate("/settings/agents");
    }
  }, [navigate, isWorkspaceScoped, workspaceId]);

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
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("settingsAgents.systemPrompt")}
                </Label>
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
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("settingsAgents.appendPrompt")}
                </Label>
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

                    {availability && (
                      <p className="text-xs text-muted-foreground">
                        {getAvailabilityStatus(availability).label}
                      </p>
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
                  badge={<Badge variant="secondary" className="text-xs">0</Badge>}
                  action={
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <Plus className="h-3 w-3" />
                    </Button>
                  }
                >
                  <p className="text-xs text-muted-foreground py-2">
                    {t("settingsAgents.noMcp")}
                  </p>
                </CollapsibleSection>

                <CollapsibleSection
                  title={t("settingsAgents.skills")}
                  icon={<Sparkles className="h-4 w-4" />}
                  badge={<Badge variant="secondary" className="text-xs">0</Badge>}
                  action={
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <Plus className="h-3 w-3" />
                    </Button>
                  }
                >
                  <p className="text-xs text-muted-foreground py-2">
                    {t("settingsAgents.noSkills")}
                  </p>
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
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
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
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
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
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
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
            RIGHT COLUMN: Preview & Debug
            ================================================================ */}
        <div className="w-80 flex flex-col bg-muted/30">
          {/* Header with actions */}
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-semibold text-sm">{t("settingsAgents.previewDebug")}</h3>
            <div className="flex items-center gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      onClick={clearMessages}
                    >
                      {t("settingsAgents.clear")}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("settingsAgents.clearChat")}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <List className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("settingsAgents.messages")}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
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

          {/* Agent Preview */}
          <div className="flex-1 flex flex-col p-4">
            {/* Avatar and name */}
            <div className="flex flex-col items-center mb-4">
              <Avatar className="h-16 w-16 mb-2">
                <AvatarFallback className="bg-primary/20 text-primary text-xl">
                  {formName.slice(0, 2).toUpperCase() || "AG"}
                </AvatarFallback>
              </Avatar>
              <h4 className="font-medium">{formName || t("settingsAgents.unnamed")}</h4>
              {formDescription && (
                <p className="text-xs text-muted-foreground text-center mt-1">
                  {formDescription}
                </p>
              )}
            </div>

            {/* Chat Messages */}
            <ScrollArea className="flex-1">
              <div className="space-y-3">
                {messages.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">
                    {t("settingsAgents.noMessages")}
                  </p>
                ) : (
                  messages.slice(-10).map((msg) => (
                    <div
                      key={msg.id}
                      className={cn(
                        "p-2.5 rounded-lg text-sm",
                        msg.type === "user"
                          ? "bg-primary text-primary-foreground ml-6"
                          : "bg-card border mr-6"
                      )}
                    >
                      {msg.content}
                    </div>
                  ))
                )}
                {isStreaming && (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("settingsAgents.thinking")}
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Chat Input */}
          <div className="p-4 border-t">
            <div className="relative">
              <Input
                value={debugMessage}
                onChange={(e) => setDebugMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendDebugMessage();
                  }
                }}
                placeholder={t("settingsAgents.sendMessage")}
                disabled={isStreaming}
                className="pr-20"
              />
              <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <PlusCircle className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleSendDebugMessage}
                  disabled={!debugMessage.trim() || isStreaming}
                >
                  {isStreaming ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              {t("settingsAgents.aiDisclaimer")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
