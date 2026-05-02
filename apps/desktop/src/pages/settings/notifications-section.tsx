import { useEffect } from "react";
import {
  AlertCircle,
  Loader2,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Bell,
  Volume2,
  VolumeX,
  Moon,
  Users,
  Clock,
  Zap,
  Bot,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useNotificationStore } from "@/stores/notification-store";
import { useSystemNotification } from "@/hooks/use-system-notification";
import type { NotificationCategory, NotificationMethod } from "@/types/notification";
import { Input } from "@/components/ui/input";
import type React from "react";
import { SectionHeader } from "./components";

// Category configuration for notification settings
interface NotificationCategoryConfig {
  id: NotificationCategory;
  labelKey: string;
  descriptionKey: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NOTIFICATION_CATEGORIES: NotificationCategoryConfig[] = [
  { id: "chat", labelKey: "settings.notifications.chatCategory", descriptionKey: "settings.notifications.chatDescription", icon: MessageSquare },
  { id: "group", labelKey: "settings.notifications.groupCategory", descriptionKey: "settings.notifications.groupDescription", icon: Users },
  { id: "cron", labelKey: "settings.notifications.cronCategory", descriptionKey: "settings.notifications.cronDescription", icon: Clock },
  { id: "agent", labelKey: "settings.notifications.agentCategory", descriptionKey: "settings.notifications.agentDescription", icon: Bot },
  { id: "system", labelKey: "settings.notifications.systemCategory", descriptionKey: "settings.notifications.systemDescription", icon: Zap },
  // Auto-Claude inspired task notifications
  { id: "task_complete", labelKey: "settings.notifications.taskCompleteCategory", descriptionKey: "settings.notifications.taskCompleteDescription", icon: CheckCircle2 },
  { id: "task_failed", labelKey: "settings.notifications.taskFailedCategory", descriptionKey: "settings.notifications.taskFailedDescription", icon: XCircle },
  { id: "review_needed", labelKey: "settings.notifications.reviewNeededCategory", descriptionKey: "settings.notifications.reviewNeededDescription", icon: AlertTriangle },
];

export function NotificationsSection() {
  const { t } = useTranslation();
  const {
    preferences,
    preferencesLoading,
    loadPreferences,
    setPreferences,
    setCategoryEnabled,
    setCategoryMethod,
    setDoNotDisturb,
  } = useNotificationStore();
  const {
    isGranted,
    isChecking,
    requestPermission,
  } = useSystemNotification();

  // Load preferences from Gateway on mount
  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  // Handle master toggle - also request permission when enabling
  const handleMasterToggle = async (enabled: boolean) => {
    if (enabled && !isGranted) {
      // Request system notification permission when enabling
      const granted = await requestPermission();
      console.log("[NotificationsSection] Permission request result:", granted);
    }
    setPreferences({ enabled });
  };

  // Handle sound toggle
  const handleSoundToggle = (sound: boolean) => {
    setPreferences({ sound });
  };

  // Handle DND time change
  const handleDndStartChange = (start: string) => {
    setDoNotDisturb(preferences.doNotDisturb.enabled, start, preferences.doNotDisturb.end);
  };

  const handleDndEndChange = (end: string) => {
    setDoNotDisturb(preferences.doNotDisturb.enabled, preferences.doNotDisturb.start, end);
  };

  // Show loading state while loading preferences from Gateway
  if (preferencesLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold font-serif mb-1">
            {t("settings.sections.notifications")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("settings.notifications.description")}
          </p>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold font-serif mb-1">
          {t("settings.sections.notifications")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("settings.notifications.description")}
        </p>
      </div>

      {/* System Permission Status */}
      {!isGranted && !isChecking && (
        <div className="rounded-xl border border-amber-500/50 bg-amber-500/10 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <AlertCircle className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-foreground">
                  {t("settings.notifications.permissionRequired")}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t("settings.notifications.permissionRequiredDescription")}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const granted = await requestPermission();
                console.log("[NotificationsSection] Manual permission request:", granted);
              }}
            >
              {t("settings.notifications.grantPermission")}
            </Button>
          </div>
        </div>
      )}

      {/* Master Toggle */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-foreground">
                {t("settings.notifications.masterToggle")}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t("settings.notifications.masterToggleDescription")}
              </p>
            </div>
          </div>
          <Switch
            checked={preferences.enabled}
            onCheckedChange={handleMasterToggle}
          />
        </div>
      </div>

      {/* Category Settings */}
      <div className={cn(
        "rounded-xl border bg-card p-4",
        preferences.enabled
          ? ""
          : "opacity-50 pointer-events-none"
      )}>
        <SectionHeader title={t("settings.notifications.categorySettings")} />
        <p className="text-sm text-muted-foreground mb-4">
          {t("settings.notifications.categorySettingsDescription")}
        </p>

        <div className="space-y-4">
          {NOTIFICATION_CATEGORIES.map((category) => {
            const Icon = category.icon;
            const isEnabled = preferences.categories[category.id];
            const method = preferences.methods?.[category.id] ?? "both";

            return (
              <div
                key={category.id}
                className="rounded-lg border bg-muted/30 p-4 space-y-3"
              >
                {/* Category header with toggle */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "p-2 rounded-lg transition-colors",
                      isEnabled ? "bg-primary/10" : "bg-muted"
                    )}>
                      <Icon className={cn(
                        "h-4 w-4 transition-colors",
                        isEnabled ? "text-primary" : "text-muted-foreground"
                      )} />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-foreground">
                        {t(category.labelKey)}
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        {t(category.descriptionKey)}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={isEnabled}
                    onCheckedChange={(checked) => setCategoryEnabled(category.id, checked)}
                  />
                </div>

                {/* Notification method selector */}
                {isEnabled && (
                  <div className="ml-11 pt-2 border-t border-border/50">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {t("settings.notifications.deliveryMethod")}
                      </span>
                      <Select
                        value={method}
                        onValueChange={(value) => setCategoryMethod(category.id, value as NotificationMethod)}
                      >
                        <SelectTrigger className="w-[160px] h-8 text-xs">
                          <SelectValue>
                            {method === "toast" && t("settings.notifications.toastOnly")}
                            {method === "system" && t("settings.notifications.systemOnly")}
                            {method === "both" && t("settings.notifications.both")}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="toast">{t("settings.notifications.toastOnly")}</SelectItem>
                          <SelectItem value="system">{t("settings.notifications.systemOnly")}</SelectItem>
                          <SelectItem value="both">{t("settings.notifications.both")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Sound Settings */}
      <div className={cn(
        "rounded-xl border bg-card p-4",
        preferences.enabled
          ? ""
          : "opacity-50 pointer-events-none"
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-lg transition-colors",
              preferences.sound ? "bg-primary/10" : "bg-muted"
            )}>
              {preferences.sound ? (
                <Volume2 className="h-5 w-5 text-primary" />
              ) : (
                <VolumeX className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-medium text-foreground">
                {t("settings.notifications.sound")}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t("settings.notifications.soundDescription")}
              </p>
            </div>
          </div>
          <Switch
            checked={preferences.sound}
            onCheckedChange={handleSoundToggle}
          />
        </div>
      </div>

      {/* Do Not Disturb */}
      <div className={cn(
        "rounded-xl border bg-card p-4",
        preferences.enabled
          ? ""
          : "opacity-50 pointer-events-none"
      )}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-lg transition-colors",
              preferences.doNotDisturb.enabled ? "bg-primary/10" : "bg-muted"
            )}>
              <Moon className={cn(
                "h-5 w-5 transition-colors",
                preferences.doNotDisturb.enabled ? "text-primary" : "text-muted-foreground"
              )} />
            </div>
            <div>
              <h3 className="text-sm font-medium text-foreground">
                {t("settings.notifications.doNotDisturb")}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t("settings.notifications.doNotDisturbDescription")}
              </p>
            </div>
          </div>
          <Switch
            checked={preferences.doNotDisturb.enabled}
            onCheckedChange={(enabled) => setDoNotDisturb(enabled)}
          />
        </div>

        {/* Time range inputs */}
        {preferences.doNotDisturb.enabled && (
          <div className="ml-11 pt-4 border-t border-border/50">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1.5 block">
                  {t("settings.notifications.dndStart")}
                </label>
                <Input
                  type="time"
                  value={preferences.doNotDisturb.start}
                  onChange={(e) => handleDndStartChange(e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="text-muted-foreground mt-5">-</div>
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1.5 block">
                  {t("settings.notifications.dndEnd")}
                </label>
                <Input
                  type="time"
                  value={preferences.doNotDisturb.end}
                  onChange={(e) => handleDndEndChange(e.target.value)}
                  className="w-full"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {t("settings.notifications.dndHint")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
