import type { Session } from "./session.js";
import type { IChannelAdapter } from "../channel.js";
import type { MessageTransformer } from "../message-transformer.js";
import type { NotificationManager } from "../../plugins/notifications/notification.js";
import type { SessionManager } from "./session-manager.js";
import type { AgentEvent, PermissionRequest, SessionStatus } from "../types.js";
import type { EventBus } from "../event-bus.js";
import type { FileServiceInterface } from "../plugin/types.js";
import type { MiddlewareChain } from "../plugin/middleware-chain.js";
import type { DebugTracer } from "../utils/debug-tracer.js";
import { createChildLogger } from "../utils/log.js";
import { isPermissionBypass } from "../utils/bypass-detection.js";
// micromatch is a CJS module — must use default import and destructure
import micromatch from "micromatch";
const { isMatch } = micromatch;
import { isSystemEvent, getEffectiveTarget, extractSender, type TurnContext, type TurnRouting } from "./turn-context.js";
import { Hook, BusEvent, SessionEv } from "../events.js";

const log = createChildLogger({ module: "session-bridge" });

/** Services required by SessionBridge for message transformation, persistence, and middleware. */
export interface BridgeDeps {
  messageTransformer: MessageTransformer;
  notificationManager: NotificationManager;
  sessionManager: SessionManager;
  eventBus?: EventBus;
  fileService?: FileServiceInterface;
  middlewareChain?: MiddlewareChain;
}

/**
 * Connects a Session to a channel adapter, forwarding agent events to the adapter's
 * stream interface and wiring up permission handling, lifecycle persistence, and middleware.
 *
 * Each adapter attached to a session gets its own bridge. The bridge subscribes to
 * Session events (agent_event, permission_request, status_change, etc.) and translates
 * them into adapter-specific calls (sendMessage, sendPermissionRequest, renameSessionThread).
 *
 * Multi-adapter routing: when a TurnContext is active, turn events (text, tool_call, etc.)
 * are forwarded only to the adapter that originated the prompt. System events (commands_update,
 * session_end, etc.) are always broadcast to all bridges.
 */
export class SessionBridge {
  private connected = false;
  private cleanupFns: Array<() => void> = [];
  readonly adapterId: string;

  constructor(
    private session: Session,
    private adapter: IChannelAdapter,
    private deps: BridgeDeps,
    adapterId?: string,
  ) {
    this.adapterId = adapterId ?? adapter.name;
  }

  private get tracer(): DebugTracer | null {
    return this.session.agentInstance.debugTracer ?? null;
  }

  /** Register a listener and track it for cleanup */
  private listen(emitter: any, event: string, handler: (...args: any[]) => void): void {
    emitter.on(event, handler);
    this.cleanupFns.push(() => emitter.off(event, handler));
  }

  /** Send message to adapter, optionally running through message:outgoing middleware */
  private async sendMessage(sessionId: string, message: ReturnType<MessageTransformer["transform"]>): Promise<void> {
    try {
      const mw = this.deps.middlewareChain;
      if (mw) {
        const result = await mw.execute(Hook.MESSAGE_OUTGOING, { sessionId, message }, async (m) => m);
        this.tracer?.log("core", { step: "middleware:outgoing", sessionId, hook: "message:outgoing", blocked: !result });
        if (!result) return;
        this.tracer?.log("core", { step: "dispatch", sessionId, message: result.message });
        this.adapter.sendMessage(sessionId, result.message).catch((err) => {
          log.error({ err, sessionId }, "Failed to send message to adapter");
        });
      } else {
        this.tracer?.log("core", { step: "dispatch", sessionId, message });
        this.adapter.sendMessage(sessionId, message).catch((err) => {
          log.error({ err, sessionId }, "Failed to send message to adapter");
        });
      }
    } catch (err) {
      log.error({ err, sessionId }, "Error in sendMessage middleware");
    }
  }

  /**
   * Determine if this bridge should forward the given event based on turn routing.
   * System events are always forwarded; turn events are routed only to the target adapter.
   */
  shouldForward(event: AgentEvent): boolean {
    // System events → always forward to all bridges
    if (isSystemEvent(event)) return true;

    // No active turn context → forward (backward compat)
    const ctx = this.session.activeTurnContext;
    if (!ctx) return true;

    // Get effective target (null = silent, string = target adapterId)
    const target = getEffectiveTarget(ctx);

    // Silent turn → suppress all turn events
    if (target === null) return false;

    // Turn events → only forward to target adapter
    return this.adapterId === target;
  }

