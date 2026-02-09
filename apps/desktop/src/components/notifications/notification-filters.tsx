import * as React from "react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import type { NotificationCategory } from "./notification-item";

// ============================================================================
// Types
// ============================================================================

export type NotificationFilterType = "all" | NotificationCategory;

export interface CategoryCount {
  all: number;
  chat: number;
  cron: number;
  agent: number;
  system: number;
}

export interface NotificationFiltersProps {
  activeFilter: NotificationFilterType;
  onFilterChange: (filter: NotificationFilterType) => void;
  counts: CategoryCount;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * NotificationFilters - Category filter tabs for notification center
 *
 * Displays tabs for filtering notifications by category: All, Chat, Cron, Agent, System.
 * Shows count badge for each category.
 */
const NotificationFilters = React.forwardRef<HTMLDivElement, NotificationFiltersProps>(
  ({ activeFilter, onFilterChange, counts, className }, ref) => {
    const { t } = useTranslation();

    const filters: { key: NotificationFilterType; labelKey: string }[] = [
      { key: "all", labelKey: "notifications.categories.all" },
      { key: "chat", labelKey: "notifications.categories.chat" },
      { key: "cron", labelKey: "notifications.categories.cron" },
      { key: "agent", labelKey: "notifications.categories.agent" },
      { key: "system", labelKey: "notifications.categories.system" },
    ];

    const getCount = (key: NotificationFilterType): number => {
      return counts[key] ?? 0;
    };

    return (
      <div
        ref={ref}
        className={cn("flex items-center gap-1 overflow-x-auto", className)}
        role="tablist"
        aria-label={t("notifications.filterByCategory")}
      >
        {filters.map(({ key, labelKey }) => {
          const count = getCount(key);
          const isActive = activeFilter === key;

          return (
            <button
              key={key}
              role="tab"
              aria-selected={isActive}
              onClick={() => onFilterChange(key)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md",
                "transition-colors duration-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <span>{t(labelKey)}</span>
              {count > 0 && (
                <span
                  className={cn(
                    "inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-[10px] font-semibold",
                    isActive
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-muted-foreground/20 text-muted-foreground"
                  )}
                >
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }
);
NotificationFilters.displayName = "NotificationFilters";

export { NotificationFilters };
