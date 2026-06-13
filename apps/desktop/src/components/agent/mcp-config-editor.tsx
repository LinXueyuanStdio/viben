/**
 * MCP Config Editor
 *
 * Inline JSON/Rich toggle editor for MCP server configuration.
 * - Rich mode (default): List of server entries with name, type badge, and delete button
 * - JSON mode: Textarea showing full JSON configuration for direct editing
 */
import { useState, useEffect, useCallback } from "react";
import { Server, X, Code, List } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { AgentMcpEntry } from "@/lib/gateway/types/agent";
import { mcpConfigToEntry } from "@/lib/gateway/types/agent";

// ============================================================================
// Types
// ============================================================================

interface McpConfigEditorProps {
  servers: AgentMcpEntry[];
  onServersChange: (servers: AgentMcpEntry[]) => void;
  onOpenDialog: () => void;
  className?: string;
}

type EditorMode = "rich" | "json";

// ============================================================================
// Helpers
// ============================================================================

/**
 * Convert AgentMcpEntry[] to the standard MCP config JSON format:
 * { "mcpServers": { "name1": {...}, "name2": {...} } }
 */
function entriesToJson(entries: AgentMcpEntry[]): string {
  const mcpServers: Record<string, Record<string, unknown>> = {};

  for (const entry of entries) {
    const config: Record<string, unknown> = {};

    if (entry.type === "stdio") {
      if (entry.command) config.command = entry.command;
      if (entry.args && entry.args.length > 0) config.args = entry.args;
      if (entry.env && Object.keys(entry.env).length > 0) config.env = entry.env;
    } else if (entry.type === "sse" || entry.type === "http") {
      if (entry.url) config.url = entry.url;
      if (entry.headers && Object.keys(entry.headers).length > 0) config.headers = entry.headers;
      if (entry.type === "sse") config.transport = "sse";
    } else if (entry.type === "builtin") {
      config.type = "builtin";
    }

    mcpServers[entry.name] = config;
  }

  return JSON.stringify({ mcpServers }, null, 2);
}

/**
 * Parse the standard MCP config JSON format back to AgentMcpEntry[].
 * Returns null if the JSON is invalid.
 */
function jsonToEntries(jsonStr: string): AgentMcpEntry[] | null {
  try {
    const parsed = JSON.parse(jsonStr);
    if (!parsed || typeof parsed !== "object") return null;

    const mcpServers = parsed.mcpServers;
    if (!mcpServers || typeof mcpServers !== "object") return null;

    const entries: AgentMcpEntry[] = [];
    for (const [name, config] of Object.entries(mcpServers)) {
      if (config && typeof config === "object") {
        entries.push(mcpConfigToEntry(name, config as Record<string, unknown>));
      }
    }
    return entries;
  } catch {
    return null;
  }
}

// ============================================================================
// Component
// ============================================================================

export function McpConfigEditor({
  servers,
  onServersChange,
  onOpenDialog,
  className,
}: McpConfigEditorProps) {
  const [mode, setMode] = useState<EditorMode>("rich");
  const [jsonText, setJsonText] = useState(() => entriesToJson(servers));
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Sync JSON text when servers prop changes (only in rich mode or when JSON matches)
  useEffect(() => {
    if (mode === "rich") {
      setJsonText(entriesToJson(servers));
      setJsonError(null);
    }
  }, [servers, mode]);

  // When switching to JSON mode, refresh the JSON text from current servers
  const handleModeChange = useCallback(
    (newMode: EditorMode) => {
      if (newMode === "json") {
        setJsonText(entriesToJson(servers));
        setJsonError(null);
      }
      setMode(newMode);
    },
    [servers]
  );

  // Handle JSON text change
  const handleJsonChange = useCallback((value: string) => {
    setJsonText(value);
    // Clear error on typing
    setJsonError(null);
  }, []);

  // Parse and apply JSON on blur
  const handleJsonBlur = useCallback(() => {
    const trimmed = jsonText.trim();
    if (!trimmed) {
      // Empty means clear all servers
      onServersChange([]);
      setJsonError(null);
      return;
    }

    const entries = jsonToEntries(trimmed);
    if (entries === null) {
      setJsonError("JSON 格式无效，请检查语法");
    } else {
      setJsonError(null);
      onServersChange(entries);
    }
  }, [jsonText, onServersChange]);

  // Remove a server by name
  const handleRemoveServer = useCallback(
    (name: string) => {
      onServersChange(servers.filter((s) => s.name !== name));
    },
    [servers, onServersChange]
  );

  return (
    <div className={cn("space-y-2", className)}>
      {/* Top controls: mode toggle + configure button */}
      <div className="flex items-center justify-between gap-2">
        {/* Mode toggle */}
        <div className="flex h-7 rounded-md border border-border overflow-hidden">
          <button
            type="button"
            className={cn(
              "flex items-center justify-center gap-1 px-2.5 text-xs transition-colors",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset",
              mode === "rich"
                ? "bg-accent text-accent-foreground font-medium"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
            onClick={() => handleModeChange("rich")}
          >
            <List className="h-3 w-3" />
            <span>Rich</span>
          </button>
          <button
            type="button"
            className={cn(
              "flex items-center justify-center gap-1 px-2.5 text-xs transition-colors border-l border-border",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset",
              mode === "json"
                ? "bg-accent text-accent-foreground font-medium"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
            onClick={() => handleModeChange("json")}
          >
            <Code className="h-3 w-3" />
            <span>JSON</span>
          </button>
        </div>

        {/* Configure button */}
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onOpenDialog}>
          配置
        </Button>
      </div>

      {/* Content area */}
      {mode === "rich" ? (
        // Rich mode: server list
        servers.length > 0 ? (
          <div className="space-y-1.5">
            {servers.map((server) => (
              <div
                key={server.name}
                className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 group"
              >
                <Server className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-sm flex-1 truncate">{server.name}</span>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                  {server.type.toUpperCase()}
                </Badge>
                <button
                  type="button"
                  onClick={() => handleRemoveServer(server.name)}
                  className="p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-4 text-center">
            <Server className="h-5 w-5 mx-auto text-muted-foreground/50 mb-1.5" />
            <p className="text-xs text-muted-foreground">暂无 MCP 服务器配置</p>
          </div>
        )
      ) : (
        // JSON mode: textarea editor
        <div className="space-y-1.5">
          <Textarea
            value={jsonText}
            onChange={(e) => handleJsonChange(e.target.value)}
            onBlur={handleJsonBlur}
            placeholder='{ "mcpServers": {} }'
            rows={10}
            className="font-mono text-xs resize-y"
          />
          {jsonError && (
            <p className="text-xs text-destructive">{jsonError}</p>
          )}
        </div>
      )}
    </div>
  );
}
