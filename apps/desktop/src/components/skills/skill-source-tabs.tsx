import { useTranslation } from "react-i18next";
import { Globe, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { SkillSource } from "./types";

interface SkillSourceTabsProps {
  source: SkillSource;
  onSourceChange: (source: SkillSource) => void;
  className?: string;
}

export function SkillSourceTabs({
  source,
  onSourceChange,
  className,
}: SkillSourceTabsProps) {
  const { t } = useTranslation();

  return (
    <Tabs
      value={source}
      onValueChange={(value) => onSourceChange(value as SkillSource)}
      className={cn("w-full", className)}
    >
      <TabsList className="grid w-full max-w-[400px] grid-cols-2">
        <TabsTrigger
          value="official"
          className={cn(
            "gap-2",
            source === "official" && "border-primary text-primary"
          )}
        >
          <Globe className="h-4 w-4" />
          <span>{t("skillsMarket.officialTab", "Official")}</span>
        </TabsTrigger>
        <TabsTrigger
          value="community"
          className={cn(
            "gap-2",
            source === "community" && "border-primary text-primary"
          )}
        >
          <Users className="h-4 w-4" />
          <span>{t("skillsMarket.communityTab", "Community")}</span>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

interface SkillSourceBadgeProps {
  source: SkillSource;
  className?: string;
}

export function SkillSourceBadge({
  source,
  className,
}: SkillSourceBadgeProps) {
  const { t } = useTranslation();
  const isOfficial = source === "official";

  return (
    <Badge
      variant={isOfficial ? "default" : "secondary"}
      className={cn(
        "text-[10px] shrink-0",
        isOfficial
          ? "bg-primary/10 text-primary border-primary/20"
          : "bg-secondary text-secondary-foreground border-secondary",
        className
      )}
    >
      {isOfficial
        ? t("skillsMarket.officialBadge", "Official")
        : t("skillsMarket.communityTab", "Community")}
    </Badge>
  );
}
