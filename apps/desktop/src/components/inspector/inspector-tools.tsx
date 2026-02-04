import { useState, useEffect, useMemo } from "react";
import {
  Wrench,
  Play,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Search,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";
import type { McpTool } from "@/types";

interface InspectorToolsProps {
  makeRequest: <T = unknown>(method: string, params?: Record<string, unknown>) => Promise<T>;
  enabled?: boolean;
}

interface ToolExecution {
  id: string;
  toolName: string;
  arguments: Record<string, unknown>;
  timestamp: Date;
  status: "running" | "success" | "error";
  result?: unknown;
  error?: string;
  duration?: number;
}

interface ArgumentInput {
  key: string;
  value: string;
  type: string;
  required: boolean;
  description?: string;
}

export function InspectorTools({ makeRequest, enabled = true }: InspectorToolsProps) {
  const { t } = useTranslation();
  const [tools, setTools] = useState<McpTool[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTool, setSelectedTool] = useState<McpTool | null>(null);
  const [argumentInputs, setArgumentInputs] = useState<ArgumentInput[]>([]);
  const [executions, setExecutions] = useState<ToolExecution[]>([]);
  const [executing, setExecuting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedExecutions, setExpandedExecutions] = useState<Set<string>>(new Set());

  // Filter tools by search query
  const filteredTools = useMemo(() => {
    if (!searchQuery.trim()) return tools;
    const query = searchQuery.toLowerCase();
    return tools.filter(
      (tool) =>
        tool.name.toLowerCase().includes(query) ||
        tool.description?.toLowerCase().includes(query)
    );
  }, [tools, searchQuery]);

  const fetchTools = async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const response = await makeRequest<{ tools: McpTool[] }>("tools/list", {});
      setTools(response.tools || []);
      if (response.tools && response.tools.length > 0 && !selectedTool) {
        setSelectedTool(response.tools[0]);
      }
    } catch (error) {
      console.error("Error listing tools:", error);
      setTools([]);
    } finally {
      setLoading(false);
    }
  };

  const clearAll = () => {
    setTools([]);
    setSelectedTool(null);
    setExecutions([]);
    setSearchQuery("");
  };

  useEffect(() => {
    if (!selectedTool) {
      setArgumentInputs([]);
      return;
    }

    const properties = (selectedTool.inputSchema?.properties as Record<string, Record<string, unknown>>) || {};
    const required = (selectedTool.inputSchema?.required as string[]) || [];

    const inputs: ArgumentInput[] = Object.entries(properties).map(([key, schema]) => {
      let defaultValue = "";
      let type = "text";

      if (schema.type === "string") {
        defaultValue = (schema.default as string) || (schema.example as string) || "";
        type = "text";
      } else if (schema.type === "number" || schema.type === "integer") {
        defaultValue = schema.default?.toString() || schema.example?.toString() || "";
        type = "number";
      } else if (schema.type === "boolean") {
        defaultValue = schema.default?.toString() || "false";
        type = "boolean";
      } else if (schema.type === "array" || schema.type === "object") {
        defaultValue = JSON.stringify(
          schema.default || schema.example || (schema.type === "array" ? [] : {}),
          null,
          2
        );
        type = "json";
      } else {
        defaultValue = JSON.stringify(schema.default || schema.example || null, null, 2);
        type = "json";
      }

      return { key, value: defaultValue, type, required: required.includes(key), description: schema.description as string | undefined };
    });

    setArgumentInputs(inputs);
  }, [selectedTool]);

  const executeTool = async () => {
    if (!selectedTool) return;

    const argumentsObj: Record<string, unknown> = {};
    for (const input of argumentInputs) {
      try {
        if (input.type === "number") {
          argumentsObj[input.key] = input.value ? parseFloat(input.value) : 0;
        } else if (input.type === "boolean") {
          argumentsObj[input.key] = input.value === "true";
        } else if (input.type === "json") {
          argumentsObj[input.key] = input.value ? JSON.parse(input.value) : null;
        } else {
          argumentsObj[input.key] = input.value;
        }
      } catch {
        console.error(`Invalid JSON for parameter: ${input.key}`);
        return;
      }
    }

    setExecuting(true);
    const startTime = Date.now();
    const executionId = `exec-${Date.now()}`;

    const newExecution: ToolExecution = {
      id: executionId,
      toolName: selectedTool.name,
      arguments: argumentsObj,
      timestamp: new Date(),
      status: "running",
    };

    setExecutions((prev) => [newExecution, ...prev]);
    setExpandedExecutions((prev) => new Set([...prev, executionId]));

    try {
      const response = await makeRequest("tools/call", { name: selectedTool.name, arguments: argumentsObj });
      const duration = Date.now() - startTime;
      setExecutions((prev) =>
        prev.map((exec) => (exec.id === executionId ? { ...exec, status: "success", result: response, duration } : exec))
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      setExecutions((prev) =>
        prev.map((exec) =>
          exec.id === executionId
            ? { ...exec, status: "error", error: error instanceof Error ? error.message : String(error), duration }
            : exec
        )
      );
    } finally {
      setExecuting(false);
    }
  };

  const updateArgumentValue = (key: string, value: string) => {
    setArgumentInputs((prev) => prev.map((input) => (input.key === key ? { ...input, value } : input)));
  };

  const copyResult = async (execution: ToolExecution) => {
    const text = JSON.stringify(execution.result || execution.error, null, 2);
    await navigator.clipboard.writeText(text);
    setCopiedId(execution.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleExecution = (id: string) => {
    setExpandedExecutions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const formatDuration = (ms: number) => (ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`);

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "running":
        return { icon: Loader2, color: "text-blue-500", bg: "bg-blue-500/10", animate: true };
      case "success":
        return { icon: CheckCircle, color: "text-green-500", bg: "bg-green-500/10", animate: false };
      case "error":
        return { icon: XCircle, color: "text-red-500", bg: "bg-red-500/10", animate: false };
      default:
        return { icon: Clock, color: "text-muted-foreground", bg: "bg-muted", animate: false };
    }
  };

  if (!enabled) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <AlertTriangle className="h-10 w-10 text-muted-foreground mb-3" />
        <h4 className="text-sm font-medium">{t("inspector.toolsNotSupported")}</h4>
        <p className="text-xs text-muted-foreground mt-1">{t("inspector.toolsNotSupportedDesc")}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full gap-4">
      {/* Left Panel - Tool List */}
      <div className="w-72 flex-shrink-0 flex flex-col border-r border-border pr-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-medium">{t("inspector.tools")}</span>
            <Badge variant="secondary" className="h-5 px-1.5 text-xs">{tools.length}</Badge>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={clearAll} disabled={tools.length === 0}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={fetchTools} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder={t("inspector.searchTools")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>

        {/* Tool List */}
        <div className="flex-1 overflow-auto space-y-1">
          {tools.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-4">
              <Wrench className="h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-xs text-muted-foreground">{t("inspector.clickListTools")}</p>
              <Button size="sm" className="mt-3" onClick={fetchTools} disabled={loading}>
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                {t("inspector.listTools")}
              </Button>
            </div>
          ) : filteredTools.length === 0 ? (
            <div className="text-center p-4 text-xs text-muted-foreground">
              {t("inspector.noToolsFound")}
            </div>
          ) : (
            filteredTools.map((tool) => (
              <div
                key={tool.name}
                onClick={() => setSelectedTool(tool)}
                className={`p-2.5 rounded-lg cursor-pointer transition-colors ${
                  selectedTool?.name === tool.name
                    ? "bg-blue-500/10 border border-blue-500/30"
                    : "hover:bg-muted/50 border border-transparent"
                }`}
              >
                <div className="font-mono text-xs font-medium truncate">{tool.name}</div>
                {tool.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{tool.description}</p>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Middle Panel - Tool Details & Arguments */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedTool ? (
          <>
            {/* Tool Header */}
            <div className="mb-4">
              <h3 className="font-mono text-base font-semibold">{selectedTool.name}</h3>
              {selectedTool.description && (
                <p className="text-sm text-muted-foreground mt-1">{selectedTool.description}</p>
              )}
            </div>

            {/* Arguments */}
            <div className="flex-1 overflow-auto">
              {argumentInputs.length > 0 ? (
                <div className="space-y-4">
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {t("inspector.arguments")}
                  </h4>
                  {argumentInputs.map((input) => (
                    <div key={input.key} className="space-y-1.5">
                      <label className="flex items-center gap-1.5 text-sm font-medium">
                        {input.key}
                        {input.required && <span className="text-red-500">*</span>}
                        <Badge variant="outline" className="h-4 px-1 text-[10px] font-normal">
                          {input.type}
                        </Badge>
                      </label>
                      {input.description && (
                        <p className="text-xs text-muted-foreground">{input.description}</p>
                      )}
                      {input.type === "json" ? (
                        <Textarea
                          value={input.value}
                          onChange={(e) => updateArgumentValue(input.key, e.target.value)}
                          placeholder={`Enter ${input.type} value...`}
                          className="font-mono text-xs min-h-[80px]"
                        />
                      ) : input.type === "boolean" ? (
                        <select
                          value={input.value}
                          onChange={(e) => updateArgumentValue(input.key, e.target.value)}
                          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors"
                        >
                          <option value="true">true</option>
                          <option value="false">false</option>
                        </select>
                      ) : (
                        <Input
                          type={input.type === "number" ? "number" : "text"}
                          value={input.value}
                          onChange={(e) => updateArgumentValue(input.key, e.target.value)}
                          placeholder={`Enter ${input.type} value...`}
                          className={input.type === "text" ? "font-mono" : ""}
                        />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">{t("inspector.noArguments")}</div>
              )}
            </div>

            {/* Execute Button */}
            <div className="mt-4 pt-4 border-t border-border">
              <Button onClick={executeTool} disabled={executing} className="w-full">
                {executing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                {executing ? t("inspector.calling") : t("inspector.callTool")}
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Wrench className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">{t("inspector.selectTool")}</p>
          </div>
        )}
      </div>

      {/* Right Panel - Execution History */}
      <div className="w-80 flex-shrink-0 flex flex-col border-l border-border pl-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{t("inspector.executionHistory")}</span>
            <Badge variant="secondary" className="h-5 px-1.5 text-xs">{executions.length}</Badge>
          </div>
          {executions.length > 0 && (
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setExecutions([])}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-auto space-y-2">
          {executions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-4">
              <Clock className="h-8 w-8 text-muted-foreground/30 mb-2" />
              <p className="text-xs text-muted-foreground">{t("inspector.noExecutions")}</p>
            </div>
          ) : (
            executions.map((execution) => {
              const style = getStatusStyle(execution.status);
              const Icon = style.icon;
              const isExpanded = expandedExecutions.has(execution.id);

              return (
                <div key={execution.id} className="rounded-lg border border-border overflow-hidden">
                  <div
                    className="flex items-center gap-2 p-2.5 cursor-pointer hover:bg-muted/50"
                    onClick={() => toggleExecution(execution.id)}
                  >
                    <button className="p-0.5">
                      {isExpanded ? (
                        <ChevronDown className="h-3 w-3 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                      )}
                    </button>
                    <div className={`p-1 rounded ${style.bg}`}>
                      <Icon className={`h-3 w-3 ${style.color} ${style.animate ? "animate-spin" : ""}`} />
                    </div>
                    <span className="font-mono text-xs flex-1 truncate">{execution.toolName}</span>
                    <span className="text-xs text-muted-foreground">
                      {execution.duration !== undefined ? formatDuration(execution.duration) : "..."}
                    </span>
                  </div>

                  {isExpanded && (
                    <div className="px-2.5 pb-2.5 space-y-2">
                      {/* Arguments */}
                      {Object.keys(execution.arguments).length > 0 && (
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">{t("inspector.arguments")}:</div>
                          <pre className="text-xs bg-muted/50 p-2 rounded overflow-x-auto max-h-24">
                            {JSON.stringify(execution.arguments, null, 2)}
                          </pre>
                        </div>
                      )}

                      {/* Result or Error */}
                      {execution.status !== "running" && (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-muted-foreground">
                              {execution.error ? t("common.error") : t("inspector.result")}:
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                copyResult(execution);
                              }}
                            >
                              {copiedId === execution.id ? (
                                <Check className="h-3 w-3 text-green-500" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                          <pre
                            className={`text-xs p-2 rounded overflow-x-auto max-h-48 ${
                              execution.error ? "bg-red-500/10 text-red-600 dark:text-red-400" : "bg-muted/50"
                            }`}
                          >
                            {JSON.stringify(execution.error || execution.result, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
