/**
 * Agent Orchestrator for Group Chat
 *
 * Handles parallel invocation of agents in group chat sessions.
 * Each agent receives the user message prepended with other agents' previous responses.
 *
 * Event-driven architecture for real-time WebSocket streaming.
 */
import EventEmitter from "events";
import type { GroupChatService } from "./service";
import type {
  MemberConfig,
  AgentResponse,
  AgentRolloutMessage,
  GroupChatUIMessage,
} from "./types";
import { agentManager } from "../agents";
import type { Agent } from "../types";
import {
  createChatProxyAsync,
  executorSupportsChat,
  type ChatProxy,
  type ChatOptions,
  type ExecutorType,
} from "../executors";
import { SdkChatProxy, type SSEMessage } from "../executors/chat/sdk-proxy";

// ============================================================================
// Types
// ============================================================================

/**
 * Orchestrator event types
 */
export type OrchestratorEventType =
  | "thinking"
  | "progress"
  | "response"
  | "error"
  | "complete";

/**
 * Base orchestrator event
 */
export interface OrchestratorEventBase {
  type: OrchestratorEventType;
  agentId: string;
  agentName: string;
  timestamp: string;
}

/**
 * Agent thinking event - agent started processing
 */
export interface ThinkingEvent extends OrchestratorEventBase {
  type: "thinking";
}

/**
 * Agent progress event - streaming content delta
 */
export interface ProgressEvent extends OrchestratorEventBase {
  type: "progress";
  delta: string;
}

/**
 * Agent response event - agent completed with response
 */
export interface ResponseEvent extends OrchestratorEventBase {
  type: "response";
  content: string;
  /** Duration in milliseconds */
  duration?: number;
}

/**
 * Agent error event - agent failed
 */
export interface ErrorEvent extends OrchestratorEventBase {
  type: "error";
  error: string;
}

/**
 * Orchestration complete event - all agents finished
 */
export interface CompleteEvent {
  type: "complete";
  timestamp: string;
  /** Number of successful responses */
  successCount: number;
  /** Number of failed responses */
  errorCount: number;
  /** Total duration in milliseconds */
  duration: number;
}

/**
 * Union type for all orchestrator events
 */
export type OrchestratorEvent =
  | ThinkingEvent
  | ProgressEvent
  | ResponseEvent
  | ErrorEvent
  | CompleteEvent;

/**
 * Orchestrator configuration
 */
export interface OrchestratorConfig {
  /** Timeout for agent execution in milliseconds (default: 60000 = 60s) */
  timeoutMs: number;
  /** Maximum concurrent agent executions (default: 10) */
  maxConcurrent: number;
  /** Whether to continue on agent errors (default: true) */
  continueOnError: boolean;
}

/**
 * Default orchestrator configuration
 */
export const DEFAULT_ORCHESTRATOR_CONFIG: OrchestratorConfig = {
  timeoutMs: 60000,
  maxConcurrent: 10,
  continueOnError: true,
};

// ============================================================================
// Agent Orchestrator
// ============================================================================

/**
 * AgentOrchestrator - Manages parallel agent execution in group chats
 *
 * Features:
 * - Parallel agent execution with timeout
 * - Event-driven architecture for real-time streaming
 * - Context building (prepends other agents' responses)
 * - Error handling with graceful degradation
 *
 * Usage:
 * ```typescript
 * const orchestrator = new AgentOrchestrator(service, groupChatId, sessionId);
 *
 * // Subscribe to events
 * orchestrator.on("thinking", (event) => console.log(`${event.agentName} is thinking...`));
 * orchestrator.on("response", (event) => console.log(`${event.agentName}: ${event.content}`));
 *
 * // Execute with async generator for streaming
 * for await (const event of orchestrator.execute(userMessage, agentIds)) {
 *   handleEvent(event);
 * }
 * ```
 */
export class AgentOrchestrator extends EventEmitter {
  private config: OrchestratorConfig;

  constructor(
    private readonly service: GroupChatService,
    private readonly groupChatId: string,
    private readonly sessionId: string,
    config?: Partial<OrchestratorConfig>
  ) {
    super();
    this.config = { ...DEFAULT_ORCHESTRATOR_CONFIG, ...config };
  }

