/**
 * Settings Agents Page
 *
 * Three-column layout for AI agent configuration:
 * - Left: Agent list / Profile settings
 * - Middle: Configuration (collapsible sections)
 * - Right: Preview & Debug chat
 */
import { useState, useMemo, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Plus,
  Trash2,
  Star,
  Loader2,
  RefreshCw,
  AlertCircle,
  Bot,
  FileText,
  ChevronRight,
  ChevronDown,
  Cpu,
  CheckCircle2,
  XCircle,
  Sparkles,
  Settings2,
  Brain,
  MessageSquare,
  Database,
  Workflow,
  Image,
  Send,
  Mic,
  PlusCircle,
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import {
  useVibenAgents,
  type CreateAgentOptions,
} from "@/hooks/use-viben-agents";
import { useVibenProviders } from "@/hooks/use-viben-providers";
import { useVibenModels } from "@/hooks/use-viben-models";
import { useAgent } from "@/hooks/use-agent";
import {
  type BaseCodingAgent,
  type ClaudeCodeConfig,
  AGENT_TYPES,
  getDefaultConfig,
} from "@/types";
import { getGatewayClient, getAvailabilityStatus } from "@/lib/gateway";
import type { AvailabilityInfo } from "@/lib/gateway";

// ============================================================================
// Animation Variants
// ============================================================================

const prefersReducedMotion =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const easeOutExpo = [0.16, 1, 0.3, 1] as const;

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: prefersReducedMotion ? 0 : 0.05,
      delayChildren: prefersReducedMotion ? 0 : 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: prefersReducedMotion ? 0 : 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: prefersReducedMotion ? 0 : 0.3, ease: easeOutExpo },
  },
};

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
            <span
              className="ml-auto"
              onClick={(e) => e.stopPropagation()}
            >
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
// Agent Templates
// ============================================================================

interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
}

const AGENT_TEMPLATES: AgentTemplate[] = [
  {
    id: "general",
    name: "通用结构",
    description: "适用于多种场景的提示词结构，可以根据具体需求增删对应模块",
    icon: <Sparkles className="h-5 w-5" />,
  },
  {
    id: "task",
    name: "任务执行",
    description: "适用于有明确的工作步骤的任务执行场景，通过明确每一步骤的工作要求...",
    icon: <Workflow className="h-5 w-5" />,
  },
  {
    id: "roleplay",
    name: "角色扮演",
    description: "适用于聊天乐场景，塑造个性化人设...",
    icon: <MessageSquare className="h-5 w-5" />,
  },
];

// ============================================================================
// Main Component
// ============================================================================

