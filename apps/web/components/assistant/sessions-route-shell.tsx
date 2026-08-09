"use client";

import { useParams, useRouter } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { InboxSidebar } from "@/components/assistant/inbox-sidebar";

import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { useBackgroundChatNotifications } from "@/hooks/assistant/use-background-chat-notifications";
import { useSessions, type SessionWithUnread } from "@/hooks/assistant/use-sessions";
import { useUserPreferences } from "@/hooks/assistant/use-user-preferences";
import { DEFAULT_SANDBOX_TYPE } from "@/components/assistant/sandbox-selector-compact";
import type { Session as AuthSession } from "@/lib/session/types";
import { cn } from "@/lib/utils";
import { SessionsShellProvider } from "./sessions-shell-context";

type SessionsRouteShellProps = {
  children: ReactNode;
  currentUser: AuthSession["user"];
  initialSessionsData?: {
    sessions: SessionWithUnread[];
    archivedCount: number;
  };
  lastRepo?: { owner: string; repo: string } | null;
};

type SessionsRouteInnerProps = {
  sessions: SessionWithUnread[];
  archivedCount: number;
  sessionsLoading: boolean;
  activeSessionId: string;
  pendingSessionId: string | null;
  onSessionClick: (session: SessionWithUnread) => void;
  onSessionPrefetch: (session: SessionWithUnread) => void;
  onRenameSession: (sessionId: string, title: string) => Promise<void>;
  onArchiveSession: (sessionId: string) => Promise<void>;
  onUnarchiveSession: (sessionId: string) => Promise<void>;
  onDeleteSession: (sessionId: string) => Promise<void>;
  onOpenNewSession: () => void;
  onCreateSessionForRepo: (repoOwner: string, repoName: string) => Promise<void>;
  onCreateSessionFromBranch: (repoOwner: string, repoName: string, branch: string) => Promise<void>;
  currentUser: AuthSession["user"];
  children: ReactNode;
};

function SessionsRouteInner({
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
  currentUser,
  children,
}: SessionsRouteInnerProps) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <>
      <aside
        className={cn(
          "shrink-0 border-r border-border overflow-y-auto bg-muted/20 transition-[width] duration-200 ease-linear",
          collapsed ? "w-0 border-r-0 overflow-hidden" : "w-[var(--sidebar-width)]",
        )}
      >
        <InboxSidebar
          sessions={sessions}
          archivedCount={archivedCount}
          sessionsLoading={sessionsLoading}
          activeSessionId={activeSessionId}
          pendingSessionId={pendingSessionId}
          onSessionClick={onSessionClick}
          onSessionPrefetch={onSessionPrefetch}
          onRenameSession={onRenameSession}
          onArchiveSession={onArchiveSession}
          onUnarchiveSession={onUnarchiveSession}
          onDeleteSession={onDeleteSession}
          onOpenNewSession={onOpenNewSession}
          onCreateSessionForRepo={onCreateSessionForRepo}
          onCreateSessionFromBranch={onCreateSessionFromBranch}
          initialUser={currentUser}
        />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </>
  );
}

