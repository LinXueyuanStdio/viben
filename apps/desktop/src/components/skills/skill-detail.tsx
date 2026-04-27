import { useState } from "react";
import {
  Download,
  Star,
  User,
  Tag,
  Zap,
  ExternalLink,
  Loader2,
  Check,
  Calendar,
  Heart,
  Code,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import type { CloudSkillPackage } from "@/hooks/use-cloud-skills";

/* -----------------------------------------------------------------------------
 * Skill Detail Dialog
 * -------------------------------------------------------------------------- */

interface SkillDetailProps {
  skill: CloudSkillPackage | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isInstalled?: boolean;
  isInstalling?: boolean;
  onInstall?: (skill: CloudSkillPackage) => void;
}

export function SkillDetail({
  skill,
  open,
  onOpenChange,
  isInstalled = false,
  isInstalling = false,
  onInstall,
}: SkillDetailProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  if (!skill) return null;

  // Get skill type badge color
  const getSkillTypeBadgeVariant = (skillType: string) => {
    switch (skillType) {
      case "automation":
        return "default";
      case "analysis":
        return "secondary";
      case "generation":
        return "success";
      default:
        return "outline";
    }
  };

  // Format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Format download count
  const formatDownloads = (count: number) => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  // Copy skill slug to clipboard
  const handleCopySlug = async () => {
    try {
      await navigator.clipboard.writeText(skill.slug);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore copy errors
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0">
        {/* Header */}
        <div className="p-6 pb-4 border-b">
          <DialogHeader>
            <div className="flex items-start gap-4">
              <div
                className={cn(
                  "flex h-14 w-14 items-center justify-center rounded-xl flex-shrink-0",
                  isInstalled
                    ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-primary/10 text-primary"
                )}
              >
                <Zap className="h-7 w-7" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <DialogTitle className="text-xl">{skill.name}</DialogTitle>
                  <Badge variant={getSkillTypeBadgeVariant(skill.skillType)}>
                    {skill.skillType}
                  </Badge>
                  {isInstalled && (
                    <Badge variant="success">
                      <Check className="h-3 w-3 mr-1" />
                      {t("common.installed")}
                    </Badge>
                  )}
                </div>
                <DialogDescription className="mt-1">
                  {skill.description || t("skillsMarket.noDescription")}
                </DialogDescription>

                {/* Slug with copy */}
                <div className="flex items-center gap-2 mt-2">
                  <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                    {skill.slug}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={handleCopySlug}
                  >
                    {copied ? (
                      <Check className="h-3 w-3 text-green-500" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </DialogHeader>

          {/* Stats Row */}
          <div className="flex items-center gap-6 mt-4 text-sm">
            {/* Rating */}
            {skill.ratingAvg > 0 && (
              <div className="flex items-center gap-1.5">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                <span className="font-medium">{skill.ratingAvg.toFixed(1)}</span>
              </div>
            )}

            {/* Downloads */}
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Download className="h-4 w-4" />
              <span>{formatDownloads(skill.downloadsCount)}</span>
            </div>

            {/* Favorites */}
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Heart className="h-4 w-4" />
              <span>{skill.favoritesCount}</span>
            </div>

            {/* Version */}
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Code className="h-4 w-4" />
              <span>v{skill.version}</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1 p-6">
          <div className="space-y-6">
            {/* Author Info */}
            {skill.author && (
              <section>
                <h4 className="text-sm font-medium mb-2">
                  {t("skillsMarket.author")}
                </h4>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <User className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">
                      {skill.author.displayName || skill.author.username}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      @{skill.author.username}
                    </p>
                  </div>
                </div>
              </section>
            )}

            {/* Trigger Patterns */}
            {skill.triggerPatterns && skill.triggerPatterns.length > 0 && (
              <section>
                <h4 className="text-sm font-medium mb-2">
                  {t("skillsMarket.triggerPatterns")}
                </h4>
                <div className="space-y-2">
                  {skill.triggerPatterns.map((pattern, idx) => (
                    <code
                      key={idx}
                      className="block text-xs bg-muted px-3 py-2 rounded-lg font-mono break-all"
                    >
                      {pattern}
                    </code>
                  ))}
                </div>
              </section>
            )}

            {/* Tags */}
            {skill.tags && skill.tags.length > 0 && (
              <section>
                <h4 className="text-sm font-medium mb-2">
                  {t("skillsMarket.tags")}
                </h4>
                <div className="flex flex-wrap gap-2">
                  {skill.tags.map((tag) => (
                    <span
                      key={tag}
                      className="flex items-center gap-1 text-xs bg-muted px-2.5 py-1 rounded"
                    >
                      <Tag className="h-3 w-3" />
                      {tag}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Category */}
            {skill.category && (
              <section>
                <h4 className="text-sm font-medium mb-2">
                  {t("skillsMarket.category")}
                </h4>
                <Badge variant="outline">{skill.category}</Badge>
              </section>
            )}

            {/* Links */}
            {skill.repositoryUrl && (
              <section>
                <h4 className="text-sm font-medium mb-2">
                  {t("skillsMarket.links")}
                </h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(skill.repositoryUrl!, "_blank")}
                  className="h-8"
                >
                  <ExternalLink className="h-3.5 w-3.5 mr-2" />
                  {t("skillsMarket.repository")}
                </Button>
              </section>
            )}

            {/* Dates */}
            <section>
              <h4 className="text-sm font-medium mb-2">
                {t("skillsMarket.metadata")}
              </h4>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>
                    {t("skillsMarket.createdAt")}: {formatDate(skill.createdAt)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>
                    {t("skillsMarket.updatedAt")}: {formatDate(skill.updatedAt)}
                  </span>
                </div>
              </div>
            </section>
          </div>
        </ScrollArea>

        {/* Footer Actions */}
        <div className="p-6 pt-4 border-t flex items-center gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.close")}
          </Button>
          <div className="flex-1" />
          {onInstall && (
            <Button
              variant={isInstalled ? "outline" : "default"}
              onClick={() => {
                if (!isInstalled && !isInstalling) {
                  onInstall(skill);
                }
              }}
              disabled={isInstalling}
            >
              {isInstalling ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("skillsMarket.installing")}
                </>
              ) : isInstalled ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  {t("common.installed")}
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  {t("skillsMarket.install")}
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default SkillDetail;
