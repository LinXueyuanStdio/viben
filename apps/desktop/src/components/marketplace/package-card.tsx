import * as React from "react";
import { Download, Star, Heart } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import type { CloudMcpPackage } from "@/hooks/use-cloud-mcp";

interface PackageCardProps {
  package: CloudMcpPackage;
  onSelect?: () => void;
  onInstall?: () => void;
  installed?: boolean;
  className?: string;
}

/**
 * Format large numbers with K/M suffix
 */
const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
};

/**
 * PackageCard component displays a cloud MCP package in the marketplace
 * Styled to match web version
 */
export const PackageCard = React.memo(function PackageCard({
  package: pkg,
  onSelect,
  className,
}: PackageCardProps) {
  const { t } = useTranslation();
  const ratingAvg = pkg.ratingAvg || 0;

  return (
    <div
      className={cn(
        "group relative flex h-full flex-col rounded-xl border bg-card p-4 transition-all duration-300 cursor-pointer",
        "hover:border-primary/30 hover:shadow-lg hover:-translate-y-1",
        className
      )}
      onClick={onSelect}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h3 className="font-semibold group-hover:text-primary line-clamp-1">
            {pkg.name}
          </h3>
          <p className="text-xs text-muted-foreground">v{pkg.version}</p>
        </div>
        {pkg.transport && (
          <Badge variant="outline" className="text-[10px] shrink-0">
            {pkg.transport.toUpperCase()}
          </Badge>
        )}
      </div>

      {/* Description */}
      <p className="mt-3 flex-1 text-sm text-muted-foreground line-clamp-2">
        {pkg.description || t("marketplace.noDescription")}
      </p>

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between">
        {/* Author */}
        {pkg.author && (
          <div className="flex items-center gap-2">
            <Avatar className="h-5 w-5">
              <AvatarImage src={pkg.author.avatarUrl || undefined} />
              <AvatarFallback>
                {(pkg.author.displayName || pkg.author.username)?.[0]?.toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground truncate max-w-[100px]">
              {pkg.author.displayName || pkg.author.username}
            </span>
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {pkg.favoritesCount > 0 && (
            <span className="flex items-center gap-1">
              <Heart className="h-3 w-3" />
              {formatNumber(pkg.favoritesCount)}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Download className="h-3 w-3" />
            {formatNumber(pkg.downloadsCount)}
          </span>
          {ratingAvg > 0 && (
            <span className="flex items-center gap-1">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              {ratingAvg.toFixed(1)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
});

/**
 * Skeleton for loading state
 */
export function PackageCardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="h-5 w-32 bg-muted rounded" />
          <div className="h-3 w-16 bg-muted rounded" />
        </div>
        <div className="h-5 w-12 bg-muted rounded" />
      </div>
      <div className="mt-3 space-y-2">
        <div className="h-4 w-full bg-muted rounded" />
        <div className="h-4 w-2/3 bg-muted rounded" />
      </div>
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 bg-muted rounded-full" />
          <div className="h-3 w-20 bg-muted rounded" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-3 w-8 bg-muted rounded" />
          <div className="h-3 w-8 bg-muted rounded" />
        </div>
      </div>
    </div>
  );
}
