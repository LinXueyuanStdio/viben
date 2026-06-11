/**
 * ACP Session Store
 *
 * Zustand store for managing global ACP WebSocket connection state.
 * This state survives component mode switches (floating -> expanded -> full).
 */

import { create } from "zustand";
import type { ConnectionStatus } from "@/components/acp-chat/acp-client";
import type { UiSessionState, SubagentSheetState } from "@/components/acp-chat/acp-chat-state";
import type { CommandQueueItem } from "@viben/chat";
import type { PermissionDecisionRequest, PermissionDecisionResult, ElicitationRequest, ElicitationResponse } from "@/components/acp-chat/acp-client";
import type { PendingQuestion } from "@viben/chat";

export interface PermissionDialogState {
  id: string;
  request: PermissionDecisionRequest;
  selectedOptionId: string;
  resolve: (result: PermissionDecisionResult) => void;
}

export interface ElicitationFormField {
  key: string;
  schema: {
    type?: string;
    default?: unknown;
    description?: string | null;
    enum?: unknown[];
    items?: { type?: string; enum?: unknown[] };
  };
}

export interface ElicitationDialogState {
  id: string;
  request: ElicitationRequest;
  pendingQuestion: PendingQuestion;
  formFields: ElicitationFormField[];
  answersText: string;
  resolve: (result: ElicitationResponse) => void;
}

interface AcpSessionState {
  // Connection state
  status: ConnectionStatus;
  hasAutoConnected: boolean;
  initializeResult: unknown;

  // Config selections (persisted across mode switches)
  selectedAgentId: string | null;
  selectedProviderId: string | null;
  executorType: string | null;
  model: string | null;

  // Session state (persisted across mode switches)
  activeSessionId: string | null;
  sessionsById: Record<string, UiSessionState>;
  sessionOrder: string[];
  steerQueuesBySessionId: Record<string, CommandQueueItem[]>;
  error: string | null;
  cwd: string;

  // Dialog state (persisted across mode switches)
  permissionDialogs: Record<string, PermissionDialogState>;
  activePermissionDialogId: string | null;
  elicitationDialogs: Record<string, ElicitationDialogState>;
  activeElicitationDialogId: string | null;

  // Subagent sheet state
  subagentSheet: SubagentSheetState | null;

  // Actions - Connection
  setStatus: (status: ConnectionStatus) => void;
  setHasAutoConnected: (connected: boolean) => void;
  setInitializeResult: (result: unknown) => void;

  // Actions - Config
  setSelectedAgentId: (id: string | null) => void;
  setSelectedProviderId: (id: string | null) => void;
  setExecutorType: (type: string) => void;
  setModel: (model: string) => void;

  // Actions - Session
  setActiveSessionId: (updater: string | null | ((current: string | null) => string | null)) => void;
  setSessionsById: (updater: (current: Record<string, UiSessionState>) => Record<string, UiSessionState>) => void;
  setSessionOrder: (updater: (current: string[]) => string[]) => void;
  setSteerQueuesBySessionId: (updater: (current: Record<string, CommandQueueItem[]>) => Record<string, CommandQueueItem[]>) => void;
  setError: (error: string | null) => void;
  setCwd: (cwd: string) => void;

  // Actions - Dialogs
  setPermissionDialogs: (updater: (current: Record<string, PermissionDialogState>) => Record<string, PermissionDialogState>) => void;
  setActivePermissionDialogId: (updater: string | null | ((current: string | null) => string | null)) => void;
  setElicitationDialogs: (updater: (current: Record<string, ElicitationDialogState>) => Record<string, ElicitationDialogState>) => void;
  setActiveElicitationDialogId: (updater: string | null | ((current: string | null) => string | null)) => void;

  // Actions - Subagent sheet
  setSubagentSheet: (sheet: SubagentSheetState | null) => void;

  // Reset connection state (for reconnect scenarios)
  resetConnectionState: () => void;
}

export const useAcpSessionStore = create<AcpSessionState>()((set) => ({
  // Initial state - Connection
  status: "idle",
  hasAutoConnected: false,
  initializeResult: null,

  // Initial state - Config
  selectedAgentId: null,
  selectedProviderId: null,
  executorType: null,
  model: null,

  // Initial state - Session
  activeSessionId: null,
  sessionsById: {},
  sessionOrder: [],
  steerQueuesBySessionId: {},
  error: null,
  cwd: "",

  // Initial state - Dialogs
  permissionDialogs: {},
  activePermissionDialogId: null,
  elicitationDialogs: {},
  activeElicitationDialogId: null,

  // Initial state - Subagent sheet
  subagentSheet: null,

  // Actions - Connection
  setStatus: (status) => set({ status }),
  setHasAutoConnected: (hasAutoConnected) => set({ hasAutoConnected }),
  setInitializeResult: (initializeResult) => set({ initializeResult }),

  // Actions - Config
  setSelectedAgentId: (selectedAgentId) => set({ selectedAgentId }),
  setSelectedProviderId: (selectedProviderId) => set({ selectedProviderId }),
  setExecutorType: (executorType) => set({ executorType }),
  setModel: (model) => set({ model }),

  // Actions - Session
  setActiveSessionId: (updater) => set((state) => ({
    activeSessionId: typeof updater === "function" ? updater(state.activeSessionId) : updater,
  })),
  setSessionsById: (updater) => set((state) => ({ sessionsById: updater(state.sessionsById) })),
  setSessionOrder: (updater) => set((state) => ({ sessionOrder: updater(state.sessionOrder) })),
  setSteerQueuesBySessionId: (updater) => set((state) => ({ steerQueuesBySessionId: updater(state.steerQueuesBySessionId) })),
  setError: (error) => set({ error }),
  setCwd: (cwd) => set({ cwd }),

  // Actions - Dialogs
  setPermissionDialogs: (updater) => set((state) => ({ permissionDialogs: updater(state.permissionDialogs) })),
  setActivePermissionDialogId: (updater) => set((state) => ({
    activePermissionDialogId: typeof updater === "function" ? updater(state.activePermissionDialogId) : updater,
  })),
  setElicitationDialogs: (updater) => set((state) => ({ elicitationDialogs: updater(state.elicitationDialogs) })),
  setActiveElicitationDialogId: (updater) => set((state) => ({
    activeElicitationDialogId: typeof updater === "function" ? updater(state.activeElicitationDialogId) : updater,
  })),

  // Actions - Subagent sheet
  setSubagentSheet: (subagentSheet) => set({ subagentSheet }),

  resetConnectionState: () =>
    set({
      status: "idle",
      hasAutoConnected: false,
      initializeResult: null,
    }),
}));
