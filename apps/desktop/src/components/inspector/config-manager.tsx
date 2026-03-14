import { useState, useCallback, useRef } from "react";
import {
  Download,
  Upload,
  Shield,
  AlertTriangle,
  Check,
  CheckCheck,
  FileJson,
  Copy,
  Eye,
  EyeOff,
  Server,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { McpServerConfig } from "@/hooks/use-mcp-connection";
import { SavedConfigsSelector } from "./saved-configs-selector";

// =============================================================================
// Types
// =============================================================================

/**
 * Inspector configuration format for export/import
 */
export interface InspectorConfig {
  /** Schema version for future compatibility */
  version: string;
  /** Export timestamp */
  exportedAt: string;
  /** Transport configuration */
  transport: {
    type: "stdio" | "sse" | "http" | "streamable-http";
    url?: string;
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    cwd?: string;
    headers?: Record<string, string>;
    timeout?: number;
  };
  /** Metadata configuration */
  metadata?: Record<string, string>;
  /** Authentication info (sensitive) */
  auth?: {
    /** Whether auth is configured */
    hasAuth: boolean;
    /** Auth type (bearer, api_key, oauth) */
    type?: string;
    /** Token value - only included if user opts in */
    token?: string;
  };
  /** Proxy settings */
  proxy?: {
    enabled: boolean;
  };
}

interface ConfigManagerProps {
  /** Current MCP server configuration */
  config: McpServerConfig | null;
  /** Current raw JSON config string */
  configJson: string;
  /** Whether proxy is enabled */
  useProxy: boolean;
  /** Callback when config is imported */
  onImport: (config: InspectorConfig) => void;
  /** Callback when a saved config is loaded (also updates useProxy) */
  onLoadSavedConfig?: (config: InspectorConfig, useProxy: boolean) => void;
  /** Auth tokens from auth panel (optional) */
  authTokens?: Array<{
    name: string;
    type: string;
    value: string;
  }>;
}

interface ExportOptions {
  includeAuth: boolean;
  includeHeaders: boolean;
  includeEnv: boolean;
}

// =============================================================================
// Constants
// =============================================================================

const CONFIG_VERSION = "1.0.0";
const CONFIG_FILE_NAME = "inspector-config.json";

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Sanitize config by removing sensitive data
 */
function sanitizeConfig(
  config: InspectorConfig,
  options: ExportOptions
): InspectorConfig {
  const sanitized = { ...config };

  // Remove auth token if not opted in
  if (!options.includeAuth && sanitized.auth) {
    sanitized.auth = {
      hasAuth: sanitized.auth.hasAuth,
      type: sanitized.auth.type,
      // Token removed
    };
  }

  // Remove headers if not opted in
  if (!options.includeHeaders && sanitized.transport.headers) {
    const headers = { ...sanitized.transport.headers };
    // Remove common sensitive headers
    delete headers["Authorization"];
    delete headers["X-API-Key"];
    delete headers["X-Auth-Token"];
    delete headers["X-MCP-Proxy-Auth"];
    sanitized.transport.headers = Object.keys(headers).length > 0 ? headers : undefined;
  }

  // Remove env vars if not opted in
  if (!options.includeEnv && sanitized.transport.env) {
    sanitized.transport.env = undefined;
  }

  return sanitized;
}

/**
 * Validate imported config structure
 * Returns errorKey for i18n translation
 */
function validateConfig(data: unknown): { valid: boolean; errorKey?: string; errorParam?: string; config?: InspectorConfig } {
  if (!data || typeof data !== "object") {
    return { valid: false, errorKey: "inspector.configErrors.invalidNotObject" };
  }

  const config = data as Record<string, unknown>;

  // Check version
  if (!config.version || typeof config.version !== "string") {
    return { valid: false, errorKey: "inspector.configErrors.missingVersion" };
  }

  // Check transport
  if (!config.transport || typeof config.transport !== "object") {
    return { valid: false, errorKey: "inspector.configErrors.missingTransport" };
  }

  const transport = config.transport as Record<string, unknown>;

  // Check transport type
  const validTypes = ["stdio", "sse", "http", "streamable-http"];
  if (!transport.type || !validTypes.includes(transport.type as string)) {
    return { valid: false, errorKey: "inspector.configErrors.invalidTransportType", errorParam: String(transport.type) };
  }

  // For remote transports, URL is required
  if (["sse", "http", "streamable-http"].includes(transport.type as string)) {
    if (!transport.url || typeof transport.url !== "string") {
      return { valid: false, errorKey: "inspector.configErrors.remoteRequiresUrl" };
    }
    try {
      new URL(transport.url as string);
    } catch {
      return { valid: false, errorKey: "inspector.configErrors.invalidUrl", errorParam: String(transport.url) };
    }
  }

  // For stdio transport, command is required
  if (transport.type === "stdio") {
    if (!transport.command || typeof transport.command !== "string") {
      return { valid: false, errorKey: "inspector.configErrors.stdioRequiresCommand" };
    }
  }

  return { valid: true, config: config as unknown as InspectorConfig };
}

/**
 * Generate MCP server entry config for clipboard (Server Entry format)
 * Compatible with mcp.json format used by Claude Desktop, Cursor, etc.
 */
function generateServerEntry(config: McpServerConfig | null): Record<string, unknown> {
  if (!config) return {};

  // STDIO transport
  if ("command" in config && config.command) {
    const entry: Record<string, unknown> = {
      command: config.command,
      args: config.args || [],
    };
    // Only include env if not empty
    if (config.env && Object.keys(config.env).length > 0) {
      entry.env = config.env;
    }
    return entry;
  }

  // Remote transport (SSE, HTTP, Streamable HTTP)
  if ("url" in config && config.url) {
    const transportType = config.transport || config.type || "streamable-http";

    if (transportType === "sse") {
      return {
        type: "sse",
        url: config.url,
        note: "For SSE connections, add this URL directly in your MCP Client",
      };
    }

    if (transportType === "streamable-http" || transportType === "http") {
      return {
        type: "streamable-http",
        url: config.url,
        note: "For Streamable HTTP connections, add this URL directly in your MCP Client",
      };
    }
  }

  return {};
}

/**
 * Generate full mcp.json servers file format
 */
function generateServersFile(
  config: McpServerConfig | null,
  serverName: string = "default-server"
): Record<string, unknown> {
  const entry = generateServerEntry(config);
  return {
    mcpServers: {
      [serverName]: entry,
    },
  };
}

/**
 * Convert McpServerConfig to InspectorConfig
 */
function configToExport(
  config: McpServerConfig | null,
  _configJson: string,
  useProxy: boolean,
  authTokens?: Array<{ name: string; type: string; value: string }>
): InspectorConfig | null {
  if (!config) return null;

  // Determine transport type
  let transportType: InspectorConfig["transport"]["type"] = "streamable-http";
  if ("command" in config) {
    transportType = "stdio";
  } else if (config.transport) {
    transportType = config.transport as InspectorConfig["transport"]["type"];
  } else if ("url" in config && config.url?.includes("/sse")) {
    transportType = "sse";
  }

  const exportConfig: InspectorConfig = {
    version: CONFIG_VERSION,
    exportedAt: new Date().toISOString(),
    transport: {
      type: transportType,
    },
    proxy: {
      enabled: useProxy,
    },
  };

  // Add URL-based config
  if ("url" in config && config.url) {
    exportConfig.transport.url = config.url;
    if (config.headers) {
      exportConfig.transport.headers = config.headers;
    }
    if (config.auth) {
      if (typeof config.auth === "string" && config.auth !== "oauth") {
        exportConfig.auth = {
          hasAuth: true,
          type: "bearer",
          token: config.auth,
        };
      } else if (config.auth === "oauth") {
        exportConfig.auth = {
          hasAuth: true,
          type: "oauth",
        };
      }
    }
  }

  // Add STDIO config
  if ("command" in config && config.command) {
    exportConfig.transport.command = config.command;
    exportConfig.transport.args = config.args;
    exportConfig.transport.env = config.env;
    exportConfig.transport.cwd = config.cwd;
  }

  // Add timeout
  if (config.timeout) {
    exportConfig.transport.timeout = config.timeout;
  }

  // Add auth tokens from auth panel
  if (authTokens && authTokens.length > 0) {
    const firstToken = authTokens[0];
    exportConfig.auth = {
      hasAuth: true,
      type: firstToken.type,
      token: firstToken.value,
    };
  }

  return exportConfig;
}

// =============================================================================
// Export Dialog Component
// =============================================================================

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: InspectorConfig | null;
}

