import { memo, useState, useCallback } from "react";
import {
  GitBranch,
  Globe,
  Calendar,
  Loader2,
  Package,
  Terminal,
  ExternalLink,
  Copy,
  Check,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "react-i18next";
import type {
  OfficialServerDisplay,
  OfficialPackage,
} from "@/types/official-registry";
import { InstallButton } from "./install-button";
import { SourceBadge } from "./source-tabs";
import {
  getPackageTypeLabel,
  getInstallCommand,
  getServerIconUrl,
} from "@/hooks/use-official-registry";

interface OfficialServerDetailProps {
  server: OfficialServerDisplay | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInstall?: (pkg: OfficialPackage) => void;
  installed?: boolean;
  loading?: boolean;
  versions?: string[];
  versionsLoading?: boolean;
  selectedVersion?: string | null;
  onVersionChange?: (version: string) => void;
}

/**
 * Copy button with feedback
 */
const CopyButton = memo(function CopyButton({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      onClick={handleCopy}
    >
      {copied ? (
        <Check className="h-4 w-4 text-green-500" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </Button>
  );
});

/**
 * Package option card
 */
const PackageOption = memo(function PackageOption({
  pkg,
  onInstall,
}: {
  pkg: OfficialPackage;
  onInstall: () => void;
}) {
  const { t } = useTranslation();
  const installCommand = getInstallCommand(pkg);

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {getPackageTypeLabel(pkg.registryType)}
          </Badge>
          {pkg.version && (
            <span className="text-xs text-muted-foreground font-mono">
              v{pkg.version}
            </span>
          )}
        </div>
        <Badge variant="outline" className="text-[10px]">
          {pkg.transport.type.toUpperCase()}
        </Badge>
      </div>

      <div className="flex items-center gap-2">
        <code className="flex-1 text-xs bg-muted px-2 py-1 rounded font-mono overflow-x-auto">
          {installCommand}
        </code>
        <CopyButton text={installCommand} className="h-7 w-7 shrink-0" />
      </div>

      {/* Environment Variables */}
      {pkg.environmentVariables && pkg.environmentVariables.length > 0 && (
        <div className="space-y-1">
          <span className="text-xs font-medium">
            {t("marketplace.envVars")}:
          </span>
          <div className="flex flex-wrap gap-1">
            {pkg.environmentVariables.map((env) => (
              <Badge
                key={env.name}
                variant="outline"
                className="text-[10px] font-mono"
              >
                {env.name}
                {env.isRequired && (
                  <span className="text-red-500 ml-0.5">*</span>
                )}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <Button size="sm" className="w-full" onClick={onInstall}>
        <Terminal className="h-4 w-4 mr-2" />
        {t("marketplace.installPackage")}
      </Button>
    </div>
  );
});

export function OfficialServerDetail({
  server,
  open,
  onOpenChange,
  onInstall,
  installed = false,
  loading = false,
  versions = [],
  versionsLoading = false,
  selectedVersion,
  onVersionChange,
}: OfficialServerDetailProps) {
  const { t } = useTranslation();

  const formatDate = (dateStr: string): string => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const iconUrl = server ? getServerIconUrl(server) : null;

  // Get packages from original data
  const packages = server?._original?.server?.packages || [];
  const remotes = server?._original?.server?.remotes || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : server ? (
          <>
            <DialogHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {/* Server Icon */}
                  {iconUrl ? (
                    <img
                      src={iconUrl}
                      alt={server.name}
                      className="h-12 w-12 rounded-lg shrink-0 bg-muted object-cover"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-lg shrink-0 bg-muted flex items-center justify-center">
                      <Package className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <DialogTitle className="text-xl font-bold">
                        {server.name}
                      </DialogTitle>
                      <SourceBadge source="official" />
                    </div>
                    <DialogDescription className="mt-1.5">
                      {server.description || t("marketplace.noDescription")}
                    </DialogDescription>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0">
                  {/* Version Selector */}
                  {versions.length > 1 ? (
                    <Select
                      value={selectedVersion || server.version}
                      onValueChange={onVersionChange}
                      disabled={versionsLoading}
                    >
                      <SelectTrigger className="w-24 h-7 text-xs">
                        <SelectValue placeholder={server.version} />
                      </SelectTrigger>
                      <SelectContent>
                        {versions.map((v) => (
                          <SelectItem key={v} value={v} className="text-xs">
                            v{v}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      v{server.version}
                    </Badge>
                  )}

                  {server.status === "deprecated" && (
                    <Badge
                      variant="outline"
                      className="text-xs text-amber-500 border-amber-500/50"
                    >
                      {t("marketplace.deprecated")}
                    </Badge>
                  )}
                </div>
              </div>
            </DialogHeader>

            <Separator />

            <ScrollArea className="flex-1 -mx-6 px-6">
              <div className="space-y-6 py-4">
                {/* Server ID */}
                <div className="text-sm">
                  <span className="text-muted-foreground">
                    {t("marketplace.serverId")}:
                  </span>{" "}
                  <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-xs">
                    {server.id}
                  </code>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {t("marketplace.published")}: {formatDate(server.publishedAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {t("marketplace.updated")}: {formatDate(server.updatedAt)}
                    </span>
                  </div>
                </div>

                {/* Links */}
                {(server.repositoryUrl || server.websiteUrl) && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">
                      {t("marketplace.links")}
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {server.repositoryUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (server.repositoryUrl) {
                              window.open(server.repositoryUrl, "_blank");
                            }
                          }}
                        >
                          <GitBranch className="h-4 w-4 mr-2" />
                          {t("marketplace.viewRepository")}
                          <ExternalLink className="h-3 w-3 ml-2" />
                        </Button>
                      )}
                      {server.websiteUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (server.websiteUrl) {
                              window.open(server.websiteUrl, "_blank");
                            }
                          }}
                        >
                          <Globe className="h-4 w-4 mr-2" />
                          {t("marketplace.viewWebsite")}
                          <ExternalLink className="h-3 w-3 ml-2" />
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* Packages */}
                {packages.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium">
                      {t("marketplace.installationOptions")} ({packages.length})
                    </h4>
                    <div className="space-y-3">
                      {packages.map((pkg, idx) => (
                        <PackageOption
                          key={`${pkg.registryType}-${pkg.identifier}-${idx}`}
                          pkg={pkg}
                          onInstall={() => onInstall?.(pkg)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Remote Endpoints */}
                {remotes.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium">
                      {t("marketplace.remoteEndpoints")} ({remotes.length})
                    </h4>
                    <div className="space-y-2">
                      {remotes.map((remote, idx) => (
                        <div
                          key={idx}
                          className="rounded-lg border p-3 space-y-2"
                        >
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {remote.type?.toUpperCase() || "REMOTE"}
                            </Badge>
                          </div>
                          {remote.url && (
                            <div className="flex items-center gap-2">
                              <code className="flex-1 text-xs bg-muted px-2 py-1 rounded font-mono overflow-x-auto">
                                {remote.url}
                              </code>
                              <CopyButton
                                text={remote.url}
                                className="h-7 w-7 shrink-0"
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* No Installation Options */}
                {packages.length === 0 && remotes.length === 0 && (
                  <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
                    <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">
                      {t("marketplace.noInstallationOptions")}
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>

            <Separator />

            {/* Footer Actions */}
            <div className="flex items-center justify-between pt-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                {t("common.close")}
              </Button>
              {packages.length === 1 && (
                <InstallButton
                  state={installed ? "installed" : "not-installed"}
                  onInstall={() => onInstall?.(packages[0])}
                />
              )}
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
