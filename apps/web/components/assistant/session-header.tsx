"use client";

import { useTranslation } from "react-i18next";
import {
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
  PanelLeft,
} from "lucide-react";
import { useCallback, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { ChatTabs } from "./chat-tabs";
import { useGitPanel } from "./git-panel-context";
import { useSessionLayout } from "@/components/assistant/session-layout-context";

interface SessionHeaderProps {
  activeChatId: string;
}

export function SessionHeader({ activeChatId }: SessionHeaderProps) {
  const { t } = useTranslation();
  const { toggleSidebar } = useSidebar();
  const {
    gitPanelOpen,
    setGitPanelOpen,
    setGitPanelTab,
    hasActionNeeded,
    changesCount,
    hasCommittedChanges,
    headerActionsRef,
  } = useGitPanel();
  const { session } = useSessionLayout();

  // Determine the icon and color based on PR state
  const prState = useMemo(() => {
    if (!session.prNumber) return null;
    const status = session.prStatus;
    if (status === "merged")
      return { icon: GitMerge, color: "text-purple-500" } as const;
    if (status === "closed")
      return { icon: GitPullRequestClosed, color: "text-red-500" } as const;
    return { icon: GitPullRequest, color: "text-green-500" } as const;
  }, [session.prNumber, session.prStatus]);

  const GitIcon = prState?.icon ?? GitPullRequest;
  const iconColor = prState?.color ?? "text-muted-foreground";

  // Build contextual tooltip
  const tooltipText = useMemo(() => {
    const parts: string[] = [];
    if (session.prNumber) {
      const statusLabel =
        session.prStatus === "merged"
          ? t("assistant.drawer.prStatusMerged")
          : session.prStatus === "closed"
            ? t("assistant.drawer.prStatusClosed")
            : t("assistant.drawer.prStatusOpen");
      parts.push(
        t("assistant.drawer.prNumberStatus", {
          prNumber: session.prNumber,
          status: statusLabel,
        }),
      );
    }
    if (changesCount > 0) {
      parts.push(t("assistant.drawer.filesChanged", { count: changesCount }));
    }
    if (hasActionNeeded) {
      parts.push(t("assistant.drawer.uncommittedChanges"));
    }
    return parts.length > 0
      ? parts.join(" · ")
      : t("assistant.drawer.gitPanel");
  }, [
    session.prNumber,
    session.prStatus,
    changesCount,
    hasActionNeeded,
    t,
  ]);

  const openGitPanel = useCallback(() => {
    const defaultTab = session.prNumber
      ? "pr"
      : hasActionNeeded || hasCommittedChanges || changesCount > 0
        ? "diff"
        : "files";

    setGitPanelTab(defaultTab);
    setGitPanelOpen(true);
  }, [
    session.prNumber,
    hasActionNeeded,
    hasCommittedChanges,
    changesCount,
    setGitPanelOpen,
    setGitPanelTab,
  ]);

  const handleGitPanelToggle = useCallback(() => {
    if (gitPanelOpen) {
      setGitPanelOpen(false);
      return;
    }

    openGitPanel();
  }, [gitPanelOpen, openGitPanel, setGitPanelOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isGitPanelShortcut =
        event.code === "KeyB" &&
        (event.metaKey || event.ctrlKey) &&
        event.shiftKey &&
        !event.altKey;

      if (!isGitPanelShortcut || event.repeat) {
        return;
      }

      event.preventDefault();
      handleGitPanelToggle();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleGitPanelToggle]);

  return (
    <header className="flex items-center gap-2 border-b border-border px-2 py-0">
      {/* Left side: panel toggle + repo/branch hint + chat tabs */}
      <div className="flex min-w-0 flex-1 items-center gap-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={toggleSidebar}
            >
              <PanelLeft className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {t("assistant.drawer.toggleLeftSidebar")}
          </TooltipContent>
        </Tooltip>

        {/* ChatTabs inline — only when there is an active chat */}
        {activeChatId && (
          <ChatTabs activeChatId={activeChatId} variant="inline" />
        )}
      </div>

      {/* Right side: dev actions portal + git panel toggle */}
      <div className="flex shrink-0 items-center gap-1">
        {/* Portal target for dev server / code editor buttons (rendered from per-chat content) */}
        <div ref={headerActionsRef} className="flex items-center" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "relative h-7 w-7 shrink-0",
                gitPanelOpen && "bg-accent text-accent-foreground",
              )}
              onClick={handleGitPanelToggle}
            >
              <GitIcon
                className={cn("h-4 w-4", !gitPanelOpen && iconColor)}
              />
              {!gitPanelOpen && hasActionNeeded && (
                <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-amber-500" />
              )}
              {!gitPanelOpen && !hasActionNeeded && hasCommittedChanges && (
                <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-blue-500" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {t("assistant.drawer.gitPanelTooltip", { tooltipText })}
          </TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}
