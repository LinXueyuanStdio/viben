/**
 * MCP Market List
 *
 * A reusable marketplace grid for browsing MCP servers from the official registry.
 * Shows icons, package type badges, version, and "already added" indicators.
 */
import { useState, useCallback } from "react";
import { Search, Plus, Loader2, X, Server, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useOfficialRegistry } from "@/hooks/use-official-registry";
import type { OfficialServerDisplay } from "@/types/official-registry";

interface McpMarketListProps {
  onAdd: (server: OfficialServerDisplay) => void;
  /** Names of servers already selected in the parent dialog */
  selectedServerNames?: string[];
  className?: string;
}

export function McpMarketList({ onAdd, selectedServerNames = [], className }: McpMarketListProps) {
  const [localSearch, setLocalSearch] = useState("");
  const {
    displayServers,
    isLoading,
    hasMore,
    loadMore,
    search,
    searchQuery,
    clearSearch,
  } = useOfficialRegistry({ limit: 30, fetchOnMount: true });

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

      {/* Server grid */}
      <div className="max-h-[320px] overflow-y-auto">
        <div className="space-y-2 pb-2">
          {isLoading && displayServers.length === 0 ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : displayServers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <p className="text-sm text-muted-foreground">
                {searchQuery ? "未找到匹配的服务" : "暂无可用服务"}
              </p>
            </div>
          ) : (
            <>
              {displayServers.map((server) => {
                const isAdded = selectedServerNames.includes(server.name);
                return (
                  <div
                    key={server.id}
                    className={cn(
                      "rounded-lg border p-3 transition-all",
                      isAdded
                        ? "border-primary/50 bg-primary/5"
                        : "bg-card hover:border-muted-foreground/30 hover:shadow-sm"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-muted/50 overflow-hidden">
                        {server.iconUrl ? (
                          <img
                            src={server.iconUrl}
                            alt={server.name}
                            className="h-6 w-6 object-contain"
                            onError={(e) => {
                              // Fallback to Server icon on load error
                              const target = e.currentTarget;
                              target.style.display = "none";
                              target.nextElementSibling?.classList.remove("hidden");
                            }}
                          />
                        ) : null}
                        <Server
                          className={cn(
                            "h-4 w-4 text-muted-foreground",
                            server.iconUrl ? "hidden" : ""
                          )}
                        />
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-medium truncate">
                            {server.name}
                          </h4>
                          {server.version && (
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 shrink-0 text-muted-foreground"
                            >
                              v{server.version}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                          {server.description}
                        </p>
                        {/* Package type badges */}
                        {server.packageTypes.length > 0 && (
                          <div className="flex gap-1 mt-1.5">
                            {server.packageTypes.map((pt) => (
                              <Badge
                                key={pt}
                                variant="secondary"
                                className="text-[10px] px-1.5 py-0"
                              >
                                {pt}
                              </Badge>
                            ))}
                            {server.hasRemotes && (
                              <Badge
                                variant="secondary"
                                className="text-[10px] px-1.5 py-0"
                              >
                                remote
                              </Badge>
                            )}
                          </div>
                        )}
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
              })}

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
