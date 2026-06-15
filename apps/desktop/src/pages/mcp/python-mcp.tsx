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
  ChevronDown,
  ChevronRight,
  Terminal,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { getGatewayUrl } from "@/lib/gateway/config";
import { useAcpSessionStore } from "@/stores/acp-session-store";
import {
  createJSONEditor,
  Mode,
} from "vanilla-jsoneditor";
import "vanilla-jsoneditor/themes/jse-theme-dark.css";

const PYTHON_MCP_PATH = "/api/mcp-server/python";
const API_PREFIX = "/api/python-mcp";

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
  outputs?: Array<{ type: string; stream_name?: string; text?: string; data?: Record<string, unknown> }>;
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

  void t;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold font-serif">Python MCP</h1>
          <p className="text-sm text-muted-foreground mt-1">
            通过 Jupyter Server 为 AI Agent 提供 Python 代码执行能力
          </p>
        </div>

        <JupyterConfigSection gatewayUrl={gatewayUrl} />
        <SessionMappingSection gatewayUrl={gatewayUrl} />
        <DebugExecutorSection gatewayUrl={gatewayUrl} />
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
  const [config, setConfig] = useState<PythonMcpConfig>({ jupyter_url: "http://localhost:8888", jupyter_token: "" });
  const [status, setStatus] = useState<"unknown" | "connected" | "disconnected">("unknown");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`${gatewayUrl}${API_PREFIX}/config`)
      .then((r) => r.json())
      .then((data) => setConfig(data))
      .catch(() => {});
  }, [gatewayUrl]);

  const saveConfig = async () => {
    setSaving(true);
    await fetch(`${gatewayUrl}${API_PREFIX}/config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    setSaving(false);
  };

  const testConnection = async () => {
    try {
      const res = await fetch(`${config.jupyter_url}/api/kernels`, {
        headers: { Authorization: `token ${config.jupyter_token}` },
      });
      setStatus(res.ok ? "connected" : "disconnected");
    } catch {
      setStatus("disconnected");
    }
  };

  return (
    <section className="rounded-xl border bg-card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Terminal className="h-4 w-4 text-primary" />
        <h2 className="font-semibold">Jupyter 连接配置</h2>
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <label className="text-xs w-20 shrink-0">Base URL</label>
          <input
            className="flex-1 rounded-md border bg-muted/50 px-3 py-1.5 text-sm font-mono"
            value={config.jupyter_url}
            onChange={(e) => setConfig((c) => ({ ...c, jupyter_url: e.target.value }))}
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs w-20 shrink-0">Token</label>
          <input
            type="password"
            className="flex-1 rounded-md border bg-muted/50 px-3 py-1.5 text-sm font-mono"
            value={config.jupyter_token}
            onChange={(e) => setConfig((c) => ({ ...c, jupyter_token: e.target.value }))}
          />
        </div>
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={saveConfig} disabled={saving}>
            <Save className="h-3 w-3 mr-1" />
            保存
          </Button>
          <Button size="sm" variant="outline" onClick={testConnection}>
            测试连接
          </Button>
          <span className="text-xs">
            {status === "connected" && <span className="text-green-500 flex items-center gap-1"><Wifi className="h-3 w-3" /> 已连接</span>}
            {status === "disconnected" && <span className="text-destructive flex items-center gap-1"><WifiOff className="h-3 w-3" /> 未连接</span>}
          </span>
        </div>
      </div>
    </section>
  );
}

function SessionMappingSection({ gatewayUrl }: { gatewayUrl: string }) {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [histories, setHistories] = useState<Record<string, KernelHistory[]>>({});

  const refresh = async () => {
    const res = await fetch(`${gatewayUrl}${API_PREFIX}/sessions`);
    if (res.ok) setSessions(await res.json());
  };

  useEffect(() => { refresh(); }, [gatewayUrl]);

  const toggleExpand = async (sessionId: string) => {
    if (expanded === sessionId) {
      setExpanded(null);
      return;
    }
    setExpanded(sessionId);
    if (!histories[sessionId]) {
      const res = await fetch(`${gatewayUrl}${API_PREFIX}/sessions/${sessionId}/history`);
      if (res.ok) {
        const data = await res.json();
        setHistories((h) => ({ ...h, [sessionId]: data }));
      }
    }
  };

  return (
    <section className="rounded-xl border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Session → Kernel 映射</h2>
        <Button size="sm" variant="ghost" onClick={refresh}>
          <RefreshCw className="h-3 w-3" />
        </Button>
      </div>
      {sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground">暂无活跃 Session</p>
      ) : (
        <div className="space-y-1">
          {sessions.map((s) => (
            <div key={s.acp_session_id}>
              <div
                className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 cursor-pointer hover:bg-muted"
                onClick={() => toggleExpand(s.acp_session_id)}
              >
                {expanded === s.acp_session_id ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                <code className="text-xs font-mono truncate flex-1">{s.acp_session_id}</code>
                <span className="text-xs text-muted-foreground">{s.kernel_count} kernel(s)</span>
                <code className="text-xs font-mono">{s.current_kernel_id.slice(0, 8)}...</code>
              </div>
              {expanded === s.acp_session_id && histories[s.acp_session_id] && (
                <div className="ml-6 mt-1 space-y-1">
                  {histories[s.acp_session_id].map((kh) => (
                    <div key={kh.kernel_id} className="rounded border p-2 text-xs space-y-1">
                      <div className="font-mono text-muted-foreground">
                        kernel: {kh.kernel_id.slice(0, 12)}... — {kh.entries.filter((e) => e.type === "code").length} executions
                      </div>
                      {kh.entries.filter((e) => e.type === "code").slice(-5).map((entry) => (
                        <div key={entry.code_id} className="flex gap-2">
                          <span className="text-muted-foreground">{entry.code_id}</span>
                          <span className="truncate">{entry.code?.split("\n")[0]}</span>
                          {!kh.entries.find((r) => r.type === "result" && r.code_id === entry.code_id) && (
                            <span className="text-yellow-500">⏳</span>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function DebugExecutorSection({ gatewayUrl }: { gatewayUrl: string }) {
  const [kernelId, setKernelId] = useState("");
  const [code, setCode] = useState("");
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [mode, setMode] = useState<"rich" | "json">("rich");
  const jsonEditorRef = useRef<HTMLDivElement>(null);
  const editorInstance = useRef<ReturnType<typeof createJSONEditor> | null>(null);

  const execute = async () => {
    if (!kernelId || !code) return;
    setExecuting(true);
    try {
      const res = await fetch(`${gatewayUrl}${API_PREFIX}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kernel_id: kernelId, code, description: "debug" }),
      });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setResult({ status: "error", error: { name: "FetchError", value: String(err), traceback: [] } });
    }
    setExecuting(false);
  };

  useEffect(() => {
    if (mode === "json" && jsonEditorRef.current && result) {
      if (!editorInstance.current) {
        editorInstance.current = createJSONEditor({
          target: jsonEditorRef.current,
          props: {
            mode: Mode.tree,
            readOnly: true,
            content: { json: result },
          },
        });
      } else {
        editorInstance.current.set({ json: result });
      }
    }
  }, [mode, result]);

  return (
    <section className="rounded-xl border bg-card p-5 space-y-3">
      <h2 className="font-semibold">Debug 执行器</h2>
      <div className="flex items-center gap-2">
        <label className="text-xs shrink-0">Kernel ID</label>
        <input
          className="flex-1 rounded-md border bg-muted/50 px-3 py-1.5 text-sm font-mono"
          placeholder="粘贴 kernel id..."
          value={kernelId}
          onChange={(e) => setKernelId(e.target.value)}
        />
      </div>
      <textarea
        className="w-full rounded-md border bg-muted/50 px-3 py-2 text-sm font-mono min-h-[120px] resize-y"
        placeholder="# Python code..."
        value={code}
        onChange={(e) => setCode(e.target.value)}
      />
      <div className="flex items-center gap-3">
        <Button size="sm" onClick={execute} disabled={executing || !kernelId || !code}>
          <Play className="h-3 w-3 mr-1" />
          {executing ? "执行中..." : "执行"}
        </Button>
        <div className="flex rounded-md border text-xs">
          <button
            className={`px-3 py-1 ${mode === "rich" ? "bg-primary text-primary-foreground" : ""}`}
            onClick={() => setMode("rich")}
          >
            Rich
          </button>
          <button
            className={`px-3 py-1 ${mode === "json" ? "bg-primary text-primary-foreground" : ""}`}
            onClick={() => setMode("json")}
          >
            JSON
          </button>
        </div>
      </div>
      {result !== null && (
        <div className="rounded-lg border bg-muted/30 p-3 max-h-[400px] overflow-auto">
          {mode === "rich" ? (
            <RichOutput result={result as Record<string, unknown>} />
          ) : (
            <div ref={jsonEditorRef} className="jse-theme-dark" />
          )}
        </div>
      )}
    </section>
  );
}

