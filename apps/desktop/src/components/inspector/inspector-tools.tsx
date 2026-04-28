import { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
  Plus,
  Minus,
  Eye,
  FileText,
  Image as ImageIcon,
  ListTodo,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useTranslation } from "react-i18next";
import type { McpTool, McpServerCapabilities } from "@/types";
import DynamicJsonForm, {
  type DynamicJsonFormRef,
  type JsonValue,
  type JsonSchemaType,
  generateDefaultValue,
} from "./dynamic-json-form";
import { cn } from "@/lib/utils";
import {
  hasValidMetaPrefix,
  hasValidMetaName,
  isReservedMetaKey,
  getMetaKeyValidationError,
} from "@/lib/meta-utils";

interface InspectorToolsProps {
  makeRequest: <T = unknown>(method: string, params?: Record<string, unknown>) => Promise<T>;
  enabled?: boolean;
  serverCapabilities?: McpServerCapabilities | null;
}

/** Task support level for a tool's execution */
type TaskSupport = "forbidden" | "required" | "optional";

interface ToolExecution {
  id: string;
  toolName: string;
  arguments: Record<string, unknown>;
  timestamp: Date;
  status: "running" | "success" | "error" | "polling";
  result?: unknown;
  error?: string;
  duration?: number;
  /** Whether this execution was run as a task */
  isTask?: boolean;
  /** Task ID if run as task */
  taskId?: string;
}

