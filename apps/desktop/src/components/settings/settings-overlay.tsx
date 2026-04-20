import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useOverlayStore } from "@/stores/overlay-store";
import {
  loadOverlayConfig,
  saveOverlayConfig,
  DEFAULT_OVERLAY_SETTINGS,
} from "@/lib/overlay-config";
import type { OverlaySettings, ClickStyle, KeystrokePosition } from "@/types/overlay";
import { Loader2, Save } from "lucide-react";

// Helper to update nested settings
function updateNestedSettings<
  T extends object,
  K extends keyof T,
  NK extends keyof T[K]
>(settings: T, section: K, key: NK, value: T[K][NK]): T {
  return {
    ...settings,
    [section]: {
      ...settings[section],
      [key]: value,
    },
  };
}

interface SettingRowProps {
  label: string;
  description?: string;
  children: React.ReactNode;
}

function SettingRow({ label, description, children }: SettingRowProps) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="space-y-0.5">
        <Label className="text-sm font-medium">{label}</Label>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

interface SettingsSectionProps {
  title: string;
  children: React.ReactNode;
}

function SettingsSection({ title, children }: SettingsSectionProps) {
  return (
    <div className="space-y-1">
      <h3 className="text-sm font-semibold text-foreground mb-3">{title}</h3>
      <div className="divide-y divide-border">{children}</div>
    </div>
  );
}

