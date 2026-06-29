/**
 * Custom hook for managing ACP WebSocket connection and session state.
 * Provides a singleton ACP client connection and session management.
 *
 * Also integrates agent/provider/model selection with automatic constraint handling:
 * - Agents are loaded from Gateway API (workspace + global)
 * - Each agent has an executor_type that constrains available providers/models
 * - Provider/model selections auto-correct when executor changes
 *
 * Uses useAcpSessionStore for global state that survives mode switches.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AgentMessage,
  Artifact,
  CommandQueueItem,
  LoadedSubagentDetails,
  PendingQuestion,
  QueuedInputRecallItem,
  SelectorOption,
  SlashCommand,
  SlashCommandSelection,
  SubagentOpenContext,
  TaskPlan,
} from "@viben/chat";
import type { PendingExecApproval } from "@viben/chat";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useAcpSessionStore, type PermissionDialogState, type ElicitationDialogState, type ElicitationFormField } from "@/stores/acp-session-store";
import { useChatConfigStore } from "@/stores/chat-config-store";
import { useGatewayStatus } from "@/hooks/use-gateway-status";
import { useAgentModelSelection } from "@/hooks/use-agent-model-selection";
import type { AgentInfo } from "@/lib/gateway";
import { buildAcpAgentConfig } from "./acp-agent-config";
import {
  AcpWebSocketClient,
  type AcpSessionEvent,
  type AcpSessionUpdate,
  type AcpListSessionsResult,
  type AgentConfigPayload,
  type CallToolResult,
  type ClientToolCall,
  type ClientToolExecutionRequest,
  type ConsumedSteerPromptResult,
  type ConnectionStatus,
  type ElicitationRequest,
  type ElicitationRequestLog,
  type PermissionDecisionRequest,
  type PermissionDecisionResult,
  type ElicitationResponse,
  type PermissionRequestLog,
} from "./acp-client";
import {
  acpSessionUpdateToUiSteps,
  clientToolCallToUiSteps,
  clientToolRequestedToUiSteps,
  elicitationRequestToPendingPlan,
  elicitationRequestToPendingQuestion,
  elicitationRequestToUiSteps,
  elicitationResultToUiSteps,
  permissionDecisionToUiSteps,
  permissionRequestToUiSteps,
  slashCommandsToUiSteps,
  systemTextToMessages,
  systemTextToUiSteps,
  userPromptToMessages,
  userPromptToUiSteps,
  getElicitationFormFields,
} from "./acp-chat-adapter";
import {
  appendUiMessagesImmediately,
  applyUiStepsImmediately,
  applyQueuedUiStep,
  buildAcpSessionKey,
  createUiSession,
  drainSessionUiStepQueue,
  enqueueUiSteps,
  flushSessionStreamingText,
  normalizeAcpSessionListItem,
  resolveLiveSubagentMessages,
  resolveAcpSessionStateKey,
  resolveSubagentStreamingState,
  resolveSessionApproval,
  resolveSessionQuestion,
  stopSessionTurn,
  updateSession,
  type SubagentSheetState,
  type UiSessionState,
} from "./acp-chat-state";
import { executeClientTool } from "./client-tool-executor";
import { isClientSideBashTool } from "@/lib/action-system/client-side-bash";
import { useAnalytics } from "@/lib/analytics";
import { AnalyticsEvents } from "@/lib/analytics/types";

const DEFAULT_WS_URL = "ws://127.0.0.1:18790/ws/agent/acp";
const DEFAULT_MODEL = "claude-sonnet-4-6";

export interface AcpSessionItem {
  id: string;
  sessionId: string;
  executorType?: string;
  title: string;
  subtitle?: string;
}

export interface AcpSessionListItem {
  sessionKey: string;
  sessionId: string;
  executorType?: string;
  cwd?: string;
  title?: string;
  status: string;
  agent?: string;
  agentExecutorType?: string;
  agentConfigPath?: string;
  agentDir?: string;
  initialPrompt?: string;
  promptRunning?: boolean;
  queueDepth?: number;
  updatedAt?: string;
}

// Re-export types from store
export type { PermissionDialogState, ElicitationDialogState, ElicitationFormField } from "@/stores/acp-session-store";

export interface UseAcpSessionOptions {
  wsUrl?: string;
  defaultCwd?: string;
  defaultModel?: string;
  defaultExecutorType?: string;
}

export interface UseAcpSessionReturn {
  // Connection state
  status: ConnectionStatus;
  connected: boolean;
  busy: boolean;
  error: string | null;

  // Session state
  activeSessionId: string | null;
  sessionsById: Record<string, UiSessionState>;
  sessionOrder: string[];
  sessions: AcpSessionItem[];
  acpSessionList: AcpSessionListItem[];

  // Active session data
  messages: AgentMessage[];
  streamingText: string | null;
  messageUpdates: Record<string, Partial<AgentMessage>>;
  pendingPlan: TaskPlan | null;
  pendingApproval: PendingExecApproval | null;
  pendingQuestion: PendingQuestion | null;
  slashCommands: SlashCommand[];
  artifacts: Artifact[];
  steerQueueItems: CommandQueueItem[];
  isTurnActive: boolean;
  isAgentRunning: boolean;

  // Config
  executorType: string;
  model: string;
  cwd: string;

  // Agent/Provider/Model selection (integrated from useAcpChatConfig)
  /** All agents (workspace + global) */
  agents: AgentInfo[];
  /** Global agents */
  globalAgents: AgentInfo[];
  /** Workspace agents */
  workspaceAgents: AgentInfo[];
  /** Currently selected agent ID */
  selectedAgentId: string | null;
  /** Currently selected agent */
  selectedAgent: AgentInfo | undefined;
  /** Agent selector options (for TripleSelector) */
  agentOptions: SelectorOption[];
  /** Provider selector options (filtered by executor constraints) */
  providerOptions: SelectorOption[];
  /** Model selector options (filtered by executor and provider) */
  modelOptions: SelectorOption[];
  /** Currently selected provider ID */
  selectedProviderId: string | null;
  /** Currently selected provider ID after validating against current agent/options */
  effectiveSelectedProviderId: string | null;
  /** Currently selected model ID after validating against current agent/options */
  effectiveSelectedModel: string;
  /** Config loading state */
  configLoading: boolean;
  /** Config error */
  configError: string | null;

  // Actions
  connect: () => Promise<void>;
  disconnect: () => void;
  createSession: (agentId?: string) => Promise<void>;
  loadSession: (sessionKeyOrId: string) => Promise<void>;
  refreshSessionList: () => Promise<AcpSessionListItem[]>;
  closeActiveSession: () => Promise<void>;
  selectSession: (id: string) => void;
  sendPrompt: (content: string) => Promise<void>;
  sendSteerPrompt: (content: string) => Promise<string | null>;
  interrupt: () => Promise<void>;
  handleSlashCommand: (command: SlashCommand, selection: SlashCommandSelection) => void;
  handleApprovalDecision: (decision: string) => void;
  handleQuestionAnswers: (answers: Record<string, string[]>) => void;
  handleApprovePlan: () => void;
  handleRejectPlan: () => void;
  recallSteerQueue: (items: QueuedInputRecallItem[]) => Promise<void>;
  removeSteerQueueItem: (id: string) => void;
  clearSteerQueue: () => void;
  setExecutorType: (type: string) => void;
  setModel: (model: string) => void;
  setCwd: (cwd: string) => void;
  /** Set selected agent (also updates executorType) */
  setSelectedAgentId: (id: string | null) => void;
  /** Set selected provider */
  setSelectedProviderId: (id: string | null) => void;

  // Subagent sheet
  subagentSheet: SubagentSheetState | null;
  liveSubagentMessages: AgentMessage[] | undefined;
  subagentStreamingState: { isStreaming: boolean; streamingText: string | null; messageUpdates: Record<string, Partial<AgentMessage>> };
  handleExpandSubagent: (title: string, subagentType: string | undefined, messages: AgentMessage[], context?: SubagentSheetState["context"]) => void;
  closeSubagentSheet: () => void;

  // Tool inspect dialog
  toolInspectState: { message: AgentMessage; result?: AgentMessage } | null;
  handleInspectTool: (message: AgentMessage) => void;
  closeToolInspect: () => void;

  // Artifact dialog
  artifactDialogState: { artifact: Artifact; message?: AgentMessage } | null;
  handleArtifactClick: (artifactId: string) => void;
  closeArtifactDialog: () => void;

  // Subagent details loader
  handleLoadSubagentDetails: (context: SubagentOpenContext) => Promise<LoadedSubagentDetails>;
}

