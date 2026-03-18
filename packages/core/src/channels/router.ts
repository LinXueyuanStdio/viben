/**
 * Channel message router
 *
 * Routes incoming messages from external platforms (Telegram, Discord, etc.)
 * to bound agents or executors based on channel configuration.
 *
 * Message flow:
 * 1. External platform message arrives via ChannelMessageReceived event
 * 2. Router looks up channel binding from ChannelManager
 * 3. Sends notifications based on notification_mode (in_app, system, both)
 * 4. Routes to bound agent/executor if configured
 * 5. Sends response back through the channel (bidirectional communication)
 */

import type { EventService, GatewayEvent, EventListener } from "../services/events";
import type { ContainerService } from "../services/container";
import type { ChannelManager } from "./manager";
import type { Channel, AgentBinding, NotificationMode, ChannelConfig } from "./types";
import type { StandardCodingAgentExecutor } from "../executors/types";
import { createExecutor, isExecutorType, createExecutionEnv } from "../executors";
import { SdkChatProxy, type SSEMessage } from "../executors/chat/sdk-proxy";
import { sendChannelMessage } from "./index";
import { homedir } from "node:os";
import { agentManager, type Agent } from "../agents";
import { logger as globalLogger } from "../telemetry";

// Module-level logger
const log = globalLogger.child({ module: "channel-router" });

/**
 * Channel router errors
 */
export class RouterError extends Error {
  constructor(
    message: string,
    public code: RouterErrorCode
  ) {
    super(message);
    this.name = "RouterError";
  }

  static channelNotFound(id: string): RouterError {
    return new RouterError(`Channel not found: ${id}`, "CHANNEL_NOT_FOUND");
  }

  static agentExecutionError(message: string): RouterError {
    return new RouterError(`Agent execution error: ${message}`, "AGENT_EXECUTION_ERROR");
  }

  static executorError(message: string): RouterError {
    return new RouterError(`Executor error: ${message}`, "EXECUTOR_ERROR");
  }

  static alreadyStarted(): RouterError {
    return new RouterError("Router already started", "ALREADY_STARTED");
  }

  static invalidConfig(message: string): RouterError {
    return new RouterError(`Invalid configuration: ${message}`, "INVALID_CONFIG");
  }
}

export type RouterErrorCode =
  | "CHANNEL_NOT_FOUND"
  | "AGENT_EXECUTION_ERROR"
  | "EXECUTOR_ERROR"
  | "ALREADY_STARTED"
  | "INVALID_CONFIG";

/**
 * Incoming message from external channel
 */
export interface IncomingMessage {
  channelType: string;
  channelName: string;
  chatId: string;
  senderName?: string;
  message: string;
  timestamp: number;
}

/**
 * Response message to send back through channel
 */
export interface OutgoingMessage {
  channelId: string;
  chatId: string;
  message: string;
}

/**
 * Channel router configuration
 */
export interface ChannelRouterConfig {
  /** Event service for subscribing to events */
  events: EventService;
  /** Channel manager for looking up channels */
  channels: ChannelManager;
  /** Container service for spawning agents (optional) */
  container?: ContainerService;
  /** Response timeout in milliseconds (default: 60000) */
  responseTimeout?: number;
}

/**
 * Channel message router
 *
 * Subscribes to ChannelMessageReceived events and routes messages
 * to bound agents/executors, then sends responses back.
 */
export class ChannelRouter {
  private events: EventService;
  private channels: ChannelManager;
  private container?: ContainerService;
  private responseTimeout: number;
  private unsubscribe?: () => void;
  private running = false;

  constructor(config: ChannelRouterConfig) {
    this.events = config.events;
    this.channels = config.channels;
    this.container = config.container;
    this.responseTimeout = config.responseTimeout ?? 60000;
  }

  /**
   * Set container service after creation
   */
  setContainer(container: ContainerService): void {
    this.container = container;
  }

