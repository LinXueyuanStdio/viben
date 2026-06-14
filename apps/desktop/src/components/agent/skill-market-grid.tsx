/**
 * Skill Market Grid
 *
 * Browsable marketplace of skill packages from the ClaWHub registry.
 * Uses direct ClaWHub API (https://clawhub.ai/api/v1).
 */
import { useState, useCallback } from "react";
import {
  Search,
  Check,
  Sparkles,
  Download,
  Star,
  RefreshCw,
  AlertCircle,
  Loader2,
  X,
  Plus,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useClawhubRegistry } from "@/hooks/use-clawhub-registry";
import type { ClawhubSkillDisplay } from "@/types/clawhub-registry";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toString();
}

// ---------------------------------------------------------------------------
// Skeleton Card
// ---------------------------------------------------------------------------

function SkillCardSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-3 space-y-2 animate-pulse">
      <div className="flex items-start gap-2.5">
        <div className="h-8 w-8 rounded-lg bg-muted shrink-0" />
        <div className="flex-1 min-w-0 space-y-1.5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-14" />
        </div>
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skill Card
// ---------------------------------------------------------------------------

interface SkillCardProps {
  skill: ClawhubSkillDisplay;
  isSelected: boolean;
  onToggle: () => void;
}

function SkillCard({ skill, isSelected, onToggle }: SkillCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3 transition-all",
        isSelected
          ? "border-primary/50 bg-primary/5"
          : "bg-card hover:border-muted-foreground/30 hover:shadow-sm"
      )}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10">
          <Sparkles className="h-4 w-4 text-primary" />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-medium truncate">{skill.name}</h4>
            {skill.version && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 shrink-0 text-muted-foreground"
              >
                v{skill.version}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
            {skill.description || "No description"}
          </p>

          {/* Stats row */}
          <div className="flex items-center gap-2.5 mt-1.5 text-[11px] text-muted-foreground">
            {skill.ownerHandle && (
              <span className="flex items-center gap-1">
                {skill.ownerAvatar ? (
                  <img
                    src={skill.ownerAvatar}
                    alt={skill.ownerHandle}
                    className="h-3.5 w-3.5 rounded-full"
                  />
                ) : (
                  <div className="h-3.5 w-3.5 rounded-full bg-muted flex items-center justify-center text-[8px] font-medium">
                    {skill.ownerHandle[0].toUpperCase()}
                  </div>
                )}
                <span className="truncate max-w-[80px]">{skill.ownerName || skill.ownerHandle}</span>
              </span>
            )}
            {skill.downloads > 0 && (
              <span className="flex items-center gap-0.5">
                <Download className="h-3 w-3" />
                {formatNumber(skill.downloads)}
              </span>
            )}
            {skill.stars > 0 && (
              <span className="flex items-center gap-0.5">
                <Star className="h-3 w-3" />
                {formatNumber(skill.stars)}
              </span>
            )}
            {skill.isOfficial && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                official
              </Badge>
            )}
            {skill.channel === "community" && !skill.isOfficial && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                community
              </Badge>
            )}
          </div>
        </div>

        {/* Action button */}
        <div className="shrink-0">
          {isSelected ? (
            <Badge variant="secondary" className="shrink-0">
              <Check className="h-3 w-3 mr-1" />
              已选
            </Badge>
          ) : (
            <Button size="sm" variant="outline" onClick={onToggle}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              添加
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SkillMarketGridProps {
  selectedIds: string[];
  onToggle: (skillId: string) => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function SkillMarketGrid({
  selectedIds,
  onToggle,
  className,
}: SkillMarketGridProps) {
  const [localSearch, setLocalSearch] = useState("");

  const {
    displaySkills,
    isLoading,
    hasMore,
    loadMore,
    search,
    searchQuery,
    clearSearch,
    refreshSkills,
    skillsError,
  } = useClawhubRegistry({ limit: 30, fetchOnMount: true });

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
      <div className="relative shrink-0">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="搜索 Skills..."
          value={localSearch}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-9 pr-9 h-8"
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

      {/* Content area */}
      <div className="max-h-[calc(80vh-280px)] overflow-y-auto">
        {/* Error state */}
        {skillsError && displaySkills.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <AlertCircle className="h-8 w-8 text-destructive/60 mb-3" />
            <p className="text-sm text-muted-foreground mb-1">加载失败</p>
            <p className="text-xs text-muted-foreground/70 mb-3 max-w-[280px]">
              {skillsError}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refreshSkills()}
              className="gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              重试
            </Button>
          </div>
        ) : /* Loading skeleton */ isLoading && displaySkills.length === 0 ? (
          <div className="space-y-2 pb-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkillCardSkeleton key={i} />
            ))}
          </div>
        ) : /* Empty state */ displaySkills.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Sparkles className="h-8 w-8 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              {searchQuery ? "未找到匹配的 Skills" : "暂无可用 Skills"}
            </p>
            {searchQuery && (
              <p className="text-xs text-muted-foreground/70 mt-1">
                尝试调整搜索关键词
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2 pb-2">
            {/* Results header */}
            <div className="flex items-center justify-between text-[11px] text-muted-foreground px-0.5">
              <span>
                ClaWHub · {displaySkills.length} 个 Skills
              </span>
              {!searchQuery && (
                <button
                  type="button"
                  onClick={() => refreshSkills()}
                  disabled={isLoading}
                  className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <RefreshCw className={cn("h-3 w-3", isLoading && "animate-spin")} />
                  刷新
                </button>
              )}
            </div>

            {/* Cards */}
            {displaySkills.map((skill) => (
              <SkillCard
                key={skill.id}
                skill={skill}
                isSelected={selectedIds.includes(skill.id)}
                onToggle={() => onToggle(skill.id)}
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
          </div>
        )}
      </div>
    </div>
  );
}
