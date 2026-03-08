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
import * as React from "react";
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
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ExecutorType, AvailabilityInfo } from "@/types/agent";
import type { CustomVariable } from "./agent-variables-section";

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
  planMode: boolean;
  approvals: boolean;
  models: ModelOption[];
  executors: ExecutorOption[];
  onModelChange: (value: string) => void;
  onTemperatureChange: (value: number) => void;
  onExecutorTypeChange: (value: ExecutorType) => void;
  onPlanModeChange: (value: boolean) => void;
  onApprovalsChange: (value: boolean) => void;
  onCheckAvailability: () => void;
  availability: AvailabilityInfo | null;
  checkingAvailability?: boolean;

  // Capabilities
  selectedMcpServers: string[];
  selectedSkills: string[];
  onConfigureMcp: () => void;
  onConfigureSkills: () => void;

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
      planMode,
      approvals,
      models,
      executors,
      onModelChange,
      onTemperatureChange,
      onExecutorTypeChange,
      onPlanModeChange,
      onApprovalsChange,
      onCheckAvailability,
      availability,
      checkingAvailability,
      // Capabilities
      selectedMcpServers,
      selectedSkills,
      onConfigureMcp,
      onConfigureSkills,
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
    } = props;

    // Section refs for scroll-to functionality
    const promptsRef = React.useRef<HTMLDivElement>(null);
    const modelRef = React.useRef<HTMLDivElement>(null);
    const capabilitiesRef = React.useRef<HTMLDivElement>(null);
    const memoryRef = React.useRef<HTMLDivElement>(null);
    const variablesRef = React.useRef<HTMLDivElement>(null);
    const scrollViewportRef = React.useRef<HTMLDivElement>(null);

    // Expose scrollToSection method via ref
    React.useImperativeHandle(ref, () => ({
      scrollToSection: (sectionId: ConfigSectionId) => {
        const sectionRefs: Record<ConfigSectionId, React.RefObject<HTMLDivElement | null>> = {
          prompts: promptsRef,
          model: modelRef,
          capabilities: capabilitiesRef,
          memory: memoryRef,
          variables: variablesRef,
        };

        const targetRef = sectionRefs[sectionId];
        if (targetRef.current && scrollViewportRef.current) {
          targetRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      },
    }));

    // Local state for adding new custom variable
    const [newVarName, setNewVarName] = React.useState("");
    const [newVarDefault, setNewVarDefault] = React.useState("");

    // Local state for adding new env variable
    const [newEnvVar, setNewEnvVar] = React.useState("");

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
              {t("settingsAgents.loggedIn", { defaultValue: "Logged in" })}
            </span>
          );
        case "INSTALLATION_FOUND":
          return (
            <span className="flex items-center gap-1.5 text-xs text-yellow-600 dark:text-yellow-400">
              <AlertCircle className="h-3 w-3" />
              {t("settingsAgents.notLoggedIn", { defaultValue: "Not logged in" })}
            </span>
          );
        case "NOT_FOUND":
          return (
            <span className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
              <AlertCircle className="h-3 w-3" />
              {t("settingsAgents.notInstalled", { defaultValue: "Not installed" })}
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

    return (
      <ScrollArea className="h-full" viewportRef={scrollViewportRef}>
        <div className="p-4 space-y-6">
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
                    {systemPrompt.length.toLocaleString()} chars
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
                    {appendPrompt.length.toLocaleString()} chars
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
              {/* Model Selection */}
              <div className="space-y-2">
                <Label>{t("settingsAgents.model")}</Label>
                <Select value={model} onValueChange={onModelChange}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("settingsAgents.selectModel")} />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        <span className="flex items-center gap-2">
                          {m.name}
                          {m.provider && (
                            <Badge variant="outline" className="text-[10px]">
                              {m.provider}
                            </Badge>
                          )}
                        </span>
                      </SelectItem>
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
                              - {e.description}
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
                    Claude Code Options
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-normal">
                      {t("settingsAgents.planMode")}
                    </Label>
                    <Switch checked={planMode} onCheckedChange={onPlanModeChange} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-normal">
                      {t("settingsAgents.approvals")}
                    </Label>
                    <Switch checked={approvals} onCheckedChange={onApprovalsChange} />
                  </div>
                </div>
              )}
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
                    MCP Servers
                  </Label>
                  <Button variant="outline" size="sm" onClick={onConfigureMcp}>
                    {t("common.configure")}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedMcpServers.length > 0 ? (
                    selectedMcpServers.map((server) => (
                      <Badge key={server} variant="secondary">
                        {server}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {t("settingsAgents.noMcpServers", { defaultValue: "No servers configured" })}
                    </span>
                  )}
                </div>
              </div>

              {/* Skills */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" />
                    Skills
                  </Label>
                  <Button variant="outline" size="sm" onClick={onConfigureSkills}>
                    {t("common.configure")}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedSkills.length > 0 ? (
                    selectedSkills.map((skill) => (
                      <Badge key={skill} variant="secondary">
                        {skill}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {t("settingsAgents.noSkills", { defaultValue: "No skills configured" })}
                    </span>
                  )}
                </div>
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
                  <div className="text-sm font-medium">MEMORY.md</div>
                  <div className="text-xs text-muted-foreground">
                    {t("settingsAgents.memoryDescription", {
                      defaultValue: "Long-term memory file for preferences and context",
                    })}
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
                      placeholder="ENV_VAR_NAME"
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
      </ScrollArea>
    );
  }
);

AgentConfigPanel.displayName = "AgentConfigPanel";
