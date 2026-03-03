import { ExternalLink, Github, RefreshCw, CheckCircle2, XCircle, AlertCircle, Home, Book, Bug, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { usePython } from "@/hooks/use-python";
import { useAppStore } from "@/stores";
import { motion, useReducedMotion } from "framer-motion";
import { openUrl } from "@tauri-apps/plugin-opener";
import { VibenLogo } from "@/components/ui/viben-logo";

export function AboutPage() {
  const { t } = useTranslation();
  const appVersion = "0.1.0";
  const updateAvailable = false;
  const { selectedPython, browseMcpInfo } = usePython();
  const { setupBannerDismissed, setSetupBannerDismissed } = useAppStore();
  const prefersReducedMotion = useReducedMotion();

  // Animation variants for staggered entrance
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: prefersReducedMotion ? 0 : 0.1,
        delayChildren: prefersReducedMotion ? 0 : 0.05,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: prefersReducedMotion ? 0 : 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: prefersReducedMotion ? 0 : 0.3,
        ease: [0.16, 1, 0.3, 1] as [number, number, number, number], // ease-out-expo
      },
    },
  };

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
    <motion.div
      className="p-6 max-w-lg"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div className="text-center mb-8" variants={itemVariants}>
        <div className="flex justify-center mb-4">
          <VibenLogo size="xl" />
        </div>
        <h1 className="text-2xl font-bold">{t("about.title")}</h1>
        <p className="text-muted-foreground">{t("about.version", { version: appVersion })}</p>
      </motion.div>

      {/* System Status */}
      <motion.section className="mb-6" variants={itemVariants}>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">
          {t("about.systemStatus")}
        </h2>
        <div className="rounded-xl border bg-card p-4 space-y-3 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/30">
          {/* Python Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {pythonValid ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600" />
              )}
              <span className="text-sm">{t("about.python310", "Python 3.10+")}</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {pythonValid ? selectedPython?.version || t("about.detected", "Detected") : t("about.notFound", "Not found")}
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
              <span className="text-sm">{t("about.browseMcpPackage", "browse-mcp package")}</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {mcpInstalled ? browseMcpInfo?.version || t("common.installed") : t("common.notInstalled")}
            </span>
          </div>

          {/* Overall Status */}
          <div className="pt-2 border-t">
            <div className="flex items-center gap-2">
              {isSetupComplete ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium">{t("about.systemReady")}</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm font-medium">{t("about.setupRequired")}</span>
                  {setupBannerDismissed && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto text-xs h-6"
                      onClick={() => setSetupBannerDismissed(false)}
                    >
                      {t("about.showBanner")}
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </motion.section>

      {/* Update */}
      <motion.section className="mb-6" variants={itemVariants}>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">
          {t("about.updates")}
        </h2>
        <div className="rounded-xl border bg-card p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/30">
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
      </motion.section>

      {/* Links */}
      <motion.section className="mb-6" variants={itemVariants}>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">
          {t("about.links")}
        </h2>
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
      </motion.section>

      {/* Author */}
      <motion.section variants={itemVariants}>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">
          {t("about.author")}
        </h2>
        <div className="rounded-xl border bg-card p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/30">
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
      </motion.section>
    </motion.div>
  );
}

interface LinkButtonProps {
  icon: React.ElementType;
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