interface ToolAnnotations {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

interface ExtendedMcpTool extends McpTool {
  annotations?: ToolAnnotations;
  outputSchema?: JsonSchemaType;
  _meta?: Record<string, unknown>;
  /** Execution configuration including task support */
  execution?: {
    taskSupport?: TaskSupport;
  };
}

/**
 * Get the task support level for a tool.
 * Returns "forbidden" if not specified (MCP spec default).
 */
function getTaskSupport(tool: ExtendedMcpTool | null): TaskSupport {
  if (!tool) return "forbidden";
  const taskSupport = tool.execution?.taskSupport;
  if (taskSupport === "forbidden" || taskSupport === "required" || taskSupport === "optional") {
    return taskSupport;
  }
  return "forbidden";
}

interface MetadataEntry {
  id: string;
  key: string;
  value: string;
}

// Annotation badges component
function AnnotationBadges({ annotations }: { annotations?: ToolAnnotations }) {
  const { t } = useTranslation();
  // MCP spec defaults: readOnlyHint=false, destructiveHint=true, idempotentHint=false, openWorldHint=true
  const getValueAndImplied = (
    value: boolean | undefined,
    defaultValue: boolean
  ): { value: boolean; implied: boolean } => ({
    value: value ?? defaultValue,
    implied: value === undefined,
  });

  const readOnly = getValueAndImplied(annotations?.readOnlyHint, false);
  const destructive = getValueAndImplied(annotations?.destructiveHint, true);
  const idempotent = getValueAndImplied(annotations?.idempotentHint, false);
  const openWorld = getValueAndImplied(annotations?.openWorldHint, true);

  const badges = [
    {
      label: t("inspector.annotations.readOnly", "Read-only"),
      value: readOnly.value,
      implied: readOnly.implied,
      description: t("inspector.annotations.readOnlyDesc", "Tool does not modify its environment"),
    },
    {
      label: t("inspector.annotations.destructive", "Destructive"),
      value: destructive.value,
      implied: destructive.implied,
      description: t("inspector.annotations.destructiveDesc", "Tool may perform destructive updates"),
    },
    {
      label: t("inspector.annotations.idempotent", "Idempotent"),
      value: idempotent.value,
      implied: idempotent.implied,
      description: t("inspector.annotations.idempotentDesc", "Calling repeatedly has no additional effect"),
    },
    {
      label: t("inspector.annotations.openWorld", "Open-world"),
      value: openWorld.value,
      implied: openWorld.implied,
      description: t("inspector.annotations.openWorldDesc", "Tool may interact with external entities"),
    },
  ];

  return (
    <div className="flex flex-wrap gap-1.5">
      {badges.map(({ label, value, implied, description }) => (
        <span
          key={label}
          title={`${description}\n\n${t("inspector.annotations.value", "Value")}: ${value ? t("common.yes") : t("common.no")} (${implied ? t("inspector.annotations.impliedDefault", "implied default") : t("inspector.annotations.explicitlySet", "explicitly set")})`}
          className={cn(
            "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border",
            value
              ? "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30"
              : "bg-muted text-muted-foreground border-border",
            implied && "border-dashed opacity-70"
          )}
        >
          {value ? "✓" : "✗"} {label}
        </span>
      ))}
    </div>
  );
}

export function InspectorTools({ makeRequest, enabled = true, serverCapabilities }: InspectorToolsProps) {
  const { t } = useTranslation();
  const [tools, setTools] = useState<ExtendedMcpTool[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [selectedTool, setSelectedTool] = useState<ExtendedMcpTool | null>(null);
  const [executions, setExecutions] = useState<ToolExecution[]>([]);
  const [executing, setExecuting] = useState(false);
  const [isPollingTask, setIsPollingTask] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedExecutions, setExpandedExecutions] = useState<Set<string>>(new Set());
  const [showSchema, setShowSchema] = useState(false);
  const [showOutputSchema, setShowOutputSchema] = useState(false);
  const [showMeta, setShowMeta] = useState(false);
  const [inputMode, setInputMode] = useState<"form" | "json">("form");

  // Task mode state - whether to run the tool as a task
  const [runAsTask, setRunAsTask] = useState(false);

  // Form state
  const [formValues, setFormValues] = useState<Record<string, JsonValue>>({});
  const [jsonInput, setJsonInput] = useState("{}");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const formRefs = useRef<Record<string, DynamicJsonFormRef | null>>({});

  // Metadata entries for custom _meta
  const [metadataEntries, setMetadataEntries] = useState<MetadataEntry[]>([]);

  // Check if server supports task requests
  // MCP 2024-11-05 added tasks capability
  const serverSupportsTaskRequests = useMemo(() => {
    return (serverCapabilities as Record<string, unknown>)?.tasks !== undefined;
  }, [serverCapabilities]);

  // Get task support for currently selected tool
  const toolTaskSupport = useMemo(() => {
    if (!serverSupportsTaskRequests) return "forbidden";
    return getTaskSupport(selectedTool);
  }, [serverSupportsTaskRequests, selectedTool]);

  // Check for invalid metadata entries
  const hasReservedMetadataEntry = useMemo(() => {
    return metadataEntries.some(({ key }) => {
      const trimmedKey = key.trim();
      return trimmedKey !== "" && isReservedMetaKey(trimmedKey);
    });
  }, [metadataEntries]);

  const hasInvalidMetaPrefixEntry = useMemo(() => {
    return metadataEntries.some(({ key }) => {
      const trimmedKey = key.trim();
      return trimmedKey !== "" && !hasValidMetaPrefix(trimmedKey);
    });
  }, [metadataEntries]);

  const hasInvalidMetaNameEntry = useMemo(() => {
    return metadataEntries.some(({ key }) => {
      const trimmedKey = key.trim();
      return trimmedKey !== "" && !hasValidMetaName(trimmedKey);
    });
  }, [metadataEntries]);

  const hasAnyMetadataError = hasReservedMetadataEntry || hasInvalidMetaPrefixEntry || hasInvalidMetaNameEntry;

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

  const fetchTools = async (cursor?: string) => {
    if (!enabled) return;

    const isLoadMore = !!cursor;
    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const params: Record<string, unknown> = {};
      if (cursor) {
        params.cursor = cursor;
      }

      const response = await makeRequest<{ tools: ExtendedMcpTool[]; nextCursor?: string }>("tools/list", params);
      const newTools = response.tools || [];

      if (isLoadMore) {
        // Append to existing tools
        setTools((prev) => [...prev, ...newTools]);
      } else {
        // Replace tools on fresh load
        setTools(newTools);
        if (newTools.length > 0 && !selectedTool) {
          setSelectedTool(newTools[0]);
        }
      }

      // Store next cursor for pagination
      setNextCursor(response.nextCursor);
    } catch (error) {
      console.error("Error listing tools:", error);
      if (!isLoadMore) {
        setTools([]);
      }
      setNextCursor(undefined);
    } finally {
      if (isLoadMore) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  };

  const loadMoreTools = () => {
    if (nextCursor) {
      fetchTools(nextCursor);
    }
  };

  const clearAll = () => {
    setTools([]);
    setSelectedTool(null);
    setExecutions([]);
    setSearchQuery("");
    setNextCursor(undefined);
  };

  // Initialize form values when tool changes
  useEffect(() => {
    if (!selectedTool) {
      setFormValues({});
      setJsonInput("{}");
      setJsonError(null);
      setMetadataEntries([]);
      setRunAsTask(false);
      return;
    }

    const properties = (selectedTool.inputSchema?.properties as Record<string, JsonSchemaType>) || {};
    const initialValues: Record<string, JsonValue> = {};

    for (const [key, schema] of Object.entries(properties)) {
      initialValues[key] = generateDefaultValue(schema);
    }

    setFormValues(initialValues);
    setJsonInput(JSON.stringify(initialValues, null, 2));
    setJsonError(null);
    setMetadataEntries([]);
    formRefs.current = {};

    // Set runAsTask based on tool's task support
    const taskSupport = serverSupportsTaskRequests ? getTaskSupport(selectedTool) : "forbidden";
    setRunAsTask(taskSupport === "required");
  }, [selectedTool, serverSupportsTaskRequests]);

  // Validate JSON input
  const validateJsonInput = useCallback(
    (value: string): { valid: boolean; error?: string; parsed?: Record<string, unknown> } => {
      try {
        const parsed = JSON.parse(value);
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
          return { valid: false, error: t("inspector.jsonMustBeObject", "JSON must be an object") };
        }
        return { valid: true, parsed };
      } catch (e) {
        return { valid: false, error: (e as Error).message };
      }
    },
    [t]
  );

