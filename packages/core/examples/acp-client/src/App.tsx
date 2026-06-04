import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Bot,
  CircleStop,
  Copy,
  FileJson,
  EthernetPort,
  Loader2,
  Plug,
  Plus,
  Save,
  Send,
  SquareTerminal,
  Trash2,
  Unplug,
} from "lucide-react";
import {
  AcpWebSocketClient,
  type AcpSessionUpdate,
  type CallToolResult,
  type ClientToolCall,
  type ClientToolExecutionRequest,
  type ConnectionStatus,
  type TrafficEntry,
} from "./acp-client";

interface ChatMessage {
  id: string;
  role: "agent" | "thought" | "tool" | "system";
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

const DEFAULT_WS_URL = "ws://127.0.0.1:18790/ws/agent/acp";
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
  const [prompt, setPrompt] = useState("Hello from the Viben ACP example client.");
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [initializeResult, setInitializeResult] = useState<unknown>(null);
  const [sessionResult, setSessionResult] = useState<unknown>(null);
  const [promptResult, setPromptResult] = useState<unknown>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [traffic, setTraffic] = useState<TrafficEntry[]>([]);
  const [clientToolCalls, setClientToolCalls] = useState<ClientToolCall[]>([]);
  const [actions, setActions] = useState<GuiActionDefinition[]>(DEFAULT_ACTIONS);
  const [selectedActionId, setSelectedActionId] = useState(DEFAULT_ACTIONS[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const clientRef = useRef<AcpWebSocketClient | null>(null);
  const actionsRef = useRef(actions);

  const busy = status === "connecting";
  const connected = status === "connected";
  const stats = useMemo(() => summarizeTraffic(traffic), [traffic]);
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
    if (update.sessionUpdate === "agent_message_chunk" || update.sessionUpdate === "agent_thought_chunk") {
      const text = update.content?.text ?? "";
      if (!text) return;
      setMessages((current) => [
        ...mergeTextChunk(current, update.sessionUpdate === "agent_thought_chunk" ? "thought" : "agent", text),
      ]);
      return;
    }

    if (update.sessionUpdate === "tool_call") {
      setMessages((current) => [
        ...current,
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
      setMessages((current) => updateToolStatus(current, update.toolCallId, update.status));
    }
  }, []);

  const appendClientToolCall = useCallback((call: ClientToolCall) => {
    setClientToolCalls((current) => [call, ...current].slice(0, 50));
    setMessages((current) => [
      ...current,
      {
        id: call.id,
        role: "system",
        text: `Client tool handled: ${call.toolName} (${call.toolUseId})`,
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
        executeClientTool,
        onStatus: setStatus,
        onError: setError,
      });
    }
    return clientRef.current;
  }, [appendClientToolCall, appendSessionUpdate, appendTraffic, executeClientTool]);

  const connect = useCallback(async () => {
    setError(null);
    setInitializeResult(null);
    setSessionResult(null);
    setPromptResult(null);
    setSessionId(null);
    setMessages([]);
    setClientToolCalls([]);
    try {
      const client = ensureClient();
      await client.connect(wsUrl);
      const initialized = await client.initialize();
      setInitializeResult(initialized);
      const session = await client.newSession({
        cwd,
        agent_config_path: agentConfigPath.trim() || undefined,
      });
      setSessionResult(session);
      setSessionId(readSessionId(session));
      setMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-session`,
          role: "system",
          text: `Session ready: ${readSessionId(session) ?? "unknown"}`,
        },
      ]);
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : String(connectError));
    }
  }, [agentConfigPath, cwd, ensureClient, wsUrl]);

  const disconnect = useCallback(() => {
    clientRef.current?.disconnect();
    clientRef.current = null;
    setSessionId(null);
  }, []);

  const sendPrompt = useCallback(async () => {
    if (!sessionId) return;
    const text = prompt.trim();
    if (!text) return;

    setError(null);
    setMessages((current) => [
      ...current,
      {
        id: `${Date.now()}-system`,
        role: "system",
        text: `Prompt sent: ${text}`,
      },
    ]);
    try {
      const result = await clientRef.current?.prompt(sessionId, text);
      setPromptResult(result);
    } catch (promptError) {
      setError(promptError instanceof Error ? promptError.message : String(promptError));
    }
  }, [prompt, sessionId]);

  const cancel = useCallback(() => {
    if (sessionId) clientRef.current?.cancel(sessionId);
  }, [sessionId]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-border bg-sidebar px-5 py-6 lg:block">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <EthernetPort size={20} />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-wide">Viben ACP</div>
            <div className="text-xs text-muted-foreground">Client Example</div>
          </div>
        </div>

        <nav className="mt-8 space-y-2">
          <NavItem icon={<Plug size={16} />} label="Connection" active />
          <NavItem icon={<Bot size={16} />} label="Session" />
          <NavItem icon={<Activity size={16} />} label="Traffic" />
          <NavItem icon={<SquareTerminal size={16} />} label="Client Tools" />
        </nav>

        <div className="absolute bottom-6 left-5 right-5 rounded-lg border border-border bg-surface p-4">
          <StatusPill status={status} />
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
            <Stat label="In" value={stats.inbound} />
            <Stat label="Out" value={stats.outbound} />
            <Stat label="Tools" value={stats.clientTools} />
          </div>
        </div>
      </aside>

      <main className="lg:pl-72">
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

            <Panel title="Connection" description="Initialize ACP and create a live Viben session.">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="WebSocket URL">
                  <input value={wsUrl} onChange={(event) => setWsUrl(event.target.value)} className="input" />
                </Field>
                <Field label="Working Directory">
                  <input value={cwd} onChange={(event) => setCwd(event.target.value)} className="input" />
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
                <button className="btn-secondary" onClick={() => setMessages([])}>
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

            <Panel title="ACP Results">
              <JsonBlock title="initialize" value={initializeResult} />
              <JsonBlock title="session/new" value={sessionResult} />
              <JsonBlock title="session/prompt" value={promptResult} />
            </Panel>

            <Panel title="Traffic Monitor" description="Newest JSON-RPC frames first.">
              <div className="max-h-[680px] space-y-2 overflow-auto pr-1">
                {traffic.length === 0 ? (
                  <EmptyState text="Connect to start recording frames." />
                ) : (
                  traffic.map((entry) => <TrafficRow key={entry.id} entry={entry} />)
                )}
              </div>
            </Panel>
          </section>
        </div>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active = false }: { icon: React.ReactNode; label: string; active?: boolean }) {
  return (
    <div className={active ? "nav-item nav-item-active" : "nav-item"}>
      {icon}
      <span>{label}</span>
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

function StatusPill({ status }: { status: ConnectionStatus }) {
  const color = status === "connected" ? "bg-success" : status === "connecting" ? "bg-warning" : status === "error" ? "bg-destructive" : "bg-muted-foreground";
  return (
    <div className="flex items-center gap-2 text-sm">
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
  const tone = message.role === "agent" ? "border-primary/30 bg-primary/5" : message.role === "thought" ? "border-warning/35 bg-warning/10" : message.role === "tool" ? "border-info/35 bg-info/10" : "border-border bg-muted/50";
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
        {JSON.stringify({ input: call.input, result: call.result }, null, 2)}
      </pre>
    </details>
  );
}

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</div>
      <pre className="max-h-44 overflow-auto rounded-lg bg-code-block p-3 text-xs leading-5 text-code-foreground">
        {value ? JSON.stringify(value, null, 2) : "null"}
      </pre>
    </div>
  );
}

function TrafficRow({ entry }: { entry: TrafficEntry }) {
  return (
    <details className="rounded-lg border border-border bg-surface p-3 text-xs">
      <summary className="cursor-pointer list-none">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className={entry.direction === "in" ? "badge-in" : "badge-out"}>{entry.direction}</span>
            <span className="truncate font-medium">{entry.method ?? entry.type}</span>
          </div>
          <span className="shrink-0 text-muted-foreground">{new Date(entry.at).toLocaleTimeString()}</span>
        </div>
      </summary>
      <pre className="mt-3 max-h-72 overflow-auto rounded-md bg-code-block p-3 leading-5">
        {JSON.stringify(entry.payload, null, 2)}
      </pre>
    </details>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
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
      return stats;
    },
    { inbound: 0, outbound: 0, clientTools: 0 }
  );
}

function isGuiExecuteTool(toolName: string): boolean {
  return toolName === "GUI_execute" || toolName === "mcp__gui_action__GUI_execute";
}

function executeGuiAction(request: ClientToolExecutionRequest, actions: GuiActionDefinition[]): CallToolResult {
  const input = isRecord(request.input) ? request.input : {};
  const actionName = typeof input.action === "string" ? input.action : "";
  const payload = isRecord(input.payload) ? input.payload : {};

  if (!actionName) {
    return {
      content: [{ type: "text", text: "GUI_execute error: input.action is required." }],
      isError: true,
    };
  }

  if (actionName === "list_actions") {
    return textResult(prettyJson(buildActionSummaries(actions)), {
      actions: buildActionSummaries(actions),
    });
  }

  if (actionName === "get_action_detail") {
    const requested = typeof payload.action === "string" ? payload.action : typeof payload.name === "string" ? payload.name : "";
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
    toolName: request.toolName,
    toolUseId: request.toolUseId,
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
