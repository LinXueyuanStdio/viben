import { useTranslation } from "react-i18next";
import { useAppStore } from "@/stores";
import { useTheme } from "@/hooks/use-theme";
import { LANGUAGES } from "@/i18n/languages";
import { changeLanguage, getCurrentLanguage } from "@/i18n";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Common timezones with their display names
const TIMEZONES = [
  { value: "Pacific/Honolulu", label: "(GMT-10:00) Honolulu", labelZh: "(GMT-10:00) 檀香山" },
  { value: "America/Anchorage", label: "(GMT-9:00) Alaska", labelZh: "(GMT-9:00) 阿拉斯加" },
  { value: "America/Los_Angeles", label: "(GMT-8:00) Los Angeles", labelZh: "(GMT-8:00) 洛杉矶" },
  { value: "America/Denver", label: "(GMT-7:00) Denver", labelZh: "(GMT-7:00) 丹佛" },
  { value: "America/Chicago", label: "(GMT-6:00) Chicago", labelZh: "(GMT-6:00) 芝加哥" },
  { value: "America/New_York", label: "(GMT-5:00) New York", labelZh: "(GMT-5:00) 纽约" },
  { value: "America/Sao_Paulo", label: "(GMT-3:00) Sao Paulo", labelZh: "(GMT-3:00) 圣保罗" },
  { value: "Atlantic/Azores", label: "(GMT-1:00) Azores", labelZh: "(GMT-1:00) 亚速尔群岛" },
  { value: "Europe/London", label: "(GMT+0:00) London", labelZh: "(GMT+0:00) 伦敦" },
  { value: "Europe/Paris", label: "(GMT+1:00) Paris", labelZh: "(GMT+1:00) 巴黎" },
  { value: "Europe/Berlin", label: "(GMT+1:00) Berlin", labelZh: "(GMT+1:00) 柏林" },
  { value: "Africa/Cairo", label: "(GMT+2:00) Cairo", labelZh: "(GMT+2:00) 开罗" },
  { value: "Europe/Moscow", label: "(GMT+3:00) Moscow", labelZh: "(GMT+3:00) 莫斯科" },
  { value: "Asia/Dubai", label: "(GMT+4:00) Dubai", labelZh: "(GMT+4:00) 迪拜" },
  { value: "Asia/Karachi", label: "(GMT+5:00) Karachi", labelZh: "(GMT+5:00) 卡拉奇" },
  { value: "Asia/Kolkata", label: "(GMT+5:30) Mumbai", labelZh: "(GMT+5:30) 孟买" },
  { value: "Asia/Dhaka", label: "(GMT+6:00) Dhaka", labelZh: "(GMT+6:00) 达卡" },
  { value: "Asia/Bangkok", label: "(GMT+7:00) Bangkok", labelZh: "(GMT+7:00) 曼谷" },
  { value: "Asia/Shanghai", label: "(GMT+8:00) Shanghai", labelZh: "(GMT+8:00) 上海" },
  { value: "Asia/Hong_Kong", label: "(GMT+8:00) Hong Kong", labelZh: "(GMT+8:00) 香港" },
  { value: "Asia/Singapore", label: "(GMT+8:00) Singapore", labelZh: "(GMT+8:00) 新加坡" },
  { value: "Asia/Tokyo", label: "(GMT+9:00) Tokyo", labelZh: "(GMT+9:00) 东京" },
  { value: "Asia/Seoul", label: "(GMT+9:00) Seoul", labelZh: "(GMT+9:00) 首尔" },
  { value: "Australia/Sydney", label: "(GMT+10:00) Sydney", labelZh: "(GMT+10:00) 悉尼" },
  { value: "Pacific/Auckland", label: "(GMT+12:00) Auckland", labelZh: "(GMT+12:00) 奥克兰" },
];

// Settings item component with title, description, and control
interface SettingsItemProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

function SettingsItem({ title, description, children }: SettingsItemProps) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-border last:border-b-0">
      <div className="flex-1 pr-4">
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

// Section header component
interface SectionHeaderProps {
  title: string;
}

function SectionHeader({ title }: SectionHeaderProps) {
  return (
    <h2 className="text-base font-semibold text-foreground mt-8 mb-2 first:mt-0">
      {title}
    </h2>
  );
}

export function SettingsPage() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
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
  } = useAppStore();

  // Handle language change
  const handleLanguageChange = async (langCode: string) => {
    await changeLanguage(langCode);
    setLanguage(langCode);
  };

  // Get current language, falling back to store value or detected value
  const currentLanguage = getCurrentLanguage() || language || "en";
  const isZhCN = currentLanguage === "zh-CN";

  // Get theme display value
  const getThemeDisplayValue = () => {
    switch (theme) {
      case "light":
        return t("settings.light");
      case "dark":
        return t("settings.dark");
      case "system":
      default:
        return t("settings.useSystemSettings");
    }
  };

  // Get timezone label
  const getTimezoneLabel = (tz: string) => {
    const found = TIMEZONES.find((t) => t.value === tz);
    if (found) {
      return isZhCN ? found.labelZh : found.label;
    }
    // Fallback for timezones not in our list
    return tz;
  };

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-2xl mx-auto p-6">
        {/* Preferences Section */}
        <SectionHeader title={t("settings.sections.preferences")} />

        <SettingsItem
          title={t("settings.appearance")}
          description={t("settings.appearanceDescription")}
        >
          <Select value={theme} onValueChange={(value) => setTheme(value as "light" | "dark" | "system")}>
            <SelectTrigger className="w-[180px]">
              <SelectValue>{getThemeDisplayValue()}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="system">{t("settings.useSystemSettings")}</SelectItem>
              <SelectItem value="light">{t("settings.light")}</SelectItem>
              <SelectItem value="dark">{t("settings.dark")}</SelectItem>
            </SelectContent>
          </Select>
        </SettingsItem>

        {/* Language & Time Section */}
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
                  {isZhCN ? tz.labelZh : tz.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsItem>
      </div>
    </div>
  );
}
