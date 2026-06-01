import { memo, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";

/**
 * Base interface for category items.
 * Components using CategoryFilter should provide categories that match this shape.
 */
export interface CategoryItem {
  id: string;
  name: string;
  /** Count can be named `count` or `packageCount` depending on data source */
  count?: number;
  packageCount?: number | null;
}

/**
 * Props for the CategoryFilter component
 */
export interface CategoryFilterProps<T extends CategoryItem = CategoryItem> {
  /** List of categories to display */
  categories: T[];
  /** Currently selected category ID, null for "All" */
  selectedCategory: string | null;
  /** Callback when a category is selected */
  onSelect: (categoryId: string | null) => void;
  /** Whether categories are currently loading */
  loading?: boolean;
  /** Additional CSS class names */
  className?: string;
  /** Translation key for "All" label (defaults to "common.all") */
  allLabelKey?: string;
  /** Whether to show counts next to category names */
  showCounts?: boolean;
  /** Variant style: "button" uses Button component, "list" uses custom styling */
  variant?: "button" | "list";
}

/**
 * A reusable category filter component supporting different data shapes.
 * Memoized to prevent unnecessary re-renders.
 *
 * @example
 * ```tsx
 * // With MCP categories (packageCount)
 * <CategoryFilter
 *   categories={mcpCategories}
 *   selectedCategory={selected}
 *   onSelect={setSelected}
 *   allLabelKey="marketplace.allCategories"
 * />
 *
 * // With skill categories (count)
 * <CategoryFilter
 *   categories={skillCategories}
 *   selectedCategory={selected}
 *   onSelect={setSelected}
 *   variant="list"
 * />
 * ```
 */
export const CategoryFilter = memo(function CategoryFilter<T extends CategoryItem>({
  categories,
  selectedCategory,
  onSelect,
  loading = false,
  className,
  allLabelKey = "common.all",
  showCounts = true,
  variant = "button",
}: CategoryFilterProps<T>) {
  const { t } = useTranslation();

  // Memoize total count calculation
  const totalCount = useMemo(
    () =>
      categories.reduce((sum, c) => {
        const count = c.count ?? c.packageCount ?? 0;
        return sum + count;
      }, 0),
    [categories]
  );

  // Memoize the "All" button click handler
  const handleSelectAll = useCallback(() => {
    onSelect(null);
  }, [onSelect]);

  // Loading skeleton
  if (loading) {
    return (
      <div className={cn("space-y-2", className)}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-9 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  // Button variant (used by marketplace)
  if (variant === "button") {
    return (
      <ScrollArea className={cn("w-full", className)}>
        <div className="space-y-1 pr-4">
          <Button
            variant={selectedCategory === null ? "secondary" : "ghost"}
            size="sm"
            onClick={handleSelectAll}
            className="w-full justify-start"
          >
            <span className="truncate">{t(allLabelKey)}</span>
            {showCounts && (
              <span className="ml-auto text-xs text-muted-foreground">
                {totalCount}
              </span>
            )}
          </Button>
          {categories.map((category) => (
            <CategoryButton
              key={category.id}
              category={category}
              isSelected={selectedCategory === category.id}
              onSelect={onSelect}
              showCounts={showCounts}
            />
          ))}
        </div>
      </ScrollArea>
    );
  }

  // List variant (used by skills market)
  return (
    <div className={cn("space-y-1", className)}>
      <button
        onClick={handleSelectAll}
        className={cn(
          "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm",
          "transition-colors duration-200",
          !selectedCategory
            ? "bg-primary/10 text-primary font-medium"
            : "hover:bg-muted text-muted-foreground hover:text-foreground"
        )}
      >
        <span>{t(allLabelKey)}</span>
        {!selectedCategory && <Check className="h-4 w-4" />}
      </button>

      {categories.map((category) => (
        <CategoryListItem
          key={category.id}
          category={category}
          isSelected={selectedCategory === category.id}
          onSelect={onSelect}
          showCounts={showCounts}
        />
      ))}

      {/* Empty State */}
      {categories.length === 0 && (
        <p className="text-sm text-muted-foreground px-3 py-2">
          {t("common.noCategories")}
        </p>
      )}
    </div>
  );
}) as <T extends CategoryItem>(props: CategoryFilterProps<T>) => React.ReactElement;

/**
 * Individual category button component (button variant)
 * Memoized to prevent re-renders when other categories change
 */
const CategoryButton = memo(function CategoryButton<T extends CategoryItem>({
  category,
  isSelected,
  onSelect,
  showCounts,
}: {
  category: T;
  isSelected: boolean;
  onSelect: (categoryId: string | null) => void;
  showCounts: boolean;
}) {
  const handleClick = useCallback(() => {
    onSelect(category.id);
  }, [onSelect, category.id]);

  const count = category.count ?? category.packageCount;

  return (
    <Button
      variant={isSelected ? "secondary" : "ghost"}
      size="sm"
      onClick={handleClick}
      className="w-full justify-start"
    >
      <span className="truncate">{category.name}</span>
      {showCounts && count != null && (
        <span className="ml-auto text-xs text-muted-foreground">{count}</span>
      )}
    </Button>
  );
});

/**
 * Individual category list item component (list variant)
 * Memoized to prevent re-renders when other categories change
 */
const CategoryListItem = memo(function CategoryListItem<T extends CategoryItem>({
  category,
  isSelected,
  onSelect,
  showCounts,
}: {
  category: T;
  isSelected: boolean;
  onSelect: (categoryId: string | null) => void;
  showCounts: boolean;
}) {
  const handleClick = useCallback(() => {
    onSelect(category.id);
  }, [onSelect, category.id]);

  const count = category.count ?? category.packageCount;

  return (
    <button
      onClick={handleClick}
      className={cn(
        "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm",
        "transition-colors duration-200",
        isSelected
          ? "bg-primary/10 text-primary font-medium"
          : "hover:bg-muted text-muted-foreground hover:text-foreground"
      )}
    >
      <span className="truncate">{category.name}</span>
      <div className="flex items-center gap-2">
        {showCounts && count != null && (
          <span className="text-xs text-muted-foreground">({count})</span>
        )}
        {isSelected && <Check className="h-4 w-4" />}
      </div>
    </button>
  );
});

export default CategoryFilter;
