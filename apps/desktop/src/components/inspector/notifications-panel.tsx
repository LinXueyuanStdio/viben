import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bell,
  ChevronDown,
  ChevronUp,
  Info,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from "react-i18next";
import type { InspectorNotification } from "@/types";

interface NotificationsPanelProps {
  notifications: InspectorNotification[];
  onClearNotifications: () => void;
  onRemoveNotification: (id: string) => void;
}

type NotificationFilterType = "all" | "info" | "progress" | "stderr";

interface NotificationCounts {
  all: number;
  info: number;
  progress: number;
  stderr: number;
}

export function NotificationsPanel({
  notifications,
  onClearNotifications,
  onRemoveNotification,
}: NotificationsPanelProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeFilter, setActiveFilter] = useState<NotificationFilterType>("all");

  const { filteredNotifications, counts } = useMemo(() => {
    const counts: NotificationCounts = {
      all: notifications.length,
      info: 0,
      progress: 0,
      stderr: 0,
    };

    // Count notifications by type
    notifications.forEach((notification) => {
      if (notification.type === "stderr") {
        counts.stderr++;
      } else if (notification.method?.includes("progress")) {
        counts.progress++;
      } else {
        counts.info++;
      }
    });

    // Filter notifications based on active filter
    const filtered = notifications.filter((notification) => {
      if (activeFilter === "all") return true;
      if (activeFilter === "stderr") return notification.type === "stderr";
      if (activeFilter === "progress") {
        return notification.method?.includes("progress");
      }
      if (activeFilter === "info") {
        return notification.type !== "stderr" && !notification.method?.includes("progress");
      }
      return true;
    });

    return { filteredNotifications: filtered, counts };
  }, [notifications, activeFilter]);

  const formatTimestamp = (timestamp: Date) => {
    return timestamp.toLocaleTimeString();
  };

  const getNotificationTypeInfo = (notification: InspectorNotification) => {
    if (notification.type === "stderr") {
      return {
        icon: AlertTriangle,
        color: "text-red-600 dark:text-red-400",
        bgColor: "bg-red-50 dark:bg-red-950/20",
        borderColor: "border-red-200 dark:border-red-800",
        badge: "stderr",
        badgeVariant: "destructive" as const,
      };
    }

    if (notification.method?.includes("progress")) {
      return {
        icon: Activity,
        color: "text-blue-600 dark:text-blue-400",
        bgColor: "bg-blue-50 dark:bg-blue-950/20",
        borderColor: "border-blue-200 dark:border-blue-800",
        badge: "progress",
        badgeVariant: "secondary" as const,
      };
    }

    return {
      icon: Bell,
      color: "text-green-600 dark:text-green-400",
      bgColor: "bg-green-50 dark:bg-green-950/20",
      borderColor: "border-green-200 dark:border-green-800",
      badge: "info",
      badgeVariant: "default" as const,
    };
  };

  const renderNotificationContent = (notification: InspectorNotification) => {
    if (notification.type === "stderr") {
      return (
        <div className="text-xs text-red-700 dark:text-red-300 font-mono bg-red-50 dark:bg-red-950/20 p-1.5 rounded border border-red-200 dark:border-red-800">
          {(notification.params as { content?: string })?.content || "stderr output"}
        </div>
      );
    }

    return (
      <div className="space-y-1">
        <div className="text-xs font-medium text-foreground">
          Method:{" "}
          <code className="text-xs bg-muted px-1 rounded">{notification.method}</code>
        </div>
        {notification.params && (
          <div className="text-xs text-muted-foreground">
            <div className="font-medium mb-0.5">Parameters:</div>
            <pre className="text-xs bg-muted p-1.5 rounded border overflow-x-auto max-h-24">
              {JSON.stringify(notification.params, null, 2)}
            </pre>
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="w-full shadow-none" interactive={false}>
      <CardHeader className="py-2 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <CardTitle className="text-sm">{t("inspector.mcpNotifications")}</CardTitle>
            <Badge variant="outline" className="text-xs h-5 px-1.5">
              {notifications.length}
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={onClearNotifications}
              disabled={notifications.length === 0}
              className="h-7 text-xs px-2"
            >
              <Trash2 className="h-3 w-3 mr-1" />
              {t("inspector.clearAll")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-7 w-7 p-0"
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0 px-3 pb-3">
          <Tabs value={activeFilter} onValueChange={(value) => setActiveFilter(value as NotificationFilterType)}>
            <div className="flex justify-start">
              <TabsList className="h-8 p-0.5 inline-flex w-auto">
                <TabsTrigger value="all" className="text-xs h-6 px-3 flex items-center gap-1">
                  <Bell className="h-3 w-3" />
                  {t("inspector.all")}
                  <Badge variant="outline" className="text-xs h-4 px-1 ml-1">
                    {counts.all}
                  </Badge>
                </TabsTrigger>

                <TabsTrigger value="info" className="text-xs h-6 px-3 flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  Info
                  <Badge
                    variant={counts.info > 0 ? "default" : "outline"}
                    className="text-xs h-4 px-1 ml-1"
                  >
                    {counts.info}
                  </Badge>
                </TabsTrigger>

                <TabsTrigger value="progress" className="text-xs h-6 px-3 flex items-center gap-1">
                  <Activity className="h-3 w-3" />
                  Progress
                  <Badge
                    variant={counts.progress > 0 ? "secondary" : "outline"}
                    className="text-xs h-4 px-1 ml-1"
                  >
                    {counts.progress}
                  </Badge>
                </TabsTrigger>

                <TabsTrigger value="stderr" className="text-xs h-6 px-3 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Stderr
                  <Badge
                    variant={counts.stderr > 0 ? "destructive" : "outline"}
                    className="text-xs h-4 px-1 ml-1"
                  >
                    {counts.stderr}
                  </Badge>
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value={activeFilter} className="mt-2">
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {filteredNotifications.length === 0 ? (
                  <div className="text-center text-xs text-muted-foreground py-4">
                    {t("inspector.noNotifications", { type: activeFilter === "all" ? "" : activeFilter })}
                  </div>
                ) : (
                  filteredNotifications.map((notification) => {
                    const typeInfo = getNotificationTypeInfo(notification);
                    const Icon = typeInfo.icon;

                    return (
                      <div key={notification.id}>
                        <div className={`p-2 rounded border ${typeInfo.bgColor} ${typeInfo.borderColor}`}>
                          <div className="flex items-start justify-between mb-1.5">
                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                              <Icon className={`h-3 w-3 flex-shrink-0 ${typeInfo.color}`} />
                              <Badge variant={typeInfo.badgeVariant} className="text-xs py-0 h-4 px-1">
                                {typeInfo.badge}
                              </Badge>
                              <span className="text-xs text-muted-foreground flex-shrink-0">
                                {formatTimestamp(notification.timestamp)}
                              </span>
                            </div>

                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0 flex-shrink-0"
                              onClick={() => onRemoveNotification(notification.id)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>

                          <div>{renderNotificationContent(notification)}</div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      )}
    </Card>
  );
}
