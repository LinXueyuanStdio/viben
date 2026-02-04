import { useState, useEffect } from "react";
import {
  Wrench,
  Play,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Code,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

  // Fetch available tools
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

  const clearTools = () => {
    setTools([]);
    setSelectedTool(null);
    setExecutions([]);
  };

  // Update argument inputs when selected tool changes
  useEffect(() => {
    if (!selectedTool) {
      setArgumentInputs([]);
      return;
    }

    const properties = (selectedTool.inputSchema?.properties as Record<string, Record<string, unknown>>) || {};
    const required = (selectedTool.inputSchema?.required as string[]) || [];

    const inputs: ArgumentInput[] = Object.entries(properties).map(
      ([key, schema]) => {
        let defaultValue = "";
        let type = "text";

        if (schema.type === "string") {
          defaultValue = (schema.default as string) || (schema.example as string) || "";
          type = "text";
        } else if (schema.type === "number" || schema.type === "integer") {
          defaultValue = schema.default?.toString() || schema.example?.toString() || "0";
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

        return {
          key,
          value: defaultValue,
          type,
          required: required.includes(key),
          description: schema.description as string | undefined,
        };
      }
    );

    setArgumentInputs(inputs);
  }, [selectedTool]);

  // Execute the selected tool
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

    try {
      const response = await makeRequest("tools/call", {
        name: selectedTool.name,
        arguments: argumentsObj,
      });

      const duration = Date.now() - startTime;
      setExecutions((prev) =>
        prev.map((exec) =>
          exec.id === executionId
            ? { ...exec, status: "success", result: response, duration }
            : exec
        )
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      setExecutions((prev) =>
        prev.map((exec) =>
          exec.id === executionId
            ? {
                ...exec,
                status: "error",
                error: error instanceof Error ? error.message : String(error),
                duration,
              }
            : exec
        )
      );
    } finally {
      setExecuting(false);
    }
  };

  const updateArgumentValue = (key: string, value: string) => {
    setArgumentInputs((prev) =>
      prev.map((input) => (input.key === key ? { ...input, value } : input))
    );
  };

  const formatDuration = (duration: number) => {
    if (duration < 1000) {
      return `${duration}ms`;
    }
    return `${(duration / 1000).toFixed(2)}s`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "running":
        return <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />;
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "error":
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  if (!enabled) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <h4 className="text-sm font-medium">{t("inspector.toolsNotSupported")}</h4>
        <p className="text-sm text-muted-foreground mt-1">
          {t("inspector.toolsNotSupportedDesc")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wrench className="h-5 w-5 text-blue-500" />
          <span className="text-sm font-medium">{t("inspector.tools")}</span>
          <span className="text-xs text-muted-foreground">
            ({tools.length} {t("inspector.available")})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={clearTools}
            disabled={loading || tools.length === 0}
          >
            {t("common.clear")}
          </Button>
          <Button onClick={fetchTools} disabled={loading} size="sm">
            {loading ? t("common.loading") : t("inspector.listTools")}
          </Button>
        </div>
      </div>

      {/* Main Content - Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Tools List */}
        <div className="space-y-4">
          <h5 className="text-sm font-medium">
            {t("inspector.toolsCount", { count: tools.length })}
          </h5>

          {tools.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {tools.map((tool) => (
                <div
                  key={tool.name}
                  className={`rounded-lg border p-3 cursor-pointer transition-colors ${
                    selectedTool?.name === tool.name
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
                      : "hover:bg-muted/50"
                  }`}
                  onClick={() => setSelectedTool(tool)}
                >
                  <div className="flex items-center gap-2">
                    <Code className="h-4 w-4 text-blue-500" />
                    <span className="font-mono text-sm">{tool.name}</span>
                  </div>
                  {tool.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {tool.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            !loading && (
              <div className="rounded-lg border border-dashed p-6 text-center">
                <Wrench className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  {t("inspector.clickListTools")}
                </p>
              </div>
            )
          )}

          {/* Tool Details and Arguments */}
          {selectedTool && (
            <div className="space-y-4">
              <div>
                <h6 className="text-sm font-medium mb-2">{t("inspector.toolDetails")}</h6>
                <div className="rounded-lg border p-3">
                  <div className="font-mono text-sm mb-1">{selectedTool.name}</div>
                  {selectedTool.description && (
                    <p className="text-xs text-muted-foreground">
                      {selectedTool.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Arguments Form */}
              {argumentInputs.length > 0 && (
                <div>
                  <h6 className="text-sm font-medium mb-2">{t("inspector.arguments")}</h6>
                  <div className="space-y-3">
                    {argumentInputs.map((input) => (
                      <div key={input.key}>
                        <label className="text-xs font-medium text-muted-foreground block mb-1">
                          {input.key}
                          {input.required && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        {input.description && (
                          <p className="text-xs text-muted-foreground mb-1">
                            {input.description}
                          </p>
                        )}
                        {input.type === "json" ? (
                          <Textarea
                            value={input.value}
                            onChange={(e) => updateArgumentValue(input.key, e.target.value)}
                            placeholder={t("inspector.enterValue", { type: input.type })}
                            className="font-mono text-xs"
                            rows={3}
                          />
                        ) : (
                          <Input
                            type={input.type === "number" ? "number" : "text"}
                            value={input.value}
                            onChange={(e) => updateArgumentValue(input.key, e.target.value)}
                            placeholder={t("inspector.enterValue", { type: input.type })}
                            className={input.type === "number" ? "" : "font-mono"}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Execute Button */}
              <Button
                onClick={executeTool}
                disabled={executing}
                className="w-full flex items-center gap-2"
              >
                {executing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                {executing ? t("inspector.calling") : t("inspector.callTool")}
              </Button>
            </div>
          )}
        </div>

        {/* Right Column - Execution History */}
        <div className="space-y-4">
          <h5 className="text-sm font-medium">
            {t("inspector.executionHistory")} ({executions.length})
          </h5>

          {executions.length > 0 ? (
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {executions.map((execution) => {
                const hasArgs = Object.keys(execution.arguments).length > 0;
                const hasResult = execution.result !== undefined;
                return (
                <div key={execution.id} className="rounded-lg border p-3">
                  {/* Execution Header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(execution.status)}
                      <span className="font-mono text-sm">{execution.toolName}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {execution.timestamp.toLocaleTimeString()}
                      {execution.duration !== undefined && ` - ${formatDuration(execution.duration)}`}
                    </div>
                  </div>

                  {/* Arguments */}
                  {hasArgs && (
                    <div className="mb-2">
                      <div className="text-xs font-medium text-muted-foreground mb-1">
                        {t("inspector.arguments")}:
                      </div>
                      <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-h-32">
                        {JSON.stringify(execution.arguments, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Error */}
                  {execution.error && (
                    <div className="text-xs text-red-600 bg-red-50 dark:bg-red-950/20 p-2 rounded mb-2">
                      <div className="font-medium mb-1">{t("common.error")}:</div>
                      {execution.error}
                    </div>
                  )}

                  {/* Result */}
                  {hasResult && (
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-1">
                        {t("inspector.result")}:
                      </div>
                      <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-h-48">
                        {JSON.stringify(execution.result, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );})}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <Clock className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {t("inspector.noExecutions")}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
