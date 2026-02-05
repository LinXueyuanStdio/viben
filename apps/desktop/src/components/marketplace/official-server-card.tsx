import * as React from "react";
import { Package, GitBranch, Globe } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import type { OfficialServerDisplay } from "@/types/official-registry";
import { InstallButton } from "./install-button";
import { SourceBadge } from "./source-tabs";
import {
  getPackageTypeLabel,
  getServerIconUrl,
} from "@/hooks/use-official-registry";

interface OfficialServerCardProps {
  server: OfficialServerDisplay;
  onSelect?: () => void;
  onInstall?: () => void;
  installed?: boolean;
  className?: string;
}

/**
 * Get icon for package type
 */
const PackageTypeIcon = React.memo(function PackageTypeIcon({
  type,
}: {
  type: string;
}) {
  const icons: Record<string, string> = {
    npm: "N",
    pypi: "Py",
    oci: "D",
    nuget: ".N",
    mcpb: "B",
  };

  return (
    <span
      className="inline-flex items-center justify-center h-4 w-4 rounded text-[8px] font-bold bg-muted"
      title={getPackageTypeLabel(type as "npm" | "pypi" | "oci" | "nuget" | "mcpb")}
    >
      {icons[type] || type[0].toUpperCase()}
    </span>
  );
});

/**
 * OfficialServerCard component displays an official registry server
 * Memoized to prevent unnecessary re-renders in list views
 */
export const OfficialServerCard = React.memo(function OfficialServerCard({
  server,
  onSelect,
  onInstall,
  installed = false,
  className,
}: OfficialServerCardProps) {
  const { t } = useTranslation();

  const handleInstall = React.useCallback(() => {
    onInstall?.();
  }, [onInstall]);

  const handleOpenRepo = React.useCallback(() => {
    if (server.repositoryUrl) {
      window.open(server.repositoryUrl, "_blank");
    }
  }, [server.repositoryUrl]);

  const handleOpenWebsite = React.useCallback(() => {
    if (server.websiteUrl) {
      window.open(server.websiteUrl, "_blank");
    }
  }, [server.websiteUrl]);

  const handleStopPropagation = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
    },
    []
  );

  // Get icon URL for current theme
  const iconUrl = getServerIconUrl(server);

  return (
    <Card
      className={cn(
        "group cursor-pointer transition-all duration-300",
        "hover:border-primary/30 hover:shadow-lg hover:-translate-y-1",
        server.status === "deprecated" && "opacity-75",
        className
      )}
      onClick={onSelect}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Server Icon */}
            {iconUrl ? (
              <img
                src={iconUrl}
                alt={server.name}
                className="h-10 w-10 rounded-lg shrink-0 bg-muted object-cover"
                onError={(e) => {
                  // Hide broken images
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <div className="h-10 w-10 rounded-lg shrink-0 bg-muted flex items-center justify-center">
                <Package className="h-5 w-5 text-muted-foreground" />
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-semibold line-clamp-1">
                  {server.name}
                </CardTitle>
                {server.status === "deprecated" && (
                  <Badge variant="outline" className="text-[10px] shrink-0 text-amber-500 border-amber-500/50">
                    {t("marketplace.deprecated")}
                  </Badge>
                )}
              </div>
              <CardDescription className="mt-1 line-clamp-2 text-xs">
                {server.description || t("marketplace.noDescription")}
              </CardDescription>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1 shrink-0">
            <SourceBadge source="official" />
            <span className="text-[10px] font-mono text-muted-foreground">
              v{server.version}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Server ID (hierarchical name) */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3 font-mono">
          <span className="truncate">{server.id}</span>
        </div>

        {/* Package Types */}
        {server.packageTypes.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {server.packageTypes.map((type) => (
              <Badge
                key={type}
                variant="secondary"
                className="text-[10px] px-1.5 py-0 gap-1"
              >
                <PackageTypeIcon type={type} />
                {type}
              </Badge>
            ))}
            {server.hasRemotes && (
              <Badge
                variant="secondary"
                className="text-[10px] px-1.5 py-0"
              >
                {t("marketplace.remoteAvailable")}
              </Badge>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2" onClick={handleStopPropagation}>
          <InstallButton
            state={installed ? "installed" : "not-installed"}
            onInstall={handleInstall}
            className="flex-1"
          />
          {server.repositoryUrl && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleOpenRepo}
              title={t("marketplace.viewRepository")}
            >
              <GitBranch className="h-4 w-4" />
              <span className="sr-only">{t("marketplace.viewRepo")}</span>
            </Button>
          )}
          {server.websiteUrl && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleOpenWebsite}
              title={t("marketplace.viewWebsite")}
            >
              <Globe className="h-4 w-4" />
              <span className="sr-only">{t("marketplace.viewWebsite")}</span>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
});

/**
 * Skeleton for loading state
 */
export function OfficialServerCardSkeleton() {
  return (
    <Card className="animate-pulse">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3 flex-1">
            <div className="h-10 w-10 bg-muted rounded-lg" />
            <div className="flex-1 space-y-2">
              <div className="h-5 w-32 bg-muted rounded" />
              <div className="h-3 w-full bg-muted rounded" />
              <div className="h-3 w-2/3 bg-muted rounded" />
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="h-4 w-14 bg-muted rounded" />
            <div className="h-3 w-10 bg-muted rounded" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="h-3 w-40 bg-muted rounded mb-3" />
        <div className="flex gap-1.5 mb-3">
          <div className="h-5 w-12 bg-muted rounded" />
          <div className="h-5 w-14 bg-muted rounded" />
        </div>
        <div className="flex gap-2">
          <div className="h-8 flex-1 bg-muted rounded" />
          <div className="h-8 w-8 bg-muted rounded" />
        </div>
      </CardContent>
    </Card>
  );
}
