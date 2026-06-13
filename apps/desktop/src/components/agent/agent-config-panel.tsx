/**
 * Agent Configuration Panel
 *
 * Scrollable panel with 5 sections for agent configuration:
 * - Prompts: System prompt and append prompt
 * - Model: Model selection, temperature, executor settings
 * - Capabilities: MCP servers and skills
 * - Memory: MEMORY.md and daily logs
 * - Variables: Predefined, custom, and environment variables
 *
 * Supports scroll-to-section functionality via ref.
 */
import React, { useRef, useImperativeHandle, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Brain,
  Cpu,
  Settings2,
  FileText,
  Variable,
  Server,
  Sparkles,
  Check,
  AlertCircle,
  Loader2,
  Plus,
  Trash2,
  X,
  ShieldOff,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ExecutorType, AvailabilityInfo } from "@/types/agent";
import type { CustomVariable } from "./agent-variables-section";
import type { AgentMcpEntry } from "@/lib/gateway/types/agent";
import { OpenClawConfigSection } from "./openclaw-config-section";
import { McpConfigEditor } from "./mcp-config-editor";

// Section IDs for scroll navigation
export type ConfigSectionId = "prompts" | "model" | "capabilities" | "memory" | "variables";

export interface ModelOption {
  id: string;
  name: string;
  provider?: string;
}

export interface ExecutorOption {
  id: ExecutorType;
  name: string;
  description?: string;
}

export interface AgentConfigPanelProps {
  // Prompts
  systemPrompt: string;
  appendPrompt: string;
  onSystemPromptChange: (value: string) => void;
  onAppendPromptChange: (value: string) => void;

  // Model
  model: string;
  temperature: number;
  executorType: ExecutorType;
  approvalMode: "bypass" | "rules" | "ai";
  models: ModelOption[];
  executors: ExecutorOption[];
  onModelChange: (value: string) => void;
  onTemperatureChange: (value: number) => void;
  onExecutorTypeChange: (value: ExecutorType) => void;
  onApprovalModeChange: (mode: "bypass" | "rules" | "ai") => void;
  onCheckAvailability: () => void;
  availability: AvailabilityInfo | null;
  checkingAvailability?: boolean;
  providerConstraintHint?: string;

  // Capabilities
  selectedMcpServers: AgentMcpEntry[];
  selectedSkills: string[];
  onConfigureMcp: () => void;
  onConfigureSkills: () => void;
  onMcpServersChange?: (servers: AgentMcpEntry[]) => void;
  onRemoveMcpServer?: (serverName: string) => void;
  onRemoveSkill?: (skillId: string) => void;

  // Memory
  onEditMemory: () => void;
  onViewTodayLog: () => void;
  onViewYesterdayLog: () => void;

  // Variables
  customVariables: CustomVariable[];
  envVariables: string[];
  workspaceName: string;
  workspacePath: string;
  agentName: string;
  onCustomVariablesChange: (vars: CustomVariable[]) => void;
  onEnvVariablesChange: (vars: string[]) => void;

  // Executor-specific config
  executorConfig?: Record<string, unknown>;
  onExecutorConfigChange?: (config: Record<string, unknown>) => void;

  /**
   * Render only the section list without its own ScrollArea.
   * Used when the parent owns the unified scroll container.
   */
  embedded?: boolean;
}

export interface AgentConfigPanelRef {
  scrollToSection: (sectionId: ConfigSectionId) => void;
}

