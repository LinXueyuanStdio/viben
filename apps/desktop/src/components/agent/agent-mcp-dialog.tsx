/**
 * Agent MCP Configuration Dialog
 *
 * Dialog for configuring MCP servers for an agent.
 * Three-tab layout: Registered, Built-in, Custom.
 * Custom tab supports JSON paste with auto-parse and tool probing via Gateway Inspector Proxy.
 */
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Server,
  Plus,
  Check,
  ExternalLink,
  AlertCircle,
  Search,
  X,
  Trash2,
  Loader2,
  Wrench,
  Code2,
  FileJson,
  Zap,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";
import { useDesktopRouting } from "@/hooks/use-desktop-routing";
import {
  parseMcpConfigAll,
  validateMcpConfig,
  type McpServerConfig,
} from "@/hooks/use-mcp-connection";
import {
  useGatewayInspector,
  buildGatewayInspectorUrl,
  buildGatewayInspectorHeaders,
} from "@/hooks/use-gateway-inspector";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { type AgentMcpEntry, mcpConfigToEntry } from "@/lib/gateway/types/agent";
import type { McpTool } from "@/types";

// Re-export the type for consumers
export type { AgentMcpEntry };

interface AgentMcpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedServers: AgentMcpEntry[];
  onServersChange: (servers: AgentMcpEntry[]) => void;
}

const BUILTIN_MCP_SERVERS = [
  {
    name: "presentation",
    descKey: "settingsAgents.mcpBuiltinDesc.presentation",
    descDefault: "Presentation mode tools for slides and demos",
  },
];

type CustomFormTransport = "stdio" | "sse" | "http";
type CustomInputMode = "json" | "form";

interface KeyValuePair {
  key: string;
  value: string;
}

// Parsed server from JSON with probing state
interface ParsedServer {
  name: string;
  config: McpServerConfig;
  tools?: McpTool[];
  probing?: boolean;
  probeError?: string;
}

