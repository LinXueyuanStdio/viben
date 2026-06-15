/**
 * MCP Market List
 *
 * A reusable marketplace grid for browsing MCP servers from the official registry.
 * Shows rich metadata: icon, display name, transport info, install hint,
 * config requirements, repository link, and relative updated time.
 */
import { useState, useCallback, memo } from "react";
import {
  Search,
  Plus,
  Loader2,
  X,
  Server,
  Check,
  Terminal,
  Globe,
  Key,
  GitBranch,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useOfficialRegistry } from "@/hooks/use-official-registry";
import type { OfficialServerDisplay } from "@/types/official-registry";

// ============================================================================
// Helpers
// ============================================================================

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}天前`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}月前`;
  return `${Math.floor(months / 12)}年前`;
}

function getDisplayName(server: OfficialServerDisplay): string {
  const title = server._original?.server?.title;
  if (title) return title;
  // Strip domain prefix: "io.github.user/name" → "name"
  const parts = server.name.split("/");
  return parts[parts.length - 1] || server.name;
}

function getInstallHint(server: OfficialServerDisplay): string | null {
  const original = server._original?.server;
  if (!original) return null;

  // Check packages first
  const packages = original.packages;
  if (packages && packages.length > 0) {
    const pkg = packages[0];
    switch (pkg.registryType) {
      case "npm":
        return `npx ${pkg.identifier}`;
      case "pypi":
        return `uvx ${pkg.identifier}`;
      case "oci":
        return `docker run ${pkg.identifier}`;
      case "nuget":
        return `dotnet tool install ${pkg.identifier}`;
      default:
        return pkg.identifier;
    }
  }

  // Fall back to remotes
  const remotes = original.remotes;
  if (remotes && remotes.length > 0) {
    const url = remotes[0].url;
    // Truncate long URLs
    if (url.length > 40) return url.slice(0, 37) + "...";
    return url;
  }

  return null;
}

function hasRequiredConfig(server: OfficialServerDisplay): boolean {
  const original = server._original?.server;
  if (!original) return false;

  // Check package environment variables
  const packages = original.packages;
  if (packages) {
    for (const pkg of packages) {
      if (pkg.environmentVariables?.some((ev) => ev.isRequired)) {
        return true;
      }
    }
  }

  // Check remote variables
  const remotes = original.remotes;
  if (remotes) {
    for (const remote of remotes) {
      if (remote.variables) {
        for (const varDef of Object.values(remote.variables)) {
          if (varDef.isRequired) return true;
        }
      }
      if (remote.headers?.some((h) => h.isRequired)) {
        return true;
      }
    }
  }

  return false;
}

type TransportMode = "stdio" | "http" | "sse";

function getTransportModes(server: OfficialServerDisplay): TransportMode[] {
  const original = server._original?.server;
  if (!original) return [];

  const modes = new Set<TransportMode>();

  const packages = original.packages;
  if (packages) {
    for (const pkg of packages) {
      const t = pkg.transport?.type;
      if (t === "stdio") modes.add("stdio");
      else if (t === "streamable-http") modes.add("http");
      else if (t === "sse") modes.add("sse");
    }
  }

  const remotes = original.remotes;
  if (remotes) {
    for (const remote of remotes) {
      if (remote.type === "streamable-http") modes.add("http");
      else if (remote.type === "sse") modes.add("sse");
    }
  }

  if (server.hasRemotes && modes.size === 0) {
    modes.add("http");
  }

  return Array.from(modes);
}

// ============================================================================
// Sub-components
// ============================================================================

interface ServerIconProps {
  iconUrl: string | null;
  name: string;
}

const ServerIconDisplay = memo(function ServerIconDisplay({
  iconUrl,
  name,
}: ServerIconProps) {
  const [iconError, setIconError] = useState(false);

  const showFallback = !iconUrl || iconError;

  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-muted/50 overflow-hidden">
      {!showFallback && (
        <img
          src={iconUrl!}
          alt={name}
          className="h-6 w-6 object-contain"
          onError={() => setIconError(true)}
        />
      )}
      {showFallback && <Server className="h-4 w-4 text-muted-foreground" />}
    </div>
  );
});

interface McpServerCardProps {
  server: OfficialServerDisplay;
  isAdded: boolean;
  onAdd: (server: OfficialServerDisplay) => void;
}

