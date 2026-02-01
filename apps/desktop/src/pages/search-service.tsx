import { useState, useEffect, useRef, useCallback } from "react";
import {
  Play,
  Square,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  Plus,
  Trash2,
  Key,
  Eye,
  EyeOff,
  Settings2,
  Server,
  ChevronDown,
  ChevronRight,
  Edit2,
  X,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMcp } from "@/hooks/use-mcp";
import { usePython } from "@/hooks/use-python";
import { useApiKeys } from "@/hooks/use-api-keys";
import { useServiceKeys } from "@/hooks/use-service-keys";
import { useUsage, type ApiKeyUsage } from "@/hooks/use-usage";
import { useAppStore } from "@/stores";
import type { McpServerInstance, ServiceApiKey } from "@/types";

export function SearchServicePage() {
  const { selectedPython, browseMcpInfo } = usePython();
  const {
    mcpServers,
    addMcpServer,
    updateMcpServer,
    deleteMcpServer,
    setMcpServerStatus,
    addServerApiKey,
    deleteServerApiKey,
    getAvailableProviders,
  } = useAppStore();

  const [expandedServer, setExpandedServer] = useState<string | null>(null);
  const hasInitialized = useRef(false);

  const canStart = selectedPython?.is_valid && browseMcpInfo?.installed;

  // Auto-expand first server only on initial mount
  useEffect(() => {
    if (!hasInitialized.current && mcpServers.length > 0) {
      setExpandedServer(mcpServers[0].id);
      hasInitialized.current = true;
    }
  }, [mcpServers]);

  const handleCreateServer = () => {
    const availableSources = getAvailableProviders().map((p) => p.id);
    const id = addMcpServer({
      name: `Server ${mcpServers.length + 1}`,
      transport: "sse", // Default to SSE (no more stdio)
      port: 3000 + mcpServers.length, // Auto-increment port
      downloadPath: "~/Downloads/browse-mcp",
      enabledSources: availableSources.slice(0, 5),
    });
    setExpandedServer(id);
  };

  const handleDeleteServer = (id: string, name: string) => {
    if (!confirm(`Delete server "${name}"? This cannot be undone.`)) return;
    deleteMcpServer(id);
    if (expandedServer === id) {
      setExpandedServer(mcpServers.find((s) => s.id !== id)?.id ?? null);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Search Service</h1>
          <p className="text-sm text-muted-foreground">
            Configure MCP servers with different data sources
          </p>
        </div>
        <Button onClick={handleCreateServer} disabled={!canStart}>
          <Plus className="h-4 w-4 mr-2" />
          New Server
        </Button>
      </div>

      {/* Requirements Check */}
      {!canStart && (
        <div className="mb-6 p-4 rounded-lg border border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">
                Requirements Not Met
              </h3>
              <ul className="text-sm text-yellow-700 dark:text-yellow-300 mt-1 space-y-1">
                {!selectedPython?.is_valid && (
                  <li>- Python 3.10+ is required</li>
                )}
                {selectedPython?.is_valid && !browseMcpInfo?.installed && (
                  <li>- browse-mcp package is not installed</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Server List */}
      {mcpServers.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center">
          <Server className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
          <h3 className="text-lg font-medium mb-2">No Servers Configured</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create your first MCP server to start searching academic papers.
          </p>
          <Button onClick={handleCreateServer} disabled={!canStart}>
            <Plus className="h-4 w-4 mr-2" />
            Create Server
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {mcpServers.map((server) => (
            <ServerCard
              key={server.id}
              server={server}
              expanded={expandedServer === server.id}
              onToggleExpand={() =>
                setExpandedServer(
                  expandedServer === server.id ? null : server.id
                )
              }
              onUpdate={(updates) => updateMcpServer(server.id, updates)}
              onDelete={() => handleDeleteServer(server.id, server.name)}
              onStatusChange={(status, pid) =>
                setMcpServerStatus(server.id, status, pid)
              }
              onAddApiKey={(key) => addServerApiKey(server.id, key)}
              onDeleteApiKey={(keyId) => deleteServerApiKey(server.id, keyId)}
              availableProviders={getAvailableProviders()}
              canStart={canStart ?? false}
              pythonPath={selectedPython?.path}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface ServerCardProps {
  server: McpServerInstance;
  expanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (updates: Partial<McpServerInstance>) => void;
  onDelete: () => void;
  onStatusChange: (status: "stopped" | "running", pid?: number) => void;
  onAddApiKey: (key: ServiceApiKey) => void;
  onDeleteApiKey: (keyId: string) => void;
  availableProviders: { id: string; name: string }[];
  canStart: boolean;
  pythonPath?: string;
}

function ServerCard({
  server,
  expanded,
  onToggleExpand,
  onUpdate,
  onDelete,
  onStatusChange,
  onAddApiKey,
  onDeleteApiKey,
  availableProviders,
  canStart,
  pythonPath,
}: ServerCardProps) {
  const { startServer, stopServer, loading, error, checkPortStatus, killProcess, isProcessAlive } = useMcp();
  const { getAllApiKeys } = useApiKeys();
  const { getKeyById } = useServiceKeys();
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(server.name);
  const [copied, setCopied] = useState(false);
  const [selectedKeyForConfig, setSelectedKeyForConfig] = useState<string>("");
  const [fullApiKey, setFullApiKey] = useState<string | null>(null);
  const [portConflict, setPortConflict] = useState<{
    show: boolean;
    port: number;
    pid: number | null;
    processName: string | null;
  } | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // Fetch full API key when selection changes
  useEffect(() => {
    if (selectedKeyForConfig) {
      getKeyById(selectedKeyForConfig).then((key) => {
        setFullApiKey(key?.key ?? null);
      });
    } else {
      setFullApiKey(null);
    }
  }, [selectedKeyForConfig, getKeyById]);

  // Auto-dismiss notification
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const doStartServer = async (port: number) => {
    if (!pythonPath) return;

    const latestApiKeys = await getAllApiKeys();

    try {
      await startServer({
        python_path: pythonPath,
        transport: server.transport,
        port,
        download_path: server.downloadPath,
        enabled_sources: server.enabledSources,
        api_keys: latestApiKeys,
        server_id: server.id,
        server_name: server.name,
      });
      onStatusChange("running");
    } catch (err) {
      console.error("Failed to start server:", err);
    }
  };

  const handleStart = async () => {
    if (!pythonPath) return;

    // Default port based on transport if not set
    const port = server.port ?? (server.transport === "stdio" ? undefined : 3000);

    // Skip port check for stdio transport
    if (server.transport === "stdio" || !port) {
      await doStartServer(port ?? 3000);
      return;
    }

    // Check if port is in use
    const portStatus = await checkPortStatus(port);
    if (portStatus.in_use) {
      setPortConflict({
        show: true,
        port,
        pid: portStatus.pid,
        processName: portStatus.process_name,
      });
      return;
    }

    await doStartServer(port);
  };

  const handleKillAndStart = async () => {
    if (!portConflict?.pid) return;

    const killed = await killProcess(portConflict.pid);
    if (killed) {
      // Wait a bit for the port to be released
      await new Promise((resolve) => setTimeout(resolve, 500));
      await doStartServer(portConflict.port);
    } else {
      setNotification("Failed to kill process. Please close it manually.");
    }
    setPortConflict(null);
  };

  const handleUseAnotherPort = () => {
    if (!portConflict) return;
    const newPort = portConflict.port + 1;
    onUpdate({ port: newPort });
    setPortConflict(null);
    setNotification(`Port changed to ${newPort}. Click Start again.`);
  };

  const handleStop = async () => {
    try {
      // Check if process is still alive before stopping
      if (server.pid) {
        const alive = await isProcessAlive(server.pid);
        if (!alive) {
          setNotification("Process already terminated.");
          onStatusChange("stopped");
          return;
        }
      }
      await stopServer();
      onStatusChange("stopped");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("No such process") || message.includes("not found")) {
        setNotification("Process already terminated.");
        onStatusChange("stopped");
      } else {
        console.error("Failed to stop server:", err);
      }
    }
  };

  const handleSaveName = () => {
    if (nameValue.trim()) {
      onUpdate({ name: nameValue.trim() });
    }
    setEditingName(false);
  };

  const toggleSource = (sourceId: string) => {
    const newSources = server.enabledSources.includes(sourceId)
      ? server.enabledSources.filter((id) => id !== sourceId)
      : [...server.enabledSources, sourceId];
    onUpdate({ enabledSources: newSources });
  };

  // Find the selected API key for config display
  const selectedApiKey = server.apiKeys.find((k) => k.id === selectedKeyForConfig);

  // Check if we can copy config (requires API key)
  const canCopyConfig = selectedKeyForConfig && fullApiKey;

  const generateMcpConfig = (includeRealKey: boolean = false) => {
    const baseUrl = `http://localhost:${server.port || 3000}`;
    const url = server.transport === "sse" ? `${baseUrl}/sse` : baseUrl;

    const config: Record<string, unknown> = {
      "browse-mcp": {
        url,
        transport: server.transport,
      },
    };

    // Add API key header
    if (selectedApiKey) {
      (config["browse-mcp"] as Record<string, unknown>).headers = {
        "Authorization": includeRealKey && fullApiKey
          ? `Bearer ${fullApiKey}`
          : `Bearer <${selectedApiKey.name}: ${selectedApiKey.keyPrefix}...>`,
      };
    }

    return config;
  };

  const copyConfig = () => {
    if (!canCopyConfig) return;
    // Copy with real API key
    navigator.clipboard.writeText(JSON.stringify(generateMcpConfig(true), null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isRunning = server.status === "running";

  return (
    <div className="rounded-lg border bg-card">
      {/* Port Conflict Dialog */}
      {portConflict?.show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg border shadow-lg p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              Port {portConflict.port} is in use
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {portConflict.processName ? (
                <>
                  Process <strong>{portConflict.processName}</strong> (PID: {portConflict.pid}) is using this port.
                </>
              ) : (
                <>
                  A process (PID: {portConflict.pid}) is using this port.
                </>
              )}
            </p>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPortConflict(null)}
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleUseAnotherPort}
              >
                Use Port {portConflict.port + 1}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleKillAndStart}
                disabled={!portConflict.pid}
              >
                Kill & Start
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Notification Toast */}
      {notification && (
        <div className="fixed bottom-4 right-4 bg-card border rounded-lg shadow-lg p-4 z-50 animate-in slide-in-from-bottom-2">
          <p className="text-sm">{notification}</p>
        </div>
      )}

      {/* Header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer"
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-3">
          <button className="text-muted-foreground">
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
          <div
            className={`h-3 w-3 rounded-full ${
              isRunning ? "bg-green-500 animate-pulse" : "bg-muted"
            }`}
          />
          {editingName ? (
            <div
              className="flex items-center gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="text"
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                className="rounded-md border bg-background px-2 py-1 text-sm font-medium"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveName();
                  if (e.key === "Escape") {
                    setNameValue(server.name);
                    setEditingName(false);
                  }
                }}
                onBlur={handleSaveName}
              />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="font-medium">{server.name}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingName(true);
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <Edit2 className="h-3 w-3" />
              </button>
            </div>
          )}
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
            {server.transport.toUpperCase()}
          </span>
          <span className="text-xs text-muted-foreground">
            :{server.port || 3000}
          </span>
          <span className="text-xs text-muted-foreground">
            {server.enabledSources.length} sources
          </span>
        </div>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <Button
            variant={isRunning ? "destructive" : "default"}
            size="sm"
            onClick={isRunning ? handleStop : handleStart}
            disabled={loading || (!canStart && !isRunning)}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : isRunning ? (
              <Square className="h-4 w-4 mr-2" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            {isRunning ? "Stop" : "Start"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            disabled={isRunning}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t p-4 space-y-6">
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          {/* Configuration */}
          <div>
            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              Configuration
            </h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Transport Protocol
                </label>
                <div className="flex gap-2">
                  {(["sse", "http"] as const).map((transport) => (
                    <Button
                      key={transport}
                      variant={
                        server.transport === transport ? "secondary" : "outline"
                      }
                      size="sm"
                      className="flex-1"
                      onClick={() => onUpdate({ transport })}
                      disabled={isRunning}
                    >
                      {transport.toUpperCase()}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {server.transport === "sse"
                    ? "Server-Sent Events - recommended for MCP clients"
                    : "HTTP - for REST API access"}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Port</label>
                <input
                  type="number"
                  value={server.port || 3000}
                  onChange={(e) => onUpdate({ port: Number(e.target.value) })}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  disabled={isRunning}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-sm font-medium mb-2 block">
                  Download Path
                </label>
                <input
                  type="text"
                  value={server.downloadPath}
                  onChange={(e) => onUpdate({ downloadPath: e.target.value })}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  disabled={isRunning}
                />
              </div>
            </div>
          </div>

          {/* Data Sources */}
          <div>
            <h4 className="text-sm font-medium mb-3">Data Sources</h4>
            <div className="grid gap-2 sm:grid-cols-3">
              {availableProviders.map((provider) => (
                <label
                  key={provider.id}
                  className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                    server.enabledSources.includes(provider.id)
                      ? "border-primary bg-primary/5"
                      : "border-muted hover:border-muted-foreground/50"
                  } ${isRunning ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={server.enabledSources.includes(provider.id)}
                    onChange={() => toggleSource(provider.id)}
                    disabled={isRunning}
                    className="rounded"
                  />
                  <span className="text-sm">{provider.name}</span>
                </label>
              ))}
            </div>
            {availableProviders.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No data sources available. Configure API keys in the Data
                Sources page.
              </p>
            )}
          </div>

          {/* API Keys */}
          <ServerApiKeysSection
            server={server}
            onAddKey={onAddApiKey}
            onDeleteKey={onDeleteApiKey}
            disabled={isRunning}
          />

          {/* MCP Configuration */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium">MCP Configuration</h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={copyConfig}
                disabled={!canCopyConfig}
                title={!canCopyConfig ? "Select an API key to copy configuration" : ""}
              >
                {copied ? (
                  <Check className="h-4 w-4 mr-2 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4 mr-2" />
                )}
                {copied ? "Copied!" : "Copy"}
              </Button>
            </div>

            {/* API Key selector for config */}
            <div className="mb-2">
              <label className="text-xs text-muted-foreground mb-1 block">
                Select API Key for config (required):
              </label>
              {server.apiKeys.length > 0 ? (
                <select
                  value={selectedKeyForConfig}
                  onChange={(e) => setSelectedKeyForConfig(e.target.value)}
                  className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
                >
                  <option value="">-- Select API Key --</option>
                  {server.apiKeys.map((key) => (
                    <option key={key.id} value={key.id}>
                      {key.name} ({key.keyPrefix})
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-sm text-yellow-600 dark:text-yellow-400 p-2 bg-yellow-50 dark:bg-yellow-950 rounded border border-yellow-200 dark:border-yellow-900">
                  Create an API key above to enable configuration copy.
                </p>
              )}
            </div>

            <pre className="bg-muted rounded-md p-3 text-sm overflow-x-auto">
              {JSON.stringify(generateMcpConfig(false), null, 2)}
            </pre>

            {!selectedKeyForConfig && server.apiKeys.length > 0 && (
              <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2">
                Select an API key to copy the configuration with the real key.
              </p>
            )}

            {selectedApiKey && (
              <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                Click "Copy" to copy the configuration with the real API key.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface ServerApiKeysSectionProps {
  server: McpServerInstance;
  onAddKey: (key: ServiceApiKey) => void;
  onDeleteKey: (keyId: string) => void;
  disabled?: boolean;
}

function ServerApiKeysSection({
  server,
  onAddKey,
  onDeleteKey,
  disabled = false,
}: ServerApiKeysSectionProps) {
  const { createKey } = useServiceKeys();
  const { getApiKeyUsage } = useUsage();
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<{
    id: string;
    name: string;
    key: string;
  } | null>(null);
  const [showNewKey, setShowNewKey] = useState(false);
  const [keyUsages, setKeyUsages] = useState<Record<string, ApiKeyUsage>>({});

  // Fetch usage for all keys
  const fetchKeyUsages = useCallback(async () => {
    const usages: Record<string, ApiKeyUsage> = {};
    for (const key of server.apiKeys) {
      const usage = await getApiKeyUsage(key.id);
      if (usage) {
        usages[key.id] = usage;
      }
    }
    setKeyUsages(usages);
  }, [server.apiKeys, getApiKeyUsage]);

  useEffect(() => {
    fetchKeyUsages();
  }, [fetchKeyUsages]);

  const handleCreate = async () => {
    if (!newKeyName.trim() || disabled) return;
    setCreating(true);
    const result = await createKey(newKeyName);
    if (result) {
      // Convert snake_case from backend to camelCase for store
      const apiKey: ServiceApiKey = {
        id: result.id,
        name: result.name,
        keyPrefix: result.key_prefix,
        createdAt: result.created_at,
        lastUsed: result.last_used ?? undefined,
      };
      onAddKey(apiKey);
      setNewlyCreatedKey({
        id: result.id,
        name: result.name,
        key: result.key,
      });
      setNewKeyName("");
    }
    setCreating(false);
  };

  const handleDelete = (keyId: string, keyName: string) => {
    if (disabled) return;
    if (!confirm(`Delete API key "${keyName}"?`)) return;
    onDeleteKey(keyId);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div>
      <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
        <Key className="h-4 w-4" />
        Service API Keys
        {disabled && (
          <span className="text-xs text-yellow-600 dark:text-yellow-400 font-normal">
            (Stop server to modify)
          </span>
        )}
      </h4>
      <p className="text-xs text-muted-foreground mb-3">
        Create API keys for external clients to authenticate with this server.
      </p>

      {/* Newly Created Key */}
      {newlyCreatedKey && (
        <div className="mb-3 p-3 rounded-lg border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-green-800 dark:text-green-200">
                API Key Created: {newlyCreatedKey.name}
              </p>
              <p className="text-xs text-green-700 dark:text-green-300 mt-0.5">
                Copy now - you won't see this again.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setNewlyCreatedKey(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 bg-white dark:bg-green-900 px-2 py-1 rounded text-xs font-mono text-green-900 dark:text-green-100">
              {showNewKey ? newlyCreatedKey.key : "•".repeat(32)}
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowNewKey(!showNewKey)}
            >
              {showNewKey ? (
                <EyeOff className="h-3 w-3" />
              ) : (
                <Eye className="h-3 w-3" />
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(newlyCreatedKey.key)}
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      {/* Create New Key */}
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={newKeyName}
          onChange={(e) => setNewKeyName(e.target.value)}
          placeholder="Key name (e.g., Claude Desktop)"
          className="flex-1 rounded-md border bg-background px-3 py-2 text-sm disabled:opacity-50"
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          disabled={disabled}
        />
        <Button
          onClick={handleCreate}
          disabled={creating || !newKeyName.trim() || disabled}
          size="sm"
        >
          {creating ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Plus className="h-4 w-4 mr-2" />
          )}
          Create
        </Button>
      </div>

      {/* Existing Keys */}
      {server.apiKeys.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">
          No API keys created for this server
        </p>
      ) : (
        <div className="space-y-2">
          {server.apiKeys.map((key) => (
            <div
              key={key.id}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{key.name}</p>
                  <code className="bg-muted px-1.5 py-0.5 rounded text-xs">
                    {key.keyPrefix}
                  </code>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                  <span>Created {key.createdAt}</span>
                  {keyUsages[key.id]?.last_used && (
                    <span>Last used {keyUsages[key.id].last_used}</span>
                  )}
                  <span className="flex items-center gap-1">
                    <Activity className="h-3 w-3" />
                    {keyUsages[key.id]?.usage_count ?? 0} requests
                  </span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(key.id, key.name)}
                disabled={disabled}
                className="text-destructive hover:text-destructive disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