  /**
   * Start the router (subscribe to events and process messages)
   */
  async start(): Promise<void> {
    if (this.running) {
      throw RouterError.alreadyStarted();
    }

    this.running = true;

    const listener: EventListener = (event: GatewayEvent) => {
      if (event.type === "channel_message_received") {
        const data = event.data as {
          channel_type: string;
          channel_name: string;
          chat_id: string;
          sender_name?: string;
          message: string;
          timestamp: number;
        };

        const msg: IncomingMessage = {
          channelType: data.channel_type,
          channelName: data.channel_name,
          chatId: data.chat_id,
          senderName: data.sender_name,
          message: data.message,
          timestamp: data.timestamp,
        };

        // Handle message asynchronously
        this.handleMessage(msg).catch((err) => {
          log.error({ err }, "Error handling message");
        });
      }
    };

    this.unsubscribe = this.events.subscribe(listener);

    log.info("Started, listening for channel messages...");
  }

  /**
   * Stop the router
   */
  stop(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = undefined;
    }
    this.running = false;
    log.info("Stopped");
  }

  /**
   * Check if router is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Handle an incoming message
   */
  private async handleMessage(msg: IncomingMessage): Promise<void> {
    const msgPreview = msg.message.length > 50
      ? `${msg.message.slice(0, 50)}...`
      : msg.message;

    log.info({
      channelName: msg.channelName,
      channelType: msg.channelType,
      chatId: msg.chatId,
      messagePreview: msgPreview,
    }, "Received message");

    // Find channel by name or type
    const channel = await this.findChannel(msg.channelName, msg.channelType);

    if (channel) {
      // Send notifications based on notification_mode
      await this.sendNotifications(channel, msg);

      // Route to bound agent/executor if configured
      if (channel.agent_binding) {
        const response = await this.routeAndExecute(channel, channel.agent_binding, msg);

        // Send response back through channel
        if (response) {
          await this.sendResponse(channel, msg.chatId, response);
        }
      } else {
        log.debug({ channelName: channel.name }, "Channel has no agent binding, skipping routing");
      }
    } else {
      log.warn({
        channelName: msg.channelName,
        channelType: msg.channelType,
      }, "No channel found for message");
    }
  }

  /**
   * Find channel by name or channel type
   */
  private async findChannel(name: string, channelType: string): Promise<Channel | undefined> {
    await this.channels.load();
    const allChannels = await this.channels.listChannels();

    // First try to find by exact name match
    const byName = allChannels.find((c) => c.name === name);
    if (byName) {
      return byName;
    }

    // Then try to find by channel type (if only one of that type exists)
    const typeMatches = allChannels.filter((c) => c.type === channelType);
    if (typeMatches.length === 1) {
      return typeMatches[0];
    }

    return undefined;
  }

  /**
   * Send notifications based on channel notification_mode
   */
  private async sendNotifications(channel: Channel, msg: IncomingMessage): Promise<void> {
    const mode = channel.notification_mode || "none";

    switch (mode) {
      case "none":
        log.debug({ channelName: channel.name }, "Notifications disabled for channel");
        break;

      case "in_app":
        this.sendInAppNotification(channel, msg);
        break;

      case "system":
        await this.sendSystemNotification(channel, msg);
        break;

      case "both":
        this.sendInAppNotification(channel, msg);
        await this.sendSystemNotification(channel, msg);
        break;
    }
  }

  /**
   * Send in-app notification via event broadcast
   */
  private sendInAppNotification(channel: Channel, msg: IncomingMessage): void {
    log.debug({ channelName: channel.name }, "Sending in-app notification");

    // Broadcast notification event for frontend
    this.events.broadcast({
      type: "channel_message_received",
      data: {
        channel_type: msg.channelType,
        channel_name: msg.channelName,
        chat_id: msg.chatId,
        sender_name: msg.senderName,
        message: msg.message,
        timestamp: msg.timestamp,
      },
    });
  }

  /**
   * Send system notification (OS-level)
   */
  private async sendSystemNotification(channel: Channel, msg: IncomingMessage): Promise<void> {
    const msgPreview = msg.message.length > 100
      ? `${msg.message.slice(0, 100)}...`
      : msg.message;

    log.debug({
      channelName: channel.name,
      senderName: msg.senderName || "unknown",
      messagePreview: msgPreview,
    }, "Sending system notification");

    // Try to use node-notifier if available
    // Note: node-notifier is an optional dependency
    try {
      // Dynamic import with type assertion
      const notifierModule = await import("node-notifier" as string).catch(() => null);
      if (notifierModule) {
        const title = `${channel.name} (${msg.channelType})`;
        const message = msg.senderName
          ? `${msg.senderName}: ${msgPreview}`
          : msgPreview;

        (notifierModule.default as { notify: (opts: { title: string; message: string; sound: boolean }) => void }).notify({
          title,
          message,
          sound: true,
        });
      } else {
        log.debug("node-notifier not available, skipping system notification");
      }
    } catch (err) {
      log.warn({ err }, "Failed to send system notification");
    }
  }

  /**
   * Route message to bound agent/executor and execute
   */
  private async routeAndExecute(
    channel: Channel,
    binding: AgentBinding,
    msg: IncomingMessage
  ): Promise<string | undefined> {
    log.info({
      bindingType: binding.binding_type,
      bindingName: binding.name,
      bindingId: binding.id,
    }, "Routing message to agent/executor");

    try {
      if (binding.binding_type === "agent") {
        return await this.executeAgent(channel, binding, msg);
      } else {
        return await this.executeExecutor(channel, binding, msg);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      log.error({ err, bindingType: binding.binding_type }, "Error executing agent/executor");
      return `Error: ${errorMsg}`;
    }
  }

  /**
   * Execute an agent with the incoming message using SdkChatProxy
   *
   * This uses the Claude Agent SDK directly for viben agents (not executors).
   * The agent config is loaded from ~/.viben/agents/{agent_id}/AGENTS.md
   */
  private async executeAgent(
    channel: Channel,
    binding: AgentBinding,
    msg: IncomingMessage
  ): Promise<string | undefined> {
    const agentId = binding.id;
    log.info({ agentName: binding.name, agentId }, "Executing agent for channel message");

    // Generate session ID for tracking
    const sessionId = `channel-${channel.id}-${msg.timestamp}`;

    // Broadcast session start event
    this.events.broadcast({
      type: "session_created",
      data: { session_id: sessionId },
    });

    // Determine workspace path
    const workdir = binding.workspace_path || homedir();

    // Try to load agent config from ~/.viben/agents/{agent_id}/
    let agent: Agent | null = null;
    try {
      agent = await agentManager.getAgent(agentId);
      if (agent) {
        log.debug({ agentName: agent.name, model: agent.model }, "Loaded agent config");
      } else {
        log.warn({ agentId }, "Agent not found in ~/.viben/agents/");
      }
    } catch (e) {
      log.warn({ err: e, agentId }, "Could not load agent config");
    }

    // Create SDK proxy for agent execution
    const proxy = new SdkChatProxy();

    try {
      log.info({
        promptPreview: msg.message.slice(0, 100) + (msg.message.length > 100 ? "..." : ""),
        workdir,
        model: agent?.model || "default",
      }, "Starting agent execution...");

      // Execute streaming and collect text responses
      const textParts: string[] = [];
      let hasError = false;
      let errorMessage = "";

      const stream = proxy.executeStreaming({
        prompt: msg.message,
        cwd: workdir,
        sessionId,
        model: agent?.model,
        systemPrompt: agent?.systemPrompt,
        appendPrompt: agent?.appendPrompt,
        dangerouslySkipPermissions: true, // Channel messages don't have interactive approval
      });

      for await (const message of stream) {
        log.debug({ messageType: message.type }, "SSE message received");

        switch (message.type) {
          case "text":
            textParts.push((message as { type: "text"; content: string }).content);
            // Broadcast text event
            this.events.broadcast({
              type: "session_message",
              data: {
                session_id: sessionId,
                content: (message as { type: "text"; content: string }).content,
                role: "assistant",
              },
            });
            break;

          case "tool_use":
            log.debug({ toolName: (message as { name: string }).name }, "Tool use");
            break;

          case "tool_result":
            log.debug({ isError: (message as { isError?: boolean }).isError }, "Tool result");
            break;

          case "error":
            hasError = true;
            errorMessage = (message as { type: "error"; message: string }).message;
            log.error({ errorMessage }, "Agent error");
            break;

          case "result":
            log.info({ subtype: (message as { subtype?: string }).subtype }, "Agent completed");
            break;

          case "question":
            // AskUserQuestion - we can't handle interactive questions in channel mode
            log.warn("Agent asked a question (not supported in channel mode)");
            textParts.push("\n\n(Agent needs interactive input which is not supported in channel mode)");
            break;
        }
      }

      // Broadcast completion event
      this.events.broadcast({
        type: "agent_completed",
        data: {
          agent_id: agentId,
          session_id: sessionId,
          success: !hasError,
        },
      });

      if (hasError) {
        return `Error executing agent: ${errorMessage}`;
      }

      const response = textParts.join("");
      log.info({ responseLength: response.length }, "Agent response");

      return response || `Agent '${binding.name}' completed but produced no output.`;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      log.error({ err, errorMsg }, "Failed to execute agent");

      this.events.broadcast({
        type: "error",
        data: {
          message: `Failed to execute agent: ${errorMsg}`,
          code: sessionId,
        },
      });

      throw RouterError.agentExecutionError(errorMsg);
    }
  }

  /**
   * Execute an executor (e.g., Claude Code) with the incoming message
   */
  private async executeExecutor(
    channel: Channel,
    binding: AgentBinding,
    msg: IncomingMessage
  ): Promise<string | undefined> {
    log.info({ executorName: binding.name }, "Executing executor for channel message");

    // Generate session ID
    const sessionId = `executor-${channel.id}-${msg.timestamp}`;

    // Determine workspace path (required for executors)
    if (!binding.workspace_path) {
      throw RouterError.invalidConfig("Executor binding requires workspace_path");
    }

    const workdir = binding.workspace_path;

    // Check for container service
    if (!this.container) {
      log.warn("No ContainerService available for executor");

      this.events.broadcast({
        type: "execution_log",
        data: {
          session_id: sessionId,
          log_type: "channel_message",
          content: `Received message for executor '${binding.name}': ${msg.message}`,
        },
      });

      return `Message received. Executor '${binding.name}' requires ContainerService.`;
    }

    // Create execution environment
    const env = createExecutionEnv(workdir);

    // Resolve executor
    const executor = this.resolveExecutor(binding.id);

    // Spawn the executor
    try {
      await this.container.spawnAgent(
        sessionId,
        executor,
        binding.id,
        this.getExecutorType(binding.id),
        workdir,
        msg.message,
        env
      );

      log.info({ sessionId }, "Executor spawned successfully");

      // Collect response from streaming events
      const collector = new ResponseCollector(sessionId, this.events);
      const response = await collector.collect(this.responseTimeout / 1000);

      return response || `Processing in workspace '${workdir}' with ${binding.name}...`;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      log.error({ err, errorMsg }, "Failed to spawn executor");

      this.events.broadcast({
        type: "error",
        data: {
          message: `Failed to execute: ${errorMsg}`,
          code: sessionId,
        },
      });

      throw RouterError.executorError(errorMsg);
    }
  }

  /**
   * Resolve executor from binding ID
   */
  private resolveExecutor(executorId: string): StandardCodingAgentExecutor {
    const type = this.getExecutorType(executorId);
    return createExecutor(type);
  }

  /**
   * Get executor type from ID
   */
  private getExecutorType(executorId: string): ReturnType<typeof this.mapToExecutorType> {
    return this.mapToExecutorType(executorId);
  }

  /**
   * Map agent/executor ID to ExecutorType
   */
  private mapToExecutorType(id: string): "CLAUDE_CODE" | "GEMINI" | "CODEX" | "CURSOR_AGENT" | "COPILOT" | "AMP" | "OPENCODE" | "QWEN_CODE" | "DROID" {
    const lowerId = id.toLowerCase();

    const mapping: Record<string, "CLAUDE_CODE" | "GEMINI" | "CODEX" | "CURSOR_AGENT" | "COPILOT" | "AMP" | "OPENCODE" | "QWEN_CODE" | "DROID"> = {
      "claude": "CLAUDE_CODE",
      "claude-code": "CLAUDE_CODE",
      "claudecode": "CLAUDE_CODE",
      "gemini": "GEMINI",
      "codex": "CODEX",
      "openai": "CODEX",
      "cursor": "CURSOR_AGENT",
      "copilot": "COPILOT",
      "github-copilot": "COPILOT",
      "amp": "AMP",
      "opencode": "OPENCODE",
      "qwen": "QWEN_CODE",
      "qwencode": "QWEN_CODE",
      "droid": "DROID",
    };

    const type = mapping[lowerId];
    if (type) {
      return type;
    }

    // Check if it's already a valid executor type (uppercase)
    if (isExecutorType(id)) {
      return id as "CLAUDE_CODE" | "GEMINI" | "CODEX" | "CURSOR_AGENT" | "COPILOT" | "AMP" | "OPENCODE" | "QWEN_CODE" | "DROID";
    }

    // Default to Claude Code
    log.warn({ executorId: id }, "Unknown executor, defaulting to Claude Code");
    return "CLAUDE_CODE";
  }

  /**
   * Send response back through the channel
   */
  private async sendResponse(channel: Channel, chatId: string, message: string): Promise<void> {
    const msgPreview = message.length > 50
      ? `${message.slice(0, 50)}...`
      : message;

    log.info({
      channelName: channel.name,
      chatId,
      messagePreview: msgPreview,
    }, "Sending response to channel");

    // Build channel config for sending
    const config = this.channels.buildChannelConfig(channel.id, {
      type: channel.type,
      name: channel.name,
      enabled: channel.enabled,
      created_at: channel.created_at,
      allow_from: channel.allow_from,
      ...channel.config,
    });

    const result = await sendChannelMessage(config, {
      chatId,
      message,
    });

    if (result.success) {
      log.info({ chatId, channelType: channel.type }, "Response sent successfully");
    } else {
      log.error({ error: result.error || "Unknown error" }, "Failed to send response");
    }
  }
}

