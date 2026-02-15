/**
 * Chat Monitor Page
 *
 * Displays traces for /api/agent/run executions with tree visualization
 * Features:
 * - Tree view with span details panel
 * - Timeline/waterfall visualization
 * - HTTP request/response details
 * - Search and filter capabilities
 * - Copy trace/span ID functionality
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  RefreshCw,
  Loader2,
  Calendar,
  Activity,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronRight,
  ChevronDown,
  BarChart3,
  TreeDeciduous,
  AlertCircle,
  Copy,
  Search,
  X,
  Tag,
  Zap,
  Globe,
  Server,
  Database,
  FileJson,
  Info,
  AlertTriangle,
  Eye,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { JsonViewer } from "@/components/ui/json-viewer";
import { useTranslation } from "react-i18next";
import { getGatewayUrl } from "@/lib/gateway";

// Types from telemetry
interface TraceEvent {
  name: string;
  time: number;
  attributes?: Record<string, unknown>;
}

interface TraceSpan {
  spanId: string;
  parentSpanId?: string;
  name: string;
  displayName: string;
  kind: number;
  startTime: number;
  endTime: number;
  duration: number;
  status: {
    code: number;
    message?: string;
  };
  attributes: Record<string, unknown>;
  events: TraceEvent[];
}

interface TraceSpanNode extends TraceSpan {
  children: TraceSpanNode[];
}

interface TraceTree {
  traceId: string;
  startTime: number;
  endTime: number;
  totalDuration: number;
  root: TraceSpanNode;
}

interface TraceSummary {
  traceId: string;
  size: number;
  mtime: string;
}

interface DateSummary {
  date: string;
  count: number;
  totalSize: number;
}

interface TraceStats {
  totalSpans: number;
  successSpans: number;
  errorSpans: number;
  maxDepth: number;
  operations: Array<{
    name: string;
    count: number;
    totalDuration: number;
    avgDuration: number;
  }>;
}

// Span kind names
const SPAN_KIND_NAMES: Record<number, string> = {
  0: "INTERNAL",
  1: "SERVER",
  2: "CLIENT",
  3: "PRODUCER",
  4: "CONSUMER",
};

// Get icon for span kind
function getSpanKindIcon(kind: number) {
  switch (kind) {
    case 1:
      return <Server className="h-3 w-3" />;
    case 2:
      return <Globe className="h-3 w-3" />;
    case 3:
    case 4:
      return <Database className="h-3 w-3" />;
    default:
      return <Zap className="h-3 w-3" />;
  }
}

// Copy to clipboard helper
async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// Check if a span has request/response data (is an API call or tool)
function hasDetailData(span: TraceSpan): boolean {
  return !!(
    span.attributes["http.request.body"] ||
    span.attributes["http.response.body"] ||
    span.attributes["tool.input"] ||
    span.attributes["tool_result.output"]
  );
}

// Route filter options
const ROUTE_FILTER_OPTIONS = [
  { value: "all", label: "全部路由" },
  { value: "/api/agent/run", label: "/api/agent/run (智能体执行)" },
  { value: "/api/agents", label: "/api/agents (智能体管理)" },
  { value: "/api/workspaces", label: "/api/workspaces (工作区)" },
  { value: "/api/chat", label: "/api/chat (对话)" },
  { value: "/api/group-chats", label: "/api/group-chats (群聊)" },
];

export function ChatMonitorPage() {
  const { t } = useTranslation();
  const [dates, setDates] = useState<DateSummary[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [traces, setTraces] = useState<TraceSummary[]>([]);
  const [selectedTraceId, setSelectedTraceId] = useState<string>("");
  const [traceTree, setTraceTree] = useState<TraceTree | null>(null);
  const [traceStats, setTraceStats] = useState<TraceStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"tree" | "timeline" | "stats">("tree");
  const [selectedSpan, setSelectedSpan] = useState<TraceSpanNode | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [routeFilter, setRouteFilter] = useState<string>("all");
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detailSpan, setDetailSpan] = useState<TraceSpanNode | null>(null);

  // Load available dates
  const loadDates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${getGatewayUrl()}/api/telemetry/dates`);
      if (!response.ok) throw new Error("Failed to load dates");
      const data: DateSummary[] = await response.json();
      setDates(data);

      // Select today or first available date
      const today = new Date().toISOString().split("T")[0];
      const todayExists = data.find((d) => d.date === today);
      if (todayExists) {
        setSelectedDate(today);
      } else if (data.length > 0) {
        setSelectedDate(data[0].date);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // Load traces for selected date with optional route filter
  const loadTraces = useCallback(async (date: string, route?: string) => {
    if (!date) return;

    setLoading(true);
    setError(null);
    try {
      let url = `${getGatewayUrl()}/api/telemetry/traces?date=${date}`;
      if (route && route !== "all") {
        url += `&route=${encodeURIComponent(route)}`;
      }
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to load traces");
      const data = await response.json();
      setTraces(data.traces || []);

      // Clear selection if not in new list
      setSelectedTraceId("");
      setTraceTree(null);
      setTraceStats(null);
      setSelectedSpan(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // Load trace details
  const loadTraceDetail = useCallback(
    async (traceId: string) => {
      if (!traceId || !selectedDate) return;

      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `${getGatewayUrl()}/api/telemetry/trace/${traceId}?date=${selectedDate}`
        );
        if (!response.ok) throw new Error("Failed to load trace");
        const data = await response.json();
        setTraceTree(data.tree);
        setTraceStats(data.stats);
        setSelectedSpan(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [selectedDate]
  );

  // Initial load
  useEffect(() => {
    loadDates();
  }, [loadDates]);

  // Load traces when date or route filter changes
  useEffect(() => {
    if (selectedDate) {
      loadTraces(selectedDate, routeFilter);
    }
  }, [selectedDate, routeFilter, loadTraces]);

  // Load trace detail when selection changes
  useEffect(() => {
    if (selectedTraceId) {
      loadTraceDetail(selectedTraceId);
    }
  }, [selectedTraceId, loadTraceDetail]);

  const handleRefresh = () => {
    loadDates();
    if (selectedDate) {
      loadTraces(selectedDate, routeFilter);
    }
  };

  // Open detail dialog for a span
  const handleOpenDetail = (span: TraceSpanNode) => {
    setDetailSpan(span);
    setDetailDialogOpen(true);
  };

  // Copy ID with feedback
  const handleCopyId = async (id: string, _type: "trace" | "span") => {
    const success = await copyToClipboard(id);
    if (success) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  // Format duration
  const formatDuration = (ms: number) => {
    if (ms >= 1000) {
      return `${(ms / 1000).toFixed(2)}s`;
    }
    return `${ms.toFixed(2)}ms`;
  };

  // Format time
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  // Format full datetime
  const formatDateTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  // Flatten tree for timeline view
  const flattenedSpans = useMemo(() => {
    if (!traceTree) return [];
    const spans: TraceSpanNode[] = [];
    const traverse = (node: TraceSpanNode) => {
      spans.push(node);
      node.children.forEach(traverse);
    };
    traverse(traceTree.root);
    return spans;
  }, [traceTree]);

  // Filter spans by search query
  const filteredSpans = useMemo(() => {
    if (!searchQuery.trim()) return flattenedSpans;
    const query = searchQuery.toLowerCase();
    return flattenedSpans.filter(
      (span) =>
        span.displayName.toLowerCase().includes(query) ||
        span.name.toLowerCase().includes(query) ||
        span.spanId.toLowerCase().includes(query) ||
        JSON.stringify(span.attributes).toLowerCase().includes(query)
    );
  }, [flattenedSpans, searchQuery]);

  return (
    <div className="p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">{t("observability.chatMonitor")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("observability.chatMonitorDescription")}
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedDate} onValueChange={setSelectedDate}>
            <SelectTrigger className="w-[180px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue placeholder={t("observability.selectDate")} />
            </SelectTrigger>
            <SelectContent>
              {dates.map((d) => (
                <SelectItem key={d.date} value={d.date}>
                  {d.date === new Date().toISOString().split("T")[0]
                    ? `${d.date} (${t("observability.today")})`
                    : d.date}{" "}
                  ({d.count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={routeFilter} onValueChange={setRouteFilter}>
            <SelectTrigger className="w-[240px]">
              <Globe className="h-4 w-4 mr-2" />
              <SelectValue placeholder={t("observability.filterByRoute")} />
            </SelectTrigger>
            <SelectContent>
              {ROUTE_FILTER_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            {t("common.refresh")}
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      <div className="flex-1 flex gap-4 min-h-0">
        {/* Traces List */}
        <div className="w-72 flex flex-col rounded-lg border bg-card">
          <div className="p-3 border-b">
            <h2 className="font-semibold text-sm">{t("observability.traces")}</h2>
            <p className="text-xs text-muted-foreground">
              {traces.length} {t("observability.traces").toLowerCase()}
            </p>
          </div>
          <ScrollArea className="flex-1">
            {traces.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>{t("observability.noTraces")}</p>
                <p className="text-xs mt-1">{t("observability.noTracesDescription")}</p>
              </div>
            ) : (
              <div className="divide-y">
                {traces.map((trace) => (
                  <button
                    key={trace.traceId}
                    onClick={() => setSelectedTraceId(trace.traceId)}
                    className={`w-full text-left p-3 hover:bg-muted/50 transition-colors ${
                      selectedTraceId === trace.traceId ? "bg-muted" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-muted-foreground" />
                      <span className="font-mono text-xs truncate flex-1">
                        {trace.traceId.slice(0, 12)}...
                      </span>
                      {selectedTraceId === trace.traceId && (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{new Date(trace.mtime).toLocaleTimeString()}</span>
                      <span className="ml-auto">
                        {(trace.size / 1024).toFixed(1)} KB
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Trace Detail */}
        <div className="flex-1 flex flex-col min-h-0">
          {!selectedTraceId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <TreeDeciduous className="h-16 w-16 mb-4 opacity-50" />
              <p className="text-lg font-medium">{t("observability.selectTrace")}</p>
            </div>
          ) : loading && !traceTree ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : traceTree ? (
            <>
              {/* Trace header */}
              <div className="mb-3 p-3 rounded-lg border bg-card">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-mono text-sm">{selectedTraceId}</p>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleCopyId(selectedTraceId, "trace")}
                            >
                              {copiedId === selectedTraceId ? (
                                <CheckCircle2 className="h-3 w-3 text-green-500" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {t("observability.copyTraceId")}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTime(traceTree.startTime)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Activity className="h-3 w-3" />
                        {formatDuration(traceTree.totalDuration)}
                      </span>
                      {traceStats && (
                        <>
                          <span className="flex items-center gap-1 text-green-600">
                            <CheckCircle2 className="h-3 w-3" />
                            {traceStats.successSpans}
                          </span>
                          <span className="flex items-center gap-1 text-red-600">
                            <XCircle className="h-3 w-3" />
                            {traceStats.errorSpans}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Search bar */}
              <div className="mb-3 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("observability.searchSpans")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-9"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                    onClick={() => setSearchQuery("")}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>

              <div className="flex-1 flex gap-3 min-h-0">
                {/* Main content area */}
                <div className="flex-1 flex flex-col min-h-0">
                  {/* Tabs */}
                  <Tabs
                    value={activeTab}
                    onValueChange={(v) => setActiveTab(v as "tree" | "timeline" | "stats")}
                    className="flex-1 flex flex-col min-h-0"
                  >
                    <TabsList>
                      <TabsTrigger value="tree">
                        <TreeDeciduous className="h-4 w-4 mr-2" />
                        {t("observability.traceTree")}
                      </TabsTrigger>
                      <TabsTrigger value="timeline">
                        <Activity className="h-4 w-4 mr-2" />
                        {t("observability.timeline")}
                      </TabsTrigger>
                      <TabsTrigger value="stats">
                        <BarChart3 className="h-4 w-4 mr-2" />
                        {t("observability.stats")}
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="tree" className="flex-1 mt-0 min-h-0">
                      <div className="h-full rounded-lg overflow-hidden bg-[#1e1e1e] border border-[#333]">
                        <ScrollArea className="h-full">
                          <div className="p-4 font-mono text-sm">
                            <SpanNode
                              node={traceTree.root}
                              formatDuration={formatDuration}
                              traceStartTime={traceTree.startTime}
                              totalDuration={traceTree.totalDuration}
                              selectedSpan={selectedSpan}
                              onSelectSpan={setSelectedSpan}
                              onOpenDetail={handleOpenDetail}
                              searchQuery={searchQuery}
                            />
                          </div>
                        </ScrollArea>
                      </div>
                    </TabsContent>

                    <TabsContent value="timeline" className="flex-1 mt-0 min-h-0">
                      <div className="h-full rounded-lg overflow-hidden border bg-card">
                        <ScrollArea className="h-full">
                          <div className="p-4">
                            <TimelineView
                              spans={filteredSpans}
                              traceStartTime={traceTree.startTime}
                              totalDuration={traceTree.totalDuration}
                              formatDuration={formatDuration}
                              selectedSpan={selectedSpan}
                              onSelectSpan={setSelectedSpan}
                            />
                          </div>
                        </ScrollArea>
                      </div>
                    </TabsContent>

                    <TabsContent value="stats" className="flex-1 mt-0 min-h-0 overflow-auto">
                      {traceStats && (
                        <div className="space-y-4">
                          {/* Summary cards */}
                          <div className="grid grid-cols-4 gap-3">
                            <div className="p-3 rounded-lg border bg-card">
                              <p className="text-2xl font-bold">{traceStats.totalSpans}</p>
                              <p className="text-xs text-muted-foreground">
                                {t("observability.spanCount")}
                              </p>
                            </div>
                            <div className="p-3 rounded-lg border bg-card">
                              <p className="text-2xl font-bold text-green-600">
                                {traceStats.successSpans}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {t("observability.successSpans")}
                              </p>
                            </div>
                            <div className="p-3 rounded-lg border bg-card">
                              <p className="text-2xl font-bold text-red-600">
                                {traceStats.errorSpans}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {t("observability.errorSpans")}
                              </p>
                            </div>
                            <div className="p-3 rounded-lg border bg-card">
                              <p className="text-2xl font-bold">{traceStats.maxDepth}</p>
                              <p className="text-xs text-muted-foreground">
                                {t("observability.maxDepth")}
                              </p>
                            </div>
                          </div>

                          {/* Operations table */}
                          <div className="rounded-lg border bg-card">
                            <div className="p-3 border-b">
                              <h3 className="font-semibold text-sm">
                                {t("observability.operations")}
                              </h3>
                            </div>
                            <div className="overflow-auto max-h-[400px]">
                              <table className="w-full text-sm">
                                <thead className="bg-muted/50 sticky top-0">
                                  <tr>
                                    <th className="text-left p-2">
                                      {t("observability.operationName")}
                                    </th>
                                    <th className="text-right p-2">
                                      {t("observability.count")}
                                    </th>
                                    <th className="text-right p-2">
                                      {t("observability.avgDuration")}
                                    </th>
                                    <th className="text-right p-2">
                                      {t("observability.totalDuration")}
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y">
                                  {traceStats.operations.map((op) => (
                                    <tr key={op.name} className="hover:bg-muted/30">
                                      <td className="p-2 font-mono text-xs">{op.name}</td>
                                      <td className="p-2 text-right">{op.count}</td>
                                      <td className="p-2 text-right">
                                        {formatDuration(op.avgDuration)}
                                      </td>
                                      <td className="p-2 text-right">
                                        {formatDuration(op.totalDuration)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </div>

                {/* Span detail panel */}
                {selectedSpan && (
                  <SpanDetailPanel
                    span={selectedSpan}
                    formatDuration={formatDuration}
                    formatDateTime={formatDateTime}
                    onClose={() => setSelectedSpan(null)}
                    onCopyId={handleCopyId}
                    copiedId={copiedId}
                  />
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* Detail Dialog - Two column view for request/response */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileJson className="h-5 w-5" />
              {detailSpan?.displayName || t("observability.spanDetails")}
            </DialogTitle>
          </DialogHeader>

          {detailSpan && (
            <div className="flex-1 min-h-0 flex gap-4" style={{ height: "calc(85vh - 100px)" }}>
              {/* Input/Request Column */}
              <div className="flex-1 flex flex-col min-h-0 min-w-0">
                <div className="flex items-center gap-2 mb-2 pb-2 border-b shrink-0">
                  <ArrowRight className="h-4 w-4 text-blue-500" />
                  <h3 className="font-semibold text-sm">
                    {detailSpan.attributes["tool.input"]
                      ? t("observability.toolInput")
                      : t("observability.requestBody")}
                  </h3>
                </div>
                <div className="flex-1 min-h-0 rounded-lg border overflow-hidden">
                  {(() => {
                    const input = detailSpan.attributes["tool.input"] ||
                      detailSpan.attributes["http.request.body"];
                    if (!input) {
                      return (
                        <div className="h-full flex items-center justify-center bg-[#1e1e1e] text-gray-500 italic">
                          {t("observability.noInputData")}
                        </div>
                      );
                    }
                    return <JsonViewer data={input} darkTheme mode="tree" />;
                  })()}
                </div>
              </div>

              {/* Output/Response Column */}
              <div className="flex-1 flex flex-col min-h-0 min-w-0">
                <div className="flex items-center gap-2 mb-2 pb-2 border-b shrink-0">
                  <ArrowLeft className="h-4 w-4 text-green-500" />
                  <h3 className="font-semibold text-sm">
                    {detailSpan.attributes["tool_result.output"]
                      ? t("observability.toolOutput")
                      : t("observability.responseBody")}
                  </h3>
                </div>
                <div className="flex-1 min-h-0 rounded-lg border overflow-hidden">
                  {(() => {
                    const output = detailSpan.attributes["tool_result.output"] ||
                      detailSpan.attributes["http.response.body"];
                    if (!output) {
                      return (
                        <div className="h-full flex items-center justify-center bg-[#1e1e1e] text-gray-500 italic">
                          {t("observability.noOutputData")}
                        </div>
                      );
                    }
                    return <JsonViewer data={output} darkTheme mode="tree" />;
                  })()}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Span tree node component
interface SpanNodeProps {
  node: TraceSpanNode;
  formatDuration: (ms: number) => string;
  traceStartTime: number;
  totalDuration: number;
  depth?: number;
  selectedSpan: TraceSpanNode | null;
  onSelectSpan: (span: TraceSpanNode) => void;
  onOpenDetail?: (span: TraceSpanNode) => void;
  searchQuery: string;
}

function SpanNode({
  node,
  formatDuration,
  traceStartTime,
  totalDuration,
  depth = 0,
  selectedSpan,
  onSelectSpan,
  onOpenDetail,
  searchQuery,
}: SpanNodeProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedSpan?.spanId === node.spanId;

  // Check if this span matches search
  const matchesSearch = searchQuery
    ? node.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      node.name.toLowerCase().includes(searchQuery.toLowerCase())
    : true;

  const statusIcon =
    node.status.code === 1 ? (
      <CheckCircle2 className="h-3 w-3 text-green-400" />
    ) : node.status.code === 2 ? (
      <XCircle className="h-3 w-3 text-red-400" />
    ) : (
      <div className="h-3 w-3 rounded-full bg-gray-500" />
    );

  const textColor =
    node.status.code === 2
      ? "text-red-400"
      : node.status.code === 1
      ? "text-gray-300"
      : "text-yellow-400";

  // Calculate timeline bar position
  const offsetPercent = ((node.startTime - traceStartTime) / totalDuration) * 100;
  const widthPercent = (node.duration / totalDuration) * 100;

  // HTTP info extraction
  const httpMethod = node.attributes["http.method"] as string | undefined;
  const httpStatusCode = node.attributes["http.status_code"] as number | undefined;

  return (
    <div className={!matchesSearch ? "opacity-40" : ""}>
      <div
        className={`flex items-center gap-2 py-1.5 hover:bg-white/5 rounded px-1 cursor-pointer ${textColor} ${
          isSelected ? "bg-blue-500/20 ring-1 ring-blue-500/50" : ""
        }`}
        onClick={(e) => {
          e.stopPropagation();
          onSelectSpan(node);
        }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) setExpanded(!expanded);
          }}
          className="flex-shrink-0"
        >
          {hasChildren ? (
            expanded ? (
              <ChevronDown className="h-3 w-3 text-gray-500" />
            ) : (
              <ChevronRight className="h-3 w-3 text-gray-500" />
            )
          ) : (
            <div className="w-3" />
          )}
        </button>
        {statusIcon}
        <span className="text-gray-500">{getSpanKindIcon(node.kind)}</span>
        <span className="flex-1 truncate">{node.displayName}</span>

        {/* HTTP badges */}
        {httpMethod && (
          <Badge
            variant="outline"
            className={`text-[10px] px-1 py-0 h-4 ${
              httpMethod === "GET"
                ? "border-blue-500/50 text-blue-400"
                : httpMethod === "POST"
                ? "border-green-500/50 text-green-400"
                : httpMethod === "PUT"
                ? "border-yellow-500/50 text-yellow-400"
                : httpMethod === "DELETE"
                ? "border-red-500/50 text-red-400"
                : "border-gray-500/50 text-gray-400"
            }`}
          >
            {httpMethod}
          </Badge>
        )}
        {httpStatusCode && (
          <Badge
            variant="outline"
            className={`text-[10px] px-1 py-0 h-4 ${
              httpStatusCode >= 200 && httpStatusCode < 300
                ? "border-green-500/50 text-green-400"
                : httpStatusCode >= 400 && httpStatusCode < 500
                ? "border-yellow-500/50 text-yellow-400"
                : httpStatusCode >= 500
                ? "border-red-500/50 text-red-400"
                : "border-gray-500/50 text-gray-400"
            }`}
          >
            {httpStatusCode}
          </Badge>
        )}

        {/* Detail button for spans with request/response data */}
        {hasDetailData(node) && onOpenDetail && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenDetail(node);
                  }}
                  className="flex-shrink-0 p-1 hover:bg-white/10 rounded"
                >
                  <Eye className="h-3 w-3 text-blue-400" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{t("observability.viewDetails")}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Mini timeline bar */}
        <div className="w-20 h-2 bg-gray-700 rounded-full overflow-hidden flex-shrink-0">
          <div
            className={`h-full ${
              node.status.code === 2
                ? "bg-red-500"
                : node.status.code === 1
                ? "bg-green-500"
                : "bg-yellow-500"
            }`}
            style={{
              marginLeft: `${offsetPercent}%`,
              width: `${Math.max(widthPercent, 2)}%`,
            }}
          />
        </div>

        <span className="text-yellow-400 text-xs w-16 text-right flex-shrink-0">
          {formatDuration(node.duration)}
        </span>
      </div>

      {hasChildren && expanded && (
        <div className="ml-4 border-l border-gray-700 pl-2">
          {node.children.map((child) => (
            <SpanNode
              key={child.spanId}
              node={child}
              formatDuration={formatDuration}
              traceStartTime={traceStartTime}
              totalDuration={totalDuration}
              depth={depth + 1}
              selectedSpan={selectedSpan}
              onSelectSpan={onSelectSpan}
              onOpenDetail={onOpenDetail}
              searchQuery={searchQuery}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Timeline view component
interface TimelineViewProps {
  spans: TraceSpanNode[];
  traceStartTime: number;
  totalDuration: number;
  formatDuration: (ms: number) => string;
  selectedSpan: TraceSpanNode | null;
  onSelectSpan: (span: TraceSpanNode) => void;
}

function TimelineView({
  spans,
  traceStartTime,
  totalDuration,
  formatDuration,
  selectedSpan,
  onSelectSpan,
}: TimelineViewProps) {
  const { t } = useTranslation();

  if (spans.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>{t("observability.noSpansFound")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {/* Time scale header */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3 pb-2 border-b">
        <div className="w-48 flex-shrink-0">{t("observability.spanName")}</div>
        <div className="flex-1 flex justify-between">
          <span>0ms</span>
          <span>{formatDuration(totalDuration / 4)}</span>
          <span>{formatDuration(totalDuration / 2)}</span>
          <span>{formatDuration((totalDuration * 3) / 4)}</span>
          <span>{formatDuration(totalDuration)}</span>
        </div>
        <div className="w-20 text-right">{t("observability.duration")}</div>
      </div>

      {/* Span rows */}
      {spans.map((span) => {
        const offsetPercent = ((span.startTime - traceStartTime) / totalDuration) * 100;
        const widthPercent = (span.duration / totalDuration) * 100;
        const isSelected = selectedSpan?.spanId === span.spanId;

        return (
          <div
            key={span.spanId}
            className={`flex items-center gap-2 py-1 px-2 rounded cursor-pointer hover:bg-muted/50 ${
              isSelected ? "bg-primary/10 ring-1 ring-primary/50" : ""
            }`}
            onClick={() => onSelectSpan(span)}
          >
            <div className="w-48 flex-shrink-0 flex items-center gap-1.5">
              {span.status.code === 1 ? (
                <CheckCircle2 className="h-3 w-3 text-green-500 flex-shrink-0" />
              ) : span.status.code === 2 ? (
                <XCircle className="h-3 w-3 text-red-500 flex-shrink-0" />
              ) : (
                <div className="h-3 w-3 rounded-full bg-yellow-500 flex-shrink-0" />
              )}
              <span className="truncate text-sm">{span.displayName}</span>
            </div>

            <div className="flex-1 h-6 bg-muted rounded relative">
              <div
                className={`absolute top-1 bottom-1 rounded ${
                  span.status.code === 2
                    ? "bg-red-500"
                    : span.status.code === 1
                    ? "bg-green-500"
                    : "bg-yellow-500"
                }`}
                style={{
                  left: `${offsetPercent}%`,
                  width: `${Math.max(widthPercent, 0.5)}%`,
                }}
              />
            </div>

            <div className="w-20 text-right text-sm text-muted-foreground">
              {formatDuration(span.duration)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Span detail panel component
interface SpanDetailPanelProps {
  span: TraceSpanNode;
  formatDuration: (ms: number) => string;
  formatDateTime: (timestamp: number) => string;
  onClose: () => void;
  onCopyId: (id: string, type: "trace" | "span") => void;
  copiedId: string | null;
}

function SpanDetailPanel({
  span,
  formatDuration,
  formatDateTime,
  onClose,
  onCopyId,
  copiedId,
}: SpanDetailPanelProps) {
  const { t } = useTranslation();
  const [activeDetailTab, setActiveDetailTab] = useState<"info" | "attributes" | "events">(
    "info"
  );

  // Extract HTTP info
  const httpMethod = span.attributes["http.method"] as string | undefined;
  const httpStatusCode = span.attributes["http.status_code"] as number | undefined;
  const httpRoute = span.attributes["http.route"] as string | undefined;
  const httpUrl = span.attributes["http.url"] as string | undefined;
  const httpTarget = span.attributes["http.target"] as string | undefined;

  return (
    <div className="w-80 flex flex-col rounded-lg border bg-card overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b flex items-center justify-between bg-muted/30">
        <h3 className="font-semibold text-sm truncate flex-1">{t("observability.spanDetails")}</h3>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Span name */}
      <div className="p-3 border-b">
        <div className="flex items-center gap-2">
          {span.status.code === 1 ? (
            <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
          ) : span.status.code === 2 ? (
            <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
          ) : (
            <div className="h-4 w-4 rounded-full bg-yellow-500 flex-shrink-0" />
          )}
          <span className="font-medium text-sm truncate">{span.displayName}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1 font-mono">{span.name}</p>

        {/* Span ID with copy */}
        <div className="flex items-center gap-1 mt-2">
          <span className="text-xs text-muted-foreground">ID:</span>
          <code className="text-xs font-mono truncate flex-1">{span.spanId}</code>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={() => onCopyId(span.spanId, "span")}
                >
                  {copiedId === span.spanId ? (
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("observability.copySpanId")}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeDetailTab}
        onValueChange={(v) => setActiveDetailTab(v as "info" | "attributes" | "events")}
        className="flex-1 flex flex-col min-h-0"
      >
        <TabsList className="mx-2 mt-2">
          <TabsTrigger value="info" className="text-xs">
            <Info className="h-3 w-3 mr-1" />
            {t("observability.info")}
          </TabsTrigger>
          <TabsTrigger value="attributes" className="text-xs">
            <Tag className="h-3 w-3 mr-1" />
            {t("observability.attributes")}
          </TabsTrigger>
          <TabsTrigger value="events" className="text-xs">
            <Zap className="h-3 w-3 mr-1" />
            {t("observability.events")}
            {span.events.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                {span.events.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1">
          <TabsContent value="info" className="mt-0 p-3 space-y-3">
            {/* Status */}
            {span.status.code === 2 && span.status.message && (
              <div className="p-2 rounded bg-red-500/10 border border-red-500/30">
                <div className="flex items-center gap-1.5 text-red-500 text-xs font-medium">
                  <AlertTriangle className="h-3 w-3" />
                  {t("observability.error")}
                </div>
                <p className="text-xs mt-1 text-red-400">{span.status.message}</p>
              </div>
            )}

            {/* HTTP Info */}
            {(httpMethod || httpStatusCode || httpRoute || httpUrl) && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  HTTP
                </div>
                {httpMethod && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t("observability.method")}</span>
                    <Badge
                      variant="outline"
                      className={`${
                        httpMethod === "GET"
                          ? "border-blue-500/50 text-blue-500"
                          : httpMethod === "POST"
                          ? "border-green-500/50 text-green-500"
                          : httpMethod === "PUT"
                          ? "border-yellow-500/50 text-yellow-500"
                          : httpMethod === "DELETE"
                          ? "border-red-500/50 text-red-500"
                          : ""
                      }`}
                    >
                      {httpMethod}
                    </Badge>
                  </div>
                )}
                {httpStatusCode && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t("observability.statusCode")}</span>
                    <Badge
                      variant="outline"
                      className={`${
                        httpStatusCode >= 200 && httpStatusCode < 300
                          ? "border-green-500/50 text-green-500"
                          : httpStatusCode >= 400 && httpStatusCode < 500
                          ? "border-yellow-500/50 text-yellow-500"
                          : httpStatusCode >= 500
                          ? "border-red-500/50 text-red-500"
                          : ""
                      }`}
                    >
                      {httpStatusCode}
                    </Badge>
                  </div>
                )}
                {(httpRoute || httpTarget) && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">{t("observability.route")}</span>
                    <p className="font-mono text-xs mt-0.5 break-all">
                      {httpRoute || httpTarget}
                    </p>
                  </div>
                )}
                {httpUrl && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">URL</span>
                    <p className="font-mono text-xs mt-0.5 break-all">{httpUrl}</p>
                  </div>
                )}
              </div>
            )}

            {/* Timing */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t("observability.timing")}
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground text-xs">{t("observability.start")}</span>
                  <p className="font-mono text-xs">{formatDateTime(span.startTime)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">{t("observability.end")}</span>
                  <p className="font-mono text-xs">{formatDateTime(span.endTime)}</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t("observability.duration")}</span>
                <span className="font-mono font-medium">{formatDuration(span.duration)}</span>
              </div>
            </div>

            {/* Span Kind */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t("observability.spanKind")}
              </div>
              <div className="flex items-center gap-2">
                {getSpanKindIcon(span.kind)}
                <span className="text-sm">{SPAN_KIND_NAMES[span.kind] || `UNKNOWN (${span.kind})`}</span>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="attributes" className="mt-0 p-3">
            {Object.keys(span.attributes).length === 0 ? (
              <div className="text-center text-muted-foreground py-4 text-sm">
                <FileJson className="h-6 w-6 mx-auto mb-2 opacity-50" />
                {t("observability.noAttributes")}
              </div>
            ) : (
              <div className="space-y-2">
                {Object.entries(span.attributes).map(([key, value]) => (
                  <div key={key} className="text-sm">
                    <span className="text-muted-foreground text-xs font-mono">{key}</span>
                    <p className="font-mono text-xs mt-0.5 break-all bg-muted/50 p-1.5 rounded">
                      {typeof value === "object" ? JSON.stringify(value, null, 2) : String(value)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="events" className="mt-0 p-3">
            {span.events.length === 0 ? (
              <div className="text-center text-muted-foreground py-4 text-sm">
                <Zap className="h-6 w-6 mx-auto mb-2 opacity-50" />
                {t("observability.noEvents")}
              </div>
            ) : (
              <div className="space-y-3">
                {span.events.map((event, index) => (
                  <div key={index} className="p-2 rounded border bg-muted/30">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{event.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(event.time).toLocaleTimeString()}
                      </span>
                    </div>
                    {event.attributes && Object.keys(event.attributes).length > 0 && (
                      <div className="mt-2 space-y-1">
                        {Object.entries(event.attributes).map(([key, value]) => (
                          <div key={key} className="text-xs">
                            <span className="text-muted-foreground font-mono">{key}:</span>
                            <span className="ml-1 font-mono">
                              {typeof value === "object"
                                ? JSON.stringify(value)
                                : String(value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
}
