import { useState, useCallback } from "react";
import {
  Check,
  AlertCircle,
  FolderOpen,
  RefreshCw,
  Loader2,
  Copy,
  Settings,
  Palette,
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
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

// Settings section type
type SettingsSection = "general" | "appearance" | "environment" | "storage" | "about";

// Section configuration
interface SectionConfig {
  id: SettingsSection;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
}

const SECTIONS: SectionConfig[] = [
  { id: "general", labelKey: "settings.sections.general", icon: Settings },
  { id: "appearance", labelKey: "settings.sections.appearance", icon: Palette },
  { id: "environment", labelKey: "settings.sections.environment", icon: Terminal },
  { id: "storage", labelKey: "settings.sections.storage", icon: HardDrive },
  { id: "about", labelKey: "settings.sections.about", icon: Info },
];

// Easing curves
const easeOutExpo = [0.16, 1, 0.3, 1] as const;

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
      case "appearance":
        return <AppearanceSection key="appearance" />;
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
 * General Section
 * -------------------------------------------------------------------------- */

function GeneralSection() {
  const { t } = useTranslation();
  const { language, setLanguage } = useAppStore();

  // Handle language change
  const handleLanguageChange = async (langCode: string) => {
    await changeLanguage(langCode);
    setLanguage(langCode);
  };

  // Get current language, falling back to store value or detected value
  const currentLanguage = getCurrentLanguage() || language || "en";

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

      <div className="rounded-xl border bg-card p-4 space-y-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/30">
        <div>
          <label className="text-sm font-medium mb-2 block">{t("settings.language")}</label>
          <select
            value={currentLanguage}
            onChange={(e) => handleLanguageChange(e.target.value)}
            className="w-full rounded-xl border bg-background px-3 py-2 text-sm transition-all duration-200 focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.nativeName} ({lang.name})
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

/* -----------------------------------------------------------------------------
 * Appearance Section
 * -------------------------------------------------------------------------- */

function AppearanceSection() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold font-serif mb-1">
          {t("settings.sections.appearance")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("settings.appearanceDescription", { defaultValue: "Customize the look and feel" })}
        </p>
      </div>

      <div className="rounded-xl border bg-card p-4 space-y-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/30">
        <div>
          <label className="text-sm font-medium mb-2 block">{t("settings.theme")}</label>
          <ThemeSwitcher />
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
            defaultValue="~/Downloads/viben"
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
            B
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

        {/* Viben Status */}
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
            href="https://linxueyuan.online/viben/"
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
            href="https://linxueyuan.online/viben/docs"
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
