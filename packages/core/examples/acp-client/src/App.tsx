import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Bot,
  CircleStop,
  Copy,
  FileJson,
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
} from "lucide-react";
import {
  AcpWebSocketClient,
  type AgentConfigPayload,
  type AcpSessionUpdate,
  type CallToolResult,
  type ClientToolCall,
  type ClientToolExecutionRequest,
  type ConnectionStatus,
  type PermissionRequestLog,
  type TrafficEntry,
} from "./acp-client";

interface ChatMessage {
  id: string;
  role: "agent" | "thought" | "tool" | "system" | "error";
  text: string;
  status?: string;
  toolCallId?: string;
}

interface GuiActionDefinition {
  id: string;
  name: string;
  description: string;
  inputSchemaText: string;
  responseText: string;
  fail: boolean;
}

interface UiSessionState {
  id: string;
  title: string;
  cwd: string;
  createdAt: string;
  lastActiveAt: string;
  sessionResult: unknown;
  promptResult: unknown;
  messages: ChatMessage[];
  clientToolCalls: ClientToolCall[];
  permissionRequests: PermissionRequestLog[];
}

interface TrafficFilters {
  query: string;
  direction: "all" | "in" | "out";
  type: "all" | TrafficEntry["type"] | "error";
}

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
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [permissionMode, setPermissionMode] = useState("default");
  const [useInlineAgentConfig, setUseInlineAgentConfig] = useState(true);
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
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
  const [error, setError] = useState<string | null>(null);
  const clientRef = useRef<AcpWebSocketClient | null>(null);
  const actionsRef = useRef(actions);

  const busy = status === "connecting";
  const connected = status === "connected";
  const stats = useMemo(() => summarizeTraffic(traffic), [traffic]);
  const filteredTraffic = useMemo(() => filterTraffic(traffic, trafficFilters), [traffic, trafficFilters]);
  const activeSession = activeSessionId ? sessionsById[activeSessionId] : null;
  const sessionId = activeSession?.id ?? null;
  const messages = activeSession?.messages ?? [];
  const clientToolCalls = activeSession?.clientToolCalls ?? [];
  const permissionRequests = activeSession?.permissionRequests ?? [];
  const sessionResult = activeSession?.sessionResult ?? null;
  const promptResult = activeSession?.promptResult ?? null;
  const selectedAction = actions.find((action) => action.id === selectedActionId) ?? actions[0] ?? null;
  const actionSummaries = useMemo(() => buildActionSummaries(actions), [actions]);

  useEffect(() => {
    actionsRef.current = actions;
  }, [actions]);

  const appendTraffic = useCallback((entry: TrafficEntry) => {
    setTraffic((current) => [entry, ...current].slice(0, 120));
  }, []);

  const appendSessionUpdate = useCallback((notification: AcpSessionUpdate) => {
    const update = notification.update;
    const sessionId = notification.sessionId;
    if (update.sessionUpdate === "agent_message_chunk" || update.sessionUpdate === "agent_thought_chunk") {
      const text = update.content?.text ?? "";
      if (!text) return;
      appendSessionMessages(
        setSessionsById,
        sessionId,
        [
          {
            id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            role: update.sessionUpdate === "agent_thought_chunk" ? "thought" : "agent",
            text,
          },
        ],
        (current, incoming) => mergeTextChunk(current, incoming[0].role as "agent" | "thought", incoming[0].text)
      );
      return;
    }

    if (update.sessionUpdate === "tool_call") {
      appendSessionMessages(setSessionsById, sessionId, [
        {
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          role: "tool",
          text: update.title ?? update.toolCallId ?? "tool",
          status: update.status,
          toolCallId: update.toolCallId,
        },
      ]);
      return;
    }

    if (update.sessionUpdate === "tool_call_update") {
      updateSessionMessages(setSessionsById, sessionId, (current) => updateToolStatus(current, update.toolCallId, update.status));
      return;
    }

    if (update.sessionUpdate === "error") {
      appendSessionMessages(setSessionsById, sessionId, [
        {
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          role: "error",
          text: stringifyDiagnostic(update.error),
        },
      ]);
    }
  }, []);

  const appendClientToolCall = useCallback((call: ClientToolCall) => {
    updateSession(setSessionsById, call.sessionId, (session) => ({
      ...session,
      clientToolCalls: [call, ...session.clientToolCalls].slice(0, 50),
      lastActiveAt: new Date().toISOString(),
    }));
    appendSessionMessages(setSessionsById, call.sessionId, [
      {
        id: call.id,
        role: "system",
        text: `Client tool handled: ${call.toolName} (${call.toolUseId})`,
      },
    ]);
  }, []);

  const appendPermissionRequest = useCallback((request: PermissionRequestLog) => {
    updateSession(setSessionsById, request.sessionId, (session) => ({
      ...session,
      permissionRequests: [request, ...session.permissionRequests].slice(0, 50),
      lastActiveAt: new Date().toISOString(),
    }));
    appendSessionMessages(setSessionsById, request.sessionId, [
      {
        id: request.id,
        role: "system",
        text: `Permission approved: ${request.title} -> ${request.selectedOptionId}`,
      },
    ]);
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

  const ensureClient = useCallback(() => {
    if (!clientRef.current) {
      clientRef.current = new AcpWebSocketClient({
        onTraffic: appendTraffic,
        onSessionUpdate: appendSessionUpdate,
        onClientToolCall: appendClientToolCall,
        onPermissionRequest: appendPermissionRequest,
        executeClientTool,
        onStatus: setStatus,
        onError: setError,
      });
    }
    return clientRef.current;
  }, [appendClientToolCall, appendPermissionRequest, appendSessionUpdate, appendTraffic, executeClientTool]);

  const buildAgentConfig = useCallback((): AgentConfigPayload | undefined => {
    if (!useInlineAgentConfig) return undefined;
    return {
      executor_type: "CLAUDE_CODE",
      model: model.trim() || DEFAULT_MODEL,
      permission_mode: permissionMode,
      mcp_servers: ["gui_action"],
      append_prompt: DEFAULT_APPEND_PROMPT,
    };
  }, [model, permissionMode, useInlineAgentConfig]);

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
      });
      const id = readSessionId(session);
      if (!id) throw new Error("session/new did not return sessionId");
      const record = createUiSession(id, cwd, session);
      setSessionsById((current) => ({ ...current, [id]: record }));
      setSessionOrder((current) => [id, ...current.filter((item) => item !== id)]);
      setActiveSessionId(id);
      appendSessionMessages(setSessionsById, id, [{
        id: `${Date.now()}-session`,
        role: "system",
        text: `Session ready: ${id}`,
      }]);
    } catch (sessionError) {
      setError(sessionError instanceof Error ? sessionError.message : String(sessionError));
    }
  }, [agentConfigPath, buildAgentConfig, cwd, ensureClient, initializeResult, wsUrl]);

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
      const session = await client.loadSession({ session_id: id, cwd, agent_config: buildAgentConfig() });
      const loadedId = readSessionId(session) ?? id;
      setSessionsById((current) => ({
        ...current,
        [loadedId]: createUiSession(loadedId, cwd, session, current[loadedId]),
      }));
      setSessionOrder((current) => [loadedId, ...current.filter((item) => item !== loadedId)]);
      setActiveSessionId(loadedId);
      appendSessionMessages(setSessionsById, loadedId, [{
        id: `${Date.now()}-load-session`,
        role: "system",
        text: `Session loaded: ${loadedId}`,
      }]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    }
  }, [buildAgentConfig, cwd, ensureClient, initializeResult, loadSessionId, wsUrl]);

  const disconnect = useCallback(() => {
    clientRef.current?.disconnect();
    clientRef.current = null;
  }, []);

  const sendPrompt = useCallback(async () => {
    if (!sessionId) return;
    const text = prompt.trim();
    if (!text) return;

    setError(null);
    appendSessionMessages(setSessionsById, sessionId, [{
      id: `${Date.now()}-system`,
      role: "system",
      text: `Prompt sent: ${text}`,
    }]);
    try {
      const result = await clientRef.current?.prompt(sessionId, text);
      updateSession(setSessionsById, sessionId, (session) => ({
        ...session,
        promptResult: result,
        lastActiveAt: new Date().toISOString(),
      }));
    } catch (promptError) {
      setError(promptError instanceof Error ? promptError.message : String(promptError));
    }
  }, [prompt, sessionId]);

  const cancel = useCallback(() => {
    if (sessionId) clientRef.current?.cancel(sessionId);
  }, [sessionId]);

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
          <button className="btn-secondary" onClick={createSession} disabled={!connected}>
            <FolderPlus size={16} />
            New
          </button>
          <button className="btn-secondary" onClick={loadSession} disabled={!connected || !loadSessionId.trim()}>
            <RotateCcw size={16} />
            Load
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
              <h1 className="text-xl font-semibold tracking-tight">ACP WebSocket 调试客户端</h1>
              <p className="text-sm text-muted-foreground">
                Connects to Viben Gateway at <code>/ws/agent/acp</code> and speaks ACP JSON-RPC.
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
                      <textarea
                        value={selectedAction.inputSchemaText}
                        onChange={(event) => updateAction(setActions, selectedAction.id, { inputSchemaText: event.target.value })}
                        className="textarea font-mono text-xs"
                        rows={7}
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
              <div className="mt-3 flex flex-wrap gap-2">
                <label className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm">
                  <input
                    type="checkbox"
                    checked={useInlineAgentConfig}
                    onChange={(event) => setUseInlineAgentConfig(event.target.checked)}
                  />
                  Inline Claude ACP + gui_action
                </label>
                <button className="btn-secondary" onClick={createSession} disabled={!connected}>
                  <FolderPlus size={16} />
                  New Session
                </button>
                <button className="btn-secondary" onClick={loadSession} disabled={!connected || !loadSessionId.trim()}>
                  <RotateCcw size={16} />
                  Load Session
                </button>
              </div>
              {error && <div className="mt-4 rounded-lg border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
            </Panel>

            <Panel title="Prompt Turn" description="Send session/prompt and watch session/update notifications stream back.">
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                className="textarea"
                rows={5}
              />
              <div className="mt-3 flex gap-2">
                <button className="btn-primary" onClick={sendPrompt} disabled={!connected || !sessionId || !prompt.trim()}>
                  <Send size={16} />
                  Send Prompt
                </button>
                <button className="btn-secondary" onClick={cancel} disabled={!connected || !sessionId}>
                  <CircleStop size={16} />
                  Cancel Turn
                </button>
                <button className="btn-secondary" onClick={() => {
                  if (sessionId) {
                    updateSession(setSessionsById, sessionId, (session) => ({ ...session, messages: [] }));
                  }
                }}>
                  <Trash2 size={16} />
                  Clear
                </button>
              </div>
            </Panel>

            <Panel title="Session Stream" description="Agent text, thoughts, tool calls, and client-side tool callbacks.">
              <div className="space-y-3">
                {messages.length === 0 ? (
                  <EmptyState text="No session/update frames yet." />
                ) : (
                  messages.map((message) => <MessageRow key={message.id} message={message} />)
                )}
              </div>
            </Panel>
          </section>

          <section className="space-y-5">
            <Panel title="Client Tools" description="Requests initiated by Viben through _viben/client_tool_call.">
              <div className="mb-3 rounded-lg border border-border bg-muted/35 p-3 text-xs">
                <div className="mb-2 font-semibold">Available GUI actions</div>
                <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words leading-5">
                  {JSON.stringify(actionSummaries, null, 2)}
                </pre>
              </div>
              <div className="max-h-80 space-y-2 overflow-auto pr-1">
                {clientToolCalls.length === 0 ? (
                  <EmptyState text="No client-side tool calls yet." />
                ) : (
                  clientToolCalls.map((call) => <ClientToolRow key={call.id} call={call} />)
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

            <Panel title="ACP Results">
              <JsonBlock title="initialize" value={initializeResult} />
              <JsonBlock title="session/new" value={sessionResult} />
              <JsonBlock title="session/prompt" value={promptResult} />
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
      </main>
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
        <div>{session.messages.length}</div>
        <div>msgs</div>
      </div>
    </button>
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

function MessageRow({ message }: { message: ChatMessage }) {
  const tone = message.role === "agent"
    ? "border-primary/30 bg-primary/5"
    : message.role === "thought"
      ? "border-warning/35 bg-warning/10"
      : message.role === "tool"
        ? "border-info/35 bg-info/10"
        : message.role === "error"
          ? "border-destructive/35 bg-destructive/10 text-destructive"
          : "border-border bg-muted/50";
  return (
    <div className={`rounded-lg border px-3 py-2 text-sm ${tone}`}>
      <div className="mb-1 flex items-center justify-between gap-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <span>{message.role}</span>
        {message.status && <span>{message.status}</span>}
      </div>
      <div className="whitespace-pre-wrap break-words leading-6">{message.text}</div>
    </div>
  );
}

function ClientToolRow({ call }: { call: ClientToolCall }) {
  return (
    <details className="rounded-lg border border-info/35 bg-info/10 p-3 text-xs">
      <summary className="cursor-pointer list-none">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate font-semibold">{call.toolName}</div>
            <div className="truncate text-muted-foreground">{call.action ?? call.toolUseId}</div>
          </div>
          <span className="shrink-0 text-muted-foreground">{new Date(call.at).toLocaleTimeString()}</span>
        </div>
      </summary>
      <pre className="mt-3 max-h-72 overflow-auto rounded-md bg-code-block p-3 leading-5 text-code-foreground">
        <JsonCode value={{ input: call.input, result: call.result }} />
      </pre>
    </details>
  );
}

function PermissionRow({ request }: { request: PermissionRequestLog }) {
  return (
    <details className="rounded-lg border border-warning/35 bg-warning/10 p-3 text-xs">
      <summary className="cursor-pointer list-none">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate font-semibold">{request.title}</div>
            <div className="truncate text-muted-foreground">{request.toolCallId}</div>
          </div>
          <span className="shrink-0 rounded-full bg-card px-2 py-1 font-semibold text-foreground">
            {request.selectedOptionId}
          </span>
        </div>
      </summary>
      <pre className="mt-3 max-h-56 overflow-auto rounded-md bg-code-block p-3 leading-5 text-code-foreground">
        <JsonCode value={{ rawInput: request.rawInput, options: request.options }} />
      </pre>
    </details>
  );
}

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</div>
      <pre className="max-h-44 overflow-auto rounded-lg bg-code-block p-3 text-xs leading-5 text-code-foreground">
        <JsonCode value={value ?? null} />
      </pre>
    </div>
  );
}

function TrafficRow({ entry }: { entry: TrafficEntry }) {
  return (
    <details className={entry.error ? "rounded-lg border border-destructive/35 bg-destructive/10 p-3 text-xs" : "rounded-lg border border-border bg-surface p-3 text-xs"}>
      <summary className="cursor-pointer list-none">
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
      </summary>
      <pre className="mt-3 max-h-72 overflow-auto rounded-md bg-code-block p-3 leading-5">
        <JsonCode value={entry.payload} />
      </pre>
    </details>
  );
}

function JsonCode({ value }: { value: unknown }) {
  return (
    <code className="json-code">
      {tokenizeJson(prettyJson(value)).map((token, index) => (
        <span key={`${index}-${token.text}`} className={token.className}>
          {token.text}
        </span>
      ))}
    </code>
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
  return toolName === "GUI_execute" || toolName === "mcp__gui_action__GUI_execute";
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
      toolUseId: request.toolUseId,
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
    toolUseId: `local-${Date.now()}`,
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
    toolUseId: request.toolUseId,
    action: actionName,
    input: request.input,
    result: executeGuiAction(request, actions),
  };
}

function createUiSession(
  id: string,
  cwd: string,
  sessionResult: unknown,
  existing?: UiSessionState
): UiSessionState {
  const now = new Date().toISOString();
  return {
    id,
    title: existing?.title ?? `Session ${shortId(id)}`,
    cwd,
    createdAt: existing?.createdAt ?? now,
    lastActiveAt: now,
    sessionResult,
    promptResult: existing?.promptResult ?? null,
    messages: existing?.messages ?? [],
    clientToolCalls: existing?.clientToolCalls ?? [],
    permissionRequests: existing?.permissionRequests ?? [],
  };
}

function ensureUiSession(id: string): UiSessionState {
  return createUiSession(id, "", { sessionId: id });
}

function updateSession(
  setSessionsById: React.Dispatch<React.SetStateAction<Record<string, UiSessionState>>>,
  sessionId: string,
  updater: (session: UiSessionState) => UiSessionState
): void {
  setSessionsById((current) => {
    const existing = current[sessionId] ?? ensureUiSession(sessionId);
    return {
      ...current,
      [sessionId]: updater(existing),
    };
  });
}

function updateSessionMessages(
  setSessionsById: React.Dispatch<React.SetStateAction<Record<string, UiSessionState>>>,
  sessionId: string,
  updater: (messages: ChatMessage[]) => ChatMessage[]
): void {
  updateSession(setSessionsById, sessionId, (session) => ({
    ...session,
    messages: updater(session.messages),
    lastActiveAt: new Date().toISOString(),
  }));
}

function appendSessionMessages(
  setSessionsById: React.Dispatch<React.SetStateAction<Record<string, UiSessionState>>>,
  sessionId: string,
  messages: ChatMessage[],
  merge?: (current: ChatMessage[], incoming: ChatMessage[]) => ChatMessage[]
): void {
  updateSessionMessages(setSessionsById, sessionId, (current) => merge ? merge(current, messages) : [...current, ...messages]);
}

function textResult(text: string, meta: Record<string, unknown>): CallToolResult {
  return {
    content: [{ type: "text", text }],
    _meta: meta,
  };
}

function buildActionSummaries(actions: GuiActionDefinition[]) {
  return actions.map((action) => ({
    name: action.name,
    description: action.description,
    input_schema: parseJsonOrFallback(action.inputSchemaText, { type: "object", properties: {} }),
  }));
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

function parseJsonOrFallback(text: string, fallback: unknown): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function normalizeJsonText(text: string): string {
  return prettyJson(parseJsonOrFallback(text, { type: "object", properties: {} }));
}

function prettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

interface JsonToken {
  text: string;
  className?: string;
}

function tokenizeJson(json: string): JsonToken[] {
  const tokens: JsonToken[] = [];
  let cursor = 0;
  const pattern = /("(?:\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"(\s*:)?|\btrue\b|\bfalse\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[{}[\],:])/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(json)) !== null) {
    if (match.index > cursor) {
      tokens.push({ text: json.slice(cursor, match.index) });
    }
    tokens.push({
      text: match[0],
      className: getJsonTokenClass(match[0]),
    });
    cursor = match.index + match[0].length;
  }

  if (cursor < json.length) {
    tokens.push({ text: json.slice(cursor) });
  }
  return tokens;
}

