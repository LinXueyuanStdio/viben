import * as React from "react";
import { Package, GitBranch, Globe, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import type { OfficialServerDisplay } from "@/types/official-registry";
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
      {icons[type] || type[0]?.toUpperCase() || "?"}
    </span>
  );
});

/**
 * OfficialServerCard component displays an official registry server
 * Styled to match web version
 */
export const OfficialServerCard = React.memo(function OfficialServerCard({
  server,
  onSelect,
  className,
}: OfficialServerCardProps) {
  const { t } = useTranslation();

  const handleOpenRepo = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (server.repositoryUrl) {
        window.open(server.repositoryUrl, "_blank", "noopener,noreferrer");
      }
    },
    [server.repositoryUrl]
  );

  const handleOpenWebsite = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (server.websiteUrl) {
        window.open(server.websiteUrl, "_blank", "noopener,noreferrer");
      }
    },
    [server.websiteUrl]
  );

  // Get icon URL for current theme
  const iconUrl = getServerIconUrl(server);

  return (
    <div
      className={cn(
        "group relative flex h-full flex-col rounded-xl border bg-card p-4 transition-all duration-300 cursor-pointer",
        "hover:border-primary/30 hover:shadow-lg hover:-translate-y-1",
        server.status === "deprecated" && "opacity-75",
        className
      )}
      onClick={onSelect}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* Server Icon */}
          {iconUrl ? (
            <img
              src={iconUrl}
              alt={server.name}
              className="h-10 w-10 rounded-lg shrink-0 bg-muted object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div className="h-10 w-10 rounded-lg shrink-0 bg-muted flex items-center justify-center">
              <Package className="h-5 w-5 text-muted-foreground" />
            </div>
          )}

          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold group-hover:text-primary line-clamp-1">
                {server.name}
              </h3>
              {server.status === "deprecated" && (
                <Badge
                  variant="outline"
                  className="text-[10px] shrink-0 text-amber-500 border-amber-500/50"
                >
                  {t("marketplace.deprecated")}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">v{server.version}</p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0">
          <SourceBadge source="official" />
        </div>
      </div>

      {/* Description */}
      <p className="mt-3 flex-1 text-sm text-muted-foreground line-clamp-2">
        {server.description || t("marketplace.noDescription")}
      </p>

      {/* Server ID */}
      <p className="mt-2 text-xs text-muted-foreground font-mono truncate">
        {server.id}
      </p>

      {/* Package Types */}
      {server.packageTypes.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
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
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {t("marketplace.remoteAvailable")}
            </Badge>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 flex items-center gap-2">
        {server.repositoryUrl && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleOpenRepo}
            title={t("marketplace.viewRepository")}
          >
            <GitBranch className="h-4 w-4" />
            <span className="sr-only">{t("marketplace.viewRepository")}</span>
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
        <div className="flex-1" />
        <Button
          variant="outline"
          size="sm"
          className="text-xs gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          {t("marketplace.viewDetails")}
          <ExternalLink className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
});

/**
 * Skeleton for loading state
 */
export function OfficialServerCardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3 flex-1">
          <div className="h-10 w-10 bg-muted rounded-lg" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-32 bg-muted rounded" />
            <div className="h-3 w-16 bg-muted rounded" />
          </div>
        </div>
        <div className="h-4 w-14 bg-muted rounded" />
      </div>
      <div className="mt-3 space-y-2">
        <div className="h-4 w-full bg-muted rounded" />
        <div className="h-4 w-2/3 bg-muted rounded" />
      </div>
      <div className="mt-2 h-3 w-40 bg-muted rounded" />
      <div className="mt-3 flex gap-1.5">
        <div className="h-5 w-12 bg-muted rounded" />
        <div className="h-5 w-14 bg-muted rounded" />
      </div>
      <div className="mt-4 flex gap-2">
        <div className="h-8 w-8 bg-muted rounded" />
        <div className="h-8 w-8 bg-muted rounded" />
        <div className="flex-1" />
        <div className="h-8 w-24 bg-muted rounded" />
      </div>
    </div>
  );
}
