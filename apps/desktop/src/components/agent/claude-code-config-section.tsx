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
  CLAUDE_CODE_MODEL_ENV_KEYS,
  CLAUDE_CODE_PROVIDER_ENV_KEYS,
  readEnvRecord,
} from "./provider-model-selection";
import type { PermissionMode } from "@/lib/gateway/types/agent";

const CLAUDE_CODE_PERMISSION_MODES = [
  { mode: "default", label: "默认" },
  { mode: "bypassPermissions", label: "绕过权限" },
  { mode: "auto", label: "自动" },
  { mode: "acceptEdits", label: "接受编辑" },
  { mode: "dontAsk", label: "不询问" },
  { mode: "plan", label: "计划" },
] as const satisfies ReadonlyArray<{ mode: PermissionMode; label: string }>;

export interface ClaudeCodeConfigSectionProps {
  config?: Record<string, unknown>;
  providers: Provider[];
  selectedProviderId: string;
  models: ModelOption[];
  selectedModel: string;
  permissionMode: PermissionMode;
  onProviderChange: (providerId: string) => void;
  onModelChange: (modelId: string) => void;
  onFamilyModelChange: (envName: string, modelId: string) => void;
  onEnvChange: (env: Record<string, string>) => void;
  onPermissionModeChange: (mode: PermissionMode) => void;
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
  ...CLAUDE_CODE_MODEL_ENV_KEYS,
  ...CLAUDE_CODE_PROVIDER_ENV_KEYS,
  ...QUICK_ENV_FIELDS.map((field) => field.key),
]);

export function ClaudeCodeConfigSection({
  config = {},
  providers,
  selectedProviderId,
  models,
  selectedModel,
  permissionMode,
  onProviderChange,
  onModelChange,
  onFamilyModelChange,
  onEnvChange,
  onPermissionModeChange,
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
    if (!key || HIDDEN_CUSTOM_ENV.has(key)) return;
    onEnvChange({ ...env, [key]: newEnvValue });
    setNewEnvName("");
    setNewEnvValue("");
  };

  const isReservedEnvName = HIDDEN_CUSTOM_ENV.has(newEnvName.trim());

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
        showBaseUrl
      />

      <div className="space-y-1.5">
        <Label className="text-sm font-normal">权限模式</Label>
        <div className="flex h-8 rounded-md border border-border overflow-hidden">
          {CLAUDE_CODE_PERMISSION_MODES.map(({ mode, label }, idx) => {
            const isActive = permissionMode === mode;
            return (
              <button
                key={mode}
                type="button"
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 text-xs transition-colors",
                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset",
                  idx < CLAUDE_CODE_PERMISSION_MODES.length - 1 && "border-r border-border",
                  isActive
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                onClick={() => onPermissionModeChange(mode)}
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
              type="text"
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
            disabled={!newEnvName.trim() || isReservedEnvName}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add
          </Button>
        </div>
        {isReservedEnvName && (
          <p className="text-xs text-muted-foreground">
            This environment variable is controlled by the provider/model selectors.
          </p>
        )}
      </div>
    </div>
  );
}
