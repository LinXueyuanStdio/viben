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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { useTranslation } from "react-i18next";
import type { McpTool } from "@/types";
import DynamicJsonForm, {
  type DynamicJsonFormRef,
  type JsonValue,
  type JsonSchemaType,
  generateDefaultValue,
} from "./dynamic-json-form";
import { cn } from "@/lib/utils";

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
}

interface MetadataEntry {
  id: string;
  key: string;
  value: string;
}

// Annotation badges component
function AnnotationBadges({ annotations }: { annotations?: ToolAnnotations }) {
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
      label: "Read-only",
      value: readOnly.value,
      implied: readOnly.implied,
      description: "Tool does not modify its environment",
    },
    {
      label: "Destructive",
      value: destructive.value,
      implied: destructive.implied,
      description: "Tool may perform destructive updates",
    },
    {
      label: "Idempotent",
      value: idempotent.value,
      implied: idempotent.implied,
      description: "Calling repeatedly has no additional effect",
    },
    {
      label: "Open-world",
      value: openWorld.value,
      implied: openWorld.implied,
      description: "Tool may interact with external entities",
    },
  ];

  return (
    <div className="flex flex-wrap gap-1.5">
      {badges.map(({ label, value, implied, description }) => (
        <span
          key={label}
          title={`${description}\n\nValue: ${value ? "Yes" : "No"} (${implied ? "implied default" : "explicitly set"})`}
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

export function InspectorTools({ makeRequest, enabled = true }: InspectorToolsProps) {
  const { t } = useTranslation();
  const [tools, setTools] = useState<ExtendedMcpTool[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTool, setSelectedTool] = useState<ExtendedMcpTool | null>(null);
  const [executions, setExecutions] = useState<ToolExecution[]>([]);
  const [executing, setExecuting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedExecutions, setExpandedExecutions] = useState<Set<string>>(new Set());
  const [showSchema, setShowSchema] = useState(false);
  const [showOutputSchema, setShowOutputSchema] = useState(false);
  const [showMeta, setShowMeta] = useState(false);
  const [inputMode, setInputMode] = useState<"form" | "json">("form");

  // Form state
  const [formValues, setFormValues] = useState<Record<string, JsonValue>>({});
  const [jsonInput, setJsonInput] = useState("{}");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const formRefs = useRef<Record<string, DynamicJsonFormRef | null>>({});

  // Metadata entries for custom _meta
  const [metadataEntries, setMetadataEntries] = useState<MetadataEntry[]>([]);

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
      const response = await makeRequest<{ tools: ExtendedMcpTool[] }>("tools/list", {});
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

  // Initialize form values when tool changes
  useEffect(() => {
    if (!selectedTool) {
      setFormValues({});
      setJsonInput("{}");
      setJsonError(null);
      setMetadataEntries([]);
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
  }, [selectedTool]);

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
        setJsonError(validation.error || "Invalid JSON");
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

    // Build metadata from entries
    const metadata: Record<string, unknown> = {};
    for (const entry of metadataEntries) {
      const key = entry.key.trim();
      if (key) {
        metadata[key] = entry.value;
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
      const callParams: Record<string, unknown> = {
        name: selectedTool.name,
        arguments: argumentsObj,
      };

      // Add metadata if any
      if (Object.keys(metadata).length > 0) {
        callParams._meta = metadata;
      }

      const response = await makeRequest("tools/call", callParams);
      const duration = Date.now() - startTime;
      setExecutions((prev) =>
        prev.map((exec) =>
          exec.id === executionId ? { ...exec, status: "success", result: response, duration } : exec
        )
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
            <div className="text-center p-4 text-xs text-muted-foreground">{t("inspector.noToolsFound")}</div>
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
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {selectedTool ? (
          <div className="flex-1 overflow-auto">
            {/* Tool Header */}
            <div className="mb-4">
              <h3 className="font-mono text-base font-semibold">{selectedTool.name}</h3>
              {selectedTool.description && (
                <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{selectedTool.description}</p>
              )}

              {/* Annotation Badges */}
              {selectedTool.annotations && (
                <div className="mt-2">
                  <AnnotationBadges annotations={selectedTool.annotations} />
                </div>
              )}
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
                        {metadataEntries.map((entry) => (
                          <div key={entry.id} className="flex items-center gap-2">
                            <Input
                              value={entry.key}
                              onChange={(e) => updateMetadataEntry(entry.id, "key", e.target.value)}
                              placeholder="Key"
                              className="h-8 text-xs flex-1"
                            />
                            <Input
                              value={entry.value}
                              onChange={(e) => updateMetadataEntry(entry.id, "value", e.target.value)}
                              placeholder="Value"
                              className="h-8 text-xs flex-1"
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
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2 pt-2">
                    <Button onClick={executeTool} disabled={executing} className="flex-1">
                      {executing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                      {executing ? t("inspector.calling") : t("inspector.callTool")}
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
                      placeholder='{"key": "value"}'
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
                        {metadataEntries.map((entry) => (
                          <div key={entry.id} className="flex items-center gap-2">
                            <Input
                              value={entry.key}
                              onChange={(e) => updateMetadataEntry(entry.id, "key", e.target.value)}
                              placeholder="Key"
                              className="h-8 text-xs flex-1"
                            />
                            <Input
                              value={entry.value}
                              onChange={(e) => updateMetadataEntry(entry.id, "value", e.target.value)}
                              placeholder="Value"
                              className="h-8 text-xs flex-1"
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
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2">
                    <Button onClick={executeTool} disabled={executing || !!jsonError} className="flex-1">
                      {executing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                      {executing ? t("inspector.calling") : t("inspector.callTool")}
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
