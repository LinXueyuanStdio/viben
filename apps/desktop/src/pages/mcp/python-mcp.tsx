import { useState, useMemo, useEffect, useRef } from "react";
import {
  Copy,
  Check,
  Info,
  Play,
  Plus,
  Trash2,
  Save,
  RefreshCw,
  Terminal,
  Wifi,
  WifiOff,
  History,
  Circle,
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { getGatewayUrl } from "@/lib/gateway/config";
import { useAcpSessionStore } from "@/stores/acp-session-store";
import { toast } from "@/hooks/use-toast";
import { createJSONEditor, Mode } from "vanilla-jsoneditor";
import "vanilla-jsoneditor/themes/jse-theme-dark.css";

const PYTHON_MCP_PATH = "/api/mcp-server/python";
const API_PREFIX = "/api/python-mcp";

// Module-level constant: string patterns for Python tokenizer (Issue 19)
const STR_PATTERNS = [
  /^(.*?)("""[\s\S]*?""")/,
  /^(.*?)('''[\s\S]*?''')/,
  /^(.*?)(f"(?:[^"\\]|\\.)*")/,
  /^(.*?)(f'(?:[^'\\]|\\.)*')/,
  /^(.*?)("(?:[^"\\]|\\.)*")/,
  /^(.*?)('(?:[^'\\]|\\.)*')/,
];

interface PythonMcpConfig {
  jupyter_url: string;
  jupyter_token: string;
}

interface SessionInfo {
  acp_session_id: string;
  current_kernel_id: string;
  kernel_count: number;
  created_at: number;
  last_used_at: number;
}

interface LogEntry {
  type: "code" | "result";
  code_id: string;
  timestamp: number;
  code?: string;
  description?: string;
  status?: string;
  outputs?: Array<{
    type: string;
    stream_name?: string;
    text?: string;
    data?: Record<string, string>;
  }>;
  error?: { name: string; value: string; traceback: string[] };
}

interface KernelHistory {
  kernel_id: string;
  created_at: number;
  entries: LogEntry[];
}

interface SkillMeta {
  name: string;
  description: string;
}

interface SkillConfig {
  name: string;
  description: string;
  code_for_interpreter?: string;
  code_for_agent?: string;
}

export function PythonMcpPage() {
  const { t } = useTranslation();
  const [copied, setCopied] = useState<string | null>(null);
  const gatewayUrl = useMemo(() => getGatewayUrl(), []);
  const activeSessionId = useAcpSessionStore((s) => s.activeSessionId);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  void t;

  useEffect(() => () => clearTimeout(copyTimerRef.current!), []);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    clearTimeout(copyTimerRef.current!);
    copyTimerRef.current = setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold font-serif">Python MCP</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {i18n.t("pythonMcp.description", "通过 Jupyter Server 为 AI Agent 提供 Python 代码执行能力")}
          </p>
        </div>

        <JupyterConfigSection gatewayUrl={gatewayUrl} />
        <SessionMappingSection gatewayUrl={gatewayUrl} />
        <SkillsSection gatewayUrl={gatewayUrl} />
        <McpConfigSection
          gatewayUrl={gatewayUrl}
          activeSessionId={activeSessionId}
          copied={copied}
          copyToClipboard={copyToClipboard}
        />
      </div>
    </div>
  );
}

