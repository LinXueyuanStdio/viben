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
import { useDebounceFn } from "ahooks";
import {
  RefreshCw,
  Loader2,
  Calendar,
  Activity,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronRight,
  BarChart3,
  TreeDeciduous,
  AlertCircle,
  Copy,
  Search,
  X,
  Globe,
  FileJson,
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

// Import from observability components
import {
  SpanNode,
  TimelineView,
  SpanDetailPanel,
  copyToClipboard,
} from "@/components/observability";
import { formatDuration } from "@/lib/utils";
import type {
  TraceSpanNode,
  TraceTree,
  TraceSummary,
  DateSummary,
  TraceStats,
} from "@/components/observability";

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
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");

  // Debounce search query updates (300ms)
  const { run: updateDebouncedSearch } = useDebounceFn(
    (query: string) => setDebouncedSearchQuery(query),
    { wait: 300 }
  );

  // Sync debounced query when searchQuery changes
  useEffect(() => {
    updateDebouncedSearch(searchQuery);
  }, [searchQuery, updateDebouncedSearch]);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [routeFilter, setRouteFilter] = useState<string>("/api/agent/run");
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detailSpan, setDetailSpan] = useState<TraceSpanNode | null>(null);

  // Route filter options with i18n labels
  const routeFilterOptions = useMemo(() => [
    { value: "all", label: t("observability.allRoutes") },
    { value: "/api/agent/run", label: t("observability.routeFilters.agentRun") },
    { value: "/api/agent", label: t("observability.routeFilters.agents") },
    { value: "/api/workspaces", label: t("observability.routeFilters.workspaces") },
    { value: "/api/chat", label: t("observability.routeFilters.chat") },
    { value: "/api/group-chats", label: t("observability.routeFilters.groupChats") },
  ], [t]);

  // Load available dates
  const loadDates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${getGatewayUrl()}/api/telemetry/dates`);
      if (!response.ok) throw new Error(t("observability.loadDatesFailed"));
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
  }, [t]);

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
      if (!response.ok) throw new Error(t("observability.loadTracesFailed"));
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
  }, [t]);

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
        if (!response.ok) throw new Error(t("observability.loadTraceFailed"));
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
    [selectedDate, t]
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

  // Pre-compute searchable attribute strings (excluding large bodies)
  const spansWithSearchableAttrs = useMemo(() => {
    return flattenedSpans.map((span) => {
      // Create a shallow copy without large body fields for search
      const searchableAttrs = { ...span.attributes };
      delete searchableAttrs["http.request.body"];
      delete searchableAttrs["http.response.body"];
      delete searchableAttrs["tool.input"];
      delete searchableAttrs["tool_result.output"];
      return {
        span,
        searchText: JSON.stringify(searchableAttrs).toLowerCase(),
      };
    });
  }, [flattenedSpans]);

  // Filter spans by debounced search query
  const filteredSpans = useMemo(() => {
    if (!debouncedSearchQuery.trim()) return flattenedSpans;
    const query = debouncedSearchQuery.toLowerCase();
    return spansWithSearchableAttrs
      .filter(
        ({ span, searchText }) =>
          span.displayName.toLowerCase().includes(query) ||
          span.name.toLowerCase().includes(query) ||
          span.spanId.toLowerCase().includes(query) ||
          searchText.includes(query)
      )
      .map(({ span }) => span);
  }, [spansWithSearchableAttrs, debouncedSearchQuery]);

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
                    : d.date}
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
              {routeFilterOptions.map((option) => (
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
                              searchQuery={debouncedSearchQuery}
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
