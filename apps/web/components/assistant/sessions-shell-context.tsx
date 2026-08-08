"use client";

import type { ReactNode } from "react";
import { createContext, useContext } from "react";
import type { SandboxType } from "@/components/assistant/sandbox-selector-compact";
import type { VercelProjectSelection } from "@/lib/vercel/types";

type CreateSessionInput = {
  repoOwner?: string;
  repoName?: string;
  branch?: string;
  cloneUrl?: string;
  isNewBranch: boolean;
  sandboxType: SandboxType;
  autoCommitPush: boolean;
  autoCreatePr: boolean;
  vercelProject?: VercelProjectSelection | null;
};

type SessionsShellContextValue = {
  createSession: (input: CreateSessionInput) => Promise<{
    session: { id: string };
    chat: { id: string };
  }>;
  lastRepo?: { owner: string; repo: string } | null;
};

const SessionsShellContext = createContext<
  SessionsShellContextValue | undefined
>(undefined);

export function SessionsShellProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: SessionsShellContextValue;
}) {
  return (
    <SessionsShellContext.Provider value={value}>
      {children}
    </SessionsShellContext.Provider>
  );
}

export function useSessionsShell() {
  const context = useContext(SessionsShellContext);

  if (!context) {
    throw new Error(
      "useSessionsShell must be used within SessionsShellProvider",
    );
  }

  return context;
}