// Singleton client reference for the entire desktop app
let globalClientRef: AcpWebSocketClient | null = null;

function isUserBlockingUiStep(step: { kind: string; plan?: { approvalStatus?: string } }): boolean {
  return (
    step.kind === "approval" ||
    step.kind === "question" ||
    (step.kind === "plan" && step.plan?.approvalStatus === "pending")
  );
}

// Note: shortId is available for future use in UI formatting
// function shortId(id: string): string {
//   return id.length <= 12 ? id : `${id.slice(0, 8)}...${id.slice(-4)}`;
// }

function readSessionId(value: unknown): string | null {
  if (typeof value === "object" && value !== null && typeof (value as { sessionId?: unknown }).sessionId === "string") {
    return (value as { sessionId: string }).sessionId;
  }
  return null;
}

function readSessionAvailableCommands(value: unknown): SlashCommand[] | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const commands = record.availableCommands ?? record.available_commands ?? record.commands ?? record.slashCommands ?? record.slash_commands;
  if (!Array.isArray(commands)) return null;
  const parsed = commands.flatMap((cmd): SlashCommand[] => {
    if (typeof cmd !== "object" || cmd === null) return [];
    const name = (cmd as Record<string, unknown>).name;
    if (typeof name !== "string" || !name.trim()) return [];
    const description = (cmd as Record<string, unknown>).description;
    const input = (cmd as Record<string, unknown>).input;
    return [{
      name,
      description: typeof description === "string" ? description : "",
      input: typeof input === "object" && input !== null && !Array.isArray(input) ? input as Record<string, unknown> : null,
    }];
  });
  return parsed.length > 0 ? parsed : null;
}

function historyEventsToUiSteps(events: AcpSessionEvent[] | undefined) {
  if (!events || events.length === 0) return [];
  return events.flatMap((event) => {
    if (event.type !== "session_update") return [];
    return acpSessionUpdateToUiSteps(event.data as AcpSessionUpdate);
  });
}

function summarizeAgentConfigForLog(config: AgentConfigPayload | undefined): Record<string, unknown> | null {
  if (!config) return null;
  return {
    name: config.name,
    executorType: config.executor_type,
    provider_id: config.provider_id,
    model: config.model,
    permissionMode: config.permission_mode,
    dangerouslySkipPermissions: config.dangerously_skip_permissions,
    mcpServerCount: Array.isArray(config.mcp_servers) ? config.mcp_servers.length : 0,
    skillCount: Array.isArray(config.skills) ? config.skills.length : 0,
    hasSystemPrompt: Boolean(config.system_prompt),
    hasAppendPrompt: Boolean(config.append_prompt),
    executorConfig: summarizeExecutorConfigForLog(config.executor_config),
  };
}

function summarizeExecutorConfigForLog(config: Record<string, unknown> | undefined): Record<string, unknown> | null {
  if (!config) return null;
  return {
    id: readRecordString(config, "id"),
    command: readRecordString(config, "command"),
    argsCount: Array.isArray(config.args) ? config.args.length : undefined,
    providerId: readRecordString(config, "provider_id"),
    baseUrl: readRecordString(config, "base_url"),
    approvalPolicy: readRecordString(config, "approval_policy"),
    sandbox: readRecordString(config, "sandbox"),
    hasSandboxPolicy: typeof config.sandbox_policy === "object" && config.sandbox_policy !== null,
    reasoningEffort: readRecordString(config, "reasoning_effort"),
    personality: readRecordString(config, "personality"),
    initTimeoutMs: typeof config.init_timeout_ms === "number" ? config.init_timeout_ms : undefined,
  };
}

export function buildSessionIdentityContext(session?: Pick<UiSessionState, "executorType"> | null): { agent_config?: AgentConfigPayload } | undefined {
  return session?.executorType
    ? { agent_config: { executor_type: session.executorType } }
    : undefined;
}

function readRecordString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

function selectInitialPermissionOption(options: Array<{ kind?: string; optionId?: string; name?: string }>): { kind?: string; optionId?: string; name?: string } | undefined {
  return (
    options.find((option) => option.kind === "allow_once") ??
    options.find((option) => option.kind === "allow_always") ??
    options.find((option) => String(option.optionId ?? option.name ?? "").toLowerCase().includes("allow")) ??
    options[0]
  );
}

function permissionOptionId(option: { optionId?: string; name?: string; kind?: string }, index: number): string {
  return option.optionId ?? option.name ?? option.kind ?? `option-${index}`;
}

function buildDefaultElicitationContent(fields: ElicitationFormField[]): Record<string, string | number | boolean | string[]> {
  const content: Record<string, string | number | boolean | string[]> = {};
  for (const field of fields) {
    const value = field.schema.default;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || (Array.isArray(value) && value.every((v) => typeof v === "string"))) {
      content[field.key] = value;
      continue;
    }
    if (field.schema.type === "boolean") content[field.key] = false;
    else if (field.schema.type === "number" || field.schema.type === "integer") content[field.key] = 0;
    else if (field.schema.type === "array") content[field.key] = [];
    else content[field.key] = "";
  }
  return content;
}

function coerceElicitationValue(schema: { type?: string }, values: string[]): string | number | boolean | string[] {
  if (schema.type === "array") return values;
  const value = values[0] ?? "";
  if (schema.type === "boolean") return value === "true";
  if (schema.type === "number" || schema.type === "integer") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return value;
}

function answersToElicitationContent(
  answers: Record<string, string[]>,
  fields: ElicitationFormField[]
): Record<string, string | number | boolean | string[]> {
  if (fields.length === 0) {
    return {
      answer: Object.values(answers).flat().join("\n"),
    };
  }
  const content: Record<string, string | number | boolean | string[]> = {};
  fields.forEach((field, index) => {
    const values = answers[String(index)] ?? [];
    content[field.key] = coerceElicitationValue(field.schema, values);
  });
  return content;
}

function resolvePermissionDecisionOption(options: Array<{ kind?: string; optionId?: string; name?: string }>, decision: string): string {
  if (decision === "reject") {
    const rejectOption =
      options.find((option) => option.kind === "reject_once") ??
      options.find((option) => option.kind === "reject_always") ??
      options.find((option) => String(option.optionId ?? option.name ?? "").toLowerCase().includes("reject"));
    if (!rejectOption) return "reject_once";
    return permissionOptionId(rejectOption, 0);
  }
  if (decision === "allow_always") {
    const alwaysOption = options.find((option) => option.kind === "allow_always");
    if (!alwaysOption) return "allow_always";
    return permissionOptionId(alwaysOption, 0);
  }
  const allowOnce =
    options.find((option) => option.kind === "allow_once") ??
    options.find((option) => String(option.optionId ?? option.name ?? "").toLowerCase().includes("allow")) ??
    options[0];
  if (!allowOnce) return "allow_once";
  return permissionOptionId(allowOnce, 0);
}

