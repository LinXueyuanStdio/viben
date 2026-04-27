import { memo, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTranslation } from "react-i18next";
import type { CloudMcpCategory } from "@/hooks/use-cloud-mcp";

interface CategoryFilterProps {
  categories: CloudMcpCategory[];
  selectedCategory: string | null;
  onSelect: (categoryId: string | null) => void;
  loading?: boolean;
  className?: string;
}

/**
 * CategoryFilter component for marketplace filtering
 * Memoized to prevent unnecessary re-renders
 */
export const CategoryFilter = memo(function CategoryFilter({
  categories,
  selectedCategory,
  onSelect,
  loading = false,
  className,
}: CategoryFilterProps) {
  const { t } = useTranslation();

  // Memoize total package count calculation
  const totalPackageCount = useMemo(
    () => categories.reduce((sum, c) => sum + (c.packageCount ?? 0), 0),
    [categories]
  );

  // Memoize the "All" button click handler
  const handleSelectAll = useCallback(() => {
    onSelect(null);
  }, [onSelect]);

  if (loading) {
    return (
      <div className={cn("space-y-2", className)}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-9 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <ScrollArea className={cn("w-full", className)}>
      <div className="space-y-1 pr-4">
        <Button
          variant={selectedCategory === null ? "secondary" : "ghost"}
          size="sm"
          onClick={handleSelectAll}
          className="w-full justify-start"
        >
          <span className="truncate">{t("marketplace.allCategories")}</span>
          <span className="ml-auto text-xs text-muted-foreground">
            {totalPackageCount}
          </span>
        </Button>
        {categories.map((category) => (
          <CategoryButton
            key={category.id}
            category={category}
            isSelected={selectedCategory === category.id}
            onSelect={onSelect}
          />
        ))}
      </div>
    </ScrollArea>
  );
});

/**
 * Individual category button component
 * Memoized to prevent re-renders when other categories change
 */
const CategoryButton = memo(function CategoryButton({
  category,
  isSelected,
  onSelect,
}: {
  category: CloudMcpCategory;
  isSelected: boolean;
  onSelect: (categoryId: string | null) => void;
}) {
  const handleClick = useCallback(() => {
    onSelect(category.id);
  }, [onSelect, category.id]);

  return (
    <Button
      variant={isSelected ? "secondary" : "ghost"}
      size="sm"
      onClick={handleClick}
      className="w-full justify-start"
    >
      <span className="truncate">{category.name}</span>
      {category.packageCount != null && (
        <span className="ml-auto text-xs text-muted-foreground">
          {category.packageCount}
        </span>
      )}
    </Button>
  );
});
