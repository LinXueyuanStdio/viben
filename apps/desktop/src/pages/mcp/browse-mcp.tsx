import { useState, useMemo } from "react";
import { Copy, Check, ExternalLink, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { getGatewayUrl } from "@/lib/gateway/config";
import { useDesktopRouting } from "@/hooks/use-desktop-routing";

const BROWSE_MCP_PATH = "/api/mcp-server/browse";

export function BrowseMcpPage() {
  const { t } = useTranslation();
  const { openPath } = useDesktopRouting();
  const [copied, setCopied] = useState<string | null>(null);

  const gatewayUrl = useMemo(() => getGatewayUrl(), []);
  const browseMcpUrl = `${gatewayUrl}${BROWSE_MCP_PATH}`;

  const mcpConfig = useMemo(() => {
    return JSON.stringify(
      {
        mcpServers: {
          browse: {
            url: browseMcpUrl,
            transport: "streamable-http",
          },
        },
      },
      null,
      2,
    );
  }, [browseMcpUrl]);

  const mcpConfigExternal = useMemo(() => {
    const url = new URL(BROWSE_MCP_PATH, gatewayUrl);
    const host = url.hostname === "127.0.0.1" || url.hostname === "localhost"
      ? "<your-host>"
      : url.hostname;
    const externalUrl = `${url.protocol}//${host}:${url.port}${url.pathname}`;
    return JSON.stringify(
      {
        mcpServers: {
          browse: {
            url: externalUrl,
            transport: "streamable-http",
          },
        },
      },
      null,
      2,
    );
  }, [gatewayUrl]);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleOpenInspector = () => {
    openPath("/mcp-services/inspector");
  };

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t("browseMcp.title", "Browse MCP")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("browseMcp.subtitle", "学术搜索与文献管理 MCP 服务，内置于 Gateway，支持 arXiv、PubMed、Semantic Scholar 等多个数据源。")}
        </p>
      </div>

      {/* Connection Status */}
      <div className="rounded-lg border bg-card p-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-green-500/10">
            <Server className="h-5 w-5 text-green-500" />
          </div>
          <div className="flex-1">
            <div className="font-medium">{t("browseMcp.serverStatus", "服务状态")}</div>
            <div className="text-sm text-muted-foreground">
              {t("browseMcp.builtIn", "内置于 Gateway，随 Gateway 启动自动可用")}
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 font-medium">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            {t("browseMcp.active", "运行中")}
          </div>
        </div>
      </div>

      {/* MCP Config - Local */}
      <div className="rounded-lg border bg-card p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium">
            {t("browseMcp.localConfig", "本地 MCP 配置")}
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleCopy(mcpConfig, "local")}
          >
            {copied === "local" ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
        <pre className="text-xs bg-muted/50 rounded-md p-3 overflow-x-auto font-mono">
          {mcpConfig}
        </pre>
        <p className="text-xs text-muted-foreground mt-2">
          {t("browseMcp.localConfigHint", "适用于本机运行的 coding agent（如 Claude Code、Cursor 等）")}
        </p>
      </div>

      {/* MCP Config - External */}
      <div className="rounded-lg border bg-card p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium">
            {t("browseMcp.externalConfig", "外部访问 MCP 配置")}
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleCopy(mcpConfigExternal, "external")}
          >
            {copied === "external" ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
        <pre className="text-xs bg-muted/50 rounded-md p-3 overflow-x-auto font-mono">
          {mcpConfigExternal}
        </pre>
        <p className="text-xs text-muted-foreground mt-2">
          {t("browseMcp.externalConfigHint", "适用于远程 coding agent，请将 <your-host> 替换为实际的 IP 或域名，确保 Gateway 监听 0.0.0.0 或通过 tunnel 暴露。")}
        </p>
      </div>

      {/* Endpoint Info */}
      <div className="rounded-lg border bg-card p-4 mb-6">
        <h3 className="text-sm font-medium mb-3">
          {t("browseMcp.endpointInfo", "端点信息")}
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">URL</span>
            <code className="text-xs bg-muted px-2 py-0.5 rounded">{browseMcpUrl}</code>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Transport</span>
            <code className="text-xs bg-muted px-2 py-0.5 rounded">streamable-http</code>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Protocol</span>
            <code className="text-xs bg-muted px-2 py-0.5 rounded">MCP (JSON-RPC)</code>
          </div>
        </div>
      </div>

      {/* Inspector Link */}
      <div className="rounded-lg border border-dashed bg-muted/30 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium">
              {t("browseMcp.inspectorTitle", "查看工具列表")}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {t("browseMcp.inspectorHint", "在 Inspector 中连接此 MCP 服务器，可交互式浏览所有可用工具和资源。")}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleOpenInspector}>
            <ExternalLink className="h-4 w-4 mr-2" />
            {t("browseMcp.openInspector", "打开 Inspector")}
          </Button>
        </div>
      </div>
    </div>
  );
}
