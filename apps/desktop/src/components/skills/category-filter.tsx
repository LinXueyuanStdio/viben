import * as React from "react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { Folder, Layers, Check } from "lucide-react";
import type { SkillCategory } from "@/hooks/use-cloud-skills";

/* -----------------------------------------------------------------------------
 * Skill Type Filter
 * -------------------------------------------------------------------------- */

const SKILL_TYPES = [
  { id: "all", label: "skillsMarket.allTypes" },
  { id: "automation", label: "skillsMarket.typeAutomation" },
  { id: "analysis", label: "skillsMarket.typeAnalysis" },
  { id: "generation", label: "skillsMarket.typeGeneration" },
] as const;

type SkillTypeId = (typeof SKILL_TYPES)[number]["id"];

/* -----------------------------------------------------------------------------
 * Category Filter Component
 * -------------------------------------------------------------------------- */

interface CategoryFilterProps {
  categories: SkillCategory[];
  selectedCategory: string | null;
  onCategoryChange: (categoryId: string | null) => void;
  selectedType?: string | null;
  onTypeChange?: (type: string | null) => void;
  loading?: boolean;
}

export function CategoryFilter({
  categories,
  selectedCategory,
  onCategoryChange,
  selectedType = null,
  onTypeChange,
  loading = false,
}: CategoryFilterProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      {/* Skill Type Filter */}
      {onTypeChange && (
        <section>
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Layers className="h-4 w-4 text-muted-foreground" />
            {t("skillsMarket.skillType")}
          </h4>
          <div className="space-y-1">
            {SKILL_TYPES.map((type) => (
              <button
                key={type.id}
                onClick={() =>
                  onTypeChange(type.id === "all" ? null : type.id)
                }
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm",
                  "transition-colors duration-200",
                  (type.id === "all" && !selectedType) ||
                    selectedType === type.id
                    ? "bg-primary/10 text-primary font-medium"
                    : "hover:bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                <span>{t(type.label)}</span>
                {((type.id === "all" && !selectedType) ||
                  selectedType === type.id) && (
                  <Check className="h-4 w-4" />
                )}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Category Filter */}
      <section>
        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
          <Folder className="h-4 w-4 text-muted-foreground" />
          {t("skillsMarket.categories")}
        </h4>
        <div className="space-y-1">
          {/* All Categories Option */}
          <button
            onClick={() => onCategoryChange(null)}
            className={cn(
              "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm",
              "transition-colors duration-200",
              !selectedCategory
                ? "bg-primary/10 text-primary font-medium"
                : "hover:bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            <span>{t("skillsMarket.allCategories")}</span>
            {!selectedCategory && <Check className="h-4 w-4" />}
          </button>

          {/* Loading State */}
          {loading && (
            <div className="space-y-2 py-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between px-3 py-2"
                >
                  <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                  <div className="h-4 w-8 bg-muted rounded animate-pulse" />
                </div>
              ))}
            </div>
          )}

          {/* Category List */}
          {!loading &&
            categories.map((category) => (
              <button
                key={category.id}
                onClick={() => onCategoryChange(category.id)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm",
                  "transition-colors duration-200",
                  selectedCategory === category.id
                    ? "bg-primary/10 text-primary font-medium"
                    : "hover:bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                <span className="truncate">{category.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    ({category.count})
                  </span>
                  {selectedCategory === category.id && (
                    <Check className="h-4 w-4" />
                  )}
                </div>
              </button>
            ))}

          {/* Empty State */}
          {!loading && categories.length === 0 && (
            <p className="text-sm text-muted-foreground px-3 py-2">
              {t("skillsMarket.noCategories")}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

export default CategoryFilter;
