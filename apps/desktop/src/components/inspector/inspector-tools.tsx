import { useState, useEffect, useMemo, useCallback } from "react";
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
  Code2,
  FileJson,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  const [showSchema, setShowSchema] = useState(false);
  const [inputMode, setInputMode] = useState<"form" | "json">("form");
  const [jsonInput, setJsonInput] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);

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
      setJsonInput("{}");
      setJsonError(null);
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

    // Initialize JSON input with default values
    const defaultArgs: Record<string, unknown> = {};
    inputs.forEach((input) => {
      if (input.type === "json") {
        try {
          defaultArgs[input.key] = JSON.parse(input.value);
        } catch {
          defaultArgs[input.key] = input.value;
        }
      } else if (input.type === "number") {
        defaultArgs[input.key] = input.value ? parseFloat(input.value) : 0;
      } else if (input.type === "boolean") {
        defaultArgs[input.key] = input.value === "true";
      } else {
        defaultArgs[input.key] = input.value;
      }
    });
    setJsonInput(JSON.stringify(defaultArgs, null, 2));
    setJsonError(null);
  }, [selectedTool]);

  // Validate JSON input and provide error feedback
  const validateJsonInput = useCallback((value: string): { valid: boolean; error?: string; parsed?: Record<string, unknown> } => {
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        return { valid: false, error: t("inspector.jsonMustBeObject", "JSON must be an object") };
      }

      // Validate against schema if available
      if (selectedTool?.inputSchema) {
        const properties = (selectedTool.inputSchema.properties as Record<string, Record<string, unknown>>) || {};
        const required = (selectedTool.inputSchema.required as string[]) || [];

        // Check required fields
        for (const field of required) {
          if (!(field in parsed)) {
            return { valid: false, error: t("inspector.missingRequired", "Missing required field: {{field}}").replace("{{field}}", field) };
          }
        }

        // Type check each field
        for (const [key, value] of Object.entries(parsed)) {
          if (key in properties) {
            const schema = properties[key];
            const expectedType = schema.type as string;

            if (expectedType === "string" && typeof value !== "string") {
              return { valid: false, error: t("inspector.fieldTypeMismatch", "Field '{{field}}' should be {{type}}").replace("{{field}}", key).replace("{{type}}", expectedType) };
            }
            if ((expectedType === "number" || expectedType === "integer") && typeof value !== "number") {
              return { valid: false, error: t("inspector.fieldTypeMismatch", "Field '{{field}}' should be {{type}}").replace("{{field}}", key).replace("{{type}}", expectedType) };
            }
            if (expectedType === "boolean" && typeof value !== "boolean") {
              return { valid: false, error: t("inspector.fieldTypeMismatch", "Field '{{field}}' should be {{type}}").replace("{{field}}", key).replace("{{type}}", expectedType) };
            }
            if (expectedType === "array" && !Array.isArray(value)) {
              return { valid: false, error: t("inspector.fieldTypeMismatch", "Field '{{field}}' should be {{type}}").replace("{{field}}", key).replace("{{type}}", expectedType) };
            }
            if (expectedType === "object" && (typeof value !== "object" || value === null || Array.isArray(value))) {
              return { valid: false, error: t("inspector.fieldTypeMismatch", "Field '{{field}}' should be {{type}}").replace("{{field}}", key).replace("{{type}}", expectedType) };
            }
          }
        }
      }

      return { valid: true, parsed };
    } catch (e) {
      return { valid: false, error: (e as Error).message };
    }
  }, [selectedTool, t]);

  // Handle JSON input change with validation
  const handleJsonInputChange = useCallback((value: string) => {
    setJsonInput(value);
    const validation = validateJsonInput(value);
    setJsonError(validation.valid ? null : validation.error || null);
  }, [validateJsonInput]);

  // Format JSON input
  const formatJsonInput = useCallback(() => {
    try {
      const parsed = JSON.parse(jsonInput);
      setJsonInput(JSON.stringify(parsed, null, 2));
      setJsonError(null);
    } catch (e) {
      setJsonError((e as Error).message);
    }
  }, [jsonInput]);

  const executeTool = async () => {
    if (!selectedTool) return;

    let argumentsObj: Record<string, unknown> = {};

    if (inputMode === "json") {
      // Use JSON input
      const validation = validateJsonInput(jsonInput);
      if (!validation.valid) {
        setJsonError(validation.error || "Invalid JSON");
        return;
      }
      argumentsObj = validation.parsed || {};
    } else {
      // Use form inputs
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

  const formatDuration = (ms: number) => {
    if (ms < 1000) {
      return t("inspector.durationMs", "{{value}}ms").replace("{{value}}", String(ms));
    }
    return t("inspector.durationS", "{{value}}s").replace("{{value}}", (ms / 1000).toFixed(2));
  };

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
                <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{selectedTool.description}</p>
              )}
            </div>

            {/* Schema Collapsible */}
            <div className="mb-4">
              <button
                type="button"
                onClick={() => setShowSchema(!showSchema)}
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {showSchema ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
                <FileJson className="h-3.5 w-3.5" />
                {t("inspector.viewSchema", "View Schema")}
              </button>
              {showSchema && selectedTool.inputSchema && (
                <pre className="mt-2 p-3 rounded-md bg-muted/50 border border-border text-xs font-mono overflow-x-auto max-h-64">
                  {JSON.stringify(selectedTool.inputSchema, null, 2)}
                </pre>
              )}
            </div>

            {/* Arguments with Tabs for Form/JSON input */}
            <div className="flex-1 overflow-auto">
              <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as "form" | "json")} className="w-full">
                <TabsList className="mb-3 h-8">
                  <TabsTrigger value="form" className="text-xs h-7 px-3">
                    <Wrench className="h-3 w-3 mr-1.5" />
                    {t("inspector.formInput", "Form")}
                  </TabsTrigger>
                  <TabsTrigger value="json" className="text-xs h-7 px-3">
                    <Code2 className="h-3 w-3 mr-1.5" />
                    {t("inspector.jsonInput", "JSON")}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="form" className="mt-0">
                  {argumentInputs.length > 0 ? (
                    <div className="space-y-4">
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
                            <p className="text-xs text-muted-foreground whitespace-pre-wrap">{input.description}</p>
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
                              <option value="true">{t("inspector.boolTrue", "true")}</option>
                              <option value="false">{t("inspector.boolFalse", "false")}</option>
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

                      {/* Execute Button - after form inputs */}
                      <Button onClick={executeTool} disabled={executing} className="w-full mt-4">
                        {executing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                        {executing ? t("inspector.calling") : t("inspector.callTool")}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="text-sm text-muted-foreground">{t("inspector.noArguments")}</div>
                      {/* Execute Button - for tools with no arguments */}
                      <Button onClick={executeTool} disabled={executing} className="w-full">
                        {executing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                        {executing ? t("inspector.calling") : t("inspector.callTool")}
                      </Button>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="json" className="mt-0">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">
                        {t("inspector.jsonArguments", "JSON Arguments")}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={formatJsonInput}
                      >
                        {t("inspector.format", "Format")}
                      </Button>
                    </div>

                    <div className="relative">
                      <Textarea
                        value={jsonInput}
                        onChange={(e) => handleJsonInputChange(e.target.value)}
                        placeholder='{"key": "value"}'
                        className={`font-mono text-xs min-h-[200px] ${
                          jsonError ? "border-red-500 focus:ring-red-500" : ""
                        }`}
                        spellCheck={false}
                      />
                      {jsonError && (
                        <div className="flex items-start gap-2 mt-2 p-2 rounded bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-xs">
                          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                          <span className="break-all">{jsonError}</span>
                        </div>
                      )}
                    </div>

                    {/* Execute Button - after JSON input */}
                    <Button
                      onClick={executeTool}
                      disabled={executing || !!jsonError}
                      className="w-full"
                    >
                      {executing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                      {executing ? t("inspector.calling") : t("inspector.callTool")}
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
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