function JupyterConfigSection({ gatewayUrl }: { gatewayUrl: string }) {
  const [config, setConfig] = useState<PythonMcpConfig>({
    jupyter_url: "http://localhost:8888",
    jupyter_token: "",
  });
  const [status, setStatus] = useState<"unknown" | "connected" | "disconnected">(
    "unknown"
  );
  const [saving, setSaving] = useState(false);
  // Issue 16: config load failure state
  const [configError, setConfigError] = useState(false);

  useEffect(() => {
    fetch(`${gatewayUrl}${API_PREFIX}/config`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => {
        setConfig(data);
        setConfigError(false);
      })
      .catch(() => setConfigError(true));
  }, [gatewayUrl]);

  const saveConfig = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${gatewayUrl}${API_PREFIX}/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (res.ok) {
        toast.success(i18n.t("pythonMcp.configSaved", "配置已保存"));
      } else {
        toast.error(i18n.t("pythonMcp.saveFailed", "保存失败"));
      }
    } catch {
      toast.error(i18n.t("pythonMcp.saveFailed", "保存失败"));
    } finally {
      setSaving(false);
    }
  };

  // Issue 17: test connection loading state
  const [testing, setTesting] = useState(false);

  // Issue 17: wrap with loading state
  const testConnection = async () => {
    setTesting(true);
    try {
      const res = await fetch(`${config.jupyter_url}/api/kernels`, {
        headers: { Authorization: `token ${config.jupyter_token}` },
      });
      setStatus(res.ok ? "connected" : "disconnected");
    } catch {
      setStatus("disconnected");
    } finally {
      setTesting(false);
    }
  };

  // Issue 18: token show/hide toggle
  const [showToken, setShowToken] = useState(false);

  return (
    <section className="rounded-xl border bg-card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Terminal className="h-4 w-4 text-primary" />
        <h2 className="font-semibold">{i18n.t("pythonMcp.jupyterConfig", "Jupyter 连接配置")}</h2>
      </div>
      {/* Issue 16: show error when config fails to load */}
      {configError && (
        <p className="text-xs text-destructive">{i18n.t("pythonMcp.configLoadFailed", "配置加载失败，显示的是默认值")}</p>
      )}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <label className="text-xs w-20 shrink-0">Base URL</label>
          <input
            className="flex-1 rounded-md border bg-muted/50 px-3 py-1.5 text-sm font-mono"
            value={config.jupyter_url}
            onChange={(e) =>
              setConfig((c) => ({ ...c, jupyter_url: e.target.value }))
            }
          />
        </div>
        {/* Issue 18: token field with show/hide toggle */}
        <div className="flex items-center gap-2">
          <label className="text-xs w-20 shrink-0">Token</label>
          <div className="flex-1 flex items-center gap-1">
            <input
              type={showToken ? "text" : "password"}
              className="flex-1 rounded-md border bg-muted/50 px-3 py-1.5 text-sm font-mono"
              value={config.jupyter_token}
              onChange={(e) =>
                setConfig((c) => ({ ...c, jupyter_token: e.target.value }))
              }
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => setShowToken((v) => !v)}
            >
              {showToken ? (
                <EyeOff className="h-3.5 w-3.5" />
              ) : (
                <Eye className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={saveConfig} disabled={saving}>
            <Save className="h-3 w-3 mr-1" />
            {i18n.t("pythonMcp.save", "保存")}
          </Button>
          {/* Issue 17: disable button while testing */}
          <Button size="sm" variant="outline" onClick={testConnection} disabled={testing}>
            {testing ? i18n.t("pythonMcp.testing", "测试中...") : i18n.t("pythonMcp.testConnection", "测试连接")}
          </Button>
          <span className="text-xs">
            {status === "connected" && (
              <span className="text-green-500 flex items-center gap-1">
                <Wifi className="h-3 w-3" /> {i18n.t("pythonMcp.connected", "已连接")}
              </span>
            )}
            {status === "disconnected" && (
              <span className="text-destructive flex items-center gap-1">
                <WifiOff className="h-3 w-3" /> {i18n.t("pythonMcp.disconnected", "未连接")}
              </span>
            )}
          </span>
        </div>
      </div>
    </section>
  );
}

const PAGE_SIZE = 5;

