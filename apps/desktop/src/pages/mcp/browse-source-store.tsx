import { useState, useMemo } from "react";
import { Search, Download, Trash2, Loader2, RefreshCw, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { useBrowsePlugins } from "@/hooks/use-browse-plugins";
import type { BrowsePluginRegistryEntry } from "@/lib/gateway";

export function BrowseSourceStorePage() {
  const { t } = useTranslation();
  const { registry, installed, loading, installing, error, refresh, install, uninstall, isInstalled } = useBrowsePlugins();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredPlugins = useMemo(() => {
    if (!searchQuery.trim()) return registry;
    const q = searchQuery.toLowerCase();
    return registry.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.sources.some((s) => s.toLowerCase().includes(q))
    );
  }, [registry, searchQuery]);

  const installedNotInRegistry = useMemo(() => {
    const registryIds = new Set(registry.map((p) => p.id));
    return installed.filter((p) => !registryIds.has(p.id));
  }, [registry, installed]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-none px-6 pt-6 pb-4 border-b">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-semibold">
              {t("browseSourceStore.title", "搜索源商店")}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t("browseSourceStore.description", "发现和安装第三方搜索源插件，扩展 Browse MCP 的数据能力")}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            {t("common.refresh", "刷新")}
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("browseSourceStore.searchPlaceholder", "搜索插件名称、描述或数据源...")}
            className="w-full rounded-md border bg-background pl-9 pr-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex-none mx-6 mt-4 px-3 py-2 rounded-md bg-destructive/10 text-destructive text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading && registry.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredPlugins.length === 0 && installedNotInRegistry.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">
            {searchQuery
              ? t("common.noResults", "无结果")
              : t("browseSourceStore.empty", "暂无可用插件")}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredPlugins.map((plugin) => (
              <PluginCard
                key={plugin.id}
                plugin={plugin}
                installed={isInstalled(plugin.id)}
                installing={installing.has(plugin.id)}
                onInstall={() => install(plugin.id, plugin.download_url)}
                onUninstall={() => uninstall(plugin.id)}
              />
            ))}
            {installedNotInRegistry.map((plugin) => (
              <InstalledOnlyCard
                key={plugin.id}
                plugin={plugin}
                onUninstall={() => uninstall(plugin.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PluginCard({
  plugin,
  installed,
  installing,
  onInstall,
  onUninstall,
}: {
  plugin: BrowsePluginRegistryEntry;
  installed: boolean;
  installing: boolean;
  onInstall: () => void;
  onUninstall: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="rounded-lg border bg-card p-4 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-medium text-sm truncate">{plugin.name}</h3>
          {plugin.author && (
            <p className="text-xs text-muted-foreground">{plugin.author}</p>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded flex-shrink-0">
          v{plugin.version}
        </span>
      </div>

      <p className="text-xs text-muted-foreground line-clamp-2 flex-1">
        {plugin.description}
      </p>

      {/* Sources */}
      <div className="flex flex-wrap gap-1">
        {plugin.sources.map((source) => (
          <span
            key={source}
            className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary"
          >
            {source}
          </span>
        ))}
      </div>

      {/* Env requirements */}
      {plugin.requires_env && plugin.requires_env.length > 0 && (
        <p className="text-[10px] text-muted-foreground">
          {t("browseSourceStore.requiresEnv", "需要环境变量")}: {plugin.requires_env.join(", ")}
        </p>
      )}

      {/* Action */}
      <div className="flex justify-end mt-1">
        {installed ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-green-600 flex items-center gap-1">
              <Check className="h-3 w-3" />
              {t("browseSourceStore.installed", "已安装")}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-destructive hover:text-destructive"
              onClick={onUninstall}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-3"
            onClick={onInstall}
            disabled={installing}
          >
            {installing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
            ) : (
              <Download className="h-3.5 w-3.5 mr-1" />
            )}
            {t("browseSourceStore.install", "安装")}
          </Button>
        )}
      </div>
    </div>
  );
}

function InstalledOnlyCard({
  plugin,
  onUninstall,
}: {
  plugin: { id: string; name: string; sources: string[] };
  onUninstall: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="rounded-lg border bg-card p-4 flex flex-col gap-2 border-dashed">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-medium text-sm truncate">{plugin.name}</h3>
        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded flex-shrink-0">
          {t("browseSourceStore.localOnly", "本地")}
        </span>
      </div>

      <div className="flex flex-wrap gap-1">
        {plugin.sources.map((source) => (
          <span
            key={source}
            className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary"
          >
            {source}
          </span>
        ))}
      </div>

      <div className="flex justify-end mt-1">
        <div className="flex items-center gap-2">
          <span className="text-xs text-green-600 flex items-center gap-1">
            <Check className="h-3 w-3" />
            {t("browseSourceStore.installed", "已安装")}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-destructive hover:text-destructive"
            onClick={onUninstall}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
