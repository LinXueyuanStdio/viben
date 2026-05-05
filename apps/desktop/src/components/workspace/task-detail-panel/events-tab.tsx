import { History } from "lucide-react";
import { Badge, ScrollArea, cn } from "@viben/ui";
import type { TFunction } from "i18next";
import type { TaskForPanel } from "./types";
import { formatEventTime, getEventTypeBadgeClass } from "./utils";

export interface EventsTabProps {
  task: TaskForPanel;
  t: TFunction;
}

export function EventsTab({ task, t }: EventsTabProps) {
  return (
    <ScrollArea className="h-full">
      <div className="p-4">
        {task.eventHistory && task.eventHistory.length > 0 ? (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground mb-4">
              {t("workspace.taskEvents.history", "Event History")}
            </h3>
            {task.eventHistory.slice().reverse().map((event, index) => (
              <div
                key={event.eventId}
                className={cn(
                  "p-3 rounded-lg border",
                  index === 0 ? "bg-accent/50 border-accent" : "bg-muted/30 border-border"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-xs">
                      #{event.sequence}
                    </Badge>
                    <Badge className={cn("text-xs", getEventTypeBadgeClass(event.type))}>
                      {event.type}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatEventTime(event.timestamp, t)}
                  </span>
                </div>
                {event.payload && Object.keys(event.payload).length > 0 && (
                  <div className="mt-2 text-xs text-muted-foreground font-mono bg-muted/50 p-2 rounded">
                    {JSON.stringify(event.payload, null, 2)}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12">
            <History className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground mb-2">
              {t("workspace.taskEvents.noEvents", "No events yet")}
            </h3>
            <p className="text-sm text-muted-foreground/60 text-center max-w-xs">
              {t(
                "workspace.taskEvents.eventsWillAppear",
                "State machine events will appear here as the task progresses"
              )}
            </p>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
