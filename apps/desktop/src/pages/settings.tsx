import { Check, AlertCircle, FolderOpen, RefreshCw, Loader2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeSwitcher } from "@/components/settings/theme-switcher";
import { CacheManager } from "@/components/offline/cache-manager";
import { usePython } from "@/hooks/use-python";
import { useAppStore } from "@/stores";
import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { LANGUAGES } from "@/i18n/languages";
import { changeLanguage, getCurrentLanguage } from "@/i18n";
import { motion } from "framer-motion";

// Animation variants for staggered entrance
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: [0.16, 1, 0.3, 1] as [number, number, number, number], // ease-out-expo
    },
  },
};

export function SettingsPage() {
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

  const { setSetupStatus, language, setLanguage } = useAppStore();

  // Update global setup status when Python or browse-mcp status changes
  const updateSetupStatus = useCallback(() => {
    const isSetupComplete = (selectedPython?.is_valid === true) && (browseMcpInfo?.installed === true);
    setSetupStatus(isSetupComplete);
  }, [selectedPython, browseMcpInfo, setSetupStatus]);

  // Handle detect button click
  const handleDetect = async () => {
    await detectPython();
    // Update setup status after detection completes
    // Note: browseMcpInfo will be updated by usePython hook after detection
    setTimeout(updateSetupStatus, 500); // Small delay to ensure state is updated
  };

  // Handle Python selection
  const handleSelectPython = (python: typeof selectedPython) => {
    setSelectedPython(python);
    // Update setup status after selection
    setTimeout(updateSetupStatus, 100);
  };

  // Handle language change
  const handleLanguageChange = async (langCode: string) => {
    await changeLanguage(langCode);
    setLanguage(langCode);
  };

  const [customPath, setCustomPath] = useState("");
  const [checkingCustom, setCheckingCustom] = useState(false);
  const [installCommand, setInstallCommand] = useState<string | null>(null);

  const handleCustomPathCheck = async () => {
    if (!customPath) return;
    setCheckingCustom(true);
    try {
      const info = await checkPythonPath(customPath);
      if (info.is_valid) {
        setSelectedPython(info);
        // Update setup status after custom path check
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

  // Get current language, falling back to store value or detected value
  const currentLanguage = getCurrentLanguage() || language || "en";

  return (
    <motion.div
      className="p-6 max-w-2xl"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.h1 className="text-2xl font-bold mb-6" variants={itemVariants}>
        {t("settings.title")}
      </motion.h1>

      {error && (
        <motion.div
          className="mb-4 p-4 rounded-xl bg-destructive/10 text-destructive text-sm"
          variants={itemVariants}
        >
          {error}
        </motion.div>
      )}

      {/* Python Environment */}
      <motion.section className="mb-8" variants={itemVariants}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{t("settings.pythonEnvironment")}</h2>
          <Button variant="outline" size="sm" onClick={handleDetect} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            {t("settings.detect")}
          </Button>
        </div>

        <div className="rounded-xl border bg-card p-4 space-y-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/30">
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

          {/* browse-mcp Package */}
          <div className="pt-4 border-t">
            <label className="text-sm font-medium mb-2 block">
              {t("settings.browseMcpPackage")}
            </label>
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
      </motion.section>

      {/* Appearance */}
      <motion.section className="mb-8" variants={itemVariants}>
        <h2 className="text-lg font-semibold mb-4">{t("settings.appearance")}</h2>
        <div className="rounded-xl border bg-card p-4 space-y-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/30">
          <div>
            <label className="text-sm font-medium mb-2 block">{t("settings.theme")}</label>
            <ThemeSwitcher />
          </div>

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
      </motion.section>

      {/* Storage */}
      <motion.section className="mb-8" variants={itemVariants}>
        <h2 className="text-lg font-semibold mb-4">{t("settings.storage")}</h2>
        <div className="rounded-xl border bg-card p-4 space-y-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/30">
          <div>
            <label className="text-sm font-medium mb-2 block">
              {t("settings.downloadPath")}
            </label>
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
        </div>
      </motion.section>

      {/* Offline Cache */}
      <motion.section className="mb-8" variants={itemVariants}>
        <h2 className="text-lg font-semibold mb-4">{t("settings.offlineCache")}</h2>
        <div className="rounded-xl border bg-card p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/30">
          <CacheManager />
        </div>
      </motion.section>
    </motion.div>
  );
}
