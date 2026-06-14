/**
 * Skill Market Grid
 *
 * Browsable marketplace of cloud skill packages.
 * Uses the cloud API (useCloudSkillPackages / useCloudSkillSearch).
 *
 * Improved UI inspired by the web app's skill-card design:
 * - Skeleton loading states
 * - Richer card with icon, stats, author
 * - Error handling with retry
 * - Better empty states
 */
import { useState, useEffect } from "react";
import {
  Search,
  Check,
  Zap,
  Heart,
  Download,
  Star,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  useCloudSkillPackages,
  useCloudSkillSearch,
  useCloudSkillCategories,
} from "@/hooks/use-cloud-skills";
import type { CloudSkillPackage } from "@/hooks/use-cloud-skills";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format large numbers with K/M suffix
 */
function formatNumber(num: number): string {
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`;
  }
  return num.toString();
}

// ---------------------------------------------------------------------------
// Skeleton Card
// ---------------------------------------------------------------------------

function SkillCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-3 space-y-2.5 animate-pulse">
      <div className="flex items-start gap-2.5">
        <div className="h-8 w-8 rounded-lg bg-muted shrink-0" />
        <div className="flex-1 min-w-0 space-y-1.5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-14" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-3 w-10" />
        <Skeleton className="h-3 w-10" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skill Card
// ---------------------------------------------------------------------------

interface SkillCardProps {
  skill: CloudSkillPackage;
  isSelected: boolean;
  onToggle: () => void;
}

function SkillCard({ skill, isSelected, onToggle }: SkillCardProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "group relative flex flex-col rounded-xl border p-3 text-left transition-all duration-200",
        isSelected
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-border bg-card hover:border-primary/30 hover:shadow-sm"
      )}
    >
      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
          <Check className="h-3 w-3 text-primary-foreground" />
        </div>
      )}

      {/* Header: icon + name + version */}
      <div className="flex items-start gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0 bg-primary/10">
          <Zap className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
            {skill.name}
          </h4>
          <p className="text-[11px] text-muted-foreground">
            v{skill.version}
          </p>
        </div>
      </div>

      {/* Description */}
      <p className="mt-2 flex-1 text-xs text-muted-foreground line-clamp-2">
        {skill.description || "No description"}
      </p>

      {/* Footer: stats + category */}
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 text-[11px] text-muted-foreground">
          {skill.favoritesCount > 0 && (
            <span className="flex items-center gap-0.5">
              <Heart className="h-3 w-3" />
              {formatNumber(skill.favoritesCount)}
            </span>
          )}
          {skill.downloadsCount > 0 && (
            <span className="flex items-center gap-0.5">
              <Download className="h-3 w-3" />
              {formatNumber(skill.downloadsCount)}
            </span>
          )}
          {skill.ratingAvg > 0 && (
            <span className="flex items-center gap-0.5">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              {skill.ratingAvg.toFixed(1)}
            </span>
          )}
        </div>
        {skill.category && (
          <Badge
            variant="secondary"
            className="text-[10px] px-1.5 py-0 shrink-0"
          >
            {skill.category}
          </Badge>
        )}
      </div>

      {/* Author */}
      {skill.author && (
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {skill.author.avatarUrl ? (
            <img
              src={skill.author.avatarUrl}
              alt={skill.author.username}
              className="h-3.5 w-3.5 rounded-full"
            />
          ) : (
            <div className="h-3.5 w-3.5 rounded-full bg-muted flex items-center justify-center text-[8px] font-medium">
              {skill.author.username[0].toUpperCase()}
            </div>
          )}
          <span className="truncate">{skill.author.displayName || skill.author.username}</span>
        </div>
      )}
    </button>
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
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [currentPage, setPage] = useState(1);

  // Debounce search input
  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, selectedCategory]);

  // Fetch categories
  const { categories } = useCloudSkillCategories();

  // Fetch packages (used when no search query)
  const {
    packages: browsePackages,
    pagination: browsePagination,
    loading: browseLoading,
    error: browseError,
    refetch: refetchBrowse,
  } = useCloudSkillPackages({
    page: currentPage,
    limit: 20,
    category: selectedCategory || undefined,
  });

  // Search packages (used when there is a search query)
  const {
    results: searchResults,
    pagination: searchPagination,
    loading: searchLoading,
    error: searchError,
  } = useCloudSkillSearch(debouncedSearch);

  // Determine which data to show
  const isSearching = debouncedSearch.trim().length > 0;
  const packages: CloudSkillPackage[] = isSearching
    ? searchResults
    : browsePackages;
  const pagination = isSearching ? searchPagination : browsePagination;
  const loading = isSearching ? searchLoading : browseLoading;
  const error = isSearching ? searchError : browseError;

  return (
    <div className={cn("flex flex-col max-h-[calc(80vh-240px)]", className)}>
      {/* Search */}
      <div className="relative shrink-0">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="搜索 Skills..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-8"
        />
      </div>

      {/* Category filter */}
      {categories.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto py-2 shrink-0">
          <button
            type="button"
            className={cn(
              "px-2.5 py-1 rounded-md text-xs whitespace-nowrap transition-colors",
              !selectedCategory
                ? "bg-accent text-accent-foreground font-medium"
                : "text-muted-foreground hover:bg-muted"
            )}
            onClick={() => setSelectedCategory(null)}
          >
            全部
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={cn(
                "px-2.5 py-1 rounded-md text-xs whitespace-nowrap transition-colors",
                selectedCategory === cat.id
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-muted"
              )}
              onClick={() => setSelectedCategory(cat.id)}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Content area - scrollable */}
      <ScrollArea className="flex-1 min-h-0 mt-2">
        {/* Error state */}
        {error && packages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <AlertCircle className="h-8 w-8 text-destructive/60 mb-3" />
            <p className="text-sm text-muted-foreground mb-1">加载失败</p>
            <p className="text-xs text-muted-foreground/70 mb-3 max-w-[280px]">
              {error}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchBrowse()}
              className="gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              重试
            </Button>
          </div>
        ) : /* Loading skeleton */ loading && packages.length === 0 ? (
          <div className="grid grid-cols-2 gap-2 pb-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkillCardSkeleton key={i} />
            ))}
          </div>
        ) : /* Empty state */ packages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Zap className="h-8 w-8 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              {isSearching ? "未找到匹配的 Skills" : "暂无可用 Skills"}
            </p>
            {isSearching && (
              <p className="text-xs text-muted-foreground/70 mt-1">
                尝试调整搜索关键词
              </p>
            )}
          </div>
        ) : (
          /* Grid of cards */
          <div className="space-y-3 pb-2">
            {/* Results count */}
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>
                {isSearching
                  ? `找到 ${pagination?.total ?? packages.length} 个结果`
                  : `共 ${pagination?.total ?? packages.length} 个 Skills`}
              </span>
              {!isSearching && (
                <button
                  type="button"
                  onClick={() => refetchBrowse()}
                  disabled={loading}
                  className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
                  刷新
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              {packages.map((skill) => (
                <SkillCard
                  key={skill.id}
                  skill={skill}
                  isSelected={selectedIds.includes(skill.id)}
                  onToggle={() => onToggle(skill.id)}
                />
              ))}
            </div>

            {/* Error during pagination */}
            {error && packages.length > 0 && (
              <div className="flex items-center justify-center gap-2 py-2 text-xs text-destructive">
                <AlertCircle className="h-3.5 w-3.5" />
                <span>加载更多时出错</span>
                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => refetchBrowse()}>
                  重试
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && packages.length > 0 && (
          <div className="flex items-center justify-center gap-2 py-3 border-t mt-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1 || loading}
              onClick={() => setPage(pagination.page - 1)}
              className="h-7 text-xs"
            >
              上一页
            </Button>
            <span className="text-xs text-muted-foreground">
              {pagination.page} / {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages || loading}
              onClick={() => setPage(pagination.page + 1)}
              className="h-7 text-xs"
            >
              下一页
            </Button>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
