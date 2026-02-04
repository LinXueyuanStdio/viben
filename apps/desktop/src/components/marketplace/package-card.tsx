import * as React from "react";
import { Download, Star, User, Tag, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import type { CloudMcpPackage } from "@/hooks/use-cloud-mcp";
import { InstallButton } from "./install-button";

interface PackageCardProps {
  package: CloudMcpPackage;
  onSelect?: () => void;
  onInstall?: () => void;
  installed?: boolean;
  className?: string;
}

export function PackageCard({
  package: pkg,
  onSelect,
  onInstall,
  installed = false,
  className,
}: PackageCardProps) {
  const { t } = useTranslation();

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  const renderStars = (rating: number) => {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const stars = [];

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(
          <Star
            key={i}
            className="h-3 w-3 fill-amber-400 text-amber-400"
          />
        );
      } else if (i === fullStars && hasHalfStar) {
        stars.push(
          <Star
            key={i}
            className="h-3 w-3 fill-amber-400/50 text-amber-400"
          />
        );
      } else {
        stars.push(
          <Star
            key={i}
            className="h-3 w-3 text-muted-foreground/30"
          />
        );
      }
    }

    return stars;
  };

  return (
    <Card
      className={cn(
        "group cursor-pointer transition-all duration-300",
        "hover:border-primary/30 hover:shadow-lg hover:-translate-y-1",
        className
      )}
      onClick={onSelect}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base font-semibold line-clamp-1">
              {pkg.name}
            </CardTitle>
            <CardDescription className="mt-1 line-clamp-2 text-xs">
              {pkg.description || t("marketplace.noDescription")}
            </CardDescription>
          </div>
          {pkg.transport && (
            <Badge variant="outline" className="text-[10px] shrink-0">
              {pkg.transport.toUpperCase()}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Author */}
        {pkg.author && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
            <User className="h-3 w-3" />
            <span className="truncate">{pkg.author.displayName || pkg.author.username}</span>
          </div>
        )}

        {/* Tags */}
        {pkg.tags && pkg.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {pkg.tags.slice(0, 3).map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="text-[10px] px-1.5 py-0"
              >
                {tag}
              </Badge>
            ))}
            {pkg.tags.length > 3 && (
              <span className="text-[10px] text-muted-foreground">
                +{pkg.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Download className="h-3 w-3" />
              <span>{formatNumber(pkg.downloadsCount)}</span>
            </div>
            {pkg.ratingAvg > 0 && (
              <div className="flex items-center gap-1">
                {renderStars(pkg.ratingAvg)}
                <span className="ml-0.5">({pkg.ratingAvg.toFixed(1)})</span>
              </div>
            )}
          </div>
          <span className="text-[10px] font-mono">v{pkg.version}</span>
        </div>

        {/* Actions */}
        <div
          className="flex items-center gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <InstallButton
            state={installed ? "installed" : "not-installed"}
            onInstall={() => onInstall?.()}
            className="flex-1"
          />
          {pkg.repositoryUrl && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => window.open(pkg.repositoryUrl!, "_blank")}
            >
              <ExternalLink className="h-4 w-4" />
              <span className="sr-only">{t("marketplace.viewRepo")}</span>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Skeleton for loading state
export function PackageCardSkeleton() {
  return (
    <Card className="animate-pulse">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 space-y-2">
            <div className="h-5 w-32 bg-muted rounded" />
            <div className="h-3 w-full bg-muted rounded" />
            <div className="h-3 w-2/3 bg-muted rounded" />
          </div>
          <div className="h-5 w-12 bg-muted rounded" />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center gap-1.5 mb-3">
          <div className="h-3 w-3 bg-muted rounded-full" />
          <div className="h-3 w-24 bg-muted rounded" />
        </div>
        <div className="flex gap-1 mb-3">
          <div className="h-5 w-12 bg-muted rounded" />
          <div className="h-5 w-14 bg-muted rounded" />
        </div>
        <div className="flex items-center justify-between mb-3">
          <div className="h-3 w-20 bg-muted rounded" />
          <div className="h-3 w-12 bg-muted rounded" />
        </div>
        <div className="flex gap-2">
          <div className="h-8 flex-1 bg-muted rounded" />
          <div className="h-8 w-8 bg-muted rounded" />
        </div>
      </CardContent>
    </Card>
  );
}
