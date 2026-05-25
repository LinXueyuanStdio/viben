import {
  Home,
  Bug,
  Book,
  User,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { GithubIcon as Github } from "@/components/ui/icons";
import { VibenLogo } from "@/components/ui/viben-logo";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { openUrl } from "@tauri-apps/plugin-opener";
import { getVersion } from "@tauri-apps/api/app";
import { useEffect, useState } from "react";
import { LinkButton } from "./components";

export function AboutSection() {
  const { t } = useTranslation();
  const [appVersion, setAppVersion] = useState("0.1.0");
  const updateAvailable = false;

  // Get actual app version on mount
  useEffect(() => {
    getVersion().then(setAppVersion).catch(console.error);
  }, []);

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
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center gap-4 mb-4">
          <VibenLogo size="lg" />
          <div>
            <h3 className="text-lg font-semibold font-serif">{t("about.title")}</h3>
            <p className="text-sm text-muted-foreground">{t("about.version", { version: appVersion })}</p>
          </div>
        </div>
      </div>

      {/* Updates */}
      <div className="rounded-xl border bg-card p-4">
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
      <div className="rounded-xl border bg-card p-4">
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
      <div className="rounded-xl border bg-card p-4">
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