  /**
   * Subscribe to session events and start forwarding them to the adapter.
   *
   * Wires: agent events → adapter dispatch, permission UI, lifecycle persistence
   * (status changes, naming, prompt count), and EventBus notifications.
   * Also replays any commands or config options that arrived before the bridge connected.
   */
  connect(): void {
    if (this.connected) return;
    this.connected = true;

    // Wire session events to adapter (session → adapter dispatch)
    // The agent→session relay is owned by the Session itself (wireAgentRelay),
    // so session.on(SessionEv.AGENT_EVENT) fires for all sessions including headless ones.
    this.listen(this.session, SessionEv.AGENT_EVENT, (event: AgentEvent) => {
      if (this.shouldForward(event)) {
        this.dispatchAgentEvent(event);
      } else {
        // Event is not forwarded to this adapter's channel, but EventBus observers
        // (e.g. /events SSE stream) still need to see it for cross-adapter visibility.
        this.deps.eventBus?.emit(BusEvent.AGENT_EVENT, { sessionId: this.session.id, turnId: '', event });
      }
    });

    // Wire permissions
    // Only register the onPermissionRequest handler for the primary adapter (first bridge to connect).
    // Secondary bridges must not overwrite it — each bridge receives the permission_request session
    // event and sends UI to its own adapter via the listener below.
    if (!this.session.agentInstance.onPermissionRequest ||
        (this.session.agentInstance.onPermissionRequest as any).__bridgeId === undefined) {
      const handler = async (request: PermissionRequest) => {
        return this.resolvePermission(request);
      };
      (handler as any).__bridgeId = this.adapterId;
      this.session.agentInstance.onPermissionRequest = handler;
    }

    // Wire permission UI for secondary bridges — when the primary bridge emits
    // "permission_request" (after setPending), secondary bridges forward it to their adapter.
    // The primary bridge sends its UI directly in resolvePermission (awaited, preserving
    // ordering guarantees). Secondary bridges use this fire-and-forget listener.
    this.listen(this.session, SessionEv.PERMISSION_REQUEST, async (request: PermissionRequest) => {
      // Skip if this is the primary bridge — it handles UI directly in resolvePermission.
      const current = this.session.agentInstance.onPermissionRequest as any;
      if (current?.__bridgeId === this.adapterId) return;
      // Only send UI when the gate is pending (guard against informational-only emits
      // from auto-approve paths).
      if (!this.session.permissionGate.isPending) return;
      try {
        await this.adapter.sendPermissionRequest(this.session.id, request);
      } catch (err) {
        log.error({ err, sessionId: this.session.id, adapterId: this.adapterId }, "Failed to send permission request to adapter");
      }
    });

    // Wire lifecycle: persist status changes and auto-disconnect on terminal states
    this.listen(this.session, SessionEv.STATUS_CHANGE, (from: SessionStatus, to: SessionStatus) => {
      this.deps.sessionManager.patchRecord(this.session.id, {
        status: to,
        lastActiveAt: new Date().toISOString(),
      });
      if (!this.session.isAssistant) {
        this.deps.eventBus?.emit(BusEvent.SESSION_UPDATED, {
          sessionId: this.session.id,
          status: to,
        });
      }

      // Auto-disconnect on terminal states (finished only — cancelled sessions can resume)
      if (to === "finished") {
        // Disconnect on next tick so current event handlers can complete
        queueMicrotask(() => this.disconnect());
      }
    });

    // Wire lifecycle: persist and relay name changes to all adapters.
    this.listen(this.session, SessionEv.NAMED, async (name: string) => {
      await this.deps.sessionManager.patchRecord(this.session.id, { name });
      if (!this.session.isAssistant) {
        this.deps.eventBus?.emit(BusEvent.SESSION_UPDATED, {
          sessionId: this.session.id,
          name,
        });
      }
      await this.adapter.renameSessionThread(this.session.id, name);
    });

    // Wire lifecycle: persist prompt count after each prompt for resume decisions
    this.listen(this.session, SessionEv.PROMPT_COUNT_CHANGED, (count: number) => {
      this.deps.sessionManager.patchRecord(this.session.id, { currentPromptCount: count });
    });

    // Wire turn_started: emit message:processing on EventBus so SSE clients
    // (including other connected App windows) can show the streaming assistant stub.
    this.listen(this.session, SessionEv.TURN_STARTED, (ctx: TurnContext) => {
      this.deps.eventBus?.emit(BusEvent.MESSAGE_PROCESSING, {
        sessionId: this.session.id,
        turnId: ctx.turnId,
        sourceAdapterId: ctx.sourceAdapterId,
        userPrompt: ctx.userPrompt,
        finalPrompt: ctx.finalPrompt,
        attachments: ctx.attachments,
        sender: extractSender(ctx.meta),
        timestamp: new Date().toISOString(),
      });
    });

    // Wire prompt_queued → emit prompt:waiting on EventBus for adapters to show queue notifications.
    // This event fires synchronously from inside PromptQueue.enqueue() when an item is placed
    // behind a running prompt, so sourceAdapterId and queueDepth are accurate (no race condition).
    this.listen(this.session, SessionEv.PROMPT_QUEUED, (data: { turnId: string | undefined; position: number; routing: TurnRouting | undefined }) => {
      this.deps.eventBus?.emit(BusEvent.PROMPT_WAITING, {
        sessionId: this.session.id,
        turnId: data.turnId ?? '',
        sourceAdapterId: data.routing?.sourceAdapterId ?? this.session.channelId,
        queueDepth: data.position,
      });
    });

    // Replay any commands_update that arrived before the bridge connected
    if (this.session.latestCommands !== null) {
      this.session.emit(SessionEv.AGENT_EVENT, { type: "commands_update", commands: this.session.latestCommands });
    }

    // Replay configOptions so the adapter reflects the current agent's options
    if (this.session.configOptions.length > 0) {
      this.session.emit(SessionEv.AGENT_EVENT, { type: "config_option_update", options: this.session.configOptions });
    }
  }

