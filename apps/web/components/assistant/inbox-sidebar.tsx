"use client";

import {
  Archive,
  ChevronDown,
  CircleAlert,
  CircleDashed,
  FolderGit2,
  MessageSquare,
  GitBranch,
  GitMerge,
  GitPullRequest,
  Loader2,
  Monitor,
  Moon,
  Pencil,
  Pin,
  Plus,
  Settings,
  Share2,
  Trash2,
  TriangleAlert,
  MoreHorizontal,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BranchPickerDialog } from "@/components/assistant/branch-picker-dialog";
import { getValidRenameTitle } from "@/components/assistant/inbox-sidebar-rename";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSidebar } from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/assistant/use-mobile";
import { useTranslation } from "react-i18next";
import { useLeaderboardRank } from "@/hooks/assistant/use-leaderboard-rank";
import { useSession } from "@/hooks/assistant/use-session";
import type { SessionWithUnread } from "@/hooks/assistant/use-sessions";
import type { Session as AuthSession } from "@/lib/session/types";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { getUsageLeaderboardDomain } from "@/lib/usage/leaderboard-domain";

type InboxSidebarProps = {
  sessions: SessionWithUnread[];
  archivedCount: number;
  sessionsLoading: boolean;
  activeSessionId: string;
  pendingSessionId: string | null;
  onSessionClick: (session: SessionWithUnread) => void;
  onSessionPrefetch: (session: SessionWithUnread) => void;
  onRenameSession?: (sessionId: string, title: string) => Promise<void>;
  onArchiveSession: (sessionId: string) => Promise<void>;
  onUnarchiveSession: (sessionId: string) => Promise<void>;
  onDeleteSession: (sessionId: string) => Promise<void>;
  onOpenNewSession: () => void;
  onCreateSessionForRepo: (repoOwner: string, repoName: string) => void;
  onCreateSessionFromBranch: (
    repoOwner: string,
    repoName: string,
    branch: string,
  ) => void;
  initialUser?: AuthSession["user"];
};

type ArchivedSessionsResponse = {
  sessions: SessionWithUnread[];
  archivedCount: number;
  pagination?: {
    hasMore: boolean;
    nextOffset: number;
  };
  error?: string;
};

const ARCHIVED_SESSIONS_PAGE_SIZE = 50;

const sessionRowPerformanceStyle: CSSProperties = {
  contentVisibility: "auto",
  containIntrinsicSize: "2.25rem",
};

