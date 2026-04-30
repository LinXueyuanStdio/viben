"use client";

import * as React from "react";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarImage, AvatarFallback, cn } from "@viben/ui";
import { formatRelativeTime } from "./time-utils";
import {
  Plus,
  RefreshCw,
  ArrowRight,
  User,
  Type,
  FileText,
  Tag,
  Calendar,
  MessageSquare,
  Flag,
} from "lucide-react";
import type { ActivityEvent, ActivityType } from "./activity-types";
import { ACTIVITY_LABEL_KEYS } from "./activity-types";

export interface ActivityItemProps {
  event: ActivityEvent;
  className?: string;
}

const ACTIVITY_ICONS: Record<ActivityType, React.ElementType> = {
  created: Plus,
  status_changed: RefreshCw,
  priority_changed: Flag,
  assignee_changed: User,
  title_changed: Type,
  description_changed: FileText,
  tag_added: Tag,
  tag_removed: Tag,
  due_date_changed: Calendar,
  comment_added: MessageSquare,
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}


export const ActivityItem = React.forwardRef<HTMLDivElement, ActivityItemProps>(
  ({ event, className }, ref) => {
    const { t } = useTranslation();
    const Icon = ACTIVITY_ICONS[event.type];
    const label = t(ACTIVITY_LABEL_KEYS[event.type]);
    const { oldValue, newValue } = event.data;
    const hasValueChange = oldValue !== undefined && newValue !== undefined;

    return (
      <div
        ref={ref}
        className={cn(
          "relative flex gap-3 py-2",
          "text-sm text-muted-foreground",
          className
        )}
      >
        {/* Actor Avatar */}
        <Avatar className="h-6 w-6 flex-shrink-0">
          {event.actor.avatar && (
            <AvatarImage src={event.actor.avatar} alt={event.actor.name} />
          )}
          <AvatarFallback className="bg-muted text-muted-foreground text-[10px]">
            {getInitials(event.actor.name)}
          </AvatarFallback>
        </Avatar>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Activity Description */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-medium text-foreground">
              {event.actor.name}
            </span>
            <Icon className="h-3.5 w-3.5 text-muted-foreground/70" />
            <span>{label}</span>
          </div>

          {/* Value Change Display */}
          {hasValueChange && (
            <div className="flex items-center gap-1.5 mt-1 text-xs">
              <span className="px-1.5 py-0.5 rounded bg-muted line-through">
                {oldValue}
              </span>
              <ArrowRight className="h-3 w-3 text-muted-foreground/50" />
              <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                {newValue}
              </span>
            </div>
          )}

          {/* Comment Content */}
          {event.type === "comment_added" && event.data.newValue && (
            <div className="mt-1.5 p-2 rounded-md bg-muted/50 text-xs text-foreground">
              {event.data.newValue}
            </div>
          )}

          {/* Timestamp */}
          <div className="mt-1 text-xs text-muted-foreground/60">
            {formatRelativeTime(event.timestamp)}
          </div>
        </div>
      </div>
    );
  }
);

ActivityItem.displayName = "ActivityItem";
