/**
 * Type declarations for @openclaw/sdk
 *
 * These mirror the public API of the OpenClaw SDK.
 * Used until the SDK package can be properly built and linked.
 */
declare module "@openclaw/sdk" {
  export type OpenClawEventType =
    | "run.created"
    | "run.queued"
    | "run.started"
    | "run.completed"
    | "run.failed"
    | "run.cancelled"
    | "run.timed_out"
    | "assistant.delta"
    | "assistant.message"
    | "thinking.delta"
    | "tool.call.started"
    | "tool.call.delta"
    | "tool.call.completed"
    | "tool.call.failed"
    | "approval.requested"
    | "approval.resolved"
    | "question.requested"
    | "question.answered"
    | "artifact.created"
    | "artifact.updated"
    | "session.created"
    | "session.updated"
    | "session.compacted"
    | "task.updated"
    | "git.branch"
    | "git.diff"
    | "git.pr"
    | "raw";

  export type GatewayEvent = {
    event: string;
    payload?: unknown;
    seq?: number;
    stateVersion?: unknown;
  };

  export type OpenClawEvent<TData = unknown> = {
    version: 1;
    id: string;
    ts: number;
    type: OpenClawEventType;
    runId?: string;
    sessionId?: string;
    sessionKey?: string;
    taskId?: string;
    agentId?: string;
    data: TData;
    raw?: GatewayEvent;
  };

  export type RunStatus = "accepted" | "completed" | "failed" | "cancelled" | "timed_out";

  export type RunResult = {
    runId: string;
    status: RunStatus;
    sessionId?: string;
    sessionKey?: string;
    error?: { message: string };
    raw?: unknown;
  };

  export type SessionCreateParams = {
    key?: string;
    agentId?: string;
    label?: string;
    model?: string;
    parentSessionKey?: string;
    task?: string;
    message?: string;
  };

  export type SessionSendParams = {
    key: string;
    message: string;
    thinking?: string;
    attachments?: unknown[];
    timeoutMs?: number;
    idempotencyKey?: string;
  };

  export type SessionTarget = {
    key: string;
    sessionId?: string;
    agentId?: string;
    label?: string;
  };

  export type OpenClawOptions = {
    gateway?: "auto" | (string & {});
    url?: string;
    token?: string;
    password?: string;
    requestTimeoutMs?: number;
    transport?: unknown;
  };

  export class Run {
    readonly id: string;
    readonly sessionKey?: string;
    events(filter?: (event: OpenClawEvent) => boolean): AsyncIterable<OpenClawEvent>;
    wait(options?: { timeoutMs?: number }): Promise<RunResult>;
    cancel(): Promise<unknown>;
  }

  export class Session {
    readonly key: string;
    readonly info?: unknown;
    send(input: string | Omit<SessionSendParams, "key">): Promise<Run>;
    abort(runId?: string): Promise<unknown>;
    patch(params: Record<string, unknown>): Promise<unknown>;
    compact(params?: { maxLines?: number }): Promise<unknown>;
  }

  export class SessionsNamespace {
    list(params?: Record<string, unknown>): Promise<unknown>;
    create(params?: SessionCreateParams): Promise<Session>;
    get(target: SessionTarget | string): Promise<Session>;
    resolve(params: Record<string, unknown>): Promise<unknown>;
    send(input: SessionSendParams): Promise<Run>;
  }

  export class RunsNamespace {
    create(params: Record<string, unknown>): Promise<Run>;
    get(runId: string): Promise<Run>;
    events(runId: string): AsyncIterable<OpenClawEvent>;
    wait(runId: string, options?: { timeoutMs?: number }): Promise<RunResult>;
    cancel(runId: string, sessionKey?: string): Promise<unknown>;
  }

  export class AgentsNamespace {
    list(params?: Record<string, unknown>): Promise<unknown>;
    get(id: string): Promise<unknown>;
    create(params: Record<string, unknown>): Promise<unknown>;
    update(params: Record<string, unknown>): Promise<unknown>;
    delete(params: Record<string, unknown>): Promise<unknown>;
  }

  export class ModelsNamespace {
    list(params?: unknown): Promise<unknown>;
    status(params?: unknown): Promise<unknown>;
  }

  export class ToolsNamespace {
    list(params?: unknown): Promise<unknown>;
    invoke(params: unknown): Promise<unknown>;
  }

  export class TasksNamespace {
    list(params?: unknown): Promise<unknown>;
    get(taskId: string): Promise<unknown>;
    cancel(taskId: string): Promise<unknown>;
  }

  export class ApprovalsNamespace {}
  export class ArtifactsNamespace {}
  export class EnvironmentsNamespace {}
  export class Agent {}

  export class OpenClaw {
    readonly agents: AgentsNamespace;
    readonly sessions: SessionsNamespace;
    readonly runs: RunsNamespace;
    readonly tasks: TasksNamespace;
    readonly models: ModelsNamespace;
    readonly tools: ToolsNamespace;
    readonly artifacts: ArtifactsNamespace;
    readonly approvals: ApprovalsNamespace;
    readonly environments: EnvironmentsNamespace;

    constructor(options?: OpenClawOptions);
    connect(): Promise<void>;
    close(): Promise<void>;
    request<T = unknown>(method: string, params?: unknown, options?: unknown): Promise<T>;
    events(filter?: (event: OpenClawEvent) => boolean): AsyncIterable<OpenClawEvent>;
    runEvents(runId: string, filter?: (event: OpenClawEvent) => boolean): AsyncIterable<OpenClawEvent>;
    rawEvents(filter?: (event: GatewayEvent) => boolean): AsyncIterable<GatewayEvent>;
  }

  export function normalizeGatewayEvent(event: GatewayEvent): OpenClawEvent;
  export class EventHub<T> {
    constructor(options?: { replayLimit?: number });
    publish(event: T): void;
    stream(filter?: (event: T) => boolean, options?: { replay?: boolean }): AsyncIterable<T>;
    close(): void;
  }
  export function isGatewayEvent(value: unknown): value is GatewayEvent;
  export class GatewayClientTransport {
    constructor(options: unknown);
    connect(): Promise<void>;
    request<T = unknown>(method: string, params?: unknown, options?: unknown): Promise<T>;
    events(filter?: (event: GatewayEvent) => boolean): AsyncIterable<GatewayEvent>;
    close(): Promise<void>;
  }
  export function isConnectableTransport(transport: unknown): boolean;
}