  /** Unsubscribe all session event listeners and clean up adapter state. */
  disconnect(): void {
    if (!this.connected) return;
    this.connected = false;
    this.cleanupFns.forEach(fn => fn());
    this.cleanupFns = [];
    // Only clear onPermissionRequest if this bridge currently owns it.
    // This prevents a disconnecting secondary bridge from killing permission
    // handling for all surviving bridges.
    const current = this.session.agentInstance.onPermissionRequest as any;
    if (current?.__bridgeId === this.adapterId) {
      this.session.agentInstance.onPermissionRequest = async () => "";
    }
    // Clean up transformer caches for this session
    this.deps.messageTransformer.clearSessionCaches?.(this.session.id);
  }

  /** Dispatch an agent event through middleware and to the adapter */
  private async dispatchAgentEvent(event: AgentEvent): Promise<void> {
    this.tracer?.log("core", { step: "agent_event", sessionId: this.session.id, event });
    const mw = this.deps.middlewareChain;
    if (mw) {
      try {
        const result = await mw.execute(Hook.AGENT_BEFORE_EVENT, { sessionId: this.session.id, event }, async (e) => e);
        this.tracer?.log("core", { step: "middleware:before", sessionId: this.session.id, hook: "agent:beforeEvent", blocked: !result });
        if (!result) return; // blocked by middleware
        const transformedEvent = result.event;
        this.handleAgentEvent(transformedEvent);
      } catch {
        // Middleware error — proceed with original event
        try {
          this.handleAgentEvent(event);
        } catch (err) {
          log.error({ err, sessionId: this.session.id }, "Error handling agent event (middleware fallback)");
        }
      }
    } else {
      try {
        this.handleAgentEvent(event);
      } catch (err) {
        log.error({ err, sessionId: this.session.id }, "Error handling agent event");
      }
    }
  }