function formatDomainOrg(domain: string): string {
  const dotIndex = domain.indexOf(".");
  const name = dotIndex > 0 ? domain.slice(0, dotIndex) : domain;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function getAvatarFallback(username: string): string {
  const normalized = username.trim();
  if (!normalized) {
    return "?";
  }

  return normalized.slice(0, 2).toUpperCase();
}

function DiffStats({
  added,
  removed,
}: {
  added: number | null;
  removed: number | null;
}) {
  if (added === null && removed === null) return null;
  if (added === 0 && removed === 0) return null;

  return (
    <span className="flex items-center gap-0.5 font-mono text-[10px]">
      {added !== null ? (
        <span className="text-green-600 dark:text-green-500">+{added}</span>
      ) : null}
      {removed !== null ? (
        <span className="text-red-600 dark:text-red-400">-{removed}</span>
      ) : null}
    </span>
  );
}

function getSessionStatusIcon(session: SessionWithUnread) {
  // Actively streaming / waiting for LLM
  if (session.hasStreaming) {
    return (
      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
    );
  }

  // PR merged → purple merge icon
  if (session.prNumber && session.prStatus === "merged") {
    return <GitMerge className="h-3.5 w-3.5 shrink-0 text-purple-500" />;
  }

  // PR open → green PR icon (awaiting review)
  if (session.prNumber && session.prStatus === "open") {
    return <GitPullRequest className="h-3.5 w-3.5 shrink-0 text-green-500" />;
  }

  // PR closed (not merged)
  if (session.prNumber && session.prStatus === "closed") {
    return <GitPullRequest className="h-3.5 w-3.5 shrink-0 text-red-500" />;
  }

  // Has a branch with code changes → needs human follow-up
  const hasDiff = session.linesAdded || session.linesRemoved;
  if (session.branch && hasDiff) {
    return <GitBranch className="h-3.5 w-3.5 shrink-0 text-amber-500" />;
  }

  // Has a branch but no changes yet → new session, still getting started
  if (session.branch) {
    return (
      <GitBranch className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
    );
  }

  // No repository — plain chat session
  const isChat = !session.repoName?.trim();
  if (isChat) {
    if (session.lifecycleState === "provisioning") {
      return <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground/50" />;
    }
    if (session.lifecycleState === "failed") {
      return <CircleAlert className="h-3.5 w-3.5 shrink-0 text-destructive/70" />;
    }
    return <CircleDashed className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />;
  }

  // Repo session — show sandbox provisioning/restoring state
  if (session.lifecycleState === "provisioning" || session.lifecycleState === "restoring") {
    return <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground/50" />;
  }
  if (session.lifecycleState === "active") {
    return <Monitor className="h-3.5 w-3.5 shrink-0 text-emerald-500/80" />;
  }
  if (session.lifecycleState === "hibernating") {
    return <Moon className="h-3.5 w-3.5 shrink-0 text-amber-500/70" />;
  }
  if (session.lifecycleState === "hibernated") {
    return <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-amber-500" />;
  }
  if (session.lifecycleState === "failed") {
    return <CircleAlert className="h-3.5 w-3.5 shrink-0 text-destructive/70" />;
  }
  if (session.status === "running") {
    return <Monitor className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />;
  }

  return <Monitor className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />;
}

function getSessionStatusLabel(
  session: SessionWithUnread,
  t: (key: string) => string,
): {
  text: string;
  prNumber: number | null;
} {
  if (session.hasStreaming) return { text: t("assistant.sidebar.statusWorking"), prNumber: null };
  if (session.prNumber && session.prStatus === "merged")
    return { text: `PR #${session.prNumber}`, prNumber: session.prNumber };
  if (session.prNumber && session.prStatus === "open")
    return { text: `PR #${session.prNumber}`, prNumber: session.prNumber };
  if (session.prNumber && session.prStatus === "closed")
    return { text: `PR #${session.prNumber}`, prNumber: session.prNumber };
  const hasDiff = session.linesAdded || session.linesRemoved;
  if (session.branch && hasDiff)
    return { text: t("assistant.sidebar.statusNeedsAttention"), prNumber: null };
  if (session.branch) return { text: t("assistant.sidebar.statusNewSession"), prNumber: null };
  // No branch: sandbox lifecycle states
  if (session.lifecycleState === "provisioning")
    return { text: t("assistant.sidebar.statusSettingUp"), prNumber: null };
  if (session.lifecycleState === "restoring")
    return { text: t("assistant.sidebar.statusRestoring"), prNumber: null };
  if (session.lifecycleState === "active")
    return { text: t("assistant.sidebar.statusSandboxReady"), prNumber: null };
  if (session.lifecycleState === "hibernating")
    return { text: t("assistant.sidebar.statusHibernating"), prNumber: null };
  if (session.lifecycleState === "hibernated")
    return { text: t("assistant.sidebar.statusNoSandbox"), prNumber: null };
  if (session.lifecycleState === "failed")
    return { text: t("assistant.sidebar.statusFailed"), prNumber: null };
  if (session.status === "running")
    return { text: t("assistant.sidebar.statusSandboxRunning"), prNumber: null };
  if (session.status === "completed")
    return { text: t("assistant.sidebar.statusCompleted"), prNumber: null };
  if (session.status === "failed") return { text: t("assistant.sidebar.statusFailed"), prNumber: null };
  if (session.status === "archived")
    return { text: t("assistant.sidebar.statusArchived"), prNumber: null };
  return { text: t("assistant.sidebar.statusIdle"), prNumber: null };
}

function getSessionBranchUrl(session: SessionWithUnread): string | null {
  // Only link if the branch is known to exist on GitHub (has a PR).
  // Local-only branches that haven't been pushed would 404.
  if (
    !session.branch ||
    !session.repoOwner ||
    !session.repoName ||
    !session.prNumber
  )
    return null;
  return `https://github.com/${session.repoOwner}/${session.repoName}/tree/${session.branch}`;
}

function getSessionPrUrl(session: SessionWithUnread): string | null {
  if (!session.prNumber || !session.repoOwner || !session.repoName) return null;
  return `https://github.com/${session.repoOwner}/${session.repoName}/pull/${session.prNumber}`;
}

function SessionPopoverContent({ session }: { session: SessionWithUnread }) {
  const { t } = useTranslation();
  const lastActivityLabel = formatRelativeTime(
    session.lastActivityAt ?? session.createdAt,
  );
  const branchUrl = getSessionBranchUrl(session);
  const prUrl = getSessionPrUrl(session);
  const hasDiff = session.linesAdded !== null || session.linesRemoved !== null;
  const statusLabel = getSessionStatusLabel(session, t);

  return (
    <div className="space-y-2">
      {/* Title */}
      <p className="text-sm font-medium text-foreground leading-snug">
        {session.title}
      </p>

      {/* Status + branch */}
      <div className="flex items-center gap-1.5 overflow-hidden whitespace-nowrap text-xs text-muted-foreground">
        <span className="shrink-0">{getSessionStatusIcon(session)}</span>
        {prUrl && statusLabel.prNumber ? (
          <a
            href={prUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 hover:text-foreground transition-colors"
          >
            {statusLabel.text}
          </a>
        ) : (
          <span className="shrink-0">{statusLabel.text}</span>
        )}
        {session.branch ? (
          <span className="flex min-w-0 items-center gap-1 ml-1">
            <GitBranch className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
            {branchUrl ? (
              <a
                href={branchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 truncate font-mono text-[11px] hover:text-foreground transition-colors"
              >
                {session.branch}
              </a>
            ) : (
              <span className="min-w-0 truncate font-mono text-[11px]">
                {session.branch}
              </span>
            )}
          </span>
        ) : null}
      </div>

      {/* Diff stats + time ago */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        {hasDiff ? (
          <DiffStats
            added={session.linesAdded}
            removed={session.linesRemoved}
          />
        ) : (
          <span />
        )}
        <span className="shrink-0">{lastActivityLabel}</span>
      </div>
    </div>
  );
}

type SessionRepoGroup = {
  id: string;
  label: string;
  sessions: SessionWithUnread[];
};

function getRepoGroupId(session: SessionWithUnread): string {
  const repoName = session.repoName?.trim();
  const repoOwner = session.repoOwner?.trim();

  if (!repoName) {
    return "repo:unscoped";
  }

  return `repo:${repoOwner ?? ""}/${repoName}`.toLowerCase();
}

function getRepoGroupLabel(session: SessionWithUnread, t: (key: string) => string): string {
  const repoName = session.repoName?.trim();
  const repoOwner = session.repoOwner?.trim();

  if (!repoName) {
    return t("assistant.sidebar.chats");
  }

  return repoOwner ? `${repoOwner}/${repoName}` : repoName;
}

function groupSessionsByRepo(
  sessions: SessionWithUnread[],
  t: (key: string) => string,
): SessionRepoGroup[] {
  const groups = new Map<string, SessionRepoGroup>();

  for (const session of sessions) {
    const groupId = getRepoGroupId(session);
    const existingGroup = groups.get(groupId);

    if (existingGroup) {
      existingGroup.sessions.push(session);
      continue;
    }

    groups.set(groupId, {
      id: groupId,
      label: getRepoGroupLabel(session, t),
      sessions: [session],
    });
  }

  const result = Array.from(groups.values());
  const unscopedIndex = result.findIndex((g) => g.id === "repo:unscoped");
  if (unscopedIndex > 0) {
    const [unscoped] = result.splice(unscopedIndex, 1);
    result.unshift(unscoped);
  }
  return result;
}

function getRepoGroupContentId(groupId: string): string {
  return `repo-group-panel-${groupId.replace(/[^a-z0-9-]+/gi, "-")}`;
}

type SessionRowProps = {
  session: SessionWithUnread;
  isActive: boolean;
  isPending: boolean;
  isPinned: boolean;
  onSessionClick: (session: SessionWithUnread) => void;
  onSessionPrefetch: (session: SessionWithUnread) => void;
  onRenameSession?: (sessionId: string, title: string) => Promise<void>;
  onArchiveSession: (session: SessionWithUnread) => void;
  onUnarchiveSession: (session: SessionWithUnread) => void;
  onDeleteSession: (session: SessionWithUnread) => void;
  onTogglePin: (sessionId: string) => void;
};

const SessionRow = memo(function SessionRow({
  session,
  isActive,
  isPending,
  isPinned,
  onSessionClick,
  onSessionPrefetch,
  onRenameSession,
  onArchiveSession,
  onUnarchiveSession,
  onDeleteSession,
  onTogglePin,
}: SessionRowProps) {
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  const [isHovered, setIsHovered] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(session.title);
  const [renamePending, setRenamePending] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isRenaming) {
      setRenameValue(session.title);
    }
  }, [isRenaming, session.title]);

  useEffect(() => {
    if (!isRenaming || !renameInputRef.current) {
      return;
    }

    renameInputRef.current.focus();
    renameInputRef.current.select();
  }, [isRenaming]);

  const hasDiff = session.linesAdded !== null || session.linesRemoved !== null;

  const handleMouseEnter = useCallback(() => {
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
    setIsHovered(true);
    if (!isMobile && !isRenaming) {
      hoverTimeoutRef.current = setTimeout(() => {
        setPopoverOpen(true);
      }, 500);
    }
  }, [isMobile, isRenaming]);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsHovered(false);
    leaveTimeoutRef.current = setTimeout(() => {
      setPopoverOpen(false);
    }, 200);
  }, []);

  const handleCancelRename = useCallback(() => {
    setRenameValue(session.title);
    setRenamePending(false);
    setIsRenaming(false);
  }, [session.title]);

  const handleFinishRename = useCallback(async () => {
    if (!onRenameSession) {
      handleCancelRename();
      return;
    }

    const nextTitle = getValidRenameTitle({
      draftTitle: renameValue,
      originalTitle: session.title,
    });
    if (!nextTitle) {
      handleCancelRename();
      return;
    }

    setRenamePending(true);
    try {
      await onRenameSession(session.id, nextTitle);
    } catch (error) {
      console.error("Failed to rename session:", error);
    } finally {
      setRenamePending(false);
      setIsRenaming(false);
    }
  }, [
    handleCancelRename,
    onRenameSession,
    renameValue,
    session.id,
    session.title,
  ]);

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      if (leaveTimeoutRef.current) clearTimeout(leaveTimeoutRef.current);
    };
  }, []);

  const hasShowUnreadDot = session.hasUnread && !isActive;

  const actionButtons = (
    <span className="flex shrink-0 items-center">
      {/* Unread dot — always visible when session has unread and not active */}
      {hasShowUnreadDot && (
        <span className="mr-1 h-2 w-2 shrink-0 rounded-full bg-destructive" />
      )}
      {/* More menu — always visible on hover or when menu is open */}
      <DropdownMenu open={moreMenuOpen} onOpenChange={setMoreMenuOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex h-5 w-5 items-center justify-center rounded text-muted-foreground/60 transition-all hover:text-muted-foreground",
              !isHovered && !moreMenuOpen ? "hidden" : "",
            )}
            aria-label={t("assistant.sidebar.moreActions")}
            onClick={(event) => { event.stopPropagation(); }}
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem
            onClick={(event) => {
              event.stopPropagation();
              onTogglePin(session.id);
              setMoreMenuOpen(false);
            }}
          >
            <Pin className="mr-2 h-4 w-4" />
            {isPinned ? "取消置顶" : "置顶"}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(event) => {
              event.stopPropagation();
              const url = `${window.location.origin}/assistant/${session.id}`;
              navigator.clipboard.writeText(url).catch(() => {});
              setMoreMenuOpen(false);
            }}
          >
            <Share2 className="mr-2 h-4 w-4" />
            分享
          </DropdownMenuItem>
          {onRenameSession ? (
            <DropdownMenuItem
              onClick={(event) => {
                event.stopPropagation();
                if (hoverTimeoutRef.current) {
                  clearTimeout(hoverTimeoutRef.current);
                  hoverTimeoutRef.current = null;
                }
                setPopoverOpen(false);
                setMoreMenuOpen(false);
                setRenameValue(session.title);
                setIsRenaming(true);
              }}
            >
              <Pencil className="mr-2 h-4 w-4" />
              重命名
            </DropdownMenuItem>
          ) : null}
          {session.status === "archived" ? (
            <DropdownMenuItem
              onClick={(event) => {
                event.stopPropagation();
                setMoreMenuOpen(false);
                onUnarchiveSession(session);
              }}
            >
              <Archive className="mr-2 h-4 w-4" />
              取消归档
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onClick={(event) => {
                event.stopPropagation();
                setMoreMenuOpen(false);
                onArchiveSession(session);
              }}
            >
              <Archive className="mr-2 h-4 w-4" />
              归档
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={(event) => {
              event.stopPropagation();
              setMoreMenuOpen(false);
              onDeleteSession(session);
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            删除
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {/* Pin icon — shown when not hovering and item is pinned */}
      {isPinned && !isHovered && !moreMenuOpen && (
        <Pin className="h-3 w-3 shrink-0 text-muted-foreground/50" />
      )}
    </span>
  );

  const sessionButton = (
    <button
      type="button"
      className={`group relative flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left outline-none transition-[background-color,opacity] cursor-pointer ${
        isActive ? "bg-sidebar-active" : "hover:bg-muted/50"
      } ${isPending ? "opacity-80" : "opacity-100"}`}
      onClick={() => onSessionClick(session)}
      onFocus={() => onSessionPrefetch(session)}
      aria-busy={isPending}
    >
      <span className="min-w-0 flex-1 text-left">
        <p
          className={`truncate text-[13px] leading-5 ${
            session.hasUnread && !isActive
              ? "font-semibold text-foreground"
              : "font-normal text-foreground/85"
          }`}
        >
          {session.title}
        </p>
      </span>
      {!isHovered && !moreMenuOpen && (
        <span className="flex h-4 w-4 shrink-0 items-center justify-center">
          {getSessionStatusIcon(session)}
        </span>
      )}
    </button>
  );

  const rowButton = isRenaming ? (
    <div
      className={`group relative flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left outline-none transition-[background-color,opacity] ${
        isActive ? "bg-sidebar-active" : "bg-muted/50"
      } ${renamePending ? "opacity-80" : "opacity-100"}`}
      style={sessionRowPerformanceStyle}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">
        {getSessionStatusIcon(session)}
      </span>
      <span className="min-w-0 flex-1 text-left">
        <input
          ref={renameInputRef}
          value={renameValue}
          onChange={(event) => setRenameValue(event.target.value)}
          onBlur={() => {
            void handleFinishRename();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void handleFinishRename();
            } else if (event.key === "Escape") {
              event.preventDefault();
              handleCancelRename();
            }
          }}
          disabled={renamePending}
          maxLength={120}
          className="h-5 w-full rounded border-0 bg-transparent p-0 text-[13px] leading-5 text-foreground outline-none"
        />
      </span>
    </div>
  ) : (
    <div
      className="relative"
      style={sessionRowPerformanceStyle}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {sessionButton}
      <span className="absolute top-1/2 right-2 flex shrink-0 -translate-y-1/2 items-center justify-end gap-0.5">
        {actionButtons}
      </span>
    </div>
  );

  if (isMobile || isRenaming) {
    return rowButton;
  }

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <div
        className="relative"
        style={sessionRowPerformanceStyle}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <PopoverTrigger asChild>{sessionButton}</PopoverTrigger>
        <span className="absolute top-1/2 right-2 flex shrink-0 -translate-y-1/2 items-center justify-end gap-0.5">
          {actionButtons}
        </span>
      </div>
      <PopoverContent
        side="right"
        align="start"
        sideOffset={12}
        className="w-72 p-3"
        onMouseEnter={() => {
          if (leaveTimeoutRef.current) {
            clearTimeout(leaveTimeoutRef.current);
            leaveTimeoutRef.current = null;
          }
        }}
        onMouseLeave={handleMouseLeave}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SessionPopoverContent session={session} />
      </PopoverContent>
    </Popover>
  );
}, areSessionRowsEqual);

