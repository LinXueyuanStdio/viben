import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Provider } from "@/hooks/use-providers";
import type { ModelOption } from "./agent-config-panel";
import { ProviderModelSelector } from "./provider-model-selector";
import {
  ANTHROPIC_DEFAULT_HAIKU_MODEL_ENV,
  ANTHROPIC_DEFAULT_OPUS_MODEL_ENV,
  ANTHROPIC_DEFAULT_SONNET_MODEL_ENV,
  ANTHROPIC_MODEL_ENV,
  readEnvRecord,
} from "./provider-model-selection";

type ApprovalMode = "bypass" | "rules" | "ai";

export interface ClaudeCodeConfigSectionProps {
  config?: Record<string, unknown>;
  providers: Provider[];
  selectedProviderId: string;
  models: ModelOption[];
  selectedModel: string;
  approvalMode: ApprovalMode;
  onProviderChange: (providerId: string) => void;
  onModelChange: (modelId: string) => void;
  onFamilyModelChange: (envName: string, modelId: string) => void;
  onEnvChange: (env: Record<string, string>) => void;
  onApprovalModeChange: (mode: ApprovalMode) => void;
}

const MODEL_ENV_FIELDS = [
  { key: ANTHROPIC_DEFAULT_OPUS_MODEL_ENV, label: "Opus model", family: "opus" },
  { key: ANTHROPIC_DEFAULT_SONNET_MODEL_ENV, label: "Sonnet model", family: "sonnet" },
  { key: ANTHROPIC_DEFAULT_HAIKU_MODEL_ENV, label: "Haiku model", family: "haiku" },
] as const;

const QUICK_ENV_FIELDS = [
  { key: "CLAUDE_CODE_EFFORT_LEVEL", label: "Claude Code effort level", placeholder: "max" },
] as const;

const HIDDEN_CUSTOM_ENV = new Set<string>([
  ANTHROPIC_MODEL_ENV,
  ...MODEL_ENV_FIELDS.map((field) => field.key),
  ...QUICK_ENV_FIELDS.map((field) => field.key),
  "ANTHROPIC_BASE_URL",
  "ANTHROPIC_AUTH_TOKEN",
  "CLAUDE_CODE_SUBAGENT_MODEL",
]);

export function ClaudeCodeConfigSection({
  config = {},
  providers,
  selectedProviderId,
  models,
  selectedModel,
  approvalMode,
  onProviderChange,
  onModelChange,
  onFamilyModelChange,
  onEnvChange,
  onApprovalModeChange,
}: ClaudeCodeConfigSectionProps) {
  const env = readEnvRecord(config.env);
  const [newEnvName, setNewEnvName] = useState("");
  const [newEnvValue, setNewEnvValue] = useState("");

  const updateEnv = (key: string, value: string) => {
    onEnvChange({ ...env, [key]: value });
  };

  const removeEnv = (key: string) => {
    const next = { ...env };
    delete next[key];
    onEnvChange(next);
  };

  const addCustomEnv = () => {
    const key = newEnvName.trim();
    if (!key) return;
    onEnvChange({ ...env, [key]: newEnvValue });
    setNewEnvName("");
    setNewEnvValue("");
  };

  const customEnvEntries = Object.entries(env)
    .filter(([key]) => !HIDDEN_CUSTOM_ENV.has(key))
    .sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Claude Code
        </div>
        <div className="text-xs text-muted-foreground">
          Anthropic environment
        </div>
      </div>

      <ProviderModelSelector
        title="当前模型"
        badge="Provider linked"
        providers={providers}
        selectedProviderId={selectedProviderId}
        models={models}
        selectedModel={selectedModel}
        emptyProvidersText="Configure an enabled Anthropic-compatible provider first."
        onProviderChange={onProviderChange}
        onModelChange={onModelChange}
      />

      <div className="space-y-1.5">
        <Label className="text-sm font-normal">审批模式</Label>
        <div className="flex h-8 rounded-md border border-border overflow-hidden">
          {([
            { mode: "bypass" as const, label: "绕过审批" },
            { mode: "rules" as const, label: "规则审批" },
            { mode: "ai" as const, label: "AI 审批" },
          ]).map(({ mode, label }, idx) => {
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
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {MODEL_ENV_FIELDS.map((field) => (
          <div key={field.key} className="space-y-1">
            <Label className="text-sm font-normal">{field.label}</Label>
            <Select
              value={models.some((model) => model.id === env[field.key]) ? env[field.key] : ""}
              onValueChange={(modelId) => onFamilyModelChange(field.key, modelId)}
              disabled={models.length === 0}
            >
              <SelectTrigger className="h-8">
                <SelectValue placeholder={`Select ${field.family}`} />
              </SelectTrigger>
              <SelectContent>
                {models.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>

      <div className="space-y-1">
        <Label className="text-sm font-normal">Subagent model</Label>
        <Select
          value={models.some((model) => model.id === env.CLAUDE_CODE_SUBAGENT_MODEL)
            ? env.CLAUDE_CODE_SUBAGENT_MODEL
            : ""}
          onValueChange={(modelId) => updateEnv("CLAUDE_CODE_SUBAGENT_MODEL", modelId)}
          disabled={models.length === 0}
        >
          <SelectTrigger className="h-8">
            <SelectValue placeholder="Select subagent model" />
          </SelectTrigger>
          <SelectContent>
            {models.map((model) => (
              <SelectItem key={model.id} value={model.id}>
                {model.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {QUICK_ENV_FIELDS.map((field) => (
          <div key={field.key} className="space-y-1">
            <Label className="text-sm font-normal">{field.label}</Label>
            <Input
              value={env[field.key] ?? ""}
              type={field.secret ? "password" : "text"}
              onChange={(event) => updateEnv(field.key, event.target.value)}
              placeholder={field.placeholder}
              className="h-8 text-sm font-mono"
            />
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-normal">其他临时环境变量</Label>
        {customEnvEntries.length > 0 && (
          <div className="space-y-1.5">
            {customEnvEntries.map(([key, value]) => (
              <div key={key} className="grid grid-cols-[minmax(120px,0.9fr)_minmax(140px,1.1fr)_32px] gap-2">
                <Input value={key} readOnly className="h-8 text-sm font-mono" />
                <Input
                  value={value}
                  onChange={(event) => updateEnv(key, event.target.value)}
                  className="h-8 text-sm font-mono"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => removeEnv(key)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
        <div className="grid grid-cols-[minmax(120px,0.9fr)_minmax(140px,1.1fr)_auto] gap-2">
          <Input
            value={newEnvName}
            onChange={(event) => setNewEnvName(event.target.value)}
            placeholder="ENV_NAME"
            className="h-8 text-sm font-mono"
          />
          <Input
            value={newEnvValue}
            onChange={(event) => setNewEnvValue(event.target.value)}
            placeholder="value"
            className="h-8 text-sm font-mono"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            onClick={addCustomEnv}
            disabled={!newEnvName.trim()}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}
