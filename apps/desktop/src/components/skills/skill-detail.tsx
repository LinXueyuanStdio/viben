import { useCallback, useEffect, useRef, useState } from "react";
import {
  Calendar,
  Check,
  Copy,
  Download,
  ExternalLink,
  Heart,
  Loader2,
  Star,
  Tag,
  User,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  formatSkillCount,
  getSkillInitials,
  getSkillSlug,
} from "./skill-display-utils";
import { SkillSourceBadge } from "./skill-source-tabs";
import type { InstallableSkill, SkillDetailItem } from "./types";

interface SkillDetailProps {
  skill: SkillDetailItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isInstalled?: boolean;
  isInstalling?: boolean;
  installProgress?: number;
  onInstall?: (skill: InstallableSkill) => void;
}

function formatDate(value: string | number): string {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function SkillDetail({
  skill,
  open,
  onOpenChange,
  isInstalled = false,
  isInstalling = false,
  installProgress = 0,
  onInstall,
}: SkillDetailProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const copyResetTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const slug = skill ? getSkillSlug(skill) : "";
  const slugRef = useRef(slug);
  slugRef.current = slug;

  const clearCopyResetTimer = useCallback(() => {
    if (copyResetTimerRef.current === null) return;

    window.clearTimeout(copyResetTimerRef.current);
    copyResetTimerRef.current = null;
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      clearCopyResetTimer();
    };
  }, [clearCopyResetTimer]);

  useEffect(() => {
    setCopied(false);
    clearCopyResetTimer();
  }, [clearCopyResetTimer, slug]);

  if (!skill) return null;

  const { source, data } = skill;
  const isOfficial = source === "official";
  const description =
    data.description ?? t("skillsMarket.noDescription", "No description available");
  const downloads = isOfficial ? data.downloads : data.downloadsCount;
  const version = data.version;

  const handleCopySlug = async () => {
    const copiedSlug = slug;

    try {
      await navigator.clipboard.writeText(copiedSlug);
      if (!mountedRef.current || slugRef.current !== copiedSlug) return;

      clearCopyResetTimer();
      setCopied(true);
      copyResetTimerRef.current = window.setTimeout(() => {
        if (!mountedRef.current) return;

        setCopied(false);
        copyResetTimerRef.current = null;
      }, 2000);
    } catch {
      // Clipboard failures are non-blocking.
    }
  };

  const handleInstall = () => {
    if (isInstalled || isInstalling || !onInstall) return;

    onInstall(skill);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col p-0">
        <div className="border-b p-6 pb-4">
          <DialogHeader>
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {isOfficial ? (
                  <User className="h-7 w-7" />
                ) : (
                  <Tag className="h-7 w-7" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <DialogTitle className="min-w-0 break-words text-xl">
                    {data.name}
                  </DialogTitle>
                  <SkillSourceBadge source={source} />
                  {!isOfficial && (
                    <Badge variant="outline">{data.skillType}</Badge>
                  )}
                  {isInstalled && (
                    <Badge variant="success">
                      <Check className="h-3 w-3" />
                      {t("common.installed", "Installed")}
                    </Badge>
                  )}
                </div>

                <DialogDescription className="mt-1 line-clamp-3 break-words">
                  {description}
                </DialogDescription>

                <div className="mt-2 flex min-w-0 items-center gap-2">
                  <code className="min-w-0 truncate rounded bg-muted px-2 py-1 font-mono text-xs">
                    {slug}
                  </code>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 shrink-0 p-0"
                    onClick={handleCopySlug}
                    aria-label={t("common.copy", "Copy")}
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Download className="h-4 w-4" />
              <span>Downloads: {formatSkillCount(downloads)}</span>
            </div>
            {isOfficial ? (
              <div className="flex items-center gap-1.5">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                <span>Stars: {formatSkillCount(data.stars)}</span>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-1.5">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  <span>Rating: {data.ratingAvg.toFixed(1)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Heart className="h-4 w-4" />
                  <span>Favorites: {formatSkillCount(data.favoritesCount)}</span>
                </div>
              </>
            )}
            <span className="font-mono">v{version}</span>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="space-y-6 p-6">
            {isOfficial ? (
              <OfficialDetails skill={skill.data} />
            ) : (
              <CommunityDetails skill={skill.data} />
            )}
          </div>
        </ScrollArea>

        <div className="border-t p-6 pt-4">
          {isInstalling && (
            <div className="mb-4 space-y-1.5" aria-live="polite">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{t("skillsMarket.installing", "Installing")}</span>
                <span className="font-mono">{installProgress}%</span>
              </div>
              <Progress
                value={installProgress}
                className="h-1.5"
                aria-label={t(
                  "skillsMarket.installProgress",
                  "Install progress"
                )}
              />
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("common.close", "Close")}
            </Button>
            <div className="flex-1" />
            {onInstall && (
              <Button
                type="button"
                variant={isInstalled ? "outline" : "default"}
                onClick={handleInstall}
                disabled={isInstalled || isInstalling}
              >
                {isInstalling ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("skillsMarket.installing", "Installing")}
                  </>
                ) : isInstalled ? (
                  <>
                    <Check className="h-4 w-4" />
                    {t("common.installed", "Installed")}
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    {t("skillsMarket.install", "Install")}
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type OfficialSkill = Extract<SkillDetailItem, { source: "official" }>["data"];
type CommunitySkill = Extract<SkillDetailItem, { source: "community" }>["data"];

function OfficialDetails({ skill }: { skill: OfficialSkill }) {
  const { t } = useTranslation();
  const ownerName =
    skill.ownerName ?? skill.ownerHandle ?? t("skillsMarket.clawhub", "ClaWHub");
  const ownerHandle = skill.ownerHandle ?? "clawhub";

  return (
    <>
      {skill.executesCode && (
        <section className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
          {t("skillsMarket.executesCodeWarning", "This skill executes code")}
        </section>
      )}

      <section>
        <h4 className="mb-2 text-sm font-medium">
          {t("skillsMarket.owner", "Owner")}
        </h4>
        <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
          <Avatar>
            <AvatarImage src={skill.ownerAvatar ?? undefined} alt={ownerName} />
            <AvatarFallback>{getSkillInitials(ownerName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{ownerName}</p>
            <p className="truncate text-xs text-muted-foreground">@{ownerHandle}</p>
          </div>
        </div>
      </section>

      <section>
        <h4 className="mb-2 text-sm font-medium">
          {t("skillsMarket.metadata", "Metadata")}
        </h4>
        <div className="space-y-2 text-sm text-muted-foreground">
          <div>Channel: {skill.channel}</div>
          <div>Downloads: {formatSkillCount(skill.downloads)}</div>
          <div>Stars: {formatSkillCount(skill.stars)}</div>
          <DateRow label="Created" value={skill.createdAt} />
          <DateRow label="Updated" value={skill.updatedAt} />
        </div>
      </section>
    </>
  );
}

function CommunityDetails({ skill }: { skill: CommunitySkill }) {
  const { t } = useTranslation();
  const authorName =
    skill.author?.displayName ??
    skill.author?.username ??
    t("skillsMarket.unknownAuthor", "Unknown author");
  const triggerPatterns = skill.triggerPatterns ?? [];
  const tags = skill.tags ?? [];

  return (
    <>
      <section>
        <h4 className="mb-2 text-sm font-medium">
          {t("skillsMarket.author", "Author")}
        </h4>
        <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
          <Avatar>
            <AvatarImage src={skill.author?.avatarUrl ?? undefined} alt={authorName} />
            <AvatarFallback>{getSkillInitials(authorName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{authorName}</p>
            {skill.author?.username && (
              <p className="truncate text-xs text-muted-foreground">
                @{skill.author.username}
              </p>
            )}
          </div>
        </div>
      </section>

      {triggerPatterns.length > 0 && (
        <section>
          <h4 className="mb-2 text-sm font-medium">
            {t("skillsMarket.triggerPatterns", "Trigger patterns")}
          </h4>
          <div className="space-y-2">
            {triggerPatterns.map((pattern) => (
              <code
                key={pattern}
                className="block break-all rounded-lg bg-muted px-3 py-2 font-mono text-xs"
              >
                {pattern}
              </code>
            ))}
          </div>
        </section>
      )}

      {tags.length > 0 && (
        <section>
          <h4 className="mb-2 text-sm font-medium">
            {t("skillsMarket.tags", "Tags")}
          </h4>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="flex items-center gap-1 rounded bg-muted px-2.5 py-1 text-xs"
              >
                <Tag className="h-3 w-3" />
                {tag}
              </span>
            ))}
          </div>
        </section>
      )}

      {skill.category && (
        <section>
          <h4 className="mb-2 text-sm font-medium">
            {t("skillsMarket.category", "Category")}
          </h4>
          <Badge variant="outline">{skill.category}</Badge>
        </section>
      )}

      {skill.repositoryUrl && (
        <section>
          <h4 className="mb-2 text-sm font-medium">
            {t("skillsMarket.links", "Links")}
          </h4>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() =>
              window.open(skill.repositoryUrl!, "_blank", "noopener,noreferrer")
            }
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {t("skillsMarket.repository", "Repository")}
          </Button>
        </section>
      )}

      <section>
        <h4 className="mb-2 text-sm font-medium">
          {t("skillsMarket.metadata", "Metadata")}
        </h4>
        <div className="space-y-2 text-sm text-muted-foreground">
          <DateRow label="Created" value={skill.createdAt} />
          <DateRow label="Updated" value={skill.updatedAt} />
        </div>
      </section>
    </>
  );
}

function DateRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-2">
      <Calendar className="h-4 w-4" />
      <span>
        {label}: {formatDate(value)}
      </span>
    </div>
  );
}

export default SkillDetail;
