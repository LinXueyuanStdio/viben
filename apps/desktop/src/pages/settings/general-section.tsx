import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ThemeSwitcher } from "./theme-switcher";
import { useAppStore } from "@/stores";
import { useTranslation } from "react-i18next";
import { LANGUAGES } from "@/i18n/languages";
import { changeLanguage } from "@/i18n";
import { useNavigate } from "react-router-dom";
import { SettingsItem, SectionHeader } from "./components";
import { TIMEZONES } from "./constants";

export function GeneralSection() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const {
    language,
    setLanguage,
    alwaysShowTextDirection,
    setAlwaysShowTextDirection,
    weekStartsOnMonday,
    setWeekStartsOnMonday,
    dateFormat,
    setDateFormat,
    autoSetTimezone,
    setAutoSetTimezone,
    timezone,
    setTimezone,
    setOnboardingCompleted,
  } = useAppStore();

  // Handle language change
  const handleLanguageChange = async (langCode: string) => {
    await changeLanguage(langCode);
    setLanguage(langCode);
  };

  // Current language for reactivity (fallback to store value)
  const currentLanguage = i18n.language || language || "en";

  // Get timezone label using i18n
  const getTimezoneLabel = (tz: typeof TIMEZONES[number] | string) => {
    if (typeof tz === "string") {
      const found = TIMEZONES.find((item) => item.value === tz);
      if (found) {
        return t(found.labelKey);
      }
      return tz;
    }
    return t(tz.labelKey);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold font-serif mb-1">
          {t("settings.sections.general")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("settings.generalDescription", { defaultValue: "General application settings" })}
        </p>
      </div>

      {/* Preferences Section */}
      <div className="rounded-xl border bg-card p-4">
        <SectionHeader title={t("settings.sections.preferences")} />

        <div className="py-4 border-b border-border">
          <div className="mb-3">
            <h3 className="text-sm font-medium text-foreground">{t("settings.appearance")}</h3>
            <p className="text-sm text-muted-foreground mt-0.5">{t("settings.appearanceDescription")}</p>
          </div>
          <ThemeSwitcher />
        </div>
      </div>

      {/* Language & Time Section */}
      <div className="rounded-xl border bg-card p-4">
        <SectionHeader title={t("settings.sections.languageAndTime")} />

        <SettingsItem
          title={t("settings.language")}
          description={t("settings.languageDescription")}
        >
          <Select value={currentLanguage} onValueChange={handleLanguageChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue>
                {LANGUAGES.find((l) => l.code === currentLanguage)?.nativeName || currentLanguage}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((lang) => (
                <SelectItem key={lang.code} value={lang.code}>
                  {lang.nativeName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsItem>

        <SettingsItem
          title={t("settings.alwaysShowTextDirection")}
          description={t("settings.alwaysShowTextDirectionDescription")}
        >
          <Switch
            checked={alwaysShowTextDirection}
            onCheckedChange={setAlwaysShowTextDirection}
          />
        </SettingsItem>

        <SettingsItem
          title={t("settings.weekStartsOnMonday")}
          description={t("settings.weekStartsOnMondayDescription")}
        >
          <Switch
            checked={weekStartsOnMonday}
            onCheckedChange={setWeekStartsOnMonday}
          />
        </SettingsItem>

        <SettingsItem
          title={t("settings.dateFormat")}
          description={t("settings.dateFormatDescription")}
        >
          <Select value={dateFormat} onValueChange={(value) => setDateFormat(value as "relative" | "absolute")}>
            <SelectTrigger className="w-[180px]">
              <SelectValue>
                {dateFormat === "relative" ? t("settings.relativeDate") : t("settings.absoluteDate")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="relative">{t("settings.relativeDate")}</SelectItem>
              <SelectItem value="absolute">{t("settings.absoluteDate")}</SelectItem>
            </SelectContent>
          </Select>
        </SettingsItem>

        <SettingsItem
          title={t("settings.autoSetTimezone")}
          description={t("settings.autoSetTimezoneDescription")}
        >
          <Switch
            checked={autoSetTimezone}
            onCheckedChange={setAutoSetTimezone}
          />
        </SettingsItem>

        <SettingsItem
          title={t("settings.timezone")}
          description={t("settings.timezoneDescription")}
        >
          <Select value={timezone} onValueChange={setTimezone}>
            <SelectTrigger className="w-[180px]">
              <SelectValue>{getTimezoneLabel(timezone)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {TIMEZONES.map((tz) => (
                <SelectItem key={tz.value} value={tz.value}>
                  {t(tz.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsItem>
      </div>

      {/* Onboarding Section */}
      <div className="rounded-xl border bg-card p-4">
        <SectionHeader title={t("settings.sections.setup")} />
        <div className="flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-foreground">
                {t("settings.onboarding")}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t("settings.onboardingDescription")}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              setOnboardingCompleted(false);
              navigate("/onboarding");
            }}
          >
            {t("settings.openOnboarding")}
          </Button>
        </div>
      </div>
    </div>
  );
}
