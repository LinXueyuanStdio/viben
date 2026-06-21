import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

export interface CodexConfigSectionProps {
  config?: Record<string, unknown>;
  onConfigChange?: (config: Record<string, unknown>) => void;
}

const REASONING_EFFORTS = ["low", "medium", "high"] as const;
const SANDBOX_MODES = [
  { value: "read-only", label: "Read only" },
  { value: "workspace-write", label: "Workspace write" },
  { value: "danger-full-access", label: "Full access" },
] as const;
const APPROVAL_POLICIES = [
  { value: "untrusted", label: "Untrusted" },
  { value: "on-request", label: "On request" },
  { value: "on-failure", label: "On failure" },
  { value: "never", label: "Never" },
] as const;

export function CodexConfigSection({ config = {}, onConfigChange }: CodexConfigSectionProps) {
  const command = readString(config.command) ?? "codex";
  const argsText = arrayToText(config.args, "app-server");
  const reasoningEffort = readString(config.reasoning_effort) ?? "";
  const personality = readString(config.personality) ?? "";
  const sandbox = readString(config.sandbox) ?? "";
  const approvalPolicy = readString(config.approval_policy) ?? "";
  const initTimeoutMs = readNumber(config.init_timeout_ms) ?? 30000;
  const dangerouslySkipPermissions = readBoolean(config.dangerously_skip_permissions) ?? false;

  const update = (key: string, value: unknown) => {
    const next = { ...config };
    if (value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) {
      delete next[key];
    } else {
      next[key] = value;
    }
    onConfigChange?.(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Codex App Server
        </div>
        <div className="text-xs text-muted-foreground">
          Advanced
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-sm font-normal">Command</Label>
          <Input
            value={command}
            onChange={(e) => update("command", e.target.value.trim() || undefined)}
            placeholder="codex"
            className="h-8 text-sm"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-sm font-normal">Args</Label>
          <Input
            value={argsText}
            onChange={(e) => update("args", textToArray(e.target.value))}
            placeholder="app-server"
            className="h-8 text-sm font-mono"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-sm font-normal">Reasoning Effort</Label>
          <Select
            value={reasoningEffort || "default"}
            onValueChange={(value) => update("reasoning_effort", value === "default" ? undefined : value)}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Default</SelectItem>
              {REASONING_EFFORTS.map((effort) => (
                <SelectItem key={effort} value={effort}>{effort}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-sm font-normal">Personality</Label>
          <Input
            value={personality}
            onChange={(e) => update("personality", e.target.value.trim() || undefined)}
            placeholder="friendly"
            className="h-8 text-sm"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-sm font-normal">Sandbox</Label>
          <Select
            value={sandbox || "default"}
            onValueChange={(value) => update("sandbox", value === "default" ? undefined : value)}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Default</SelectItem>
              {SANDBOX_MODES.map((mode) => (
                <SelectItem key={mode.value} value={mode.value}>{mode.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-sm font-normal">Approval Policy</Label>
          <Select
            value={approvalPolicy || "default"}
            onValueChange={(value) => update("approval_policy", value === "default" ? undefined : value)}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Default</SelectItem>
              {APPROVAL_POLICIES.map((policy) => (
                <SelectItem key={policy.value} value={policy.value}>{policy.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-sm font-normal">Init Timeout (ms)</Label>
          <Input
            type="number"
            value={initTimeoutMs}
            min={1000}
            step={1000}
            onChange={(e) => update("init_timeout_ms", readPositiveNumber(e.target.value))}
            className="h-8 text-sm"
          />
        </div>

        <div className="flex items-center justify-between gap-3 rounded-md border bg-background/50 px-3 py-2">
          <div className="space-y-0.5">
            <Label className="text-sm font-normal">Skip Permissions</Label>
            <p className="text-xs text-muted-foreground">Maps to Codex approval policy never.</p>
          </div>
          <Switch
            checked={dangerouslySkipPermissions}
            onCheckedChange={(checked) => update("dangerously_skip_permissions", checked ? true : undefined)}
          />
        </div>
      </div>
    </div>
  );
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function readBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readPositiveNumber(value: string): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function arrayToText(value: unknown, fallback: string): string {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").join(" ")
    : fallback;
}

function textToArray(value: string): string[] | undefined {
  const args = value.trim().split(/\s+/).filter(Boolean);
  return args.length > 0 ? args : undefined;
}
