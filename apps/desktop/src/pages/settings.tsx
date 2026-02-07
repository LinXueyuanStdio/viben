import { useState, useCallback, useRef, useEffect } from "react";
import {
  Check,
  AlertCircle,
  FolderOpen,
  RefreshCw,
  Loader2,
  Copy,
  Settings,
  Terminal,
  HardDrive,
  Info,
  ExternalLink,
  Github,
  CheckCircle2,
  XCircle,
  Home,
  Book,
  Bug,
  User,
  Keyboard,
  X,
  Cpu,
  Server,
  Bot,
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
import { ThemeSwitcher } from "@/components/settings/theme-switcher";
import { CacheManager } from "@/components/offline/cache-manager";
import { usePython } from "@/hooks/use-python";
import { useAppStore } from "@/stores";
import { useTranslation } from "react-i18next";
import { LANGUAGES } from "@/i18n/languages";
import { changeLanguage, getCurrentLanguage } from "@/i18n";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { openUrl } from "@tauri-apps/plugin-opener";
import { platform } from "@tauri-apps/plugin-os";
import { SettingsModelsPage } from "./settings-models";
import { SettingsProvidersPage } from "./settings-providers";
import { SettingsAgentsPage } from "./settings-agents";

// Settings section type
type SettingsSection = "general" | "shortcuts" | "providers" | "models" | "agents" | "environment" | "storage" | "about";

// Section configuration
interface SectionConfig {
  id: SettingsSection;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
}

const SECTIONS: SectionConfig[] = [
  { id: "general", labelKey: "settings.sections.general", icon: Settings },
  { id: "shortcuts", labelKey: "settings.sections.shortcuts", icon: Keyboard },
  { id: "providers", labelKey: "settings.sections.providers", icon: Server },
  { id: "models", labelKey: "settings.sections.models", icon: Cpu },
  { id: "agents", labelKey: "settings.sections.agents", icon: Bot },
  { id: "environment", labelKey: "settings.sections.environment", icon: Terminal },
  { id: "storage", labelKey: "settings.sections.storage", icon: HardDrive },
  { id: "about", labelKey: "settings.sections.about", icon: Info },
];

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

// Easing curves
const easeOutExpo = [0.16, 1, 0.3, 1] as const;

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

// Section header component for General tab
interface SectionHeaderProps {
  title: string;
}

function SectionHeader({ title }: SectionHeaderProps) {
  return (
    <h3 className="text-base font-semibold text-foreground mt-6 mb-2 first:mt-0">
      {title}
    </h3>
  );
}

export function SettingsPage() {
  const { t } = useTranslation();
  const prefersReducedMotion = useReducedMotion();
  const [activeSection, setActiveSection] = useState<SettingsSection>("general");

  // Animation variants for content transitions
  const tabContentVariants = {
    initial: {
      opacity: 0,
      x: prefersReducedMotion ? 0 : 20,
    },
    animate: {
      opacity: 1,
      x: 0,
      transition: {
        duration: prefersReducedMotion ? 0 : 0.3,
        ease: easeOutExpo,
      },
    },
    exit: {
      opacity: 0,
      x: prefersReducedMotion ? 0 : -20,
      transition: {
        duration: prefersReducedMotion ? 0 : 0.2,
      },
    },
  };

  // Container animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: prefersReducedMotion ? 0 : 0.05,
        delayChildren: prefersReducedMotion ? 0 : 0.05,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: prefersReducedMotion ? 0 : 12 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: prefersReducedMotion ? 0 : 0.3,
        ease: easeOutExpo,
      },
    },
  };

  // Render section content
  const renderSectionContent = () => {
    switch (activeSection) {
      case "general":
        return <GeneralSection key="general" />;
      case "shortcuts":
        return <ShortcutsSection key="shortcuts" />;
      case "providers":
        return <SettingsProvidersPage key="providers" />;
      case "models":
        return <SettingsModelsPage key="models" />;
      case "agents":
        return <SettingsAgentsPage key="agents" />;
      case "environment":
        return <EnvironmentSection key="environment" />;
      case "storage":
        return <StorageSection key="storage" />;
      case "about":
        return <AboutSection key="about" />;
      default:
        return null;
    }
  };

  return (
    <motion.div
      className="h-full flex flex-col md:flex-row"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Left Navigation Sidebar */}
      <motion.nav
        className="w-full md:w-56 shrink-0 border-b md:border-b-0 md:border-r bg-muted/30 p-4"
        variants={itemVariants}
      >
        <h1 className="text-lg font-semibold font-serif mb-4 px-2">
          {t("settings.title")}
        </h1>
        <ul className="space-y-1">
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;

            return (
              <li key={section.id}>
                <button
                  onClick={() => setActiveSection(section.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm",
                    "transition-all duration-200",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    isActive
                      ? [
                          "bg-primary text-primary-foreground font-medium",
                          "shadow-sm",
                        ]
                      : [
                          "text-muted-foreground",
                          "hover:bg-muted hover:text-foreground",
                        ]
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      "transition-transform duration-200",
                      isActive && "scale-110"
                    )}
                  />
                  <span>{t(section.labelKey)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </motion.nav>

      {/* Right Content Area */}
      <div className="flex-1 overflow-auto p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSection}
            variants={tabContentVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="max-w-2xl"
          >
            {renderSectionContent()}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/* -----------------------------------------------------------------------------
 * General Section - with Preferences and Language & Time settings
 * -------------------------------------------------------------------------- */

function GeneralSection() {
  const { t } = useTranslation();
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

  // Get timezone label
  const getTimezoneLabel = (tz: string) => {
    const found = TIMEZONES.find((t) => t.value === tz);
    if (found) {
      return isZhCN ? found.labelZh : found.label;
    }
    return tz;
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
      <div className="rounded-xl border bg-card p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/30">
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
      <div className="rounded-xl border bg-card p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/30">
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

/* -----------------------------------------------------------------------------
 * Shortcuts Section
 * -------------------------------------------------------------------------- */

// Platform detection using Tauri OS plugin
function usePlatform(): string {
  // platform() is synchronous and returns the compile-time platform value
  try {
    return platform();
  } catch {
    // Fallback to macos if detection fails (e.g., in dev mode without Tauri)
    return "macos";
  }
}

// Format shortcut string for display (convert to platform symbols)
function formatShortcutForPlatform(shortcut: string, currentPlatform: string): string {
  if (!shortcut) return "";

  const isMac = currentPlatform === "macos";

  if (isMac) {
    return shortcut
      .replace(/Ctrl\+/gi, "⌃")
      .replace(/Alt\+/gi, "⌥")
      .replace(/Shift\+/gi, "⇧")
      .replace(/Cmd\+/gi, "⌘")
      .replace(/Meta\+/gi, "⌘")
      .replace(/Enter/gi, "↵");
  } else {
    // Windows/Linux: Show Ctrl instead of Cmd, Win instead of Meta
    return shortcut
      .replace(/Meta\+/gi, "Win+")
      .replace(/Cmd\+/gi, "Ctrl+");
  }
}

// Parse keyboard event to shortcut string
function keyEventToShortcutForPlatform(e: KeyboardEvent, currentPlatform: string): string {
  const parts: string[] = [];
  const isMac = currentPlatform === "macos";

  if (e.ctrlKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  if (e.metaKey) parts.push(isMac ? "Cmd" : "Meta");

  // Get the key, excluding modifier keys themselves
  const key = e.key;
  if (!["Control", "Alt", "Shift", "Meta"].includes(key)) {
    // Normalize key names
    if (key === " ") {
      parts.push("Space");
    } else if (key.length === 1) {
      parts.push(key.toUpperCase());
    } else {
      parts.push(key);
    }
  }

  return parts.join("+");
}

// Shortcut Recorder Component
interface ShortcutRecorderProps {
  value: string;
  onChange: (shortcut: string) => void;
  onClear: () => void;
  currentPlatform: string;
}

function ShortcutRecorder({ value, onChange, onClear, currentPlatform }: ShortcutRecorderProps) {
  const { t } = useTranslation();
  const [isRecording, setIsRecording] = useState(false);
  const inputRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isRecording) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Escape to cancel recording
      if (e.key === "Escape") {
        setIsRecording(false);
        return;
      }

      // Only record if there's at least one modifier or a valid single key
      const shortcut = keyEventToShortcutForPlatform(e, currentPlatform);
      if (shortcut && !["Ctrl", "Alt", "Shift", "Cmd", "Meta"].includes(shortcut)) {
        onChange(shortcut);
        setIsRecording(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isRecording, onChange, currentPlatform]);

  return (
    <div className="flex items-center gap-2">
      <button
        ref={inputRef}
        onClick={() => setIsRecording(true)}
        onBlur={() => setIsRecording(false)}
        className={cn(
          "min-w-[120px] px-3 py-1.5 rounded-lg border text-sm font-mono",
          "transition-all duration-200",
          "focus:outline-none focus:ring-2 focus:ring-primary/20",
          isRecording
            ? "border-primary bg-primary/5 text-primary"
            : value
              ? "border-border bg-muted text-foreground"
              : "border-border bg-background text-muted-foreground"
        )}
      >
        {isRecording ? t("settings.pressKeys") : value ? formatShortcutForPlatform(value, currentPlatform) : "—"}
      </button>
      {value && !isRecording && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={onClear}
          title={t("settings.clearShortcut")}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

function ShortcutsSection() {
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

      {/* Shortcut Items */}
      <div className="rounded-xl border bg-card p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/30">
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

        {/* Reset to Defaults Button */}
        <div className="pt-4">
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
    </div>
  );
}


/* -----------------------------------------------------------------------------
 * Environment Section
 * -------------------------------------------------------------------------- */

function EnvironmentSection() {
  const { t } = useTranslation();
  const {
    pythons,
    selectedPython,
    setSelectedPython,
    browseMcpInfo,
    loading,
    error,
    detectPython,
    checkPythonPath,
    getInstallCommand,
  } = usePython();

  const { setSetupStatus } = useAppStore();

  const [customPath, setCustomPath] = useState("");
  const [checkingCustom, setCheckingCustom] = useState(false);
  const [installCommand, setInstallCommand] = useState<string | null>(null);

  // Update global setup status when Python or browse-mcp status changes
  const updateSetupStatus = useCallback(() => {
    const isSetupComplete = (selectedPython?.is_valid === true) && (browseMcpInfo?.installed === true);
    setSetupStatus(isSetupComplete);
  }, [selectedPython, browseMcpInfo, setSetupStatus]);

  // Handle detect button click
  const handleDetect = async () => {
    await detectPython();
    setTimeout(updateSetupStatus, 500);
  };

  // Handle Python selection
  const handleSelectPython = (python: typeof selectedPython) => {
    setSelectedPython(python);
    setTimeout(updateSetupStatus, 100);
  };

  const handleCustomPathCheck = async () => {
    if (!customPath) return;
    setCheckingCustom(true);
    try {
      const info = await checkPythonPath(customPath);
      if (info.is_valid) {
        setSelectedPython(info);
        setTimeout(updateSetupStatus, 100);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCheckingCustom(false);
    }
  };

  const handleShowInstallCommand = async () => {
    if (selectedPython?.path) {
      const cmd = await getInstallCommand(selectedPython.path);
      setInstallCommand(cmd);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold font-serif mb-1">
          {t("settings.sections.environment")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("settings.environmentDescription", { defaultValue: "Python and package configuration" })}
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Python Environment */}
      <div className="rounded-xl border bg-card p-4 space-y-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/30">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{t("settings.pythonEnvironment")}</h3>
          <Button variant="outline" size="sm" onClick={handleDetect} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            {t("settings.detect")}
          </Button>
        </div>

        {/* Detected Python versions */}
        {pythons.length > 0 && (
          <div>
            <label className="text-sm font-medium mb-2 block">
              {t("settings.detectedInstallations")}
            </label>
            <div className="space-y-2">
              {pythons.map((python) => (
                <button
                  key={python.path}
                  onClick={() => handleSelectPython(python)}
                  className={`w-full text-left p-3 rounded-xl border transition-all duration-200 ${
                    selectedPython?.path === python.path
                      ? "border-primary bg-primary/5"
                      : "border-transparent bg-muted/50 hover:bg-muted hover:-translate-y-0.5"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {python.is_valid ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-yellow-600" />
                      )}
                      <span className="font-medium">
                        {python.version
                          ? t("settings.pythonVersion", { version: python.version })
                          : t("settings.pythonUnknown")}
                      </span>
                    </div>
                    {!python.is_valid && (
                      <span className="text-xs text-yellow-600">
                        {t("settings.requires310")}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 font-mono truncate">
                    {python.path}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Custom Python Path */}
        <div>
          <label className="text-sm font-medium mb-2 block">
            {t("settings.customPythonPath")}
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={customPath}
              onChange={(e) => setCustomPath(e.target.value)}
              className="flex-1 rounded-xl border bg-background px-3 py-2 text-sm transition-all duration-200 focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder={t("settings.customPathPlaceholder")}
            />
            <Button
              variant="outline"
              size="icon"
              onClick={handleCustomPathCheck}
              disabled={checkingCustom || !customPath}
              className="rounded-xl"
            >
              {checkingCustom ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Selected Python Status */}
        {selectedPython && (
          <div className="pt-4 border-t">
            <div className="flex items-center gap-2 text-sm">
              <Check className="h-4 w-4 text-green-600" />
              <span>
                {t("settings.usingPython", { version: selectedPython.version })}{" "}
                <code className="bg-muted px-1 py-0.5 rounded text-xs">
                  {selectedPython.path}
                </code>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* browse-mcp Package */}
      <div className="rounded-xl border bg-card p-4 space-y-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/30">
        <h3 className="text-sm font-semibold">{t("settings.browseMcpPackage")}</h3>

        {browseMcpInfo?.installed ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <Check className="h-4 w-4 text-green-600" />
              <span>{t("settings.installedVersion", { version: browseMcpInfo.version })}</span>
            </div>
            <Button variant="outline" size="sm" className="rounded-xl">
              {t("common.update")}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span>{t("common.notInstalled")}</span>
            </div>

            {!installCommand ? (
              <Button size="sm" onClick={handleShowInstallCommand} className="rounded-xl">
                {t("settings.showInstallCommand")}
              </Button>
            ) : (
              <div className="bg-muted rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-muted-foreground">
                    {t("settings.runToInstall")}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(installCommand)}
                    className="rounded-xl"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <code className="text-sm bg-background rounded-lg px-2 py-1 block">
                  {installCommand}
                </code>
                <p className="text-xs text-muted-foreground mt-2">
                  {t("settings.orUsingUv")}<code>{t("settings.uvCommand")}</code>
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* -----------------------------------------------------------------------------
 * Storage Section
 * -------------------------------------------------------------------------- */

function StorageSection() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold font-serif mb-1">
          {t("settings.sections.storage")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("settings.storageDescription", { defaultValue: "Manage downloads and cache" })}
        </p>
      </div>

      {/* Download Path */}
      <div className="rounded-xl border bg-card p-4 space-y-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/30">
        <h3 className="text-sm font-semibold">{t("settings.downloadPath")}</h3>
        <div className="flex gap-2">
          <input
            type="text"
            defaultValue="~/Downloads/browse-mcp"
            className="flex-1 rounded-xl border bg-background px-3 py-2 text-sm transition-all duration-200 focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
          <Button variant="outline" size="icon" className="rounded-xl">
            <FolderOpen className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Offline Cache */}
      <div className="rounded-xl border bg-card p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/30">
        <h3 className="text-sm font-semibold mb-4">{t("settings.offlineCache")}</h3>
        <CacheManager />
      </div>
    </div>
  );
}

/* -----------------------------------------------------------------------------
 * About Section
 * -------------------------------------------------------------------------- */

function AboutSection() {
  const { t } = useTranslation();
  const appVersion = "0.1.0";
  const updateAvailable = false;
  const { selectedPython, browseMcpInfo } = usePython();
  const { setupBannerDismissed, setSetupBannerDismissed } = useAppStore();

  // Setup status
  const pythonValid = selectedPython?.is_valid ?? false;
  const mcpInstalled = browseMcpInfo?.installed ?? false;
  const isSetupComplete = pythonValid && mcpInstalled;

  // Handle external link click using Tauri opener
  const handleExternalLink = async (url: string) => {
    try {
      await openUrl(url);
    } catch (error) {
      console.error("Failed to open URL:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold font-serif mb-1">
          {t("settings.sections.about")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("settings.aboutDescription", { defaultValue: "App information and updates" })}
        </p>
      </div>

      {/* App Info */}
      <div className="rounded-xl border bg-card p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/30">
        <div className="flex items-center gap-4 mb-4">
          <div className="h-14 w-14 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold">
            V
          </div>
          <div>
            <h3 className="text-lg font-semibold font-serif">{t("about.title")}</h3>
            <p className="text-sm text-muted-foreground">{t("about.version", { version: appVersion })}</p>
          </div>
        </div>
      </div>

      {/* System Status */}
      <div className="rounded-xl border bg-card p-4 space-y-3 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/30">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {t("about.systemStatus", { defaultValue: "System Status" })}
        </h3>

        {/* Python Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {pythonValid ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <XCircle className="h-4 w-4 text-red-600" />
            )}
            <span className="text-sm">Python 3.10+</span>
          </div>
          <span className="text-xs text-muted-foreground">
            {pythonValid ? selectedPython?.version || "Detected" : "Not found"}
          </span>
        </div>

        {/* Browse MCP Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {mcpInstalled ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <XCircle className="h-4 w-4 text-red-600" />
            )}
            <span className="text-sm">browse-mcp package</span>
          </div>
          <span className="text-xs text-muted-foreground">
            {mcpInstalled ? browseMcpInfo?.version || "Installed" : "Not installed"}
          </span>
        </div>

        {/* Overall Status */}
        <div className="pt-2 border-t">
          <div className="flex items-center gap-2">
            {isSetupComplete ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">
                  {t("about.systemReady", { defaultValue: "System ready" })}
                </span>
              </>
            ) : (
              <>
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <span className="text-sm font-medium">
                  {t("about.setupRequired", { defaultValue: "Setup required" })}
                </span>
                {setupBannerDismissed && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto text-xs h-6"
                    onClick={() => setSetupBannerDismissed(false)}
                  >
                    {t("about.showBanner", { defaultValue: "Show banner" })}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Updates */}
      <div className="rounded-xl border bg-card p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/30">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          {t("about.updates", { defaultValue: "Updates" })}
        </h3>
        {updateAvailable ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{t("about.updateAvailable")}</p>
              <p className="text-sm text-muted-foreground">
                {t("about.versionReady", { version: "0.2.0" })}
              </p>
            </div>
            <Button size="sm">{t("about.updateNow")}</Button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {t("about.upToDate")}
            </p>
            <Button variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              {t("about.checkForUpdates")}
            </Button>
          </div>
        )}
      </div>

      {/* Links */}
      <div className="rounded-xl border bg-card p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/30">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          {t("about.links")}
        </h3>
        <div className="space-y-2">
          <LinkButton
            icon={Home}
            label={t("about.homepage")}
            href="https://viben.linxueyuan.online/"
            onClick={handleExternalLink}
          />
          <LinkButton
            icon={Github}
            label={t("about.githubRepo")}
            href="https://github.com/LinXueyuanStdio/viben"
            onClick={handleExternalLink}
          />
          <LinkButton
            icon={Book}
            label={t("about.documentation")}
            href="https://viben.linxueyuan.online/docs"
            onClick={handleExternalLink}
          />
          <LinkButton
            icon={Bug}
            label={t("about.reportIssue")}
            href="https://github.com/LinXueyuanStdio/viben/issues"
            onClick={handleExternalLink}
          />
        </div>
      </div>

      {/* Author */}
      <div className="rounded-xl border bg-card p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/30">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          {t("about.author")}
        </h3>
        <div className="flex items-center gap-3 mb-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-medium">{t("about.authorName")}</p>
            <p className="text-xs text-muted-foreground">Developer</p>
          </div>
        </div>
        <div className="space-y-2">
          <button
            onClick={() => handleExternalLink("https://github.com/LinXueyuanStdio")}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
          >
            <Github className="h-4 w-4" />
            <span>{t("about.authorGithub")}</span>
            <ExternalLink className="h-3 w-3 ml-auto" />
          </button>
          <button
            onClick={() => handleExternalLink("https://linxueyuan.online")}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
          >
            <Home className="h-4 w-4" />
            <span>{t("about.authorHomepage")}</span>
            <ExternalLink className="h-3 w-3 ml-auto" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* -----------------------------------------------------------------------------
 * Link Button Component
 * -------------------------------------------------------------------------- */

interface LinkButtonProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
  onClick: (url: string) => void;
}

function LinkButton({ icon: Icon, label, href, onClick }: LinkButtonProps) {
  return (
    <button
      onClick={() => onClick(href)}
      className="flex items-center justify-between rounded-xl border bg-card p-3 hover:bg-muted hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 w-full"
    >
      <div className="flex items-center gap-3">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm">{label}</span>
      </div>
      <ExternalLink className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}