function SessionMappingSection({ gatewayUrl }: { gatewayUrl: string }) {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [creatingTemp, setCreatingTemp] = useState(false);
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(0);

  const refresh = async () => {
    const res = await fetch(`${gatewayUrl}${API_PREFIX}/sessions`);
    if (res.ok) {
      setSessions(await res.json());
    }
  };

  useEffect(() => {
    refresh();
  }, [gatewayUrl]);

  const createTempSession = async () => {
    setCreatingTemp(true);
    try {
      const res = await fetch(`${gatewayUrl}${API_PREFIX}/sessions/temp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        await refresh();
        toast.success(i18n.t("pythonMcp.tempSessionCreated", "临时会话已创建"));
      } else {
        toast.error(i18n.t("pythonMcp.createFailed", "创建失败"));
      }
    } catch {
      toast.error(i18n.t("pythonMcp.createFailed", "创建失败"));
    }
    setCreatingTemp(false);
  };

  const filtered = useMemo(() => {
    if (!filter.trim()) return sessions;
    const q = filter.toLowerCase();
    return sessions.filter(
      (s) =>
        s.acp_session_id.toLowerCase().includes(q) ||
        s.current_kernel_id.toLowerCase().includes(q)
    );
  }, [sessions, filter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const paged = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  useEffect(() => {
    setPage(0);
  }, [filter]);

  return (
    <section className="rounded-xl border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{i18n.t("pythonMcp.codeSession", "代码会话")}</h2>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" onClick={createTempSession} disabled={creatingTemp}>
            <Plus className="h-3 w-3 mr-1" />
            {creatingTemp ? i18n.t("pythonMcp.creating", "创建中...") : i18n.t("pythonMcp.newSession", "新建")}
          </Button>
          <Button size="sm" variant="ghost" onClick={refresh}>
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Filter input */}
      {sessions.length > 0 && (
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            className="w-full rounded-md border bg-muted/50 pl-8 pr-3 py-1.5 text-sm font-mono placeholder:text-muted-foreground/60"
            placeholder={i18n.t("pythonMcp.filterSessionKernel", "过滤 Session ID / Kernel ID...")}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
      )}

      {sessions.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-4">
          <p className="text-sm text-muted-foreground">{i18n.t("pythonMcp.noActiveSessions", "暂无活跃 Session")}</p>
          <Button
            size="sm"
            variant="outline"
            onClick={createTempSession}
            disabled={creatingTemp}
          >
            <Plus className="h-3 w-3 mr-1" />
            {creatingTemp ? i18n.t("pythonMcp.creating", "创建中...") : i18n.t("pythonMcp.createTempSession", "创建临时会话")}
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          {i18n.t("pythonMcp.noMatches", "无匹配结果")}
        </p>
      ) : (
        <>
          <div className="space-y-1.5">
            {paged.map((s) => (
              <SessionRow key={s.acp_session_id} session={s} gatewayUrl={gatewayUrl} onDelete={refresh} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-muted-foreground">
                {i18n.t("pythonMcp.sessionsCount", "{{count}} 条会话，第 {{current}}/{{total}} 页", { count: filtered.length, current: currentPage + 1, total: totalPages })}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  disabled={currentPage === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  disabled={currentPage >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return i18n.t("pythonMcp.justNow", "刚刚");
  return i18n.t("pythonMcp.minutesAgo", "{{count}} 分钟前", { count: Math.floor(diff / 60000) });
  if (diff < 86400000) return i18n.t("pythonMcp.hoursAgo", "{{count}} 小时前", { count: Math.floor(diff / 3600000) });
  return i18n.t("pythonMcp.daysAgo", "{{count}} 天前", { count: Math.floor(diff / 86400000) });
}

function SessionRow({
  session,
  gatewayUrl,
  onDelete,
}: {
  session: SessionInfo;
  gatewayUrl: string;
  onDelete: () => void;
}) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [kernelAlive, setKernelAlive] = useState<boolean | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => () => clearTimeout(copyTimerRef.current!), []);

  // Issue 14: extract fetch into a function so it can be called on demand
  const checkKernelStatus = () => {
    fetch(`${gatewayUrl}${API_PREFIX}/kernel/${session.current_kernel_id}/status`)
      .then((r) => {
        setKernelAlive(r.ok);
        return r.ok ? r.json() : null;
      })
      .then((data) => {
        if (data && data.alive !== undefined) setKernelAlive(data.alive);
      })
      .catch(() => setKernelAlive(false));
  };

  useEffect(() => {
    checkKernelStatus();
  }, [gatewayUrl, session.current_kernel_id]);

  const copyField = (value: string, field: string) => {
    navigator.clipboard.writeText(value);
    setCopiedField(field);
    clearTimeout(copyTimerRef.current!);
    copyTimerRef.current = setTimeout(() => setCopiedField(null), 1500);
  };

  const deleteSession = async () => {
    if (!window.confirm(i18n.t("pythonMcp.confirmDeleteSession", '确定删除 Session "{{id}}" 吗？此操作不可撤销。', { id: session.acp_session_id }))) return;
    try {
      const res = await fetch(`${gatewayUrl}${API_PREFIX}/sessions/${session.acp_session_id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success(i18n.t("pythonMcp.sessionDeleted", "Session 已删除"));
        onDelete();
      } else {
        toast.error(i18n.t("pythonMcp.deleteFailed", "删除失败"));
      }
    } catch {
      toast.error(i18n.t("pythonMcp.deleteFailed", "删除失败"));
    }
  };

  return (
    <div className="rounded-lg border bg-muted/30 px-4 py-3 space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-medium text-muted-foreground uppercase w-16 shrink-0">
          Session
        </span>
        <code className="text-xs font-mono flex-1 truncate">
          {session.acp_session_id}
        </code>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 shrink-0"
          onClick={() => copyField(session.acp_session_id, "session")}
        >
          {copiedField === "session" ? (
            <Check className="h-2.5 w-2.5 text-green-500" />
          ) : (
            <Copy className="h-2.5 w-2.5" />
          )}
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-medium text-muted-foreground uppercase w-16 shrink-0">
          Kernel
        </span>
        <code className="text-xs font-mono flex-1 truncate">
          {session.current_kernel_id}
        </code>
        {/* Issue 14: manual refresh button for kernel status */}
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 shrink-0"
          title={i18n.t("pythonMcp.refreshStatus", "刷新状态")}
          onClick={checkKernelStatus}
        >
          <RefreshCw className="h-2.5 w-2.5" />
        </Button>
        <span className="shrink-0">
          {kernelAlive === null ? (
            <Circle className="h-2.5 w-2.5 text-muted-foreground" />
          ) : kernelAlive ? (
            <Circle className="h-2.5 w-2.5 fill-green-500 text-green-500" />
          ) : (
            <Circle className="h-2.5 w-2.5 fill-destructive text-destructive" />
          )}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 shrink-0"
          onClick={() => copyField(session.current_kernel_id, "kernel")}
        >
          {copiedField === "kernel" ? (
            <Check className="h-2.5 w-2.5 text-green-500" />
          ) : (
            <Copy className="h-2.5 w-2.5" />
          )}
        </Button>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <span className="text-[10px] text-muted-foreground">
          {session.kernel_count} kernel(s) ·{" "}
          {kernelAlive === null
            ? i18n.t("pythonMcp.checking", "检测中...")
            : kernelAlive
              ? i18n.t("pythonMcp.running", "运行中")
              : i18n.t("pythonMcp.disconnected", "已断开")}
          {session.last_used_at > 0 && (
            <> · {i18n.t("pythonMcp.recentlyUsed", "最近使用")}: {formatRelativeTime(session.last_used_at)}</>
          )}
        </span>
        <div className="flex-1" />
        <HistoryDialog
          sessionId={session.acp_session_id}
          kernelId={session.current_kernel_id}
          gatewayUrl={gatewayUrl}
        />
        <DebugDialog
          kernelId={session.current_kernel_id}
          sessionId={session.acp_session_id}
          gatewayUrl={gatewayUrl}
        />
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs gap-1 text-destructive hover:text-destructive"
          onClick={deleteSession}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

function HistoryDialog({
  sessionId,
  kernelId,
  gatewayUrl,
}: {
  sessionId: string;
  kernelId: string;
  gatewayUrl: string;
}) {
  const [open, setOpen] = useState(false);
  const [histories, setHistories] = useState<KernelHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const loadHistory = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await fetch(
        `${gatewayUrl}${API_PREFIX}/sessions/${sessionId}/history`
      );
      if (res.ok) setHistories(await res.json());
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) loadHistory();
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1">
          <History className="h-3 w-3" />
          {i18n.t("pythonMcp.history", "历史")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4" />
            {i18n.t("pythonMcp.executionHistory", "执行历史")}
            <code className="text-xs font-normal text-muted-foreground ml-2">
              {kernelId.slice(0, 12)}...
            </code>
            <div className="flex-1" />
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={loadHistory}
              disabled={loading}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-auto mt-4 space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {i18n.t("pythonMcp.loading", "加载中...")}
            </p>
          ) : loadError ? (
            <p className="text-sm text-destructive text-center py-8">
              {i18n.t("pythonMcp.loadFailed", "加载失败")}
            </p>
          ) : histories.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {i18n.t("pythonMcp.noExecutionRecords", "暂无执行记录")}
            </p>
          ) : (
            // Issue 15: add kernel group headers
            histories.map((kh) => {
              const codeEntries = kh.entries.filter((e) => e.type === "code");
              const resultEntries = kh.entries.filter((e) => e.type === "result");
              return (
                <div key={kh.kernel_id} className="space-y-3">
                  {/* Kernel group header */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground border-b pb-1">
                    <code className="font-mono">{kh.kernel_id.slice(0, 12)}...</code>
                    <span>·</span>
                    <span>{new Date(kh.created_at).toLocaleString()}</span>
                    <span>·</span>
                    <span>{i18n.t("pythonMcp.executionCount", "{{count}} 次执行", { count: codeEntries.length })}</span>
                  </div>
                  {codeEntries.map((entry, idx) => {
                    const result = resultEntries.find(
                      (r) => r.code_id === entry.code_id
                    );
                    return (
                      <NotebookCell
                        key={entry.code_id}
                        entry={entry}
                        result={result}
                        cellIndex={idx + 1}
                      />
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NotebookCell({
  entry,
  result,
  cellIndex,
}: {
  entry: LogEntry;
  result: LogEntry | undefined;
  cellIndex: number;
}) {
  const [outputMode, setOutputMode] = useState<"rich" | "json">("rich");
  const statusColor =
    result?.status === "ok"
      ? "border-l-green-500"
      : result?.status === "error"
        ? "border-l-destructive"
        : "border-l-yellow-500";

  return (
    <div className={`rounded-lg border border-l-4 ${statusColor} overflow-hidden`}>
      {/* Cell header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/30 border-b">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-muted-foreground">
            [{cellIndex}]
          </span>
          {entry.description && (
            <span className="text-xs text-muted-foreground">
              {entry.description}
            </span>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground">
          {new Date(entry.timestamp).toLocaleTimeString()}
        </span>
      </div>

      {/* Code */}
      <PythonCodeBlock code={entry.code ?? ""} />

      {/* Output */}
      {result && (
        <div className="border-t">
          <div className="flex items-center justify-between px-3 py-1 bg-muted/20">
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded ${
                result.status === "ok"
                  ? "bg-green-500/10 text-green-500"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              {result.status}
            </span>
            <div className="flex rounded-md border text-[10px] overflow-hidden">
              <button
                className={`px-2 py-0.5 transition-colors ${
                  outputMode === "rich"
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                }`}
                onClick={() => setOutputMode("rich")}
              >
                Rich
              </button>
              <button
                className={`px-2 py-0.5 transition-colors ${
                  outputMode === "json"
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                }`}
                onClick={() => setOutputMode("json")}
              >
                JSON
              </button>
            </div>
          </div>
          <div className="p-3 max-h-[300px] overflow-auto bg-muted/10">
            {outputMode === "rich" ? (
              <RichOutput result={result} />
            ) : (
              <JsonViewer data={result} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DebugDialog({
  kernelId,
  sessionId,
  gatewayUrl,
}: {
  kernelId: string;
  sessionId: string;
  gatewayUrl: string;
}) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [executing, setExecuting] = useState(false);
  const [results, setResults] = useState<Array<{ code: string; result: LogEntry }>>([]);
  // Issue 12: ref to scroll to latest result
  const resultsEndRef = useRef<HTMLDivElement>(null);

  // Issue 12: scroll to bottom when results change
  useEffect(() => {
    resultsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [results.length]);

  const execute = async () => {
    if (!code.trim()) return;
    setExecuting(true);
    try {
      const res = await fetch(`${gatewayUrl}${API_PREFIX}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kernel_id: kernelId,
          code,
          description: "debug",
        }),
      });
      const data = await res.json();
      setResults((prev) => [...prev, { code, result: data }]);
      setCode("");
    } catch (err) {
      setResults((prev) => [
        ...prev,
        {
          code,
          result: {
            type: "result",
            code_id: `debug_${Date.now()}`,
            timestamp: Date.now(),
            status: "error",
            error: { name: "FetchError", value: String(err), traceback: [] },
          },
        },
      ]);
    }
    setExecuting(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1">
          <Play className="h-3 w-3" />
          {i18n.t("pythonMcp.debug", "调试")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Terminal className="h-4 w-4" />
            {i18n.t("pythonMcp.debugExecutor", "调试执行器")}
            <code className="text-xs font-normal text-muted-foreground ml-2">
              kernel: {kernelId.slice(0, 12)}... · session: {sessionId}
            </code>
          </DialogTitle>
        </DialogHeader>

        {/* Previous results (notebook-style) */}
        <div className="flex-1 overflow-auto mt-4 space-y-3 min-h-0">
          {results.map((r, idx) => (
            <NotebookCell
              key={idx}
              entry={{
                type: "code",
                code_id: `debug_${idx}`,
                timestamp: Date.now(),
                code: r.code,
                description: "debug",
              }}
              result={r.result}
              cellIndex={idx + 1}
            />
          ))}
          {/* Issue 12: sentinel div to scroll into view */}
          <div ref={resultsEndRef} />
        </div>

        {/* Input area */}
        <div className="mt-3 space-y-2 border-t pt-3">
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-200 dark:border-zinc-700/50 bg-zinc-100/50 dark:bg-zinc-800/50">
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                [{results.length + 1}] Python
              </span>
            </div>
            <textarea
              className="w-full bg-transparent px-3 py-2 text-sm font-mono min-h-[80px] resize-y text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none"
              placeholder={i18n.t("pythonMcp.enterCode", "# 输入 Python 代码...")}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  execute();
                }
              }}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={execute}
              disabled={executing || !code.trim()}
            >
              <Play className="h-3 w-3 mr-1" />
              {executing ? i18n.t("pythonMcp.executing", "执行中...") : i18n.t("pythonMcp.execute", "执行")}
              <kbd className="ml-2 text-[10px] opacity-60">⌘↵</kbd>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


function PythonCodeBlock({ code }: { code: string }) {
  const lines = code.split("\n");

  return (
    <div className="overflow-hidden bg-zinc-50 dark:bg-zinc-900">
      <div className="flex text-xs font-mono">
        {/* Line numbers */}
        <div className="select-none px-3 py-3 text-right text-zinc-400 dark:text-zinc-500 bg-zinc-100/80 dark:bg-zinc-900/80 border-r border-zinc-200 dark:border-zinc-700/50">
          {lines.map((_, i) => (
            <div key={i} className="h-5 leading-5">
              {i + 1}
            </div>
          ))}
        </div>
        {/* Code with Python highlighting */}
        <pre className="flex-1 p-3 overflow-x-auto">
          <code className="text-zinc-800 dark:text-zinc-200">
            {lines.map((line, i) => (
              <div key={i} className="h-5 leading-5">
                <PythonHighlightedLine line={line} />
              </div>
            ))}
          </code>
        </pre>
      </div>
    </div>
  );
}

function PythonHighlightedLine({ line }: { line: string }) {
  const tokens = useMemo(() => tokenizePythonLine(line), [line]);
  return (
    <>
      {tokens.map((token, i) => (
        <span key={i} className={token.className}>
          {token.text}
        </span>
      ))}
    </>
  );
}

interface Token {
  text: string;
  className: string;
}

function tokenizePythonLine(line: string): Token[] {
  if (!line) return [{ text: "\n", className: "" }];

  const result: Token[] = [];
  let remaining = line;

  while (remaining.length > 0) {
    let earliest = { index: remaining.length, length: 0, className: "", match: "" };

    // Check comment (highest priority)
    const commentMatch = remaining.match(/^(.*?)(#.*)$/);
    if (commentMatch && commentMatch[2]) {
      if (commentMatch[1]) {
        result.push(...tokenizeNonComment(commentMatch[1]));
      }
      result.push({ text: commentMatch[2], className: "text-zinc-500 dark:text-zinc-500 italic" });
      remaining = "";
      continue;
    }

    // Issue 19: use module-level STR_PATTERNS instead of recreating on every call
    let foundStr = false;
    for (const pat of STR_PATTERNS) {
      const m = remaining.match(pat);
      if (m && m[2] && m[1].length < earliest.index) {
        earliest = { index: m[1].length, length: m[2].length, className: "text-emerald-600 dark:text-emerald-400", match: m[2] };
        foundStr = true;
      }
    }

    if (foundStr && earliest.index < remaining.length) {
      if (earliest.index > 0) {
        result.push(...tokenizeNonComment(remaining.slice(0, earliest.index)));
      }
      result.push({ text: earliest.match, className: earliest.className });
      remaining = remaining.slice(earliest.index + earliest.length);
      continue;
    }

    result.push(...tokenizeNonComment(remaining));
    remaining = "";
  }

  return result;
}

function tokenizeNonComment(text: string): Token[] {
  if (!text) return [];
  const tokens: Token[] = [];
  const words = text.split(/(\s+|\b|(?=[.()\[\]{},;:=+\-*/<>!&|^~%@]))/);

  let buffer = "";
  for (const word of words) {
    if (
      /^(import|from|def|class|return|if|elif|else|for|while|try|except|finally|with|as|yield|lambda|and|or|not|in|is|raise|pass|break|continue|global|nonlocal|assert|del|async|await)$/.test(
        word
      )
    ) {
      if (buffer) {
        tokens.push({ text: buffer, className: "text-zinc-800 dark:text-zinc-200" });
        buffer = "";
      }
      tokens.push({ text: word, className: "text-purple-600 dark:text-purple-400 font-medium" });
    } else if (/^(True|False|None)$/.test(word)) {
      if (buffer) {
        tokens.push({ text: buffer, className: "text-zinc-800 dark:text-zinc-200" });
        buffer = "";
      }
      tokens.push({ text: word, className: "text-orange-600 dark:text-orange-400" });
    } else if (
      /^(print|len|range|int|str|float|list|dict|set|tuple|type|isinstance|getattr|setattr|hasattr|enumerate|zip|map|filter|sorted|reversed|open|super|property|staticmethod|classmethod|chr|ord)$/.test(
        word
      )
    ) {
      if (buffer) {
        tokens.push({ text: buffer, className: "text-zinc-800 dark:text-zinc-200" });
        buffer = "";
      }
      tokens.push({ text: word, className: "text-sky-600 dark:text-sky-400" });
    } else if (/^\d+\.?\d*(?:e[+-]?\d+)?$/.test(word)) {
      if (buffer) {
        tokens.push({ text: buffer, className: "text-zinc-800 dark:text-zinc-200" });
        buffer = "";
      }
      tokens.push({ text: word, className: "text-amber-600 dark:text-amber-300" });
    } else if (/^@\w+/.test(word)) {
      if (buffer) {
        tokens.push({ text: buffer, className: "text-zinc-800 dark:text-zinc-200" });
        buffer = "";
      }
      tokens.push({ text: word, className: "text-yellow-600 dark:text-yellow-400" });
    } else {
      buffer += word;
    }
  }
  if (buffer) {
    tokens.push({ text: buffer, className: "text-zinc-800 dark:text-zinc-200" });
  }
  return tokens;
}

function JsonViewer({ data }: { data: unknown }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<ReturnType<typeof createJSONEditor> | null>(null);
  const isDark = document.documentElement.classList.contains("dark");

  useEffect(() => {
    if (!containerRef.current) return;
    editorRef.current = createJSONEditor({
      target: containerRef.current,
      props: {
        mode: Mode.tree,
        readOnly: true,
        content: { json: data },
      },
    });
    return () => {
      if (editorRef.current) {
        editorRef.current.destroy();
        editorRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.set({ json: data });
    }
  }, [data]);

  return <div ref={containerRef} className={`${isDark ? "jse-theme-dark" : ""} min-h-[200px]`} />;
}

function RichOutput({ result }: { result: LogEntry }) {
  const outputs = result.outputs ?? [];
  const error = result.error;

  return (
    <div className="space-y-2 text-xs font-mono">
      {outputs.map((output, i) => {
        if (output.type === "stream") {
          return (
            <pre
              key={i}
              className={`whitespace-pre-wrap ${output.stream_name === "stderr" ? "text-yellow-500" : "text-zinc-800 dark:text-zinc-200"}`}
            >
              {output.text}
            </pre>
          );
        }
        if (
          output.type === "execute_result" ||
          output.type === "display_data"
        ) {
          const data = output.data;
          if (!data) return null;
          if (data["image/png"]) {
            return (
              <img
                key={i}
                src={`data:image/png;base64,${data["image/png"]}`}
                className="max-w-full rounded"
              />
            );
          }
          if (data["image/jpeg"]) {
            return (
              <img
                key={i}
                src={`data:image/jpeg;base64,${data["image/jpeg"]}`}
                className="max-w-full rounded"
              />
            );
          }
          if (data["text/html"]) {
            return (
              <iframe
                key={i}
                srcDoc={`<style>body{color-scheme:light dark;font-family:monospace;margin:8px;}@media(prefers-color-scheme:dark){body{background:#1a1a2e;color:#eee;}}@media(prefers-color-scheme:light){body{background:#fff;color:#222;}}</style>${data["text/html"]}`}
                className="w-full min-h-[120px] border rounded"
                sandbox=""
              />
            );
          }
          if (data["text/plain"]) {
            return (
              <pre key={i} className="text-emerald-700 dark:text-emerald-400 whitespace-pre-wrap">
                {data["text/plain"]}
              </pre>
            );
          }
        }
        if (output.type === "error" && output.text) {
          return (
            <pre key={i} className="text-destructive whitespace-pre-wrap">
              {stripAnsi(output.text)}
            </pre>
          );
        }
        return null;
      })}
      {error && (
        <pre className="text-destructive whitespace-pre-wrap">
          {error.name}: {error.value}
          {"\n"}
          {error.traceback.map(stripAnsi).join("\n")}
        </pre>
      )}
      {outputs.length === 0 && !error && (
        <span className="text-muted-foreground italic">{i18n.t("pythonMcp.noOutput", "无输出")}</span>
      )}
    </div>
  );
}

function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}


function SkillsSection({ gatewayUrl }: { gatewayUrl: string }) {
  const [skills, setSkills] = useState<SkillMeta[]>([]);
  const [editing, setEditing] = useState<SkillConfig | null>(null);
  const [isNew, setIsNew] = useState(false);

  const refresh = async () => {
    const res = await fetch(`${gatewayUrl}${API_PREFIX}/skills`);
    if (res.ok) setSkills(await res.json());
  };

  useEffect(() => {
    refresh();
  }, [gatewayUrl]);

  const startNew = () => {
    setEditing({
      name: "",
      description: "",
      code_for_interpreter: "",
      code_for_agent: "",
    });
    setIsNew(true);
  };

  const saveSkill = async () => {
    if (!editing) return;
    const method = isNew ? "POST" : "PUT";
    const url = isNew
      ? `${gatewayUrl}${API_PREFIX}/skills`
      : `${gatewayUrl}${API_PREFIX}/skills/${editing.name}`;
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing),
      });
      if (res.ok) {
        toast.success(i18n.t("pythonMcp.skillSaved", "Skill 已保存"));
        setEditing(null);
        setIsNew(false);
        refresh();
      } else {
        toast.error(i18n.t("pythonMcp.saveFailed", "保存失败"));
      }
    } catch {
      toast.error(i18n.t("pythonMcp.saveFailed", "保存失败"));
    }
  };

  const deleteSkill = async (name: string) => {
    if (!window.confirm(i18n.t("pythonMcp.confirmDeleteSkill", '确定删除 Skill "{{name}}" 吗？此操作不可撤销。', { name }))) return;
    try {
      const res = await fetch(`${gatewayUrl}${API_PREFIX}/skills/${name}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success(i18n.t("pythonMcp.skillDeleted", "Skill 已删除"));
        setEditing(null);
        refresh();
      } else {
        toast.error(i18n.t("pythonMcp.deleteFailed", "删除失败"));
      }
    } catch {
      toast.error(i18n.t("pythonMcp.deleteFailed", "删除失败"));
    }
  };

  return (
    <section className="rounded-xl border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{i18n.t("pythonMcp.skillsManagement", "Skills 管理")}</h2>
        <Button size="sm" variant="outline" onClick={startNew}>
          <Plus className="h-3 w-3 mr-1" /> {i18n.t("pythonMcp.newSkill", "新建 Skill")}
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {skills.map((s) => (
          <Button
            key={s.name}
            size="sm"
            variant={editing?.name === s.name ? "default" : "outline"}
            onClick={async () => {
              try {
                const res = await fetch(`${gatewayUrl}${API_PREFIX}/skills/${s.name}`);
                if (res.ok) {
                  const full: SkillConfig = await res.json();
                  setEditing(full);
                } else {
                  setEditing({ name: s.name, description: s.description, code_for_interpreter: "", code_for_agent: "" });
                }
              } catch {
                setEditing({ name: s.name, description: s.description, code_for_interpreter: "", code_for_agent: "" });
              }
              setIsNew(false);
            }}
          >
            {s.name}
          </Button>
        ))}
      </div>
      {editing && (
        <div className="rounded-lg border p-3 space-y-2">
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-md border bg-muted/50 px-2 py-1 text-sm"
              placeholder="name"
              value={editing.name}
              onChange={(e) =>
                setEditing((s) => s && { ...s, name: e.target.value })
              }
              disabled={!isNew}
            />
            <input
              className="flex-[2] rounded-md border bg-muted/50 px-2 py-1 text-sm"
              placeholder="description"
              value={editing.description}
              onChange={(e) =>
                setEditing((s) => s && { ...s, description: e.target.value })
              }
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">
              Code for Interpreter
            </label>
            <textarea
              className="w-full rounded-md border bg-muted/50 px-2 py-1 text-xs font-mono min-h-[60px]"
              value={editing.code_for_interpreter ?? ""}
              onChange={(e) =>
                setEditing(
                  (s) => s && { ...s, code_for_interpreter: e.target.value }
                )
              }
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">
              Code for Agent
            </label>
            <textarea
              className="w-full rounded-md border bg-muted/50 px-2 py-1 text-xs font-mono min-h-[60px]"
              value={editing.code_for_agent ?? ""}
              onChange={(e) =>
                setEditing(
                  (s) => s && { ...s, code_for_agent: e.target.value }
                )
              }
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={saveSkill}>
              <Save className="h-3 w-3 mr-1" /> {i18n.t("pythonMcp.save", "保存")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setEditing(null); setIsNew(false); }}>
              {i18n.t("pythonMcp.cancel", "取消")}
            </Button>
            {!isNew && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => deleteSkill(editing.name)}
              >
                <Trash2 className="h-3 w-3 mr-1" /> {i18n.t("pythonMcp.delete", "删除")}
              </Button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function McpConfigSection({
  gatewayUrl,
  activeSessionId,
  copied,
  copyToClipboard,
}: {
  gatewayUrl: string;
  activeSessionId: string | null;
  copied: string | null;
  copyToClipboard: (text: string, key: string) => void;
}) {
  const mcpServerUrl = `${gatewayUrl}${PYTHON_MCP_PATH}`;

  const mcpConfigQueryParam = useMemo(() => {
    if (!activeSessionId) return null;
    return JSON.stringify(
      {
        mcpServers: {
          "viben-python-mcp": {
            url: `${mcpServerUrl}?session_id=${activeSessionId}`,
            transport: "streamable-http",
          },
        },
      },
      null,
      2
    );
  }, [mcpServerUrl, activeSessionId]);

  const mcpConfigHeader = useMemo(() => {
    const headers: Record<string, string> = {
      "X-Viben-Session-Id": activeSessionId ?? "<your-session-id>",
    };
    return JSON.stringify(
      {
        mcpServers: {
          "viben-python-mcp": {
            url: mcpServerUrl,
            transport: "streamable-http",
            headers,
          },
        },
      },
      null,
      2
    );
  }, [mcpServerUrl, activeSessionId]);

  return (
    <section className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Info className="h-4 w-4 text-primary" />
        <h2 className="font-semibold">{i18n.t("pythonMcp.mcpServerConfig", "MCP Server 配置")}</h2>
      </div>

      <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
        <h3 className="text-sm font-medium">{i18n.t("pythonMcp.headerDescription", "请求头说明")}</h3>
        <div className="text-xs space-y-1 text-muted-foreground">
          <div>
            <code className="bg-muted px-1.5 py-0.5 rounded text-foreground">
              X-Viben-Session-Id
            </code>
            <span className="ml-1 text-destructive font-medium">{i18n.t("pythonMcp.required", "(必需)")}</span> —
            ACP session id
          </div>
          <div>
            <code className="bg-muted px-1.5 py-0.5 rounded text-foreground">
              X-Jupyter-Url
            </code>
            <span className="ml-1">{i18n.t("pythonMcp.optional", "(可选)")}</span> — {i18n.t("pythonMcp.overrideJupyterUrl", "覆盖默认 Jupyter URL")}
          </div>
          <div>
            <code className="bg-muted px-1.5 py-0.5 rounded text-foreground">
              X-Jupyter-Token
            </code>
            <span className="ml-1">{i18n.t("pythonMcp.optional", "(可选)")}</span> — {i18n.t("pythonMcp.overrideJupyterToken", "覆盖默认 Jupyter Token")}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium">{i18n.t("pythonMcp.method1", "方式 1 — Query Parameter")}</h3>
        <ConfigCodeBlock
          code={mcpConfigQueryParam ?? i18n.t("pythonMcp.startAcpSessionFirst", "// 请先开始一个 ACP 会话")}
          onCopy={() =>
            mcpConfigQueryParam &&
            copyToClipboard(mcpConfigQueryParam, "pyConfig1")
          }
          copied={copied === "pyConfig1"}
          disabled={!mcpConfigQueryParam}
        />
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium">{i18n.t("pythonMcp.method2", "方式 2 — Header")}</h3>
        <ConfigCodeBlock
          code={mcpConfigHeader}
          onCopy={() => copyToClipboard(mcpConfigHeader, "pyConfig2")}
          copied={copied === "pyConfig2"}
        />
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium">{i18n.t("pythonMcp.endpointInfo", "端点信息")}</h3>
        <InfoRow
          label="URL"
          value={mcpServerUrl}
          onCopy={() => copyToClipboard(mcpServerUrl, "pyUrl")}
          copied={copied === "pyUrl"}
        />
        <InfoRow
          label="Transport"
          value="streamable-http"
          onCopy={() => copyToClipboard("streamable-http", "pyTransport")}
          copied={copied === "pyTransport"}
        />
      </div>
    </section>
  );
}

function InfoRow({
  label,
  value,
  onCopy,
  copied,
}: {
  label: string;
  value: string;
  onCopy?: () => void;
  copied?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-xs font-medium text-muted-foreground shrink-0">
          {label}
        </span>
        <code className="text-xs font-mono truncate">{value}</code>
      </div>
      {onCopy && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={onCopy}
        >
          {copied ? (
            <Check className="h-3 w-3 text-green-500" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </Button>
      )}
    </div>
  );
}

function ConfigCodeBlock({
  code,
  onCopy,
  copied,
  disabled,
}: {
  code: string;
  onCopy?: () => void;
  copied?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="relative group">
      <pre className="rounded-lg bg-muted/70 border p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all">
        {code}
      </pre>
      {onCopy && !disabled && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={onCopy}
        >
          {copied ? (
            <Check className="h-3 w-3 text-green-500" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </Button>
      )}
    </div>
  );
}
