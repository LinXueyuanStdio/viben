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
  User,
  Keyboard,
  X,
  Cpu,
  Bot,
  Network,
  MessageSquare,
  Play,
  Bell,
  Volume2,
  VolumeX,
  Moon,
  Users,
  Clock,
  Zap,
  Box,
  Sparkles,
  Bug,
  Code,
  FileText,
  AlertTriangle,
  Type,
} from "lucide-react";
import { VibenLogo } from "@/components/ui/viben-logo";
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
import { syncChannels } from "@/hooks";
import { useAppStore } from "@/stores";
import { getGatewayClient } from "@/lib/gateway";
import { useTranslation } from "react-i18next";
import { LANGUAGES } from "@/i18n/languages";
import { changeLanguage, getCurrentLanguage } from "@/i18n";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { openUrl } from "@tauri-apps/plugin-opener";
import { platform } from "@tauri-apps/plugin-os";
import { useLocation, useNavigate } from "react-router-dom";
import { SettingsModelPage } from "./settings-model";
import { SettingsAgentsPage } from "./settings-agents";
import { SettingsGatewayPage } from "./settings-gateway";
import { SettingsChannelsPage } from "./settings-channels";
import { SettingsExecutorsPage } from "./settings-executors";
import { SettingsSandboxPage } from "./settings-sandbox";
import { TerminalFontsSection } from "@/components/settings/terminal-fonts-section";
import { useNotificationStore } from "@/stores/notification-store";
import { useSystemNotification } from "@/hooks/use-system-notification";
import type { NotificationCategory, NotificationMethod } from "@/types/notification";
import { Input } from "@/components/ui/input";
import * as React from "react";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut, Apple, Rocket, Cat, Boxes, Wrench, SquareTerminal } from "lucide-react";
import Cursor from "@lobehub/icons/es/Cursor";
import Windsurf from "@lobehub/icons/es/Windsurf";

// Settings section type
type SettingsSection = "general" | "account" | "shortcuts" | "notifications" | "gateway" | "channels" | "executors" | "model" | "agents" | "sandbox" | "environment" | "terminalFonts" | "storage" | "developer" | "about";

// Section configuration
interface SectionConfig {
  id: SettingsSection;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
}