function areSessionRowsEqual(
  prev: SessionRowProps,
  next: SessionRowProps,
): boolean {
  if (prev.isActive !== next.isActive || prev.isPending !== next.isPending || prev.isPinned !== next.isPinned) {
    return false;
  }

  return (
    prev.session.id === next.session.id &&
    prev.session.title === next.session.title &&
    prev.session.hasStreaming === next.session.hasStreaming &&
    prev.session.hasUnread === next.session.hasUnread &&
    prev.session.repoOwner === next.session.repoOwner &&
    prev.session.repoName === next.session.repoName &&
    prev.session.branch === next.session.branch &&
    prev.session.prNumber === next.session.prNumber &&
    prev.session.prStatus === next.session.prStatus &&
    prev.session.linesAdded === next.session.linesAdded &&
    prev.session.linesRemoved === next.session.linesRemoved &&
    String(prev.session.lastActivityAt) === String(next.session.lastActivityAt)
  );
}

const PINNED_SESSIONS_STORAGE_KEY = "viben-pinned-sessions";

function usePinnedSessions(): [Set<string>, (sessionId: string) => void] {
  const [pinned, setPinned] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = localStorage.getItem(PINNED_SESSIONS_STORAGE_KEY);
      if (raw) {
        const ids: string[] = JSON.parse(raw);
        if (Array.isArray(ids)) return new Set(ids);
      }
    } catch { /* ignore */ }
    return new Set();
  });

  const togglePin = useCallback((sessionId: string) => {
    setPinned((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      try {
        localStorage.setItem(
          PINNED_SESSIONS_STORAGE_KEY,
          JSON.stringify([...next]),
        );
      } catch { /* ignore */ }
      return next;
    });
  }, []);

  return [pinned, togglePin];
}

