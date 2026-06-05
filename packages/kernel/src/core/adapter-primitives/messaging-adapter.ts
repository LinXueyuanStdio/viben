import type {
  IChannelAdapter,
  ChannelConfig,
  AdapterCapabilities,
} from "../channel.js";
import type {
  OutgoingMessage,
  PermissionRequest,
  NotificationMessage,
} from "../types.js";
import type { DisplayVerbosity, ToolCallMeta } from "./format-types.js";
import type { IRenderer } from "./rendering/renderer.js";
import { evaluateNoise } from "./message-formatter.js";

/** Runtime services available to adapters via dependency injection. */
export interface AdapterContext {
  configManager: { get(): Record<string, unknown> };
  fileService?: unknown;
}

/** Configuration for adapters that extend MessagingAdapter. */
export interface MessagingAdapterConfig extends ChannelConfig {
  /** Platform-imposed limit on a single message body (e.g., 4096 for Telegram). */
  maxMessageLength: number;
  /** How often (ms) to flush buffered streaming text to the platform. */
  flushInterval?: number;
  /** Minimum interval (ms) between consecutive send-queue operations. */
  sendInterval?: number;
  /** How often (ms) to refresh the typing indicator during agent thinking. */
  thinkingRefreshInterval?: number;
  /** Max duration (ms) to show the typing indicator before auto-dismissing. */
  thinkingDuration?: number;
  /** Default output verbosity for this adapter (can be overridden per-session). */
  displayVerbosity?: DisplayVerbosity;
}

/** Represents a message that was successfully sent to the platform. */
export interface SentMessage {
  messageId: string;
}

/** Message types that are hidden entirely at "low" verbosity. */
const HIDDEN_ON_LOW = new Set(["thought", "usage"]);

/**
 * Abstract base class for platform-specific messaging adapters (Telegram, Slack, etc.).
 *
 * Provides a dispatch pipeline: incoming OutgoingMessage -> verbosity filter -> type-based
 * handler. Subclasses override the `handle*` methods to implement platform-specific rendering
 * and delivery. The base implementations are no-ops, so subclasses only override what they need.
 */
export abstract class MessagingAdapter implements IChannelAdapter {
  abstract readonly name: string;
  /** Platform-specific renderer that converts OutgoingMessage to formatted output. */
  abstract readonly renderer: IRenderer;
  /**
   * Declares what this adapter can do. The platform-specific subclass sets these flags,
   * and core/stream-adapter use them to decide how to route and format output — e.g.,
   * whether to stream text in-place (streaming), send to threads/topics (threads),
   * render markdown (richFormatting), upload files (fileUpload), or play audio (voice).
   */
  abstract readonly capabilities: AdapterCapabilities;

  constructor(
    protected context: AdapterContext,
    protected adapterConfig: MessagingAdapterConfig,
  ) {}

  // === Message dispatch flow ===

  /**
   * Entry point for all outbound messages from sessions to the platform.
   * Resolves the current verbosity, filters messages that should be hidden,
   * then dispatches to the appropriate type-specific handler.
   */
  async sendMessage(
    sessionId: string,
    content: OutgoingMessage,
  ): Promise<void> {
    const verbosity = this.getVerbosity();
    if (!this.shouldDisplay(content, verbosity)) return;
    await this.dispatchMessage(sessionId, content, verbosity);
  }

  /**
   * Routes a message to its type-specific handler.
   * Subclasses can override this for custom dispatch logic, but typically
   * override individual handle* methods instead.
   */
  protected async dispatchMessage(
    sessionId: string,
    content: OutgoingMessage,
    verbosity: DisplayVerbosity,
  ): Promise<void> {
    switch (content.type) {
      case "text":
        return this.handleText(sessionId, content);
      case "thought":
        return this.handleThought(sessionId, content, verbosity);
      case "tool_call":
        return this.handleToolCall(sessionId, content, verbosity);
      case "tool_update":
        return this.handleToolUpdate(sessionId, content, verbosity);
      case "plan":
        return this.handlePlan(sessionId, content, verbosity);
      case "usage":
        return this.handleUsage(sessionId, content, verbosity);
      case "error":
        return this.handleError(sessionId, content);
      case "attachment":
        return this.handleAttachment(sessionId, content);
      case "system_message":
        return this.handleSystem(sessionId, content);
      case "session_end":
        return this.handleSessionEnd(sessionId, content);
      case "mode_change":
        return this.handleModeChange(sessionId, content);
      case "config_update":
        return this.handleConfigUpdate(sessionId, content);
      case "model_update":
        return this.handleModelUpdate(sessionId, content);
      case "user_replay":
        return this.handleUserReplay(sessionId, content);
      case "resource":
        return this.handleResource(sessionId, content);
      case "resource_link":
        return this.handleResourceLink(sessionId, content);
    }
  }

