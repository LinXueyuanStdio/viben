/**
 * Container service for process management
 *
 * Manages executor processes (spawning, tracking, termination).
 */
import type { ChildProcess } from "node:child_process";
import { EventService } from "./events";
import { SessionStoreService, createUserMessage, UIMessageHelpers } from "./session-store";
import type { ExecutionEnv, SpawnedChild, StandardCodingAgentExecutor } from "../executors/types";
import { randomUUID } from "node:crypto";
import { logger as globalLogger } from "../telemetry";

// Module-level logger
const log = globalLogger.child({ module: "container" });

/**
 * Process running status
 */
export type ProcessRunStatus = "running" | "completed" | "failed" | "cancelled";

/**
 * Process state tracking
 */
export interface ProcessState {
  sessionId: string;
  agentType: string;
  workdir: string;
  pid?: number;
  status: ProcessRunStatus;
}

/**
 * Container service for managing executor processes
 */
export class ContainerService {
  private processes: Map<string, ProcessState> = new Map();
  private eventService: EventService;
  private sessionStore: SessionStoreService;

  constructor(eventService: EventService, sessionStore?: SessionStoreService) {
    this.eventService = eventService;
    this.sessionStore = sessionStore || new SessionStoreService();
  }

  /**
   * Spawn a new agent process and stream its output
   *
   * @param sessionId - Unique session identifier
   * @param executor - The coding agent executor to spawn
   * @param agentId - The agent ID for session storage (e.g., user's agent name)
   * @param agentType - The executor type name (e.g., "claude_code", "gemini")
   * @param workdir - Working directory for the agent
   * @param prompt - Initial prompt to send
   * @param env - Execution environment
   */
  async spawnAgent(
    sessionId: string,
    executor: StandardCodingAgentExecutor,
    agentId: string,
    agentType: string,
    workdir: string,
    prompt: string,
    env: ExecutionEnv
  ): Promise<SpawnedChild> {
    // Spawn the process
    const child = await executor.spawn(workdir, prompt, env);

    // Track the process
    const state: ProcessState = {
      sessionId,
      agentType,
      workdir,
      pid: child.child.pid,
      status: "running",
    };

    this.processes.set(sessionId, state);

    // Broadcast event
    this.eventService.agentSpawned(agentType, sessionId);

    // Save user message to session store
    try {
      const userMsg = createUserMessage(prompt);
      await this.sessionStore.appendMessage(agentId, sessionId, userMsg);

      // Save to UI messages
      const uiUserMsg = UIMessageHelpers.user(randomUUID(), prompt);
      await this.sessionStore.appendUIMessage(agentId, sessionId, uiUserMsg);
    } catch (e) {
      log.warn({ err: e }, "Failed to save user message");
    }

    // Set up stdout streaming
    this.setupStdoutStreaming(child.child, sessionId, agentId, agentType);

    return child;
  }

  /**
   * Set up stdout streaming for JSON output
   */
  private setupStdoutStreaming(
    childProcess: ChildProcess,
    sessionId: string,
    agentId: string,
    agentType: string
  ): void {
    const stdout = childProcess.stdout;
    if (!stdout) {
      log.warn({ sessionId }, "No stdout available for session");
      this.eventService.agentCompleted(agentType, sessionId, true);
      return;
    }

    let buffer = "";

    stdout.on("data", (data: Buffer) => {
      buffer += data.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        this.processStreamLine(line, sessionId, agentId, agentType);
      }
    });

    stdout.on("end", () => {
      // Process remaining buffer
      if (buffer.trim()) {
        this.processStreamLine(buffer, sessionId, agentId, agentType);
      }
      this.eventService.agentCompleted(agentType, sessionId, true);
    });

