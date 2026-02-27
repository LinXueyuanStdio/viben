import {
  Download,
  Star,
  User,
  Calendar,
  ExternalLink,
  GitBranch,
  Tag,
  Loader2,
  // X - not currently used
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useTranslation } from "react-i18next";
import type { CloudMcpPackage } from "@/hooks/use-cloud-mcp";
import { InstallButton } from "./install-button";

interface PackageDetailProps {
  package: CloudMcpPackage | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInstall?: () => void;
  installed?: boolean;
  loading?: boolean;
}

export function PackageDetail({
  package: pkg,
  open,
  onOpenChange,
  onInstall,
  installed = false,
  loading = false,
}: PackageDetailProps) {
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

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : pkg ? (
          <>
            <DialogHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <DialogTitle className="text-xl font-bold">
                    {pkg.name}
                  </DialogTitle>
                  <DialogDescription className="mt-1.5">
                    {pkg.description || t("marketplace.noDescription")}
                  </DialogDescription>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <Badge variant="outline" className="text-xs">
                    v{pkg.version}
                  </Badge>
                  {pkg.transport && (
                    <Badge variant="secondary" className="text-xs">
                      {pkg.transport.toUpperCase()}
                    </Badge>
                  )}
                </div>
              </div>
            </DialogHeader>

            <Separator />

            <ScrollArea className="flex-1 -mx-6 px-6">
              <div className="space-y-6 py-4">
                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-lg border bg-muted/30 p-3 text-center">
                    <Download className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                    <div className="text-lg font-bold">
                      {formatNumber(pkg.downloadsCount)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t("marketplace.downloads")}
                    </div>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-3 text-center">
                    <Star className="h-5 w-5 mx-auto mb-1 text-amber-400" />
                    <div className="text-lg font-bold">
                      {pkg.ratingAvg > 0 ? pkg.ratingAvg.toFixed(1) : "-"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t("marketplace.rating")}
                    </div>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-3 text-center">
                    <Star className="h-5 w-5 mx-auto mb-1 text-red-400" />
                    <div className="text-lg font-bold">
                      {formatNumber(pkg.favoritesCount)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t("marketplace.favorites")}
                    </div>
                  </div>
                </div>

                {/* Author */}
                {pkg.author && (
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                      {pkg.author.avatarUrl ? (
                        <img
                          src={pkg.author.avatarUrl}
                          alt={pkg.author.displayName}
                          className="h-10 w-10 rounded-full"
                        />
                      ) : (
                        <User className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <div className="font-medium">
                        {pkg.author.displayName || pkg.author.username}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        @{pkg.author.username}
                      </div>
                    </div>
                  </div>
                )}

                {/* Category & Tags */}
                {(pkg.category || (pkg.tags && pkg.tags.length > 0)) && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">{t("marketplace.tags")}</h4>
                    <div className="flex flex-wrap gap-2">
                      {pkg.category && (
                        <Badge variant="default">{pkg.category}</Badge>
                      )}
                      {pkg.tags?.map((tag) => (
                        <Badge key={tag} variant="secondary">
                          <Tag className="h-3 w-3 mr-1" />
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Dates */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {t("marketplace.created")}: {formatDate(pkg.createdAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {t("marketplace.updated")}: {formatDate(pkg.updatedAt ?? pkg.createdAt)}
                    </span>
                  </div>
                </div>

                {/* Links */}
                {pkg.repositoryUrl && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">{t("marketplace.links")}</h4>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => window.open(pkg.repositoryUrl!, "_blank")}
                    >
                      <GitBranch className="h-4 w-4 mr-2" />
                      {t("marketplace.viewRepository")}
                      <ExternalLink className="h-3 w-3 ml-auto" />
                    </Button>
                  </div>
                )}

                {/* Installation Instructions */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">{t("marketplace.installation")}</h4>
                  <div className="rounded-lg bg-muted p-3 font-mono text-sm">
                    <code>pip install {pkg.slug}</code>
                  </div>
                </div>
              </div>
            </ScrollArea>

            <Separator />

            {/* Footer Actions */}
            <div className="flex items-center justify-between pt-2">
              <Button
                variant="ghost"
                onClick={() => onOpenChange(false)}
              >
                {t("common.close")}
              </Button>
              <InstallButton
                state={installed ? "installed" : "not-installed"}
                onInstall={() => onInstall?.()}
              />
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            {t("marketplace.packageNotFound")}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
