import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bell,
  ChevronDown,
  ChevronRight,
  Info,
  Trash2,
  X,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";
import type { InspectorNotification } from "@/types";

interface NotificationsPanelProps {
  notifications: InspectorNotification[];
  onClearNotifications: () => void;
  onRemoveNotification: (id: string) => void;
}

type NotificationFilterType = "all" | "info" | "progress" | "stderr";

export function NotificationsPanel({
  notifications,
  onClearNotifications,
  onRemoveNotification,
}: NotificationsPanelProps) {
  const { t } = useTranslation();
  const [activeFilter, setActiveFilter] = useState<NotificationFilterType>("all");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { filteredNotifications, counts } = useMemo(() => {
    const counts = { all: notifications.length, info: 0, progress: 0, stderr: 0 };

    notifications.forEach((notification) => {
      if (notification.type === "stderr") {
        counts.stderr++;
      } else if (notification.method?.includes("progress")) {
        counts.progress++;
      } else {
        counts.info++;
      }
    });

    const filtered = notifications.filter((notification) => {
      if (activeFilter === "all") return true;
      if (activeFilter === "stderr") return notification.type === "stderr";
      if (activeFilter === "progress") return notification.method?.includes("progress");
      if (activeFilter === "info") {
        return notification.type !== "stderr" && !notification.method?.includes("progress");
      }
      return true;
    });

    return { filteredNotifications: filtered, counts };
  }, [notifications, activeFilter]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const copyToClipboard = async (notification: InspectorNotification) => {
    const text = JSON.stringify(
      { method: notification.method, params: notification.params },
      null,
      2
    );
    await navigator.clipboard.writeText(text);
    setCopiedId(notification.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getNotificationStyle = (notification: InspectorNotification) => {
    if (notification.type === "stderr") {
      return { icon: AlertTriangle, color: "text-red-500", bg: "bg-red-500/10" };
    }
    if (notification.method?.includes("progress")) {
      return { icon: Activity, color: "text-blue-500", bg: "bg-blue-500/10" };
    }
    return { icon: Bell, color: "text-green-500", bg: "bg-green-500/10" };
  };

  const filterButtons: { key: NotificationFilterType; label: string; count: number }[] = [
    { key: "all", label: t("inspector.all"), count: counts.all },
    { key: "info", label: "Info", count: counts.info },
    { key: "progress", label: "Progress", count: counts.progress },
    { key: "stderr", label: "Stderr", count: counts.stderr },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{t("inspector.mcpNotifications")}</span>
            <Badge variant="secondary" className="h-5 px-1.5 text-xs">
              {counts.all}
            </Badge>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 ml-4">
            {filterButtons.map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => setActiveFilter(key)}
                className={`px-2 py-1 text-xs rounded-md transition-colors ${
                  activeFilter === key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {label}
                {count > 0 && (
                  <span className={`ml-1 ${activeFilter === key ? "opacity-80" : "opacity-60"}`}>
                    ({count})
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={onClearNotifications}
          disabled={notifications.length === 0}
          className="h-7 text-xs"
        >
          <Trash2 className="h-3 w-3 mr-1" />
          {t("inspector.clearAll")}
        </Button>
      </div>

      {/* Notifications List */}
      <div className="flex-1 overflow-auto">
        {filteredNotifications.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            <Info className="h-4 w-4 mr-2" />
            {t("inspector.noNotifications", { type: activeFilter === "all" ? "" : activeFilter })}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredNotifications.map((notification) => {
              const style = getNotificationStyle(notification);
              const Icon = style.icon;
              const isExpanded = expandedIds.has(notification.id);

              return (
                <div key={notification.id} className="group">
                  <div
                    className="flex items-center gap-2 px-4 py-2 hover:bg-muted/50 cursor-pointer"
                    onClick={() => toggleExpand(notification.id)}
                  >
                    <button className="p-0.5">
                      {isExpanded ? (
                        <ChevronDown className="h-3 w-3 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                      )}
                    </button>

                    <div className={`p-1 rounded ${style.bg}`}>
                      <Icon className={`h-3 w-3 ${style.color}`} />
                    </div>

                    <code className="text-xs font-mono flex-1 truncate">
                      {notification.method || "stderr"}
                    </code>

                    <span className="text-xs text-muted-foreground">
                      {notification.timestamp.toLocaleTimeString()}
                    </span>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(notification);
                        }}
                      >
                        {copiedId === notification.id ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveNotification(notification.id);
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {isExpanded && notification.params && (
                    <div className="px-4 pb-2 pl-12">
                      <pre className="text-xs bg-muted/50 p-2 rounded border overflow-x-auto max-h-32">
                        {JSON.stringify(notification.params, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