/**
 * Response collector for streaming agent responses
 *
 * Subscribes to session events and collects the final response
 * for sending back through the channel.
 */
export class ResponseCollector {
  private sessionId: string;
  private events: EventService;
  private responseParts: string[] = [];

  constructor(sessionId: string, events: EventService) {
    this.sessionId = sessionId;
    this.events = events;
  }

  /**
   * Collect response from streaming events
   *
   * Returns the collected response when the session completes
   */
  async collect(timeoutSecs: number): Promise<string | undefined> {
    return new Promise<string | undefined>((resolve) => {
      const timeout = setTimeout(() => {
        unsubscribe();
        resolve(this.responseParts.join("") || undefined);
      }, timeoutSecs * 1000);

      const unsubscribe = this.events.subscribe((event: GatewayEvent) => {
        if (event.type === "session_message") {
          const data = event.data as { session_id: string; content: string; role: string };
          if (data.session_id === this.sessionId && data.role === "assistant") {
            this.responseParts.push(data.content);
          }
        } else if (event.type === "agent_completed") {
          const data = event.data as { session_id: string; success: boolean };
          if (data.session_id === this.sessionId) {
            clearTimeout(timeout);
            unsubscribe();

            if (data.success && this.responseParts.length > 0) {
              resolve(this.responseParts.join(""));
            } else {
              resolve(undefined);
            }
          }
        } else if (event.type === "error") {
          const data = event.data as { message: string; code?: string };
          if (data.code === this.sessionId) {
            clearTimeout(timeout);
            unsubscribe();
            resolve(`Error: ${data.message}`);
          }
        }
      });
    });
  }
}

/**
 * Create a channel router with the given configuration
 */
export function createChannelRouter(config: ChannelRouterConfig): ChannelRouter {
  return new ChannelRouter(config);
}
