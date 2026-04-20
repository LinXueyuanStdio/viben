/**
 * LucideTab Component
 *
 * Tab content for selecting Lucide icons.
 * Displays icons in a categorized grid layout.
 */

import * as React from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LUCIDE_ICON_MAP, ICON_CATEGORIES } from "../constants";

export interface LucideTabProps {
  /** Currently selected icon name */
  value?: string;
  /** Callback when an icon is selected */
  onSelect: (iconName: string) => void;
}

export function LucideTab({ value, onSelect }: LucideTabProps) {
  const { t } = useTranslation();
  const [selectedCategory, setSelectedCategory] = React.useState(ICON_CATEGORIES[0].id);

  // Get icons for the selected category
  const categoryIcons = React.useMemo(() => {
    const category = ICON_CATEGORIES.find((c) => c.id === selectedCategory);
    return category?.icons ?? [];
  }, [selectedCategory]);

  return (
    <div className="flex flex-col">
      {/* Category tabs */}
      <ScrollArea className="w-full">
        <div className="flex gap-1 p-2 pb-0 border-b border-border">
          {ICON_CATEGORIES.map((category) => {
            // Get first icon of category for the tab
            const firstIconName = category.icons[0];
            const FirstIcon = LUCIDE_ICON_MAP[firstIconName];

            return (
              <Button
                key={category.id}
                variant={selectedCategory === category.id ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-2 text-xs shrink-0"
                onClick={() => setSelectedCategory(category.id)}
                title={t(category.labelKey, category.id)}
              >
                {FirstIcon && <FirstIcon className="h-3.5 w-3.5" />}
              </Button>
            );
          })}
        </div>
      </ScrollArea>

      {/* Icon grid */}
      <ScrollArea className="h-[200px]">
        <div className="grid grid-cols-8 gap-0.5 p-2">
          {categoryIcons.map((iconName) => {
            const Icon = LUCIDE_ICON_MAP[iconName];
            if (!Icon) return null;

            const isSelected = value === iconName;

            return (
              <button
                key={iconName}
                type="button"
                onClick={() => onSelect(iconName)}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded transition-colors",
                  "hover:bg-accent hover:text-accent-foreground",
                  isSelected && "bg-primary/10 text-primary ring-1 ring-primary/30"
                )}
                title={iconName}
              >
                <Icon className="h-4 w-4" />
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

export default LucideTab;
