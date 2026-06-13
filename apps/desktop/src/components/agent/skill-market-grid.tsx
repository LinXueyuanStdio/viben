import { useState, useEffect } from "react";
import { Search, Check, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  useCloudSkillPackages,
  useCloudSkillSearch,
  useCloudSkillCategories,
} from "@/hooks/use-cloud-skills";
import type { CloudSkillPackage } from "@/hooks/use-cloud-skills";

export interface SkillMarketGridProps {
  selectedIds: string[];
  onToggle: (skillId: string) => void;
  className?: string;
}

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
  } = useCloudSkillSearch(debouncedSearch);

  // Determine which data to show
  const isSearching = debouncedSearch.trim().length > 0;
  const packages: CloudSkillPackage[] = isSearching
    ? searchResults
    : browsePackages;
  const pagination = isSearching ? searchPagination : browsePagination;
  const loading = isSearching ? searchLoading : browseLoading;

  return (
    <div className={cn("space-y-3", className)}>
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="搜索 Skills..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-8"
        />
      </div>

      {/* Category filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
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

      {/* Grid */}
      {loading && packages.length === 0 ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : packages.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          未找到匹配的 Skills
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {packages.map((skill) => {
            const isSelected = selectedIds.includes(skill.id);
            return (
              <button
                key={skill.id}
                type="button"
                onClick={() => onToggle(skill.id)}
                className={cn(
                  "rounded-lg border p-3 text-left transition-colors",
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/30"
                )}
              >
                <div className="flex items-start justify-between gap-1">
                  <h4 className="text-sm font-medium truncate">
                    {skill.name}
                  </h4>
                  {isSelected && (
                    <Check className="h-4 w-4 text-primary shrink-0" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                  {skill.description || "No description"}
                </p>
                {skill.category && (
                  <Badge
                    variant="secondary"
                    className="text-[10px] px-1.5 py-0 mt-1.5"
                  >
                    {skill.category}
                  </Badge>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page <= 1}
            onClick={() => setPage(pagination.page - 1)}
          >
            上一页
          </Button>
          <span className="text-xs text-muted-foreground">
            {pagination.page} / {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => setPage(pagination.page + 1)}
          >
            下一页
          </Button>
        </div>
      )}
    </div>
  );
}