function ExportDialog({ open, onOpenChange, config }: ExportDialogProps) {
  const { t } = useTranslation();
  const [options, setOptions] = useState<ExportOptions>({
    includeAuth: false,
    includeHeaders: false,
    includeEnv: false,
  });
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const sanitizedConfig = config ? sanitizeConfig(config, options) : null;
  const configString = sanitizedConfig ? JSON.stringify(sanitizedConfig, null, 2) : "";

  const handleExport = useCallback(() => {
    if (!sanitizedConfig) return;

    const blob = new Blob([JSON.stringify(sanitizedConfig, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = CONFIG_FILE_NAME;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    onOpenChange(false);
  }, [sanitizedConfig, onOpenChange]);

  const handleCopy = useCallback(async () => {
    if (!configString) return;
    await navigator.clipboard.writeText(configString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [configString]);

  const hasSensitiveData =
    config?.auth?.token ||
    config?.transport.headers?.["Authorization"] ||
    config?.transport.env;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            {t("inspector.exportConfig", "Export Configuration")}
          </DialogTitle>
          <DialogDescription>
            {t(
              "inspector.exportConfigDesc",
              "Export your current inspector configuration to a JSON file."
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Sensitive data warning */}
          {hasSensitiveData && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <Shield className="h-5 w-5 text-amber-500 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-amber-900 dark:text-amber-100">
                  {t("inspector.sensitiveDataWarning", "Sensitive Data Detected")}
                </h4>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                  {t(
                    "inspector.sensitiveDataWarningDesc",
                    "Your configuration contains sensitive data like API keys or tokens. Choose which data to include in the export."
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Export options */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">
              {t("inspector.exportOptions", "Export Options")}
            </Label>

            <div className="space-y-2">
              {config?.auth?.token && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="includeAuth"
                    checked={options.includeAuth}
                    onCheckedChange={(checked) =>
                      setOptions((prev) => ({ ...prev, includeAuth: !!checked }))
                    }
                  />
                  <Label htmlFor="includeAuth" className="text-sm font-normal cursor-pointer">
                    {t("inspector.includeAuthToken", "Include authentication token")}
                  </Label>
                </div>
              )}

              {config?.transport.headers && Object.keys(config.transport.headers).length > 0 && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="includeHeaders"
                    checked={options.includeHeaders}
                    onCheckedChange={(checked) =>
                      setOptions((prev) => ({ ...prev, includeHeaders: !!checked }))
                    }
                  />
                  <Label htmlFor="includeHeaders" className="text-sm font-normal cursor-pointer">
                    {t("inspector.includeHeaders", "Include all HTTP headers")}
                  </Label>
                </div>
              )}

              {config?.transport.env && Object.keys(config.transport.env).length > 0 && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="includeEnv"
                    checked={options.includeEnv}
                    onCheckedChange={(checked) =>
                      setOptions((prev) => ({ ...prev, includeEnv: !!checked }))
                    }
                  />
                  <Label htmlFor="includeEnv" className="text-sm font-normal cursor-pointer">
                    {t("inspector.includeEnvVars", "Include environment variables")}
                  </Label>
                </div>
              )}
            </div>
          </div>

          {/* Preview toggle */}
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">
              {t("inspector.configPreview", "Configuration Preview")}
            </Label>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7">
                {copied ? (
                  <Check className="h-3.5 w-3.5 mr-1 text-green-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5 mr-1" />
                )}
                {copied ? t("common.copied") : t("common.copy")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPreview(!showPreview)}
                className="h-7"
              >
                {showPreview ? (
                  <EyeOff className="h-3.5 w-3.5 mr-1" />
                ) : (
                  <Eye className="h-3.5 w-3.5 mr-1" />
                )}
                {showPreview ? t("common.hide", "Hide") : t("common.view")}
              </Button>
            </div>
          </div>

          {/* Preview content */}
          {showPreview && (
            <pre className="text-xs bg-muted/50 p-3 rounded-lg overflow-auto max-h-64 font-mono">
              {configString}
            </pre>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            {t("inspector.downloadConfig", "Download Config")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// Import Dialog Component
// =============================================================================

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (config: InspectorConfig) => void;
}

function ImportDialog({ open, onOpenChange, onImport }: ImportDialogProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [importedConfig, setImportedConfig] = useState<InspectorConfig | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(true);

  const handleFileSelect = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);
        const validation = validateConfig(data);

        if (validation.valid && validation.config) {
          setImportedConfig(validation.config);
          setValidationError(null);
        } else {
          setImportedConfig(null);
          const errorMessage = validation.errorKey
            ? (validation.errorParam
                ? `${t(validation.errorKey)}: ${validation.errorParam}`
                : t(validation.errorKey))
            : t("inspector.invalidConfig", "Invalid configuration file");
          setValidationError(errorMessage);
        }
      } catch (err) {
        setImportedConfig(null);
        setValidationError(
          err instanceof SyntaxError
            ? t("inspector.jsonParseError", "Invalid JSON format")
            : String(err)
        );
      }
    };
    reader.readAsText(file);
  }, [t]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFileSelect(files[0]);
      }
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFileSelect(files[0]);
      }
    },
    [handleFileSelect]
  );

  const handleImport = useCallback(() => {
    if (importedConfig) {
      onImport(importedConfig);
      onOpenChange(false);
      setImportedConfig(null);
      setValidationError(null);
    }
  }, [importedConfig, onImport, onOpenChange]);

  const handleClose = useCallback(() => {
    onOpenChange(false);
    setImportedConfig(null);
    setValidationError(null);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            {t("inspector.importConfig", "Import Configuration")}
          </DialogTitle>
          <DialogDescription>
            {t(
              "inspector.importConfigDesc",
              "Import a previously exported inspector configuration file."
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Drop zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
              isDragOver
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-muted-foreground/50"
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleInputChange}
              className="hidden"
            />
            <FileJson className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              {t("inspector.dropConfigHere", "Drop your config file here or click to browse")}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {t("inspector.acceptsJson", "Accepts .json files")}
            </p>
          </div>

          {/* Validation error */}
          {validationError && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Imported config preview */}
          {importedConfig && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium text-green-600 dark:text-green-400">
                    {t("inspector.validConfig", "Valid configuration")}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPreview(!showPreview)}
                  className="h-7"
                >
                  {showPreview ? (
                    <EyeOff className="h-3.5 w-3.5 mr-1" />
                  ) : (
                    <Eye className="h-3.5 w-3.5 mr-1" />
                  )}
                  {showPreview ? t("common.hide", "Hide") : t("common.view")}
                </Button>
              </div>

              {/* Config summary */}
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="p-2 rounded bg-muted/50">
                  <span className="text-muted-foreground">{t("inspector.transportType")}:</span>{" "}
                  <span className="font-medium">{importedConfig.transport.type}</span>
                </div>
                {importedConfig.transport.url && (
                  <div className="p-2 rounded bg-muted/50 col-span-2">
                    <span className="text-muted-foreground">URL:</span>{" "}
                    <span className="font-mono text-xs break-all">{importedConfig.transport.url}</span>
                  </div>
                )}
                {importedConfig.transport.command && (
                  <div className="p-2 rounded bg-muted/50 col-span-2">
                    <span className="text-muted-foreground">{t("inspector.command")}:</span>{" "}
                    <span className="font-mono text-xs">{importedConfig.transport.command}</span>
                  </div>
                )}
                {importedConfig.auth?.hasAuth && (
                  <div className="p-2 rounded bg-muted/50">
                    <span className="text-muted-foreground">{t("inspector.auth")}:</span>{" "}
                    <span className="font-medium">{importedConfig.auth.type}</span>
                    {importedConfig.auth.token && (
                      <span className="text-amber-500 ml-1">(token included)</span>
                    )}
                  </div>
                )}
              </div>

              {/* Full preview */}
              {showPreview && (
                <pre className="text-xs bg-muted/50 p-3 rounded-lg overflow-auto max-h-48 font-mono">
                  {JSON.stringify(importedConfig, null, 2)}
                </pre>
              )}

              {/* Auth warning */}
              {importedConfig.auth?.token && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                  <Shield className="h-4 w-4 text-amber-500 mt-0.5" />
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    {t(
                      "inspector.importAuthWarning",
                      "This configuration includes an authentication token. It will be applied to your session."
                    )}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleImport} disabled={!importedConfig}>
            <Upload className="h-4 w-4 mr-2" />
            {t("inspector.applyConfig", "Apply Configuration")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function ConfigManager({
  config,
  configJson,
  useProxy,
  onImport,
  onLoadSavedConfig,
  authTokens,
}: ConfigManagerProps) {
  const { t } = useTranslation();
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [copiedServerEntry, setCopiedServerEntry] = useState(false);
  const [copiedServersFile, setCopiedServersFile] = useState(false);

  const exportConfig = configToExport(config, configJson, useProxy, authTokens);

  // Handler for copying server entry
  const handleCopyServerEntry = useCallback(() => {
    if (!config) return;

    const entry = generateServerEntry(config);
    const json = JSON.stringify(entry, null, 2);

    navigator.clipboard
      .writeText(json)
      .then(() => {
        setCopiedServerEntry(true);
        setTimeout(() => setCopiedServerEntry(false), 2000);
      })
      .catch(console.error);
  }, [config]);

  // Handler for copying servers file
  const handleCopyServersFile = useCallback(() => {
    if (!config) return;

    const file = generateServersFile(config);
    const json = JSON.stringify(file, null, 2);

    navigator.clipboard
      .writeText(json)
      .then(() => {
        setCopiedServersFile(true);
        setTimeout(() => setCopiedServersFile(false), 2000);
      })
      .catch(console.error);
  }, [config]);

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2 flex-wrap">
      {/* Saved configs selector */}
      {onLoadSavedConfig && (
        <SavedConfigsSelector
          currentConfig={exportConfig}
          currentUseProxy={useProxy}
          onLoadConfig={onLoadSavedConfig}
        />
      )}

      {/* Quick copy buttons */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyServerEntry}
            disabled={!config}
            className="h-7"
          >
            {copiedServerEntry ? (
              <CheckCheck className="h-3.5 w-3.5 mr-1" />
            ) : (
              <Copy className="h-3.5 w-3.5 mr-1" />
            )}
            {t("inspector.serverEntry", "Server Entry")}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {t("inspector.copyServerEntryTooltip", "Copy single server config for mcp.json")}
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyServersFile}
            disabled={!config}
            className="h-7"
          >
            {copiedServersFile ? (
              <CheckCheck className="h-3.5 w-3.5 mr-1" />
            ) : (
              <Server className="h-3.5 w-3.5 mr-1" />
            )}
            {t("inspector.serversFile", "Servers File")}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {t("inspector.copyServersFileTooltip", "Copy complete mcp.json file")}
        </TooltipContent>
      </Tooltip>

      {/* Existing export/import buttons */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setExportDialogOpen(true)}
        disabled={!config}
        className="h-7"
      >
        <Download className="h-3.5 w-3.5 mr-1" />
        {t("common.export")}
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={() => setImportDialogOpen(true)}
        className="h-7"
      >
        <Upload className="h-3.5 w-3.5 mr-1" />
        {t("inspector.import", "Import")}
      </Button>

      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        config={exportConfig}
      />

      <ImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImport={onImport}
      />
      </div>
    </TooltipProvider>
  );
}

export default ConfigManager;