function getJsonTokenClass(token: string): string {
  if (/^"/.test(token)) return token.endsWith(":") ? "json-key" : "json-string";
  if (/^-?\d/.test(token)) return "json-number";
  if (token === "true" || token === "false") return "json-boolean";
  if (token === "null") return "json-null";
  return "json-punctuation";
}

function stringifyDiagnostic(value: unknown): string {
  if (value === undefined || value === null) return "Unknown ACP error";
  if (typeof value === "string") return value;
  return prettyJson(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeTextChunk(current: ChatMessage[], role: "agent" | "thought", text: string): ChatMessage[] {
  const previous = current[current.length - 1];
  if (previous?.role === role && !previous.status) {
    return [
      ...current.slice(0, -1),
      {
        ...previous,
        text: `${previous.text}${text}`,
      },
    ];
  }
  return [
    ...current,
    {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      role,
      text,
    },
  ];
}

function updateToolStatus(current: ChatMessage[], toolCallId: string | undefined, status: string | undefined): ChatMessage[] {
  if (!toolCallId) return current;
  let updated = false;
  const next = current.map((message) => {
    if (message.toolCallId !== toolCallId) return message;
    updated = true;
    return {
      ...message,
      status,
    };
  });
  if (updated) return next;
  return [
    ...current,
    {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      role: "tool",
      text: toolCallId,
      status,
      toolCallId,
    },
  ];
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
