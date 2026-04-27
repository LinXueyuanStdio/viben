"use client";

import * as React from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@viben/ui";
import { Activity } from "lucide-react";
import type { ActivityEvent } from "./activity-types";
import { ActivityItem } from "./activity-item";

export interface ActivityFeedProps {
  events: ActivityEvent[];
  maxItems?: number;
  className?: string;
}

export const ActivityFeed = React.forwardRef<HTMLDivElement, ActivityFeedProps>(
  ({ events, maxItems, className }, ref) => {
    const { t } = useTranslation();
    const displayedEvents = maxItems ? events.slice(0, maxItems) : events;

    // Empty state
    if (events.length === 0) {
      return (
        <div
          ref={ref}
          className={cn(
            "flex flex-col items-center justify-center py-8 text-muted-foreground",
            className
          )}
        >
          <Activity className="h-8 w-8 mb-2 opacity-50" />
          <p className="text-sm">{t("kanban.activity.noActivity")}</p>
        </div>
      );
    }

    return (
      <div ref={ref} className={cn("relative", className)}>
        {/* Timeline connector line */}
        <div
          className={cn(
            "absolute left-3 top-4 bottom-4 w-px",
            "bg-border"
          )}
          aria-hidden="true"
        />

        {/* Activity items */}
        <div className="space-y-1">
          {displayedEvents.map((event) => (
            <ActivityItem key={event.id} event={event} />
          ))}
        </div>

        {/* More items indicator */}
        {maxItems && events.length > maxItems && (
          <div className="mt-2 pl-9 text-xs text-muted-foreground">
            {t("kanban.activity.moreActivities", { count: events.length - maxItems })}
          </div>
        )}
      </div>
    );
  }
);

ActivityFeed.displayName = "ActivityFeed";