export function SettingsOverlay() {
  const { t } = useTranslation();
  const store = useOverlayStore();
  const [settings, setSettings] = useState<OverlaySettings>(DEFAULT_OVERLAY_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Load settings on mount
  useEffect(() => {
    setIsLoading(true);
    loadOverlayConfig()
      .then((loaded) => {
        setSettings(loaded);
        setHasChanges(false);
      })
      .catch((err) => {
        console.error("[SettingsOverlay] Failed to load config:", err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  // Track changes
  const updateSettings = useCallback((newSettings: OverlaySettings) => {
    setSettings(newSettings);
    setHasChanges(true);
  }, []);

  // Save settings
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await saveOverlayConfig(settings);
      store.actions.loadConfig(settings);
      setHasChanges(false);
    } catch (err) {
      console.error("[SettingsOverlay] Failed to save config:", err);
    } finally {
      setIsSaving(false);
    }
  }, [settings, store.actions]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header with save button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{t("settings.overlay.title")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("settings.overlay.description")}
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          size="sm"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          {t("common.save")}
        </Button>
      </div>

      {/* Global Settings */}
      <SettingsSection title={t("settings.overlay.global.title")}>
        <SettingRow
          label={t("settings.overlay.global.defaultEnabled")}
          description={t("settings.overlay.global.defaultEnabledDesc")}
        >
          <Switch
            checked={settings.default_enabled}
            onCheckedChange={(checked) =>
              updateSettings({ ...settings, default_enabled: checked })
            }
          />
        </SettingRow>
        <SettingRow
          label={t("settings.overlay.global.opacity")}
          description={t("settings.overlay.global.opacityDesc")}
        >
          <div className="flex items-center gap-3">
            <Slider
              value={[settings.opacity * 100]}
              onValueChange={([val]) =>
                updateSettings({ ...settings, opacity: val / 100 })
              }
              min={10}
              max={100}
              step={5}
              className="w-32"
            />
            <span className="text-sm text-muted-foreground w-10">
              {Math.round(settings.opacity * 100)}%
            </span>
          </div>
        </SettingRow>
      </SettingsSection>

      {/* Danmaku Settings */}
      <SettingsSection title={t("settings.overlay.danmaku.title")}>
        <SettingRow
          label={t("settings.overlay.danmaku.enabled")}
          description={t("settings.overlay.danmaku.enabledDesc")}
        >
          <Switch
            checked={settings.danmaku.enabled}
            onCheckedChange={(checked) =>
              updateSettings(
                updateNestedSettings(settings, "danmaku", "enabled", checked)
              )
            }
          />
        </SettingRow>
        <SettingRow
          label={t("settings.overlay.danmaku.speed")}
          description={t("settings.overlay.danmaku.speedDesc")}
        >
          <Select
            value={settings.danmaku.speed}
            onValueChange={(value: "slow" | "normal" | "fast") =>
              updateSettings(
                updateNestedSettings(settings, "danmaku", "speed", value)
              )
            }
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="slow">
                {t("settings.overlay.danmaku.speedSlow")}
              </SelectItem>
              <SelectItem value="normal">
                {t("settings.overlay.danmaku.speedNormal")}
              </SelectItem>
              <SelectItem value="fast">
                {t("settings.overlay.danmaku.speedFast")}
              </SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>
        <SettingRow
          label={t("settings.overlay.danmaku.maxTracks")}
          description={t("settings.overlay.danmaku.maxTracksDesc")}
        >
          <div className="flex items-center gap-3">
            <Slider
              value={[settings.danmaku.max_tracks]}
              onValueChange={([val]) =>
                updateSettings(
                  updateNestedSettings(settings, "danmaku", "max_tracks", val)
                )
              }
              min={1}
              max={16}
              step={1}
              className="w-32"
            />
            <span className="text-sm text-muted-foreground w-6">
              {settings.danmaku.max_tracks}
            </span>
          </div>
        </SettingRow>
      </SettingsSection>

      {/* Subtitle Settings */}
      <SettingsSection title={t("settings.overlay.subtitle.title")}>
        <SettingRow
          label={t("settings.overlay.subtitle.enabled")}
          description={t("settings.overlay.subtitle.enabledDesc")}
        >
          <Switch
            checked={settings.subtitle.enabled}
            onCheckedChange={(checked) =>
              updateSettings(
                updateNestedSettings(settings, "subtitle", "enabled", checked)
              )
            }
          />
        </SettingRow>
        <SettingRow
          label={t("settings.overlay.subtitle.position")}
          description={t("settings.overlay.subtitle.positionDesc")}
        >
          <Select
            value={settings.subtitle.position}
            onValueChange={(value: "top" | "center" | "bottom") =>
              updateSettings(
                updateNestedSettings(settings, "subtitle", "position", value)
              )
            }
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="top">
                {t("settings.overlay.subtitle.positionTop")}
              </SelectItem>
              <SelectItem value="center">
                {t("settings.overlay.subtitle.positionCenter")}
              </SelectItem>
              <SelectItem value="bottom">
                {t("settings.overlay.subtitle.positionBottom")}
              </SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>
      </SettingsSection>

      {/* Click Indicator Settings */}
      <SettingsSection title={t("settings.overlay.clickIndicator.title")}>
        <SettingRow
          label={t("settings.overlay.clickIndicator.enabled")}
          description={t("settings.overlay.clickIndicator.enabledDesc")}
        >
          <Switch
            checked={settings.click_indicator.enabled}
            onCheckedChange={(checked) =>
              updateSettings(
                updateNestedSettings(settings, "click_indicator", "enabled", checked)
              )
            }
          />
        </SettingRow>
        <SettingRow
          label={t("settings.overlay.clickIndicator.style")}
          description={t("settings.overlay.clickIndicator.styleDesc")}
        >
          <Select
            value={settings.click_indicator.style}
            onValueChange={(value: ClickStyle) =>
              updateSettings(
                updateNestedSettings(settings, "click_indicator", "style", value)
              )
            }
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ripple">
                {t("settings.overlay.clickIndicator.styleRipple")}
              </SelectItem>
              <SelectItem value="spotlight">
                {t("settings.overlay.clickIndicator.styleSpotlight")}
              </SelectItem>
              <SelectItem value="ring">
                {t("settings.overlay.clickIndicator.styleRing")}
              </SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>
      </SettingsSection>

      {/* Keystroke Settings */}
      <SettingsSection title={t("settings.overlay.keystroke.title")}>
        <SettingRow
          label={t("settings.overlay.keystroke.enabled")}
          description={t("settings.overlay.keystroke.enabledDesc")}
        >
          <Switch
            checked={settings.keystroke.enabled}
            onCheckedChange={(checked) =>
              updateSettings(
                updateNestedSettings(settings, "keystroke", "enabled", checked)
              )
            }
          />
        </SettingRow>
        <SettingRow
          label={t("settings.overlay.keystroke.position")}
          description={t("settings.overlay.keystroke.positionDesc")}
        >
          <Select
            value={settings.keystroke.position}
            onValueChange={(value: KeystrokePosition) =>
              updateSettings(
                updateNestedSettings(settings, "keystroke", "position", value)
              )
            }
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="top-left">
                {t("settings.overlay.keystroke.positionTopLeft")}
              </SelectItem>
              <SelectItem value="top-right">
                {t("settings.overlay.keystroke.positionTopRight")}
              </SelectItem>
              <SelectItem value="bottom-left">
                {t("settings.overlay.keystroke.positionBottomLeft")}
              </SelectItem>
              <SelectItem value="bottom-right">
                {t("settings.overlay.keystroke.positionBottomRight")}
              </SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>
        <SettingRow
          label={t("settings.overlay.keystroke.showModifiersOnly")}
          description={t("settings.overlay.keystroke.showModifiersOnlyDesc")}
        >
          <Switch
            checked={settings.keystroke.show_modifiers_only}
            onCheckedChange={(checked) =>
              updateSettings(
                updateNestedSettings(
                  settings,
                  "keystroke",
                  "show_modifiers_only",
                  checked
                )
              )
            }
          />
        </SettingRow>
      </SettingsSection>

      {/* Wave Settings */}
      <SettingsSection title={t("settings.overlay.wave.title")}>
        <SettingRow
          label={t("settings.overlay.wave.enabled")}
          description={t("settings.overlay.wave.enabledDesc")}
        >
          <Switch
            checked={settings.wave.enabled}
            onCheckedChange={(checked) =>
              updateSettings(
                updateNestedSettings(settings, "wave", "enabled", checked)
              )
            }
          />
        </SettingRow>
        <SettingRow
          label={t("settings.overlay.wave.height")}
          description={t("settings.overlay.wave.heightDesc")}
        >
          <div className="flex items-center gap-3">
            <Slider
              value={[settings.wave.height]}
              onValueChange={([val]) =>
                updateSettings(
                  updateNestedSettings(settings, "wave", "height", val)
                )
              }
              min={20}
              max={150}
              step={10}
              className="w-32"
            />
            <span className="text-sm text-muted-foreground w-10">
              {settings.wave.height}px
            </span>
          </div>
        </SettingRow>
        <SettingRow
          label={t("settings.overlay.wave.particlesEnabled")}
          description={t("settings.overlay.wave.particlesEnabledDesc")}
        >
          <Switch
            checked={settings.wave.particles_enabled}
            onCheckedChange={(checked) =>
              updateSettings(
                updateNestedSettings(settings, "wave", "particles_enabled", checked)
              )
            }
          />
        </SettingRow>
      </SettingsSection>
    </div>
  );
}
