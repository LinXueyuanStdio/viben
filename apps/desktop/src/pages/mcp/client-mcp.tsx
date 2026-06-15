import { useState, useMemo, useEffect } from "react";
import {
  Copy,
  Check,
  Monitor,
  Wifi,
  WifiOff,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { getGatewayUrl } from "@/lib/gateway/config";
import { useClientIdStore } from "@/stores/client-id-store";
import { useAcpSessionStore } from "@/stores/acp-session-store";

const GUI_ACTION_MCP_PATH = "/api/mcp-server/gui-action";

export function ClientMcpPage() {
  const { t } = useTranslation();
  const [copied, setCopied] = useState<string | null>(null);

  const identity = useClientIdStore((s) => s.identity);
  const getOrCreateIdentity = useClientIdStore((s) => s.getOrCreateIdentity);
  const activeSessionId = useAcpSessionStore((s) => s.activeSessionId);

  useEffect(() => {
    if (!identity) {
      getOrCreateIdentity();
    }
  }, [identity, getOrCreateIdentity]);

  const gatewayUrl = useMemo(() => getGatewayUrl(), []);
  const mcpServerUrl = `${gatewayUrl}${GUI_ACTION_MCP_PATH}`;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const mcpConfigQueryParam = useMemo(() => {
    if (!activeSessionId) return null;
    const config = {
      mcpServers: {
        "viben-gui-action": {
          url: `${mcpServerUrl}?session_id=${activeSessionId}`,
          type: "streamable-http",
        },
      },
    };
    return JSON.stringify(config, null, 2);
  }, [mcpServerUrl, activeSessionId]);

  const mcpConfigHeader = useMemo(() => {
    const headers: Record<string, string> = {};
    if (activeSessionId) {
      headers["X-Viben-Session-Id"] = activeSessionId;
    }
    if (identity?.clientId) {
      headers["X-Viben-Client-Id"] = identity.clientId;
    }
    const config = {
      mcpServers: {
        "viben-gui-action": {
          url: mcpServerUrl,
          type: "streamable-http",
          ...(Object.keys(headers).length > 0 ? { headers } : {}),
        },
      },
    };
    return JSON.stringify(config, null, 2);
  }, [mcpServerUrl, activeSessionId, identity?.clientId]);

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold font-serif">
            {t("mcp.clientMcp.title", "端侧 MCP")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t(
              "mcp.clientMcp.description",
              "将 Viben 桌面端的 GUI Action 能力通过 MCP 协议暴露给外部 Coding Agent（如 Claude Code、Cursor 等）"
            )}
          </p>
        </div>

        {/* Client Identity */}
        <section className="rounded-xl border bg-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Monitor className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">
              {t("mcp.clientMcp.clientIdentity", "客户端身份")}
            </h2>
          </div>
          <div className="space-y-2">
            <InfoRow
              label="Client ID"
              value={identity?.clientId ?? "—"}
              onCopy={() =>
                identity?.clientId &&
                copyToClipboard(identity.clientId, "clientId")
              }
              copied={copied === "clientId"}
            />
          </div>
        </section>

        {/* Active Session */}
        <section className="rounded-xl border bg-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            {activeSessionId ? (
              <Wifi className="h-4 w-4 text-green-500" />
            ) : (
              <WifiOff className="h-4 w-4 text-muted-foreground" />
            )}
            <h2 className="font-semibold">
              {t("mcp.clientMcp.activeSession", "活跃 ACP 会话")}
            </h2>
          </div>
          {activeSessionId ? (
            <InfoRow
              label="Session ID"
              value={activeSessionId}
              onCopy={() => copyToClipboard(activeSessionId, "sessionId")}
              copied={copied === "sessionId"}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              {t(
                "mcp.clientMcp.noActiveSession",
                "当前没有活跃会话。请先在聊天面板中开始一个 ACP 会话。"
              )}
            </p>
          )}
        </section>

        {/* MCP Configuration */}
        <section className="rounded-xl border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">
              {t("mcp.clientMcp.mcpConfig", "MCP Server 配置")}
            </h2>
          </div>
          <p className="text-sm text-muted-foreground">
            {t(
              "mcp.clientMcp.mcpConfigDesc",
              "将以下配置添加到你的 Coding Agent（如 Claude Code 的 .mcp.json、Cursor 的 MCP 设置等），即可让它通过 MCP 协议调用 Viben 桌面端的 GUI Action 工具。"
            )}
          </p>

          {/* Header explanation */}
          <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
            <h3 className="text-sm font-medium">
              {t("mcp.clientMcp.requiredHeaders", "必需的请求头 / 参数")}
            </h3>
            <div className="text-xs space-y-1.5 text-muted-foreground">
              <div>
                <code className="bg-muted px-1.5 py-0.5 rounded text-foreground">
                  X-Viben-Session-Id
                </code>{" "}
                或 query param{" "}
                <code className="bg-muted px-1.5 py-0.5 rounded text-foreground">
                  ?session_id=
                </code>
                <span className="ml-1 text-destructive font-medium">
                  (必需)
                </span>
                {" — "}
                {t(
                  "mcp.clientMcp.sessionIdDesc",
                  "关联到当前桌面端的 ACP 会话，决定工具调用的上下文"
                )}
              </div>
              <div>
                <code className="bg-muted px-1.5 py-0.5 rounded text-foreground">
                  X-Viben-Client-Id
                </code>
                <span className="ml-1 text-muted-foreground">(可选)</span>
                {" — "}
                {t(
                  "mcp.clientMcp.clientIdDesc",
                  "标识调用方客户端，用于 Action 名称解析和路由优先级"
                )}
              </div>
            </div>
          </div>

          {/* Config Method 1: Query Parameter */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">
              {t("mcp.clientMcp.method1", "方式 1 — Query Parameter")}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t(
                "mcp.clientMcp.method1Desc",
                "session_id 通过 URL query 参数传递，最简单的方式"
              )}
            </p>
            <CodeBlock
              code={mcpConfigQueryParam ?? "// 请先开始一个 ACP 会话"}
              onCopy={() =>
                mcpConfigQueryParam &&
                copyToClipboard(mcpConfigQueryParam, "config1")
              }
              copied={copied === "config1"}
              disabled={!mcpConfigQueryParam}
            />
          </div>

          {/* Config Method 2: Header */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">
              {t("mcp.clientMcp.method2", "方式 2 — Header")}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t(
                "mcp.clientMcp.method2Desc",
                "通过 HTTP Header 传递所有标识信息，适合需要同时传 client_id 的场景"
              )}
            </p>
            <CodeBlock
              code={mcpConfigHeader}
              onCopy={() => copyToClipboard(mcpConfigHeader, "config2")}
              copied={copied === "config2"}
            />
          </div>

          {/* Priority note */}
          <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
            {t(
              "mcp.clientMcp.priorityNote",
              "优先级：query param > header。如两者都提供，query param 中的 session_id 优先。"
            )}
          </div>
        </section>

        {/* Endpoint Info */}
        <section className="rounded-xl border bg-card p-5 space-y-3">
          <h2 className="font-semibold text-sm">
            {t("mcp.clientMcp.endpointInfo", "端点信息")}
          </h2>
          <div className="space-y-2">
            <InfoRow
              label="MCP Server URL"
              value={mcpServerUrl}
              onCopy={() => copyToClipboard(mcpServerUrl, "url")}
              copied={copied === "url"}
            />
            <InfoRow
              label="Transport"
              value="streamable-http"
              onCopy={() => copyToClipboard("streamable-http", "transport")}
              copied={copied === "transport"}
            />
          </div>
        </section>
      </div>
    </div>
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

function CodeBlock({
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