export function SettingsAgentsPage() {
  const { t } = useTranslation();
  const {
    agents,
    defaultAgentId,
    templates,
    loading,
    error,
    refresh,
    createAgent,
    updateAgent,
    removeAgent,
    setDefaultAgent,
  } = useVibenAgents();

  const { providers } = useVibenProviders();
  const { models } = useVibenModels();

  // Selected agent state
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const selectedAgent = useMemo(
    () => agents.find((a) => a.id === selectedAgentId) || null,
    [agents, selectedAgentId]
  );

  // Auto-select first agent
  useEffect(() => {
    if (!selectedAgentId && agents.length > 0) {
      setSelectedAgentId(agents[0].id);
    }
  }, [agents, selectedAgentId]);

  // Form state for editing
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formSystemPrompt, setFormSystemPrompt] = useState("");
  const [formTemperature, setFormTemperature] = useState(0.7);
  const [formMaxTokens, setFormMaxTokens] = useState(4096);
  const [formExecutorType, setFormExecutorType] = useState<BaseCodingAgent>("CLAUDE_CODE");
  const [formProvider, setFormProvider] = useState("");
  const [formModel, setFormModel] = useState("");

  // Executor-specific config
  const [formPlanMode, setFormPlanMode] = useState(false);
  const [formApprovals, setFormApprovals] = useState(false);
  const [formAppendPrompt, setFormAppendPrompt] = useState("");

  // Availability state
  const [availability, setAvailability] = useState<AvailabilityInfo | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);

  // Debug chat state
  const [debugMessage, setDebugMessage] = useState("");

  // Load form from selected agent
  useEffect(() => {
    if (selectedAgent) {
      setFormName(selectedAgent.name);
      setFormDescription(selectedAgent.description || "");
      setFormSystemPrompt(selectedAgent.system_prompt || "");
      setFormTemperature(selectedAgent.temperature ?? 0.7);
      setFormMaxTokens(selectedAgent.max_tokens ?? 4096);
      setFormProvider(selectedAgent.provider || "");
      setFormModel(selectedAgent.model || "");
      // TODO: Load executor type and config from agent
    }
  }, [selectedAgent]);

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

  // Create new agent
  const handleCreateAgent = async () => {
    try {
      const newAgent = await createAgent({
        name: "新智能体",
        description: "",
      });
      setSelectedAgentId(newAgent.id);
    } catch (err) {
      console.error("Failed to create agent:", err);
    }
  };

  // Save current agent
  const handleSaveAgent = async () => {
    if (!selectedAgentId) return;
    try {
      await updateAgent(selectedAgentId, {
        name: formName,
        description: formDescription || undefined,
        system_prompt: formSystemPrompt || undefined,
        temperature: formTemperature,
        max_tokens: formMaxTokens,
        provider: formProvider || undefined,
        model: formModel || undefined,
      });
    } catch (err) {
      console.error("Failed to save agent:", err);
    }
  };

  // Delete agent
  const handleDeleteAgent = async () => {
    if (!selectedAgentId || !selectedAgent) return;
    if (!confirm(t("settingsAgents.deleteConfirm", { name: selectedAgent.name }))) return;
    try {
      await removeAgent(selectedAgentId);
      setSelectedAgentId(agents.length > 1 ? agents[0].id : null);
    } catch (err) {
      console.error("Failed to delete agent:", err);
    }
  };

  // Debug chat - use agent hook
  const {
    messages,
    isRunning,
    sendMessage,
    stopAgent,
  } = useAgent("debug-workspace", {
    agentType: formExecutorType,
    config: {
      plan: formPlanMode,
      approvals: formApprovals,
      append_prompt: formAppendPrompt || undefined,
      model: formModel || undefined,
    } as ClaudeCodeConfig,
  });

  const handleSendDebugMessage = async () => {
    if (!debugMessage.trim() || isRunning) return;
    const msg = debugMessage;
    setDebugMessage("");
    await sendMessage(msg);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <motion.div
      className="h-full flex flex-col"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Error Banner */}
      {error && (
        <motion.div
          variants={itemVariants}
          className="mx-4 mt-4 p-4 rounded-xl bg-destructive/10 text-destructive text-sm flex items-center gap-2"
        >
          <AlertCircle className="h-4 w-4" />
          {error}
        </motion.div>
      )}

      {/* Three Column Layout */}
      <motion.div variants={itemVariants} className="flex-1 flex min-h-0">
        {/* ================================================================
            LEFT COLUMN: Agent List
            ================================================================ */}
        <div className="w-56 border-r flex flex-col">
          {/* Header */}
          <div className="p-3 border-b flex items-center justify-between">
            <h2 className="text-sm font-semibold">{t("settingsAgents.title")}</h2>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleCreateAgent}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Agent List */}
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => setSelectedAgentId(agent.id)}
                  className={cn(
                    "w-full flex items-center gap-2 p-2 rounded-lg text-left transition-all",
                    "hover:bg-muted/80",
                    selectedAgentId === agent.id
                      ? "bg-primary/10 border border-primary/30"
                      : "border border-transparent"
                  )}
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary/20 text-primary text-xs">
                      {agent.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-medium truncate">
                        {agent.name}
                      </span>
                      {agent.id === defaultAgentId && (
                        <Star className="h-3 w-3 text-yellow-500 fill-yellow-500 shrink-0" />
                      )}
                    </div>
                    {agent.description && (
                      <p className="text-xs text-muted-foreground truncate">
                        {agent.description}
                      </p>
                    )}
                  </div>
                </button>
              ))}

              {agents.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Bot className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">{t("settingsAgents.noAgents")}</p>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Template Section */}
          <div className="border-t p-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-muted-foreground">{t("settingsAgents.templates")}</span>
            </div>
            <div className="space-y-1">
              {AGENT_TEMPLATES.slice(0, 2).map((template) => (
                <button
                  key={template.id}
                  className="w-full p-2 rounded-lg border border-dashed border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{template.icon}</span>
                    <span className="text-xs font-medium">{template.name}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ================================================================
            MIDDLE COLUMN: Configuration
            ================================================================ */}
        <div className="flex-1 flex flex-col min-w-0 border-r">
          {selectedAgent ? (
            <>
              {/* Header */}
              <div className="p-4 border-b flex items-center justify-between">
                <h3 className="font-semibold">{t("settingsAgents.configuration")}</h3>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDefaultAgent(selectedAgentId!)}
                    disabled={selectedAgentId === defaultAgentId}
                  >
                    <Star className="h-4 w-4 mr-1" />
                    {t("settingsAgents.setDefault")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={handleDeleteAgent}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Configuration Sections */}
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-1">
                  {/* Basic Info */}
                  <div className="mb-4 space-y-3">
                    <div className="space-y-2">
                      <Label>{t("settingsAgents.name")}</Label>
                      <Input
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        placeholder={t("settingsAgents.namePlaceholder")}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("settingsAgents.descriptionLabel")}</Label>
                      <Input
                        value={formDescription}
                        onChange={(e) => setFormDescription(e.target.value)}
                        placeholder={t("settingsAgents.descriptionPlaceholder")}
                      />
                    </div>
                  </div>

                  <div className="border-t pt-3">
                    <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                      {t("settingsAgents.modelSettings")}
                    </h4>

                    {/* Model Selection */}
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
                          <span className="text-xs text-muted-foreground">{formTemperature.toFixed(2)}</span>
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

                    {/* Executor Type */}
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
                                <div className="flex items-center gap-2">
                                  <span>{type.name}</span>
                                </div>
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
                            {getAvailabilityStatus(availability)}
                          </p>
                        )}

                        {/* ClaudeCode specific options */}
                        {formExecutorType === "CLAUDE_CODE" && (
                          <div className="space-y-2 pt-2 border-t">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs">{t("settingsAgents.planMode")}</Label>
                              <Switch
                                checked={formPlanMode}
                                onCheckedChange={setFormPlanMode}
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <Label className="text-xs">{t("settingsAgents.approvals")}</Label>
                              <Switch
                                checked={formApprovals}
                                onCheckedChange={setFormApprovals}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </CollapsibleSection>
                  </div>

                  <div className="border-t pt-3">
                    <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                      {t("settingsAgents.skills")}
                    </h4>

                    {/* Plugins */}
                    <CollapsibleSection
                      title={t("settingsAgents.plugins")}
                      icon={<Sparkles className="h-4 w-4" />}
                      action={
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                          <Plus className="h-3 w-3" />
                        </Button>
                      }
                    >
                      <p className="text-xs text-muted-foreground py-2">
                        {t("settingsAgents.noPlugins")}
                      </p>
                    </CollapsibleSection>

                    {/* Workflow */}
                    <CollapsibleSection
                      title={t("settingsAgents.workflow")}
                      icon={<Workflow className="h-4 w-4" />}
                      action={
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                          <Plus className="h-3 w-3" />
                        </Button>
                      }
                    >
                      <p className="text-xs text-muted-foreground py-2">
                        {t("settingsAgents.noWorkflow")}
                      </p>
                    </CollapsibleSection>
                  </div>

                  <div className="border-t pt-3">
                    <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                      {t("settingsAgents.knowledge")}
                    </h4>

                    {/* Knowledge Base */}
                    <CollapsibleSection
                      title={t("settingsAgents.knowledgeBase")}
                      icon={<Database className="h-4 w-4" />}
                      action={
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                          <Plus className="h-3 w-3" />
                        </Button>
                      }
                    >
                      <p className="text-xs text-muted-foreground py-2">
                        {t("settingsAgents.noKnowledge")}
                      </p>
                    </CollapsibleSection>
                  </div>

                  <div className="border-t pt-3">
                    <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                      {t("settingsAgents.memory")}
                    </h4>

                    {/* Long-term Memory */}
                    <CollapsibleSection
                      title={t("settingsAgents.longTermMemory")}
                      icon={<Brain className="h-4 w-4" />}
                      defaultOpen
                    >
                      <p className="text-xs text-muted-foreground py-2">
                        {t("settingsAgents.longTermMemoryDesc")}
                      </p>
                    </CollapsibleSection>
                  </div>

                  <div className="border-t pt-3">
                    <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                      {t("settingsAgents.dialogue")}
                    </h4>

                    {/* System Prompt */}
                    <CollapsibleSection
                      title={t("settingsAgents.systemPrompt")}
                      icon={<MessageSquare className="h-4 w-4" />}
                      defaultOpen
                    >
                      <Textarea
                        value={formSystemPrompt}
                        onChange={(e) => setFormSystemPrompt(e.target.value)}
                        placeholder={t("settingsAgents.systemPromptPlaceholder")}
                        rows={4}
                        className="resize-none text-sm"
                      />
                    </CollapsibleSection>

                    {/* Append Prompt */}
                    <CollapsibleSection
                      title={t("settingsAgents.appendPrompt")}
                      icon={<FileText className="h-4 w-4" />}
                    >
                      <Textarea
                        value={formAppendPrompt}
                        onChange={(e) => setFormAppendPrompt(e.target.value)}
                        placeholder={t("settingsAgents.appendPromptPlaceholder")}
                        rows={2}
                        className="resize-none text-sm"
                      />
                    </CollapsibleSection>
                  </div>
                </div>
              </ScrollArea>

              {/* Save Button */}
              <div className="p-4 border-t">
                <Button onClick={handleSaveAgent} className="w-full">
                  {t("common.save")}
                </Button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Bot className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>{t("settingsAgents.selectAgent")}</p>
              </div>
            </div>
          )}
        </div>

        {/* ================================================================
            RIGHT COLUMN: Preview & Debug
            ================================================================ */}
        <div className="w-80 flex flex-col bg-muted/30">
          {/* Header */}
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-semibold">{t("settingsAgents.previewDebug")}</h3>
          </div>

          {/* Agent Preview */}
          <div className="flex-1 flex flex-col items-center justify-center p-4">
            {selectedAgent ? (
              <>
                <Avatar className="h-20 w-20 mb-3">
                  <AvatarFallback className="bg-primary/20 text-primary text-2xl">
                    {formName.slice(0, 2).toUpperCase() || "AG"}
                  </AvatarFallback>
                </Avatar>
                <h4 className="font-medium text-lg">{formName || t("settingsAgents.unnamed")}</h4>
                {formDescription && (
                  <p className="text-sm text-muted-foreground mt-1 text-center">
                    {formDescription}
                  </p>
                )}

                {/* Chat Messages */}
                {messages.length > 0 && (
                  <ScrollArea className="w-full mt-4 max-h-60">
                    <div className="space-y-2">
                      {messages.slice(-5).map((msg) => (
                        <div
                          key={msg.id}
                          className={cn(
                            "p-2 rounded-lg text-sm",
                            msg.type === "user"
                              ? "bg-primary text-primary-foreground ml-8"
                              : "bg-muted mr-8"
                          )}
                        >
                          {msg.content}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </>
            ) : (
              <>
                <div className="h-20 w-20 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                  <Bot className="h-10 w-10 text-primary/50" />
                </div>
                <p className="text-muted-foreground">{t("settingsAgents.noAgentSelected")}</p>
              </>
            )}
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
                disabled={!selectedAgent || isRunning}
                className="pr-20"
              />
              <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={!selectedAgent}
                >
                  <PlusCircle className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleSendDebugMessage}
                  disabled={!selectedAgent || !debugMessage.trim() || isRunning}
                >
                  {isRunning ? (
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
      </motion.div>
    </motion.div>
  );
}
