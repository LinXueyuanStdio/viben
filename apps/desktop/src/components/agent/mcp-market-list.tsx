/**
 * MCP Market List
 *
 * A reusable marketplace grid for browsing MCP servers from the official registry.
 */
import { useState, useCallback } from "react";
import { Search, Plus, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useOfficialRegistry } from "@/hooks/use-official-registry";
import type { OfficialServerDisplay } from "@/types/official-registry";

interface McpMarketListProps {
  onAdd: (server: OfficialServerDisplay) => void;
  className?: string;
}

export function McpMarketList({ onAdd, className }: McpMarketListProps) {
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
      <ScrollArea className="max-h-[320px]">
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
              {displayServers.map((server) => (
                <div
                  key={server.id}
                  className="rounded-lg border bg-card p-3 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-medium truncate">
                        {server.name}
                      </h4>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {server.description}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onAdd(server)}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      添加
                    </Button>
                  </div>
                </div>
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
      </ScrollArea>
    </div>
  );
}
