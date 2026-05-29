import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppStore } from "@/stores";
import { useTranslation } from "react-i18next";
import { SettingsItem, SectionHeader } from "../components";
import { usePlatform } from "@/hooks/use-platform";
import { ShortcutRecorder } from "./shortcut-recorder";

export function ShortcutsSection() {
  const { t } = useTranslation();
  const currentPlatform = usePlatform();
  const {
    shortcuts,
    showHideWindowScope,
    setShortcut,
    setShowHideWindowScope,
    resetShortcuts,
  } = useAppStore();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold font-serif mb-1">
          {t("settings.sections.shortcuts")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("settings.shortcutsDescription")}
        </p>
      </div>

      {/* Messaging Shortcuts */}
      <div className="rounded-xl border bg-card p-4">
        <SectionHeader title={t("settings.shortcutGroups.messaging")} />

        {/* Send Message */}
        <SettingsItem
          title={t("settings.sendMessage")}
          description={t("settings.sendMessageDescription")}
        >
          <Select
            value={shortcuts.sendMessage}
            onValueChange={(value) => setShortcut("sendMessage", value)}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue>
                {shortcuts.sendMessage === "Enter"
                  ? t("settings.enterKey")
                  : t("settings.cmdEnter")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Enter">{t("settings.enterKey")}</SelectItem>
              <SelectItem value="Cmd+Enter">{t("settings.cmdEnter")}</SelectItem>
            </SelectContent>
          </Select>
        </SettingsItem>
      </div>

      {/* Application Shortcuts */}
      <div className="rounded-xl border bg-card p-4">
        <SectionHeader title={t("settings.shortcutGroups.application")} />

        {/* Screenshot */}
        <SettingsItem
          title={t("settings.screenshot")}
          description={t("settings.screenshotDescription")}
        >
          <ShortcutRecorder
            value={shortcuts.screenshot}
            onChange={(value) => setShortcut("screenshot", value)}
            onClear={() => setShortcut("screenshot", "")}
            currentPlatform={currentPlatform}
          />
        </SettingsItem>

        {/* Lock */}
        <SettingsItem
          title={t("settings.lock")}
          description={t("settings.lockDescription")}
        >
          <ShortcutRecorder
            value={shortcuts.lock}
            onChange={(value) => setShortcut("lock", value)}
            onClear={() => setShortcut("lock", "")}
            currentPlatform={currentPlatform}
          />
        </SettingsItem>

        {/* Show/Hide Window */}
        <div className="py-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex-1 pr-4">
              <h3 className="text-sm font-medium text-foreground">
                {t("settings.showHideWindow")}
              </h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                {t("settings.showHideWindowDescription")}
              </p>
            </div>
            <div className="shrink-0">
              <ShortcutRecorder
                value={shortcuts.showHideWindow}
                onChange={(value) => setShortcut("showHideWindow", value)}
                onClear={() => setShortcut("showHideWindow", "")}
                currentPlatform={currentPlatform}
              />
            </div>
          </div>

          {/* Nested Control Scope option */}
          <div className="mt-4 ml-4 pl-4 border-l-2 border-muted">
            <div className="flex items-center justify-between">
              <div className="flex-1 pr-4">
                <h4 className="text-sm font-medium text-muted-foreground">
                  {t("settings.controlScope")}
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t("settings.controlScopeDescription")}
                </p>
              </div>
              <Select
                value={showHideWindowScope}
                onValueChange={(value) => setShowHideWindowScope(value as "all" | "chatRelated")}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue>
                    {showHideWindowScope === "all"
                      ? t("settings.allWindows")
                      : t("settings.chatRelatedWindows")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("settings.allWindows")}</SelectItem>
                  <SelectItem value="chatRelated">{t("settings.chatRelatedWindows")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Create Task */}
        <SettingsItem
          title={t("settings.createTask")}
          description={t("settings.createTaskDescription")}
        >
          <ShortcutRecorder
            value={shortcuts.createTask}
            onChange={(value) => setShortcut("createTask", value)}
            onClear={() => setShortcut("createTask", "")}
            currentPlatform={currentPlatform}
          />
        </SettingsItem>
      </div>

      {/* Tab Navigation Shortcuts */}
      <div className="rounded-xl border bg-card p-4">
        <SectionHeader title={t("settings.shortcutGroups.tabNavigation")} />

        <SettingsItem
          title={t("settings.newTab")}
          description={t("settings.newTabDescription")}
        >
          <ShortcutRecorder
            value={shortcuts.newTab}
            onChange={(value) => setShortcut("newTab", value)}
            onClear={() => setShortcut("newTab", "")}
            currentPlatform={currentPlatform}
          />
        </SettingsItem>

        <SettingsItem
          title={t("settings.closeTab")}
          description={t("settings.closeTabDescription")}
        >
          <ShortcutRecorder
            value={shortcuts.closeTab}
            onChange={(value) => setShortcut("closeTab", value)}
            onClear={() => setShortcut("closeTab", "")}
            currentPlatform={currentPlatform}
          />
        </SettingsItem>

        <SettingsItem
          title={t("settings.reopenClosedTab")}
          description={t("settings.reopenClosedTabDescription")}
        >
          <ShortcutRecorder
            value={shortcuts.reopenClosedTab}
            onChange={(value) => setShortcut("reopenClosedTab", value)}
            onClear={() => setShortcut("reopenClosedTab", "")}
            currentPlatform={currentPlatform}
          />
        </SettingsItem>
      </div>

      {/* Reset */}
      <div className="rounded-xl border bg-card p-4">
        <Button
          variant="outline"
          onClick={resetShortcuts}
          className="w-full"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          {t("settings.resetShortcuts")}
        </Button>
      </div>
    </div>
  );
}