  const handleJsonInputChange = useCallback(
    (value: string) => {
      setJsonInput(value);
      const validation = validateJsonInput(value);
      setJsonError(validation.valid ? null : validation.error || null);
    },
    [validateJsonInput]
  );

  const formatJsonInput = useCallback(() => {
    try {
      const parsed = JSON.parse(jsonInput);
      setJsonInput(JSON.stringify(parsed, null, 2));
      setJsonError(null);
    } catch (e) {
      setJsonError((e as Error).message);
    }
  }, [jsonInput]);

  // Check for validation errors in dynamic forms
  const checkValidationErrors = (): boolean => {
    return Object.values(formRefs.current).some(
      (ref) => ref && ref.hasJsonError()
    );
  };

  const executeTool = async () => {
    if (!selectedTool) return;

    let argumentsObj: Record<string, unknown> = {};

    if (inputMode === "json") {
      const validation = validateJsonInput(jsonInput);
      if (!validation.valid) {
        setJsonError(validation.error || t("inspector.jsonParseError", "Invalid JSON"));
        return;
      }
      argumentsObj = validation.parsed || {};
    } else {
      // Validate all form refs
      for (const ref of Object.values(formRefs.current)) {
        if (ref) {
          const validation = ref.validateJson();
          if (!validation.isValid) {
            return;
          }
        }
      }

      if (checkValidationErrors()) {
        return;
      }

      argumentsObj = { ...formValues } as Record<string, unknown>;
    }

    // Build metadata from entries, filtering out invalid keys
    const metadata: Record<string, unknown> = {};
    for (const entry of metadataEntries) {
      const trimmedKey = entry.key.trim();
      if (
        trimmedKey !== "" &&
        hasValidMetaPrefix(trimmedKey) &&
        !isReservedMetaKey(trimmedKey) &&
        hasValidMetaName(trimmedKey)
      ) {
        metadata[trimmedKey] = entry.value;
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
      isTask: runAsTask,
    };

    setExecutions((prev) => [newExecution, ...prev]);
    setExpandedExecutions((prev) => new Set([...prev, executionId]));

    try {
      const callParams: Record<string, unknown> = {
        name: selectedTool.name,
        arguments: argumentsObj,
      };

      // Build _meta with user entries
      const metaObj: Record<string, unknown> = { ...metadata };

      // If running as task, add progressToken for task tracking
      if (runAsTask) {
        metaObj.progressToken = executionId;
      }

      // Add metadata if any
      if (Object.keys(metaObj).length > 0) {
        callParams._meta = metaObj;
      }

      const response = await makeRequest<Record<string, unknown>>("tools/call", callParams);

      // Check if response indicates a task was created
      // MCP task response contains a task object with id, status, etc.
      const taskResponse = response as { task?: { id: string; status: string }; content?: unknown };

      if (runAsTask && taskResponse.task) {
        // Task was created, start polling for results
        const taskId = taskResponse.task.id;
        setExecutions((prev) =>
          prev.map((exec) =>
            exec.id === executionId
              ? { ...exec, status: "polling", taskId, result: response }
              : exec
          )
        );

        // Poll for task completion
        setIsPollingTask(true);
        await pollTaskResult(executionId, taskId, startTime);
      } else {
        // Regular response or task not used
        const duration = Date.now() - startTime;
        setExecutions((prev) =>
          prev.map((exec) =>
            exec.id === executionId ? { ...exec, status: "success", result: response, duration } : exec
          )
        );
      }
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

  /**
   * Poll for task result until completion or error.
   * Uses tasks/get to check task status.
   */
  const pollTaskResult = async (executionId: string, taskId: string, startTime: number) => {
    const maxAttempts = 60; // Max 60 attempts (with 1s delay = ~1 minute max)
    const pollDelay = 1000; // 1 second between polls

    try {
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        // Wait before polling (except first attempt)
        if (attempt > 0) {
          await new Promise((resolve) => setTimeout(resolve, pollDelay));
        }

        try {
          const taskResult = await makeRequest<{
            id: string;
            status: "pending" | "running" | "completed" | "failed" | "cancelled";
            result?: unknown;
            error?: { message: string };
          }>("tasks/get", { id: taskId });

          if (taskResult.status === "completed") {
            const duration = Date.now() - startTime;
            setExecutions((prev) =>
              prev.map((exec) =>
                exec.id === executionId
                  ? { ...exec, status: "success", result: taskResult.result ?? taskResult, duration }
                  : exec
              )
            );
            return;
          }

          if (taskResult.status === "failed" || taskResult.status === "cancelled") {
            const duration = Date.now() - startTime;
            const errorMsg = taskResult.error?.message || `Task ${taskResult.status}`;
            setExecutions((prev) =>
              prev.map((exec) =>
                exec.id === executionId
                  ? { ...exec, status: "error", error: errorMsg, duration }
                  : exec
              )
            );
            return;
          }

          // Still pending or running, continue polling
          setExecutions((prev) =>
            prev.map((exec) =>
              exec.id === executionId
                ? { ...exec, result: taskResult }
                : exec
            )
          );
        } catch (pollError) {
          // If tasks/get fails, the server might not support task polling
          // Fall back to treating the original response as the result
          console.warn("Task polling failed:", pollError);
          const duration = Date.now() - startTime;
          setExecutions((prev) =>
            prev.map((exec) =>
              exec.id === executionId
                ? { ...exec, status: "success", duration }
                : exec
            )
          );
          return;
        }
      }

      // Timeout - mark as error
      const duration = Date.now() - startTime;
      setExecutions((prev) =>
        prev.map((exec) =>
          exec.id === executionId
            ? { ...exec, status: "error", error: t("inspector.taskPollingTimedOut", "Task polling timed out"), duration }
            : exec
        )
      );
    } finally {
      setIsPollingTask(false);
    }
  };

  const copyResult = async (execution: ToolExecution) => {
    const text = JSON.stringify(execution.result || execution.error, null, 2);
    await navigator.clipboard.writeText(text);
    setCopiedId(execution.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const copyInput = async () => {
    const text = inputMode === "json" ? jsonInput : JSON.stringify(formValues, null, 2);
    await navigator.clipboard.writeText(text);
  };

  const toggleExecution = (id: string) => {
    setExpandedExecutions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Track which executions are showing rendered content vs JSON
  const [renderedResults, setRenderedResults] = useState<Set<string>>(new Set());

  const toggleRenderedResult = (id: string) => {
    setRenderedResults((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Check if result has renderable content (MCP tool result format)
  const hasRenderableContent = (result: unknown): boolean => {
    if (!result || typeof result !== "object") return false;
    const r = result as Record<string, unknown>;
    if (Array.isArray(r.content)) {
      return r.content.some(
        (item: unknown) =>
          item &&
          typeof item === "object" &&
          ((item as Record<string, unknown>).type === "text" ||
            (item as Record<string, unknown>).type === "image" ||
            (item as Record<string, unknown>).type === "resource")
      );
    }
    return false;
  };

  // Render a single MCP content item
  const renderContentItem = (content: Record<string, unknown>, idx: number): React.ReactNode => {
    if (content.type === "text") {
      return (
        <div key={idx} className="flex gap-2">
          <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
          <pre className="text-xs whitespace-pre-wrap break-words flex-1">
            {String(content.text || "")}
          </pre>
        </div>
      );
    }

    if (content.type === "image") {
      const data = content.data as string | undefined;
      const mimeType = (content.mimeType as string) || "image/png";
      if (data) {
        return (
          <div key={idx} className="flex gap-2">
            <ImageIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
            <img
              src={`data:${mimeType};base64,${data}`}
              alt={t("inspector.toolResultAlt", "Tool result")}
              className="max-w-full max-h-48 rounded border border-border"
            />
          </div>
        );
      }
    }

    if (content.type === "resource") {
      const resource = content.resource as Record<string, unknown> | undefined;
      if (resource) {
        const uri = resource.uri as string | undefined;
        const text = resource.text as string | undefined;
        const blob = resource.blob as string | undefined;
        const mimeType = (resource.mimeType as string) || "application/octet-stream";

        return (
          <div key={idx} className="border border-border rounded p-2 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <FileJson className="h-3 w-3" />
              <span className="font-mono truncate">{uri || "Resource"}</span>
            </div>
            {text && (
              <pre className="text-xs whitespace-pre-wrap break-words bg-muted/50 p-2 rounded max-h-32 overflow-auto">
                {text}
              </pre>
            )}
            {blob && mimeType.startsWith("image/") && (
              <img
                src={`data:${mimeType};base64,${blob}`}
                alt={t("inspector.resourceAlt", "Resource")}
                className="max-w-full max-h-48 rounded"
              />
            )}
          </div>
        );
      }
    }

    // Fallback for unknown content types
    return (
      <pre key={idx} className="text-xs bg-muted/50 p-2 rounded overflow-x-auto">
        {JSON.stringify(content, null, 2)}
      </pre>
    );
  };

  // Render MCP content items
  const renderContent = (result: unknown): React.ReactNode => {
    if (!result || typeof result !== "object") return null;
    const r = result as Record<string, unknown>;
    if (!Array.isArray(r.content)) return null;

    const contentItems = r.content as unknown[];
    const renderedItems: React.ReactNode[] = [];

    for (let idx = 0; idx < contentItems.length; idx++) {
      const item = contentItems[idx];
      if (item && typeof item === "object") {
        const rendered = renderContentItem(item as Record<string, unknown>, idx);
        if (rendered) {
          renderedItems.push(rendered);
        }
      }
    }

    return (
      <div className="space-y-2">
        {renderedItems}
        {/* Show isError if present */}
        {Boolean(r.isError) && (
          <div className="flex items-center gap-1.5 text-xs text-red-500">
            <AlertCircle className="h-3.5 w-3.5" />
            <span>{t("inspector.toolReturnedError", "Tool returned error")}</span>
          </div>
        )}
      </div>
    );
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
      case "polling":
        return { icon: ListTodo, color: "text-purple-500", bg: "bg-purple-500/10", animate: true };
      case "success":
        return { icon: CheckCircle, color: "text-green-500", bg: "bg-green-500/10", animate: false };
      case "error":
        return { icon: XCircle, color: "text-red-500", bg: "bg-red-500/10", animate: false };
      default:
        return { icon: Clock, color: "text-muted-foreground", bg: "bg-muted", animate: false };
    }
  };

  const addMetadataEntry = () => {
    setMetadataEntries((prev) => [
      ...prev,
      { id: crypto.randomUUID(), key: "", value: "" },
    ]);
  };

  const removeMetadataEntry = (id: string) => {
    setMetadataEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const updateMetadataEntry = (id: string, field: "key" | "value", value: string) => {
    setMetadataEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, [field]: value } : e))
    );
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
            <Badge variant="secondary" className="h-5 px-1.5 text-xs">
              {tools.length}
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={clearAll} disabled={tools.length === 0}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => fetchTools()} disabled={loading}>
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
              <Button size="sm" className="mt-3" onClick={() => fetchTools()} disabled={loading}>
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                {t("inspector.listTools")}
              </Button>
            </div>
          ) : filteredTools.length === 0 ? (
            <div className="text-center p-4 text-xs text-muted-foreground">{t("inspector.noToolsFound")}</div>
          ) : (
            <>
              {filteredTools.map((tool) => {
                // Show compact annotation indicators
                const hasReadOnly = tool.annotations?.readOnlyHint === true;
                const hasDestructive = tool.annotations?.destructiveHint !== false; // default true
                const hasIdempotent = tool.annotations?.idempotentHint === true;

                return (
                  <div
                    key={tool.name}
                    onClick={() => setSelectedTool(tool)}
                    className={`p-2.5 rounded-lg cursor-pointer transition-colors ${
                      selectedTool?.name === tool.name
                        ? "bg-blue-500/10 border border-blue-500/30"
                        : "hover:bg-muted/50 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-medium truncate flex-1">{tool.name}</span>
                      {/* Compact annotation indicators */}
                      <div className="flex items-center gap-0.5 shrink-0">
                        {hasReadOnly && (
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500" title={t("inspector.annotations.readOnly", "Read-only")} />
                        )}
                        {hasDestructive && !hasReadOnly && (
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500" title={t("inspector.annotations.destructive", "Destructive")} />
                        )}
                        {hasIdempotent && (
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" title={t("inspector.annotations.idempotent", "Idempotent")} />
                        )}
                      </div>
                    </div>
                    {tool.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{tool.description}</p>
                    )}
                  </div>
                );
              })}
              {/* Load More Button */}
              {nextCursor && (
                <div className="pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-7 text-xs"
                    onClick={loadMoreTools}
                    disabled={loadingMore}
                  >
                    {loadingMore ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : null}
                    {t("inspector.loadMore", "Load More")}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Middle Panel - Tool Details & Arguments */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {selectedTool ? (
          <div className="flex-1 overflow-auto">
            {/* Tool Header */}
            <div className="mb-4">
              <h3 className="font-mono text-base font-semibold">{selectedTool.name}</h3>
              {selectedTool.description && (
                <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{selectedTool.description}</p>
              )}

              {/* Annotation Badges - Always show with MCP spec defaults */}
              <div className="mt-2">
                <AnnotationBadges annotations={selectedTool.annotations} />
              </div>
            </div>

            {/* Schema Collapsible */}
            <div className="mb-4 space-y-2">
              {/* Input Schema */}
              <button
                type="button"
                onClick={() => setShowSchema(!showSchema)}
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {showSchema ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                <FileJson className="h-3.5 w-3.5" />
                {t("inspector.viewSchema", "Input Schema")}
              </button>
              {showSchema && selectedTool.inputSchema && (
                <pre className="p-3 rounded-md bg-muted/50 border border-border text-xs font-mono overflow-x-auto max-h-48">
                  {JSON.stringify(selectedTool.inputSchema, null, 2)}
                </pre>
              )}

              {/* Output Schema */}
              {selectedTool.outputSchema && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowOutputSchema(!showOutputSchema)}
                    className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showOutputSchema ? (
                      <ChevronDown className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" />
                    )}
                    <FileJson className="h-3.5 w-3.5" />
                    {t("inspector.outputSchema", "Output Schema")}
                  </button>
                  {showOutputSchema && (
                    <pre className="p-3 rounded-md bg-muted/50 border border-border text-xs font-mono overflow-x-auto max-h-48">
                      {JSON.stringify(selectedTool.outputSchema, null, 2)}
                    </pre>
                  )}
                </>
              )}

              {/* Tool Meta */}
              {selectedTool._meta && Object.keys(selectedTool._meta).length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowMeta(!showMeta)}
                    className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showMeta ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    <FileJson className="h-3.5 w-3.5" />
                    {t("inspector.toolMeta", "Tool Meta")}
                  </button>
                  {showMeta && (
                    <pre className="p-3 rounded-md bg-muted/50 border border-border text-xs font-mono overflow-x-auto max-h-48">
                      {JSON.stringify(selectedTool._meta, null, 2)}
                    </pre>
                  )}
                </>
              )}
            </div>

            {/* Arguments with Tabs */}
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
                <div className="space-y-4">
                  {/* Dynamic form fields */}
                  {selectedTool.inputSchema?.properties &&
                  Object.keys(selectedTool.inputSchema.properties).length > 0 ? (
                    Object.entries(selectedTool.inputSchema.properties as Record<string, JsonSchemaType>).map(
                      ([key, schema]) => {
                        const required = (selectedTool.inputSchema?.required as string[])?.includes(key) ?? false;
                        return (
                          <div key={key} className="space-y-1.5">
                            <Label className="flex items-center gap-1.5 text-sm font-medium">
                              {schema.title ?? key}
                              {required && <span className="text-red-500">*</span>}
                            </Label>
                            {schema.description && (
                              <p className="text-xs text-muted-foreground">{schema.description}</p>
                            )}
                            <DynamicJsonForm
                              ref={(ref) => {
                                formRefs.current[key] = ref;
                              }}
                              schema={schema}
                              value={formValues[key] ?? generateDefaultValue(schema)}
                              onChange={(newValue) => {
                                setFormValues((prev) => ({ ...prev, [key]: newValue }));
                              }}
                            />
                          </div>
                        );
                      }
                    )
                  ) : (
                    <div className="text-sm text-muted-foreground">{t("inspector.noArguments")}</div>
                  )}

                  {/* Metadata section */}
                  <div className="border-t border-border pt-4">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm font-medium">{t("inspector.toolMetadata", "Tool Metadata")}</Label>
                      <Button variant="outline" size="sm" className="h-6 text-xs" onClick={addMetadataEntry}>
                        <Plus className="h-3 w-3 mr-1" />
                        {t("inspector.addPair", "Add")}
                      </Button>
                    </div>
                    {metadataEntries.length === 0 ? (
                      <p className="text-xs text-muted-foreground">{t("inspector.noMetadata", "No metadata")}</p>
                    ) : (
                      <div className="space-y-2">
                        {metadataEntries.map((entry) => {
                          const validationError = getMetaKeyValidationError(entry.key);
                          return (
                            <div key={entry.id} className="space-y-1">
                              <div className="flex items-center gap-2">
                                <Input
                                  value={entry.key}
                                  onChange={(e) => updateMetadataEntry(entry.id, "key", e.target.value)}
                                  placeholder={t("inspector.keyPlaceholder")}
                                  className={cn(
                                    "h-8 text-xs flex-1",
                                    validationError && "border-red-500 focus-visible:ring-red-500"
                                  )}
                                  aria-invalid={Boolean(validationError)}
                                />
                                <Input
                                  value={entry.value}
                                  onChange={(e) => updateMetadataEntry(entry.id, "value", e.target.value)}
                                  placeholder={t("placeholders.value")}
                                  className="h-8 text-xs flex-1"
                                  disabled={Boolean(validationError)}
                                />
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => removeMetadataEntry(entry.id)}
                                >
                                  <Minus className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                              {validationError && (
                                <p className="text-xs text-red-600 dark:text-red-400 pl-1">
                                  {validationError}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {hasAnyMetadataError && (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                        {t("inspector.fixMetadataErrors", "Fix metadata key errors before running the tool.")}
                      </p>
                    )}
                  </div>

                  {/* Task mode checkbox - only show when server supports tasks and tool allows it */}
                  {toolTaskSupport !== "forbidden" && (
                    <div className="flex items-center space-x-2 pt-2">
                      <Checkbox
                        id="run-as-task-form"
                        checked={runAsTask}
                        onCheckedChange={(checked) => setRunAsTask(checked === true)}
                        disabled={toolTaskSupport === "required"}
                      />
                      <Label
                        htmlFor="run-as-task-form"
                        className="text-sm font-medium text-muted-foreground cursor-pointer"
                      >
                        {t("inspector.runAsTask", "Run as task")}
                        {toolTaskSupport === "required" && (
                          <span className="text-xs ml-1">({t("inspector.required", "required")})</span>
                        )}
                      </Label>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={executeTool}
                      disabled={executing || isPollingTask || hasAnyMetadataError}
                      className="flex-1"
                    >
                      {executing || isPollingTask ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Play className="h-4 w-4 mr-2" />
                      )}
                      {isPollingTask
                        ? t("inspector.pollingTask", "Polling Task...")
                        : executing
                          ? t("inspector.calling")
                          : t("inspector.callTool")}
                    </Button>
                    <Button variant="outline" onClick={copyInput}>
                      <Copy className="h-4 w-4 mr-2" />
                      {t("inspector.copyInput", "Copy")}
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="json" className="mt-0">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      {t("inspector.jsonArguments", "JSON Arguments")}
                    </span>
                    <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={formatJsonInput}>
                      {t("inspector.format", "Format")}
                    </Button>
                  </div>

                  <div className="relative">
                    <textarea
                      value={jsonInput}
                      onChange={(e) => handleJsonInputChange(e.target.value)}
                      placeholder={t("inspector.jsonPlaceholder")}
                      className={cn(
                        "w-full font-mono text-xs min-h-[200px] p-3 rounded-md border resize-none bg-muted/50",
                        "focus:outline-none focus:ring-2 focus:ring-ring",
                        jsonError ? "border-red-500 focus:ring-red-500" : "border-input"
                      )}
                      spellCheck={false}
                    />
                    {jsonError && (
                      <div className="flex items-start gap-2 mt-2 p-2 rounded bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-xs">
                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                        <span className="break-all">{jsonError}</span>
                      </div>
                    )}
                  </div>

                  {/* Metadata section */}
                  <div className="border-t border-border pt-4">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm font-medium">{t("inspector.toolMetadata", "Tool Metadata")}</Label>
                      <Button variant="outline" size="sm" className="h-6 text-xs" onClick={addMetadataEntry}>
                        <Plus className="h-3 w-3 mr-1" />
                        {t("inspector.addPair", "Add")}
                      </Button>
                    </div>
                    {metadataEntries.length === 0 ? (
                      <p className="text-xs text-muted-foreground">{t("inspector.noMetadata", "No metadata")}</p>
                    ) : (
                      <div className="space-y-2">
                        {metadataEntries.map((entry) => {
                          const validationError = getMetaKeyValidationError(entry.key);
                          return (
                            <div key={entry.id} className="space-y-1">
                              <div className="flex items-center gap-2">
                                <Input
                                  value={entry.key}
                                  onChange={(e) => updateMetadataEntry(entry.id, "key", e.target.value)}
                                  placeholder={t("inspector.keyPlaceholder")}
                                  className={cn(
                                    "h-8 text-xs flex-1",
                                    validationError && "border-red-500 focus-visible:ring-red-500"
                                  )}
                                  aria-invalid={Boolean(validationError)}
                                />
                                <Input
                                  value={entry.value}
                                  onChange={(e) => updateMetadataEntry(entry.id, "value", e.target.value)}
                                  placeholder={t("placeholders.value")}
                                  className="h-8 text-xs flex-1"
                                  disabled={Boolean(validationError)}
                                />
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => removeMetadataEntry(entry.id)}
                                >
                                  <Minus className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                              {validationError && (
                                <p className="text-xs text-red-600 dark:text-red-400 pl-1">
                                  {validationError}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {hasAnyMetadataError && (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                        {t("inspector.fixMetadataErrors", "Fix metadata key errors before running the tool.")}
                      </p>
                    )}
                  </div>

                  {/* Task mode checkbox - only show when server supports tasks and tool allows it */}
                  {toolTaskSupport !== "forbidden" && (
                    <div className="flex items-center space-x-2 pt-2">
                      <Checkbox
                        id="run-as-task-json"
                        checked={runAsTask}
                        onCheckedChange={(checked) => setRunAsTask(checked === true)}
                        disabled={toolTaskSupport === "required"}
                      />
                      <Label
                        htmlFor="run-as-task-json"
                        className="text-sm font-medium text-muted-foreground cursor-pointer"
                      >
                        {t("inspector.runAsTask", "Run as task")}
                        {toolTaskSupport === "required" && (
                          <span className="text-xs ml-1">({t("inspector.required", "required")})</span>
                        )}
                      </Label>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-2">
                    <Button
                      onClick={executeTool}
                      disabled={executing || isPollingTask || !!jsonError || hasAnyMetadataError}
                      className="flex-1"
                    >
                      {executing || isPollingTask ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Play className="h-4 w-4 mr-2" />
                      )}
                      {isPollingTask
                        ? t("inspector.pollingTask", "Polling Task...")
                        : executing
                          ? t("inspector.calling")
                          : t("inspector.callTool")}
                    </Button>
                    <Button variant="outline" onClick={copyInput}>
                      <Copy className="h-4 w-4 mr-2" />
                      {t("inspector.copyInput", "Copy")}
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
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
            <Badge variant="secondary" className="h-5 px-1.5 text-xs">
              {executions.length}
            </Badge>
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
                    {execution.isTask && (
                      <Badge variant="outline" className="h-4 px-1 text-[10px] border-purple-500/30 text-purple-600 dark:text-purple-400">
                        {t("inspector.task", "Task")}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {execution.duration !== undefined ? formatDuration(execution.duration) : "..."}
                    </span>
                  </div>

                  {isExpanded && (
                    <div className="px-2.5 pb-2.5 space-y-2">
                      {/* Task ID if present */}
                      {execution.taskId && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <ListTodo className="h-3 w-3" />
                          <span>{t("inspector.taskIdLabel")} <code className="bg-muted/50 px-1 rounded">{execution.taskId}</code></span>
                        </div>
                      )}

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
                      {execution.status !== "running" && execution.status !== "polling" && (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-muted-foreground">
                              {execution.error ? t("common.error") : t("inspector.result")}:
                            </span>
                            <div className="flex items-center gap-1">
                              {/* Toggle rendered/JSON view */}
                              {!execution.error && hasRenderableContent(execution.result) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 px-1.5 text-xs gap-1"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleRenderedResult(execution.id);
                                  }}
                                  title={
                                    renderedResults.has(execution.id)
                                      ? t("inspector.showJson", "Show JSON")
                                      : t("inspector.showRendered", "Show Rendered")
                                  }
                                >
                                  {renderedResults.has(execution.id) ? (
                                    <>
                                      <Code2 className="h-3 w-3" />
                                      <span>{t("inspector.json")}</span>
                                    </>
                                  ) : (
                                    <>
                                      <Eye className="h-3 w-3" />
                                      <span>{t("inspector.render", "Render")}</span>
                                    </>
                                  )}
                                </Button>
                              )}
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
                          </div>
                          {execution.error ? (
                            <pre className="text-xs p-2 rounded overflow-x-auto max-h-48 bg-red-500/10 text-red-600 dark:text-red-400">
                              {JSON.stringify(execution.error, null, 2)}
                            </pre>
                          ) : renderedResults.has(execution.id) &&
                            hasRenderableContent(execution.result) ? (
                            <div className="p-2 rounded bg-muted/50 max-h-64 overflow-auto">
                              {renderContent(execution.result)}
                            </div>
                          ) : (
                            <pre className="text-xs p-2 rounded overflow-x-auto max-h-48 bg-muted/50">
                              {JSON.stringify(execution.result, null, 2)}
                            </pre>
                          )}
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