  /**
   * Execute agents in parallel, yielding events as they occur
   *
   * @param userMessage - The user message to process
   * @param senderName - The sender's display name (for context building)
   * @param agentMembers - Optional list of agent members to execute (default: all agent members)
   * @param options - Optional execution options
   */
  async *execute(
    userMessage: string,
    senderName: string,
    agentMembers?: MemberConfig[],
    options?: { timeout?: number }
  ): AsyncGenerator<OrchestratorEvent, void, unknown> {
    const startTime = Date.now();
    const timeout = options?.timeout ?? this.config.timeoutMs;

    // Get agent members if not provided
    let agents = agentMembers;
    if (!agents) {
      const members = await this.service.getMembers(this.groupChatId);
      agents = members.filter((m) => m.type === "agent");
    }

    if (agents.length === 0) {
      // No agents to execute
      yield {
        type: "complete",
        timestamp: new Date().toISOString(),
        successCount: 0,
        errorCount: 0,
        duration: Date.now() - startTime,
      };
      return;
    }

    // Create execution promises for each agent
    const executions: Array<{
      agentId: string;
      agentName: string;
      promise: Promise<{ success: boolean; content?: string; error?: string }>;
    }> = [];

    // Create an event queue for collecting events from parallel executions
    const eventQueue: OrchestratorEvent[] = [];
    let eventResolve: (() => void) | null = null;

    const pushEvent = (event: OrchestratorEvent) => {
      eventQueue.push(event);
      this.emit(event.type, event);
      if (eventResolve) {
        eventResolve();
        eventResolve = null;
      }
    };

    const waitForEvent = () =>
      new Promise<void>((resolve) => {
        if (eventQueue.length > 0) {
          resolve();
        } else {
          eventResolve = resolve;
        }
      });

    // Start all agent executions in parallel
    for (const agent of agents) {
      const execution = this.executeAgent(
        agent.refId,
        agent.displayName,
        userMessage,
        senderName,
        timeout,
        pushEvent
      );
      executions.push({
        agentId: agent.refId,
        agentName: agent.displayName,
        promise: execution,
      });
    }

    // Track completion
    let completedCount = 0;
    let successCount = 0;
    let errorCount = 0;
    const totalCount = executions.length;

    // Create completion promises
    const completionPromises = executions.map(async (exec) => {
      try {
        const result = await exec.promise;
        if (result.success) {
          successCount++;
        } else {
          errorCount++;
        }
      } catch {
        errorCount++;
      }
      completedCount++;
    });

    // Wait for all to complete in background
    const allComplete = Promise.all(completionPromises);

    // Yield events as they come
    while (completedCount < totalCount || eventQueue.length > 0) {
      if (eventQueue.length > 0) {
        yield eventQueue.shift()!;
      } else {
        // Wait for next event or completion
        await Promise.race([waitForEvent(), allComplete]);
      }
    }

    // Drain remaining events
    while (eventQueue.length > 0) {
      yield eventQueue.shift()!;
    }

    // Yield completion event
    yield {
      type: "complete",
      timestamp: new Date().toISOString(),
      successCount,
      errorCount,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Execute a single agent with event reporting
   */
  private async executeAgent(
    agentId: string,
    agentName: string,
    userMessage: string,
    senderName: string,
    timeout: number,
    pushEvent: (event: OrchestratorEvent) => void
  ): Promise<{ success: boolean; content?: string; error?: string }> {
    const startTime = Date.now();
    const timestamp = () => new Date().toISOString();

    // Emit thinking event
    pushEvent({
      type: "thinking",
      agentId,
      agentName,
      timestamp: timestamp(),
    });

    // Record thinking message to UI
    const thinkingMessage: GroupChatUIMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      senderId: agentId,
      senderType: "agent",
      senderName: agentName,
      type: "thinking",
      timestamp: timestamp(),
    };
    await this.service.appendMessage(this.groupChatId, this.sessionId, thinkingMessage).catch(() => {
      // Ignore errors
    });

    try {
      // Build context for this agent (prepend other agents' responses)
      const contextMessage = await this.service.buildMessageForAgent(
        this.groupChatId,
        this.sessionId,
        agentId,
        userMessage,
        senderName
      );

      // Record user message in agent rollout
      const userRollout: AgentRolloutMessage = {
        timestamp: timestamp(),
        role: "user",
        content: contextMessage,
        name: senderName,
      };
      await this.service.appendAgentRolloutMessage(
        this.groupChatId,
        this.sessionId,
        agentId,
        userRollout
      );

      // Execute the agent with timeout
      const result = await this.executeWithTimeout(
        agentId,
        agentName,
        contextMessage,
        timeout,
        pushEvent
      );

      if (result.error) {
        pushEvent({
          type: "error",
          agentId,
          agentName,
          error: result.error,
          timestamp: timestamp(),
        });

        // Record error in UI
        const errorMessage: GroupChatUIMessage = {
          id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          senderId: agentId,
          senderType: "agent",
          senderName: agentName,
          type: "error",
          content: result.error,
          timestamp: timestamp(),
        };
        await this.service.appendMessage(this.groupChatId, this.sessionId, errorMessage).catch(() => {});

        return { success: false, error: result.error };
      }

      const content = result.content || "";
      const duration = Date.now() - startTime;

      // Record assistant response in agent rollout
      const assistantRollout: AgentRolloutMessage = {
        timestamp: timestamp(),
        role: "assistant",
        content,
      };
      await this.service.appendAgentRolloutMessage(
        this.groupChatId,
        this.sessionId,
        agentId,
        assistantRollout
      );

      // Add response to responses.jsonl for next round context
      const agentResponse: AgentResponse = {
        id: `resp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        agentId,
        agentName,
        sessionId: this.sessionId,
        content,
        status: "completed",
        startedAt: new Date(startTime).toISOString(),
        completedAt: timestamp(),
        durationMs: duration,
      };
      await this.service.addAgentResponse(this.groupChatId, this.sessionId, agentResponse);

      // Record response in UI messages
      const responseMessage: GroupChatUIMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        senderId: agentId,
        senderType: "agent",
        senderName: agentName,
        type: "text",
        content,
        timestamp: timestamp(),
      };
      await this.service.appendMessage(this.groupChatId, this.sessionId, responseMessage);

      // Emit response event
      pushEvent({
        type: "response",
        agentId,
        agentName,
        content,
        duration,
        timestamp: timestamp(),
      });

      return { success: true, content };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      pushEvent({
        type: "error",
        agentId,
        agentName,
        error,
        timestamp: timestamp(),
      });
      return { success: false, error };
    }
  }

  /**
   * Execute agent with timeout
   */
  private async executeWithTimeout(
    agentId: string,
    agentName: string,
    message: string,
    timeout: number,
    pushEvent: (event: OrchestratorEvent) => void
  ): Promise<{ content?: string; error?: string }> {
    // Create timeout promise
    const timeoutPromise = new Promise<{ error: string }>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Agent ${agentId} timed out after ${timeout}ms`));
      }, timeout);
    });

    // Execute agent
    const executePromise = this.invokeAgent(agentId, agentName, message, pushEvent);

    // Race between execution and timeout
    try {
      return await Promise.race([executePromise, timeoutPromise]);
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * Invoke an agent to process a message
   *
   * This method:
   * 1. Looks up the agent configuration from agentManager
   * 2. Creates the appropriate chat proxy based on executor type
   * 3. Executes the agent and collects the response
   * 4. Falls back to mock response if agent is not configured
   */
  private async invokeAgent(
    agentId: string,
    agentName: string,
    message: string,
    pushEvent: (event: OrchestratorEvent) => void
  ): Promise<{ content?: string; error?: string }> {
    // Try to get the Viben agent configuration
    let agent: Agent | null = null;
    try {
      agent = await agentManager.getAgent(agentId);
    } catch {
      // Agent not found in manager
    }

    if (!agent) {
      // No configured agent found, use a mock/default response
      return {
        content: `I received your message: "${truncateMessage(message, 100)}". (Note: Agent ${agentName} is not fully configured)`,
      };
    }

    // Get executor type
    const executorType = agent.executorType || "CLAUDE_CODE";

    // Check if executor supports chat
    if (!executorSupportsChat(executorType)) {
      return {
        content: `I received your message: "${truncateMessage(message, 100)}". (Note: Executor ${executorType} does not support chat mode)`,
      };
    }

    try {
      // Create chat proxy based on executor type
      const proxy = await createChatProxyAsync(executorType);

      // Build chat options
      const chatOptions: ChatOptions = {
        prompt: message,
        model: agent.model,
        systemPrompt: agent.systemPrompt,
        appendPrompt: agent.appendPrompt,
        dangerouslySkipPermissions: true, // Server-side execution
      };

      // For SDK-based proxies, use streaming
      if (proxy instanceof SdkChatProxy) {
        return await this.executeWithSdkStreaming(
          proxy,
          chatOptions,
          agentId,
          agentName,
          pushEvent
        );
      }

      // For spawn-based proxies, execute without streaming
      const result = await proxy.execute(chatOptions);

      if (result.exitCode !== 0) {
        return { error: result.error || `Agent exited with code ${result.exitCode}` };
      }

      // Spawn proxy doesn't capture output, return a placeholder
      return { content: "Agent completed successfully." };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * Execute using SDK proxy with streaming support
   */
  private async executeWithSdkStreaming(
    proxy: SdkChatProxy,
    options: ChatOptions,
    agentId: string,
    agentName: string,
    pushEvent: (event: OrchestratorEvent) => void
  ): Promise<{ content?: string; error?: string }> {
    const contentParts: string[] = [];

    try {
      for await (const sseMessage of proxy.executeStreaming(options)) {
        switch (sseMessage.type) {
          case "text":
            // Stream progress
            pushEvent({
              type: "progress",
              agentId,
              agentName,
              delta: sseMessage.content,
              timestamp: new Date().toISOString(),
            });
            contentParts.push(sseMessage.content);
            break;

          case "error":
            return { error: sseMessage.message };

          case "result":
            if (sseMessage.subtype === "error") {
              return { error: "Agent execution failed" };
            }
            break;
        }
      }

      const content = contentParts.join("");
      if (!content) {
        return { content: "Agent completed but produced no output." };
      }

      return { content };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * Get the group chat ID
   */
  getGroupChatId(): string {
    return this.groupChatId;
  }

  /**
   * Get the session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Get the configuration
   */
  getConfig(): OrchestratorConfig {
    return { ...this.config };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build a message to send to a specific agent
 *
 * Prepends other agents' responses to the user message:
 * ```text
 * [Agent A]: Previous response from Agent A...
 *
 * [Agent B]: Previous response from Agent B...
 *
 * [User]: Current user message
 * ```
 */
export function buildMessageForAgent(
  targetAgentId: string,
  userMessage: string,
  senderName: string,
  responses: AgentResponse[]
): string {
  // Filter out the target agent's own responses
  const otherResponses = responses.filter((r) => r.agentId !== targetAgentId);

  if (otherResponses.length === 0) {
    // First round or no other agent responses
    return userMessage;
  } else {
    // Prepend other agents' responses
    const parts: string[] = [];
    for (const resp of otherResponses) {
      parts.push(`[${resp.agentName}]: ${resp.content}`);
    }
    parts.push(`[${senderName}]: ${userMessage}`);
    return parts.join("\n\n");
  }
}

/**
 * Truncate a message for display
 */
function truncateMessage(msg: string, maxLen: number): string {
  if (msg.length <= maxLen) {
    return msg;
  }
  return `${msg.slice(0, maxLen)}...`;
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create an AgentOrchestrator instance
 */
export function createOrchestrator(
  service: GroupChatService,
  groupChatId: string,
  sessionId: string,
  config?: Partial<OrchestratorConfig>
): AgentOrchestrator {
  return new AgentOrchestrator(service, groupChatId, sessionId, config);
}
