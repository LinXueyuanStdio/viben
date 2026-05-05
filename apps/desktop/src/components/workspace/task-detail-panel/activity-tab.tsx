import { Loader2 } from "lucide-react";
import { ActivityFeed, type ActivityEvent } from "@viben/kanban";
import { ScrollArea } from "@viben/ui";

export interface ActivityTabProps {
  activities: ActivityEvent[];
  isLoading: boolean;
}

export function ActivityTab({ activities, isLoading }: ActivityTabProps) {
  return (
    <ScrollArea className="h-full">
      <div className="p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ActivityFeed events={activities} maxItems={50} />
        )}
      </div>
    </ScrollArea>
  );
}
