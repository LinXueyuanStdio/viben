"use client";

import { useParams, useRouter } from "next/navigation";
import { FileText, GitCompare, Pencil, Plus, X } from "lucide-react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSessionLayout } from "@/components/assistant/session-layout-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { useIsMobile } from "@/hooks/assistant/use-mobile";
import { useGitPanel } from "./git-panel-context";

type ChatTabItemProps = {
  chat: SessionChatListItem;
  isActive: boolean;
  isRenaming: boolean;
  renameValue: string;
  canDelete: boolean;
  isMobile: boolean;
  tabRef?: React.Ref<HTMLDivElement>;
  onRenameChange: (value: string) => void;
  onFinishRename: () => void;
  onCancelRename: () => void;
  onStartRename: () => void;
  onDelete: () => void;
  onClick: () => void;
  onPrefetch: () => void;
};

import type { SessionChatListItem } from "@/hooks/assistant/use-session-chats";

function ChatTabItem({
  chat,
  isActive,
  isRenaming,
  renameValue,
  canDelete,
  isMobile,
  tabRef,
  onRenameChange,
  onFinishRename,
  onCancelRename,
  onStartRename,
  onDelete,
  onClick,
  onPrefetch,
}: ChatTabItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming) {
      // Delay to ensure the input is mounted, then focus and select all
      const timer = setTimeout(() => {
        renameInputRef.current?.select();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isRenaming]);

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      if (leaveTimeoutRef.current) clearTimeout(leaveTimeoutRef.current);
    };
  }, []);

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

  const lastActivityLabel = formatRelativeTime(
    chat.updatedAt ?? chat.createdAt,
  );

  const tabButton = isRenaming ? (
    <div className="flex items-center px-2 py-[7px]">
      <input
        ref={renameInputRef}
        value={renameValue}
        onChange={(e) => onRenameChange(e.target.value)}
        onBlur={() => void onFinishRename()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            void onFinishRename();
          }
          if (e.key === "Escape") {
            onCancelRename();
          }
        }}
        className="max-w-[130px] rounded border border-border bg-background px-1.5 py-0 text-sm font-medium outline-none focus:ring-1 focus:ring-ring"
        autoFocus
      />
    </div>
  ) : (
    <button
      type="button"
      onMouseEnter={() => onPrefetch()}
      onFocus={() => onPrefetch()}
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium"
    >
      <span className="max-w-[120px] truncate">
        {chat.title || "New Chat"}
      </span>
      {chat.hasUnread && (
        <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
      )}
    </button>
  );

  const actionButtons = !isRenaming ? (
    <div
      className={cn(
        "flex items-center gap-0.5 pr-1 transition-opacity",
        isMobile ? "opacity-100" : "opacity-0 group-hover:opacity-100",
      )}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onStartRename();
        }}
        className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label="Rename chat"
      >
        <Pencil className="h-3 w-3" />
      </button>
      {canDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Close chat"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  ) : null;

  const tab = (
    <div
      ref={tabRef}
      className={cn(
        "group relative flex shrink-0 items-center border-b-2 transition-colors",
        isActive
          ? "border-foreground text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {tabButton}
      {actionButtons}
    </div>
  );

  if (isMobile || isRenaming) {
    return tab;
  }

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>{tab}</PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={8}
        className="w-56 p-3"
        onMouseEnter={() => {
          if (leaveTimeoutRef.current) {
            clearTimeout(leaveTimeoutRef.current);
            leaveTimeoutRef.current = null;
          }
        }}
        onMouseLeave={handleMouseLeave}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground leading-snug">
            {chat.title || "New Chat"}
          </p>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="truncate">{chat.modelId}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            {lastActivityLabel}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

type ChatTabsProps = {
  activeChatId: string;
  variant?: "standalone" | "inline";
};

export function ChatTabs({ activeChatId, variant = "standalone" }: ChatTabsProps) {
  const router = useRouter();
  const params = useParams<{ sessionId?: string }>();
  const sessionId = params.sessionId ?? "";
  const { chats, createChat, switchChat, deleteChat, renameChat } =
    useSessionLayout();
  const {
    activeView,
    setActiveView,
    focusedDiffFile,
    setFocusedDiffFile,
    changesTabDismissed,
    setChangesTabDismissed,
    focusedFilePath,
    setFocusedFilePath,
    fileTabDismissed,
    setFileTabDismissed,
  } = useGitPanel();

  const isMobile = useIsMobile();

  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeChatTabRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (container.scrollWidth <= container.clientWidth) return;

      if (e.deltaY !== 0) {
        e.preventDefault();
        container.scrollLeft += e.deltaY;
      }
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, []);

  useEffect(() => {
    if (activeView !== "chat") {
      return;
    }

    activeChatTabRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    });
  }, [activeChatId, activeView, chats.length]);

  const prefetchedChatHrefsRef = useRef(new Set<string>());

  const prefetchChat = useCallback(
    (chatId: string) => {
      if (!sessionId) {
        return;
      }

      const href = `/assistant/${sessionId}/${chatId}`;
      if (prefetchedChatHrefsRef.current.has(href)) {
        return;
      }

      prefetchedChatHrefsRef.current.add(href);
      router.prefetch(href);
    },
    [router, sessionId],
  );

  const [changesTabIndex, setChangesTabIndex] = useState<number | null>(null);
  useEffect(() => {
    const isChangesVisible = !changesTabDismissed && !!focusedDiffFile;
    if (isChangesVisible && changesTabIndex === null) {
      setChangesTabIndex(chats.length);
    } else if (!isChangesVisible) {
      setChangesTabIndex(null);
    }
  }, [focusedDiffFile, changesTabDismissed, chats.length, changesTabIndex]);

  const [fileTabIndex, setFileTabIndex] = useState<number | null>(null);
  useEffect(() => {
    const isFileVisible = !fileTabDismissed && !!focusedFilePath;
    if (isFileVisible && fileTabIndex === null) {
      setFileTabIndex(
        chats.length + (!changesTabDismissed && !!focusedDiffFile ? 1 : 0),
      );
    } else if (!isFileVisible) {
      setFileTabIndex(null);
    }
  }, [
    focusedFilePath,
    fileTabDismissed,
    chats.length,
    fileTabIndex,
    changesTabDismissed,
    focusedDiffFile,
  ]);

  const handleNewChat = () => {
    const { chat } = createChat();
    switchChat(chat.id);
    setActiveView("chat");
  };

  const handleCloseChanges = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setActiveView("chat");
      setFocusedDiffFile(null);
      setChangesTabDismissed(true);
    },
    [setActiveView, setFocusedDiffFile, setChangesTabDismissed],
  );

  const handleCloseFile = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setActiveView("chat");
      setFocusedFilePath(null);
      setFileTabDismissed(true);
    },
    [setActiveView, setFocusedFilePath, setFileTabDismissed],
  );

  const handleStartRename = useCallback(
    (chatId: string, currentTitle: string) => {
      setRenamingChatId(chatId);
      setRenameValue(currentTitle || "");
    },
    [],
  );

  const handleFinishRename = useCallback(async () => {
    if (!renamingChatId) return;
    const trimmed = renameValue.trim();
    if (trimmed) {
      try {
        await renameChat(renamingChatId, trimmed);
      } catch (err) {
        console.error("Failed to rename chat:", err);
      }
    }
    setRenamingChatId(null);
  }, [renamingChatId, renameValue, renameChat]);

  const handleConfirmDelete = useCallback(async () => {
    if (!deletingChatId) return;
    const idToDelete = deletingChatId;
    setDeletingChatId(null);

    try {
      await deleteChat(idToDelete);
    } catch (err) {
      console.error("Failed to delete chat:", err);
    }

    if (idToDelete === activeChatId) {
      const remaining = chats.filter((c) => c.id !== idToDelete);
      if (remaining.length > 0) {
        switchChat(remaining[0].id);
      }
    }
  }, [deletingChatId, activeChatId, chats, deleteChat, switchChat]);

  const canDelete = chats.length > 1;
  const showChangesTab = !changesTabDismissed && !!focusedDiffFile;
  const insertAt = showChangesTab ? (changesTabIndex ?? chats.length) : null;
  const showFileTab = !fileTabDismissed && !!focusedFilePath;
  const fileInsertAt = showFileTab
    ? (fileTabIndex ?? chats.length + (showChangesTab ? 1 : 0))
    : null;
  const fileTabFileName =
    focusedFilePath?.split("/").pop() ?? focusedFilePath ?? "";

  const tabElements = useMemo(() => {
    const changesTabEl = showChangesTab ? (
      <div
        key="__changes__"
        className={cn(
          "group relative flex shrink-0 items-center border-b-2 transition-colors",
          activeView === "diff"
            ? "border-foreground text-foreground"
            : "border-transparent text-muted-foreground hover:text-foreground",
        )}
      >
        <button
          type="button"
          onClick={() => setActiveView("diff")}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium"
        >
          <GitCompare className="h-3.5 w-3.5" />
          <span>Changes</span>
        </button>
        <button
          type="button"
          onClick={handleCloseChanges}
          className={cn(
            "mr-1 rounded p-0.5 text-muted-foreground transition-opacity hover:bg-accent hover:text-foreground",
            isMobile ? "opacity-100" : "opacity-0 group-hover:opacity-100",
          )}
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    ) : null;

    const fileTabEl = showFileTab ? (
      <div
        key="__file__"
        className={cn(
          "group relative flex shrink-0 items-center border-b-2 transition-colors",
          activeView === "file"
            ? "border-foreground text-foreground"
            : "border-transparent text-muted-foreground hover:text-foreground",
        )}
      >
        <button
          type="button"
          onClick={() => setActiveView("file")}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium"
        >
          <FileText className="h-3.5 w-3.5" />
          <span className="max-w-[120px] truncate">{fileTabFileName}</span>
        </button>
        <button
          type="button"
          onClick={handleCloseFile}
          className={cn(
            "mr-1 rounded p-0.5 text-muted-foreground transition-opacity hover:bg-accent hover:text-foreground",
            isMobile ? "opacity-100" : "opacity-0 group-hover:opacity-100",
          )}
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    ) : null;

    const elements: ReactNode[] = [];

    chats.forEach((chat, index) => {
      if (insertAt === index) {
        elements.push(changesTabEl);
      }
      if (fileInsertAt === index) {
        elements.push(fileTabEl);
      }

      const isActive = chat.id === activeChatId && activeView === "chat";
      const isRenaming = renamingChatId === chat.id;

      elements.push(
        <ChatTabItem
          key={chat.id}
          chat={chat}
          isActive={isActive}
          isRenaming={isRenaming}
          tabRef={isActive ? activeChatTabRef : undefined}
          renameValue={renameValue}
          canDelete={canDelete}
          isMobile={isMobile}
          onRenameChange={setRenameValue}
          onFinishRename={handleFinishRename}
          onCancelRename={() => setRenamingChatId(null)}
          onStartRename={() => handleStartRename(chat.id, chat.title || "")}
          onDelete={() => setDeletingChatId(chat.id)}
          onClick={() => {
            if (chat.id !== activeChatId) {
              switchChat(chat.id);
            }
            setActiveView("chat");
          }}
          onPrefetch={() => prefetchChat(chat.id)}
        />,
      );
    });

    if (insertAt !== null && insertAt >= chats.length) {
      elements.push(changesTabEl);
    }

    if (fileInsertAt !== null && fileInsertAt >= chats.length) {
      elements.push(fileTabEl);
    }

    return elements;
  }, [
    activeChatId,
    activeView,
    canDelete,
    chats,
    fileInsertAt,
    fileTabFileName,
    handleCloseChanges,
    handleCloseFile,
    handleFinishRename,
    handleStartRename,
    insertAt,
    isMobile,
    prefetchChat,
    renameValue,
    renamingChatId,
    setActiveView,
    showChangesTab,
    showFileTab,
    switchChat,
  ]);

  const scrollContent = (
    <div
      ref={scrollContainerRef}
      className="flex min-w-0 flex-1 items-center overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {tabElements}

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={handleNewChat}
            className="ml-1 flex shrink-0 items-center justify-center rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">New chat</TooltipContent>
      </Tooltip>
    </div>
  );

  return (
    <>
      {variant === "inline" ? (
        scrollContent
      ) : (
        <div className="flex items-center gap-0 border-b border-border bg-muted/30 px-1">
          {scrollContent}
        </div>
      )}

      <Dialog
        open={deletingChatId !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingChatId(null);
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Close chat?</DialogTitle>
            <DialogDescription>
              This will permanently delete this chat and its messages. This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingChatId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleConfirmDelete()}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