  private handleAgentEvent(event: AgentEvent): import('../types.js').OutgoingMessage | undefined {
    const session = this.session;
    const ctx = {
      get id() {
        return session.id;
      },
      get workingDirectory() {
        return session.workingDirectory;
      },
    };

    let outgoing: import('../types.js').OutgoingMessage | undefined;

      switch (event.type) {
        case "text":
        case "thought":
        case "tool_call":
        case "tool_update":
        case "plan":
        case "usage":
          outgoing = this.deps.messageTransformer.transform(event, ctx);
          this.tracer?.log("core", { step: "transform", sessionId: this.session.id, input: event, output: outgoing });
          this.sendMessage(this.session.id, outgoing);
          break;

        case "session_end":
          this.session.finish(event.reason);
          this.adapter.cleanupSkillCommands?.(this.session.id);
          outgoing = this.deps.messageTransformer.transform(event);
          this.sendMessage(this.session.id, outgoing);
          this.deps.notificationManager.notify(this.session.channelId, {
            sessionId: this.session.id,
            sessionName: this.session.name,
            type: "completed",
            summary: `Session "${this.session.name || this.session.id}" completed\n⏱ ${Math.round((Date.now() - this.session.createdAt.getTime()) / 60000)} min · 💬 ${this.session.promptCount} prompts`,
          });
          break;

        case "error":
          this.session.fail(event.message);
          this.adapter.cleanupSkillCommands?.(this.session.id);
          outgoing = this.deps.messageTransformer.transform(event);
          this.sendMessage(this.session.id, outgoing);
          this.deps.notificationManager.notify(this.session.channelId, {
            sessionId: this.session.id,
            sessionName: this.session.name,
            type: "error",
            summary: event.message,
          });
          break;

        case "image_content": {
          if (this.deps.fileService) {
            const fs = this.deps.fileService;
            const sid = this.session.id;
            const { data, mimeType } = event;
            const buffer = Buffer.from(data, "base64");
            const ext = fs.extensionFromMime(mimeType);
            fs.saveFile(sid, `agent-image${ext}`, buffer, mimeType)
              .then((att) => {
                this.sendMessage(sid, {
                  type: "attachment",
                  text: "",
                  attachment: att,
                });
              })
              .catch((err) => log.error({ err }, "Failed to save agent image"));
          }
          break;
        }
        case "audio_content": {
          if (this.deps.fileService) {
            const fs = this.deps.fileService;
            const sid = this.session.id;
            const { data, mimeType } = event;
            const buffer = Buffer.from(data, "base64");
            const ext = fs.extensionFromMime(mimeType);
            fs.saveFile(sid, `agent-audio${ext}`, buffer, mimeType)
              .then((att) => {
                this.sendMessage(sid, {
                  type: "attachment",
                  text: "",
                  attachment: att,
                });
              })
              .catch((err) => log.error({ err }, "Failed to save agent audio"));
          }
          break;
        }

        case "commands_update":
          log.debug({ commands: event.commands }, "Commands available");
          this.adapter.sendSkillCommands?.(this.session.id, event.commands);
          break;

        case "system_message":
          outgoing = this.deps.messageTransformer.transform(event);
          this.sendMessage(this.session.id, outgoing);
          break;

        case "session_info_update":
          if (event.title) {
            this.session.setName(event.title);
            outgoing = this.deps.messageTransformer.transform(event);
            this.sendMessage(this.session.id, outgoing);
          }
          // title-less updates (e.g. updatedAt-only) carry no user-visible content
          break;

        case "config_option_update":
          this.session.updateConfigOptions(event.options).then(() => {
            this.persistAcpState();
          }).catch(() => { /* middleware blocked or error — skip persist */ });
          outgoing = this.deps.messageTransformer.transform(event);
          this.sendMessage(this.session.id, outgoing);
          break;

        case "user_message_chunk":
          outgoing = this.deps.messageTransformer.transform(event);
          this.sendMessage(this.session.id, outgoing);
          break;

        case "resource_content":
        case "resource_link":
          outgoing = this.deps.messageTransformer.transform(event);
          this.sendMessage(this.session.id, outgoing);
          break;

        case "tts_strip":
          this.adapter.stripTTSBlock?.(this.session.id);
          break;
      }

      this.deps.eventBus?.emit(BusEvent.AGENT_EVENT, {
        sessionId: this.session.id,
        turnId: this.session.activeTurnContext?.turnId ?? '',
        event,
      });

    return outgoing;
  }

  /** Persist current ACP state (configOptions, agentCapabilities) to session store as cache */
  private persistAcpState(): void {
    this.deps.sessionManager.patchRecord(this.session.id, {
      acpState: this.session.toAcpStateSnapshot(),
    });
  }

