import * as React from "react";
import { Globe, Users } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

/**
 * Source type for marketplace tabs
 */
export type MarketplaceSource = "official" | "community";

interface SourceTabsProps {
  /** Currently selected source */
  value: MarketplaceSource;
  /** Callback when source changes */
  onValueChange: (value: MarketplaceSource) => void;
  /** Count of items in official source */
  officialCount?: number;
  /** Count of items in community source */
  communityCount?: number;
  /** Whether data is loading */
  loading?: boolean;
  /** Additional class name */
  className?: string;
}

/**
 * SourceTabs component for switching between Official and Community marketplace sources
 * Memoized to prevent unnecessary re-renders
 */
export const SourceTabs = React.memo(function SourceTabs({
  value,
  onValueChange,
  officialCount,
  communityCount,
  loading = false,
  className,
}: SourceTabsProps) {
  const { t } = useTranslation();

  // Format count for display
  const formatCount = (count: number | undefined): string => {
    if (count === undefined) return "";
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  return (
    <Tabs
      value={value}
      onValueChange={(v) => onValueChange(v as MarketplaceSource)}
      className={cn("w-full", className)}
    >
      <TabsList variant="pills" className="w-full sm:w-auto">
        <TabsTrigger
          value="official"
          variant="pills"
          className="flex items-center gap-2"
        >
          <Globe className="h-4 w-4" />
          <span>{t("marketplace.sourceOfficial")}</span>
          {officialCount !== undefined && !loading && (
            <Badge
              variant="secondary"
              className="text-[10px] px-1.5 py-0 h-4 min-w-[1.5rem] flex items-center justify-center"
            >
              {formatCount(officialCount)}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger
          value="community"
          variant="pills"
          className="flex items-center gap-2"
        >
          <Users className="h-4 w-4" />
          <span>{t("marketplace.sourceCommunity")}</span>
          {communityCount !== undefined && !loading && (
            <Badge
              variant="secondary"
              className="text-[10px] px-1.5 py-0 h-4 min-w-[1.5rem] flex items-center justify-center"
            >
              {formatCount(communityCount)}
            </Badge>
          )}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
});

/**
 * Source badge component for displaying on cards
 */
interface SourceBadgeProps {
  source: MarketplaceSource;
  className?: string;
}

export const SourceBadge = React.memo(function SourceBadge({
  source,
  className,
}: SourceBadgeProps) {
  const { t } = useTranslation();

  return (
    <Badge
      variant={source === "official" ? "default" : "secondary"}
      className={cn(
        "text-[10px] px-1.5 py-0 shrink-0",
        source === "official" && "bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 border-blue-500/20",
        source === "community" && "bg-purple-500/10 text-purple-600 hover:bg-purple-500/20 border-purple-500/20",
        className
      )}
    >
      {source === "official"
        ? t("marketplace.badgeOfficial")
        : t("marketplace.badgeCommunity")}
    </Badge>
  );
});
