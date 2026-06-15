import { useState, useMemo, useEffect } from "react";
import {
  Copy,
  Check,
  ExternalLink,
  Server,
  Key,
  Plus,
  Trash2,
  Loader2,
  Database,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { getGatewayUrl } from "@/lib/gateway/config";
import { useDesktopRouting } from "@/hooks/use-desktop-routing";
import { useServiceKeys, type ServiceApiKey } from "@/hooks/use-service-keys";
import { useAppStore } from "@/stores";
import type { Provider } from "@/types";
import { CreateApiKeyDialog } from "./create-api-key-dialog";

const BROWSE_MCP_PATH = "/api/mcp-server/browse";

export function BrowseMcpPage() {
  const { t } = useTranslation();
  const { openPath } = useDesktopRouting();
  const [copied, setCopied] = useState<string | null>(null);

  const { keys, loading: keysLoading, createKey, updateKey, deleteKey, getKeyById } = useServiceKeys();
  const { getAvailableProviders } = useAppStore();
  const availableProviders = getAvailableProviders();

  const [selectedKeyForConfig, setSelectedKeyForConfig] = useState("");
  const [fullApiKey, setFullApiKey] = useState<string | null>(null);

  // Create key dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<{
    id: string;
    name: string;
    key: string;
  } | null>(null);

  // Full key cache for display
  const [fullKeys, setFullKeys] = useState<Record<string, string>>({});
  const [loadingKeys, setLoadingKeys] = useState<Record<string, boolean>>({});

  const gatewayUrl = useMemo(() => getGatewayUrl(), []);
  const browseMcpUrl = `${gatewayUrl}${BROWSE_MCP_PATH}`;

  // Fetch full key when selected for config
  useEffect(() => {
    if (!selectedKeyForConfig) {
      setFullApiKey(null);
      return;
    }
    getKeyById(selectedKeyForConfig).then((result) => {
      setFullApiKey(result?.key ?? null);
    });
  }, [selectedKeyForConfig, getKeyById]);

  // Fetch full keys for display
  useEffect(() => {
    for (const key of keys) {
      if (!fullKeys[key.id] && !loadingKeys[key.id]) {
        setLoadingKeys((prev) => ({ ...prev, [key.id]: true }));
        getKeyById(key.id).then((result) => {
          if (result?.key) {
            setFullKeys((prev) => ({ ...prev, [key.id]: result.key }));
          }
          setLoadingKeys((prev) => ({ ...prev, [key.id]: false }));
        });
      }
    }
  }, [keys, getKeyById, fullKeys, loadingKeys]);

  // Generate MCP config with optional API key
  const mcpConfig = useMemo(() => {
    const serverConfig: Record<string, unknown> = {
      url: browseMcpUrl,
      type: "streamable-http",
    };
    if (fullApiKey) {
      serverConfig.headers = { Authorization: `Bearer ${fullApiKey}` };
    }
    return JSON.stringify({ mcpServers: { browse: serverConfig } }, null, 2);
  }, [browseMcpUrl, fullApiKey]);

  const mcpConfigExternal = useMemo(() => {
    const url = new URL(BROWSE_MCP_PATH, gatewayUrl);
    const host =
      url.hostname === "127.0.0.1" || url.hostname === "localhost"
        ? "<your-host>"
        : url.hostname;
    const externalUrl = `${url.protocol}//${host}:${url.port}${url.pathname}`;
    const serverConfig: Record<string, unknown> = {
      url: externalUrl,
      type: "streamable-http",
    };
    if (fullApiKey) {
      serverConfig.headers = { Authorization: `Bearer ${fullApiKey}` };
    }
    return JSON.stringify({ mcpServers: { browse: serverConfig } }, null, 2);
  }, [gatewayUrl, fullApiKey]);

  const canCopyConfig = !!selectedKeyForConfig && !!fullApiKey;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleOpenInspector = () => {
    openPath("/mcp-services/inspector");
  };

  const handleDeleteKey = async (keyId: string, keyName: string) => {
    if (!confirm(t("searchService.deleteKeyConfirm", { name: keyName }))) return;
    await deleteKey(keyId);
    if (selectedKeyForConfig === keyId) {
      setSelectedKeyForConfig("");
    }
  };

  return (
    <div className="p-6 max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">
          {t("browseMcp.title", "Browse MCP")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("browseMcp.subtitle", "为 Agent 定制的搜索与浏览服务，支持多种数据源，用户可自定义搜索源。")}
        </p>
      </div>

      {/* Connection Status */}
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-green-500/10">
            <Server className="h-5 w-5 text-green-500" />
          </div>
          <div className="flex-1">
            <div className="font-medium">
              {t("browseMcp.serverStatus", "服务状态")}
            </div>
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

      {/* Data Sources */}
      <div className="rounded-lg border bg-card p-4">
        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
          <Database className="h-4 w-4" />
          {t("providers.title", "数据源")}
        </h4>
        <p className="text-xs text-muted-foreground mb-3">
          {t("browseMcp.dataSourcesInfo", "以下数据源在 Browse MCP 中可用。免费源默认启用，需要 API Key 的源请在数据源页面配置密钥后启用。")}
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          {availableProviders.map((provider) => (
            <div
              key={provider.id}
              className="flex items-center gap-2 p-2 rounded-lg border border-primary bg-primary/5"
            >
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-sm">{provider.name}</span>
              {!provider.requiresApiKey && (
                <span className="text-[10px] text-muted-foreground ml-auto">
                  {t("common.free", "免费")}
                </span>
              )}
            </div>
          ))}
        </div>
        {availableProviders.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {t("searchService.noDataSources", "暂无可用数据源")}
          </p>
        )}
      </div>

      {/* Service API Keys */}
      <div className="rounded-lg border bg-card p-4">
        <h4 className="text-sm font-medium mb-1 flex items-center gap-2">
          <Key className="h-4 w-4" />
          {t("searchService.serviceApiKeys", "Service API Keys")}
        </h4>
        <p className="text-xs text-muted-foreground mb-3">
          {t("searchService.apiKeysInfo", "为外部 coding agent 创建 API Key，用于认证连接到此 MCP 服务。")}
        </p>

        {/* Newly Created Key */}
        {newlyCreatedKey && (
          <div className="mb-3 p-3 rounded-lg border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-green-800 dark:text-green-200">
                  {t("searchService.apiKeyCreated", { name: newlyCreatedKey.name })}
                </p>
                <p className="text-xs text-green-700 dark:text-green-300 mt-0.5">
                  {t("searchService.copyNow", "请立即复制，此密钥不会再次显示")}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setNewlyCreatedKey(null)}
              >
                ×
              </Button>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 bg-white dark:bg-green-900 px-2 py-1 rounded text-xs font-mono text-green-900 dark:text-green-100 break-all select-all">
                {newlyCreatedKey.key}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopy(newlyCreatedKey.key, "newkey")}
              >
                {copied === "newkey" ? (
                  <Check className="h-3 w-3 text-green-600" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Create New Key Button */}
        <div className="mb-3">
          <Button
            onClick={() => setShowCreateDialog(true)}
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            {t("browseMcp.createApiKey", "创建 API Key")}
          </Button>
        </div>

        {/* Existing Keys */}
        {keysLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-4 justify-center">
            <Loader2 className="h-3 w-3 animate-spin" />
            {t("common.loading", "加载中...")}
          </div>
        ) : keys.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            {t("searchService.noApiKeysCreated", "暂未创建 API Key")}
          </p>
        ) : (
          <div className="space-y-2">
            {keys.map((key) => (
              <ApiKeyItem
                key={key.id}
                apiKey={key}
                fullKey={fullKeys[key.id]}
                loading={loadingKeys[key.id]}
                onDelete={() => handleDeleteKey(key.id, key.name)}
                onCopy={handleCopy}
                copied={copied}
                providers={availableProviders}
                onUpdateSources={(sources) => updateKey(key.id, { enabled_sources: sources })}
              />
            ))}
          </div>
        )}
      </div>

      {/* MCP Configuration */}
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium">
            {t("searchService.mcpConfiguration", "MCP 配置")}
          </h4>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleCopy(mcpConfig, "config")}
            disabled={!canCopyConfig}
            title={!canCopyConfig ? t("searchService.selectKeyToCopy", "请先选择 API Key") : ""}
          >
            {copied === "config" ? (
              <Check className="h-4 w-4 mr-2 text-green-600" />
            ) : (
              <Copy className="h-4 w-4 mr-2" />
            )}
            {copied === "config" ? t("common.copied", "已复制") : t("common.copy", "复制")}
          </Button>
        </div>

        {/* API Key selector for config */}
        <div className="mb-3">
          <label className="text-xs text-muted-foreground mb-1 block">
            {t("searchService.selectApiKeyForConfig", "选择要嵌入配置中的 API Key")}
          </label>
          {keys.length > 0 ? (
            <select
              value={selectedKeyForConfig}
              onChange={(e) => setSelectedKeyForConfig(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
            >
              <option value="">
                {t("searchService.selectApiKeyOption", "-- 选择 API Key --")}
              </option>
              {keys.map((key) => (
                <option key={key.id} value={key.id}>
                  {key.name} ({key.key_prefix})
                </option>
              ))}
            </select>
          ) : (
            <p className="text-sm text-yellow-600 dark:text-yellow-400 p-2 bg-yellow-50 dark:bg-yellow-950 rounded border border-yellow-200 dark:border-yellow-900">
              {t("searchService.createApiKeyToEnable", "请先创建 API Key 以生成完整配置")}
            </p>
          )}
        </div>

        {/* Local config */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">
              {t("browseMcp.localConfig", "本地 MCP 配置")}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2"
              onClick={() => handleCopy(mcpConfig, "local")}
            >
              {copied === "local" ? (
                <Check className="h-3 w-3 text-green-500" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
          </div>
          <pre className="text-xs bg-muted/50 rounded-md p-3 overflow-x-auto font-mono select-all">
            {mcpConfig}
          </pre>
        </div>

        {/* External config */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">
              {t("browseMcp.externalConfig", "外部访问 MCP 配置")}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2"
              onClick={() => handleCopy(mcpConfigExternal, "external")}
            >
              {copied === "external" ? (
                <Check className="h-3 w-3 text-green-500" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
          </div>
          <pre className="text-xs bg-muted/50 rounded-md p-3 overflow-x-auto font-mono select-all">
            {mcpConfigExternal}
          </pre>
          <p className="text-xs text-muted-foreground mt-1">
            {t("browseMcp.externalConfigHint", "适用于远程 coding agent，请将 <your-host> 替换为实际的 IP 或域名。")}
          </p>
        </div>

        {!selectedKeyForConfig && keys.length > 0 && (
          <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2">
            {t("searchService.selectKeyToCopy", "请选择 API Key 后再复制配置")}
          </p>
        )}
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

      {/* Create API Key Dialog */}
      <CreateApiKeyDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCreated={(result) => setNewlyCreatedKey(result)}
        createKey={createKey}
      />
    </div>
  );
}

interface ApiKeyItemProps {
  apiKey: ServiceApiKey;
  fullKey?: string;
  loading?: boolean;
  onDelete: () => void;
  onCopy: (text: string, key: string) => void;
  copied: string | null;
  providers: Provider[];
  onUpdateSources: (sources: string[]) => void;
}

function ApiKeyItem({ apiKey, fullKey, loading, onDelete, onCopy, copied, providers, onUpdateSources }: ApiKeyItemProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const copyId = `key-${apiKey.id}`;

  const enabledSources = apiKey.enabled_sources ?? [];
  const allSourcesEnabled = enabledSources.length === 0;

  const handleToggleSource = (sourceId: string) => {
    if (allSourcesEnabled) {
      const allExcept = providers.filter((p) => p.id !== sourceId).map((p) => p.id);
      onUpdateSources(allExcept);
    } else if (enabledSources.includes(sourceId)) {
      const next = enabledSources.filter((s) => s !== sourceId);
      onUpdateSources(next);
    } else {
      const next = [...enabledSources, sourceId];
      if (next.length === providers.length) {
        onUpdateSources([]);
      } else {
        onUpdateSources(next);
      }
    }
  };

  const handleToggleAll = () => {
    if (allSourcesEnabled) {
      onUpdateSources([providers[0]?.id].filter(Boolean));
    } else {
      onUpdateSources([]);
    }
  };

  return (
    <div className="p-3 rounded-lg bg-muted/50">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{apiKey.name}</p>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="h-7 px-2"
            title={t("browseMcp.configureSources", "配置数据源权限")}
          >
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fullKey && onCopy(fullKey, copyId)}
            disabled={!fullKey}
            className="h-7 px-2"
          >
            {copied === copyId ? (
              <Check className="h-3.5 w-3.5 text-green-600" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="h-7 px-2 text-destructive hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="mt-2">
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            {t("common.loading", "加载中...")}
          </div>
        ) : fullKey ? (
          <code className="block w-full bg-muted px-2 py-1.5 rounded text-xs font-mono break-all select-all">
            {fullKey}
          </code>
        ) : (
          <code className="block w-full bg-muted px-2 py-1.5 rounded text-xs font-mono text-muted-foreground">
            {apiKey.key_prefix}...
          </code>
        )}
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
        <span>{t("searchService.created", { date: apiKey.created_at })}</span>
        {apiKey.last_used && (
          <span>{t("searchService.lastUsed", { date: apiKey.last_used })}</span>
        )}
        <span className="ml-auto">
          {allSourcesEnabled
            ? t("browseMcp.allSources", "全部数据源")
            : t("browseMcp.sourceCount", { count: enabledSources.length })}
        </span>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-border/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium">
              {t("browseMcp.sourcePermissions", "数据源权限")}
            </span>
            <button
              onClick={handleToggleAll}
              className="text-xs text-primary hover:underline"
            >
              {allSourcesEnabled
                ? t("browseMcp.deselectAll", "取消全选")
                : t("browseMcp.selectAll", "全选")}
            </button>
          </div>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {providers.map((provider) => {
              const checked = allSourcesEnabled || enabledSources.includes(provider.id);
              return (
                <label
                  key={provider.id}
                  className="flex items-center gap-2 p-1.5 rounded hover:bg-muted cursor-pointer text-xs"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => handleToggleSource(provider.id)}
                    className="rounded border-border"
                  />
                  <span>{provider.name}</span>
                </label>
              );
            })}
          </div>
          {allSourcesEnabled && (
            <p className="text-[10px] text-muted-foreground mt-1.5">
              {t("browseMcp.allSourcesHint", "空列表 = 允许访问全部数据源")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
