import { useState, useMemo } from "react";
import {
  ListTodo,
  Square,
  RefreshCw,
  AlertTriangle,
  Search,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Trash2,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";

interface InspectorTasksProps {
  makeRequest: <T = unknown>(method: string, params?: Record<string, unknown>) => Promise<T>;
  enabled?: boolean;
}

interface McpTask {
  id: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  progress?: number;
  progressMessage?: string;
  createdAt?: string;
  updatedAt?: string;
  result?: unknown;
  error?: string;
}

export function InspectorTasks({ makeRequest, enabled = true }: InspectorTasksProps) {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<McpTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredTasks = useMemo(() => {
    if (!searchQuery.trim()) return tasks;
    const query = searchQuery.toLowerCase();
    return tasks.filter((task) =>
      task.id.toLowerCase().includes(query) ||
      task.status.toLowerCase().includes(query)
    );
  }, [tasks, searchQuery]);

  const fetchTasks = async (cursor?: string) => {
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

      const response = await makeRequest<{ tasks: McpTask[]; nextCursor?: string }>("tasks/list", params);
      const newTasks = response.tasks || [];

      if (isLoadMore) {
        // Append to existing tasks
        setTasks((prev) => [...prev, ...newTasks]);
      } else {
        // Replace tasks on fresh load
        setTasks(newTasks);
      }

      // Store next cursor for pagination
      setNextCursor(response.nextCursor);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      if (!isLoadMore) {
        setTasks([]);
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

  const loadMoreTasks = () => {
    if (nextCursor) {
      fetchTasks(nextCursor);
    }
  };

  const cancelTask = async (taskId: string) => {
    try {
      await makeRequest("tasks/cancel", { id: taskId });
      await fetchTasks();
    } catch (error) {
      console.error("Error cancelling task:", error);
    }
  };

  const refreshTasks = async () => {
    // Clear cursor and fetch from beginning
    setNextCursor(undefined);
    await fetchTasks();
  };

  const clearAll = () => {
    setTasks([]);
    setSearchQuery("");
    setNextCursor(undefined);
  };

  const toggleTask = (id: string) => {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyTaskId = async (id: string) => {
    await navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getStatusStyle = (status: string): { icon: typeof Clock; color: string; bg: string; animate?: boolean } => {
    switch (status) {
      case "pending":
        return { icon: Clock, color: "text-yellow-500", bg: "bg-yellow-500/10" };
      case "running":
        return { icon: Loader2, color: "text-blue-500", bg: "bg-blue-500/10", animate: true };
      case "completed":
        return { icon: CheckCircle, color: "text-green-500", bg: "bg-green-500/10" };
      case "failed":
        return { icon: XCircle, color: "text-red-500", bg: "bg-red-500/10" };
      case "cancelled":
        return { icon: Square, color: "text-gray-500", bg: "bg-gray-500/10" };
      default:
        return { icon: Clock, color: "text-muted-foreground", bg: "bg-muted" };
    }
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case "pending":
        return t("inspector.taskStatus.pending", "Pending");
      case "running":
        return t("inspector.taskStatus.running", "Running");
      case "completed":
      case "done":
        return t("inspector.taskStatus.done", "Done");
      case "failed":
        return t("inspector.taskStatus.failed", "Failed");
      case "cancelled":
        return t("inspector.taskStatus.cancelled", "Cancelled");
      default:
        return status;
    }
  };

  const taskCounts = useMemo(() => {
    return {
      pending: tasks.filter((t) => t.status === "pending").length,
      running: tasks.filter((t) => t.status === "running").length,
      completed: tasks.filter((t) => t.status === "completed").length,
      failed: tasks.filter((t) => t.status === "failed").length,
    };
  }, [tasks]);

  if (!enabled) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <AlertTriangle className="h-10 w-10 text-muted-foreground mb-3" />
        <h4 className="text-sm font-medium">{t("inspector.tasksNotSupported")}</h4>
        <p className="text-xs text-muted-foreground mt-1">{t("inspector.tasksNotSupportedDesc")}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full gap-4">
      {/* Left Panel - Task List */}
      <div className="w-80 flex-shrink-0 flex flex-col border-r border-border pr-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ListTodo className="h-4 w-4 text-indigo-500" />
            <span className="text-sm font-medium">{t("inspector.tasks")}</span>
            <Badge variant="secondary" className="h-5 px-1.5 text-xs">{tasks.length}</Badge>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={clearAll} disabled={tasks.length === 0}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={refreshTasks} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder={t("inspector.searchTasks")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>

        {/* Stats */}
        {tasks.length > 0 && (
          <div className="grid grid-cols-4 gap-2 mb-3">
            <div className="text-center p-1.5 rounded bg-yellow-500/10">
              <div className="text-sm font-semibold text-yellow-600">{taskCounts.pending}</div>
              <div className="text-[10px] text-muted-foreground">{t("inspector.statusPending", "Pending")}</div>
            </div>
            <div className="text-center p-1.5 rounded bg-blue-500/10">
              <div className="text-sm font-semibold text-blue-600">{taskCounts.running}</div>
              <div className="text-[10px] text-muted-foreground">{t("inspector.statusRunning", "Running")}</div>
            </div>
            <div className="text-center p-1.5 rounded bg-green-500/10">
              <div className="text-sm font-semibold text-green-600">{taskCounts.completed}</div>
              <div className="text-[10px] text-muted-foreground">{t("inspector.statusDone", "Done")}</div>
            </div>
            <div className="text-center p-1.5 rounded bg-red-500/10">
              <div className="text-sm font-semibold text-red-600">{taskCounts.failed}</div>
              <div className="text-[10px] text-muted-foreground">{t("inspector.statusFailed", "Failed")}</div>
            </div>
          </div>
        )}

        {/* Task List */}
        <div className="flex-1 overflow-auto space-y-2">
          {tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-4">
              <ListTodo className="h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-xs text-muted-foreground">{t("inspector.noTasks")}</p>
              <Button size="sm" className="mt-3" onClick={() => fetchTasks()} disabled={loading}>
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                {t("inspector.listTasks")}
              </Button>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="text-center p-4 text-xs text-muted-foreground">
              {t("inspector.noTasksFound")}
            </div>
          ) : (
            <>
              {filteredTasks.map((task: McpTask) => {
                const style = getStatusStyle(task.status);
                const Icon = style.icon;
                const isExpanded = expandedTasks.has(task.id);

                return (
                  <div key={task.id} className="rounded-lg border border-border overflow-hidden">
                    <div
                    className="flex items-center gap-2 p-2.5 cursor-pointer hover:bg-muted/50"
                    onClick={() => toggleTask(task.id)}
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
                    <span className="font-mono text-xs flex-1 truncate">{task.id}</span>
                    <Badge variant="outline" className="text-[10px] h-4">
                      {getStatusLabel(task.status)}
                    </Badge>
                  </div>

                  {isExpanded && (
                    <div className="px-2.5 pb-2.5 space-y-2">
                      {/* Progress */}
                      {typeof task.progress === 'number' && (
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">{t("inspector.progress", "Progress")}</span>
                            <span>{task.progress}%</span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 transition-all"
                              style={{ width: `${task.progress}%` }}
                            />
                          </div>
                          {task.progressMessage && (
                            <p className="text-xs text-muted-foreground mt-1">{task.progressMessage}</p>
                          )}
                        </div>
                      )}

                      {/* Result or Error */}
                      {task.result !== undefined && task.result !== null && (
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">{t("inspector.resultLabel", "Result:")}</div>
                          <pre className="text-xs bg-muted/50 p-2 rounded overflow-x-auto max-h-32">
                            {JSON.stringify(task.result, null, 2)}
                          </pre>
                        </div>
                      )}
                      {task.error && (
                        <div>
                          <div className="text-xs text-red-500 mb-1">{t("inspector.errorLabel", "Error:")}</div>
                          <pre className="text-xs bg-red-500/10 text-red-600 p-2 rounded overflow-x-auto max-h-32">
                            {task.error}
                          </pre>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            copyTaskId(task.id);
                          }}
                        >
                          {copiedId === task.id ? (
                            <Check className="h-3 w-3 mr-1" />
                          ) : (
                            <Copy className="h-3 w-3 mr-1" />
                          )}
                          {t("inspector.copyId", "Copy ID")}
                        </Button>
                        {task.status === "running" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs text-red-600"
                            onClick={(e) => {
                              e.stopPropagation();
                              cancelTask(task.id);
                            }}
                          >
                            <Square className="h-3 w-3 mr-1" />
                            {t("inspector.cancelTask", "Cancel")}
                          </Button>
                        )}
                      </div>
                    </div>
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
                  onClick={loadMoreTasks}
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

      {/* Right Panel - Info */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex flex-col items-center justify-center h-full text-center">
          <ListTodo className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <h3 className="text-sm font-medium mb-2">{t("inspector.aboutTasks")}</h3>
          <p className="text-xs text-muted-foreground max-w-md">{t("inspector.aboutTasksDesc")}</p>
        </div>
      </div>
    </div>
  );
}