function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function useAcpSession(options: UseAcpSessionOptions = {}): UseAcpSessionReturn {
  const {
    wsUrl = DEFAULT_WS_URL,
    defaultCwd,
    defaultModel = DEFAULT_MODEL,
    defaultExecutorType = "CLAUDE_CODE",
  } = options;

  // 获取当前活动的 workspace 路径作为默认工作目录
  const getActiveWorkspace = useWorkspaceStore((state) => state.getActiveWorkspace);
  const activeWorkspace = getActiveWorkspace();
  // 优先使用 props 传入的 defaultCwd，其次使用活动 workspace 的路径
  const resolvedDefaultCwd = defaultCwd ?? activeWorkspace?.path ?? "";
  const workspacePath = activeWorkspace?.path ?? (resolvedDefaultCwd || undefined);

  // ========== Global State from Store (survives mode switches) ==========
  const {
    // Connection state
    status,
    hasAutoConnected,
    initializeResult,
    // Config selections
    selectedAgentId,
    selectedProviderId,
    executorType: storeExecutorType,
    model: storeModel,
    // Session state (now global)
    activeSessionId,
    sessionsById,
    sessionOrder,
    steerQueuesBySessionId,
    error,
    cwd,
    // Dialog state (now global)
    permissionDialogs,
    activePermissionDialogId,
    elicitationDialogs,
    activeElicitationDialogId,
    // Subagent sheet
    subagentSheet,
    // Actions - Connection
    setStatus,
    setHasAutoConnected,
    setInitializeResult,
    // Actions - Config
    setSelectedAgentId: setStoreSelectedAgentId,
    setSelectedProviderId: setStoreSelectedProviderId,
    setExecutorType: setStoreExecutorType,
    setModel: setStoreModel,
    // Actions - Session
    setActiveSessionId,
    setSessionsById,
    setSessionOrder,
    setSteerQueuesBySessionId,
    setError,
    setCwd,
    // Actions - Dialogs
    setPermissionDialogs,
    setActivePermissionDialogId,
    setElicitationDialogs,
    setActiveElicitationDialogId,
    // Actions - Subagent sheet
    setSubagentSheet,
  } = useAcpSessionStore();

  const {
    executorType,
    model,
    agents: allAgents,
    globalAgents,
    workspaceAgents,
    selectedAgent,
    providers,
    agentOptions,
    providerOptions,
    modelOptions,
    effectiveSelectedProviderId,
    effectiveSelectedModel,
    agentSelectionReady,
    configLoading,
    configError,
    setSelectedAgentId: handleSetSelectedAgentId,
    setSelectedProviderId,
    setExecutorType,
    setModel,
  } = useAgentModelSelection({
    workspacePath,
    defaultExecutorType,
    defaultModel,
    selectedAgentId,
    selectedProviderId,
    storeExecutorType,
    storeModel,
    setSelectedAgentId: setStoreSelectedAgentId,
    setSelectedProviderId: setStoreSelectedProviderId,
    setExecutorType: setStoreExecutorType,
    setModel: setStoreModel,
  });

  // Analytics
  const { logEvent } = useAnalytics();
  const streamStartTimeRef = useRef<number>(0);
  const streamStartLoggedRef = useRef<boolean>(false);

  const buildAgentConfig = useCallback((): AgentConfigPayload => {
    return buildAcpAgentConfig({
      agent: selectedAgent,
      executorType,
      model,
      providerId: selectedProviderId,
      providers,
    });
  }, [executorType, model, providers, selectedAgent, selectedProviderId]);
  const sandboxConfig = useChatConfigStore((state) => state.sandboxConfig);
  const acpSandboxConfig = useMemo(
    () => sandboxConfig.enabled
      ? { enabled: true, provider: sandboxConfig.provider }
      : undefined,
    [sandboxConfig.enabled, sandboxConfig.provider]
  );

  const clientRef = useRef<AcpWebSocketClient | null>(null);

  const busy = status === "connecting";
  const connected = status === "connected";
  const activeSession = activeSessionId ? sessionsById[activeSessionId] : null;
  const sessionId = activeSession?.id ?? null;
  const sessionKey = activeSession?.sessionKey ?? activeSessionId;
  const messages = activeSession?.uiMessages ?? [];
  const streamingText = activeSession?.streamingText ?? null;
  const messageUpdates = activeSession?.messageUpdates ?? {};
  const pendingApproval = activeSession?.pendingApproval ?? null;
  const pendingQuestion = activeSession?.pendingQuestion ?? null;
  const pendingPlan = activeSession?.pendingPlan ?? null;
  const artifacts = activeSession?.artifacts ?? [];
  const slashCommands = activeSession?.slashCommands ?? [];
  const steerQueueItems = sessionKey ? steerQueuesBySessionId[sessionKey] ?? [] : [];

  const permissionDialog = activePermissionDialogId ? permissionDialogs[activePermissionDialogId] ?? null : null;
  const elicitationDialog = activeElicitationDialogId ? elicitationDialogs[activeElicitationDialogId] ?? null : null;

  const hasQueuedUserBlocker = Boolean(activeSession?.uiStepQueue.some(isUserBlockingUiStep));
  const isTurnActive = Boolean(
    activeSession?.promptInFlight ||
    activeSession?.uiStepQueue.length ||
    activeSession?.pendingPlan ||
    activeSession?.pendingApproval ||
    activeSession?.pendingQuestion
  );
  const isAgentRunning = Boolean(
    activeSession?.promptInFlight &&
    !hasQueuedUserBlocker &&
    !pendingPlan &&
    !pendingApproval &&
    !pendingQuestion
  );

  const sessions = useMemo<AcpSessionItem[]>(
    () =>
      sessionOrder.flatMap((id) => {
        const session = sessionsById[id];
        if (!session) return [];
        return [
          {
            id,
            sessionId: session.id,
            executorType: session.executorType,
            title: session.title,
            subtitle: session.id,
          },
        ];
      }),
    [sessionOrder, sessionsById]
  );

  const liveSubagentMessages = useMemo(() => resolveLiveSubagentMessages(sessionsById, subagentSheet), [sessionsById, subagentSheet]);
  const subagentStreamingState = useMemo(() => resolveSubagentStreamingState(sessionsById, subagentSheet), [sessionsById, subagentSheet]);

  const [toolInspectState, setToolInspectState] = useState<{ message: AgentMessage; result?: AgentMessage } | null>(null);
  const [artifactDialogState, setArtifactDialogState] = useState<{ artifact: Artifact; message?: AgentMessage } | null>(null);
  const [acpSessionList, setAcpSessionList] = useState<AcpSessionListItem[]>([]);

  const resolveStateKey = useCallback(
    (rawSessionId: string, executorType?: string) =>
      resolveAcpSessionStateKey(sessionsById, rawSessionId, activeSessionId, executorType),
    [activeSessionId, sessionsById]
  );

  // Initialize cwd from resolved default on first mount (when cwd is empty)
  // This ensures cwd is set from workspace path when the store is first initialized
  useEffect(() => {
    if (!cwd && resolvedDefaultCwd) {
      setCwd(resolvedDefaultCwd);
    }
  }, [cwd, resolvedDefaultCwd, setCwd]);

  // 当 workspace 切换时自动更新 cwd（仅在没有活动 session 时同步）
  useEffect(() => {
    // 只有在没有活动 session 时才自动同步 workspace 路径到 cwd
    // 避免在已有 session 时意外更改工作目录
    if (!activeSessionId && resolvedDefaultCwd && resolvedDefaultCwd !== cwd) {
      setCwd(resolvedDefaultCwd);
    }
  }, [activeSessionId, resolvedDefaultCwd, cwd, setCwd]);

  // Drain UI step queue effect
  useEffect(() => {
    const sessionEntries = Object.values(sessionsById);
    const drainable = sessionEntries.find(
      (session) =>
        !session.pendingPlan &&
        !session.pendingApproval &&
        !session.pendingQuestion &&
        session.uiStepQueue.length > 0
    );
    if (!drainable) return;

    const timer = window.setTimeout(() => {
      setSessionsById((current) => {
        const session = current[drainable.sessionKey];
        if (
          !session ||
          session.pendingPlan ||
          session.pendingApproval ||
          session.pendingQuestion ||
          session.uiStepQueue.length === 0
        ) {
          return current;
        }
        const [step, ...rest] = session.uiStepQueue;
        return {
          ...current,
          [session.sessionKey]: applyQueuedUiStep(session, step, rest),
        };
      });
    }, 80);

    return () => window.clearTimeout(timer);
  }, [sessionsById, setSessionsById]);

  const appendSessionUpdate = useCallback((notification: AcpSessionUpdate) => {
    // All session updates go through the queue to preserve ordering.
    // Previously agent_message_chunk bypassed the queue via streamingText,
    // causing timing mismatches with thinking/tool_call events.
    const targetKey = resolveAcpSessionStateKey(sessionsById, notification.sessionId, activeSessionId, notification.executorType);
	// Analytics: chat_stream_started
	try {
		if (notification.update.sessionUpdate === "agent_message_chunk" && !streamStartLoggedRef.current) {
			streamStartLoggedRef.current = true;
			logEvent(AnalyticsEvents.CHAT_STREAM_STARTED, {
				session_id: notification.sessionId,
				agent_id: selectedAgentId ?? "",
				model_id: effectiveSelectedModel ?? "",
			});
		}
	} catch { /* analytics should not break business logic */ }
    enqueueUiSteps(setSessionsById, targetKey, acpSessionUpdateToUiSteps(notification));
  }, [activeSessionId, sessionsById, setSessionsById]);

  const appendClientToolCall = useCallback((call: ClientToolCall) => {
    const targetKey = resolveAcpSessionStateKey(sessionsById, call.sessionId, activeSessionId, call.executorType);
    updateSession(setSessionsById, targetKey, (session) => ({
      ...session,
      clientToolCalls: [call, ...session.clientToolCalls],
      lastActiveAt: new Date().toISOString(),
    }));
    enqueueUiSteps(setSessionsById, targetKey, clientToolCallToUiSteps(call));
  }, [activeSessionId, sessionsById, setSessionsById]);

  const appendPermissionRequest = useCallback((request: PermissionRequestLog) => {
    const targetKey = resolveAcpSessionStateKey(sessionsById, request.sessionId, activeSessionId, request.executorType);
    updateSession(setSessionsById, targetKey, (session) => ({
      ...session,
      permissionRequests: [request, ...session.permissionRequests],
      lastActiveAt: new Date().toISOString(),
    }));
    enqueueUiSteps(setSessionsById, targetKey, permissionDecisionToUiSteps(request));
  }, [activeSessionId, sessionsById, setSessionsById]);

  const appendElicitationRequest = useCallback((request: ElicitationRequestLog) => {
    const targetKey = resolveAcpSessionStateKey(sessionsById, request.sessionId, activeSessionId, request.executorType);
    updateSession(setSessionsById, targetKey, (session) => ({
      ...session,
      elicitationRequests: [request, ...session.elicitationRequests],
      lastActiveAt: new Date().toISOString(),
    }));
    enqueueUiSteps(setSessionsById, targetKey, elicitationResultToUiSteps(request));
  }, [activeSessionId, sessionsById, setSessionsById]);

  const appendSteerPromptConsumed = useCallback(
    (result: ConsumedSteerPromptResult & { sessionId: string }) => {
      const targetKey = resolveStateKey(result.sessionId, result.executorType);
      const steerItem = steerQueuesBySessionId[targetKey]?.find((item) => item.id === result.promptId);
      setSteerQueuesBySessionId((current) => ({
        ...current,
        [targetKey]: (current[targetKey] ?? []).filter((item) => item.id !== result.promptId),
      }));
      if (steerItem?.content) {
        appendUiMessagesImmediately(setSessionsById, targetKey, userPromptToMessages(steerItem.content));
      } else {
        appendUiMessagesImmediately(setSessionsById, targetKey, systemTextToMessages(`Steer prompt consumed: ${result.promptId}`));
      }
    },
    [resolveStateKey, steerQueuesBySessionId, setSteerQueuesBySessionId, setSessionsById]
  );

  const handleExecuteClientTool = useCallback(
    (request: ClientToolExecutionRequest): CallToolResult => {
      // For ClientSideBash tools, we need to execute async but return sync
      // The actual execution happens in requestClientToolResult which is async
      if (isClientSideBashTool(request.toolName)) {
        // Return a placeholder - actual execution is done async
        return {
          content: [{ type: "text", text: "Executing..." }],
        };
      }
      return {
        content: [{ type: "text", text: `Desktop client has no handler for tool: ${request.toolName}` }],
        isError: true,
      };
    },
    []
  );

  const requestClientToolResult = useCallback(
    async (request: ClientToolExecutionRequest, _draft: CallToolResult): Promise<CallToolResult> => {
      enqueueUiSteps(setSessionsById, resolveStateKey(request.sessionId), clientToolRequestedToUiSteps(request));
      // Execute the client tool through the action system
      const result = await executeClientTool(request);
      return result;
    },
    [resolveStateKey, setSessionsById]
  );

  const requestPermissionDecision = useCallback((request: PermissionDecisionRequest): Promise<PermissionDecisionResult> => {
    const steps = permissionRequestToUiSteps(request);
    const approval = steps.find((step) => step.kind === "approval")?.approval;
    const dialogId = approval?.id ?? request.toolCallId;
    enqueueUiSteps(setSessionsById, resolveStateKey(request.sessionId), steps);
    return new Promise((resolve) => {
      const selected = selectInitialPermissionOption(request.options);
      const dialog: PermissionDialogState = {
        id: dialogId,
        request,
        selectedOptionId: selected ? permissionOptionId(selected, request.options.indexOf(selected)) : "",
        resolve,
      };
      setPermissionDialogs((current) => ({ ...current, [dialogId]: dialog }));
      setActivePermissionDialogId((current) => current ?? dialogId);
    });
  }, [resolveStateKey, setSessionsById, setPermissionDialogs, setActivePermissionDialogId]);

  const requestElicitationResponse = useCallback((request: ElicitationRequest): Promise<ElicitationResponse> => {
    const pendingQuestion = elicitationRequestToPendingQuestion(request);
    const pendingPlan = elicitationRequestToPendingPlan(request);
    const dialogId = pendingPlan?.id ?? pendingQuestion.id;
    enqueueUiSteps(setSessionsById, resolveStateKey(request.sessionId), elicitationRequestToUiSteps(request, pendingQuestion));
    return new Promise((resolve) => {
      const formFields = getElicitationFormFields(request);
      const dialog: ElicitationDialogState = {
        id: dialogId,
        request,
        pendingQuestion,
        formFields,
        answersText: formatJson(buildDefaultElicitationContent(formFields)),
        resolve,
      };
      setElicitationDialogs((current) => ({ ...current, [dialogId]: dialog }));
      setActiveElicitationDialogId((current) => current ?? dialogId);
    });
  }, [resolveStateKey, setSessionsById, setElicitationDialogs, setActiveElicitationDialogId]);

  // Build callbacks object for client
  const buildCallbacks = useCallback(() => ({
    onTraffic: () => {},
    onSessionUpdate: appendSessionUpdate,
    onClientToolCall: appendClientToolCall,
    onPermissionRequest: appendPermissionRequest,
    onElicitationRequest: appendElicitationRequest,
    onSteerPromptConsumed: appendSteerPromptConsumed,
    executeClientTool: handleExecuteClientTool,
    requestClientToolResult,
    requestPermissionDecision,
    requestElicitationResponse,
    onStatus: setStatus,
    onError: setError,
  }), [
    appendClientToolCall,
    appendElicitationRequest,
    appendPermissionRequest,
    appendSessionUpdate,
    appendSteerPromptConsumed,
    handleExecuteClientTool,
    requestClientToolResult,
    requestElicitationResponse,
    requestPermissionDecision,
    setStatus,
    setError,
  ]);

  const ensureClient = useCallback(() => {
    const callbacks = buildCallbacks();
    if (!clientRef.current) {
      if (globalClientRef) {
        // Reuse existing client but update callbacks to use current closures
        clientRef.current = globalClientRef;
        clientRef.current.updateCallbacks(callbacks);
      } else {
        clientRef.current = new AcpWebSocketClient(callbacks);
        globalClientRef = clientRef.current;
      }
    } else {
      // Always update callbacks to ensure they use the latest closures
      clientRef.current.updateCallbacks(callbacks);
    }
    return clientRef.current;
  }, [buildCallbacks]);

  // Always update callbacks when component mounts or buildCallbacks changes
  // This is crucial for mode switches (expanded <-> full) to keep callbacks in sync
  useEffect(() => {
    if (globalClientRef) {
      const callbacks = buildCallbacks();
      globalClientRef.updateCallbacks(callbacks);
      clientRef.current = globalClientRef;
    }
  }, [buildCallbacks]);

  // Use Gateway status to trigger auto-connect when Gateway is ready
  const gatewayStatus = useGatewayStatus();

  // Auto-connect when Gateway is connected (uses store flag to prevent duplicate connections)
  useEffect(() => {
    // Skip if already auto-connected or Gateway not ready
    if (hasAutoConnected || !gatewayStatus.isConnected || !agentSelectionReady) {
      // If already connected, just sync the client reference
      if (globalClientRef && !clientRef.current) {
        clientRef.current = globalClientRef;
      }
      return;
    }

    let mounted = true;
    setHasAutoConnected(true);

    const agentConfig = buildAgentConfig();

    const autoConnect = async () => {
      console.log("[ACP] Auto-connect starting (Gateway connected)...", { wsUrl, status });
      try {
        console.log("[ACP] Ensuring client...");
        const client = ensureClient();
        console.log("[ACP] Client ensured, connecting to:", wsUrl);
        await client.connect(wsUrl);
        console.log("[ACP] WebSocket connected, initializing...");
        if (!mounted) return;
        const initialized = await client.initialize();
        console.log("[ACP] Initialize result:", initialized);
        setInitializeResult(initialized);

        // After successful connection, fetch existing sessions and auto-create one
        if (!mounted) return;
        try {
	          const listResult = await client.listSessions() as AcpListSessionsResult | null;
	          if (!mounted) return;
	          const existingSessions = (listResult?.sessions ?? [])
	            .map(normalizeAcpSessionListItem)
	            .filter((item): item is AcpSessionListItem => item !== null);
	          setAcpSessionList(existingSessions);
	          if (existingSessions.length > 0) {
	            // Load the most recent session
	            const mostRecent = existingSessions[0];
	            const id = mostRecent.sessionId;
	            // Register existing sessions in the UI
	            for (const s of existingSessions) {
	              setSessionsById((current) => {
	                if (current[s.sessionKey]) return current;
	                return {
	                  ...current,
	                  [s.sessionKey]: createUiSession(
	                    s.sessionId,
	                    s.cwd ?? cwd,
	                    null,
	                    undefined,
	                    { sessionKey: s.sessionKey, executorType: s.executorType }
	                  ),
	                };
	              });
	              setSessionOrder((current) => current.includes(s.sessionKey) ? current : [...current, s.sessionKey]);
	            }
	            // Load the most recent session as active
	            const loadAgentConfig = {
	              ...agentConfig,
	              executor_type: mostRecent.executorType ?? agentConfig.executor_type,
	            };
	            const session = await client.loadSession({
	              session_id: id,
	              cwd: cwd || mostRecent.cwd,
	              agent_config_path: selectedAgent?.config_path,
	              agent_dir: selectedAgent?.agent_dir,
	              agent_config: loadAgentConfig,
	              sandbox_config: acpSandboxConfig,
	            });
	            if (!mounted) return;
	            const loadedId = readSessionId(session) ?? id;
	            const loadedKey = buildAcpSessionKey(loadedId, loadAgentConfig.executor_type ?? mostRecent.executorType);
	            setSessionsById((current) => ({
	              ...current,
	              [loadedKey]: createUiSession(loadedId, cwd, session, current[loadedKey] ?? current[mostRecent.sessionKey], {
	                sessionKey: loadedKey,
	                executorType: loadAgentConfig.executor_type ?? mostRecent.executorType,
	              }),
	            }));
	            applyUiStepsImmediately(setSessionsById, loadedKey, historyEventsToUiSteps(session.history));
	            setSessionOrder((current) => [loadedKey, ...current.filter((item) => item !== loadedKey && item !== mostRecent.sessionKey)]);
	            setActiveSessionId(loadedKey);
	            const commands = readSessionAvailableCommands(session);
	            if (commands) {
	              enqueueUiSteps(setSessionsById, loadedKey, slashCommandsToUiSteps(commands));
	            }
          } else {
            // No existing sessions — auto-create a new one
            const session = await client.newSession({
              cwd,
              agent_config_path: selectedAgent?.config_path,
              agent_dir: selectedAgent?.agent_dir,
              agent_config: agentConfig,
              sandbox_config: acpSandboxConfig,
            });
            if (!mounted) return;
	            const id = readSessionId(session);
	            if (id) {
	              const stateKey = buildAcpSessionKey(id, agentConfig.executor_type);
	              const record = createUiSession(id, cwd, session, undefined, {
	                sessionKey: stateKey,
	                executorType: agentConfig.executor_type,
	              });
	              setSessionsById((current) => ({ ...current, [stateKey]: record }));
	              setSessionOrder((current) => [stateKey, ...current.filter((item) => item !== stateKey)]);
	              setActiveSessionId(stateKey);
	              const commands = readSessionAvailableCommands(session);
	              if (commands) {
	                enqueueUiSteps(setSessionsById, stateKey, slashCommandsToUiSteps(commands));
	              }
	            }
          }
        } catch (sessionErr) {
          console.warn("[ACP] Failed to auto-load/create session after connect:", sessionErr);
        }
      } catch (err) {
        console.error("[ACP] Auto-connect error:", err);
        if (mounted) {
          setError(err instanceof Error ? err.message : String(err));
        }
        // Reset flag on error to allow retry
        setHasAutoConnected(false);
      }
    };

    void autoConnect();

    return () => {
      console.log("[ACP] Auto-connect effect cleanup");
      mounted = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gatewayStatus.isConnected, hasAutoConnected, agentSelectionReady, ensureClient, wsUrl, status, setHasAutoConnected, setInitializeResult, setError, buildAgentConfig, cwd, selectedAgent, acpSandboxConfig, setSessionsById, setSessionOrder, setActiveSessionId]);

  const connect = useCallback(async () => {
    setError(null);
    setInitializeResult(null);
    try {
      const client = ensureClient();
      await client.connect(wsUrl);
      const initialized = await client.initialize();
      setInitializeResult(initialized);
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : String(connectError));
    }
  }, [ensureClient, wsUrl, setError, setInitializeResult]);

  const refreshSessionList = useCallback(async (): Promise<AcpSessionListItem[]> => {
    setError(null);
    try {
      const client = ensureClient();
      await client.connect(wsUrl);
      if (!initializeResult) {
        setInitializeResult(await client.initialize());
      }
      const listResult = await client.listSessions() as AcpListSessionsResult | null;
      const nextList = (listResult?.sessions ?? [])
        .map(normalizeAcpSessionListItem)
        .filter((item): item is AcpSessionListItem => item !== null);
      setAcpSessionList(nextList);
	      for (const item of nextList) {
	        setSessionsById((current) => {
	          if (current[item.sessionKey]) return current;
	          return {
	            ...current,
	            [item.sessionKey]: createUiSession(
	              item.sessionId,
	              item.cwd ?? cwd,
	              { sessionId: item.sessionId },
	              undefined,
	              { sessionKey: item.sessionKey, executorType: item.executorType }
	            ),
	          };
	        });
	        setSessionOrder((current) => current.includes(item.sessionKey) ? current : [...current, item.sessionKey]);
	      }
      return nextList;
    } catch (listError) {
      setError(listError instanceof Error ? listError.message : String(listError));
      return [];
    }
  }, [cwd, ensureClient, initializeResult, setError, setInitializeResult, setSessionOrder, setSessionsById, wsUrl]);

  const createSession = useCallback(async (agentId?: string) => {
    setError(null);
    try {
      const sessionAgent = agentId ? allAgents.find((agent) => agent.id === agentId) : selectedAgent;
      if (agentId) {
        setStoreSelectedAgentId(agentId);
        if (sessionAgent?.executor_type) {
          setExecutorType(sessionAgent.executor_type);
        }
      }
      const sessionAgentConfig = buildAcpAgentConfig({
        agent: sessionAgent,
        executorType: sessionAgent?.executor_type ?? executorType,
        model,
        providerId: selectedProviderId,
        providers,
      });
      console.log("[ACP] Creating session with agent config", {
        requestedAgentId: agentId,
        selectedAgentId: sessionAgent?.id ?? selectedAgentId,
        agentName: sessionAgent?.name,
        agentConfigPath: sessionAgent?.config_path,
        agentDir: sessionAgent?.agent_dir,
        cwd,
        sandbox: acpSandboxConfig,
        agentConfig: summarizeAgentConfigForLog(sessionAgentConfig),
      });
      const client = ensureClient();
      await client.connect(wsUrl);
      if (!initializeResult) {
        setInitializeResult(await client.initialize());
      }
      const session = await client.newSession({
        cwd,
        agent_config_path: sessionAgent?.config_path,
        agent_dir: sessionAgent?.agent_dir,
        agent_config: sessionAgentConfig,
        sandbox_config: acpSandboxConfig,
      });
	      const id = readSessionId(session);
	      if (!id) throw new Error("session/new did not return sessionId");
	      const stateKey = buildAcpSessionKey(id, sessionAgentConfig.executor_type);
	      const record = createUiSession(id, cwd, session, undefined, {
	        sessionKey: stateKey,
	        executorType: sessionAgentConfig.executor_type,
	      });
	      setSessionsById((current) => ({ ...current, [stateKey]: record }));
	      setSessionOrder((current) => [stateKey, ...current.filter((item) => item !== stateKey)]);
	      setActiveSessionId(stateKey);
	      // Analytics: chat_session_created
	      try {
	      	const workspaceId = activeWorkspace?.id ?? "";
	      	logEvent(AnalyticsEvents.CHAT_SESSION_CREATED, {
	      		workspace_id: workspaceId,
	      		agent_id: sessionAgent?.id ?? selectedAgentId ?? "",
	      		executor_type: sessionAgentConfig.executor_type ?? "",
	      		session_type: "single",
	      	});
	      } catch { /* analytics should not break business logic */ }
	      enqueueUiSteps(setSessionsById, stateKey, systemTextToUiSteps(`Session ready: ${id}`));
	      const commands = readSessionAvailableCommands(session);
	      if (commands) {
	        enqueueUiSteps(setSessionsById, stateKey, slashCommandsToUiSteps(commands));
	      }
    } catch (sessionError) {
      setError(sessionError instanceof Error ? sessionError.message : String(sessionError));
    }
  }, [acpSandboxConfig, allAgents, cwd, ensureClient, executorType, initializeResult, model, providers, selectedAgent, selectedAgentId, selectedProviderId, setActiveSessionId, setError, setExecutorType, setInitializeResult, setSessionOrder, setSessionsById, setStoreSelectedAgentId, wsUrl]);

  const loadSession = useCallback(
	    async (loadSessionId: string) => {
	      const requestedKey = loadSessionId.trim();
	      if (!requestedKey) return;
	      setError(null);
	      try {
        const client = ensureClient();
        await client.connect(wsUrl);
        if (!initializeResult) {
          setInitializeResult(await client.initialize());
        }
	        const listItem = acpSessionList.find((item) => item.sessionKey === requestedKey || item.sessionId === requestedKey);
	        const existing = sessionsById[requestedKey] ?? Object.values(sessionsById).find((session) => session.id === requestedKey);
	        const id = listItem?.sessionId ?? existing?.id ?? requestedKey;
	        const stateKey = listItem?.sessionKey ?? existing?.sessionKey ?? requestedKey;
	        const baseAgentConfig = buildAgentConfig();
	        const agentConfig = {
	          ...baseAgentConfig,
	          executor_type: listItem?.executorType ?? existing?.executorType ?? baseAgentConfig.executor_type,
	        };
	        console.log("[ACP] Loading session with selected agent config", {
	          sessionId: id,
          selectedAgentId,
          agentName: selectedAgent?.name,
          agentConfigPath: selectedAgent?.config_path,
          agentDir: selectedAgent?.agent_dir,
          cwd,
          sandbox: acpSandboxConfig,
          agentConfig: summarizeAgentConfigForLog(agentConfig),
        });
        const session = await client.loadSession({
          session_id: id,
          cwd,
          agent_config_path: selectedAgent?.config_path,
          agent_dir: selectedAgent?.agent_dir,
          agent_config: agentConfig,
          sandbox_config: acpSandboxConfig,
        });
	        const loadedId = readSessionId(session) ?? id;
	        const loadedKey = buildAcpSessionKey(loadedId, agentConfig.executor_type ?? listItem?.executorType ?? existing?.executorType);
	        setSessionsById((current) => ({
	          ...current,
	          [loadedKey]: createUiSession(loadedId, cwd, session, current[loadedKey] ?? current[stateKey], {
	            sessionKey: loadedKey,
	            executorType: agentConfig.executor_type ?? listItem?.executorType ?? existing?.executorType,
	          }),
	        }));
	        applyUiStepsImmediately(setSessionsById, loadedKey, historyEventsToUiSteps(session.history));
	        setSessionOrder((current) => [loadedKey, ...current.filter((item) => item !== loadedKey && item !== stateKey)]);
	        setActiveSessionId(loadedKey);
	        enqueueUiSteps(setSessionsById, loadedKey, systemTextToUiSteps(`Session loaded: ${loadedId}`));
	        const commands = readSessionAvailableCommands(session);
	        if (commands) {
	          enqueueUiSteps(setSessionsById, loadedKey, slashCommandsToUiSteps(commands));
	        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : String(loadError));
      }
    },
	    [acpSandboxConfig, acpSessionList, buildAgentConfig, cwd, ensureClient, initializeResult, selectedAgent, selectedAgentId, sessionsById, setActiveSessionId, setError, setInitializeResult, setSessionOrder, setSessionsById, wsUrl]
	  );

  const disconnect = useCallback(() => {
    // disconnect() internally calls onStatus("closed") via the callback
    clientRef.current?.disconnect();
    clientRef.current = null;
    globalClientRef = null;
    // No need to call setStatus here - it's already called by client.disconnect()
  }, []);

  const sendPrompt = useCallback(
    async (content: string) => {
      const text = content.trim();
      if (!text) return;

      setError(null);

	      // Auto-create session if none exists
		      let targetSessionId = sessionId;
		      let targetSessionKey = sessionKey;
		      let targetSessionExecutorType = activeSession?.executorType;
	      if (!targetSessionId) {
	        try {
          const client = ensureClient();
          // Ensure connected
          if (status !== "connected") {
            await client.connect(wsUrl);
            if (!initializeResult) {
              const initialized = await client.initialize();
              setInitializeResult(initialized);
            }
          }
          // Create session
	          const agentConfig = buildAgentConfig();
	          const session = await client.newSession({
	            cwd,
	            agent_config_path: selectedAgent?.config_path,
	            agent_dir: selectedAgent?.agent_dir,
	            agent_config: agentConfig,
	            sandbox_config: acpSandboxConfig,
	          });
	          const id = readSessionId(session);
	          if (!id) throw new Error("session/new did not return sessionId");
	          const stateKey = buildAcpSessionKey(id, agentConfig.executor_type);
	          const record = createUiSession(id, cwd, session, undefined, {
	            sessionKey: stateKey,
	            executorType: agentConfig.executor_type,
	          });
	          setSessionsById((current) => ({ ...current, [stateKey]: record }));
		          setSessionOrder((current) => [stateKey, ...current.filter((item) => item !== stateKey)]);
			          setActiveSessionId(stateKey);
			          targetSessionId = id;
			          targetSessionKey = stateKey;
			          targetSessionExecutorType = agentConfig.executor_type;
	          // Don't show "Session ready" system message for auto-created sessions
	          const commands = readSessionAvailableCommands(session);
	          if (commands) {
	            enqueueUiSteps(setSessionsById, stateKey, slashCommandsToUiSteps(commands));
	          }
        } catch (sessionError) {
          setError(sessionError instanceof Error ? sessionError.message : String(sessionError));
          return;
        }
      }

	      if (!targetSessionId || !targetSessionKey) return;
	      enqueueUiSteps(setSessionsById, targetSessionKey, userPromptToUiSteps(text));
		      // Analytics: chat_message_sent
		      try {
		      	logEvent(AnalyticsEvents.CHAT_MESSAGE_SENT, {
		      		session_id: targetSessionId,
		      		agent_id: selectedAgentId ?? "",
		      		model_id: effectiveSelectedModel ?? "",
		      		message_type: "text",
		      		message_length: text.length,
		      		has_attachment: false,
		      	});
		      	streamStartTimeRef.current = Date.now();
		      	streamStartLoggedRef.current = false;
		      } catch { /* analytics should not break business logic */ }
	      updateSession(setSessionsById, targetSessionKey, (session) => ({
        ...session,
        promptInFlight: true,
        promptResult: null,
        lastActiveAt: new Date().toISOString(),
      }));
      try {
		        const result = await clientRef.current?.prompt(
		          targetSessionId,
		          text,
		          buildSessionIdentityContext({ executorType: targetSessionExecutorType })
		        );
	        updateSession(setSessionsById, targetSessionKey, (session) => ({
          ...flushSessionStreamingText(drainSessionUiStepQueue(session)),
          promptInFlight: false,
          promptResult: result,
          lastActiveAt: new Date().toISOString(),
        }));
        // Analytics: chat_stream_completed
        try {
	        const toolCallMsgs = activeSession?.uiMessages?.filter((m: { type?: string }) => m.type === "tool_use") ?? [];
	        const durationMs = streamStartTimeRef.current > 0 ? Date.now() - streamStartTimeRef.current : 0;
	        logEvent(AnalyticsEvents.CHAT_STREAM_COMPLETED, {
	        	session_id: targetSessionId,
	        	total_tokens: 0,
	        	tool_calls_count: toolCallMsgs.length,
	        	duration_ms: durationMs,
	        	total_cost_tokens: 0,
	        });
        } catch { /* analytics should not break business logic */ }
      } catch (promptError) {
	        updateSession(setSessionsById, targetSessionKey, (session) => ({
          ...flushSessionStreamingText(drainSessionUiStepQueue(session)),
          promptInFlight: false,
          lastActiveAt: new Date().toISOString(),
        }));
        setError(promptError instanceof Error ? promptError.message : String(promptError));
      }
    },
		    [activeSession?.executorType, buildAgentConfig, cwd, ensureClient, initializeResult, sessionId, sessionKey, status, wsUrl, selectedAgent, acpSandboxConfig, setError, setInitializeResult, setSessionsById, setSessionOrder, setActiveSessionId]
  );

  const sendSteerPrompt = useCallback(
    async (content: string): Promise<string | null> => {
      if (!sessionId) return null;
      const text = content.trim();
      if (!text) return null;

      setError(null);
	      if (!sessionKey) return null;
	      appendUiMessagesImmediately(setSessionsById, sessionKey, systemTextToMessages(`Steer queued: ${text}`));
      try {
        const result = await clientRef.current?.steerPrompt({
	          sessionId,
	          text,
	          agentId: executorType,
	          userId: "desktop-client",
	          agentConfig: buildSessionIdentityContext(activeSession)?.agent_config,
	          meta: { source: "desktop-acp-chat" },
	        });
        if (result?.promptId) {
	          setSteerQueuesBySessionId((current) => ({
	            ...current,
	            [sessionKey]: [...(current[sessionKey] ?? []), { id: result.promptId, content: text, createdAt: Date.now() }],
	          }));
          return result.promptId;
        }
      } catch (steerError) {
        setError(steerError instanceof Error ? steerError.message : String(steerError));
      }
      return null;
    },
	    [activeSession, executorType, sessionId, sessionKey, setError, setSessionsById, setSteerQueuesBySessionId]
	  );

  const interrupt = useCallback(async () => {
	// Analytics: chat_stream_stopped before interrupting
	try {
		if (sessionId) {
			const tokensBeforeStop = 0; // tokens_before_stop not tracked
			logEvent(AnalyticsEvents.CHAT_STREAM_STOPPED, {
				session_id: sessionId,
				tokens_generated_before_stop: tokensBeforeStop,
				stop_reason: "user_interrupt",
			});
		}
	} catch { /* analytics should not break business logic */ }
    if (!sessionId) return;
    setError(null);
    if (permissionDialog) {
      permissionDialog.resolve({ outcome: "cancelled" });
      setPermissionDialogs((current) => {
        const { [permissionDialog.id]: _, ...rest } = current;
        return rest;
      });
      setActivePermissionDialogId((current) => (current === permissionDialog.id ? null : current));
    }
    if (elicitationDialog) {
      elicitationDialog.resolve({ action: { action: "cancel" } });
      setElicitationDialogs((current) => {
        const { [elicitationDialog.id]: _, ...rest } = current;
        return rest;
      });
      setActiveElicitationDialogId((current) => (current === elicitationDialog.id ? null : current));
    }
	    if (!sessionKey) return;
	    updateSession(setSessionsById, sessionKey, stopSessionTurn);
    try {
	      await clientRef.current?.interrupt(sessionId, buildSessionIdentityContext(activeSession));
    } catch (interruptError) {
      setError(interruptError instanceof Error ? interruptError.message : String(interruptError));
    }
	  }, [activeSession, elicitationDialog, permissionDialog, sessionId, sessionKey, setError, setPermissionDialogs, setActivePermissionDialogId, setElicitationDialogs, setActiveElicitationDialogId, setSessionsById]);

  const closeActiveSession = useCallback(async () => {
	    if (!sessionId || !sessionKey) return;
    setError(null);
    try {
	      await clientRef.current?.closeSession(sessionId, buildSessionIdentityContext(activeSession));
	    // Analytics: chat_session_deleted
	    try {
	    	const messageCount = activeSession?.uiMessages?.length ?? 0;
	    	logEvent(AnalyticsEvents.CHAT_SESSION_DELETED, {
	    		session_id: sessionId,
	    		session_age_days: 0,
	    		message_count: messageCount,
	    	});
	    } catch { /* analytics should not break business logic */ }
	      setSessionsById((current) => {
	        const next = { ...current };
	        delete next[sessionKey];
	        return next;
	      });
	      setSteerQueuesBySessionId((current) => {
	        const next = { ...current };
	        delete next[sessionKey];
	        return next;
	      });
	      setSessionOrder((current) => current.filter((id) => id !== sessionKey));
	      setActiveSessionId((current) => (current === sessionKey ? null : current));
    } catch (closeError) {
      setError(closeError instanceof Error ? closeError.message : String(closeError));
    }
	  }, [activeSession, sessionId, sessionKey, setError, setSessionsById, setSteerQueuesBySessionId, setSessionOrder, setActiveSessionId]);

  const selectSession = useCallback((id: string) => {
    setActiveSessionId(id);
  }, [setActiveSessionId]);

  const handleSlashCommand = useCallback(
    (command: SlashCommand, selection: SlashCommandSelection) => {
      const args = selection.args.trim();
      const text = `/${command.name}${args ? ` ${args}` : ""}`;
	    // Analytics: chat_slash_command_used
	    try {
	    	logEvent(AnalyticsEvents.CHAT_SLASH_COMMAND_USED, {
	    		session_id: sessionId ?? "",
	    		command_name: command.name,
	    		command_category: command.description ?? "",
	    	});
	    } catch { /* analytics should not break business logic */ }
      void sendPrompt(text);
    },
    [sendPrompt]
  );

  const handleApprovalDecision = useCallback(
    (decision: string) => {
      const dialogId = pendingApproval?.id;
      const dialog = dialogId ? permissionDialogs[dialogId] : null;
      if (!dialog) return;
      const selectedOptionId = resolvePermissionDecisionOption(dialog.request.options, decision);
      dialog.resolve({ outcome: "selected", optionId: selectedOptionId });
	      resolveSessionApproval(setSessionsById, resolveStateKey(dialog.request.sessionId));
      setPermissionDialogs((current) => {
        const { [dialog.id]: _, ...rest } = current;
        return rest;
      });
      setActivePermissionDialogId((current) => (current === dialog.id ? null : current));
    },
	    [pendingApproval, permissionDialogs, resolveStateKey, setSessionsById, setPermissionDialogs, setActivePermissionDialogId]
  );

  const handleQuestionAnswers = useCallback(
    (answers: Record<string, string[]>) => {
      const dialogId = pendingQuestion?.id;
      const dialog = dialogId ? elicitationDialogs[dialogId] : null;
      if (!dialog) return;
      const content = answersToElicitationContent(answers, dialog.formFields);
      dialog.resolve({ action: { action: "accept", content } });
	      resolveSessionQuestion(setSessionsById, resolveStateKey(dialog.request.sessionId));
      setElicitationDialogs((current) => {
        const { [dialog.id]: _, ...rest } = current;
        return rest;
      });
      setActiveElicitationDialogId((current) => (current === dialog.id ? null : current));
    },
	    [elicitationDialogs, pendingQuestion, resolveStateKey, setSessionsById, setElicitationDialogs, setActiveElicitationDialogId]
  );

  const handleApprovePlan = useCallback(() => {
    if (!sessionId) return;
    const dialog = pendingPlan?.id ? elicitationDialogs[pendingPlan.id] : null;
    if (dialog) {
      dialog.resolve({ action: { action: "accept", content: { decision: "approved" } } });
      setElicitationDialogs((current) => {
        const { [dialog.id]: _, ...rest } = current;
        return rest;
      });
      setActiveElicitationDialogId((current) => (current === dialog.id ? null : current));
    }
	    if (!sessionKey) return;
	    updateSession(setSessionsById, sessionKey, (session) => ({
      ...session,
      pendingPlan: null,
      uiMessages: session.uiMessages.map((message) =>
        message.type === "plan" && message.plan
          ? { ...message, plan: { ...message.plan, approvalStatus: "approved" } }
          : message
      ),
    }));
    // Analytics: chat_plan_approved
    try {
	    logEvent(AnalyticsEvents.CHAT_PLAN_APPROVED, {
	    	session_id: sessionId,
	    	plan_type: pendingPlan?.goal ?? "",
	    });
    } catch { /* analytics should not break business logic */ }
    if (!dialog) void sendSteerPrompt("Plan approved. Continue.");
	  }, [elicitationDialogs, pendingPlan, sendSteerPrompt, sessionId, sessionKey, setSessionsById, setElicitationDialogs, setActiveElicitationDialogId]);

  const handleRejectPlan = useCallback(() => {
    if (!sessionId) return;
    const dialog = pendingPlan?.id ? elicitationDialogs[pendingPlan.id] : null;
    if (dialog) {
      dialog.resolve({ action: { action: "decline" } });
      setElicitationDialogs((current) => {
        const { [dialog.id]: _, ...rest } = current;
        return rest;
      });
      setActiveElicitationDialogId((current) => (current === dialog.id ? null : current));
    }
	    if (!sessionKey) return;
	    updateSession(setSessionsById, sessionKey, (session) => ({
      ...session,
      pendingPlan: null,
      uiMessages: session.uiMessages.map((message) =>
        message.type === "plan" && message.plan
          ? { ...message, plan: { ...message.plan, approvalStatus: "rejected" } }
          : message
      ),
    }));
    // Analytics: chat_plan_rejected
    try {
	    logEvent(AnalyticsEvents.CHAT_PLAN_REJECTED, {
	    	session_id: sessionId,
	    	plan_type: pendingPlan?.goal ?? "",
	    	rejection_reason: "user_rejected",
	    });
    } catch { /* analytics should not break business logic */ }
    if (!dialog) void sendSteerPrompt("Plan rejected. Stop and ask for revised instructions.");
	  }, [elicitationDialogs, pendingPlan, sendSteerPrompt, sessionId, sessionKey, setSessionsById, setElicitationDialogs, setActiveElicitationDialogId]);

  const cancelSteerQueueItems = useCallback(
    async (items: QueuedInputRecallItem[], _reason: string) => {
      if (!sessionId || items.length === 0) return;
      const cancellableItems = items.filter((item) => typeof item.id === "string" && item.id.trim().length > 0);
      if (cancellableItems.length === 0) return;
      setError(null);
      try {
        await Promise.all(cancellableItems.map((item) =>
          clientRef.current?.cancelSteerPrompt(sessionId, item.id!, buildSessionIdentityContext(activeSession))
        ));
        setSteerQueuesBySessionId((current) => ({
          ...current,
	          ...(sessionKey
	            ? { [sessionKey]: (current[sessionKey] ?? []).filter((item) => !cancellableItems.some((cancelled) => cancelled.id === item.id)) }
	            : {}),
	        }));
      } catch (cancelError) {
        setError(cancelError instanceof Error ? cancelError.message : String(cancelError));
      }
    },
		    [activeSession, sessionId, sessionKey, setError, setSteerQueuesBySessionId]
  );

  const recallSteerQueue = useCallback(
    async (items: QueuedInputRecallItem[]) => {
      if (!sessionId || items.length === 0) return;
      await cancelSteerQueueItems(items, "recall");
    },
    [cancelSteerQueueItems, sessionId]
  );

  const removeSteerQueueItem = useCallback(
    (id: string) => {
      const item = steerQueueItems.find((candidate) => candidate.id === id);
      if (!item) return;
      void cancelSteerQueueItems([item], "remove");
    },
    [cancelSteerQueueItems, steerQueueItems]
  );

  const clearSteerQueue = useCallback(() => {
    void cancelSteerQueueItems(steerQueueItems, "clear");
  }, [cancelSteerQueueItems, steerQueueItems]);

  const handleExpandSubagent = useCallback(
    (title: string, subagentType: string | undefined, subagentMessages: AgentMessage[], context?: SubagentSheetState["context"]) => {
      setSubagentSheet({ title, subagentType, messages: subagentMessages, answer: context?.answer, context });
    },
    [setSubagentSheet]
  );

  const closeSubagentSheet = useCallback(() => {
    setSubagentSheet(null);
  }, [setSubagentSheet]);

  const handleInspectTool = useCallback(
    (message: AgentMessage) => {
      const result = message.toolUseId
        ? messages.find((m) => m.type === "tool_result" && m.toolUseId === message.toolUseId)
        : undefined;
      setToolInspectState({ message, result });
    },
    [messages]
  );

  const closeToolInspect = useCallback(() => {
    setToolInspectState(null);
  }, []);

  const handleArtifactClick = useCallback(
    (artifactId: string) => {
      const artifact = artifacts.find((a) => a.id === artifactId);
      if (!artifact) return;
      const message = messages.find((m) => m.id === artifact.sourceMessageId);
      setArtifactDialogState({ artifact, message });
    },
    [artifacts, messages]
  );

  const closeArtifactDialog = useCallback(() => {
    setArtifactDialogState(null);
  }, []);

  const handleLoadSubagentDetails = useCallback(
    async (context: SubagentOpenContext): Promise<LoadedSubagentDetails> => {
      const liveMessages = resolveLiveSubagentMessages(sessionsById, {
        title: "",
        messages: [],
        context,
      });
      if (liveMessages && liveMessages.length > 0) {
        const toolUseId = context.toolUseId;
        const subagentId = context.subagentId;
        let title: string | undefined;
        let subagentType: string | undefined;
        for (const session of Object.values(sessionsById)) {
          const parent = session.uiMessages.find((m) =>
            m.type === "tool_use" &&
            (m.name === "Task" || m.name === "Agent") &&
            (
              (toolUseId && m.toolUseId === toolUseId) ||
              (subagentId && (m.subagentId === subagentId || m.toolUseId === subagentId))
            )
          );
          if (parent) {
            const input = parent.input as { description?: string; subagent_type?: string } | undefined;
            title = input?.description ?? parent.name;
            subagentType = input?.subagent_type;
            break;
          }
        }
        return { title, subagentType, messages: liveMessages };
      }
      if (context.messages && context.messages.length > 0) {
        return { messages: context.messages };
      }
      return { messages: [] };
    },
    [sessionsById]
  );

  return {
    status,
    connected,
    busy,
    error,
    activeSessionId,
    sessionsById,
    sessionOrder,
    sessions,
    acpSessionList,
    messages,
    streamingText,
    messageUpdates,
    pendingPlan,
    pendingApproval,
    pendingQuestion,
    slashCommands,
    artifacts,
    steerQueueItems,
    isTurnActive,
    isAgentRunning,
    executorType,
    model,
    cwd,
    // Agent/Provider/Model config
    agents: allAgents,
    globalAgents,
    workspaceAgents,
    selectedAgentId,
    selectedAgent,
    agentOptions,
    providerOptions,
    modelOptions,
    selectedProviderId,
    effectiveSelectedProviderId,
    effectiveSelectedModel,
    configLoading,
    configError,
    // Actions
    connect,
    disconnect,
    createSession,
    loadSession,
    refreshSessionList,
    closeActiveSession,
    selectSession,
    sendPrompt,
    sendSteerPrompt,
    interrupt,
    handleSlashCommand,
    handleApprovalDecision,
    handleQuestionAnswers,
    handleApprovePlan,
    handleRejectPlan,
    recallSteerQueue,
    removeSteerQueueItem,
    clearSteerQueue,
    setExecutorType,
    setModel,
    setCwd,
    setSelectedAgentId: handleSetSelectedAgentId,
    setSelectedProviderId,
    subagentSheet,
    liveSubagentMessages,
    subagentStreamingState,
    handleExpandSubagent,
    closeSubagentSheet,
    // Tool inspect & artifact dialogs
    toolInspectState,
    handleInspectTool,
    closeToolInspect,
    artifactDialogState,
    handleArtifactClick,
    closeArtifactDialog,
    handleLoadSubagentDetails,
  };
}