function RichOutput({ result }: { result: Record<string, unknown> }) {
  const outputs = (result.outputs ?? []) as Array<{
    type: string;
    stream_name?: string;
    text?: string;
    data?: Record<string, string>;
  }>;
  const error = result.error as { name: string; value: string; traceback: string[] } | undefined;

  return (
    <div className="space-y-2 text-xs font-mono">
      {outputs.map((output, i) => {
        if (output.type === "stream") {
          return (
            <pre key={i} className={output.stream_name === "stderr" ? "text-yellow-500" : ""}>
              {output.text}
            </pre>
          );
        }
        if (output.type === "execute_result" || output.type === "display_data") {
          const data = output.data;
          if (!data) return null;
          if (data["image/png"]) {
            return <img key={i} src={`data:image/png;base64,${data["image/png"]}`} className="max-w-full" />;
          }
          if (data["image/jpeg"]) {
            return <img key={i} src={`data:image/jpeg;base64,${data["image/jpeg"]}`} className="max-w-full" />;
          }
          if (data["text/html"]) {
            return <iframe key={i} srcDoc={data["text/html"]} className="w-full min-h-[100px] border-0" sandbox="" />;
          }
          if (data["text/plain"]) {
            return <pre key={i}>{data["text/plain"]}</pre>;
          }
        }
        if (output.type === "error" && output.text) {
          return <pre key={i} className="text-destructive">{output.text}</pre>;
        }
        return null;
      })}
      {error && (
        <pre className="text-destructive">
          {error.name}: {error.value}
          {"\n"}
          {error.traceback.join("\n")}
        </pre>
      )}
    </div>
  );
}