const McpServerCard = memo(function McpServerCard({
  server,
  isAdded,
  onAdd,
}: McpServerCardProps) {
  const displayName = getDisplayName(server);
  const installHint = getInstallHint(server);
  const needsConfig = hasRequiredConfig(server);
  const transportModes = getTransportModes(server);
  const isDeprecated = server.status === "deprecated";

  const handleOpenRepo = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (server.repositoryUrl) {
        window.open(server.repositoryUrl, "_blank", "noopener,noreferrer");
      }
    },
    [server.repositoryUrl]
  );

  return (
    <div
      className={cn(
        "rounded-lg border p-3 transition-all",
        isAdded
          ? "border-primary/50 bg-primary/5"
          : "bg-card hover:border-muted-foreground/30 hover:shadow-sm",
        isDeprecated && "opacity-75"
      )}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <ServerIconDisplay iconUrl={server.iconUrl} name={server.name} />

        {/* Content */}
        <div className="min-w-0 flex-1">
          {/* Row 1: display name + version + deprecated badge */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-medium truncate max-w-[160px]">
              {displayName}
            </span>
            {server.version && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 shrink-0 text-muted-foreground"
              >
                v{server.version}
              </Badge>
            )}
            {isDeprecated && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 shrink-0 text-amber-500 border-amber-500/50"
              >
                <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                已弃用
              </Badge>
            )}
          </div>

          {/* Row 2: technical name */}
          <p className="text-[10px] text-muted-foreground truncate mt-0.5 font-mono">
            {server.name}
          </p>

          {/* Row 3: description */}
          {server.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
              {server.description}
            </p>
          )}

          {/* Row 4: transport chips + package types + config indicator + install hint + time + repo */}
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {/* Transport mode chips */}
            {transportModes.includes("stdio") && (
              <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <Terminal className="h-2.5 w-2.5" />
                stdio
              </span>
            )}
            {transportModes.includes("http") && (
              <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium bg-green-500/10 text-green-600 dark:text-green-400">
                <Globe className="h-2.5 w-2.5" />
                HTTP
              </span>
            )}
            {transportModes.includes("sse") && (
              <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <Globe className="h-2.5 w-2.5" />
                SSE
              </span>
            )}

            {/* Package type badges */}
            {server.packageTypes.map((pt) => (
              <Badge
                key={pt}
                variant="secondary"
                className="text-[10px] px-1.5 py-0"
              >
                {pt}
              </Badge>
            ))}
            {server.hasRemotes &&
              !server.packageTypes.length &&
              !transportModes.includes("http") &&
              !transportModes.includes("sse") && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  remote
                </Badge>
              )}

            {/* Needs config indicator */}
            {needsConfig && (
              <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium bg-orange-500/10 text-orange-600 dark:text-orange-400">
                <Key className="h-2.5 w-2.5" />
                需要配置
              </span>
            )}

            {/* Install hint */}
            {installHint && (
              <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded truncate max-w-[140px]">
                {installHint}
              </span>
            )}

            {/* Separator dot */}
            {server.updatedAt && (
              <span className="text-[10px] text-muted-foreground">
                {relativeTime(server.updatedAt)}
              </span>
            )}

            {/* Repository link */}
            {server.repositoryUrl && (
              <button
                type="button"
                onClick={handleOpenRepo}
                className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors"
                title="查看仓库"
              >
                <GitBranch className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* Action button */}
        <div className="shrink-0">
          {isAdded ? (
            <Badge variant="secondary" className="shrink-0">
              <Check className="h-3 w-3 mr-1" />
              已添加
            </Badge>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onAdd(server)}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              添加
            </Button>
          )}
        </div>
      </div>
    </div>
  );
});

// ============================================================================
// Main component
// ============================================================================

interface McpMarketListProps {
  onAdd: (server: OfficialServerDisplay) => void;
  /** Names of servers already selected in the parent dialog */
  selectedServerNames?: string[];
  className?: string;
}

export function McpMarketList({
  onAdd,
  selectedServerNames = [],
  className,
}: McpMarketListProps) {
  const [localSearch, setLocalSearch] = useState("");
  const { displayServers, isLoading, hasMore, loadMore, search, clearSearch } =
    useOfficialRegistry({ limit: 30, fetchOnMount: true });

  const handleSearchChange = useCallback(
    (value: string) => {
      setLocalSearch(value);
      search(value);
    },
    [search]
  );

  const handleClearSearch = useCallback(() => {
    setLocalSearch("");
    clearSearch();
  }, [clearSearch]);

  return (
    <div className={cn("space-y-3", className)}>
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={localSearch}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="搜索 MCP 服务..."
          className="pl-9 pr-9"
        />
        {localSearch && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
            onClick={handleClearSearch}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Server list */}
      <div className="overflow-y-auto max-h-[320px]">
        <div className="space-y-2 pb-2">
          {isLoading && displayServers.length === 0 ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : displayServers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <p className="text-sm text-muted-foreground">
                {localSearch ? "未找到匹配的服务" : "暂无可用服务"}
              </p>
            </div>
          ) : (
            <>
              {displayServers.map((server) => (
                <McpServerCard
                  key={server.id}
                  server={server}
                  isAdded={selectedServerNames.includes(server.name)}
                  onAdd={onAdd}
                />
              ))}

              {/* Load more */}
              {hasMore && (
                <div className="flex justify-center pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadMore}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                    ) : null}
                    加载更多
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