    childProcess.on("exit", (code) => {
      const success = code === 0;
      const state = this.processes.get(sessionId);
      if (state) {
        state.status = success ? "completed" : "failed";
        this.processes.set(sessionId, state);
      }
      this.eventService.agentCompleted(agentType, sessionId, success);
    });
  }

  /**
   * Process a stream line (JSON from executor)
   */
  private processStreamLine(
    line: string,
    sessionId: string,
    agentId: string,
    agentType: string
  ): void {
    try {
      const json = JSON.parse(line);
      const msgType = json.type;

      // Save raw agent message
      this.sessionStore.appendAgentMessage(agentId, sessionId, {
        timestamp: new Date().toISOString(),
        raw: json,
        source: agentType,
      }).catch((e) => log.warn({ err: e }, "Failed to save agent message"));

      // Process based on message type
      switch (msgType) {
        case "assistant":
          this.handleAssistantMessage(json, sessionId, agentId);
          break;
        case "text":
          this.handleTextMessage(json, sessionId, agentId);
          break;
        case "stream_event":
          this.eventService.executionLog(sessionId, "stream_event", line);
          break;
        case "tool_use":
          this.handleToolUse(json, sessionId, agentId);
          break;
        case "tool_result":
          this.handleToolResult(json, sessionId, agentId);
          break;
        case "result":
          this.handleResult(json, sessionId, agentId);
          break;
        case "error":
          this.handleError(json, sessionId, agentId);
          break;
        default:
          this.eventService.executionLog(sessionId, msgType || "output", line);
      }
    } catch {
      // Non-JSON line
      this.eventService.executionLog(sessionId, "output", line);
    }
  }

  /**
   * Handle assistant message
   */
  private handleAssistantMessage(json: Record<string, unknown>, sessionId: string, agentId: string): void {
    const message = json.message as Record<string, unknown> | undefined;
    if (!message) return;

    const contentArray = message.content as unknown[] | undefined;
    if (!Array.isArray(contentArray)) return;

    for (const item of contentArray) {
      const contentItem = item as Record<string, unknown>;
      const itemType = contentItem.type as string;

      if (itemType === "text") {
        const text = contentItem.text as string;
        if (text) {
          this.eventService.sessionMessage(sessionId, text, "assistant");
          const uiMsg = UIMessageHelpers.text(randomUUID(), text);
          this.sessionStore.appendUIMessage(agentId, sessionId, uiMsg).catch(() => {});
        }
      } else if (itemType === "tool_use") {
        this.eventService.executionLog(sessionId, "tool_use", JSON.stringify(contentItem));
        const toolId = contentItem.id as string || "unknown";
        const toolName = contentItem.name as string || "unknown";
        const toolInput = contentItem.input as unknown || null;
        const uiMsg = UIMessageHelpers.toolUse(randomUUID(), toolId, toolName, toolInput);
        this.sessionStore.appendUIMessage(agentId, sessionId, uiMsg).catch(() => {});
      }
    }
  }

  /**
   * Handle text message
   */
  private handleTextMessage(json: Record<string, unknown>, sessionId: string, agentId: string): void {
    const content = json.content as string;
    if (content) {
      this.eventService.sessionMessage(sessionId, content, "assistant");
      const uiMsg = UIMessageHelpers.text(randomUUID(), content);
      this.sessionStore.appendUIMessage(agentId, sessionId, uiMsg).catch(() => {});
    }
  }

  /**
   * Handle tool use
   */
  private handleToolUse(json: Record<string, unknown>, sessionId: string, agentId: string): void {
    this.eventService.executionLog(sessionId, "tool_use", JSON.stringify(json));
    const toolId = json.id as string || "unknown";
    const toolName = json.name as string || "unknown";
    const toolInput = json.input as unknown || null;
    const uiMsg = UIMessageHelpers.toolUse(randomUUID(), toolId, toolName, toolInput);
    this.sessionStore.appendUIMessage(agentId, sessionId, uiMsg).catch(() => {});
  }

  /**
   * Handle tool result
   */
  private handleToolResult(json: Record<string, unknown>, sessionId: string, agentId: string): void {
    this.eventService.executionLog(sessionId, "tool_result", JSON.stringify(json));
    const toolUseId = json.tool_use_id as string || "unknown";
    const output = json.content as string || "";
    const isError = json.is_error as boolean || false;
    const uiMsg = UIMessageHelpers.toolResult(randomUUID(), toolUseId, output, isError);
    this.sessionStore.appendUIMessage(agentId, sessionId, uiMsg).catch(() => {});
  }

  /**
   * Handle result
   */
  private handleResult(json: Record<string, unknown>, sessionId: string, agentId: string): void {
    const content = json.result as string;
    if (content) {
      this.eventService.sessionMessage(sessionId, content, "assistant");
      const uiMsg = UIMessageHelpers.text(randomUUID(), content);
      this.sessionStore.appendUIMessage(agentId, sessionId, uiMsg).catch(() => {});
    }
  }

  /**
   * Handle error
   */
  private handleError(json: Record<string, unknown>, sessionId: string, agentId: string): void {
    const message = json.message as string;
    if (message) {
      this.eventService.error(message, sessionId);
      const uiMsg = UIMessageHelpers.error(randomUUID(), message);
      this.sessionStore.appendUIMessage(agentId, sessionId, uiMsg).catch(() => {});
    }
  }

  /**
   * Spawn a follow-up session
   */
  async spawnFollowUp(
    sessionId: string,
    executor: StandardCodingAgentExecutor,
    agentId: string,
    agentType: string,
    workdir: string,
    prompt: string,
    existingSessionId: string,
    env: ExecutionEnv
  ): Promise<SpawnedChild> {
    // Spawn follow-up
    const child = await executor.spawnFollowUp(workdir, prompt, existingSessionId, undefined, env);

    // Track the process
    const state: ProcessState = {
      sessionId,
      agentType,
      workdir,
      pid: child.child.pid,
      status: "running",
    };

    this.processes.set(sessionId, state);

    // Broadcast event
    this.eventService.agentSpawned(agentType, sessionId);

    return child;
  }

  /**
   * Mark a process as completed
   */
  markCompleted(sessionId: string, success: boolean): void {
    const state = this.processes.get(sessionId);
    if (state) {
      state.status = success ? "completed" : "failed";
      this.processes.set(sessionId, state);
      this.eventService.agentCompleted(state.agentType, sessionId, success);
    }
  }

  /**
   * Mark a process as cancelled
   */
  markCancelled(sessionId: string): void {
    const state = this.processes.get(sessionId);
    if (state) {
      state.status = "cancelled";
      this.processes.set(sessionId, state);
      this.eventService.agentCompleted(state.agentType, sessionId, false);
    }
  }

  /**
   * Get all running processes
   */
  runningProcesses(): ProcessState[] {
    return Array.from(this.processes.values()).filter((s) => s.status === "running");
  }

  /**
   * Get process state by session ID
   */
  getProcess(sessionId: string): ProcessState | undefined {
    return this.processes.get(sessionId);
  }

  /**
   * Kill all running processes (cleanup on shutdown)
   */
  killAllRunningProcesses(): void {
    for (const [sessionId, state] of this.processes) {
      if (state.status === "running") {
        state.status = "cancelled";
        this.processes.set(sessionId, state);
        log.info({ sessionId }, "Marking process as cancelled");
      }
    }
  }
}
