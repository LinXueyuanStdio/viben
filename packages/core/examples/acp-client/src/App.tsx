import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ClipboardList,
  Copy,
  FileJson,
  MessageSquare,
  EthernetPort,
  FolderPlus,
  Loader2,
  Plug,
  Plus,
  RotateCcw,
  Save,
  Search,
  Send,
  SquareTerminal,
  Trash2,
  Unplug,
  X,
} from "lucide-react";
import { ChatInput, CommandQueuePanel, ExecApproval, MessageList, PlanApproval, QuestionInput, SubagentSheet } from "@viben/chat";
import type { AgentMessage, Artifact, CommandQueueItem, ContextTokenBreakdown, ExecutorOption, ExpandSubagentHandler, ModelOption, PendingQuestion, QueuedInputRecallItem, SkillConfig, SlashCommand, SlashCommandSelection, TaskPlan, ToolConfig } from "@viben/chat";
import type { PendingExecApproval } from "@viben/chat";
import {
  AcpWebSocketClient,
  type AgentConfigPayload,
  type AcpSessionUpdate,
  type CallToolResult,
  type ClientToolCall,
  type ClientToolExecutionRequest,
  type ConsumedSteerPromptResult,
  type ConnectionStatus,
  type ElicitationContentValue,
  type ElicitationPropertySchema,
  type ElicitationRequest,
  type ElicitationRequestLog,
  type ElicitationResponse,
  type PermissionDecisionRequest,
  type PermissionDecisionResult,
  type PermissionOption,
  type PermissionRequestLog,
  type TrafficEntry,
} from "./acp-client";
import {
  acpSessionUpdateToStreamingText,
  acpSessionUpdateToUiSteps,
  clientToolCallToUiSteps,
  clientToolRequestedToUiSteps,
  elicitationRequestToPendingQuestion,
  elicitationRequestToUiSteps,
  elicitationResultToUiSteps,
  getElicitationFormFields,
  permissionDecisionToUiSteps,
  permissionRequestToUiSteps,
  systemTextToUiSteps,
  userPromptToUiSteps,
  type AcpUiStep,
  type ElicitationFormField,
} from "./acp-chat-adapter";
import {
  appendSessionStreamingText,
  applyQueuedUiStep,
  createUiSession,
  drainSessionUiStepQueue,
  enqueueUiSteps,
  flushSessionStreamingText,
  resolveLiveSubagentMessages,
  resolveSessionApproval,
  resolveSessionQuestion,
  updateSession,
  type SubagentSheetState,
  type UiSessionState,
} from "./acp-chat-state";
import {
  formatJson as prettyJson,
  JsonBlock,
  JsonEditorPanel,
  JsonPanel,
  normalizeJsonText,
  parseJsonOrFallback,
} from "./json-renderer";

interface GuiActionDefinition {
  id: string;
  name: string;
  description: string;
  inputSchemaText: string;
  responseText: string;
  fail: boolean;
}

interface TrafficFilters {
  query: string;
  direction: "all" | "in" | "out";
  type: "all" | TrafficEntry["type"] | "error";
}

interface ToolApprovalDialogState {
  request: ClientToolExecutionRequest;
  draft: CallToolResult;
  responseText: string;
  resolve: (result: CallToolResult) => void;
}

interface PermissionDialogState {
  request: PermissionDecisionRequest;
  selectedOptionId: string;
  resolve: (result: PermissionDecisionResult) => void;
}

interface ElicitationDialogState {
  request: ElicitationRequest;
  pendingQuestion: PendingQuestion;
  formFields: ElicitationFormField[];
  answersText: string;
  resolve: (result: ElicitationResponse) => void;
}

interface ArtifactDialogState {
  artifact: Artifact;
  message?: AgentMessage;
}

const BACKEND_OPTIONS = [
  { value: "CLAUDE_CODE", label: "Claude ACP" },
  { value: "OPENCLAW", label: "OpenClaw ACP" },
  { value: "OPENCODE", label: "OpenCode" },
  { value: "CODEX", label: "Codex ACP" },
  { value: "GEMINI", label: "Gemini" },
  { value: "QWEN_CODE", label: "Qwen Code" },
];

const DEFAULT_WS_URL = "ws://127.0.0.1:18790/ws/agent/acp";
const DEFAULT_MODEL = "claude-sonnet-4-6";
const DEFAULT_PROMPT = "Call GUI_execute exactly once now. Use action get_action_detail with payload {\"action\":\"app.open_settings\"}. Do not use Bash. After the tool result, summarize the action name and available input schema.";
const DEFAULT_APPEND_PROMPT = "You must use the GUI_execute MCP tool when asked for GUI action details. Do not use Bash or shell commands for GUI actions.";
const DEFAULT_ACTIONS: GuiActionDefinition[] = [
  {
    id: "action-open-settings",
    name: "app.open_settings",
    description: "Open the app settings panel.",
    inputSchemaText: prettyJson({
      type: "object",
      properties: {
        section: { type: "string", enum: ["general", "models", "tools"] },
      },
    }),
    responseText: "Settings panel opened.",
    fail: false,
  },
  {
    id: "action-compose-message",
    name: "chat.compose_message",
    description: "Fill the current chat input with a draft message.",
    inputSchemaText: prettyJson({
      type: "object",
      properties: {
        text: { type: "string" },
        submit: { type: "boolean" },
      },
      required: ["text"],
    }),
    responseText: "Draft message composed.",
    fail: false,
  },
];