  /** Resolve a permission request through the full pipeline: middleware -> auto-approve -> ask user */
  private async resolvePermission(request: PermissionRequest): Promise<string> {
    const startTime = Date.now();
    const mw = this.deps.middlewareChain;

    // Step 1: Middleware
    let permReq = request;
    if (mw) {
      const payload = { sessionId: this.session.id, request, autoResolve: undefined as string | undefined };
      const result = await mw.execute(Hook.PERMISSION_BEFORE_REQUEST, payload, async (r) => r);
      if (!result) return ""; // blocked by middleware
      permReq = result.request;
      // If middleware set autoResolve, skip UI and return directly
      if (result.autoResolve) {
        this.emitAfterResolve(mw, permReq.id, result.autoResolve, 'middleware', startTime);
        return result.autoResolve;
      }
    }

    this.deps.eventBus?.emit(BusEvent.PERMISSION_REQUEST, {
      sessionId: this.session.id,
      permission: permReq,
    });

    // Step 2: Auto-approve
    const autoDecision = this.checkAutoApprove(permReq);
    if (autoDecision) {
      // Emit informational event even on auto-approve (for SSE / monitoring consumers)
      this.session.emit(SessionEv.PERMISSION_REQUEST, permReq);
      this.emitAfterResolve(mw, permReq.id, autoDecision, 'system', startTime);
      return autoDecision;
    }

    // Step 3: Ask user
    // Set pending BEFORE emitting "permission_request" so that secondary bridge listeners
    // can guard on isPending. This also prevents a race where the user resolves before we
    // start waiting.
    const promise = this.session.permissionGate.setPending(permReq);

    // Emit the session event AFTER setPending — secondary bridges listen to this and forward
    // the permission UI to their own adapters (fire-and-forget).
    this.session.emit(SessionEv.PERMISSION_REQUEST, permReq);

    // Send permission UI to this bridge's own adapter (primary bridge path, awaited to
    // preserve the ordering guarantee: setPending → sendPermissionRequest).
    await this.adapter.sendPermissionRequest(this.session.id, permReq);

    // Wait for user response — adapter resolves this promise
    const optionId = await promise;

    // Broadcast permission:resolved so other adapters can dismiss their UI
    this.deps.eventBus?.emit(BusEvent.PERMISSION_RESOLVED, {
      sessionId: this.session.id,
      requestId: permReq.id,
      decision: optionId,
      optionId,
      resolvedBy: this.adapterId,
    });

    this.emitAfterResolve(mw, permReq.id, optionId, 'user', startTime);
    return optionId;
  }

  /** Check if a permission request should be auto-approved (bypass mode only) */
  private checkAutoApprove(request: PermissionRequest): string | null {
    // Bypass mode: auto-approve all permissions (agent-side or client-side)
    const modeOption = this.session.getConfigByCategory("mode");
    const isAgentBypass = modeOption && isPermissionBypass(
      typeof modeOption.currentValue === "string" ? modeOption.currentValue : ""
    );
    const isClientBypass = this.session.clientOverrides.bypassPermissions;
    if (isAgentBypass || isClientBypass) {
      const allowOption = request.options.find((o) => o.isAllow);
      if (allowOption) {
        log.info(
          { sessionId: this.session.id, requestId: request.id, optionId: allowOption.id, agentBypass: !!isAgentBypass, clientBypass: !!isClientBypass },
          "Bypass mode: auto-approving permission",
        );
        return allowOption.id;
      }
    }

    // Plugin-declared auto-approved command patterns (micromatch glob matching).
    // Multi-line shell commands (heredoc bodies, `\`-line continuations) contain
    // real newlines which micromatch globs do not cross — normalize runs of
    // whitespace to a single space so the whole command becomes a single line
    // for matching purposes.
    const patterns = this.session.autoApprovedCommands;
    if (patterns.length > 0 && request.description) {
      const normalized = request.description.replace(/\s+/g, ' ').trim();
      if (isMatch(normalized, patterns, { dot: true })) {
        const allowOption = request.options.find((o) => o.isAllow);
        if (allowOption) {
          log.info(
            { sessionId: this.session.id, requestId: request.id, command: request.description },
            "autoApprovedCommands: auto-approving matching command",
          );
          return allowOption.id;
        }
      }
    }

    return null;
  }

  /** Emit permission:afterResolve middleware hook (fire-and-forget) */
  private emitAfterResolve(mw: MiddlewareChain | undefined, requestId: string, decision: string, userId: string, startTime: number): void {
    if (mw) {
      mw.execute(Hook.PERMISSION_AFTER_RESOLVE, {
        sessionId: this.session.id, requestId, decision, userId, durationMs: Date.now() - startTime,
      }, async (p) => p).catch(() => {});
    }
  }
}
