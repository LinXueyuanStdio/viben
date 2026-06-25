import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Copy, List, X } from "lucide-react";
import { cn, ScrollArea } from "@viben/ui";
import type { AcpSessionListItem } from "./use-acp-session";

export interface AcpSessionListDrawerProps {
  open: boolean;
  sessions: AcpSessionListItem[];
  activeSessionId: string | null;
  selectedIndex: number;
  onSelectedIndexChange: (index: number) => void;
  onAttach: (sessionId: string) => void | Promise<void>;
  onClose: () => void;
}

export function AcpSessionListDrawer({
  open,
  sessions,
  activeSessionId,
  selectedIndex,
  onSelectedIndexChange,
  onAttach,
  onClose,
}: AcpSessionListDrawerProps) {
  const { t } = useTranslation();
  const selectedSession = sessions[selectedIndex];

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (sessions.length === 0) return;
      onSelectedIndexChange(Math.max(0, selectedIndex - 1));
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (sessions.length === 0) return;
      onSelectedIndexChange(Math.min(sessions.length - 1, selectedIndex + 1));
      return;
    }
    if (event.key === "Enter" && selectedSession) {
      event.preventDefault();
      void onAttach(selectedSession.sessionKey);
    }
  }, [onAttach, onClose, onSelectedIndexChange, selectedIndex, selectedSession, sessions.length]);

  const copySessionId = useCallback(async (
    event: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>,
    sessionId: string
  ) => {
    event.preventDefault();
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(sessionId);
    } catch {
      // Clipboard failures are non-blocking.
    }
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 z-[70] overflow-hidden" role="presentation">
      <div
        className={cn(
          "absolute bottom-0 left-0 top-0 flex h-full w-[360px] max-w-[88vw] flex-col border-r border-border bg-background shadow-2xl transition-transform duration-[240ms] ease-[cubic-bezier(0.4,0,0.2,1)]",
          open ? "translate-x-0 pointer-events-auto" : "-translate-x-full pointer-events-none"
        )}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        ref={(node) => {
          if (open) node?.focus();
        }}
      >
        <div
          className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-border px-3"
          data-testid="acp-session-list-header"
        >
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <List className="size-3.5" aria-hidden="true" />
            </div>
            <div className="min-w-0 truncate text-sm font-medium text-foreground">
              {t("chat.acp.sessionList")}
            </div>
            <div
              className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium leading-none text-muted-foreground"
              title={t("chat.acp.sessionListCount", { count: sessions.length })}
            >
              {sessions.length}
            </div>
          </div>
          <button
            type="button"
            className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label={t("common.close")}
            title={t("common.close")}
            onClick={onClose}
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        </div>
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-1 p-2">
            {sessions.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                {t("chat.acp.noSessions")}
              </div>
            ) : sessions.map((session, index) => {
              const selected = index === selectedIndex;
              const running = isRunningSession(session);
              const title = session.initialPrompt || session.title || shortSessionId(session.sessionId);
              return (
                <div
                  key={session.sessionKey}
                  role="button"
                  tabIndex={-1}
                  className={cn(
                    "w-full rounded-md border px-3 py-2 text-left transition-colors",
                    selected
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-transparent hover:border-border hover:bg-muted/60"
                  )}
                  onMouseEnter={() => onSelectedIndexChange(index)}
                  onClick={() => { void onAttach(session.sessionKey); }}
                >
                  <div className="truncate text-sm font-medium" title={title}>
                    {title}
                  </div>
                  <div className="mt-1 flex min-w-0 items-center gap-1.5">
                    <div className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground" title={session.sessionId}>
                      {session.sessionId}
                    </div>
                    <button
                      type="button"
                      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                      aria-label={t("chat.acp.copySessionId")}
                      title={t("chat.acp.copySessionIdForResume")}
                      onClick={(event) => { void copySessionId(event, session.sessionId); }}
                    >
                      <Copy className="size-3" />
                    </button>
                  </div>
                  <div
                    className="mt-2 flex min-w-0 items-center justify-between gap-2 text-xs text-muted-foreground"
                    data-testid="acp-session-card-footer"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate">{session.agent || session.agentExecutorType || t("chat.acp.unknownAgent")}</span>
                      {activeSessionId === session.sessionKey ? (
                        <span className="shrink-0 text-primary">{t("chat.acp.current")}</span>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-[11px]">
                      {running ? t("chat.acp.enterAttach") : t("chat.acp.enterResume")}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

function isRunningSession(session: AcpSessionListItem): boolean {
  return Boolean(session.promptRunning) || session.status === "active" || session.status === "initializing";
}

function shortSessionId(id: string): string {
  return id.length <= 12 ? id : `${id.slice(0, 8)}...${id.slice(-4)}`;
}