function SkillsSection({ gatewayUrl }: { gatewayUrl: string }) {
  const [skills, setSkills] = useState<SkillMeta[]>([]);
  const [editing, setEditing] = useState<SkillConfig | null>(null);
  const [isNew, setIsNew] = useState(false);

  const refresh = async () => {
    const res = await fetch(`${gatewayUrl}${API_PREFIX}/skills`);
    if (res.ok) setSkills(await res.json());
  };

  useEffect(() => { refresh(); }, [gatewayUrl]);

  const startNew = () => {
    setEditing({ name: "", description: "", code_for_interpreter: "", code_for_agent: "" });
    setIsNew(true);
  };

  const saveSkill = async () => {
    if (!editing) return;
    const method = isNew ? "POST" : "PUT";
    const url = isNew
      ? `${gatewayUrl}${API_PREFIX}/skills`
      : `${gatewayUrl}${API_PREFIX}/skills/${editing.name}`;
    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing),
    });
    setEditing(null);
    setIsNew(false);
    refresh();
  };

  const deleteSkill = async (name: string) => {
    await fetch(`${gatewayUrl}${API_PREFIX}/skills/${name}`, { method: "DELETE" });
    setEditing(null);
    refresh();
  };

  return (
    <section className="rounded-xl border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Skills 管理</h2>
        <Button size="sm" variant="outline" onClick={startNew}>
          <Plus className="h-3 w-3 mr-1" /> 新建 Skill
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {skills.map((s) => (
          <Button
            key={s.name}
            size="sm"
            variant={editing?.name === s.name ? "default" : "outline"}
            onClick={async () => {
              setEditing({ ...s, code_for_interpreter: "", code_for_agent: "" });
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
              onChange={(e) => setEditing((s) => s && { ...s, name: e.target.value })}
              disabled={!isNew}
            />
            <input
              className="flex-[2] rounded-md border bg-muted/50 px-2 py-1 text-sm"
              placeholder="description"
              value={editing.description}
              onChange={(e) => setEditing((s) => s && { ...s, description: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Code for Interpreter</label>
            <textarea
              className="w-full rounded-md border bg-muted/50 px-2 py-1 text-xs font-mono min-h-[60px]"
              value={editing.code_for_interpreter ?? ""}
              onChange={(e) => setEditing((s) => s && { ...s, code_for_interpreter: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Code for Agent</label>
            <textarea
              className="w-full rounded-md border bg-muted/50 px-2 py-1 text-xs font-mono min-h-[60px]"
              value={editing.code_for_agent ?? ""}
              onChange={(e) => setEditing((s) => s && { ...s, code_for_agent: e.target.value })}
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={saveSkill}><Save className="h-3 w-3 mr-1" /> 保存</Button>
            {!isNew && (
              <Button size="sm" variant="destructive" onClick={() => deleteSkill(editing.name)}>
                <Trash2 className="h-3 w-3 mr-1" /> 删除
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
    return JSON.stringify({
      mcpServers: {
        "viben-python": {
          url: `${mcpServerUrl}?session_id=${activeSessionId}`,
          transport: "streamable-http",
        },
      },
    }, null, 2);
  }, [mcpServerUrl, activeSessionId]);

  const mcpConfigHeader = useMemo(() => {
    const headers: Record<string, string> = {};
    if (activeSessionId) headers["X-Viben-Session-Id"] = activeSessionId;
    return JSON.stringify({
      mcpServers: {
        "viben-python": {
          url: mcpServerUrl,
          transport: "streamable-http",
          ...(Object.keys(headers).length > 0 ? { headers } : {}),
        },
      },
    }, null, 2);
  }, [mcpServerUrl, activeSessionId]);

  return (
    <section className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Info className="h-4 w-4 text-primary" />
        <h2 className="font-semibold">MCP Server 配置</h2>
      </div>

      <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
        <h3 className="text-sm font-medium">请求头说明</h3>
        <div className="text-xs space-y-1 text-muted-foreground">
          <div>
            <code className="bg-muted px-1.5 py-0.5 rounded text-foreground">X-Viben-Session-Id</code>
            <span className="ml-1 text-destructive font-medium">(必需)</span> — ACP session id
          </div>
          <div>
            <code className="bg-muted px-1.5 py-0.5 rounded text-foreground">X-Jupyter-Url</code>
            <span className="ml-1">(可选)</span> — 覆盖默认 Jupyter URL
          </div>
          <div>
            <code className="bg-muted px-1.5 py-0.5 rounded text-foreground">X-Jupyter-Token</code>
            <span className="ml-1">(可选)</span> — 覆盖默认 Jupyter Token
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium">方式 1 — Query Parameter</h3>
        <CodeBlock
          code={mcpConfigQueryParam ?? "// 请先开始一个 ACP 会话"}
          onCopy={() => mcpConfigQueryParam && copyToClipboard(mcpConfigQueryParam, "pyConfig1")}
          copied={copied === "pyConfig1"}
          disabled={!mcpConfigQueryParam}
        />
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium">方式 2 — Header</h3>
        <CodeBlock
          code={mcpConfigHeader}
          onCopy={() => copyToClipboard(mcpConfigHeader, "pyConfig2")}
          copied={copied === "pyConfig2"}
        />
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium">端点信息</h3>
        <InfoRow label="URL" value={mcpServerUrl} onCopy={() => copyToClipboard(mcpServerUrl, "pyUrl")} copied={copied === "pyUrl"} />
        <InfoRow label="Transport" value="streamable-http" onCopy={() => copyToClipboard("streamable-http", "pyTransport")} copied={copied === "pyTransport"} />
      </div>
    </section>
  );
}

function InfoRow({ label, value, onCopy, copied }: { label: string; value: string; onCopy?: () => void; copied?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-xs font-medium text-muted-foreground shrink-0">{label}</span>
        <code className="text-xs font-mono truncate">{value}</code>
      </div>
      {onCopy && (
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={onCopy}>
          {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
        </Button>
      )}
    </div>
  );
}

function CodeBlock({ code, onCopy, copied, disabled }: { code: string; onCopy?: () => void; copied?: boolean; disabled?: boolean }) {
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
          {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
        </Button>
      )}
    </div>
  );
}