const SECTIONS: SectionConfig[] = [
  { id: "general", labelKey: "settings.sections.general", icon: Settings },
  { id: "account", labelKey: "settings.sections.account", icon: User },
  { id: "shortcuts", labelKey: "settings.sections.shortcuts", icon: Keyboard },
  { id: "notifications", labelKey: "settings.sections.notifications", icon: Bell },
  { id: "gateway", labelKey: "settings.sections.gateway", icon: Network },
  { id: "channels", labelKey: "settings.sections.channels", icon: MessageSquare },
  { id: "executors", labelKey: "settings.sections.executors", icon: Play },
  { id: "model", labelKey: "settings.sections.model", icon: Cpu },
  { id: "agents", labelKey: "settings.sections.agents", icon: Bot },
  { id: "sandbox", labelKey: "settings.sections.sandbox", icon: Box },
  { id: "environment", labelKey: "settings.sections.environment", icon: Terminal },
  { id: "terminalFonts", labelKey: "settings.sections.terminalFonts", icon: Type },
  { id: "storage", labelKey: "settings.sections.storage", icon: HardDrive },
  { id: "developer", labelKey: "settings.sections.developer", icon: Bug },
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

// Valid sections for nested routes
const VALID_SECTIONS: SettingsSection[] = ["general", "account", "shortcuts", "notifications", "gateway", "channels", "executors", "model", "agents", "sandbox", "environment", "terminalFonts", "storage", "developer", "about"];

export function SettingsPage() {
  const { t } = useTranslation();
  const prefersReducedMotion = useReducedMotion();
  const location = useLocation();
  const navigate = useNavigate();

  // Get section from URL path (e.g., /settings/agents -> "agents")
  const getSectionFromPath = (): SettingsSection => {
    const pathSection = location.pathname.split("/settings/")[1];
    if (pathSection && VALID_SECTIONS.includes(pathSection as SettingsSection)) {
      return pathSection as SettingsSection;
    }
    return "general";
  };

  const [activeSection, setActiveSection] = useState<SettingsSection>(getSectionFromPath);

  // Sync URL with active section (used in sidebar navigation)
  // Pre-load data when navigating to certain sections
  const handleSectionChange = useCallback((section: SettingsSection) => {
    setActiveSection(section);
    navigate(`/settings/${section}`, { replace: true });

    // Pre-sync channel data when navigating to channels section
    if (section === "channels") {
      syncChannels();
    }
  }, [navigate]);

  // Update active section when URL changes
  useEffect(() => {
    const sectionFromPath = getSectionFromPath();
    if (sectionFromPath !== activeSection) {
      setActiveSection(sectionFromPath);
    }
    // Pre-sync data for specific sections on URL change (deep link support)
    if (sectionFromPath === "channels") {
      syncChannels();
    }
  }, [location.pathname]);

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
      case "account":
        return <AccountSection key="account" />;
      case "shortcuts":
        return <ShortcutsSection key="shortcuts" />;
      case "notifications":
        return <NotificationsSection key="notifications" />;
      case "gateway":
        return <SettingsGatewayPage key="gateway" />;
      case "channels":
        return <SettingsChannelsPage key="channels" />;
      case "executors":
        return <SettingsExecutorsPage key="executors" />;
      case "model":
        return <SettingsModelPage key="model" />;
      case "agents":
        return <SettingsAgentsPage key="agents" />;
      case "sandbox":
        return <SettingsSandboxPage key="sandbox" />;
      case "environment":
        return <EnvironmentSection key="environment" />;
      case "terminalFonts":
        return <TerminalFontsSection key="terminalFonts" />;
      case "storage":
        return <StorageSection key="storage" />;
      case "developer":
        return <DeveloperSection key="developer" />;
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
                  onClick={() => handleSectionChange(section.id)}
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
      <div className={cn(
        "flex-1 overflow-auto",
        // Agents page needs full width, no padding, and no max-width
        activeSection === "agents" ? "" : "p-6"
      )}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSection}
            variants={tabContentVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className={cn(
              // Agents page needs full width and height
              activeSection === "agents" ? "h-full" : "max-w-2xl"
            )}
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

      {/* Onboarding Section */}
      <div className="rounded-xl border bg-card p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/30">
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

/* -----------------------------------------------------------------------------
 * Account Section - with OAuth flow visualization (like onboarding)
 * -------------------------------------------------------------------------- */

type OAuthStatus = "idle" | "waiting" | "timeout" | "success" | "error";

const OAUTH_TIMEOUT_MS = 150000; // 2.5 minutes

// OAuth flow steps for visual feedback
const OAUTH_STEPS = [
  { key: "browser", labelKey: "settings.account.oauth.openBrowser" },
  { key: "authorize", labelKey: "settings.account.oauth.waitingAuth" },
  { key: "callback", labelKey: "settings.account.oauth.completing" },
] as const;

function AccountSection() {
  const { t } = useTranslation();
  const { user, isAuthenticated, logout, loginWithGitHub, handleOAuthCallback, isLoading, error, clearError, setLoading } = useAuth();

  const [oauthStatus, setOauthStatus] = useState<OAuthStatus>("idle");
  const [currentStep, setCurrentStep] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Dev mode: manual OAuth code input
  const isDev = import.meta.env.DEV;
  const [showDevOAuth, setShowDevOAuth] = useState(false);
  const [oauthCode, setOauthCode] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // Clear timers
  const clearTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (stepIntervalRef.current) {
      clearInterval(stepIntervalRef.current);
      stepIntervalRef.current = null;
    }
  }, []);

  // Handle successful auth
  useEffect(() => {
    if (isAuthenticated && oauthStatus === "waiting") {
      clearTimers();
      setOauthStatus("success");
      setCurrentStep(2);
    }
  }, [isAuthenticated, oauthStatus, clearTimers]);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  const startOAuthFlow = async () => {
    clearError();
    setFormError(null);
    setOauthStatus("waiting");
    setCurrentStep(0);

    try {
      await loginWithGitHub();

      if (isDev) {
        setShowDevOAuth(true);
      }

      let step = 0;
      stepIntervalRef.current = setInterval(() => {
        if (step < 1) {
          step++;
          setCurrentStep(step);
        }
      }, 2000);

      timeoutRef.current = setTimeout(() => {
        clearTimers();
        setOauthStatus("timeout");
        setLoading(false);
      }, OAUTH_TIMEOUT_MS);
    } catch {
      setOauthStatus("error");
    }
  };

  const cancelOAuth = () => {
    clearTimers();
    clearError();
    setFormError(null);
    setOauthStatus("idle");
    setShowDevOAuth(false);
    setOauthCode("");
    setLoading(false);
  };

  // Dev mode: handle manual OAuth code submission
  const handleDevOAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oauthCode.trim()) {
      setFormError(t("auth.oauthCodeRequired", "请输入 OAuth 授权码"));
      return;
    }
    try {
      await handleOAuthCallback(oauthCode.trim());
    } catch {
      // Error is handled by the hook
    }
  };

  // Handle external link click using Tauri opener
  const handleExternalLink = async (url: string) => {
    try {
      await openUrl(url);
    } catch (error) {
      console.error("Failed to open URL:", error);
    }
  };

  const displayError = formError || error;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold font-serif mb-1">
          {t("settings.sections.account")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("settings.account.description")}
        </p>
      </div>

      {isAuthenticated && user ? (
        <>
          {/* User Profile Card */}
          <div className="rounded-xl border bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/30">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 ring-2 ring-primary/20">
                <AvatarImage src={user.avatarUrl || undefined} alt={user.displayName || user.username} />
                <AvatarFallback className="text-lg bg-primary/10 text-primary">
                  {(user.displayName || user.username || "U").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h3 className="text-lg font-semibold">{user.displayName || user.username}</h3>
                <p className="text-sm text-muted-foreground">{user.email}</p>
                {user.username && user.displayName && (
                  <p className="text-xs text-muted-foreground">@{user.username}</p>
                )}
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
            </div>
          </div>

          {/* Account Actions */}
          <div className="rounded-xl border bg-card p-4 space-y-3 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/30">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              {t("settings.account.actions")}
            </h3>

            <button
              onClick={() => handleExternalLink("https://viben-web.vercel.app/profile")}
              className="flex items-center justify-between rounded-xl border bg-card p-3 hover:bg-muted hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 w-full"
            >
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{t("settings.account.editProfile")}</span>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </button>

            <button
              onClick={logout}
              disabled={isLoading}
              className="flex items-center justify-between rounded-xl border border-destructive/30 bg-destructive/5 p-3 hover:bg-destructive/10 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 w-full text-destructive"
            >
              <div className="flex items-center gap-3">
                <LogOut className="h-4 w-4" />
                <span className="text-sm">{t("auth.signOut")}</span>
              </div>
            </button>
          </div>
        </>
      ) : (
        /* Not Logged In - OAuth Flow */
        <div className="rounded-xl border bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/30">
          <div className="space-y-6">
            {/* Error display */}
            {displayError && oauthStatus !== "waiting" && (
              <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{displayError}</span>
              </div>
            )}

            {/* Waiting for OAuth */}
            {oauthStatus === "waiting" ? (
              <div className="flex flex-col items-center space-y-6">
                {/* Animated icon */}
                <div className="relative">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-background border-2 border-primary">
                    <ExternalLink className="h-3 w-3 text-primary" />
                  </div>
                </div>

                {/* Progress steps */}
                <div className="w-full max-w-xs">
                  <div className="flex items-center justify-between">
                    {OAUTH_STEPS.map((step, index) => (
                      <React.Fragment key={step.key}>
                        <div className="flex flex-col items-center">
                          <div
                            className={cn(
                              "flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-all duration-300",
                              index < currentStep
                                ? "bg-primary text-primary-foreground"
                                : index === currentStep
                                  ? "bg-primary/20 text-primary ring-2 ring-primary ring-offset-2"
                                  : "bg-muted text-muted-foreground"
                            )}
                          >
                            {index < currentStep ? (
                              <CheckCircle2 className="h-4 w-4" />
                            ) : (
                              index + 1
                            )}
                          </div>
                          <span
                            className={cn(
                              "mt-1 text-xs transition-colors text-center max-w-[70px]",
                              index <= currentStep ? "text-foreground" : "text-muted-foreground"
                            )}
                          >
                            {t(step.labelKey)}
                          </span>
                        </div>

                        {index < OAUTH_STEPS.length - 1 && (
                          <div
                            className={cn(
                              "h-0.5 flex-1 mx-2 transition-colors duration-300",
                              index < currentStep ? "bg-primary" : "bg-muted"
                            )}
                          />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>

                {/* Status text */}
                <div className="text-center">
                  <p className="font-medium">
                    {currentStep === 0 && t("settings.account.oauth.statusOpening")}
                    {currentStep === 1 && t("settings.account.oauth.statusWaiting")}
                    {currentStep === 2 && t("settings.account.oauth.statusCompleting")}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {currentStep === 1 && t("settings.account.oauth.autoReturn")}
                  </p>
                </div>

                {/* Pulse animation indicator */}
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-primary"></span>
                  </span>
                  <span className="text-xs text-muted-foreground">{t("settings.account.oauth.waitingResponse")}</span>
                </div>

                {/* Dev mode: Manual OAuth code input */}
                {isDev && showDevOAuth && (
                  <form onSubmit={handleDevOAuthSubmit} className="w-full space-y-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Terminal className="h-3 w-3" />
                      <span>{t("auth.devModeOAuthHint", "Dev Mode: 从 URL 粘贴 OAuth 授权码")}</span>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder={t("auth.oauthCodePlaceholder", "粘贴 viben://oauth?code=... 中的 code")}
                        value={oauthCode}
                        onChange={(e) => setOauthCode(e.target.value)}
                        disabled={isLoading}
                        className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm"
                      />
                      <Button type="submit" size="sm" disabled={isLoading || !oauthCode.trim()}>
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("common.submit", "提交")}
                      </Button>
                    </div>
                  </form>
                )}

                <Button variant="outline" onClick={cancelOAuth} className="w-full max-w-xs">
                  <X className="mr-2 h-4 w-4" />
                  {t("common.cancel")}
                </Button>
              </div>
            ) : oauthStatus === "timeout" ? (
              /* Timeout */
              <div className="flex flex-col items-center space-y-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10">
                  <AlertCircle className="h-8 w-8 text-amber-500" />
                </div>
                <div className="text-center">
                  <p className="font-medium">{t("settings.account.oauth.timeout")}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{t("settings.account.oauth.timeoutHint")}</p>
                </div>
                <Button onClick={startOAuthFlow} className="w-full max-w-xs">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {t("settings.account.oauth.retry")}
                </Button>
              </div>
            ) : oauthStatus === "error" ? (
              /* Error state */
              <div className="flex flex-col items-center space-y-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                  <AlertCircle className="h-8 w-8 text-destructive" />
                </div>
                <div className="text-center">
                  <p className="font-medium">{t("settings.account.oauth.error")}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{t("settings.account.oauth.errorHint")}</p>
                </div>
                <Button onClick={startOAuthFlow} className="w-full max-w-xs">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {t("settings.account.oauth.retry")}
                </Button>
              </div>
            ) : oauthStatus === "success" ? (
              /* Success state (brief transition) */
              <div className="flex flex-col items-center space-y-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                </div>
                <div className="text-center">
                  <p className="font-medium">{t("settings.account.oauth.success")}</p>
                </div>
              </div>
            ) : (
              /* Idle state - GitHub login */
              <div className="flex flex-col items-center space-y-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <Github className="h-8 w-8" />
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-semibold">{t("settings.account.notLoggedIn")}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("settings.account.loginBenefits")}
                  </p>
                </div>
                <Button
                  onClick={startOAuthFlow}
                  disabled={isLoading}
                  className="w-full max-w-xs"
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Github className="mr-2 h-4 w-4" />
                  )}
                  {t("auth.continueWithGitHub")}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
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
 * Notifications Section
 * -------------------------------------------------------------------------- */

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

function NotificationsSection() {
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
      <div className="rounded-xl border bg-card p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/30">
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
        "rounded-xl border bg-card p-4 transition-all duration-300",
        preferences.enabled
          ? "hover:-translate-y-1 hover:shadow-lg hover:border-primary/30"
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
        "rounded-xl border bg-card p-4 transition-all duration-300",
        preferences.enabled
          ? "hover:-translate-y-1 hover:shadow-lg hover:border-primary/30"
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
        "rounded-xl border bg-card p-4 transition-all duration-300",
        preferences.enabled
          ? "hover:-translate-y-1 hover:shadow-lg hover:border-primary/30"
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


/* -----------------------------------------------------------------------------
 * Environment Section
 * -------------------------------------------------------------------------- */

// CLI Tool configuration for rendering
interface CliToolConfig {
  key: string;
  icon: React.ElementType;
  category: "core" | "ai-assistant";
  installHint?: string;
}

const CLI_TOOLS: CliToolConfig[] = [
  // Core tools
  { key: "python", icon: Code, category: "core" },
  { key: "git", icon: Code, category: "core" },
  { key: "gh", icon: Github, category: "core", installHint: "brew install gh" },
  // AI Assistants
  { key: "claude", icon: Sparkles, category: "ai-assistant", installHint: "npm install -g @anthropic-ai/claude-code" },
  { key: "codex", icon: Zap, category: "ai-assistant", installHint: "npm install -g @openai/codex" },
  { key: "aider", icon: Bot, category: "ai-assistant", installHint: "pip install aider-chat" },
  { key: "goose", icon: Bot, category: "ai-assistant", installHint: "pip install goose-ai" },
  { key: "cline", icon: Terminal, category: "ai-assistant", installHint: "npm install -g cline" },
  { key: "continue", icon: Play, category: "ai-assistant" },
  { key: "cursor", icon: Terminal, category: "ai-assistant" },
];

function EnvironmentSection() {
  const { t } = useTranslation();
  const {
    browseMcpInfo,
    getInstallCommand,
    checkBrowseMcp,
  } = usePython();

  const appStore = useAppStore();
  const {
    setSetupStatus,
    pythonPath, setPythonPath,
    gitPath, setGitPath,
    ghPath, setGhPath,
    claudePath, setClaudePath,
    codexPath, setCodexPath,
    aiderPath, setAiderPath,
    goosePath, setGoosePath,
    clinePath, setClinePath,
    continuePath, setContinuePath,
    cursorPath, setCursorPath,
    cliToolsCache, setCliToolsCache,
  } = appStore;

  // Map tool key to path getter/setter
  const pathMap: Record<string, { value: string; setter: (v: string) => void }> = {
    python: { value: pythonPath, setter: setPythonPath },
    git: { value: gitPath, setter: setGitPath },
    gh: { value: ghPath, setter: setGhPath },
    claude: { value: claudePath, setter: setClaudePath },
    codex: { value: codexPath, setter: setCodexPath },
    aider: { value: aiderPath, setter: setAiderPath },
    goose: { value: goosePath, setter: setGoosePath },
    cline: { value: clinePath, setter: setClinePath },
    continue: { value: continuePath, setter: setContinuePath },
    cursor: { value: cursorPath, setter: setCursorPath },
  };

  const [installCommand, setInstallCommand] = useState<string | null>(null);

  // CLI Tools detection state - initialize from cache if available
  const [cliToolsInfo, setCliToolsInfo] = useState<Record<string, { found: boolean; path?: string; version?: string; source: string; message?: string; alternatives?: Array<{ path: string; version?: string; source: string }> } | null>>(() => {
    // Initialize from cache if available (within 24 hours)
    const cacheAge = Date.now() - (cliToolsCache?.timestamp || 0);
    const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
    if (cliToolsCache?.data && cacheAge < CACHE_TTL) {
      return cliToolsCache.data as unknown as Record<string, { found: boolean; path?: string; version?: string; source: string; message?: string; alternatives?: Array<{ path: string; version?: string; source: string }> } | null>;
    }
    return {};
  });
  const [cliToolsLoading, setCliToolsLoading] = useState(false);
  // Note: setCheckingTool removed - not currently used after removing checkCliToolPath
  const [checkingTool] = useState<string | null>(null);

  // Detect CLI tools and update cache
  const detectCliTools = useCallback(async (forceRefresh = false) => {
    // Skip if we have valid cache and not forcing refresh
    const cacheAge = Date.now() - (cliToolsCache?.timestamp || 0);
    const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
    if (!forceRefresh && cliToolsCache?.data && cacheAge < CACHE_TTL) {
      setCliToolsInfo(cliToolsCache.data as unknown as Record<string, { found: boolean; path?: string; version?: string; source: string; message?: string; alternatives?: Array<{ path: string; version?: string; source: string }> } | null>);
      return;
    }

    setCliToolsLoading(true);
    try {
      const client = getGatewayClient();
      const result = await client.detectCliTools({
        pythonPath: pythonPath || undefined,
        gitPath: gitPath || undefined,
        ghPath: ghPath || undefined,
        claudePath: claudePath || undefined,
        codexPath: codexPath || undefined,
        aiderPath: aiderPath || undefined,
        goosePath: goosePath || undefined,
        clinePath: clinePath || undefined,
        continuePath: continuePath || undefined,
        cursorPath: cursorPath || undefined,
      });
      setCliToolsInfo(result as unknown as Record<string, { found: boolean; path?: string; version?: string; source: string; message?: string; alternatives?: Array<{ path: string; version?: string; source: string }> } | null>);
      // Save to cache
      setCliToolsCache(result);
    } catch (err) {
      console.error("[EnvironmentSection] CLI tools detection error:", err);
    } finally {
      setCliToolsLoading(false);
    }
  }, [pythonPath, gitPath, ghPath, claudePath, codexPath, aiderPath, goosePath, clinePath, continuePath, cursorPath, cliToolsCache, setCliToolsCache]);

  // Auto-detect on mount if no valid cache
  useEffect(() => {
    const cacheAge = Date.now() - (cliToolsCache?.timestamp || 0);
    const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
    if (!cliToolsCache?.data || cacheAge >= CACHE_TTL) {
      detectCliTools(true);
    }
  }, []);

  // Helper to translate source names
  const getSourceLabel = (source: string): string => {
    const sourceLabels: Record<string, string> = {
      "user-config": t("settings.cliTools.sourceUserConfig", { defaultValue: "User Configuration" }),
      homebrew: t("settings.cliTools.sourceHomebrew", { defaultValue: "Homebrew" }),
      nvm: t("settings.cliTools.sourceNvm", { defaultValue: "NVM" }),
      pyenv: t("settings.cliTools.sourcePyenv", { defaultValue: "pyenv" }),
      pip: t("settings.cliTools.sourcePip", { defaultValue: "pip" }),
      npm: t("settings.cliTools.sourceNpm", { defaultValue: "npm" }),
      cargo: t("settings.cliTools.sourceCargo", { defaultValue: "cargo" }),
      "system-path": t("settings.cliTools.sourceSystemPath", { defaultValue: "System PATH" }),
      fallback: t("settings.cliTools.sourceFallback", { defaultValue: "Fallback" }),
    };
    return sourceLabels[source] || source;
  };

  // Update global setup status when Python detection changes
  const updateSetupStatus = useCallback(() => {
    const pythonInfo = cliToolsInfo.python;
    const isSetupComplete = pythonInfo?.found === true && browseMcpInfo?.installed === true;
    setSetupStatus(isSetupComplete);
  }, [cliToolsInfo.python, browseMcpInfo, setSetupStatus]);

  useEffect(() => {
    updateSetupStatus();
  }, [updateSetupStatus]);

  const handleShowInstallCommand = async () => {
    const pythonInfo = cliToolsInfo.python;
    if (pythonInfo?.path) {
      const cmd = await getInstallCommand(pythonInfo.path);
      setInstallCommand(cmd);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // Render a single CLI tool row with dropdown
  const renderToolRow = (config: CliToolConfig, isFirst: boolean) => {
    const info = cliToolsInfo[config.key];
    const { value: customPath, setter: setCustomPath } = pathMap[config.key] || { value: "", setter: () => {} };
    const Icon = config.icon;
    const isChecking = checkingTool === config.key;
    const isFound = info?.found === true;
    const isLoading = cliToolsLoading || isChecking;

    // Get all discovered paths (primary + alternatives)
    // Backend already returns deduplicated alternatives (excluding primary)
    let allPaths = isFound && info?.path ? [
      { path: info.path, version: info.version, source: info.source },
      ...(info.alternatives || [])
    ] : [];

    // If user has a saved custom path, ensure it's in the list (may have been selected in a previous session)
    if (customPath && !allPaths.some(p => p.path === customPath)) {
      // Add the saved path at the beginning so it shows as selected
      allPaths = [
        { path: customPath, version: undefined, source: "user-config" as const },
        ...allPaths
      ];
    }

    // Determine current selection - use customPath if set, otherwise use primary detected path
    const currentValue = customPath || (isFound ? info?.path || "not-installed" : "not-installed");

    // Find the currently selected path info
    const selectedPathInfo = allPaths.find(p => p.path === currentValue);

    const handleValueChange = (value: string) => {
      if (value === "not-installed") {
        // Do nothing, just show the state
      } else {
        // Always save the selected path
        setCustomPath(value);
        // For Python, also check browse-mcp with the new path
        if (config.key === "python") {
          checkBrowseMcp(value).catch((err) => {
            console.error("[EnvironmentSection] browse-mcp check failed:", err);
          });
        }
      }
    };

    return (
      <div key={config.key} className={cn("flex items-center gap-3 py-2", !isFirst && "border-t")}>
        {/* Status indicator */}
        <div className="flex-shrink-0">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : isFound ? (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          ) : (
            <XCircle className="h-4 w-4 text-destructive" />
          )}
        </div>

        {/* Tool name and icon */}
        <div className="flex items-center gap-2 min-w-[120px]">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">
            {t(`settings.cliTools.${config.key}Name`, { defaultValue: config.key.charAt(0).toUpperCase() + config.key.slice(1) })}
          </span>
        </div>

        {/* Dropdown or status */}
        <div className="flex-1">
          <Select value={currentValue} onValueChange={handleValueChange} disabled={isLoading}>
            <SelectTrigger className="h-8 rounded-lg text-xs">
              <SelectValue>
                {isLoading ? (
                  <span className="text-muted-foreground">{t("settings.cliTools.detecting", { defaultValue: "Detecting..." })}</span>
                ) : isFound && selectedPathInfo ? (
                  <span className="text-green-600 truncate max-w-[280px] font-mono text-[11px]">{selectedPathInfo.path}</span>
                ) : (
                  <span className="text-destructive">{t("settings.cliTools.notInstalled", { defaultValue: "Not installed" })}</span>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="max-w-[450px]">
              {/* Show all discovered paths */}
              {allPaths.map((pathInfo, index) => (
                <SelectItem key={pathInfo.path} value={pathInfo.path}>
                  <div className="flex flex-col gap-0.5">
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="h-3 w-3 text-green-600 flex-shrink-0" />
                      <span className="text-xs font-mono truncate max-w-[320px]">{pathInfo.path}</span>
                      {index === 0 && (
                        <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded flex-shrink-0">
                          {t("settings.cliTools.recommended", { defaultValue: "Recommended" })}
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-2 text-[11px] text-muted-foreground ml-5">
                      <span>v{pathInfo.version || "?"}</span>
                      <span>•</span>
                      <span>{getSourceLabel(pathInfo.source)}</span>
                    </span>
                  </div>
                </SelectItem>
              ))}
              {/* Show not installed state */}
              {!isFound && (
                <SelectItem value="not-installed" disabled>
                  <div className="flex items-center gap-2">
                    <XCircle className="h-3 w-3 text-destructive" />
                    <span>{t("settings.cliTools.notInstalled", { defaultValue: "Not installed" })}</span>
                  </div>
                </SelectItem>
              )}
              {/* Show count of discovered paths */}
              {allPaths.length > 1 && (
                <div className="px-2 py-1.5 text-[11px] text-muted-foreground border-t mt-1">
                  {t("settings.cliTools.foundCount", { count: allPaths.length, defaultValue: "{{count}} locations found" })}
                </div>
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Version badge (when found) */}
        {isFound && !isLoading && selectedPathInfo && (
          <span className="flex-shrink-0 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
            v{selectedPathInfo.version || "?"}
          </span>
        )}

        {/* Install hint (when not found) */}
        {!isFound && !isLoading && config.installHint && (
          <Button
            variant="ghost"
            size="sm"
            className="flex-shrink-0 h-7 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => copyToClipboard(config.installHint!)}
          >
            <Copy className="h-3 w-3 mr-1" />
            {config.installHint}
          </Button>
        )}
      </div>
    );
  };

  const coreTools = CLI_TOOLS.filter(t => t.category === "core");
  const aiTools = CLI_TOOLS.filter(t => t.category === "ai-assistant");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold font-serif mb-1">
          {t("settings.sections.environment")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("settings.environmentDescription", { defaultValue: "Command-line tools and environment configuration" })}
        </p>
      </div>

      {/* CLI Tools - Core */}
      <div className="rounded-xl border bg-card p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/30">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold">{t("settings.cliTools.coreTitle", { defaultValue: "Core Tools" })}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("settings.cliTools.coreDescription", { defaultValue: "Python, Git, and GitHub CLI" })}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => detectCliTools(true)} disabled={cliToolsLoading}>
            {cliToolsLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            {t("settings.detect")}
          </Button>
        </div>

        <div className="divide-y">
          {coreTools.map((tool, index) => renderToolRow(tool, index === 0))}
        </div>
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
              <Button size="sm" onClick={handleShowInstallCommand} className="rounded-xl" disabled={!cliToolsInfo.python?.found}>
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

      {/* CLI Tools - AI Assistants */}
      <div className="rounded-xl border bg-card p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/30">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold">{t("settings.cliTools.aiTitle", { defaultValue: "AI Coding Assistants" })}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("settings.cliTools.aiDescription", { defaultValue: "Claude, Codex, Aider, and other AI tools" })}
            </p>
          </div>
          {/* Show count of installed AI tools */}
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
            {aiTools.filter(tool => cliToolsInfo[tool.key]?.found).length}/{aiTools.length} {t("settings.cliTools.installed", { defaultValue: "installed" })}
          </span>
        </div>

        <div className="divide-y">
          {aiTools.map((tool, index) => renderToolRow(tool, index === 0))}
        </div>
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
 * Developer Section
 * -------------------------------------------------------------------------- */

// IDE icon renderer - returns icon component for given IDE key
function getIDEIcon(id: string): React.ReactNode {
  switch (id) {
    case "vscode":
      return <Code className="h-3.5 w-3.5 text-[#007ACC]" />;
    case "cursor":
      return <Cursor size={14} />;
    case "zed":
      return <Zap className="h-3.5 w-3.5 text-[#084CCF]" />;
    case "windsurf":
      return <Windsurf size={14} />;
    case "sublime":
      return <FileText className="h-3.5 w-3.5 text-[#FF9800]" />;
    case "vim":
      return <span className="text-[11px] font-bold text-[#019833]">Vi</span>;
    case "neovim":
      return <span className="text-[11px] font-bold text-[#57A143]">Nv</span>;
    case "emacs":
      return <span className="text-[11px] font-bold text-[#7F5AB6]">Em</span>;
    case "intellij":
      return <Boxes className="h-3.5 w-3.5 text-[#FE315D]" />;
    case "webstorm":
      return <Boxes className="h-3.5 w-3.5 text-[#07C3F2]" />;
    case "pycharm":
      return <Boxes className="h-3.5 w-3.5 text-[#21D789]" />;
    case "xcode":
      return <Wrench className="h-3.5 w-3.5 text-[#147EFB]" />;
    case "custom":
      return <Code className="h-3.5 w-3.5 text-muted-foreground" />;
    default:
      return <Code className="h-3.5 w-3.5" />;
  }
}

const IDE_OPTIONS: Record<string, { name: string }> = {
  vscode: { name: "Visual Studio Code" },
  cursor: { name: "Cursor" },
  zed: { name: "Zed" },
  windsurf: { name: "Windsurf" },
  sublime: { name: "Sublime Text" },
  vim: { name: "Vim" },
  neovim: { name: "Neovim" },
  emacs: { name: "Emacs" },
  intellij: { name: "IntelliJ IDEA" },
  webstorm: { name: "WebStorm" },
  pycharm: { name: "PyCharm" },
  xcode: { name: "Xcode" },
  custom: { name: "Custom..." },
};

// Terminal icon renderer - returns icon component for given terminal key
function getTerminalIcon(id: string): React.ReactNode {
  switch (id) {
    case "system":
      return <Terminal className="h-3.5 w-3.5" />;
    case "iterm2":
      return <span className="text-[11px] font-bold text-[#000000] dark:text-white">iT</span>;
    case "warp":
      return <Rocket className="h-3.5 w-3.5 text-[#01A4FF]" />;
    case "alacritty":
      return <SquareTerminal className="h-3.5 w-3.5 text-[#F46D01]" />;
    case "kitty":
      return <Cat className="h-3.5 w-3.5 text-muted-foreground" />;
    case "hyper":
      return <span className="text-[11px] font-bold">H_</span>;
    case "ghostty":
      return <span className="text-[11px]">👻</span>;
    case "wezterm":
      return <span className="text-[11px] font-bold text-[#4E49EE]">Wz</span>;
    case "terminal":
      return <Apple className="h-3.5 w-3.5" />;
    case "custom":
      return <Terminal className="h-3.5 w-3.5 text-muted-foreground" />;
    default:
      return <Terminal className="h-3.5 w-3.5" />;
  }
}

const TERMINAL_OPTIONS: Record<string, { name: string }> = {
  system: { name: "System Terminal" },
  iterm2: { name: "iTerm2" },
  warp: { name: "Warp" },
  alacritty: { name: "Alacritty" },
  kitty: { name: "Kitty" },
  hyper: { name: "Hyper" },
  ghostty: { name: "Ghostty" },
  wezterm: { name: "WezTerm" },
  terminal: { name: "Terminal.app" },
  custom: { name: "Custom..." },
};

interface DebugInfo {
  os: string;
  osVersion: string;
  arch: string;
  appVersion: string;
  gatewayVersion?: string;
  pythonVersion?: string;
  logsPath: string;
  configPath: string;
}

function DeveloperSection() {
  const { t } = useTranslation();
  const {
    preferredIDE,
    setPreferredIDE,
    preferredTerminal,
    setPreferredTerminal,
    dangerouslySkipPermissions,
    setDangerouslySkipPermissions,
  } = useAppStore();

  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [isLoadingDebug, setIsLoadingDebug] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Load debug info
  const loadDebugInfo = async () => {
    setIsLoadingDebug(true);
    try {
      const osType = platform();
      const info: DebugInfo = {
        os: osType,
        osVersion: "Unknown",
        arch: "Unknown",
        appVersion: "0.1.0",
        logsPath: "~/.viben/logs",
        configPath: "~/.viben",
      };
      setDebugInfo(info);
    } catch (err) {
      console.error("Failed to load debug info:", err);
    } finally {
      setIsLoadingDebug(false);
    }
  };

  // Copy debug info to clipboard
  const handleCopyDebugInfo = async () => {
    if (!debugInfo) {
      await loadDebugInfo();
    }
    const info = debugInfo || {
      os: platform(),
      osVersion: "Unknown",
      arch: "Unknown",
      appVersion: "0.1.0",
      logsPath: "~/.viben/logs",
      configPath: "~/.viben",
    };

    const debugText = `
Viben Debug Info
================
OS: ${info.os}
OS Version: ${info.osVersion}
Architecture: ${info.arch}
App Version: ${info.appVersion}
Logs Path: ${info.logsPath}
Config Path: ${info.configPath}
    `.trim();

    try {
      await navigator.clipboard.writeText(debugText);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      console.error("Failed to copy debug info");
    }
  };

  // Open logs folder
  const handleOpenLogsFolder = async () => {
    try {
      const homeDir = await import("@tauri-apps/api/path").then((m) => m.homeDir());
      const logsPath = `${homeDir}.viben/logs`;
      await openUrl(logsPath);
    } catch (error) {
      console.error("Failed to open logs folder:", error);
    }
  };

  // Open config folder
  const handleOpenConfigFolder = async () => {
    try {
      const homeDir = await import("@tauri-apps/api/path").then((m) => m.homeDir());
      const configPath = `${homeDir}.viben`;
      await openUrl(configPath);
    } catch (error) {
      console.error("Failed to open config folder:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold font-serif mb-1">
          {t("settings.sections.developer")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("settings.developerDescription")}
        </p>
      </div>

      {/* IDE Selection */}
      <div className="rounded-xl border bg-card p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/30">
        <SectionHeader title={t("settings.developer.devtools")} />

        <SettingsItem
          title={t("settings.developer.preferredIDE")}
          description={t("settings.developer.preferredIDEDescription")}
        >
          <Select value={preferredIDE || "vscode"} onValueChange={setPreferredIDE}>
            <SelectTrigger className="w-[200px]">
              <SelectValue>
                <div className="flex items-center gap-2">
                  {getIDEIcon(preferredIDE || "vscode")}
                  <span>{IDE_OPTIONS[preferredIDE || "vscode"]?.name || preferredIDE}</span>
                </div>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(IDE_OPTIONS).map(([id, config]) => (
                <SelectItem key={id} value={id}>
                  <div className="flex items-center gap-2">
                    {getIDEIcon(id)}
                    <span>{config.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsItem>

        <SettingsItem
          title={t("settings.developer.preferredTerminal")}
          description={t("settings.developer.preferredTerminalDescription")}
        >
          <Select value={preferredTerminal || "system"} onValueChange={setPreferredTerminal}>
            <SelectTrigger className="w-[200px]">
              <SelectValue>
                <div className="flex items-center gap-2">
                  {getTerminalIcon(preferredTerminal || "system")}
                  <span>{TERMINAL_OPTIONS[preferredTerminal || "system"]?.name || preferredTerminal}</span>
                </div>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TERMINAL_OPTIONS).map(([id, config]) => (
                <SelectItem key={id} value={id}>
                  <div className="flex items-center gap-2">
                    {getTerminalIcon(id)}
                    <span>{config.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsItem>
      </div>

      {/* YOLO Mode */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/20">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-amber-200">
                {t("settings.developer.yoloMode")}
              </h3>
              <p className="text-xs text-amber-400/80">
                {t("settings.developer.yoloModeDescription")}
              </p>
            </div>
          </div>
          <Switch
            checked={dangerouslySkipPermissions ?? false}
            onCheckedChange={setDangerouslySkipPermissions}
          />
        </div>
        {dangerouslySkipPermissions && (
          <p className="text-xs text-amber-500 font-medium flex items-center gap-1 mt-3">
            <AlertTriangle className="h-3 w-3" />
            {t("settings.developer.yoloModeWarning")}
          </p>
        )}
      </div>

      {/* Debug & Logs */}
      <div className="rounded-xl border bg-card p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/30">
        <SectionHeader title={t("settings.developer.debugLogs")} />

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-3 py-4">
          <Button
            variant="outline"
            onClick={handleOpenLogsFolder}
            className="flex items-center gap-2"
          >
            <FolderOpen className="h-4 w-4" />
            {t("settings.developer.openLogsFolder")}
          </Button>

          <Button
            variant="outline"
            onClick={handleOpenConfigFolder}
            className="flex items-center gap-2"
          >
            <FolderOpen className="h-4 w-4" />
            {t("settings.developer.openConfigFolder")}
          </Button>

          <Button
            variant="outline"
            onClick={handleCopyDebugInfo}
            className="flex items-center gap-2"
            disabled={copySuccess}
          >
            {copySuccess ? (
              <>
                <Check className="h-4 w-4 text-green-500" />
                {t("common.copied")}
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                {t("settings.developer.copyDebugInfo")}
              </>
            )}
          </Button>

          <Button
            variant="outline"
            onClick={loadDebugInfo}
            disabled={isLoadingDebug}
            className="flex items-center gap-2"
          >
            {isLoadingDebug ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {t("settings.developer.loadDebugInfo")}
          </Button>
        </div>

        {/* Debug Info Display */}
        {debugInfo && (
          <div className="space-y-4 pt-4 border-t">
            {/* System Information */}
            <div className="rounded-lg border border-border p-4">
              <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                <Bug className="h-4 w-4" />
                {t("settings.developer.systemInfo")}
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{t("settings.developer.os")}:</span>
                  <span className="font-mono">{debugInfo.os}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{t("settings.developer.osVersion")}:</span>
                  <span className="font-mono">{debugInfo.osVersion}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{t("settings.developer.appVersion")}:</span>
                  <span className="font-mono">{debugInfo.appVersion}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{t("settings.developer.arch")}:</span>
                  <span className="font-mono">{debugInfo.arch}</span>
                </div>
              </div>
            </div>

            {/* Paths */}
            <div className="rounded-lg border border-border p-4">
              <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                {t("settings.developer.paths")}
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">{t("settings.developer.logs")}:</span>
                  <code className="bg-muted/50 px-2 py-0.5 rounded">{debugInfo.logsPath}</code>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">{t("settings.developer.config")}:</span>
                  <code className="bg-muted/50 px-2 py-0.5 rounded">{debugInfo.configPath}</code>
                </div>
              </div>
            </div>

            {/* No Recent Errors */}
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                {t("settings.developer.noRecentErrors")}
              </div>
            </div>
          </div>
        )}

        {/* Help Text */}
        <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-md mt-4">
          <p className="font-medium mb-1">{t("settings.developer.reportingIssues")}</p>
          <p>{t("settings.developer.reportingIssuesDescription")}</p>
        </div>
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
          <VibenLogo size="lg" />
          <div>
            <h3 className="text-lg font-semibold font-serif">{t("about.title")}</h3>
            <p className="text-sm text-muted-foreground">{t("about.version", { version: appVersion })}</p>
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
            <p className="text-xs text-muted-foreground">{t("common.developer")}</p>
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
