import * as React from "react";
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

export function CategoryFilter({
  categories,
  selectedCategory,
  onSelect,
  loading = false,
  className,
}: CategoryFilterProps) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className={cn("space-y-2", className)}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-9 rounded-lg bg-muted animate-pulse"
          />
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
          onClick={() => onSelect(null)}
          className="w-full justify-start"
        >
          <span className="truncate">{t("marketplace.allCategories")}</span>
          <span className="ml-auto text-xs text-muted-foreground">
            {categories.reduce((sum, c) => sum + (c.packageCount ?? 0), 0)}
          </span>
        </Button>
        {categories.map((category) => (
          <Button
            key={category.id}
            variant={selectedCategory === category.id ? "secondary" : "ghost"}
            size="sm"
            onClick={() => onSelect(category.id)}
            className="w-full justify-start"
          >
            <span className="truncate">{category.name}</span>
            {category.packageCount != null && (
              <span className="ml-auto text-xs text-muted-foreground">
                {category.packageCount}
              </span>
            )}
          </Button>
        ))}
      </div>
    </ScrollArea>
  );
}