export function SessionsRouteShell({
  children,
  currentUser,
  initialSessionsData,
  lastRepo,
}: SessionsRouteShellProps) {
  const router = useRouter();
  const params = useParams<{ sessionId?: string }>();
  const routeSessionId =
    typeof params.sessionId === "string" ? params.sessionId : null;
  const [optimisticActiveSessionId, setOptimisticActiveSessionId] = useState<
    string | null
  >(null);
  const [isNavigating, startNavigationTransition] = useTransition();
  const prefetchedSessionHrefsRef = useRef(new Set<string>());

  const {
    sessions,
    archivedCount,
    loading: sessionsLoading,
    createSession,
    renameSession,
    archiveSession,
    unarchiveSession,
    deleteSession,
  } = useSessions({
    enabled: true,
    includeArchived: false,
    initialData: initialSessionsData,
  });

  const getSessionHref = useCallback((targetSession: SessionWithUnread) => {
    if (targetSession.latestChatId) {
      return `/assistant/${targetSession.id}/chats/${targetSession.latestChatId}`;
    }

    return `/assistant/${targetSession.id}`;
  }, []);

  const { preferences } = useUserPreferences();

  const openNewSessionDialog = useCallback(() => {
    if (routeSessionId) {
      router.push("/assistant", { scroll: false });
    }
  }, [routeSessionId, router]);

  const handleSessionClick = useCallback(
    (targetSession: SessionWithUnread) => {
      if (targetSession.id === (optimisticActiveSessionId ?? routeSessionId)) {
        return;
      }

      const href = getSessionHref(targetSession);
      prefetchedSessionHrefsRef.current.add(href);
      setOptimisticActiveSessionId(targetSession.id);
      startNavigationTransition(() => {
        router.push(href, { scroll: false });
      });
    },
    [
      getSessionHref,
      optimisticActiveSessionId,
      routeSessionId,
      router,
      startNavigationTransition,
    ],
  );

  const handleSessionPrefetch = useCallback(
    (targetSession: SessionWithUnread) => {
      const href = getSessionHref(targetSession);
      if (prefetchedSessionHrefsRef.current.has(href)) {
        return;
      }

      prefetchedSessionHrefsRef.current.add(href);
      router.prefetch(href);
    },
    [getSessionHref, router],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      for (const session of sessions.slice(0, 6)) {
        const href = getSessionHref(session);
        if (prefetchedSessionHrefsRef.current.has(href)) {
          continue;
        }

        prefetchedSessionHrefsRef.current.add(href);
        router.prefetch(href);
      }
    }, 150);

    return () => {
      window.clearTimeout(timer);
    };
  }, [getSessionHref, router, sessions]);

  const handleRenameSession = useCallback(
    async (targetSessionId: string, title: string) => {
      await renameSession(targetSessionId, title);
    },
    [renameSession],
  );

  const handleArchiveSession = useCallback(
    async (targetSessionId: string) => {
      await archiveSession(targetSessionId);

      if (targetSessionId === routeSessionId) {
        setOptimisticActiveSessionId(null);
        startNavigationTransition(() => {
          router.push("/assistant", { scroll: false });
        });
      }
    },
    [archiveSession, routeSessionId, router, startNavigationTransition],
  );

  const handleUnarchiveSession = useCallback(
    async (targetSessionId: string) => {
      await unarchiveSession(targetSessionId);

      if (targetSessionId === routeSessionId) {
        window.location.reload();
      }
    },
    [routeSessionId, unarchiveSession],
  );

  const handleDeleteSession = useCallback(
    async (targetSessionId: string) => {
      await deleteSession(targetSessionId);

      if (targetSessionId === routeSessionId) {
        setOptimisticActiveSessionId(null);
        startNavigationTransition(() => {
          router.push("/assistant", { scroll: false });
        });
      }
    },
    [deleteSession, routeSessionId, router, startNavigationTransition],
  );

  const handleCreateSessionForRepo = useCallback(
    async (repoOwner: string, repoName: string) => {
      try {
        const { session: created, chat } = await createSession({
          repoOwner,
          repoName,
          cloneUrl: `https://github.com/${repoOwner}/${repoName}`,
          isNewBranch: true,
          sandboxType: preferences?.defaultSandboxType ?? DEFAULT_SANDBOX_TYPE,
          autoCommitPush: preferences?.autoCommitPush ?? false,
          autoCreatePr: preferences?.autoCreatePr ?? false,
        });
        router.push(`/assistant/${created.id}/chats/${chat.id}`, {
          scroll: false,
        });
      } catch (error) {
        console.error("Failed to create session for repo:", error);
      }
    },
    [createSession, preferences, router],
  );

  const handleCreateSessionFromBranch = useCallback(
    async (repoOwner: string, repoName: string, branch: string) => {
      try {
        const { session: created, chat } = await createSession({
          repoOwner,
          repoName,
          branch,
          cloneUrl: `https://github.com/${repoOwner}/${repoName}`,
          isNewBranch: false,
          sandboxType: preferences?.defaultSandboxType ?? DEFAULT_SANDBOX_TYPE,
          autoCommitPush: preferences?.autoCommitPush ?? false,
          autoCreatePr: preferences?.autoCreatePr ?? false,
        });
        router.push(`/assistant/${created.id}/chats/${chat.id}`, {
          scroll: false,
        });
      } catch (error) {
        console.error("Failed to create session from branch:", error);
      }
    },
    [createSession, preferences, router],
  );

  useEffect(() => {
    if (
      optimisticActiveSessionId &&
      optimisticActiveSessionId === routeSessionId
    ) {
      setOptimisticActiveSessionId(null);
    }
  }, [optimisticActiveSessionId, routeSessionId]);

  const activeSessionId = optimisticActiveSessionId ?? routeSessionId ?? "";
  const pendingSessionId = isNavigating ? optimisticActiveSessionId : null;

  useBackgroundChatNotifications(sessions, routeSessionId, handleSessionClick, {
    alertsEnabled: preferences?.alertsEnabled ?? true,
    alertSoundEnabled: preferences?.alertSoundEnabled ?? true,
  });

  const shellContextValue = useMemo(
    () => ({
      createSession,
      lastRepo,
    }),
    [createSession, lastRepo],
  );

  return (
    <SessionsShellProvider value={shellContextValue}>
      <SidebarProvider
        className="h-full overflow-hidden"
        style={
          {
            "--sidebar-width": "18rem",
          } as CSSProperties
        }
      >
        <SessionsRouteInner
          sessions={sessions}
          archivedCount={archivedCount}
          sessionsLoading={sessionsLoading}
          activeSessionId={activeSessionId}
          pendingSessionId={pendingSessionId}
          onSessionClick={handleSessionClick}
          onSessionPrefetch={handleSessionPrefetch}
          onRenameSession={handleRenameSession}
          onArchiveSession={handleArchiveSession}
          onUnarchiveSession={handleUnarchiveSession}
          onDeleteSession={handleDeleteSession}
          onOpenNewSession={openNewSessionDialog}
          onCreateSessionForRepo={handleCreateSessionForRepo}
          onCreateSessionFromBranch={handleCreateSessionFromBranch}
          currentUser={currentUser}
          children={children}
        />
      </SidebarProvider>

    </SessionsShellProvider>
  );
}