export function App() {
  const [wsUrl, setWsUrl] = useState(DEFAULT_WS_URL);
  const [cwd, setCwd] = useState("/root/viben");
  const [agentConfigPath, setAgentConfigPath] = useState("");
  const [executorType, setExecutorType] = useState("CLAUDE_CODE");
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [permissionMode, setPermissionMode] = useState("default");
  const [useInlineAgentConfig, setUseInlineAgentConfig] = useState(true);
  const [requestMcpServersText, setRequestMcpServersText] = useState("[]");
  const [executorConfigText, setExecutorConfigText] = useState("{}");
  const [sessionListResult, setSessionListResult] = useState<unknown>(null);
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [steerPromptText, setSteerPromptText] = useState("Use the latest user instruction as steering context for the current turn.");
  const [steerPromptId, setSteerPromptId] = useState("");
  const [steerQueuesBySessionId, setSteerQueuesBySessionId] = useState<Record<string, CommandQueueItem[]>>({});
  const [steerQueuePausedBySessionId, setSteerQueuePausedBySessionId] = useState<Record<string, boolean>>({});
  const [steerResult, setSteerResult] = useState<unknown>(null);
  const [viewMode, setViewMode] = useState<"chat" | "inspector">("chat");
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionsById, setSessionsById] = useState<Record<string, UiSessionState>>({});
  const [sessionOrder, setSessionOrder] = useState<string[]>([]);
  const [loadSessionId, setLoadSessionId] = useState("");
  const [initializeResult, setInitializeResult] = useState<unknown>(null);
  const [traffic, setTraffic] = useState<TrafficEntry[]>([]);
  const [trafficFilters, setTrafficFilters] = useState<TrafficFilters>({
    query: "",
    direction: "all",
    type: "all",
  });
  const [actions, setActions] = useState<GuiActionDefinition[]>(DEFAULT_ACTIONS);
  const [selectedActionId, setSelectedActionId] = useState(DEFAULT_ACTIONS[0]?.id ?? "");
  const [toolDialog, setToolDialog] = useState<ToolApprovalDialogState | null>(null);
  const [permissionDialog, setPermissionDialog] = useState<PermissionDialogState | null>(null);
  const [elicitationDialog, setElicitationDialog] = useState<ElicitationDialogState | null>(null);
  const [subagentSheet, setSubagentSheet] = useState<SubagentSheetState | null>(null);
  const [artifactDialog, setArtifactDialog] = useState<ArtifactDialogState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const clientRef = useRef<AcpWebSocketClient | null>(null);
  const actionsRef = useRef(actions);

  const busy = status === "connecting";
  const connected = status === "connected";
  const stats = useMemo(() => summarizeTraffic(traffic), [traffic]);
  const filteredTraffic = useMemo(() => filterTraffic(traffic, trafficFilters), [traffic, trafficFilters]);
  const activeSession = activeSessionId ? sessionsById[activeSessionId] : null;
  const sessionId = activeSession?.id ?? null;
  const messages = activeSession?.uiMessages ?? [];
  const streamingText = activeSession?.streamingText ?? null;
  const messageUpdates = activeSession?.messageUpdates ?? {};
  const clientToolCalls = activeSession?.clientToolCalls ?? [];
  const permissionRequests = activeSession?.permissionRequests ?? [];
  const elicitationRequests = activeSession?.elicitationRequests ?? [];
  const pendingApproval = activeSession?.pendingApproval ?? null;
  const pendingQuestion = activeSession?.pendingQuestion ?? null;
  const pendingPlan = activeSession?.pendingPlan ?? null;
  const artifacts = activeSession?.artifacts ?? [];
  const slashCommands = activeSession?.slashCommands ?? [];
  const sessionResult = activeSession?.sessionResult ?? null;
  const promptResult = activeSession?.promptResult ?? null;
  const isTurnActive = Boolean(
    activeSession?.promptInFlight ||
    activeSession?.uiStepQueue.length ||
    activeSession?.pendingPlan ||
    activeSession?.pendingApproval ||
    activeSession?.pendingQuestion
  );
  const steerQueueItems = sessionId ? steerQueuesBySessionId[sessionId] ?? [] : [];
  const steerQueuePaused = sessionId ? steerQueuePausedBySessionId[sessionId] ?? false : false;
  const selectedAction = actions.find((action) => action.id === selectedActionId) ?? actions[0] ?? null;
  const actionSummaries = useMemo(() => buildActionSummaries(actions), [actions]);
  const chatTools = useMemo(() => buildChatToolConfigs(actions), [actions]);
  const chatSkills = useMemo(() => buildChatSkillConfigs(slashCommands), [slashCommands]);
  const chatContextBreakdown = useMemo(
    () => buildChatContextBreakdown(messages, streamingText, slashCommands, actionSummaries, steerQueueItems),
    [actionSummaries, messages, slashCommands, steerQueueItems, streamingText]
  );
  const requestMcpServers = useMemo(() => parseJsonOrFallback(requestMcpServersText, []), [requestMcpServersText]);
  const executorConfig = useMemo(() => parseJsonOrFallback(executorConfigText, {}), [executorConfigText]);

  useEffect(() => {
    actionsRef.current = actions;
  }, [actions]);

  useEffect(() => {
    const sessionEntries = Object.values(sessionsById);
    const drainable = sessionEntries.find((session) =>
      !session.pendingPlan &&
      !session.pendingApproval &&
      !session.pendingQuestion &&
      session.uiStepQueue.length > 0
    );
    if (!drainable) return;

    const timer = window.setTimeout(() => {
      setSessionsById((current) => {
        const session = current[drainable.id];
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
          [session.id]: applyQueuedUiStep(session, step, rest),
        };
      });
    }, 80);

    return () => window.clearTimeout(timer);
  }, [sessionsById]);

  const appendTraffic = useCallback((entry: TrafficEntry) => {
    setTraffic((current) => [entry, ...current].slice(0, 120));
  }, []);

  const appendSessionUpdate = useCallback((notification: AcpSessionUpdate) => {
    const text = acpSessionUpdateToStreamingText(notification);
    if (text !== null) {
      appendSessionStreamingText(setSessionsById, notification.sessionId, text);
      return;
    }
    enqueueUiSteps(setSessionsById, notification.sessionId, acpSessionUpdateToUiSteps(notification));
  }, []);

  const appendClientToolCall = useCallback((call: ClientToolCall) => {
    updateSession(setSessionsById, call.sessionId, (session) => ({
      ...session,
      clientToolCalls: [call, ...session.clientToolCalls].slice(0, 50),
      lastActiveAt: new Date().toISOString(),
    }));
    enqueueUiSteps(setSessionsById, call.sessionId, clientToolCallToUiSteps(call));
  }, []);

  const appendPermissionRequest = useCallback((request: PermissionRequestLog) => {
    updateSession(setSessionsById, request.sessionId, (session) => ({
      ...session,
      permissionRequests: [request, ...session.permissionRequests].slice(0, 50),
      lastActiveAt: new Date().toISOString(),
    }));
    enqueueUiSteps(setSessionsById, request.sessionId, permissionDecisionToUiSteps(request));
  }, []);

  const appendElicitationRequest = useCallback((request: ElicitationRequestLog) => {
    updateSession(setSessionsById, request.sessionId, (session) => ({
      ...session,
      elicitationRequests: [request, ...session.elicitationRequests].slice(0, 50),
      lastActiveAt: new Date().toISOString(),
    }));
    enqueueUiSteps(setSessionsById, request.sessionId, elicitationResultToUiSteps(request));
  }, []);

  const appendSteerPromptConsumed = useCallback((result: ConsumedSteerPromptResult & { sessionId: string }) => {
    setSteerResult(result);
    setSteerPromptId((current) => current || result.promptId);
    setSteerQueuesBySessionId((current) => ({
      ...current,
      [result.sessionId]: (current[result.sessionId] ?? []).filter((item) => item.id !== result.promptId),
    }));
    enqueueUiSteps(
      setSessionsById,
      result.sessionId,
      systemTextToUiSteps(`Steer prompt consumed: ${result.promptId}`)
    );
  }, []);

  const executeClientTool = useCallback(
    (request: ClientToolExecutionRequest): CallToolResult => {
      if (!isGuiExecuteTool(request.toolName)) {
        return {
          content: [{ type: "text", text: `Example client has no handler for ${request.toolName}.` }],
          isError: true,
        };
      }
      return executeGuiAction(request, actionsRef.current);
    },
    []
  );

  const requestClientToolResult = useCallback((request: ClientToolExecutionRequest, draft: CallToolResult): Promise<CallToolResult> => {
    enqueueUiSteps(setSessionsById, request.sessionId, clientToolRequestedToUiSteps(request));
    return new Promise((resolve) => {
      setToolDialog({
        request,
        draft,
        responseText: prettyJson(draft),
        resolve,
      });
    });
  }, []);

  const requestPermissionDecision = useCallback((request: PermissionDecisionRequest): Promise<PermissionDecisionResult> => {
    enqueueUiSteps(setSessionsById, request.sessionId, permissionRequestToUiSteps(request));
    return new Promise((resolve) => {
      const selected = selectInitialPermissionOption(request.options);
      setPermissionDialog({
        request,
        selectedOptionId: selected ? permissionOptionId(selected, request.options.indexOf(selected)) : "",
        resolve,
      });
    });
  }, []);

  const requestElicitationResponse = useCallback((request: ElicitationRequest): Promise<ElicitationResponse> => {
    enqueueUiSteps(setSessionsById, request.sessionId, elicitationRequestToUiSteps(request));
    return new Promise((resolve) => {
      const pendingQuestion = elicitationRequestToPendingQuestion(request);
      const formFields = getElicitationFormFields(request);
      setElicitationDialog({
        request,
        pendingQuestion,
        formFields,
        answersText: prettyJson(buildDefaultElicitationContent(formFields)),
        resolve,
      });
    });
  }, []);

  const ensureClient = useCallback(() => {
    if (!clientRef.current) {
      clientRef.current = new AcpWebSocketClient({
        onTraffic: appendTraffic,
        onSessionUpdate: appendSessionUpdate,
        onClientToolCall: appendClientToolCall,
        onPermissionRequest: appendPermissionRequest,
        onElicitationRequest: appendElicitationRequest,
        onSteerPromptConsumed: appendSteerPromptConsumed,
        executeClientTool,
        requestClientToolResult,
        requestPermissionDecision,
        requestElicitationResponse,
        onStatus: setStatus,
        onError: setError,
      });
    }
    return clientRef.current;
  }, [appendClientToolCall, appendElicitationRequest, appendPermissionRequest, appendSessionUpdate, appendSteerPromptConsumed, appendTraffic, executeClientTool, requestClientToolResult, requestElicitationResponse, requestPermissionDecision]);

  const buildAgentConfig = useCallback((): AgentConfigPayload | undefined => {
    if (!useInlineAgentConfig) return undefined;
    const parsedExecutorConfig = isRecord(executorConfig) ? executorConfig : {};
    const mcpServers = requestMcpServersToAgentConfig(requestMcpServers);
    return {
      executor_type: executorType,
      model: model.trim() || undefined,
      permission_mode: permissionMode,
      mcp_servers: mcpServers.includes("client_side") ? mcpServers : ["client_side", ...mcpServers],
      append_prompt: DEFAULT_APPEND_PROMPT,
      executor_config: parsedExecutorConfig,
    };
  }, [executorConfig, executorType, model, permissionMode, requestMcpServers, useInlineAgentConfig]);

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
  }, [ensureClient, wsUrl]);

  const createSession = useCallback(async () => {
    setError(null);
    try {
      const client = ensureClient();
      await client.connect(wsUrl);
      if (!initializeResult) {
        setInitializeResult(await client.initialize());
      }
      const session = await client.newSession({
        cwd,
        agent_config_path: agentConfigPath.trim() || undefined,
        agent_config: buildAgentConfig(),
        mcpServers: requestMcpServersToRequest(requestMcpServers),
      });
      const id = readSessionId(session);
      if (!id) throw new Error("session/new did not return sessionId");
      const record = createUiSession(id, cwd, session);
      setSessionsById((current) => ({ ...current, [id]: record }));
      setSessionOrder((current) => [id, ...current.filter((item) => item !== id)]);
      setActiveSessionId(id);
      enqueueUiSteps(setSessionsById, id, systemTextToUiSteps(`Session ready: ${id}`));
    } catch (sessionError) {
      setError(sessionError instanceof Error ? sessionError.message : String(sessionError));
    }
  }, [agentConfigPath, buildAgentConfig, cwd, ensureClient, initializeResult, requestMcpServers, wsUrl]);

  const loadSession = useCallback(async () => {
    const id = loadSessionId.trim();
    if (!id) return;
    setError(null);
    try {
      const client = ensureClient();
      await client.connect(wsUrl);
      if (!initializeResult) {
        setInitializeResult(await client.initialize());
      }
      const session = await client.loadSession({
        session_id: id,
        cwd,
        agent_config: buildAgentConfig(),
        mcpServers: requestMcpServersToRequest(requestMcpServers),
      });
      const loadedId = readSessionId(session) ?? id;
      setSessionsById((current) => ({
        ...current,
        [loadedId]: createUiSession(loadedId, cwd, session, current[loadedId]),
      }));
      setSessionOrder((current) => [loadedId, ...current.filter((item) => item !== loadedId)]);
      setActiveSessionId(loadedId);
      enqueueUiSteps(setSessionsById, loadedId, systemTextToUiSteps(`Session loaded: ${loadedId}`));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    }
  }, [buildAgentConfig, cwd, ensureClient, initializeResult, loadSessionId, requestMcpServers, wsUrl]);

  const disconnect = useCallback(() => {
    clientRef.current?.disconnect();
    clientRef.current = null;
  }, []);

  const sendPromptText = useCallback(async (content: string) => {
    if (!sessionId) return;
    const text = content.trim();
    if (!text) return;

    setError(null);
    enqueueUiSteps(setSessionsById, sessionId, userPromptToUiSteps(text));
    updateSession(setSessionsById, sessionId, (session) => ({
      ...session,
      promptInFlight: true,
      promptResult: null,
      lastActiveAt: new Date().toISOString(),
    }));
    try {
      const result = await clientRef.current?.prompt(sessionId, text);
      updateSession(setSessionsById, sessionId, (session) => ({
        ...flushSessionStreamingText(drainSessionUiStepQueue(session), promptResultToSummaryMessages(result)),
        promptInFlight: false,
        promptResult: result,
        lastActiveAt: new Date().toISOString(),
      }));
    } catch (promptError) {
      updateSession(setSessionsById, sessionId, (session) => ({
        ...flushSessionStreamingText(drainSessionUiStepQueue(session)),
        promptInFlight: false,
        lastActiveAt: new Date().toISOString(),
      }));
      setError(promptError instanceof Error ? promptError.message : String(promptError));
    }
  }, [sessionId]);

  const sendPrompt = useCallback(async () => {
    await sendPromptText(prompt);
  }, [prompt, sendPromptText]);

  const handleSlashCommand = useCallback((command: SlashCommand, selection: SlashCommandSelection) => {
    const args = selection.args.trim();
    const text = `/${command.name}${args ? ` ${args}` : ""}`;
    void sendPromptText(text);
  }, [sendPromptText]);

  const sendSteerPromptText = useCallback(async (content: string): Promise<string | null> => {
    if (!sessionId) return null;
    const text = content.trim();
    if (!text) return null;

    setError(null);
    enqueueUiSteps(setSessionsById, sessionId, systemTextToUiSteps(`Steer queued: ${text}`));
    try {
      const result = await clientRef.current?.steerPrompt({
        sessionId,
        text,
        agentId: executorType,
        userId: "example-client",
        meta: { source: "core-acp-client-example" },
      });
      setSteerResult(result ?? null);
      if (result?.promptId) {
        setSteerPromptId(result.promptId);
        return result.promptId;
      }
    } catch (steerError) {
      setError(steerError instanceof Error ? steerError.message : String(steerError));
    }
    return null;
  }, [executorType, sessionId]);

  const upsertSteerQueueItem = useCallback((targetSessionId: string, item: CommandQueueItem) => {
    setSteerQueuesBySessionId((current) => ({
      ...current,
      [targetSessionId]: [
        ...(current[targetSessionId] ?? []).filter((candidate) => candidate.id !== item.id),
        item,
      ],
    }));
  }, []);

  const updateActiveSteerQueue = useCallback((updater: (items: CommandQueueItem[]) => CommandQueueItem[]) => {
    if (!sessionId) return;
    setSteerQueuesBySessionId((current) => ({
      ...current,
      [sessionId]: updater(current[sessionId] ?? []),
    }));
  }, [sessionId]);

  const setActiveSteerQueuePaused = useCallback((paused: boolean) => {
    if (!sessionId) return;
    setSteerQueuePausedBySessionId((current) => ({
      ...current,
      [sessionId]: paused,
    }));
  }, [sessionId]);

  const sendSteerPrompt = useCallback(async () => {
    const targetSessionId = sessionId;
    if (!targetSessionId) return;
    const promptId = await sendSteerPromptText(steerPromptText);
    if (!promptId) return;
    upsertSteerQueueItem(targetSessionId, { id: promptId, content: steerPromptText.trim(), createdAt: Date.now() });
    setSteerPromptText("");
  }, [sendSteerPromptText, sessionId, steerPromptText, upsertSteerQueueItem]);

  const handleSteerInputSend = useCallback(async (content: string) => {
    const targetSessionId = sessionId;
    if (!targetSessionId) return;
    const text = content.trim();
    if (!text) return;
    const promptId = await sendSteerPromptText(text);
    if (!promptId) return;
    upsertSteerQueueItem(targetSessionId, { id: promptId, content: text, createdAt: Date.now() });
  }, [sendSteerPromptText, sessionId, upsertSteerQueueItem]);

  const cancelSteerPrompt = useCallback(async () => {
    if (!sessionId || !steerPromptId.trim()) return;
    setError(null);
    try {
      const result = await clientRef.current?.cancelSteerPrompt(sessionId, steerPromptId.trim());
      setSteerResult(result ?? null);
      updateActiveSteerQueue((current) => current.filter((item) => item.id !== steerPromptId.trim()));
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : String(cancelError));
    }
  }, [sessionId, steerPromptId, updateActiveSteerQueue]);

  const cancelSteerQueueItems = useCallback(async (items: QueuedInputRecallItem[], reason: string) => {
    if (!sessionId || items.length === 0) return;
    const cancellableItems = items.filter(hasRecallItemId);
    if (cancellableItems.length === 0) return;
    setError(null);
    try {
      const results = await Promise.all(
        cancellableItems.map((item) => clientRef.current?.cancelSteerPrompt(sessionId, item.id))
      );
      setSteerResult({
        action: reason,
        cancelled: results,
        promptIds: cancellableItems.map((item) => item.id),
      });
      updateActiveSteerQueue((current) => current.filter((item) => !cancellableItems.some((cancelled) => cancelled.id === item.id)));
      if (cancellableItems.some((item) => item.id === steerPromptId)) {
        setSteerPromptId("");
      }
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : String(cancelError));
    }
  }, [sessionId, steerPromptId, updateActiveSteerQueue]);

  const removeSteerQueueItem = useCallback((id: string) => {
    const item = steerQueueItems.find((candidate) => candidate.id === id);
    if (!item) return;
    void cancelSteerQueueItems([item], "remove");
  }, [cancelSteerQueueItems, steerQueueItems]);

  const clearSteerQueue = useCallback(() => {
    void cancelSteerQueueItems(steerQueueItems, "clear");
  }, [cancelSteerQueueItems, steerQueueItems]);

  const recallSteerQueue = useCallback(async (
    items: QueuedInputRecallItem[] = steerQueueItems,
    applyValue: (value: string) => void = setPrompt
  ) => {
    if (!sessionId || items.length === 0) return;
    const recalledItems = items;
    const recalledValue = recalledItems.map((item) => item.content.trim()).filter(Boolean).join("\n\n");
    setError(null);
    try {
      await cancelSteerQueueItems(recalledItems, "recall");
      if (recalledValue) {
        applyValue(recalledValue);
      }
      setSteerPromptId(recalledItems[0]?.id ?? "");
    } catch (recallError) {
      setError(recallError instanceof Error ? recallError.message : String(recallError));
    }
  }, [cancelSteerQueueItems, sessionId, steerQueueItems]);

  const viewSteerPrompt = useCallback(async () => {
    if (!sessionId) return;
    setError(null);
    try {
      const result = await clientRef.current?.viewSteerPrompt(sessionId, steerPromptId.trim() || undefined);
      setSteerResult(result ?? null);
    } catch (viewError) {
      setError(viewError instanceof Error ? viewError.message : String(viewError));
    }
  }, [sessionId, steerPromptId]);

  const cancel = useCallback(() => {
    if (!sessionId) return;
    clientRef.current?.cancel(sessionId);
    updateSession(setSessionsById, sessionId, (session) => ({
      ...session,
      promptInFlight: false,
      lastActiveAt: new Date().toISOString(),
    }));
  }, [sessionId]);

  const interrupt = useCallback(async () => {
    if (!sessionId) return;
    const pendingSteerText = prompt.trim();
    setError(null);
    if (toolDialog) {
      toolDialog.resolve(textErrorResult("Interrupted by ACP client user."));
      setToolDialog(null);
    }
    if (permissionDialog) {
      permissionDialog.resolve({ outcome: "cancelled" });
      setPermissionDialog(null);
    }
    if (elicitationDialog) {
      elicitationDialog.resolve({ action: { action: "cancel" } });
      setElicitationDialog(null);
    }
    updateSession(setSessionsById, sessionId, (session) => ({
      ...session,
      pendingApproval: null,
      pendingQuestion: null,
      pendingPlan: null,
      lastActiveAt: new Date().toISOString(),
    }));

    try {
      let promptId: string | null = null;
      if (isTurnActive && pendingSteerText) {
        promptId = await sendSteerPromptText(pendingSteerText);
      }
      if (promptId) {
        upsertSteerQueueItem(sessionId, { id: promptId, content: pendingSteerText, createdAt: Date.now() });
        setPrompt("");
      }
      const result = await clientRef.current?.interrupt(sessionId);
      setSteerResult(result ?? null);
    } catch (interruptError) {
      setError(interruptError instanceof Error ? interruptError.message : String(interruptError));
    }
  }, [elicitationDialog, isTurnActive, permissionDialog, prompt, sendSteerPromptText, sessionId, toolDialog, upsertSteerQueueItem]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !sessionId || !isTurnActive) return;
      const target = event.target;
      if (target instanceof HTMLElement && target.closest('[role="dialog"]')) return;
      event.preventDefault();
      void interrupt();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [interrupt, isTurnActive, sessionId]);

  const listSessions = useCallback(async () => {
    setError(null);
    try {
      const result = await clientRef.current?.listSessions();
      setSessionListResult(result ?? null);
    } catch (listError) {
      setError(listError instanceof Error ? listError.message : String(listError));
    }
  }, []);

  const closeActiveSession = useCallback(async () => {
    if (!sessionId) return;
    setError(null);
    try {
      await clientRef.current?.closeSession(sessionId);
      setSessionsById((current) => {
        const next = { ...current };
        delete next[sessionId];
        return next;
      });
      setSteerQueuesBySessionId((current) => {
        const next = { ...current };
        delete next[sessionId];
        return next;
      });
      setSteerQueuePausedBySessionId((current) => {
        const next = { ...current };
        delete next[sessionId];
        return next;
      });
      setSessionOrder((current) => current.filter((id) => id !== sessionId));
      setActiveSessionId((current) => (current === sessionId ? null : current));
    } catch (closeError) {
      setError(closeError instanceof Error ? closeError.message : String(closeError));
    }
  }, [sessionId]);

  const submitToolDialog = useCallback(() => {
    if (!toolDialog) return;
    const parsed = parseJsonOrFallback(toolDialog.responseText, null);
    const result = isCallToolResult(parsed)
      ? parsed
      : textErrorResult(toolDialog.responseText);
    toolDialog.resolve(result);
    setToolDialog(null);
  }, [toolDialog]);

  const rejectToolDialog = useCallback(() => {
    if (!toolDialog) return;
    toolDialog.resolve(textErrorResult("Rejected by ACP client user."));
    setToolDialog(null);
  }, [toolDialog]);

  const submitPermissionDialog = useCallback(() => {
    if (!permissionDialog) return;
    permissionDialog.resolve({
      outcome: "selected",
      optionId: permissionDialog.selectedOptionId || "allow",
    });
    resolveSessionApproval(setSessionsById, permissionDialog.request.sessionId);
    setPermissionDialog(null);
  }, [permissionDialog]);

  const cancelPermissionDialog = useCallback(() => {
    if (!permissionDialog) return;
    permissionDialog.resolve({ outcome: "cancelled" });
    resolveSessionApproval(setSessionsById, permissionDialog.request.sessionId);
    setPermissionDialog(null);
  }, [permissionDialog]);

  const submitElicitationDialog = useCallback(() => {
    if (!elicitationDialog) return;
    const parsed = parseJsonOrFallback(elicitationDialog.answersText, {});
    const content = normalizeElicitationContent(parsed, elicitationDialog.formFields);
    elicitationDialog.resolve({ action: { action: "accept", content } });
    resolveSessionQuestion(setSessionsById, elicitationDialog.request.sessionId);
    setElicitationDialog(null);
  }, [elicitationDialog]);

  const declineElicitationDialog = useCallback(() => {
    if (!elicitationDialog) return;
    elicitationDialog.resolve({ action: { action: "decline" } });
    resolveSessionQuestion(setSessionsById, elicitationDialog.request.sessionId);
    setElicitationDialog(null);
  }, [elicitationDialog]);

  const cancelElicitationDialog = useCallback(() => {
    if (!elicitationDialog) return;
    elicitationDialog.resolve({ action: { action: "cancel" } });
    resolveSessionQuestion(setSessionsById, elicitationDialog.request.sessionId);
    setElicitationDialog(null);
  }, [elicitationDialog]);

  const handleApprovalDecision = useCallback((decision: string) => {
    const dialog = permissionDialog;
    if (!dialog) return;
    const selectedOptionId = resolvePermissionDecisionOption(dialog.request.options, decision);
    dialog.resolve(
      decision === "reject" || selectedOptionId.toLowerCase().includes("reject")
        ? { outcome: "selected", optionId: selectedOptionId }
        : { outcome: "selected", optionId: selectedOptionId }
    );
    resolveSessionApproval(setSessionsById, dialog.request.sessionId);
    setPermissionDialog(null);
  }, [permissionDialog]);

  const handleQuestionAnswers = useCallback((answers: Record<string, string[]>) => {
    const dialog = elicitationDialog;
    if (!dialog) return;
    const content = answersToElicitationContent(answers, dialog.formFields);
    dialog.resolve({ action: { action: "accept", content } });
    resolveSessionQuestion(setSessionsById, dialog.request.sessionId);
    setElicitationDialog(null);
  }, [elicitationDialog]);

  const handleApprovePlan = useCallback(() => {
    if (!sessionId) return;
    updateSession(setSessionsById, sessionId, (session) => ({
      ...session,
      pendingPlan: null,
      uiMessages: session.uiMessages.map((message) =>
        message.type === "plan" && message.plan
          ? { ...message, plan: { ...message.plan, approvalStatus: "approved" } }
          : message
      ),
    }));
    void sendSteerPromptText("Plan approved. Continue.");
  }, [sendSteerPromptText, sessionId]);

  const handleRejectPlan = useCallback(() => {
    if (!sessionId) return;
    updateSession(setSessionsById, sessionId, (session) => ({
      ...session,
      pendingPlan: null,
      uiMessages: session.uiMessages.map((message) =>
        message.type === "plan" && message.plan
          ? { ...message, plan: { ...message.plan, approvalStatus: "rejected" } }
          : message
      ),
    }));
    void sendSteerPromptText("Plan rejected. Stop and ask for revised instructions.");
  }, [sendSteerPromptText, sessionId]);

  const handleExpandSubagent = useCallback<ExpandSubagentHandler>((title, subagentType, subagentMessages, context) => {
    setSubagentSheet({ title, subagentType, messages: subagentMessages, context });
  }, []);

  const handleArtifactClick = useCallback((artifactId: string) => {
    const artifact = artifacts.find((item) => item.id === artifactId);
    if (!artifact) return;
    const message = messages.find((item) => item.id === artifact.sourceMessageId);
    setArtifactDialog({ artifact, message });
  }, [artifacts, messages]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 hidden w-80 border-r border-border bg-sidebar px-4 py-5 lg:block">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <EthernetPort size={20} />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold tracking-wide">Viben ACP</div>
              <div className="text-xs text-muted-foreground">WebSocket Client</div>
            </div>
          </div>
          <StatusPill status={status} compact />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button className={viewMode === "chat" ? "btn-primary" : "btn-secondary"} onClick={() => setViewMode("chat")}>
            <MessageSquare size={16} />
            Chat
          </button>
          <button className={viewMode === "inspector" ? "btn-primary" : "btn-secondary"} onClick={() => setViewMode("inspector")}>
            <EthernetPort size={16} />
            Inspect
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button className="btn-secondary" onClick={createSession} disabled={!connected}>
            <FolderPlus size={16} />
            New
          </button>
          <button className="btn-secondary" onClick={loadSession} disabled={!connected || !loadSessionId.trim()}>
            <RotateCcw size={16} />
            Load
          </button>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button className="btn-secondary" onClick={listSessions} disabled={!connected}>
            <ClipboardList size={16} />
            List
          </button>
          <button className="btn-secondary" onClick={closeActiveSession} disabled={!connected || !sessionId}>
            <X size={16} />
            Close
          </button>
        </div>

        <input
          value={loadSessionId}
          onChange={(event) => setLoadSessionId(event.target.value)}
          className="input mt-3 text-xs"
          placeholder="session id to load"
        />

        <div className="mt-5 flex items-center justify-between text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <span>Sessions</span>
          <span>{sessionOrder.length}</span>
        </div>
        <div className="mt-2 max-h-[calc(100vh-260px)] space-y-2 overflow-auto pr-1">
          {sessionOrder.length === 0 ? (
            <EmptyState text="No sessions." compact />
          ) : (
            sessionOrder.map((id) => (
              <SessionRow
                key={id}
                session={sessionsById[id]}
                active={id === activeSessionId}
                onSelect={() => setActiveSessionId(id)}
              />
            ))
          )}
        </div>

        <div className="absolute bottom-5 left-4 right-4 rounded-lg border border-border bg-surface p-3">
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <Stat label="In" value={stats.inbound} />
            <Stat label="Out" value={stats.outbound} />
            <Stat label="Err" value={stats.errors} />
            <Stat label="Tools" value={stats.clientTools} />
          </div>
        </div>
      </aside>

      <main className="lg:pl-80">
        <header className="sticky top-0 z-20 border-b border-border bg-background/90 px-5 py-4 backdrop-blur">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-xl font-semibold tracking-tight">
                {viewMode === "chat" ? "ACP Chat" : "ACP WebSocket 调试客户端"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {viewMode === "chat"
                  ? "A real conversation surface over ACP with prompt, steering, approvals, elicitation, and slash commands."
                  : <>Connects to Viben Gateway at <code>/ws/agent/acp</code> and speaks ACP JSON-RPC.</>}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button className="btn-secondary" onClick={() => copyText(sessionId ?? "")} disabled={!sessionId}>
                <Copy size={16} />
                Copy Session
              </button>
              <button className="btn-secondary" onClick={createSession} disabled={!connected}>
                <FolderPlus size={16} />
                New Session
              </button>
              {connected ? (
                <button className="btn-danger" onClick={disconnect}>
                  <Unplug size={16} />
                  Disconnect
                </button>
              ) : (
                <button className="btn-primary" onClick={connect} disabled={busy}>
                  {busy ? <Loader2 className="animate-spin" size={16} /> : <Plug size={16} />}
                  Connect
                </button>
              )}
            </div>
          </div>
        </header>

        {viewMode === "chat" ? (
          <AcpChatSurface
            connected={connected}
            sessionId={sessionId}
            messages={messages}
            streamingText={streamingText}
            messageUpdates={messageUpdates}
            pendingPlan={pendingPlan}
            pendingApproval={pendingApproval}
            pendingQuestion={pendingQuestion}
            slashCommands={slashCommands}
            tools={chatTools}
            skills={chatSkills}
            contextBreakdown={chatContextBreakdown}
            executorType={executorType}
            model={model}
            onExecutorTypeChange={setExecutorType}
            onModelChange={setModel}
            artifacts={artifacts}
            error={error}
            steerQueueItems={steerQueueItems}
            steerQueuePaused={steerQueuePaused}
            isStreaming={isTurnActive}
            prompt={prompt}
            onPromptChange={setPrompt}
            onSendPrompt={(content) => void sendPromptText(content)}
            onCancelTurn={() => void interrupt()}
            onSlashCommand={handleSlashCommand}
            onApprovePlan={handleApprovePlan}
            onRejectPlan={handleRejectPlan}
            onApprovalDecision={handleApprovalDecision}
            onQuestionAnswers={handleQuestionAnswers}
            onSteerSend={(content) => void handleSteerInputSend(content)}
            onRecallSteerQueue={(items, value) => {
              setPrompt(value);
              void recallSteerQueue(items, setPrompt);
            }}
            onExpandSubagent={handleExpandSubagent}
            onArtifactClick={handleArtifactClick}
            onRemoveSteerQueueItem={removeSteerQueueItem}
            onClearSteerQueue={clearSteerQueue}
            onPauseSteerQueue={() => setActiveSteerQueuePaused(true)}
            onResumeSteerQueue={() => setActiveSteerQueuePaused(false)}
            onCreateSession={createSession}
            onConnect={connect}
            onLoadSession={loadSession}
            loadSessionId={loadSessionId}
            onLoadSessionIdChange={setLoadSessionId}
            busy={busy}
          />
        ) : (
        <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <section className="space-y-5">
            <Panel title="GUI_execute Action Editor" description="Actions exposed by this example client to backend agents.">
              <div className="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)]">
                <div className="space-y-2">
                  {actions.map((action) => (
                    <button
                      key={action.id}
                      className={action.id === selectedAction?.id ? "action-tab action-tab-active" : "action-tab"}
                      onClick={() => setSelectedActionId(action.id)}
                    >
                      <span className="truncate">{action.name}</span>
                      {action.fail && <span className="action-fail">error</span>}
                    </button>
                  ))}
                  <button
                    className="btn-secondary w-full"
                    onClick={() => {
                      const action = createBlankAction();
                      setActions((current) => [...current, action]);
                      setSelectedActionId(action.id);
                    }}
                  >
                    <Plus size={16} />
                    Add Action
                  </button>
                </div>

                {selectedAction ? (
                  <div className="grid gap-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Action Name">
                        <input
                          value={selectedAction.name}
                          onChange={(event) => updateAction(setActions, selectedAction.id, { name: event.target.value })}
                          className="input"
                          placeholder="namespace.name"
                        />
                      </Field>
                      <Field label="Response">
                        <input
                          value={selectedAction.responseText}
                          onChange={(event) => updateAction(setActions, selectedAction.id, { responseText: event.target.value })}
                          className="input"
                        />
                      </Field>
                    </div>
                    <Field label="Description">
                      <input
                        value={selectedAction.description}
                        onChange={(event) => updateAction(setActions, selectedAction.id, { description: event.target.value })}
                        className="input"
                      />
                    </Field>
                    <Field label="Input Schema JSON">
                      <JsonEditorPanel
                        value={selectedAction.inputSchemaText}
                        onChange={(value) => updateAction(setActions, selectedAction.id, { inputSchemaText: value })}
                        size="row"
                        mode="text"
                      />
                    </Field>
                    <div className="flex flex-wrap gap-2">
                      <label className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm">
                        <input
                          type="checkbox"
                          checked={selectedAction.fail}
                          onChange={(event) => updateAction(setActions, selectedAction.id, { fail: event.target.checked })}
                        />
                        Return isError
                      </label>
                      <button
                        className="btn-secondary"
                        onClick={() => updateAction(setActions, selectedAction.id, { inputSchemaText: normalizeJsonText(selectedAction.inputSchemaText) })}
                      >
                        <FileJson size={16} />
                        Format Schema
                      </button>
                      <button
                        className="btn-secondary"
                        onClick={() => setPrompt(buildGuiExecutePrompt(selectedAction.name))}
                      >
                        <Save size={16} />
                        Use In Prompt
                      </button>
                      <button
                        className="btn-secondary"
                        onClick={() => {
                          const call = runLocalGuiExecute(selectedAction.name, actions);
                          appendClientToolCall(call);
                        }}
                      >
                        <SquareTerminal size={16} />
                        Test Local
                      </button>
                      <button
                        className="btn-danger"
                        onClick={() => removeAction(actions, selectedAction.id, setActions, setSelectedActionId)}
                        disabled={actions.length <= 1}
                      >
                        <Trash2 size={16} />
                        Delete
                      </button>
                    </div>
                  </div>
                ) : (
                  <EmptyState text="Create an action to expose through GUI_execute." />
                )}
              </div>
            </Panel>

            <Panel title="Connection" description="Initialize ACP, then create or load sessions from the sidebar.">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="WebSocket URL">
                  <input value={wsUrl} onChange={(event) => setWsUrl(event.target.value)} className="input" />
                </Field>
                <Field label="Working Directory">
                  <input value={cwd} onChange={(event) => setCwd(event.target.value)} className="input" />
                </Field>
                <Field label="ACP Backend">
                  <select value={executorType} onChange={(event) => setExecutorType(event.target.value)} className="input">
                    {BACKEND_OPTIONS.map((backend) => (
                      <option key={backend.value} value={backend.value}>{backend.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Model">
                  <input value={model} onChange={(event) => setModel(event.target.value)} className="input" />
                </Field>
                <Field label="Permission Mode">
                  <select value={permissionMode} onChange={(event) => setPermissionMode(event.target.value)} className="input">
                    <option value="default">default</option>
                    <option value="acceptEdits">acceptEdits</option>
                    <option value="dontAsk">dontAsk</option>
                    <option value="plan">plan</option>
                    <option value="bypassPermissions">bypassPermissions</option>
                  </select>
                </Field>
                <Field label="Agent Config Path">
                  <input
                    value={agentConfigPath}
                    onChange={(event) => setAgentConfigPath(event.target.value)}
                    className="input"
                    placeholder="/root/viben/.viben/agents/example.md"
                  />
                </Field>
                <Field label="Session ID">
                  <input value={sessionId ?? ""} readOnly className="input text-muted-foreground" />
                </Field>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Field label="Request MCP Servers JSON">
                  <JsonEditorPanel
                    value={requestMcpServersText}
                    onChange={setRequestMcpServersText}
                    size="row"
                    mode="text"
                  />
                </Field>
                <Field label="Executor Config JSON">
                  <JsonEditorPanel
                    value={executorConfigText}
                    onChange={setExecutorConfigText}
                    size="row"
                    mode="text"
                  />
                </Field>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <label className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm">
                  <input
                    type="checkbox"
                    checked={useInlineAgentConfig}
                    onChange={(event) => setUseInlineAgentConfig(event.target.checked)}
                  />
                  Inline agent config + client_side
                </label>
                <button className="btn-secondary" onClick={() => setRequestMcpServersText(normalizeJsonText(requestMcpServersText))}>
                  <FileJson size={16} />
                  Format MCP
                </button>
                <button className="btn-secondary" onClick={() => setExecutorConfigText(normalizeJsonText(executorConfigText))}>
                  <FileJson size={16} />
                  Format Config
                </button>
                <button className="btn-secondary" onClick={createSession} disabled={!connected}>
                  <FolderPlus size={16} />
                  New Session
                </button>
                <button className="btn-secondary" onClick={loadSession} disabled={!connected || !loadSessionId.trim()}>
                  <RotateCcw size={16} />
                  Load Session
                </button>
                <button className="btn-secondary" onClick={listSessions} disabled={!connected}>
                  <ClipboardList size={16} />
                  List Sessions
                </button>
                <button className="btn-secondary" onClick={closeActiveSession} disabled={!connected || !sessionId}>
                  <X size={16} />
                  Close Active
                </button>
              </div>
              {error && <div className="mt-4 rounded-lg border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
            </Panel>

            <Panel title="Prompt Turn" description="Send session/prompt and watch session/update notifications stream back.">
              <ChatInput
                value={prompt}
                onValueChange={setPrompt}
                onSend={(content) => void sendPromptText(content)}
                onCancel={() => void interrupt()}
                isLoading={isTurnActive}
                sendDisabled={!connected || !sessionId}
                sendBlockedReason={!connected ? "Connect first to send prompts." : !sessionId ? "Create or load a session before sending." : undefined}
                placeholder="Send an ACP prompt, or type / for backend commands"
                slashCommands={slashCommands}
                onSlashCommand={handleSlashCommand}
                className="acp-prompt-input"
                showTopToolbar
                showResizeHandle
                defaultHeight={190}
                minHeight={150}
                maxHeight={420}
                heightStorageKey="viben_acp_prompt_input_height"
                enableWritingMode
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full bg-muted px-2 py-1">
                    {sessionId ? `session ${shortId(sessionId)}` : "no session"}
                  </span>
                  <span className="rounded-full bg-muted px-2 py-1">
                    {slashCommands.length} commands
                  </span>
                  {activeSession?.uiStepQueue.length ? (
                    <span className="rounded-full bg-warning/15 px-2 py-1 text-warning">
                      {activeSession.uiStepQueue.length} queued
                    </span>
                  ) : null}
                </div>
                <button className="btn-secondary" onClick={() => {
                  if (sessionId) {
                    updateSession(setSessionsById, sessionId, (session) => ({
                      ...session,
                      uiMessages: [],
                      streamingText: null,
                      messageUpdates: {},
                      uiSteps: [],
                      uiStepQueue: [],
                      pendingPlan: null,
                      pendingApproval: null,
                      pendingQuestion: null,
                      artifacts: [],
                      promptInFlight: false,
                    }));
                  }
                }} disabled={!sessionId}>
                  <Trash2 size={16} />
                  Clear
                </button>
              </div>
            </Panel>

            <Panel title="Steer Queue" description="Send and inspect Viben ACP session/prompt/* extension requests.">
              <CommandQueuePanel
                items={steerQueueItems}
                isPaused={steerQueuePaused}
                onRemove={removeSteerQueueItem}
                onClear={clearSteerQueue}
                onPause={() => setActiveSteerQueuePaused(true)}
                onResume={() => setActiveSteerQueuePaused(false)}
                compact
                className="mb-3 rounded-lg border border-border"
              />
              <ChatInput
                value={steerPromptText}
                onValueChange={setSteerPromptText}
                onSend={(content) => void handleSteerInputSend(content)}
                queuedInputRecallItems={steerQueueItems}
                onQueuedInputRecall={(items, value) => {
                  setSteerPromptText(value);
                  void recallSteerQueue(items, setSteerPromptText);
                }}
                sendDisabled={!connected || !sessionId}
                sendBlockedReason={!connected ? "Connect first to steer." : !sessionId ? "Create or load a session before steering." : undefined}
                placeholder="Queue a steering prompt. Press ArrowUp on empty input to recall queued prompts."
                className="acp-steer-input"
                showTopToolbar
              />
              <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                <input
                  value={steerPromptId}
                  onChange={(event) => setSteerPromptId(event.target.value)}
                  className="input font-mono text-xs"
                  placeholder="prompt id"
                />
                <div className="flex flex-wrap gap-2">
                  <button className="btn-primary" onClick={sendSteerPrompt} disabled={!connected || !sessionId || !steerPromptText.trim()}>
                    <Send size={16} />
                    Steer
                  </button>
                  <button className="btn-secondary" onClick={viewSteerPrompt} disabled={!connected || !sessionId}>
                    <Search size={16} />
                    View
                  </button>
                  <button className="btn-danger" onClick={cancelSteerPrompt} disabled={!connected || !sessionId || !steerPromptId.trim()}>
                    <X size={16} />
                    Cancel
                  </button>
                </div>
              </div>
            </Panel>

            <Panel title="Session Stream" description="Agent text, thoughts, tool calls, and client-side tool callbacks.">
              <div className="min-h-[520px] overflow-hidden rounded-lg border border-border bg-surface">
                <MessageList
                  messages={messages}
                  streamingText={streamingText}
                  messageUpdates={messageUpdates}
                  isStreaming={isTurnActive}
                  pendingPlan={pendingPlan}
                  pendingQuestions={pendingQuestion}
                  artifacts={artifacts}
                  onApprovePlan={handleApprovePlan}
                  onRejectPlan={handleRejectPlan}
                  onAnswerQuestions={handleQuestionAnswers}
                  onArtifactClick={handleArtifactClick}
                  onExpandSubagent={handleExpandSubagent}
                  toolExpandedInline
                  maxMessageWidth="100%"
                  welcomeTitle="ACP Session"
                  welcomeDescription="Create or load a session, then send a prompt."
                />
                {pendingApproval && (
                  <div className="border-t border-border p-4">
                    <ExecApproval approval={pendingApproval} onDecision={handleApprovalDecision} />
                  </div>
                )}
              </div>
            </Panel>
          </section>

          <section className="space-y-5">
            <Panel title="Client Tools" description="Requests initiated by Viben through _viben/client_tool_call.">
              <div className="mb-3 rounded-lg border border-border bg-muted/35 p-3 text-xs">
                <div className="mb-2 font-semibold">Available GUI actions</div>
                <JsonPanel
                  value={actionSummaries}
                  size="compact"
                  preClassName="json-panel-borderless"
                />
              </div>
              <div className="max-h-80 space-y-2 overflow-auto pr-1">
                {clientToolCalls.length === 0 ? (
                  <EmptyState text="No client-side tool calls yet." />
                ) : (
                  clientToolCalls.map((call) => <ClientToolRow key={call.id} call={call} />)
                )}
              </div>
            </Panel>

            <Panel title="Slash Commands" description="Commands advertised by the active ACP backend.">
              <div className="max-h-72 space-y-2 overflow-auto pr-1">
                {slashCommands.length === 0 ? (
                  <EmptyState text="No slash commands announced yet." />
                ) : (
                  slashCommands.map((command) => <SlashCommandRow key={command.name} command={command} />)
                )}
              </div>
            </Panel>

            <Panel title="Permission Requests" description="ACP session/request_permission calls auto-approved by this example client.">
              <div className="max-h-56 space-y-2 overflow-auto pr-1">
                {permissionRequests.length === 0 ? (
                  <EmptyState text="No permission requests yet." />
                ) : (
                  permissionRequests.map((request) => <PermissionRow key={request.id} request={request} />)
                )}
              </div>
            </Panel>

            <Panel title="Elicitations" description="ACP session/elicitation requests answered by this client.">
              <div className="max-h-56 space-y-2 overflow-auto pr-1">
                {elicitationRequests.length === 0 ? (
                  <EmptyState text="No elicitation requests yet." />
                ) : (
                  elicitationRequests.map((request) => <ElicitationRow key={request.id} request={request} />)
                )}
              </div>
            </Panel>

            <Panel title="ACP Results">
              <JsonBlock title="initialize" value={initializeResult} size="compact" lazyMount />
              <JsonBlock title="session/new" value={sessionResult} size="compact" lazyMount />
              <JsonBlock title="session/list" value={sessionListResult} size="compact" lazyMount />
              <JsonBlock title="session/prompt" value={promptResult} size="compact" lazyMount />
              <JsonBlock title="session/prompt/*" value={steerResult} size="compact" lazyMount />
            </Panel>

            <Panel title="Traffic Monitor" description="Connection-level JSON-RPC frames.">
              <div className="mb-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_120px_150px_auto]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
                  <input
                    value={trafficFilters.query}
                    onChange={(event) => setTrafficFilters((current) => ({ ...current, query: event.target.value }))}
                    className="input pl-9"
                    placeholder="method, id, session, payload"
                  />
                </div>
                <select
                  value={trafficFilters.direction}
                  onChange={(event) => setTrafficFilters((current) => ({ ...current, direction: event.target.value as TrafficFilters["direction"] }))}
                  className="input"
                >
                  <option value="all">all dirs</option>
                  <option value="in">in</option>
                  <option value="out">out</option>
                </select>
                <select
                  value={trafficFilters.type}
                  onChange={(event) => setTrafficFilters((current) => ({ ...current, type: event.target.value as TrafficFilters["type"] }))}
                  className="input"
                >
                  <option value="all">all frames</option>
                  <option value="request">request</option>
                  <option value="response">response</option>
                  <option value="notification">notification</option>
                  <option value="error">error</option>
                </select>
                <button className="btn-secondary" onClick={() => setTraffic([])}>
                  <Trash2 size={16} />
                  Clear
                </button>
              </div>
              <div className="max-h-[680px] space-y-2 overflow-auto pr-1">
                {traffic.length === 0 ? (
                  <EmptyState text="Connect to start recording frames." />
                ) : filteredTraffic.length === 0 ? (
                  <EmptyState text="No frames match the filters." />
                ) : (
                  filteredTraffic.map((entry) => <TrafficRow key={entry.id} entry={entry} />)
                )}
              </div>
            </Panel>
          </section>
        </div>
        )}
      </main>
      {toolDialog && (
        <ToolApprovalModal
          dialog={toolDialog}
          onChangeResponse={(value) => setToolDialog((current) => current ? { ...current, responseText: value } : current)}
          onSubmit={submitToolDialog}
          onReject={rejectToolDialog}
        />
      )}
      {permissionDialog && viewMode === "inspector" && (
        <PermissionApprovalModal
          dialog={permissionDialog}
          onSelect={(optionId) => setPermissionDialog((current) => current ? { ...current, selectedOptionId: optionId } : current)}
          onSubmit={submitPermissionDialog}
          onCancel={cancelPermissionDialog}
        />
      )}
      {elicitationDialog && viewMode === "inspector" && (
        <ElicitationApprovalModal
          dialog={elicitationDialog}
          onChangeAnswers={(value) => setElicitationDialog((current) => current ? { ...current, answersText: value } : current)}
          onSubmit={submitElicitationDialog}
          onDecline={declineElicitationDialog}
          onCancel={cancelElicitationDialog}
        />
      )}
      <SubagentSheet
        open={!!subagentSheet}
        onClose={() => setSubagentSheet(null)}
        title={subagentSheet?.title ?? ""}
        subagentType={subagentSheet?.subagentType}
        messages={subagentSheet?.messages ?? []}
        liveMessages={resolveLiveSubagentMessages(sessionsById, subagentSheet)}
        context={subagentSheet?.context}
        onExpandSubagent={handleExpandSubagent}
      />
      {artifactDialog && (
        <ArtifactModal
          dialog={artifactDialog}
          onClose={() => setArtifactDialog(null)}
        />
      )}
    </div>
  );
}

function SessionRow({ session, active, onSelect }: { session: UiSessionState | undefined; active: boolean; onSelect: () => void }) {
  if (!session) return null;
  return (
    <button className={active ? "session-row session-row-active" : "session-row"} onClick={onSelect}>
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold">{session.title}</div>
        <div className="truncate text-xs text-muted-foreground">{session.id}</div>
      </div>
      <div className="shrink-0 text-right text-xs text-muted-foreground">
        <div>{session.uiMessages.length}</div>
        <div>{session.uiStepQueue.length ? `${session.uiStepQueue.length} queued` : "steps"}</div>
      </div>
    </button>
  );
}

function AcpChatSurface({
  connected,
  sessionId,
  messages,
  streamingText,
  messageUpdates,
  pendingPlan,
  pendingApproval,
  pendingQuestion,
  slashCommands,
  tools,
  skills,
  contextBreakdown,
  executorType,
  model,
  artifacts,
  error,
  steerQueueItems,
  steerQueuePaused,
  isStreaming,
  prompt,
  onPromptChange,
  onSendPrompt,
  onCancelTurn,
  onSlashCommand,
  onExecutorTypeChange,
  onModelChange,
  onApprovePlan,
  onRejectPlan,
  onApprovalDecision,
  onQuestionAnswers,
  onSteerSend,
  onRecallSteerQueue,
  onExpandSubagent,
  onArtifactClick,
  onRemoveSteerQueueItem,
  onClearSteerQueue,
  onPauseSteerQueue,
  onResumeSteerQueue,
  onCreateSession,
  onConnect,
  onLoadSession,
  loadSessionId,
  onLoadSessionIdChange,
  busy,
}: {
  connected: boolean;
  sessionId: string | null;
  messages: AgentMessage[];
  streamingText?: string | null;
  messageUpdates: Record<string, Partial<AgentMessage>>;
  pendingPlan: TaskPlan | null;
  pendingApproval: PendingExecApproval | null;
  pendingQuestion: PendingQuestion | null;
  slashCommands: SlashCommand[];
  tools: ToolConfig[];
  skills: SkillConfig[];
  contextBreakdown: ContextTokenBreakdown;
  executorType: string;
  model: string;
  artifacts: Artifact[];
  error: string | null;
  steerQueueItems: CommandQueueItem[];
  steerQueuePaused: boolean;
  isStreaming: boolean;
  prompt: string;
  onPromptChange: (value: string) => void;
  onSendPrompt: (content: string) => void;
  onCancelTurn: () => void;
  onSlashCommand: (command: SlashCommand, selection: SlashCommandSelection) => void;
  onExecutorTypeChange: (executorType: string) => void;
  onModelChange: (model: string) => void;
  onApprovePlan: () => void;
  onRejectPlan: () => void;
  onApprovalDecision: (decision: string) => void;
  onQuestionAnswers: (answers: Record<string, string[]>) => void;
  onSteerSend: (content: string) => void;
  onRecallSteerQueue: (items: QueuedInputRecallItem[], value: string) => void;
  onExpandSubagent: ExpandSubagentHandler;
  onArtifactClick: (artifactId: string) => void;
  onRemoveSteerQueueItem: (id: string) => void;
  onClearSteerQueue: () => void;
  onPauseSteerQueue: () => void;
  onResumeSteerQueue: () => void;
  onCreateSession: () => void;
  onConnect: () => void;
  onLoadSession: () => void;
  loadSessionId: string;
  onLoadSessionIdChange: (value: string) => void;
  busy: boolean;
}) {
  const modelOptions = useMemo<ModelOption[]>(() => buildModelOptions(model), [model]);
  const executorOptions = useMemo<ExecutorOption[]>(() => BACKEND_OPTIONS.map((backend) => ({
    id: backend.value,
    name: backend.label,
  })), []);

  const handleSend = useCallback((content: string) => {
    if (isStreaming) {
      onSteerSend(content);
      return;
    }
    onSendPrompt(content);
  }, [isStreaming, onSendPrompt, onSteerSend]);

  const handleSlashCommand = useCallback((command: SlashCommand, selection: SlashCommandSelection) => {
    if (isStreaming) {
      const args = selection.args.trim();
      onSteerSend(`/${command.name}${args ? ` ${args}` : ""}`);
      return;
    }
    onSlashCommand(command, selection);
  }, [isStreaming, onSlashCommand, onSteerSend]);

  return (
    <div className="flex h-[calc(100vh-81px)] min-h-0 flex-col bg-background">
      <div className="flex min-h-0 flex-1 flex-col">
        <MessageList
          messages={messages}
          streamingText={streamingText}
          messageUpdates={messageUpdates}
          isStreaming={isStreaming}
          pendingPlan={pendingPlan}
          artifacts={artifacts}
          onExpandSubagent={onExpandSubagent}
          onArtifactClick={onArtifactClick}
          maxMessageWidth="780px"
          toolExpandedInline
          welcomeTitle="ACP Chat"
          welcomeDescription="Connect, create a session, then talk to an ACP backend."
        />
      </div>

      <div className="border-t border-border bg-background px-4 py-3">
        <div className="mx-auto max-w-[780px] space-y-3">
          {error && (
            <div className="rounded-lg border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          {steerQueueItems.length > 0 && (
            <CommandQueuePanel
              items={steerQueueItems}
              isPaused={steerQueuePaused}
              onRemove={onRemoveSteerQueueItem}
              onClear={onClearSteerQueue}
              onPause={onPauseSteerQueue}
              onResume={onResumeSteerQueue}
              compact
              className="rounded-lg border border-border"
            />
          )}

          <AnimatePresence mode="wait">
            {pendingPlan ? (
              <PlanApproval
                key="plan"
                plan={pendingPlan}
                isPending
                onApprove={onApprovePlan}
                onReject={onRejectPlan}
              />
            ) : pendingApproval ? (
              <ExecApproval
                key="approval"
                approval={pendingApproval}
                onDecision={onApprovalDecision}
                enableKeyboard
              />
            ) : pendingQuestion ? (
              <QuestionInput
                key="question"
                questions={pendingQuestion}
                onSubmit={onQuestionAnswers}
              />
            ) : (
              <motion.div
                key="input"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
              >
                <ChatInput
                  value={prompt}
                  onValueChange={onPromptChange}
                  onSend={handleSend}
                  onCancel={onCancelTurn}
                  queuedInputRecallItems={steerQueueItems}
                  onQueuedInputRecall={onRecallSteerQueue}
                  isLoading={isStreaming}
                  allowSendWhileLoading
                  sendDisabled={!connected || !sessionId}
                  sendBlockedReason={!connected ? "Connect first to send prompts." : !sessionId ? "Create or load a session before sending." : undefined}
                  placeholder={isStreaming ? "Type steering while the agent is running..." : "Type a message..."}
                  slashCommands={slashCommands}
                  onSlashCommand={handleSlashCommand}
                  showTopToolbar
                  showConfigBar
                  hideAgentSelector
                  models={modelOptions}
                  selectedModelId={model}
                  onModelChange={onModelChange}
                  executors={executorOptions}
                  selectedExecutor={executorType}
                  onExecutorChange={onExecutorTypeChange}
                  tools={tools}
                  onToggleTool={() => undefined}
                  skills={skills}
                  onToggleSkill={() => undefined}
                  contextTokens={estimateContextTokens(contextBreakdown)}
                  contextBreakdown={contextBreakdown}
                  configBarLeftExtra={(
                    <span className="hidden rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground sm:inline-flex">
                      {slashCommands.length} commands
                    </span>
                  )}
                  showResizeHandle
                  defaultHeight={120}
                  minHeight={88}
                  maxHeight={320}
                  heightStorageKey="viben_acp_chat_input_height"
                  enableWritingMode
                />
              </motion.div>
            )}
          </AnimatePresence>
          {!pendingPlan && !pendingApproval && !pendingQuestion && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-muted px-2 py-1">
                    {sessionId ? `session ${shortId(sessionId)}` : "no session"}
                  </span>
                  <span className="rounded-full bg-muted px-2 py-1">{slashCommands.length} slash commands</span>
                  {isStreaming && (
                    <span className="rounded-full bg-info/15 px-2 py-1 text-info">
                      streaming: input sends steering
                    </span>
                  )}
                  {steerQueueItems.length > 0 && (
                    <span className="rounded-full bg-warning/15 px-2 py-1 text-warning">
                      ArrowUp recalls {steerQueueItems.length} queued steer prompt{steerQueueItems.length === 1 ? "" : "s"}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  {!connected && (
                    <button className="btn-secondary" onClick={onConnect} disabled={busy}>
                      {busy ? <Loader2 className="animate-spin" size={16} /> : <Plug size={16} />}
                      Connect
                    </button>
                  )}
                  {connected && !sessionId && (
                    <>
                      <button className="btn-primary" onClick={onCreateSession}>
                        <FolderPlus size={16} />
                        New Session
                      </button>
                      <input
                        value={loadSessionId}
                        onChange={(event) => onLoadSessionIdChange(event.target.value)}
                        className="input h-9 w-44 font-mono text-xs"
                        placeholder="session id"
                      />
                      <button className="btn-secondary" onClick={onLoadSession} disabled={!loadSessionId.trim()}>
                        <RotateCcw size={16} />
                        Resume
                      </button>
                    </>
                  )}
                  <button
                    className="btn-secondary"
                    onClick={() => onRecallSteerQueue(
                      steerQueueItems,
                      steerQueueItems.map((item) => item.content.trim()).filter(Boolean).join("\n\n")
                    )}
                    disabled={steerQueueItems.length === 0 || !sessionId}
                  >
                    <RotateCcw size={16} />
                    Recall Queue
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ToolApprovalModal({
  dialog,
  onChangeResponse,
  onSubmit,
  onReject,
}: {
  dialog: ToolApprovalDialogState;
  onChangeResponse: (value: string) => void;
  onSubmit: () => void;
  onReject: () => void;
}) {
  return (
    <ModalFrame title="Client Tool Call" subtitle={`${dialog.request.toolName} / ${dialog.request.toolCallId}`}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="json-modal-section">
          <div className="json-modal-header">Input</div>
          <JsonPanel value={dialog.request.input} />
        </div>
        <div className="json-modal-section">
          <div className="json-modal-header">Response JSON</div>
          <JsonEditorPanel
            value={dialog.responseText}
            onChange={onChangeResponse}
            size="default"
            mode="text"
          />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button className="btn-secondary" onClick={() => onChangeResponse(normalizeJsonText(dialog.responseText))}>
          <FileJson size={16} />
          Format
        </button>
        <button className="btn-danger" onClick={onReject}>
          <X size={16} />
          Reject
        </button>
        <button className="btn-primary" onClick={onSubmit}>
          <Send size={16} />
          Send Result
        </button>
      </div>
    </ModalFrame>
  );
}

function ArtifactModal({
  dialog,
  onClose,
}: {
  dialog: ArtifactDialogState;
  onClose: () => void;
}) {
  return (
    <ModalFrame title="Artifact" subtitle={dialog.artifact.name}>
      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div className="rounded-lg border border-border bg-muted/35 p-3 text-sm">
          <div className="mb-2 font-semibold">Details</div>
          <dl className="space-y-2 text-xs">
            <div>
              <dt className="text-muted-foreground">ID</dt>
              <dd className="break-all font-mono">{dialog.artifact.id}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Type</dt>
              <dd>{dialog.artifact.type}</dd>
            </div>
            {dialog.artifact.toolName && (
              <div>
                <dt className="text-muted-foreground">Tool</dt>
                <dd>{dialog.artifact.toolName}</dd>
              </div>
            )}
            {dialog.artifact.sourceMessageId && (
              <div>
                <dt className="text-muted-foreground">Source</dt>
                <dd className="break-all font-mono">{dialog.artifact.sourceMessageId}</dd>
              </div>
            )}
          </dl>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Source Message</div>
            <button className="btn-secondary" onClick={onClose}>
              <X size={16} />
              Close
            </button>
          </div>
          <JsonPanel
            value={dialog.message ?? dialog.artifact}
            preClassName="text-xs"
          />
        </div>
      </div>
    </ModalFrame>
  );
}

function PermissionApprovalModal({
  dialog,
  onSelect,
  onSubmit,
  onCancel,
}: {
  dialog: PermissionDialogState;
  onSelect: (optionId: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const requestJson = permissionRequestToJson(dialog.request, dialog.selectedOptionId);
  const selectedOption = findPermissionOption(dialog.request.options, dialog.selectedOptionId);
  const decisionJson = permissionDecisionPreview(dialog.selectedOptionId);
  return (
    <ModalFrame title="Permission Request" subtitle={dialog.request.title}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="json-modal-section">
          <div className="json-modal-header">Full Request JSON</div>
          <JsonPanel value={requestJson} size="permission" />
        </div>
        <div className="permission-side">
          <div className="json-modal-header">Options</div>
          <div className="max-h-48 space-y-2 overflow-auto pr-1">
            {dialog.request.options.length === 0 ? (
              <EmptyState text="No options provided." compact />
            ) : (
              dialog.request.options.map((option, index) => {
                const optionId = permissionOptionId(option, index);
                return (
                  <label key={optionId} className="permission-option">
                    <input
                      type="radio"
                      name="permission-option"
                      checked={dialog.selectedOptionId === optionId}
                      onChange={() => onSelect(optionId)}
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{option.name ?? option.optionId ?? option.kind ?? optionId}</span>
                      <span className="block truncate text-muted-foreground">{option.kind ?? optionId}</span>
                    </span>
                  </label>
                );
              })
            )}
          </div>
          <div className="mt-4">
            <div className="json-modal-header">Selected Option</div>
            <JsonPanel
              value={selectedOption ?? null}
              size="inline"
              preClassName="rounded-md"
              lazyMount
            />
          </div>
          <div className="mt-4">
            <div className="json-modal-header">Response Decision</div>
            <JsonPanel
              value={decisionJson}
              size="compact"
              preClassName="rounded-md"
              lazyMount
            />
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button className="btn-danger" onClick={onCancel}>
          <X size={16} />
          Cancel
        </button>
        <button className="btn-primary" onClick={onSubmit} disabled={!dialog.selectedOptionId}>
          <Send size={16} />
          Send Decision
        </button>
      </div>
    </ModalFrame>
  );
}

function permissionRequestToJson(request: PermissionDecisionRequest, selectedOptionId: string): Record<string, unknown> {
  return {
    rawRequest: request.rawRequest,
    params: request.rawParams,
    toolCall: request.toolCall,
    input: request.rawInput,
    options: request.options,
    selectedOption: findPermissionOption(request.options, selectedOptionId),
    decision: permissionDecisionPreview(selectedOptionId),
  };
}

function ElicitationApprovalModal({
  dialog,
  onChangeAnswers,
  onSubmit,
  onDecline,
  onCancel,
}: {
  dialog: ElicitationDialogState;
  onChangeAnswers: (value: string) => void;
  onSubmit: () => void;
  onDecline: () => void;
  onCancel: () => void;
}) {
  return (
    <ModalFrame title="Elicitation" subtitle={dialog.request.message}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <QuestionInput questions={dialog.pendingQuestion} onSubmit={(answers) => onChangeAnswers(prettyJson(answersToElicitationContent(answers, dialog.formFields)))} />
          {dialog.request.url && (
            <button className="btn-secondary" onClick={() => window.open(dialog.request.url, "_blank")}>
              Open URL
            </button>
          )}
        </div>
        <div>
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Response Content JSON</div>
          <JsonEditorPanel
            value={dialog.answersText}
            onChange={onChangeAnswers}
            size="default"
            mode="text"
          />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button className="btn-secondary" onClick={() => onChangeAnswers(normalizeJsonText(dialog.answersText))}>
          <FileJson size={16} />
          Format
        </button>
        <button className="btn-danger" onClick={onCancel}>
          <X size={16} />
          Cancel
        </button>
        <button className="btn-secondary" onClick={onDecline}>
          Decline
        </button>
        <button className="btn-primary" onClick={onSubmit}>
          <Send size={16} />
          Send Response
        </button>
      </div>
    </ModalFrame>
  );
}

function ModalFrame({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="modal-backdrop">
      <div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="acp-modal-title">
        <div className="mb-4 border-b border-border pb-3">
          <h2 id="acp-modal-title" className="text-base font-semibold">{title}</h2>
          {subtitle && <p className="mt-1 break-words text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}

function Panel({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function StatusPill({ status, compact = false }: { status: ConnectionStatus; compact?: boolean }) {
  const color = status === "connected" ? "bg-success" : status === "connecting" ? "bg-warning" : status === "error" ? "bg-destructive" : "bg-muted-foreground";
  return (
    <div className={compact ? "flex items-center gap-2 text-xs" : "flex items-center gap-2 text-sm"}>
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      <span className="font-medium capitalize">{status}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-muted px-2 py-2">
      <div className="font-semibold">{value}</div>
      <div className="text-muted-foreground">{label}</div>
    </div>
  );
}

function ClientToolRow({ call }: { call: ClientToolCall }) {
  return (
    <LazyJsonDetails
      className="rounded-lg border border-info/35 bg-info/10 p-3 text-xs"
      summary={(
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate font-semibold">{call.toolName}</div>
            <div className="truncate text-muted-foreground">{call.action ?? call.toolCallId}</div>
          </div>
          <span className="shrink-0 text-muted-foreground">{new Date(call.at).toLocaleTimeString()}</span>
        </div>
      )}
      value={{ input: call.input, result: call.result }}
      size="row"
    />
  );
}

function SlashCommandRow({ command }: { command: SlashCommand }) {
  return (
    <LazyJsonDetails
      className="rounded-lg border border-border bg-surface p-3 text-xs"
      summary={(
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate font-semibold">/{command.name}</div>
            <div className="truncate text-muted-foreground">{command.description || "No description"}</div>
          </div>
          <span className="shrink-0 rounded-full bg-muted px-2 py-1 font-semibold text-muted-foreground">
            {command.input ? "input" : "plain"}
          </span>
        </div>
      )}
      value={command}
      size="row"
    />
  );
}

function PermissionRow({ request }: { request: PermissionRequestLog }) {
  return (
    <LazyJsonDetails
      className="rounded-lg border border-warning/35 bg-warning/10 p-3 text-xs"
      summary={(
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate font-semibold">{request.title}</div>
            <div className="truncate text-muted-foreground">{request.toolCallId}</div>
          </div>
          <span className="shrink-0 rounded-full bg-card px-2 py-1 font-semibold text-foreground">
            {request.selectedOptionId}
          </span>
        </div>
      )}
      value={{
        rawRequest: request.rawRequest,
        params: request.rawParams,
        toolCall: request.toolCall,
        input: request.rawInput,
        options: request.options,
        decision: request.decision,
      }}
      size="row"
    />
  );
}

function ElicitationRow({ request }: { request: ElicitationRequestLog }) {
  return (
    <LazyJsonDetails
      className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-xs"
      summary={(
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate font-semibold">{request.message}</div>
            <div className="truncate text-muted-foreground">{new Date(request.at).toLocaleTimeString()}</div>
          </div>
          <span className="shrink-0 rounded-full bg-card px-2 py-1 font-semibold text-foreground">
            answered
          </span>
        </div>
      )}
      value={{ rawInput: request.rawInput, action: request.action }}
      size="row"
    />
  );
}

function LazyJsonDetails({
  className,
  summary,
  value,
  size = "row",
}: {
  className: string;
  summary: React.ReactNode;
  value: unknown;
  size?: "compact" | "inline" | "row" | "default" | "permission";
}) {
  const [open, setOpen] = useState(false);
  return (
    <details
      className={className}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="cursor-pointer list-none">
        {summary}
      </summary>
      {open && <JsonPanel value={value} size={size} preClassName="mt-3 rounded-md text-code-foreground" lazyMount />}
    </details>
  );
}

function promptResultToSummaryMessages(result: unknown): AgentMessage[] {
  const summary = promptResultToSummary(result);
  if (!summary) return [];
  return [{
    id: `prompt-summary-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type: "summary",
    summary,
    timestamp: Date.now(),
  }];
}

function promptResultToSummary(result: unknown): Record<string, unknown> | null {
  if (!isRecord(result)) return null;
  const summary: Record<string, unknown> = {};
  const stopReason = readStringField(result.stopReason);
  if (stopReason) summary.stop_reason = stopReason;
  if (isRecord(result.usage)) {
    const usage = result.usage;
    const inputTokens = readNumberField(usage.inputTokens) ?? readNumberField(usage.input_tokens);
    const outputTokens = readNumberField(usage.outputTokens) ?? readNumberField(usage.output_tokens);
    const totalTokens = readNumberField(usage.totalTokens) ?? readNumberField(usage.total_tokens);
    if (inputTokens !== undefined) summary.input_tokens = inputTokens;
    if (outputTokens !== undefined) summary.output_tokens = outputTokens;
    if (totalTokens !== undefined) summary.total_tokens = totalTokens;
  }
  if (isRecord(result.cost)) summary.cost = result.cost;
  return Object.keys(summary).length > 0 ? summary : null;
}

function TrafficRow({ entry }: { entry: TrafficEntry }) {
  return (
    <LazyJsonDetails
      className={entry.error ? "rounded-lg border border-destructive/35 bg-destructive/10 p-3 text-xs" : "rounded-lg border border-border bg-surface p-3 text-xs"}
      summary={(
        <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div className="flex min-w-0 items-center gap-2">
            <span className={entry.direction === "in" ? "badge-in" : "badge-out"}>{entry.direction}</span>
            <span className="traffic-type">{entry.type}</span>
            <span className="truncate font-medium">{entry.method ?? entry.type}</span>
            {entry.error && <span className="action-fail">error</span>}
          </div>
          <div className="flex items-center gap-2 text-muted-foreground md:justify-end">
            {entry.durationMs !== undefined && <span>{entry.durationMs}ms</span>}
            <span>{formatPayloadSize(entry.payloadSize)}</span>
            <span>{new Date(entry.at).toLocaleTimeString()}</span>
          </div>
          <div className="truncate text-muted-foreground md:col-span-2">
            {entry.summary}
            {entry.sessionId && <span className="ml-2">session {shortId(entry.sessionId)}</span>}
            {entry.requestId !== undefined && <span className="ml-2">id {String(entry.requestId)}</span>}
          </div>
        </div>
      )}
      value={entry.payload}
      size="row"
    />
  );
}

function EmptyState({ text, compact = false }: { text: string; compact?: boolean }) {
  return (
    <div className={`rounded-lg border border-dashed border-border bg-muted/30 px-4 text-center text-sm text-muted-foreground ${compact ? "py-4" : "py-8"}`}>
      {text}
    </div>
  );
}

function summarizeTraffic(entries: TrafficEntry[]) {
  return entries.reduce(
    (stats, entry) => {
      if (entry.direction === "in") stats.inbound += 1;
      if (entry.direction === "out") stats.outbound += 1;
      if (entry.method === "_viben/client_tool_call") stats.clientTools += 1;
      if (entry.error) stats.errors += 1;
      if (entry.type === "request") stats.requests += 1;
      if (entry.type === "response") stats.responses += 1;
      return stats;
    },
    { inbound: 0, outbound: 0, clientTools: 0, errors: 0, requests: 0, responses: 0 }
  );
}

function filterTraffic(entries: TrafficEntry[], filters: TrafficFilters): TrafficEntry[] {
  const query = filters.query.trim().toLowerCase();
  return entries.filter((entry) => {
    if (filters.direction !== "all" && entry.direction !== filters.direction) return false;
    if (filters.type === "error" && !entry.error) return false;
    if (filters.type !== "all" && filters.type !== "error" && entry.type !== filters.type) return false;
    if (!query) return true;
    const haystack = [
      entry.method,
      entry.type,
      entry.summary,
      entry.sessionId,
      entry.requestId === undefined ? undefined : String(entry.requestId),
      JSON.stringify(entry.payload),
    ].filter(Boolean).join(" ").toLowerCase();
    return haystack.includes(query);
  });
}

function formatPayloadSize(size: number): string {
  if (size < 1024) return `${size}b`;
  return `${(size / 1024).toFixed(1)}kb`;
}

function shortId(id: string): string {
  return id.length <= 8 ? id : id.slice(0, 8);
}

function isGuiExecuteTool(toolName: string): boolean {
  return toolName === "GUI_execute"
    || toolName === "mcp__client_side__GUI_execute";
}

function executeGuiAction(request: ClientToolExecutionRequest, actions: GuiActionDefinition[]): CallToolResult {
  const input = isRecord(request.input) ? request.input : {};
  const actionName = typeof input.action === "string" ? input.action : "";
  const payload = isRecord(input.payload) ? input.payload : {};
  const listActions = [builtinListActionsDetail(), ...buildActionSummaries(actions)];

  if (!actionName) {
    return {
      content: [{ type: "text", text: "GUI_execute error: input.action is required." }],
      isError: true,
    };
  }

  if (actionName === "list_actions") {
    return textResult(prettyJson(listActions), {
      actions: listActions,
    });
  }

  if (actionName === "get_action_detail") {
    const requested = typeof payload.action === "string" ? payload.action : typeof payload.name === "string" ? payload.name : "";
    if (requested === "list_actions") {
      return textResult(prettyJson(builtinListActionsDetail()), { action: builtinListActionsDetail() });
    }
    const action = actions.find((item) => item.name === requested);
    if (!action) {
      return {
        content: [{ type: "text", text: `Action not found: ${requested || "(missing payload.action)"}` }],
        isError: true,
      };
    }
    const detail = actionToDetail(action);
    return textResult(prettyJson(detail), { action: detail });
  }

  const action = actions.find((item) => item.name === actionName);
  if (!action) {
    return {
      content: [{ type: "text", text: `Unknown GUI action: ${actionName}. Use list_actions first.` }],
      isError: true,
      _meta: { availableActions: actions.map((item) => item.name) },
    };
  }

  const detail = actionToDetail(action);
  return {
    content: [
      {
        type: "text",
        text: action.responseText || `Executed ${action.name}.`,
      },
    ],
    isError: action.fail || undefined,
    _meta: {
      action: detail,
      payload,
      sessionId: request.sessionId,
      toolCallId: request.toolCallId,
    },
  };
}

function builtinListActionsDetail() {
  return {
    name: "list_actions",
    description: "List GUI actions exposed by this ACP client.",
    input_schema: {
      type: "object",
      properties: {},
    },
  };
}

function runLocalGuiExecute(actionName: string, actions: GuiActionDefinition[]): ClientToolCall {
  const request: ClientToolExecutionRequest = {
    sessionId: "local-preview-session",
    toolCallId: `local-preview-${globalThis.crypto.randomUUID()}`,
    toolName: "GUI_execute",
    input: {
      action: actionName,
      payload: {},
    },
  };
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    at: new Date().toISOString(),
    sessionId: request.sessionId,
    toolName: request.toolName,
    toolCallId: request.toolCallId,
    action: actionName,
    input: request.input,
    result: executeGuiAction(request, actions),
  };
}

function textResult(text: string, meta: Record<string, unknown>): CallToolResult {
  return {
    content: [{ type: "text", text }],
    _meta: meta,
  };
}

function textErrorResult(text: string): CallToolResult {
  return {
    content: [{ type: "text", text }],
    isError: true,
  };
}

function buildActionSummaries(actions: GuiActionDefinition[]) {
  return actions.map((action) => ({
    name: action.name,
    description: action.description,
    input_schema: parseJsonOrFallback(action.inputSchemaText, { type: "object", properties: {} }),
  }));
}

function buildChatToolConfigs(actions: GuiActionDefinition[]): ToolConfig[] {
  return [
    {
      id: "GUI_execute",
      name: "GUI_execute",
      description: "Execute or inspect GUI actions exposed by this ACP client.",
      enabled: true,
    },
    ...actions.map((action) => ({
      id: action.id,
      name: action.name,
      description: action.description,
      enabled: !action.fail,
    })),
  ];
}

function buildChatSkillConfigs(commands: SlashCommand[]): SkillConfig[] {
  return commands.map((command) => ({
    id: command.name,
    name: `/${command.name}`,
    description: command.description,
    enabled: true,
  }));
}

function buildChatContextBreakdown(
  messages: AgentMessage[],
  streamingText: string | null,
  commands: SlashCommand[],
  actions: Array<Record<string, unknown>>,
  steerQueue: CommandQueueItem[]
): ContextTokenBreakdown {
  const conversationMessages = estimateJsonTokens(messages) + estimateTextTokens(streamingText ?? "");
  const skillSettings = estimateJsonTokens(commands);
  const assistantProfile = estimateJsonTokens(actions);
  const historySummary = estimateJsonTokens(steerQueue);
  return {
    assistantProfile,
    skillSettings,
    historySummary,
    conversationMessages,
    totalContext: Math.max(8_000, assistantProfile + skillSettings + historySummary + conversationMessages + 4_000),
  };
}

function estimateContextTokens(breakdown: ContextTokenBreakdown): number {
  return breakdown.assistantProfile +
    breakdown.skillSettings +
    breakdown.historySummary +
    breakdown.conversationMessages;
}

function estimateJsonTokens(value: unknown): number {
  return estimateTextTokens(prettyJson(value));
}

function estimateTextTokens(value: string): number {
  return Math.max(0, Math.ceil(value.length / 4));
}

function buildModelOptions(currentModel: string): ModelOption[] {
  const models = [
    currentModel,
    DEFAULT_MODEL,
    "claude-opus-4-5",
    "claude-haiku-4-5",
  ].filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  return Array.from(new Set(models)).map((id) => ({
    id,
    name: id,
    provider: id.includes("claude") ? "Anthropic" : undefined,
  }));
}

function requestMcpServersToRequest(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function requestMcpServersToAgentConfig(value: unknown): unknown[] {
  return requestMcpServersToRequest(value).map((entry) => {
    if (isRecord(entry) && typeof entry.name === "string") {
      return entry.name;
    }
    return entry;
  });
}

function selectInitialPermissionOption(options: PermissionOption[]): PermissionOption | undefined {
  return options.find((option) => option.kind === "allow_once")
    ?? options.find((option) => option.kind === "allow_always")
    ?? options.find((option) => String(option.optionId ?? option.name ?? "").toLowerCase().includes("allow"))
    ?? options[0];
}

function permissionOptionId(option: PermissionOption, index: number): string {
  return option.optionId ?? option.name ?? option.kind ?? `option-${index}`;
}

function findPermissionOption(options: PermissionOption[], optionId: string): PermissionOption | null {
  return options.find((option, index) => permissionOptionId(option, index) === optionId) ?? null;
}

function permissionDecisionPreview(optionId: string): Record<string, unknown> {
  return {
    outcome: optionId
      ? { outcome: "selected", optionId }
      : { outcome: "cancelled" },
  };
}

function isCallToolResult(value: unknown): value is CallToolResult {
  return isRecord(value) && Array.isArray(value.content);
}

function resolvePermissionDecisionOption(options: PermissionOption[], decision: string): string {
  if (decision === "reject") {
    const rejectOption = options.find((option) => option.kind === "reject_once")
      ?? options.find((option) => option.kind === "reject_always")
      ?? options.find((option) => String(option.optionId ?? option.name ?? "").toLowerCase().includes("reject"));
    if (!rejectOption) return "reject_once";
    return permissionOptionId(rejectOption, 0);
  }
  if (decision === "allow_always") {
    const alwaysOption = options.find((option) => option.kind === "allow_always");
    if (!alwaysOption) return "allow_always";
    return permissionOptionId(alwaysOption, 0);
  }
  const allowOnce = options.find((option) => option.kind === "allow_once")
    ?? options.find((option) => String(option.optionId ?? option.name ?? "").toLowerCase().includes("allow"))
    ?? options[0];
  if (!allowOnce) return "allow_once";
  return permissionOptionId(allowOnce, 0);
}

function buildDefaultElicitationContent(fields: ElicitationFormField[]): Record<string, ElicitationContentValue> {
  const content: Record<string, ElicitationContentValue> = {};
  for (const field of fields) {
    const value = field.schema.default;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || isStringArray(value)) {
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

function answersToElicitationContent(
  answers: Record<string, string[]>,
  fields: ElicitationFormField[]
): Record<string, ElicitationContentValue> {
  if (fields.length === 0) {
    return {
      answer: Object.values(answers).flat().join("\n"),
    };
  }
  const content: Record<string, ElicitationContentValue> = {};
  fields.forEach((field, index) => {
    const values = answers[String(index)] ?? [];
    content[field.key] = coerceElicitationValue(field.schema, values);
  });
  return content;
}

function normalizeElicitationContent(value: unknown, fields: ElicitationFormField[]): Record<string, ElicitationContentValue> {
  if (!isRecord(value)) return buildDefaultElicitationContent(fields);
  const content: Record<string, ElicitationContentValue> = {};
  if (fields.length === 0) {
    for (const [key, item] of Object.entries(value)) {
      if (isElicitationContentValue(item)) content[key] = item;
    }
    return content;
  }
  for (const field of fields) {
    content[field.key] = coerceElicitationUnknownValue(field.schema, value[field.key]);
  }
  return content;
}

function coerceElicitationValue(schema: ElicitationPropertySchema, values: string[]): ElicitationContentValue {
  if (schema.type === "array") return values;
  const value = values[0] ?? "";
  if (schema.type === "boolean") return value === "true";
  if (schema.type === "number" || schema.type === "integer") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return value;
}

function coerceElicitationUnknownValue(schema: ElicitationPropertySchema, value: unknown): ElicitationContentValue {
  if (schema.type === "array") return isStringArray(value) ? value : [];
  if (schema.type === "boolean") return typeof value === "boolean" ? value : value === "true";
  if (schema.type === "number" || schema.type === "integer") {
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return typeof value === "string" ? value : String(value ?? "");
}

function isElicitationContentValue(value: unknown): value is ElicitationContentValue {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean" || isStringArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function actionToDetail(action: GuiActionDefinition) {
  return {
    name: action.name,
    description: action.description,
    input_schema: parseJsonOrFallback(action.inputSchemaText, { type: "object", properties: {} }),
    output_schema: {
      type: "object",
      properties: {
        content: { type: "array" },
        isError: { type: "boolean" },
        _meta: { type: "object" },
      },
    },
  };
}

function updateAction(
  setActions: React.Dispatch<React.SetStateAction<GuiActionDefinition[]>>,
  id: string,
  patch: Partial<GuiActionDefinition>
): void {
  setActions((current) => current.map((action) => (action.id === id ? { ...action, ...patch } : action)));
}

function removeAction(
  actions: GuiActionDefinition[],
  id: string,
  setActions: React.Dispatch<React.SetStateAction<GuiActionDefinition[]>>,
  setSelectedActionId: React.Dispatch<React.SetStateAction<string>>
): void {
  const next = actions.filter((action) => action.id !== id);
  if (next.length === 0) return;
  setActions(next);
  setSelectedActionId(next[0].id);
}

function createBlankAction(): GuiActionDefinition {
  const suffix = Math.random().toString(16).slice(2, 6);
  return {
    id: `action-${Date.now()}-${suffix}`,
    name: `custom.action_${suffix}`,
    description: "Custom GUI action exposed by the example ACP client.",
    inputSchemaText: prettyJson({ type: "object", properties: {} }),
    responseText: "Custom action executed.",
    fail: false,
  };
}

function buildGuiExecutePrompt(actionName: string): string {
  return [
    "Call the GUI_execute client tool with:",
    prettyJson({
      action: actionName,
      payload: {},
    }),
  ].join("\n");
}

function readStringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function readStringField(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function readNumberField(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function hasRecallItemId(item: QueuedInputRecallItem): item is QueuedInputRecallItem & { id: string } {
  return typeof item.id === "string" && item.id.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readSessionId(value: unknown): string | null {
  if (typeof value === "object" && value !== null && typeof (value as { sessionId?: unknown }).sessionId === "string") {
    return (value as { sessionId: string }).sessionId;
  }
  return null;
}

function copyText(text: string): void {
  if (!text) return;
  void navigator.clipboard?.writeText(text);
}
