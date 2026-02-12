/**
 * Chat Monitor Page
 *
 * Displays traces for /api/agent/run executions with tree visualization
 */
import { useState, useEffect, useCallback } from "react";
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
import { useTranslation } from "react-i18next";
import { getGatewayUrl } from "@/lib/gateway";

// Types from telemetry
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
  events: Array<{ name: string; time: number; attributes?: Record<string, unknown> }>;
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
  const [activeTab, setActiveTab] = useState<"tree" | "stats">("tree");

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

  // Load traces for selected date
  const loadTraces = useCallback(async (date: string) => {
    if (!date) return;

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `${getGatewayUrl()}/api/telemetry/traces?date=${date}`
      );
      if (!response.ok) throw new Error("Failed to load traces");
      const data = await response.json();
      setTraces(data.traces || []);

      // Clear selection if not in new list
      setSelectedTraceId("");
      setTraceTree(null);
      setTraceStats(null);
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

  // Load traces when date changes
  useEffect(() => {
    if (selectedDate) {
      loadTraces(selectedDate);
    }
  }, [selectedDate, loadTraces]);

  // Load trace detail when selection changes
  useEffect(() => {
    if (selectedTraceId) {
      loadTraceDetail(selectedTraceId);
    }
  }, [selectedTraceId, loadTraceDetail]);

  const handleRefresh = () => {
    loadDates();
    if (selectedDate) {
      loadTraces(selectedDate);
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
                  <div>
                    <p className="font-mono text-sm">{selectedTraceId}</p>
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

              {/* Tabs */}
              <Tabs
                value={activeTab}
                onValueChange={(v) => setActiveTab(v as "tree" | "stats")}
                className="flex-1 flex flex-col min-h-0"
              >
                <TabsList>
                  <TabsTrigger value="tree">
                    <TreeDeciduous className="h-4 w-4 mr-2" />
                    {t("observability.traceTree")}
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
                        <SpanNode node={traceTree.root} formatDuration={formatDuration} />
                      </div>
                    </ScrollArea>
                  </div>
                </TabsContent>

                <TabsContent value="stats" className="flex-1 mt-0 min-h-0">
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
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// Span tree node component
interface SpanNodeProps {
  node: TraceSpanNode;
  formatDuration: (ms: number) => string;
  depth?: number;
}

function SpanNode({ node, formatDuration, depth = 0 }: SpanNodeProps) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;

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

  return (
    <div>
      <div
        className={`flex items-center gap-2 py-1 hover:bg-white/5 rounded px-1 cursor-pointer ${textColor}`}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDown className="h-3 w-3 text-gray-500 flex-shrink-0" />
          ) : (
            <ChevronRight className="h-3 w-3 text-gray-500 flex-shrink-0" />
          )
        ) : (
          <div className="w-3" />
        )}
        {statusIcon}
        <span className="flex-1 truncate">{node.displayName}</span>
        <span className="text-yellow-400 text-xs">{formatDuration(node.duration)}</span>
      </div>

      {hasChildren && expanded && (
        <div className="ml-4 border-l border-gray-700 pl-2">
          {node.children.map((child) => (
            <SpanNode
              key={child.spanId}
              node={child}
              formatDuration={formatDuration}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
