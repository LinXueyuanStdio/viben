import { useState, useCallback, useMemo } from "react";
import {
  Terminal,
  Radio,
  Globe,
  Plus,
  Minus,
  Play,
  Square,
  AlertCircle,
  Loader2,
  Check,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import {
  CustomHeaders,
  type CustomHeadersType,
  recordToHeaders,
  headersToRecord,
} from "./custom-headers";

// =============================================================================
// Type Definitions
// =============================================================================

/** Transport type for MCP connections */
export type TransportType = "stdio" | "sse" | "streamable-http";

/** Base configuration shared by all transport types */
interface BaseTransportConfig {
  /** Transport type */
  type: TransportType;
}

/** Configuration for STDIO transport */
export interface StdioTransportConfig extends BaseTransportConfig {
  type: "stdio";
  /** Command to execute (executable path) */
  command: string;
  /** Command line arguments */
  args: string[];
  /** Environment variables */
  env: Record<string, string>;
}

/** Configuration for SSE transport */
export interface SseTransportConfig extends BaseTransportConfig {
  type: "sse";
  /** SSE endpoint URL */
  url: string;
  /** Custom HTTP headers */
  headers: Record<string, string>;
}

/** Configuration for Streamable HTTP transport */
export interface StreamableHttpTransportConfig extends BaseTransportConfig {
  type: "streamable-http";
  /** HTTP endpoint URL */
  url: string;
  /** Custom HTTP headers */
  headers: Record<string, string>;
}

/** Union type for all transport configurations */
export type TransportConfig =
  | StdioTransportConfig
  | SseTransportConfig
  | StreamableHttpTransportConfig;

/** Connection status */
export type TransportConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

// =============================================================================
// Helper Components
// =============================================================================

interface KeyValueEditorProps {
  label: string;
  entries: Record<string, string>;
  onChange: (entries: Record<string, string>) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  valueType?: "text" | "password";
  disabled?: boolean;
}

function KeyValueEditor({
  label,
  entries,
  onChange,
  keyPlaceholder = "Key",
  valuePlaceholder = "Value",
  valueType = "text",
  disabled = false,
}: KeyValueEditorProps) {
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  const handleAdd = useCallback(() => {
    if (!newKey.trim()) return;
    onChange({
      ...entries,
      [newKey.trim()]: newValue,
    });
    setNewKey("");
    setNewValue("");
  }, [entries, newKey, newValue, onChange]);

  const handleRemove = useCallback(
    (key: string) => {
      const updated = { ...entries };
      delete updated[key];
      onChange(updated);
    },
    [entries, onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAdd();
      }
    },
    [handleAdd]
  );

  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium">{label}</Label>

      {/* Existing entries */}
      {Object.entries(entries).length > 0 && (
        <div className="space-y-1.5">
          {Object.entries(entries).map(([key, value]) => (
            <div key={key} className="flex items-center gap-2">
              <Input
                value={key}
                readOnly
                className="flex-1 h-8 text-xs bg-muted/50"
                disabled={disabled}
              />
              <Input
                type={valueType}
                value={value}
                readOnly
                className="flex-1 h-8 text-xs bg-muted/50 font-mono"
                disabled={disabled}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                onClick={() => handleRemove(key)}
                disabled={disabled}
              >
                <Minus className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add new entry */}
      <div className="flex items-center gap-2">
        <Input
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={keyPlaceholder}
          className="flex-1 h-8 text-xs"
          disabled={disabled}
        />
        <Input
          type={valueType}
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={valuePlaceholder}
          className="flex-1 h-8 text-xs font-mono"
          disabled={disabled}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={handleAdd}
          disabled={!newKey.trim() || disabled}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

interface ArgsEditorProps {
  args: string[];
  onChange: (args: string[]) => void;
  disabled?: boolean;
}

function ArgsEditor({ args, onChange, disabled = false }: ArgsEditorProps) {
  const { t } = useTranslation();
  const [newArg, setNewArg] = useState("");

  const handleAdd = useCallback(() => {
    if (!newArg.trim()) return;
    onChange([...args, newArg.trim()]);
    setNewArg("");
  }, [args, newArg, onChange]);

  const handleRemove = useCallback(
    (index: number) => {
      onChange(args.filter((_, i) => i !== index));
    },
    [args, onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAdd();
      }
    },
    [handleAdd]
  );

  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium">
        {t("inspector.transport.args", "Arguments")}
      </Label>

      {/* Existing args */}
      {args.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {args.map((arg, index) => (
            <Badge
              key={index}
              variant="secondary"
              className="text-xs font-mono pr-1"
            >
              {arg}
              <button
                type="button"
                onClick={() => handleRemove(index)}
                className="ml-1 hover:text-red-500"
                disabled={disabled}
              >
                <Minus className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Add new arg */}
      <div className="flex items-center gap-2">
        <Input
          value={newArg}
          onChange={(e) => setNewArg(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("inspector.transport.argPlaceholder", "Add argument...")}
          className="flex-1 h-8 text-xs font-mono"
          disabled={disabled}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={handleAdd}
          disabled={!newArg.trim() || disabled}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// =============================================================================
// SSE/HTTP Config Form Component
// =============================================================================

interface SseHttpConfigFormProps {
  config: SseTransportConfig | StreamableHttpTransportConfig;
  onConfigChange: (config: TransportConfig) => void;
  disabled?: boolean;
}

function SseHttpConfigForm({
  config,
  onConfigChange,
  disabled = false,
}: SseHttpConfigFormProps) {
  const { t } = useTranslation();

  // Convert Record<string, string> to CustomHeadersType for the CustomHeaders component
  const customHeaders = useMemo(
    () => recordToHeaders(config.headers),
    [config.headers]
  );

  const handleHeadersChange = useCallback(
    (headers: CustomHeadersType) => {
      onConfigChange({ ...config, headers: headersToRecord(headers) });
    },
    [config, onConfigChange]
  );

  const placeholder =
    config.type === "sse"
      ? t("placeholders.sseUrl", "http://localhost:3000/sse")
      : t("placeholders.httpUrl", "http://localhost:3000/mcp");

  return (
    <div className="space-y-4 p-4 rounded-lg border bg-muted/20">
      <div className="space-y-2">
        <Label className="text-xs font-medium">
          {t("inspector.transport.url", "URL")}
        </Label>
        <Input
          value={config.url}
          onChange={(e) => onConfigChange({ ...config, url: e.target.value })}
          placeholder={placeholder}
          className="font-mono text-sm"
          disabled={disabled}
        />
      </div>

      <CustomHeaders
        headers={customHeaders}
        onChange={handleHeadersChange}
        disabled={disabled}
        compact
      />
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

interface TransportSelectorProps {
  /** Current transport configuration */
  config: TransportConfig;
  /** Callback when configuration changes */
  onConfigChange: (config: TransportConfig) => void;
  /** Current connection status */
  connectionStatus: TransportConnectionStatus;
  /** Connection error message */
  connectionError?: string | null;
  /** Callback to initiate connection */
  onConnect: () => void;
  /** Callback to disconnect */
  onDisconnect: () => void;
  /** Whether connection operations are disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/** Default configurations for each transport type */
const DEFAULT_CONFIGS: Record<TransportType, TransportConfig> = {
  stdio: {
    type: "stdio",
    command: "",
    args: [],
    env: {},
  },
  sse: {
    type: "sse",
    url: "http://localhost:3000/sse",
    headers: {},
  },
  "streamable-http": {
    type: "streamable-http",
    url: "http://localhost:3000/mcp",
    headers: {},
  },
};

export function TransportSelector({
  config,
  onConfigChange,
  connectionStatus,
  connectionError,
  onConnect,
  onDisconnect,
  disabled = false,
  className,
}: TransportSelectorProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const isConnected = connectionStatus === "connected";
  const isConnecting = connectionStatus === "connecting";
  const hasError = connectionStatus === "error";
  const isDisabled = disabled || isConnecting;

  // Handle transport type change
  const handleTypeChange = useCallback(
    (type: TransportType) => {
      // Preserve common fields if possible
      const newConfig = { ...DEFAULT_CONFIGS[type] };

      // If switching between remote types, preserve URL and headers
      if (
        (config.type === "sse" || config.type === "streamable-http") &&
        (type === "sse" || type === "streamable-http")
      ) {
        (newConfig as SseTransportConfig | StreamableHttpTransportConfig).url =
          (config as SseTransportConfig | StreamableHttpTransportConfig).url;
        (newConfig as SseTransportConfig | StreamableHttpTransportConfig).headers =
          (config as SseTransportConfig | StreamableHttpTransportConfig).headers;
      }

      onConfigChange(newConfig);
    },
    [config, onConfigChange]
  );

  // Handle copy config to clipboard
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(config, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy config:", error);
    }
  }, [config]);

  // Get connection status info
  const getStatusInfo = () => {
    switch (connectionStatus) {
      case "connected":
        return {
          text: t("inspector.transport.connected", "Connected"),
          color: "bg-green-500",
          textColor: "text-green-600",
        };
      case "connecting":
        return {
          text: t("inspector.transport.connecting", "Connecting..."),
          color: "bg-yellow-500",
          textColor: "text-yellow-600",
        };
      case "error":
        return {
          text: t("inspector.transport.error", "Error"),
          color: "bg-red-500",
          textColor: "text-red-600",
        };
      default:
        return {
          text: t("inspector.transport.disconnected", "Disconnected"),
          color: "bg-gray-400",
          textColor: "text-gray-500",
        };
    }
  };

  const statusInfo = getStatusInfo();

  // Get transport icon
  const getTransportIcon = (type: TransportType) => {
    switch (type) {
      case "stdio":
        return <Terminal className="h-4 w-4" />;
      case "sse":
        return <Radio className="h-4 w-4" />;
      case "streamable-http":
        return <Globe className="h-4 w-4" />;
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header with Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getTransportIcon(config.type)}
          <span className="text-sm font-medium">
            {t("inspector.transport.title", "Transport Configuration")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className={cn("w-2 h-2 rounded-full", statusInfo.color)} />
          <span className={cn("text-xs", statusInfo.textColor)}>
            {statusInfo.text}
          </span>
        </div>
      </div>

      {/* Transport Type Selector */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">
          {t("inspector.transport.type", "Transport Type")}
        </Label>
        <Select
          value={config.type}
          onValueChange={(value) => handleTypeChange(value as TransportType)}
          disabled={isConnected || isDisabled}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="stdio">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4" />
                <span>STDIO</span>
                <span className="text-xs text-muted-foreground">
                  {t("inspector.transport.stdioDesc", "(Command line)")}
                </span>
              </div>
            </SelectItem>
            <SelectItem value="sse">
              <div className="flex items-center gap-2">
                <Radio className="h-4 w-4" />
                <span>SSE</span>
                <span className="text-xs text-muted-foreground">
                  {t("inspector.transport.sseDesc", "(Server-Sent Events)")}
                </span>
              </div>
            </SelectItem>
            <SelectItem value="streamable-http">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                <span>HTTP</span>
                <span className="text-xs text-muted-foreground">
                  {t("inspector.transport.httpDesc", "(Streamable HTTP)")}
                </span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Configuration Form - STDIO */}
      {config.type === "stdio" && (
        <div className="space-y-4 p-4 rounded-lg border bg-muted/20">
          <div className="space-y-2">
            <Label className="text-xs font-medium">
              {t("inspector.transport.command", "Command")}
            </Label>
            <Input
              value={config.command}
              onChange={(e) =>
                onConfigChange({ ...config, command: e.target.value })
              }
              placeholder={t(
                "inspector.transport.commandPlaceholder",
                "/path/to/executable"
              )}
              className="font-mono text-sm"
              disabled={isConnected || isDisabled}
            />
          </div>

          <ArgsEditor
            args={config.args}
            onChange={(args) => onConfigChange({ ...config, args })}
            disabled={isConnected || isDisabled}
          />

          <KeyValueEditor
            label={t("inspector.transport.envVars", "Environment Variables")}
            entries={config.env}
            onChange={(env) => onConfigChange({ ...config, env })}
            keyPlaceholder="VAR_NAME"
            valuePlaceholder="value"
            disabled={isConnected || isDisabled}
          />
        </div>
      )}

      {/* Configuration Form - SSE */}
      {config.type === "sse" && (
        <SseHttpConfigForm
          config={config}
          onConfigChange={onConfigChange}
          disabled={isConnected || isDisabled}
        />
      )}

      {/* Configuration Form - Streamable HTTP */}
      {config.type === "streamable-http" && (
        <SseHttpConfigForm
          config={config}
          onConfigChange={onConfigChange}
          disabled={isConnected || isDisabled}
        />
      )}

      {/* Connection Error */}
      {hasError && connectionError && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span className="text-xs break-all font-mono">{connectionError}</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        {isConnected ? (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={onDisconnect}
              disabled={isDisabled}
              className="flex-1"
            >
              <Square className="h-4 w-4 mr-2" />
              {t("inspector.transport.disconnect", "Disconnect")}
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            onClick={onConnect}
            disabled={isDisabled || !isConfigValid(config)}
            className="flex-1"
          >
            {isConnecting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            {isConnecting
              ? t("inspector.transport.connecting", "Connecting...")
              : t("inspector.transport.connect", "Connect")}
          </Button>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={handleCopy}
          className="w-9 p-0"
          title={t("inspector.transport.copyConfig", "Copy configuration")}
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Info Section */}
      <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-3">
        <div className="flex items-start gap-2">
          {getTransportIcon(config.type)}
          <div>
            <h4 className="text-xs font-medium text-blue-900 dark:text-blue-100 mb-1">
              {getTransportTitle(config.type, t)}
            </h4>
            <p className="text-xs text-blue-700 dark:text-blue-300">
              {getTransportDescription(config.type, t)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Check if a transport configuration is valid for connection
 */
export function isConfigValid(config: TransportConfig): boolean {
  switch (config.type) {
    case "stdio":
      return config.command.trim().length > 0;
    case "sse":
    case "streamable-http":
      try {
        new URL(config.url);
        return true;
      } catch {
        return false;
      }
  }
}

/**
 * Create a default transport configuration
 */
export function createDefaultConfig(
  type: TransportType = "streamable-http"
): TransportConfig {
  return { ...DEFAULT_CONFIGS[type] };
}

/**
 * Convert transport config to MCP server config format
 */
export function toMcpServerConfig(config: TransportConfig): Record<string, unknown> {
  switch (config.type) {
    case "stdio":
      return {
        command: config.command,
        args: config.args,
        env: config.env,
        transport: "stdio",
      };
    case "sse":
      return {
        url: config.url,
        headers: config.headers,
        transport: "sse",
      };
    case "streamable-http":
      return {
        url: config.url,
        headers: config.headers,
        transport: "streamable-http",
      };
  }
}

/**
 * Parse MCP server config to transport config
 */
export function fromMcpServerConfig(mcpConfig: Record<string, unknown>): TransportConfig {
  if ("command" in mcpConfig && typeof mcpConfig.command === "string") {
    return {
      type: "stdio",
      command: mcpConfig.command,
      args: Array.isArray(mcpConfig.args) ? mcpConfig.args : [],
      env:
        typeof mcpConfig.env === "object" && mcpConfig.env !== null
          ? (mcpConfig.env as Record<string, string>)
          : {},
    };
  }

  if ("url" in mcpConfig && typeof mcpConfig.url === "string") {
    const headers =
      typeof mcpConfig.headers === "object" && mcpConfig.headers !== null
        ? (mcpConfig.headers as Record<string, string>)
        : {};

    const transport = mcpConfig.transport || mcpConfig.type;

    if (transport === "sse" || mcpConfig.url.includes("/sse")) {
      return {
        type: "sse",
        url: mcpConfig.url,
        headers,
      };
    }

    return {
      type: "streamable-http",
      url: mcpConfig.url,
      headers,
    };
  }

  // Default fallback
  return createDefaultConfig("streamable-http");
}

// Helper functions for i18n
function getTransportTitle(
  type: TransportType,
  t: (key: string, defaultValue: string) => string
): string {
  switch (type) {
    case "stdio":
      return t("inspector.transport.stdioTitle", "STDIO Transport");
    case "sse":
      return t("inspector.transport.sseTitle", "SSE Transport");
    case "streamable-http":
      return t("inspector.transport.httpTitle", "Streamable HTTP Transport");
  }
}

function getTransportDescription(
  type: TransportType,
  t: (key: string, defaultValue: string) => string
): string {
  switch (type) {
    case "stdio":
      return t(
        "inspector.transport.stdioDescription",
        "Connects to an MCP server via standard input/output streams. Requires a local executable."
      );
    case "sse":
      return t(
        "inspector.transport.sseDescription",
        "Connects to an MCP server using Server-Sent Events. Suitable for real-time streaming responses."
      );
    case "streamable-http":
      return t(
        "inspector.transport.httpDescription",
        "Connects to an MCP server using HTTP with streaming support. The recommended transport for most use cases."
      );
  }
}