export const AgentConfigPanel = React.forwardRef<AgentConfigPanelRef, AgentConfigPanelProps>(
  (props, ref) => {
    const { t } = useTranslation();

    const {
      // Prompts
      systemPrompt,
      appendPrompt,
      onSystemPromptChange,
      onAppendPromptChange,
      // Model
      model,
      temperature,
      executorType,
      approvalMode,
      models,
      executors,
      onModelChange,
      onTemperatureChange,
      onExecutorTypeChange,
      onApprovalModeChange,
      onCheckAvailability,
      availability,
      checkingAvailability,
      providerConstraintHint,
      // Capabilities
      selectedMcpServers,
      selectedSkills,
      onConfigureMcp,
      onConfigureSkills,
      onMcpServersChange,
      onRemoveMcpServer,
      onRemoveSkill,
      // Memory
      onEditMemory,
      onViewTodayLog,
      onViewYesterdayLog,
      // Variables
      customVariables,
      envVariables,
      workspaceName,
      workspacePath,
      agentName,
      onCustomVariablesChange,
      onEnvVariablesChange,
      embedded = false,
    } = props;

    // Section refs for scroll-to functionality
    const promptsRef = useRef<HTMLDivElement>(null);
    const modelRef = useRef<HTMLDivElement>(null);
    const capabilitiesRef = useRef<HTMLDivElement>(null);
    const memoryRef = useRef<HTMLDivElement>(null);
    const variablesRef = useRef<HTMLDivElement>(null);
    const scrollViewportRef = useRef<HTMLDivElement>(null);

    // Expose scrollToSection method via ref
    useImperativeHandle(ref, () => ({
      scrollToSection: (sectionId: ConfigSectionId) => {
        const sectionRefs: Record<ConfigSectionId, React.RefObject<HTMLDivElement | null>> = {
          prompts: promptsRef,
          model: modelRef,
          capabilities: capabilitiesRef,
          memory: memoryRef,
          variables: variablesRef,
        };

        const targetRef = sectionRefs[sectionId];
        if (targetRef.current) {
          targetRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      },
    }));

    // Local state for adding new custom variable
    const [newVarName, setNewVarName] = useState("");
    const [newVarDefault, setNewVarDefault] = useState("");

    // Local state for adding new env variable
    const [newEnvVar, setNewEnvVar] = useState("");

    const handleAddCustomVariable = () => {
      if (newVarName.trim()) {
        const newVar: CustomVariable = {
          name: newVarName.trim(),
          defaultValue: newVarDefault.trim() || undefined,
        };
        onCustomVariablesChange([...customVariables, newVar]);
        setNewVarName("");
        setNewVarDefault("");
      }
    };

    const handleRemoveCustomVariable = (index: number) => {
      const updated = customVariables.filter((_, i) => i !== index);
      onCustomVariablesChange(updated);
    };

    const handleAddEnvVariable = () => {
      if (newEnvVar.trim() && !envVariables.includes(newEnvVar.trim())) {
        onEnvVariablesChange([...envVariables, newEnvVar.trim()]);
        setNewEnvVar("");
      }
    };

    const handleRemoveEnvVariable = (envVar: string) => {
      onEnvVariablesChange(envVariables.filter((v) => v !== envVar));
    };

    // Get availability status display
    const getAvailabilityDisplay = () => {
      if (checkingAvailability) {
        return (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            {t("common.loading")}
          </span>
        );
      }
      if (!availability) return null;

      switch (availability.type) {
        case "LOGIN_DETECTED":
          return (
            <span className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
              <Check className="h-3 w-3" />
              {t("settingsAgents.loggedIn")}
            </span>
          );
        case "INSTALLATION_FOUND":
          return (
            <span className="flex items-center gap-1.5 text-xs text-yellow-600 dark:text-yellow-400">
              <AlertCircle className="h-3 w-3" />
              {t("settingsAgents.notLoggedIn")}
            </span>
          );
        case "NOT_FOUND":
          return (
            <span className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
              <AlertCircle className="h-3 w-3" />
              {t("common.notInstalled")}
            </span>
          );
        default:
          return null;
      }
    };

    // Predefined variables with current values
    const predefinedVariables = [
      { name: "workspace_name", value: workspaceName || "-" },
      { name: "workspace_path", value: workspacePath || "-" },
      { name: "agent_name", value: agentName || "-" },
      { name: "current_date", value: new Date().toISOString().split("T")[0] },
    ];

    // Check if executor is Claude Code
    const isClaudeCode = executorType === "CLAUDE_CODE";

    const content = (
      <div className={cn("space-y-6", embedded ? "px-4 pb-4 pt-0" : "p-4")}>
          {/* Section 1: Prompts */}
          <section ref={promptsRef} id="prompts" className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
                <FileText className="h-4 w-4 text-primary" />
              </div>
              <h3 className="text-sm font-semibold">{t("agentDetail.prompts")}</h3>
            </div>

            <div className="space-y-4 pl-9">
              {/* System Prompt */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{t("settingsAgents.systemPrompt")}</Label>
                  <span className="text-xs text-muted-foreground">
                    {systemPrompt.length.toLocaleString()} {t("common.units.chars")}
                  </span>
                </div>
                <Textarea
                  value={systemPrompt}
                  onChange={(e) => onSystemPromptChange(e.target.value)}
                  placeholder={t("settingsAgents.systemPromptPlaceholder")}
                  rows={12}
                  className="font-mono text-sm resize-y"
                />
              </div>

              {/* Append Prompt */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{t("settingsAgents.appendPrompt")}</Label>
                  <span className="text-xs text-muted-foreground">
                    {appendPrompt.length.toLocaleString()} {t("common.units.chars")}
                  </span>
                </div>
                <Textarea
                  value={appendPrompt}
                  onChange={(e) => onAppendPromptChange(e.target.value)}
                  placeholder={t("settingsAgents.appendPromptPlaceholder")}
                  rows={4}
                  className="font-mono text-sm resize-y"
                />
                <p className="text-xs text-muted-foreground">
                  {t("settingsAgents.appendPromptHint", {
                    defaultValue: "This text is appended to every conversation.",
                  })}
                </p>
              </div>
            </div>
          </section>

          {/* Section 2: Model */}
          <section ref={modelRef} id="model" className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
                <Cpu className="h-4 w-4 text-primary" />
              </div>
              <h3 className="text-sm font-semibold">{t("agentDetail.model")}</h3>
            </div>

            <div className="space-y-4 pl-9">
              {/* Executor Selection */}
              <div className="space-y-2">
                <Label>{t("settingsAgents.executor")}</Label>
                <Select
                  value={executorType}
                  onValueChange={(value) => onExecutorTypeChange(value as ExecutorType)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("settingsAgents.selectExecutor")} />
                  </SelectTrigger>
                  <SelectContent>
                    {executors.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        <span className="flex items-center gap-2">
                          {e.name}
                          {e.description && (
                            <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {e.description}
                            </span>
                          )}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Availability Check */}
                <div className="flex items-center gap-2 mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onCheckAvailability}
                    disabled={checkingAvailability}
                  >
                    {checkingAvailability && (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    )}
                    {t("settingsAgents.checkAvailability")}
                  </Button>
                  {getAvailabilityDisplay()}
                </div>
              </div>

              {/* Claude Code Options */}
              {isClaudeCode && (
                <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    执行器选项
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-normal">审批模式</Label>
                    <div className="flex h-8 rounded-md border border-border overflow-hidden">
                      {([
                        { mode: "bypass" as const, icon: ShieldOff, label: "绕过审批" },
                        { mode: "rules" as const, icon: ShieldCheck, label: "规则审批" },
                        { mode: "ai" as const, icon: ShieldAlert, label: "AI 审批" },
                      ]).map(({ mode, icon: Icon, label }, idx) => {
                        const isActive = approvalMode === mode;
                        return (
                          <button
                            key={mode}
                            type="button"
                            className={cn(
                              "flex flex-1 items-center justify-center gap-1.5 text-xs transition-colors",
                              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset",
                              idx < 2 && "border-r border-border",
                              isActive
                                ? "bg-accent text-accent-foreground font-medium"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                            onClick={() => onApprovalModeChange(mode)}
                          >
                            <Icon className="size-3.5" />
                            <span>{label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* OpenClaw Options */}
              {executorType === "OPENCLAW" && (
                <OpenClawConfigSection
                  config={props.executorConfig}
                  onConfigChange={props.onExecutorConfigChange}
                />
              )}

              {/* Model Selection */}
              <div className="space-y-2">
                <Label>{t("settingsAgents.model")}</Label>
                {providerConstraintHint && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    {providerConstraintHint}
                  </p>
                )}
                <Select value={model} onValueChange={onModelChange}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("settingsAgents.selectModel")} />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(
                      models.reduce<Record<string, ModelOption[]>>((groups, m) => {
                        const key = m.provider || "Other";
                        (groups[key] ??= []).push(m);
                        return groups;
                      }, {})
                    ).map(([provider, providerModels]) => (
                      <SelectGroup key={provider}>
                        <SelectLabel>{provider}</SelectLabel>
                        {providerModels.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Temperature */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{t("settingsAgents.temperature")}</Label>
                  <span className="text-sm font-mono text-muted-foreground">
                    {temperature.toFixed(2)}
                  </span>
                </div>
                <Slider
                  value={[temperature]}
                  onValueChange={([value]) => onTemperatureChange(value)}
                  min={0}
                  max={2}
                  step={0.01}
                />
              </div>
            </div>
          </section>

          {/* Section 3: Capabilities */}
          <section ref={capabilitiesRef} id="capabilities" className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
                <Settings2 className="h-4 w-4 text-primary" />
              </div>
              <h3 className="text-sm font-semibold">{t("agentDetail.capabilities")}</h3>
            </div>

            <div className="space-y-4 pl-9">
              {/* MCP Servers */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-1.5">
                    <Server className="h-3.5 w-3.5" />
                    {t("settingsAgents.mcpServersLabel")}
                    {selectedMcpServers.length > 0 && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1">
                        {selectedMcpServers.length}
                      </Badge>
                    )}
                  </Label>
                </div>
                <McpConfigEditor
                  servers={selectedMcpServers}
                  onServersChange={onMcpServersChange ?? ((servers) => {
                    // Fallback: use onRemoveMcpServer for deletion compatibility
                    if (onRemoveMcpServer) {
                      const removedNames = selectedMcpServers
                        .filter((s) => !servers.some((ns) => ns.name === s.name))
                        .map((s) => s.name);
                      removedNames.forEach((name) => onRemoveMcpServer(name));
                    }
                  })}
                  onOpenDialog={onConfigureMcp}
                />
              </div>

              {/* Skills */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" />
                    {t("settingsAgents.skillsLabel")}
                    {selectedSkills.length > 0 && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1">
                        {selectedSkills.length}
                      </Badge>
                    )}
                  </Label>
                  <Button variant="outline" size="sm" onClick={onConfigureSkills}>
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    {t("common.configure")}
                  </Button>
                </div>
                {selectedSkills.length > 0 ? (
                  <div className="space-y-1.5">
                    {selectedSkills.map((skill) => (
                      <div
                        key={skill}
                        className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 group"
                      >
                        <Sparkles className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-sm flex-1 truncate">{skill}</span>
                        {onRemoveSkill && (
                          <button
                            type="button"
                            onClick={() => onRemoveSkill(skill)}
                            className="p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed p-4 text-center">
                    <Sparkles className="h-5 w-5 mx-auto text-muted-foreground/50 mb-1.5" />
                    <p className="text-xs text-muted-foreground">
                      {t("settingsAgents.noSkills")}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Section 4: Memory */}
          <section ref={memoryRef} id="memory" className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
                <Brain className="h-4 w-4 text-primary" />
              </div>
              <h3 className="text-sm font-semibold">{t("agentDetail.memory")}</h3>
            </div>

            <div className="space-y-3 pl-9">
              {/* MEMORY.md */}
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <div className="text-sm font-medium">{t("agent.memoryFile")}</div>
                  <div className="text-xs text-muted-foreground">
                    {t("settingsAgents.memoryDescription")}
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={onEditMemory}>
                  {t("common.edit")}
                </Button>
              </div>

              {/* Today's Log */}
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <div className="text-sm font-medium">
                    {t("settingsAgents.todayLog")}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date().toLocaleDateString()}
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={onViewTodayLog}>
                  {t("common.view")}
                </Button>
              </div>

              {/* Yesterday's Log */}
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <div className="text-sm font-medium">
                    {t("settingsAgents.yesterdayLog")}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(Date.now() - 86400000).toLocaleDateString()}
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={onViewYesterdayLog}>
                  {t("common.view")}
                </Button>
              </div>
            </div>
          </section>

          {/* Section 5: Variables */}
          <section ref={variablesRef} id="variables" className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
                <Variable className="h-4 w-4 text-primary" />
              </div>
              <h3 className="text-sm font-semibold">{t("agentDetail.variables")}</h3>
            </div>

            <div className="space-y-4 pl-9">
              {/* Predefined Variables */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{t("agentDetail.predefinedVariables")}</Label>
                  <Button variant="ghost" size="sm" className="h-6 text-xs">
                    {t("agentDetail.viewAll")}
                  </Button>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                  {predefinedVariables.map((v) => (
                    <div key={v.name} className="flex items-center justify-between text-sm">
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                        {"{{" + v.name + "}}"}
                      </code>
                      <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {v.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Custom Variables */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{t("agentDetail.customVariables")}</Label>
                </div>
                <div className="space-y-2">
                  {customVariables.map((v, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 rounded-lg border bg-muted/30 p-2"
                    >
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded flex-shrink-0">
                        {"{{custom." + v.name + "}}"}
                      </code>
                      <span className="text-xs text-muted-foreground truncate flex-1">
                        {v.defaultValue
                          ? `${t("agentDetail.defaultValue")}: ${v.defaultValue}`
                          : "-"}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={() => handleRemoveCustomVariable(index)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </div>
                  ))}

                  {/* Add new custom variable */}
                  <div className="flex items-center gap-2">
                    <Input
                      value={newVarName}
                      onChange={(e) => setNewVarName(e.target.value)}
                      placeholder={t("agentDetail.variableName")}
                      className="h-8 text-sm flex-1"
                    />
                    <Input
                      value={newVarDefault}
                      onChange={(e) => setNewVarDefault(e.target.value)}
                      placeholder={t("agentDetail.defaultValue")}
                      className="h-8 text-sm flex-1"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={handleAddCustomVariable}
                      disabled={!newVarName.trim()}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      {t("agentDetail.addVariable")}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Environment Variables */}
              <div className="space-y-2">
                <Label>{t("agentDetail.envVariables")}</Label>
                <div className="space-y-2">
                  {envVariables.map((envVar) => {
                    // Check if env var is set (for display purposes)
                    // In browser context we can't actually check process.env
                    const isSet = false; // Would need gateway call to check
                    return (
                      <div
                        key={envVar}
                        className="flex items-center gap-2 rounded-lg border bg-muted/30 p-2"
                      >
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded flex-shrink-0">
                          {"{{env." + envVar + "}}"}
                        </code>
                        <span className="flex-1" />
                        <Badge
                          variant={isSet ? "default" : "secondary"}
                          className={cn(
                            "text-[10px]",
                            !isSet && "text-muted-foreground"
                          )}
                        >
                          {isSet ? t("agentDetail.envVarSet") : t("agentDetail.envVarNotSet")}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          onClick={() => handleRemoveEnvVariable(envVar)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                        </Button>
                      </div>
                    );
                  })}

                  {/* Add new env variable */}
                  <div className="flex items-center gap-2">
                    <Input
                      value={newEnvVar}
                      onChange={(e) => setNewEnvVar(e.target.value)}
                      placeholder={t("agent.envVarPlaceholder")}
                      className="h-8 text-sm font-mono flex-1"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={handleAddEnvVariable}
                      disabled={!newEnvVar.trim()}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      {t("agentDetail.addEnvVar")}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </section>
      </div>
    );

    if (embedded) {
      return content;
    }

    return (
      <ScrollArea className="h-full" viewportRef={scrollViewportRef}>
        {content}
      </ScrollArea>
    );
  }
);

AgentConfigPanel.displayName = "AgentConfigPanel";