export function AgentMcpDialog({
  open,
  onOpenChange,
  selectedServers,
  onServersChange,
}: AgentMcpDialogProps) {
  const { t } = useTranslation();
  const { openPath } = useDesktopRouting();
  const mcpServers = useAppStore((state) => state.mcpServers);
  const [localSelected, setLocalSelected] = useState<AgentMcpEntry[]>(selectedServers);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("registered");

  // Custom mode state
  const [customInputMode, setCustomInputMode] = useState<CustomInputMode>("json");

  // Custom JSON state
  const [jsonInput, setJsonInput] = useState("");
  const [jsonParseError, setJsonParseError] = useState<string | null>(null);
  const [parsedServers, setParsedServers] = useState<ParsedServer[]>([]);

  // Custom form state
  const [customName, setCustomName] = useState("");
  const [customType, setCustomType] = useState<CustomFormTransport>("stdio");
  const [customCommand, setCustomCommand] = useState("");
  const [customArgs, setCustomArgs] = useState("");
  const [customUrl, setCustomUrl] = useState("");
  const [customEnv, setCustomEnv] = useState<KeyValuePair[]>([]);
  const [customHeaders, setCustomHeaders] = useState<KeyValuePair[]>([]);

  // Gateway Inspector for tool probing
  const { refreshStatus: refreshInspectorStatus } = useGatewayInspector();

  // Track active probe client for cleanup
  const activeProbeRef = useRef<Client | null>(null);

  // Sync local state when dialog opens
  useEffect(() => {
    if (open) {
      setLocalSelected(selectedServers);
      setSearchQuery("");
      setActiveTab("registered");
      setJsonInput("");
      setJsonParseError(null);
      setParsedServers([]);
      resetCustomForm();
    }
    return () => {
      // Cleanup any active probe on close
      if (activeProbeRef.current) {
        activeProbeRef.current.close().catch(() => {});
        activeProbeRef.current = null;
      }
    };
  }, [open, selectedServers]);

  const resetCustomForm = useCallback(() => {
    setCustomName("");
    setCustomType("stdio");
    setCustomCommand("");
    setCustomArgs("");
    setCustomUrl("");
    setCustomEnv([]);
    setCustomHeaders([]);
  }, []);

  // Helper: check if entry is in localSelected by name
  const isSelected = useCallback(
    (name: string) => localSelected.some((s) => s.name === name),
    [localSelected]
  );

  // Helper: toggle entry in localSelected
  const toggleEntry = useCallback(
    (entry: AgentMcpEntry) => {
      setLocalSelected((prev) =>
        prev.some((s) => s.name === entry.name)
          ? prev.filter((s) => s.name !== entry.name)
          : [...prev, entry]
      );
    },
    []
  );

  // Helper: remove entry by name
  const removeEntry = useCallback(
    (name: string) => {
      setLocalSelected((prev) => prev.filter((s) => s.name !== name));
    },
    []
  );

  // Determine which entries are "custom" (not matching registered or builtin names)
  const registeredNames = useMemo(
    () => new Set(mcpServers.map((s) => s.name)),
    [mcpServers]
  );
  const builtinNames = useMemo(
    () => new Set(BUILTIN_MCP_SERVERS.map((s) => s.name)),
    []
  );
  const customEntries = useMemo(
    () =>
      localSelected.filter(
        (s) => !registeredNames.has(s.name) && !builtinNames.has(s.name)
      ),
    [localSelected, registeredNames, builtinNames]
  );

  // Filter registered servers by search
  const filteredServers = useMemo(() => {
    if (!searchQuery.trim()) return mcpServers;
    const query = searchQuery.toLowerCase();
    return mcpServers.filter(
      (server) =>
        server.name.toLowerCase().includes(query) ||
        server.transport.toLowerCase().includes(query)
    );
  }, [mcpServers, searchQuery]);

  const handleSave = () => {
    onServersChange(localSelected);
    onOpenChange(false);
  };

  const handleGoToSearchService = () => {
    onOpenChange(false);
    openPath("/mcp-services/search-service", {
      title: t("nav.searchService", "Search Service"),
      icon: { type: "lucide", value: "search" },
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "running":
        return "bg-green-500";
      case "stopped":
        return "bg-gray-400";
      case "error":
        return "bg-red-500";
      default:
        return "bg-gray-400";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "running":
        return t("gateway.running");
      case "stopped":
        return t("gateway.stopped");
      default:
        return status;
    }
  };

  // ===========================================================================
  // JSON mode handlers
  // ===========================================================================

  const handleJsonInputChange = useCallback((value: string) => {
    setJsonInput(value);
    if (!value.trim()) {
      setJsonParseError(null);
      setParsedServers([]);
      return;
    }
    try {
      const servers = parseMcpConfigAll(value);
      // Validate each server
      const validated: ParsedServer[] = [];
      for (const { name, config } of servers) {
        const validation = validateMcpConfig(config);
        if (!validation.valid) {
          setJsonParseError(`${name}: ${validation.error}`);
          setParsedServers([]);
          return;
        }
        validated.push({ name, config });
      }
      setJsonParseError(null);
      setParsedServers(validated);
    } catch (e) {
      setJsonParseError((e as Error).message);
      setParsedServers([]);
    }
  }, []);

  // Probe tools for a parsed server
  const handleProbeTools = useCallback(async (serverIndex: number) => {
    const server = parsedServers[serverIndex];
    if (!server) return;

    // Refresh inspector status for fresh auth token
    const freshStatus = await refreshInspectorStatus();
    if (!freshStatus?.available) {
      setParsedServers((prev) =>
        prev.map((s, i) =>
          i === serverIndex
            ? { ...s, probing: false, probeError: t("settingsAgents.mcpCustom.probeError", "Probe failed") + ": Gateway Inspector unavailable" }
            : s
        )
      );
      return;
    }

    // Set probing state
    setParsedServers((prev) =>
      prev.map((s, i) =>
        i === serverIndex ? { ...s, probing: true, probeError: undefined, tools: undefined } : s
      )
    );

    try {
      const config = server.config;
      let proxyUrl: string;
      let proxyHeaders: Record<string, string>;

      if ("url" in config && config.url) {
        // Remote type (sse/http)
        proxyUrl = buildGatewayInspectorUrl(
          freshStatus.proxyUrl,
          config.url,
          (config.transport || "streamable-http") as "stdio" | "sse" | "streamable-http"
        );
        proxyHeaders = buildGatewayInspectorHeaders(
          freshStatus.authToken,
          config.headers
        );
      } else if ("command" in config && config.command) {
        // stdio type - proxy via /mcp with command params
        const base = freshStatus.proxyUrl.endsWith("/")
          ? freshStatus.proxyUrl
          : freshStatus.proxyUrl + "/";
        const url = new URL("mcp", base);
        url.searchParams.set("command", config.command);
        if (config.args?.length) {
          url.searchParams.set("args", JSON.stringify(config.args));
        }
        if (config.env) {
          url.searchParams.set("env", JSON.stringify(config.env));
        }
        url.searchParams.set("transportType", "stdio");
        proxyUrl = url.toString();
        proxyHeaders = buildGatewayInspectorHeaders(freshStatus.authToken);
      } else {
        throw new Error("Invalid config: missing command or url");
      }

      // Create MCP client and connect
      const client = new Client(
        { name: "agent-mcp-probe", version: "1.0.0" },
        { capabilities: {} }
      );
      activeProbeRef.current = client;

      const transport = new StreamableHTTPClientTransport(new URL(proxyUrl), {
        requestInit: {
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
            ...proxyHeaders,
          },
        },
      });

      await client.connect(transport);
      const result = await client.listTools();
      await client.close();
      activeProbeRef.current = null;

      const tools = result.tools as McpTool[];
      setParsedServers((prev) =>
        prev.map((s, i) =>
          i === serverIndex ? { ...s, probing: false, tools } : s
        )
      );
    } catch (e) {
      activeProbeRef.current = null;
      const errMsg = e instanceof Error ? e.message : String(e);
      setParsedServers((prev) =>
        prev.map((s, i) =>
          i === serverIndex ? { ...s, probing: false, probeError: errMsg } : s
        )
      );
    }
  }, [parsedServers, refreshInspectorStatus, t]);

  // Add a single parsed server to selection
  const handleAddParsedServer = useCallback((server: ParsedServer) => {
    const entry = mcpConfigToEntry(server.name, server.config);
    setLocalSelected((prev) => {
      const filtered = prev.filter((s) => s.name !== entry.name);
      return [...filtered, entry];
    });
  }, []);

  // Add all parsed servers
  const handleAddAllParsedServers = useCallback(() => {
    for (const server of parsedServers) {
      const entry = mcpConfigToEntry(server.name, server.config);
      setLocalSelected((prev) => {
        const filtered = prev.filter((s) => s.name !== entry.name);
        return [...filtered, entry];
      });
    }
  }, [parsedServers]);

  // ===========================================================================
  // Form mode handler
  // ===========================================================================

  const handleAddCustomServer = () => {
    if (!customName.trim()) return;

    const entry: AgentMcpEntry = {
      name: customName.trim(),
      type: customType,
    };

    if (customType === "stdio") {
      if (customCommand.trim()) entry.command = customCommand.trim();
      if (customArgs.trim()) {
        entry.args = customArgs
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean);
      }
      const envObj = kvPairsToRecord(customEnv);
      if (Object.keys(envObj).length > 0) entry.env = envObj;
    } else {
      if (customUrl.trim()) entry.url = customUrl.trim();
      const headersObj = kvPairsToRecord(customHeaders);
      if (Object.keys(headersObj).length > 0) entry.headers = headersObj;
    }

    setLocalSelected((prev) => {
      const filtered = prev.filter((s) => s.name !== entry.name);
      return [...filtered, entry];
    });
    resetCustomForm();
  };

  const hasChanges = JSON.stringify(localSelected) !== JSON.stringify(selectedServers);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-0 gap-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Server className="h-4 w-4 text-primary" />
            </div>
            {t("settingsAgents.configureMcp", { defaultValue: "Configure MCP Servers" })}
          </DialogTitle>
          <DialogDescription>
            {t("settingsAgents.configureMcpDesc", { defaultValue: "Select MCP servers to provide tools for your agent" })}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger
                value="registered"
                className={cn(
                  "px-3 py-2 text-xs",
                  activeTab === "registered" && "border-primary text-foreground"
                )}
              >
                {t("settingsAgents.mcpTab.registered", { defaultValue: "Registered" })}
              </TabsTrigger>
              <TabsTrigger
                value="builtin"
                className={cn(
                  "px-3 py-2 text-xs",
                  activeTab === "builtin" && "border-primary text-foreground"
                )}
              >
                {t("settingsAgents.mcpTab.builtin", { defaultValue: "Built-in" })}
              </TabsTrigger>
              <TabsTrigger
                value="custom"
                className={cn(
                  "px-3 py-2 text-xs",
                  activeTab === "custom" && "border-primary text-foreground"
                )}
              >
                {t("settingsAgents.mcpTab.custom", { defaultValue: "Custom" })}
              </TabsTrigger>
            </TabsList>

            {/* Tab 1: Registered */}
            <TabsContent value="registered" className="mt-3">
              <div className="space-y-3">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t("common.search", { defaultValue: "Search..." })}
                    className="pl-9 pr-9"
                  />
                  {searchQuery && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                      onClick={() => setSearchQuery("")}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>

                {/* Server List */}
                <ScrollArea className="max-h-[280px]">
                  {mcpServers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
                        <AlertCircle className="h-7 w-7 text-muted-foreground" />
                      </div>
                      <p className="text-sm font-medium mb-1">
                        {t("settingsAgents.noMcpServersAvailable")}
                      </p>
                      <p className="text-xs text-muted-foreground mb-4">
                        {t("settingsAgents.noMcpServersHint")}
                      </p>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={handleGoToSearchService}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        {t("settingsAgents.createNewServer")}
                      </Button>
                    </div>
                  ) : filteredServers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <p className="text-sm text-muted-foreground">
                        {t("common.noResults")}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 pb-2">
                      {filteredServers.map((server) => {
                        const selected = isSelected(server.name);
                        return (
                          <button
                            key={server.id}
                            onClick={() => {
                              const entry: AgentMcpEntry = {
                                name: server.name,
                                type: server.transport as "stdio" | "sse" | "http",
                              };
                              if (server.transport === "stdio" && server.downloadPath) {
                                entry.command = server.downloadPath;
                              }
                              toggleEntry(entry);
                            }}
                            className={cn(
                              "w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left group",
                              selected
                                ? "border-primary bg-primary/5 shadow-sm"
                                : "border-border hover:border-primary/50 hover:bg-muted/50"
                            )}
                          >
                            <Checkbox checked={selected} className="shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm truncate">
                                  {server.name}
                                </span>
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1.5 py-0 shrink-0"
                                >
                                  {server.transport.toUpperCase()}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <div className="flex items-center gap-1.5">
                                  <div
                                    className={cn(
                                      "h-1.5 w-1.5 rounded-full",
                                      getStatusColor(server.status)
                                    )}
                                  />
                                  <span className="text-[10px] text-muted-foreground">
                                    {getStatusLabel(server.status)}
                                  </span>
                                </div>
                                <span className="text-[10px] text-muted-foreground">
                                  &bull;
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  {server.enabledSources.length}{" "}
                                  {t("searchService.sources")}
                                </span>
                                {server.port && (
                                  <>
                                    <span className="text-[10px] text-muted-foreground">
                                      &bull;
                                    </span>
                                    <span className="text-[10px] text-muted-foreground">
                                      :{server.port}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                            {selected && (
                              <Check className="h-4 w-4 text-primary shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>

                {/* Bottom link */}
                {mcpServers.length > 0 && (
                  <div className="pt-1">
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs text-muted-foreground"
                      onClick={handleGoToSearchService}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      {t("settingsAgents.goToMcpServices", { defaultValue: "Go to MCP services" })}
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Tab 2: Built-in */}
            <TabsContent value="builtin" className="mt-3">
              <ScrollArea className="max-h-[280px]">
                <div className="space-y-2 pb-2">
                  {BUILTIN_MCP_SERVERS.map((server) => {
                    const selected = isSelected(server.name);
                    return (
                      <button
                        key={server.name}
                        onClick={() =>
                          toggleEntry({ name: server.name, type: "builtin" })
                        }
                        className={cn(
                          "w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left group",
                          selected
                            ? "border-primary bg-primary/5 shadow-sm"
                            : "border-border hover:border-primary/50 hover:bg-muted/50"
                        )}
                      >
                        <Checkbox checked={selected} className="shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">
                              {server.name}
                            </span>
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 shrink-0"
                            >
                              {t("common.builtIn")}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {t(server.descKey, { defaultValue: server.descDefault })}
                          </p>
                        </div>
                        {selected && (
                          <Check className="h-4 w-4 text-primary shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Tab 3: Custom */}
            <TabsContent value="custom" className="mt-3">
              <ScrollArea className="max-h-[380px]">
                <div className="space-y-3 pb-2">
                  {/* Mode toggle */}
                  <div className="flex items-center gap-1 p-0.5 rounded-md bg-muted/50 w-fit">
                    <button
                      type="button"
                      onClick={() => setCustomInputMode("json")}
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors",
                        customInputMode === "json"
                          ? "bg-background shadow-sm text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <FileJson className="h-3 w-3" />
                      {t("settingsAgents.mcpCustom.jsonMode", { defaultValue: "JSON" })}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomInputMode("form")}
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors",
                        customInputMode === "form"
                          ? "bg-background shadow-sm text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Code2 className="h-3 w-3" />
                      {t("settingsAgents.mcpCustom.formMode", { defaultValue: "Form" })}
                    </button>
                  </div>

                  {/* JSON Mode */}
                  {customInputMode === "json" && (
                    <div className="space-y-3">
                      {/* JSON textarea */}
                      <div className="space-y-1.5">
                        <Textarea
                          value={jsonInput}
                          onChange={(e) => handleJsonInputChange(e.target.value)}
                          placeholder={t("settingsAgents.mcpCustom.jsonPlaceholder", {
                            defaultValue: "Paste MCP server JSON configuration...\n\nSupported formats:\n• Single server: { \"command\": \"...\", \"args\": [...] }\n• Multiple servers: { \"mcpServers\": { \"name\": { ... } } }",
                          })}
                          className="min-h-[120px] font-mono text-xs resize-y"
                        />
                        {/* Parse error */}
                        {jsonParseError && (
                          <div className="flex items-start gap-1.5 text-destructive">
                            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                            <span className="text-xs">{jsonParseError}</span>
                          </div>
                        )}
                      </div>

                      {/* Parsed servers */}
                      {parsedServers.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">
                              {t("settingsAgents.mcpCustom.parsedServers", {
                                defaultValue: "Parsed {{count}} server(s)",
                                count: parsedServers.length,
                              })}
                            </span>
                            {parsedServers.length > 1 && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 text-[10px] px-2"
                                onClick={handleAddAllParsedServers}
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                {t("settingsAgents.mcpCustom.addAllServers", { defaultValue: "Add all" })}
                              </Button>
                            )}
                          </div>

                          {parsedServers.map((server, idx) => (
                            <ParsedServerCard
                              key={`${server.name}-${idx}`}
                              server={server}
                              isAlreadyAdded={isSelected(server.name)}
                              onProbe={() => handleProbeTools(idx)}
                              onAdd={() => handleAddParsedServer(server)}
                              t={t}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Form Mode */}
                  {customInputMode === "form" && (
                    <div className="space-y-4">
                      {/* Custom form */}
                      <div className="space-y-3 rounded-lg border p-3">
                        {/* Name */}
                        <div className="space-y-1.5">
                          <Label className="text-xs">
                            {t("settingsAgents.mcpCustomForm.name", { defaultValue: "Server Name" })}
                          </Label>
                          <Input
                            value={customName}
                            onChange={(e) => setCustomName(e.target.value)}
                            placeholder={t("settingsAgents.mcpCustomForm.namePlaceholder")}
                            className="h-8 text-sm"
                          />
                        </div>

                        {/* Type */}
                        <div className="space-y-1.5">
                          <Label className="text-xs">
                            {t("settingsAgents.mcpCustomForm.type", { defaultValue: "Transport Type" })}
                          </Label>
                          <Select
                            value={customType}
                            onValueChange={(v) =>
                              setCustomType(v as CustomFormTransport)
                            }
                          >
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="stdio">stdio</SelectItem>
                              <SelectItem value="sse">sse</SelectItem>
                              <SelectItem value="http">http</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* stdio fields */}
                        {customType === "stdio" && (
                          <>
                            <div className="space-y-1.5">
                              <Label className="text-xs">
                                {t("settingsAgents.mcpCustomForm.command", { defaultValue: "Command" })}
                              </Label>
                              <Input
                                value={customCommand}
                                onChange={(e) => setCustomCommand(e.target.value)}
                                placeholder={t(
                                  "settingsAgents.mcpCustomForm.commandPlaceholder"
                                )}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs">
                                {t("settingsAgents.mcpCustomForm.args", { defaultValue: "Arguments" })}
                              </Label>
                              <Input
                                value={customArgs}
                                onChange={(e) => setCustomArgs(e.target.value)}
                                placeholder={t(
                                  "settingsAgents.mcpCustomForm.argsPlaceholder"
                                )}
                                className="h-8 text-sm"
                              />
                            </div>
                            {/* Env key-value pairs */}
                            <KeyValueEditor
                              label={t("settingsAgents.mcpCustomForm.env", { defaultValue: "Environment Variables" })}
                              keyPlaceholder={t("settingsAgents.mcpCustomForm.envKey")}
                              valuePlaceholder={t("settingsAgents.mcpCustomForm.envValue")}
                              addLabel={t("settingsAgents.mcpCustomForm.addEnv")}
                              pairs={customEnv}
                              onChange={setCustomEnv}
                            />
                          </>
                        )}

                        {/* sse/http fields */}
                        {(customType === "sse" || customType === "http") && (
                          <>
                            <div className="space-y-1.5">
                              <Label className="text-xs">
                                {t("settingsAgents.mcpCustomForm.url", { defaultValue: "URL" })}
                              </Label>
                              <Input
                                value={customUrl}
                                onChange={(e) => setCustomUrl(e.target.value)}
                                placeholder={t(
                                  "settingsAgents.mcpCustomForm.urlPlaceholder"
                                )}
                                className="h-8 text-sm"
                              />
                            </div>
                            {/* Headers key-value pairs */}
                            <KeyValueEditor
                              label={t("settingsAgents.mcpCustomForm.headers", { defaultValue: "Headers" })}
                              keyPlaceholder="Key"
                              valuePlaceholder="Value"
                              addLabel={t("settingsAgents.mcpCustomForm.addHeader")}
                              pairs={customHeaders}
                              onChange={setCustomHeaders}
                            />
                          </>
                        )}

                        <Button
                          size="sm"
                          className="w-full"
                          disabled={!customName.trim()}
                          onClick={handleAddCustomServer}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          {t("settingsAgents.mcpCustomForm.addEntry", { defaultValue: "Add Server" })}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Already-added custom entries (shown in both modes) */}
                  {customEntries.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">
                        {t("settingsAgents.mcpTab.custom", { defaultValue: "Custom" })} ({customEntries.length})
                      </Label>
                      {customEntries.map((entry) => (
                        <div
                          key={entry.name}
                          className="flex items-center gap-3 p-3 rounded-lg border border-border"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm truncate">
                                {entry.name}
                              </span>
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1.5 py-0 shrink-0"
                              >
                                {entry.type.toUpperCase()}
                              </Badge>
                            </div>
                            {entry.command && (
                              <p className="text-[10px] text-muted-foreground mt-1 truncate">
                                {entry.command}
                                {entry.args ? ` ${entry.args.join(" ")}` : ""}
                              </p>
                            )}
                            {entry.url && (
                              <p className="text-[10px] text-muted-foreground mt-1 truncate">
                                {entry.url}
                              </p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => removeEntry(entry.name)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="p-6 pt-4 border-t bg-muted/30 mt-4">
          <div className="flex w-full items-center justify-end">
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                {t("common.cancel")}
              </Button>
              <Button onClick={handleSave} disabled={!hasChanges}>
                {t("common.save")}
                {hasChanges && localSelected.length > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-2 text-[10px] px-1.5"
                  >
                    {localSelected.length}
                  </Badge>
                )}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// ParsedServerCard - Shows a parsed server with probe button and tool cards
// ============================================================================

interface ParsedServerCardProps {
  server: ParsedServer;
  isAlreadyAdded: boolean;
  onProbe: () => void;
  onAdd: () => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}

function ParsedServerCard({ server, isAlreadyAdded, onProbe, onAdd, t }: ParsedServerCardProps) {
  const transportLabel = "command" in server.config ? "STDIO" :
    (server.config as { transport?: string }).transport?.toUpperCase() || "HTTP";

  return (
    <div className="rounded-lg border p-3 space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-medium text-sm truncate">{server.name}</span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
            {transportLabel}
          </Badge>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] px-2"
            onClick={onProbe}
            disabled={server.probing}
          >
            {server.probing ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <Zap className="h-3 w-3 mr-1" />
            )}
            {server.probing
              ? t("settingsAgents.mcpCustom.probing", { defaultValue: "Probing..." })
              : t("settingsAgents.mcpCustom.probeTools", { defaultValue: "Probe Tools" })}
          </Button>
          <Button
            variant={isAlreadyAdded ? "secondary" : "default"}
            size="sm"
            className="h-6 text-[10px] px-2"
            onClick={onAdd}
            disabled={isAlreadyAdded}
          >
            {isAlreadyAdded ? (
              <Check className="h-3 w-3 mr-1" />
            ) : (
              <Plus className="h-3 w-3 mr-1" />
            )}
            {isAlreadyAdded
              ? t("common.added", { defaultValue: "Added" })
              : t("settingsAgents.mcpCustom.addServer", { defaultValue: "Add" })}
          </Button>
        </div>
      </div>

      {/* Config summary */}
      <div className="text-[10px] text-muted-foreground truncate">
        {"command" in server.config && server.config.command && (
          <span>
            {server.config.command}
            {server.config.args ? ` ${server.config.args.join(" ")}` : ""}
          </span>
        )}
        {"url" in server.config && server.config.url && (
          <span>{server.config.url}</span>
        )}
      </div>

      {/* Probe error */}
      {server.probeError && (
        <div className="flex items-start gap-1.5 text-destructive">
          <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
          <span className="text-[10px] line-clamp-2">{server.probeError}</span>
        </div>
      )}

      {/* Tool cards */}
      {server.tools && server.tools.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Wrench className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">
              {t("settingsAgents.mcpCustom.toolsFound", {
                defaultValue: "{{count}} tool(s) found",
                count: server.tools.length,
              })}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {server.tools.map((tool) => (
              <ToolCard key={tool.name} tool={tool} />
            ))}
          </div>
        </div>
      )}

      {/* Connected but no tools */}
      {server.tools && server.tools.length === 0 && (
        <div className="text-[10px] text-muted-foreground italic">
          {t("settingsAgents.mcpCustom.noTools", { defaultValue: "No tools available" })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// ToolCard - Compact tool display
// ============================================================================

function ToolCard({ tool }: { tool: McpTool }) {
  return (
    <div
      className="px-2 py-1 rounded-md border bg-muted/30 max-w-[160px]"
      title={tool.description || tool.name}
    >
      <div className="text-[10px] font-medium truncate">{tool.name}</div>
      {tool.description && (
        <div className="text-[9px] text-muted-foreground truncate mt-0.5">
          {tool.description}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// KeyValueEditor sub-component
// ============================================================================

interface KeyValueEditorProps {
  label: string;
  keyPlaceholder: string;
  valuePlaceholder: string;
  addLabel: string;
  pairs: KeyValuePair[];
  onChange: (pairs: KeyValuePair[]) => void;
}

function KeyValueEditor({
  label,
  keyPlaceholder,
  valuePlaceholder,
  addLabel,
  pairs,
  onChange,
}: KeyValueEditorProps) {
  const addPair = () => {
    onChange([...pairs, { key: "", value: "" }]);
  };

  const updatePair = (index: number, field: "key" | "value", val: string) => {
    const updated = pairs.map((p, i) =>
      i === index ? { ...p, [field]: val } : p
    );
    onChange(updated);
  };

  const removePair = (index: number) => {
    onChange(pairs.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {pairs.map((pair, idx) => (
        <div key={idx} className="flex items-center gap-1.5">
          <Input
            value={pair.key}
            onChange={(e) => updatePair(idx, "key", e.target.value)}
            placeholder={keyPlaceholder}
            className="h-7 text-xs flex-1"
          />
          <Input
            value={pair.value}
            onChange={(e) => updatePair(idx, "value", e.target.value)}
            placeholder={valuePlaceholder}
            className="h-7 text-xs flex-1"
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={() => removePair(idx)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        className="h-7 text-xs"
        onClick={addPair}
      >
        <Plus className="h-3 w-3 mr-1" />
        {addLabel}
      </Button>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function kvPairsToRecord(pairs: KeyValuePair[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const pair of pairs) {
    if (pair.key.trim()) {
      result[pair.key.trim()] = pair.value;
    }
  }
  return result;
}
