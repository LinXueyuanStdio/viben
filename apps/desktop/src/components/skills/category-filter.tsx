import { memo, useCallback } from "react";
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

/**
 * CategoryFilter component for skills marketplace filtering
 * Memoized to prevent unnecessary re-renders
 */
export const CategoryFilter = memo(function CategoryFilter({
  categories,
  selectedCategory,
  onCategoryChange,
  selectedType = null,
  onTypeChange,
  loading = false,
}: CategoryFilterProps) {
  const { t } = useTranslation();

  // Memoize the "All Categories" click handler
  const handleSelectAllCategories = useCallback(() => {
    onCategoryChange(null);
  }, [onCategoryChange]);

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
              <SkillTypeButton
                key={type.id}
                typeId={type.id}
                label={t(type.label)}
                isSelected={
                  (type.id === "all" && !selectedType) ||
                  selectedType === type.id
                }
                onSelect={onTypeChange}
              />
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
            onClick={handleSelectAllCategories}
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
              <CategoryButton
                key={category.id}
                category={category}
                isSelected={selectedCategory === category.id}
                onSelect={onCategoryChange}
              />
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
});

/**
 * Individual skill type button component
 * Memoized to prevent re-renders when other types change
 */
const SkillTypeButton = memo(function SkillTypeButton({
  typeId,
  label,
  isSelected,
  onSelect,
}: {
  typeId: string;
  label: string;
  isSelected: boolean;
  onSelect: (type: string | null) => void;
}) {
  const handleClick = useCallback(() => {
    onSelect(typeId === "all" ? null : typeId);
  }, [onSelect, typeId]);

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
      <span>{label}</span>
      {isSelected && <Check className="h-4 w-4" />}
    </button>
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
  category: SkillCategory;
  isSelected: boolean;
  onSelect: (categoryId: string | null) => void;
}) {
  const handleClick = useCallback(() => {
    onSelect(category.id);
  }, [onSelect, category.id]);

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
        <span className="text-xs text-muted-foreground">({category.count})</span>
        {isSelected && <Check className="h-4 w-4" />}
      </div>
    </button>
  );
});

export default CategoryFilter;
