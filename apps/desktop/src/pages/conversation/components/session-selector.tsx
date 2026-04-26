import * as React from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  Plus,
  Check,
  MoreHorizontal,
  Pencil,
  Trash2,
  Pin,
  Archive,
  MessageSquare,
  Search,
  Copy,
  Star,
  StarOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

export interface Session {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  messageCount?: number;
  isPinned?: boolean;
  isStarred?: boolean;
  lastMessage?: string;
  agentName?: string;
}

interface SessionSelectorProps {
  /** Current session */
  currentSession?: Session;
  /** List of available sessions */
  sessions: Session[];
  /** Called when a session is selected */
  onSelect: (session: Session) => void;
  /** Called when creating a new session */
  onCreateNew: () => void;
  /** Called when renaming a session */
  onRename?: (sessionId: string, newName: string) => void;
  /** Called when deleting a session */
  onDelete?: (sessionId: string) => void;
  /** Called when pinning/unpinning a session */
  onPin?: (sessionId: string) => void;
  /** Called when archiving a session */
  onArchive?: (sessionId: string) => void;
  /** Called when starring/unstarring a session */
  onStar?: (sessionId: string) => void;
  /** Called when duplicating a session */
  onDuplicate?: (sessionId: string) => void;
  /** Additional class name */
  className?: string;
  /** Whether to show the plus button */
  showCreateButton?: boolean;
  /** Current agent name for display */
  agentName?: string;
  /** Whether there are more sessions to load */
  hasMore?: boolean;
  /** Called when user scrolls to bottom to load more */
  onLoadMore?: () => void;
  /** Whether loading more sessions */
  isLoadingMore?: boolean;
  /** Total session count (for display) */
  totalCount?: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatRelativeTime(dateStr: string, t: (key: string, fallback: string) => string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return t("common.justNow", "刚刚");
  if (minutes < 60) return `${minutes}${t("common.minutesAgo", "分钟前")}`;
  if (hours < 24) return `${hours}${t("common.hoursAgo", "小时前")}`;
  if (days < 7) return `${days}${t("common.daysAgo", "天前")}`;
  return date.toLocaleDateString();
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

// ============================================================================
// Session Card Component (Enhanced)
// ============================================================================

interface SessionCardProps {
  session: Session;
  isSelected: boolean;
  onSelect: () => void;
  onRename?: () => void;
  onDelete?: () => void;
  onPin?: () => void;
  onArchive?: () => void;
  onStar?: () => void;
  onDuplicate?: () => void;
}

function SessionCard({
  session,
  isSelected,
  onSelect,
  onRename,
  onDelete,
  onPin,
  onArchive,
  onStar,
  onDuplicate,
}: SessionCardProps) {
  const { t } = useTranslation();
  const [showActions, setShowActions] = React.useState(false);

  const hasActions = onRename || onDelete || onPin || onArchive || onStar || onDuplicate;

  return (
    <div
      className={cn(
        "group relative flex items-center gap-2.5 px-2.5 py-2 cursor-pointer transition-all rounded-md",
        isSelected
          ? "bg-primary/10 text-primary"
          : "hover:bg-accent/50"
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      onClick={onSelect}
    >
      {/* Session icon - smaller */}
      <div
        className={cn(
          "shrink-0 w-7 h-7 rounded-md flex items-center justify-center",
          isSelected
            ? "bg-primary/20 text-primary"
            : "bg-muted/50 text-muted-foreground"
        )}
      >
        <MessageSquare className="h-3.5 w-3.5" />
      </div>

      {/* Content - compact layout */}
      <div className="flex-1 min-w-0 overflow-hidden">
        {/* Title row with badges */}
        <div className="flex items-center gap-1.5">
          {session.isPinned && (
            <Pin className="h-3 w-3 text-primary shrink-0" />
          )}
          {session.isStarred && (
            <Star className="h-3 w-3 text-yellow-500 fill-yellow-500 shrink-0" />
          )}
          <span className={cn(
            "text-sm truncate flex-1 min-w-0",
            isSelected ? "font-medium" : "font-normal"
          )}>
            {session.name}
          </span>
        </div>

        {/* Meta row - compact */}
        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
          <span>{formatRelativeTime(session.updatedAt, t)}</span>
          {session.messageCount !== undefined && session.messageCount > 0 && (
            <span className="flex items-center gap-0.5">
              <MessageSquare className="h-2.5 w-2.5" />
              {session.messageCount}
            </span>
          )}
        </div>
      </div>

      {/* Selected check */}
      {isSelected && (
        <Check className="h-4 w-4 text-primary shrink-0" />
      )}

      {/* More actions button */}
      {hasActions && !isSelected && (
        <div
          className={cn(
            "shrink-0 transition-opacity",
            showActions ? "opacity-100" : "opacity-0"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              {onRename && (
                <DropdownMenuItem onClick={onRename} className="text-xs">
                  <Pencil className="h-3.5 w-3.5 mr-2" />
                  {t("chat.renameSession", "重命名")}
                </DropdownMenuItem>
              )}
              {onStar && (
                <DropdownMenuItem onClick={onStar} className="text-xs">
                  {session.isStarred ? (
                    <>
                      <StarOff className="h-3.5 w-3.5 mr-2" />
                      {t("chat.unstarSession", "取消收藏")}
                    </>
                  ) : (
                    <>
                      <Star className="h-3.5 w-3.5 mr-2" />
                      {t("chat.starSession", "收藏")}
                    </>
                  )}
                </DropdownMenuItem>
              )}
              {onPin && (
                <DropdownMenuItem onClick={onPin} className="text-xs">
                  <Pin className="h-3.5 w-3.5 mr-2" />
                  {session.isPinned
                    ? t("chat.unpinSession", "取消置顶")
                    : t("chat.pinSession", "置顶")}
                </DropdownMenuItem>
              )}
              {onDuplicate && (
                <DropdownMenuItem onClick={onDuplicate} className="text-xs">
                  <Copy className="h-3.5 w-3.5 mr-2" />
                  {t("chat.duplicateSession", "复制会话")}
                </DropdownMenuItem>
              )}
              {onArchive && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onArchive} className="text-xs">
                    <Archive className="h-3.5 w-3.5 mr-2" />
                    {t("chat.archiveSession", "归档")}
                  </DropdownMenuItem>
                </>
              )}
              {onDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={onDelete}
                    className="text-destructive focus:text-destructive text-xs"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-2" />
                    {t("chat.deleteSession", "删除")}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function SessionSelector({
  currentSession,
  sessions,
  onSelect,
  onCreateNew,
  onRename,
  onDelete,
  onPin,
  onArchive,
  onStar,
  onDuplicate,
  className,
  showCreateButton = true,
  agentName,
  hasMore,
  onLoadMore,
  isLoadingMore,
  totalCount,
}: SessionSelectorProps) {
  const { t } = useTranslation();
  const [renameSessionId, setRenameSessionId] = React.useState<string | null>(null);
  const [renameValue, setRenameValue] = React.useState("");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isOpen, setIsOpen] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Handle scroll to bottom for infinite loading
  const handleScroll = React.useCallback(() => {
    if (!scrollRef.current || !hasMore || isLoadingMore || !onLoadMore) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    // Load more when scrolled to within 100px of bottom
    if (scrollHeight - scrollTop - clientHeight < 100) {
      onLoadMore();
    }
  }, [hasMore, isLoadingMore, onLoadMore]);

  // Sort sessions: pinned first, starred second, then by updatedAt descending
  const sortedSessions = React.useMemo(() => {
    return [...sessions].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      if (a.isStarred && !b.isStarred) return -1;
      if (!a.isStarred && b.isStarred) return 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [sessions]);

  // Filter sessions by search query
  const filteredSessions = React.useMemo(() => {
    if (!searchQuery.trim()) return sortedSessions;
    const query = searchQuery.toLowerCase();
    return sortedSessions.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        s.lastMessage?.toLowerCase().includes(query)
    );
  }, [sortedSessions, searchQuery]);

  // Group sessions by date
  const groupedSessions = React.useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const groups: { label: string; sessions: Session[] }[] = [];
    const pinned = filteredSessions.filter((s) => s.isPinned);
    const todaySessions = filteredSessions.filter((s) => {
      if (s.isPinned) return false;
      const d = new Date(s.updatedAt);
      return d >= today;
    });
    const yesterdaySessions = filteredSessions.filter((s) => {
      if (s.isPinned) return false;
      const d = new Date(s.updatedAt);
      return d >= yesterday && d < today;
    });
    const thisWeekSessions = filteredSessions.filter((s) => {
      if (s.isPinned) return false;
      const d = new Date(s.updatedAt);
      return d >= weekAgo && d < yesterday;
    });
    const olderSessions = filteredSessions.filter((s) => {
      if (s.isPinned) return false;
      const d = new Date(s.updatedAt);
      return d < weekAgo;
    });

    if (pinned.length > 0) {
      groups.push({ label: t("chat.pinnedSessions", "置顶"), sessions: pinned });
    }
    if (todaySessions.length > 0) {
      groups.push({ label: t("common.today", "今天"), sessions: todaySessions });
    }
    if (yesterdaySessions.length > 0) {
      groups.push({ label: t("common.yesterday", "昨天"), sessions: yesterdaySessions });
    }
    if (thisWeekSessions.length > 0) {
      groups.push({ label: t("common.thisWeek", "本周"), sessions: thisWeekSessions });
    }
    if (olderSessions.length > 0) {
      groups.push({ label: t("chat.olderSessions", "更早"), sessions: olderSessions });
    }

    return groups;
  }, [filteredSessions, t]);

  // Get display name for current session
  const displayName = currentSession
    ? truncateText(currentSession.name, 24)
    : t("chat.newSession", "新会话");

  // Handle rename
  const handleStartRename = (session: Session) => {
    setRenameSessionId(session.id);
    setRenameValue(session.name);
  };

  const handleConfirmRename = () => {
    if (renameSessionId && renameValue.trim() && onRename) {
      onRename(renameSessionId, renameValue.trim());
    }
    setRenameSessionId(null);
    setRenameValue("");
  };

  // Display count - use totalCount if provided, otherwise sessions.length
  const displayCount = totalCount ?? sessions.length;

  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      {/* Session dropdown */}
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 gap-1 font-medium text-sm hover:bg-muted/80 max-w-[200px]"
          >
            <span className="truncate">{displayName}</span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-[320px] p-0"
        >
          {/* Header with search */}
          <div className="px-3 py-2.5 border-b">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-sm">
                {agentName
                  ? t("chat.agentSessions", "{{agent}} 的会话", { agent: agentName })
                  : t("chat.recentSessions", "最近会话")}
              </h3>
              <span className="text-xs text-muted-foreground">
                {displayCount} {t("chat.totalSessions", "个会话")}
              </span>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder={t("chat.searchSessions", "搜索会话...")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-7 text-sm"
              />
            </div>
          </div>

          {/* Session list with infinite scroll */}
          <div
            ref={scrollRef}
            className="max-h-[350px] overflow-y-auto"
            onScroll={handleScroll}
          >
            {filteredSessions.length === 0 ? (
              <div className="py-10 text-center">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">
                  {searchQuery
                    ? t("chat.noSearchResults", "未找到匹配的会话")
                    : t("chat.noSessions", "暂无会话历史")}
                </p>
              </div>
            ) : (
              <div className="p-1.5 space-y-2">
                {groupedSessions.map((group) => (
                  <div key={group.label}>
                    <div className="px-2 py-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                      {group.label}
                    </div>
                    <div className="space-y-0.5">
                      {group.sessions.map((session) => (
                        <SessionCard
                          key={session.id}
                          session={session}
                          isSelected={currentSession?.id === session.id}
                          onSelect={() => {
                            onSelect(session);
                            setIsOpen(false);
                          }}
                          onRename={onRename ? () => handleStartRename(session) : undefined}
                          onDelete={onDelete ? () => onDelete(session.id) : undefined}
                          onPin={onPin ? () => onPin(session.id) : undefined}
                          onArchive={onArchive ? () => onArchive(session.id) : undefined}
                          onStar={onStar ? () => onStar(session.id) : undefined}
                          onDuplicate={onDuplicate ? () => onDuplicate(session.id) : undefined}
                        />
                      ))}
                    </div>
                  </div>
                ))}

                {/* Load more indicator */}
                {isLoadingMore && (
                  <div className="py-2 text-center">
                    <span className="text-xs text-muted-foreground">
                      {t("common.loading", "加载中...")}
                    </span>
                  </div>
                )}

                {/* Load more trigger when scrolled to bottom */}
                {hasMore && !isLoadingMore && (
                  <div className="py-2 text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground"
                      onClick={onLoadMore}
                    >
                      {t("common.loadMore", "加载更多")}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer with create button */}
          {showCreateButton && (
            <div className="p-1.5 border-t">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 h-8 text-primary hover:text-primary hover:bg-primary/5"
                onClick={() => {
                  onCreateNew();
                  setIsOpen(false);
                }}
              >
                <Plus className="h-3.5 w-3.5" />
                {t("chat.createNewSession", "新建会话")}
              </Button>
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Quick create button */}
      {showCreateButton && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={onCreateNew}
          title={t("chat.createNewSession", "新建会话")}
        >
          <Plus className="h-4 w-4" />
        </Button>
      )}

      {/* Rename dialog - simple inline input */}
      {renameSessionId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-lg p-4 shadow-lg w-80 border">
            <h3 className="font-medium mb-3">{t("chat.renameSession", "重命名会话")}</h3>
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className="mb-3"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleConfirmRename();
                if (e.key === "Escape") setRenameSessionId(null);
              }}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRenameSessionId(null)}
              >
                {t("common.cancel", "取消")}
              </Button>
              <Button size="sm" onClick={handleConfirmRename}>
                {t("common.confirm", "确定")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