export function InboxSidebar({
  sessions,
  archivedCount,
  sessionsLoading,
  activeSessionId,
  pendingSessionId,
  onSessionClick,
  onSessionPrefetch,
  onRenameSession,
  onArchiveSession,
  onUnarchiveSession,
  onDeleteSession,
  onOpenNewSession,
  onCreateSessionForRepo,
  onCreateSessionFromBranch,
  initialUser,
}: InboxSidebarProps) {
  const router = useRouter();
  const { session } = useSession();
  const { rank: leaderboardRank, loading: leaderboardLoading } =
    useLeaderboardRank();
  const { isMobile, setOpenMobile } = useSidebar();
  const [pinned, togglePin] = usePinnedSessions();
  const [showArchived, setShowArchived] = useState(false);
  const [archivedSessions, setArchivedSessions] = useState<SessionWithUnread[]>(
    [],
  );
  const [archivedSessionsLoading, setArchivedSessionsLoading] = useState(false);
  const [archivedSessionsError, setArchivedSessionsError] = useState<
    string | null
  >(null);
  const [hasMoreArchivedSessions, setHasMoreArchivedSessions] = useState(false);
  const archivedRequestInFlightRef = useRef(false);
  const lastLoadedArchivedCountRef = useRef(0);
  const [branchPickerRepo, setBranchPickerRepo] = useState<{
    owner: string;
    repo: string;
  } | null>(null);
  const [isCreatingFromBranch, setIsCreatingFromBranch] = useState(false);
  const [archiveConfirmSession, setArchiveConfirmSession] =
    useState<SessionWithUnread | null>(null);

  const fetchArchivedSessionsPage = useCallback(
    async ({ offset, replace }: { offset: number; replace: boolean }) => {
      if (archivedRequestInFlightRef.current) {
        return;
      }

      archivedRequestInFlightRef.current = true;
      setArchivedSessionsLoading(true);
      setArchivedSessionsError(null);

      try {
        const query = new URLSearchParams({
          status: "archived",
          limit: String(ARCHIVED_SESSIONS_PAGE_SIZE),
          offset: String(offset),
        });
        const res = await fetch(`/api/sessions?${query.toString()}`);
        const data = (await res.json()) as ArchivedSessionsResponse;

        if (!res.ok) {
          throw new Error(data.error ?? "Failed to load archived sessions");
        }

        setArchivedSessions((current) => {
          if (replace) {
            return data.sessions;
          }

          const existingIds = new Set(current.map((session) => session.id));
          const nextSessions = data.sessions.filter(
            (session) => !existingIds.has(session.id),
          );

          return [...current, ...nextSessions];
        });
        lastLoadedArchivedCountRef.current = data.archivedCount;
        setHasMoreArchivedSessions(Boolean(data.pagination?.hasMore));
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to load archived sessions";
        setArchivedSessionsError(message);
      } finally {
        archivedRequestInFlightRef.current = false;
        setArchivedSessionsLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!showArchived) {
      return;
    }

    if (archivedCount === 0) {
      setArchivedSessions([]);
      setHasMoreArchivedSessions(false);
      setArchivedSessionsError(null);
      lastLoadedArchivedCountRef.current = 0;
      return;
    }

    if (lastLoadedArchivedCountRef.current === archivedCount) {
      return;
    }

    void fetchArchivedSessionsPage({ offset: 0, replace: true });
  }, [archivedCount, fetchArchivedSessionsPage, showArchived]);

  const activeSessions = sessions;
  const displayedSessions = showArchived ? archivedSessions : activeSessions;
  const showLoadingSkeleton =
    (!showArchived && sessionsLoading && sessions.length === 0) ||
    (showArchived && archivedSessionsLoading && archivedSessions.length === 0);
  const sidebarUser = session?.user ?? initialUser;
  const groupedSessions = useMemo(
    () => groupSessionsByRepo(displayedSessions).map((group) => ({
      ...group,
      sessions: [...group.sessions].sort((a, b) => {
        // Pinned sessions first
        const aPinned = pinned.has(a.id);
        const bPinned = pinned.has(b.id);
        if (aPinned && !bPinned) return -1;
        if (!aPinned && bPinned) return 1;
        return 0;
      }),
    })),
    [displayedSessions, pinned],
  );
  const activeGroupId = useMemo(
    () =>
      groupedSessions.find((group) =>
        group.sessions.some((session) => session.id === activeSessionId),
      )?.id ?? null,
    [activeSessionId, groupedSessions],
  );
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<
    Record<string, boolean>
  >({});

  useEffect(() => {
    setCollapsedGroupIds((current) => {
      const next: Record<string, boolean> = {};
      let changed = false;

      for (const group of groupedSessions) {
        const nextCollapsed =
          group.id === activeGroupId ? false : (current[group.id] ?? false);

        next[group.id] = nextCollapsed;

        if (current[group.id] !== nextCollapsed) {
          changed = true;
        }
      }

      if (!changed) {
        const currentIds = Object.keys(current);
        if (currentIds.length !== groupedSessions.length) {
          changed = true;
        }
      }

      return changed ? next : current;
    });
  }, [activeGroupId, groupedSessions]);

  const handleSessionClick = useCallback(
    (session: SessionWithUnread) => {
      if (isMobile) {
        setOpenMobile(false);
      }
      onSessionClick(session);
    },
    [isMobile, onSessionClick, setOpenMobile],
  );

  const handleSessionPrefetch = useCallback(
    (session: SessionWithUnread) => {
      onSessionPrefetch(session);
    },
    [onSessionPrefetch],
  );

  const handleToggleRepoGroup = useCallback((groupId: string) => {
    setCollapsedGroupIds((current) => ({
      ...current,
      [groupId]: !current[groupId],
    }));
  }, []);

  const handleArchiveSession = useCallback((session: SessionWithUnread) => {
    setArchiveConfirmSession(session);
  }, []);

  const handleConfirmArchive = useCallback(async () => {
    if (!archiveConfirmSession) return;
    const session = archiveConfirmSession;
    setArchiveConfirmSession(null);
    try {
      await onArchiveSession(session.id);
      setArchivedSessions((current) => {
        const nextSessions = [
          { ...session, status: "archived" as const },
          ...current.filter(
            (existingSession) => existingSession.id !== session.id,
          ),
        ];
        const maxCachedSessions = Math.max(
          current.length,
          ARCHIVED_SESSIONS_PAGE_SIZE,
        );

        return nextSessions.slice(0, maxCachedSessions);
      });
      setHasMoreArchivedSessions(
        (currentHasMore) =>
          currentHasMore || archivedCount + 1 > ARCHIVED_SESSIONS_PAGE_SIZE,
      );
    } catch (err) {
      console.error("Failed to archive session:", err);
    }
  }, [archiveConfirmSession, archivedCount, onArchiveSession]);

  const handleUnarchiveSession = useCallback(
    async (session: SessionWithUnread) => {
      try {
        await onUnarchiveSession(session.id);
        setArchivedSessions((current) =>
          current.filter(
            (existingSession) => existingSession.id !== session.id,
          ),
        );
      } catch (err) {
        console.error("Failed to unarchive session:", err);
      }
    },
    [onUnarchiveSession],
  );

  const handleDeleteSession = useCallback(
    async (session: SessionWithUnread) => {
      try {
        await onDeleteSession(session.id);
        setArchivedSessions((current) =>
          current.filter((s) => s.id !== session.id),
        );
      } catch (err) {
        console.error("Failed to delete session:", err);
      }
    },
    [onDeleteSession],
  );

  const handleLoadMoreArchivedSessions = useCallback(() => {
    if (archivedSessionsLoading) {
      return;
    }

    void fetchArchivedSessionsPage({
      offset: archivedSessions.length,
      replace: false,
    });
  }, [
    archivedSessions.length,
    archivedSessionsLoading,
    fetchArchivedSessionsPage,
  ]);

  const handleRetryArchivedSessions = useCallback(() => {
    void fetchArchivedSessionsPage({ offset: 0, replace: true });
  }, [fetchArchivedSessionsPage]);

  const handleCreateForRepo = useCallback(
    (owner: string, repo: string) => {
      if (isMobile) setOpenMobile(false);
      onCreateSessionForRepo(owner, repo);
    },
    [isMobile, setOpenMobile, onCreateSessionForRepo],
  );

  const handleOpenBranchPicker = useCallback((owner: string, repo: string) => {
    setBranchPickerRepo({ owner, repo });
  }, []);

  const handleBranchSelected = useCallback(
    async (branch: string) => {
      if (!branchPickerRepo) return;
      setIsCreatingFromBranch(true);
      try {
        await onCreateSessionFromBranch(
          branchPickerRepo.owner,
          branchPickerRepo.repo,
          branch,
        );
        setBranchPickerRepo(null);
        if (isMobile) setOpenMobile(false);
      } catch (error) {
        console.error("Failed to create session from branch:", error);
      } finally {
        setIsCreatingFromBranch(false);
      }
    },
    [branchPickerRepo, onCreateSessionFromBranch, isMobile, setOpenMobile],
  );

  return (
    <>
      <div className="border-b border-border p-3">
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            if (isMobile) {
              setOpenMobile(false);
            }
            onOpenNewSession();
          }}
          className="mb-3 w-full justify-start gap-2 text-sm font-medium"
        >
          <MessageSquare className="h-4 w-4" />
          新对话
        </Button>

        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setShowArchived(false)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              !showArchived
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Active
            {activeSessions.length > 0 && (
              <span className="ml-1.5 text-muted-foreground">
                {activeSessions.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setShowArchived(true)}
            className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              showArchived
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Archive className="h-3 w-3" />
            Archive
            {archivedCount > 0 && (
              <span className="ml-1 text-muted-foreground">
                {archivedCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {showLoadingSkeleton ? (
          <div className="space-y-1 p-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="space-y-1.5 rounded-md px-3 py-2.5">
                <div className="h-3.5 w-3/4 animate-pulse rounded bg-muted" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : displayedSessions.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">
            {showArchived
              ? (archivedSessionsError ?? "No archived sessions")
              : "No sessions yet"}
            {showArchived && archivedSessionsError ? (
              <div className="mt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRetryArchivedSessions}
                >
                  Retry
                </Button>
              </div>
            ) : null}
          </div>
        ) : (
          <>
            <div className="space-y-3 p-1.5">
              {groupedSessions.map((group) => {
                const isCollapsed = collapsedGroupIds[group.id] ?? false;
                const groupHasActiveSession = group.id === activeGroupId;
                const groupContentId = getRepoGroupContentId(group.id);

                const groupRepoOwner =
                  group.sessions[0]?.repoOwner?.trim() ?? "";
                const groupRepoName = group.sessions[0]?.repoName?.trim() ?? "";
                const hasRepo = Boolean(groupRepoOwner && groupRepoName);

                return (
                  <section key={group.id} className="space-y-1.5">
                    <div
                      className={`group/repo flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left transition-colors ${
                        groupHasActiveSession
                          ? "text-foreground"
                          : "text-muted-foreground hover:text-foreground/85"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleToggleRepoGroup(group.id)}
                        aria-controls={groupContentId}
                        aria-expanded={!isCollapsed}
                        className="flex min-w-0 flex-1 items-center gap-1.5"
                      >
                        <ChevronDown
                          className={`h-3.5 w-3.5 shrink-0 text-muted-foreground/70 transition-transform duration-200 ${
                            isCollapsed ? "-rotate-90" : "rotate-0"
                          }`}
                          />
                        <span className="min-w-0 truncate text-[12px] font-medium">
                          {group.label}
                        </span>
                      </button>
                      {hasRepo ? (
                        <span
                          className={`shrink-0 items-center gap-0.5 ${isMobile ? "flex" : "hidden group-hover/repo:flex"}`}
                        >
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenBranchPicker(
                                    groupRepoOwner,
                                    groupRepoName,
                                  );
                                }}
                                className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground/70 transition-colors hover:text-foreground"
                                aria-label={`Create session from branch for ${group.label}`}
                              >
                                <GitBranch className="h-3 w-3" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" sideOffset={4}>
                              Create from branch
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCreateForRepo(
                                    groupRepoOwner,
                                    groupRepoName,
                                  );
                                }}
                                className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground/70 transition-colors hover:text-foreground"
                                aria-label={`Create session for ${group.label}`}
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" sideOffset={4}>
                              Create session
                            </TooltipContent>
                          </Tooltip>
                        </span>
                      ) : null}
                    </div>
                    <div
                      id={groupContentId}
                      aria-hidden={isCollapsed}
                      inert={isCollapsed}
                      className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none ${
                        isCollapsed
                          ? "grid-rows-[0fr] opacity-0 pointer-events-none"
                          : "grid-rows-[1fr] opacity-100"
                      }`}
                    >
                      <div className="overflow-hidden">
                        <div className="space-y-1">
                          {group.sessions.map((session) => (
                            <SessionRow
                              key={session.id}
                              session={session}
                              isActive={session.id === activeSessionId}
                              isPending={session.id === pendingSessionId}
                              isPinned={pinned.has(session.id)}
                              onSessionClick={handleSessionClick}
                              onSessionPrefetch={handleSessionPrefetch}
                              onRenameSession={onRenameSession}
                              onArchiveSession={handleArchiveSession}
                              onUnarchiveSession={handleUnarchiveSession}
                              onDeleteSession={handleDeleteSession}
                              onTogglePin={togglePin}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </section>
                );
              })}
            </div>
            {showArchived &&
            (hasMoreArchivedSessions || archivedSessionsError) ? (
              <div className="px-3 pb-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={
                    archivedSessionsError
                      ? handleRetryArchivedSessions
                      : handleLoadMoreArchivedSessions
                  }
                  disabled={archivedSessionsLoading}
                >
                  {archivedSessionsLoading
                    ? "Loading..."
                    : archivedSessionsError
                      ? "Retry loading archived sessions"
                      : "Load more archived sessions"}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>

      {sidebarUser ? (
        <div className="border-t border-border p-3">
          <div className="flex items-center gap-2 rounded-lg p-2">
            <Avatar className="h-9 w-9 shrink-0">
              {sidebarUser.avatar ? (
                <AvatarImage
                  src={sidebarUser.avatar}
                  alt={sidebarUser.username}
                />
              ) : null}
              <AvatarFallback>
                {getAvatarFallback(sidebarUser.username)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold leading-none text-foreground">
                {sidebarUser.username}
              </p>
              {sidebarUser.email ? (
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {sidebarUser.email}
                </p>
              ) : null}
              {leaderboardRank ? (
                <Link
                  href="/settings/leaderboard"
                  className="mt-1 block truncate text-xs text-muted-foreground hover:text-foreground"
                >
                  <span className="font-semibold tabular-nums text-foreground/70">
                    #{leaderboardRank.rank}
                  </span>{" "}
                  in {formatDomainOrg(leaderboardRank.domain)}
                </Link>
              ) : leaderboardLoading &&
                getUsageLeaderboardDomain(sidebarUser.email) ? (
                <span className="mt-1 block h-4 w-24 animate-pulse rounded bg-muted" />
              ) : null}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={() => router.push("/settings")}
              aria-label="Open settings"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}

      {branchPickerRepo ? (
        <BranchPickerDialog
          open={Boolean(branchPickerRepo)}
          onOpenChange={(open) => {
            if (!open) setBranchPickerRepo(null);
          }}
          owner={branchPickerRepo.owner}
          repo={branchPickerRepo.repo}
          isCreating={isCreatingFromBranch}
          onSelectBranch={handleBranchSelected}
        />
      ) : null}

      {/* Archive confirmation dialog */}
      <Dialog
        open={archiveConfirmSession !== null}
        onOpenChange={(open) => {
          if (!open) setArchiveConfirmSession(null);
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Archive session?</DialogTitle>
            <DialogDescription>
              This will stop the sandbox and archive the session. You can still
              view it in the archive tab.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              onClick={() => {
                void handleConfirmArchive();
              }}
            >
              Archive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