  // === Default handlers — all protected, all overridable ===
  // Each handler is a no-op by default. Subclasses override only the message
  // types they support (e.g., Telegram overrides handleText, handleToolCall, etc.).

  protected async handleText(
    _sessionId: string,
    _content: OutgoingMessage,
  ): Promise<void> {}
  protected async handleThought(
    _sessionId: string,
    _content: OutgoingMessage,
    _verbosity: DisplayVerbosity,
  ): Promise<void> {}
  protected async handleToolCall(
    _sessionId: string,
    _content: OutgoingMessage,
    _verbosity: DisplayVerbosity,
  ): Promise<void> {}
  protected async handleToolUpdate(
    _sessionId: string,
    _content: OutgoingMessage,
    _verbosity: DisplayVerbosity,
  ): Promise<void> {}
  protected async handlePlan(
    _sessionId: string,
    _content: OutgoingMessage,
    _verbosity: DisplayVerbosity,
  ): Promise<void> {}
  protected async handleUsage(
    _sessionId: string,
    _content: OutgoingMessage,
    _verbosity: DisplayVerbosity,
  ): Promise<void> {}
  protected async handleError(
    _sessionId: string,
    _content: OutgoingMessage,
  ): Promise<void> {}
  protected async handleAttachment(
    _sessionId: string,
    _content: OutgoingMessage,
  ): Promise<void> {}
  protected async handleSystem(
    _sessionId: string,
    _content: OutgoingMessage,
  ): Promise<void> {}
  protected async handleSessionEnd(
    _sessionId: string,
    _content: OutgoingMessage,
  ): Promise<void> {}
  protected async handleModeChange(
    _sessionId: string,
    _content: OutgoingMessage,
  ): Promise<void> {}
  protected async handleConfigUpdate(
    _sessionId: string,
    _content: OutgoingMessage,
  ): Promise<void> {}
  protected async handleModelUpdate(
    _sessionId: string,
    _content: OutgoingMessage,
  ): Promise<void> {}
  protected async handleUserReplay(
    _sessionId: string,
    _content: OutgoingMessage,
  ): Promise<void> {}
  protected async handleResource(
    _sessionId: string,
    _content: OutgoingMessage,
  ): Promise<void> {}
  protected async handleResourceLink(
    _sessionId: string,
    _content: OutgoingMessage,
  ): Promise<void> {}

  // === Helpers ===

  /**
   * Resolves the current output verbosity by checking (in priority order):
   * per-channel config, global config, then adapter default. Falls back to "medium".
   */
  protected getVerbosity(): DisplayVerbosity {
    const config = this.context.configManager.get();
    const channelConfig = (config as Record<string, unknown>).channels as
      | Record<string, Record<string, unknown>>
      | undefined;
    const ch = channelConfig?.[this.name];
    const v =
      ch?.outputMode ??
      ch?.displayVerbosity ??
      (config as Record<string, unknown>).outputMode ??
      this.adapterConfig.displayVerbosity;
    if (v === "low" || v === "high") return v;
    return "medium";
  }

  /**
   * Determines whether a message should be displayed at the given verbosity.
   *
   * Noise filtering: tool calls matching noise rules (e.g., `ls`, `glob`, `grep`)
   * are hidden at medium/low verbosity to reduce clutter. Thoughts and usage
   * stats are hidden entirely at "low".
   */
  protected shouldDisplay(
    content: OutgoingMessage,
    verbosity: DisplayVerbosity,
  ): boolean {
    if (verbosity === "low" && HIDDEN_ON_LOW.has(content.type)) return false;

    if (content.type === "tool_call") {
      const meta = (content.metadata ?? {}) as Partial<ToolCallMeta>;
      const toolName = meta.name ?? content.text ?? "";
      const toolKind = String(meta.kind ?? "other");
      const noiseAction = evaluateNoise(toolName, toolKind, meta.rawInput);
      if (noiseAction === "hide" && verbosity !== "high") return false;
      if (noiseAction === "collapse" && verbosity === "low") return false;
    }

    return true;
  }

  // === Abstract — adapter MUST implement ===

  /** Initializes the adapter (e.g., connect to platform API, start polling). */
  abstract start(): Promise<void>;
  /** Gracefully shuts down the adapter and releases resources. */
  abstract stop(): Promise<void>;
  /** Creates a platform-specific thread/topic for a session. Returns the thread ID. */
  abstract createSessionThread(
    sessionId: string,
    name: string,
  ): Promise<string>;
  /** Renames an existing session thread/topic on the platform. */
  abstract renameSessionThread(
    sessionId: string,
    newName: string,
  ): Promise<void>;
  /** Sends a permission request to the user with approve/deny actions. */
  abstract sendPermissionRequest(
    sessionId: string,
    request: PermissionRequest,
  ): Promise<void>;
  /** Sends a cross-session notification (e.g., session completed, budget warning). */
  abstract sendNotification(notification: NotificationMessage): Promise<void>;
}
