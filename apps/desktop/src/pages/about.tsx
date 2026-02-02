import { ExternalLink, Github, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

export function AboutPage() {
  const { t } = useTranslation();
  const appVersion = "0.1.0";
  const updateAvailable = false;

  return (
    <div className="p-6 max-w-lg">
      <div className="text-center mb-8">
        <div className="flex justify-center mb-4">
          <div className="h-16 w-16 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold">
            B
          </div>
        </div>
        <h1 className="text-2xl font-bold">{t("about.title")}</h1>
        <p className="text-muted-foreground">{t("about.version", { version: appVersion })}</p>
      </div>

      {/* Update */}
      <section className="mb-6">
        <div className="rounded-lg border bg-card p-4">
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
      </section>

      {/* Links */}
      <section className="mb-6">
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">
          {t("about.links")}
        </h2>
        <div className="space-y-2">
          <LinkButton
            icon={Github}
            label={t("about.githubRepo")}
            href="https://github.com/LinXueyuanStdio/browse-mcp"
          />
          <LinkButton
            icon={ExternalLink}
            label={t("about.documentation")}
            href="https://github.com/LinXueyuanStdio/browse-mcp#readme"
          />
          <LinkButton
            icon={ExternalLink}
            label={t("about.reportIssue")}
            href="https://github.com/LinXueyuanStdio/browse-mcp/issues"
          />
        </div>
      </section>

      {/* Credits */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">
          {t("about.credits")}
        </h2>
        <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
          <p className="mb-2">
            {t("about.builtWith")}
          </p>
          <p>
            {t("about.poweredBy")}
          </p>
        </div>
      </section>
    </div>
  );
}

interface LinkButtonProps {
  icon: React.ElementType;
  label: string;
  href: string;
}

function LinkButton({ icon: Icon, label, href }: LinkButtonProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between rounded-lg border bg-card p-3 hover:bg-muted transition-colors"
    >
      <div className="flex items-center gap-3">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm">{label}</span>
      </div>
      <ExternalLink className="h-4 w-4 text-muted-foreground" />
    </a>
  );
}
