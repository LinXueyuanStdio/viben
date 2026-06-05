import path from "node:path";
import { nanoid } from "nanoid";
import type { SettingsManager } from "./plugin/settings-manager.js";
import { ConfigManager } from "./config/config.js";
import { AgentManager } from "./agents/agent-manager.js";
import { SessionManager } from "./sessions/session-manager.js";
import { SessionBridge } from "./sessions/session-bridge.js";
import type { NotificationManager } from "../plugins/notifications/notification.js";
import type { IChannelAdapter } from "./channel.js";
import { Session } from "./sessions/session.js";
import { MessageTransformer } from "./message-transformer.js";
import type { FileServiceInterface } from "./plugin/types.js";
import { JsonFileSessionStore, type SessionStore } from "./sessions/session-store.js";
import type { SecurityGuard } from "../plugins/security/security-guard.js";
import { SessionFactory } from "./sessions/session-factory.js";
import type { IncomingMessage, AgentEvent, SessionStatus, TurnMeta, Attachment } from "./types.js";
import type { TunnelService } from "../plugins/tunnel/tunnel-service.js";
import { getAgentCapabilities } from "./agents/agent-registry.js";
import { AgentSwitchHandler } from "./agent-switch-handler.js";
import { AgentCatalog } from "./agents/agent-catalog.js";
import { AgentStore } from "./agents/agent-store.js";
import { EventBus } from "./event-bus.js";
import { LifecycleManager } from "./plugin/lifecycle-manager.js";
import { MenuRegistry } from './menu-registry.js';
import { AssistantRegistry, AssistantManager } from './assistant/index.js';
import { registerCoreMenuItems } from './menu/core-items.js';
import { createSessionsSection, createAgentsSection, createConfigSection, createSystemSection, createRemoteSection } from './assistant/index.js';
import { ServiceRegistry } from "./plugin/service-registry.js";
import { MiddlewareChain } from "./plugin/middleware-chain.js";
import { ErrorTracker } from "./plugin/error-tracker.js";
import { createChildLogger } from "./utils/log.js";
import type { SpeechService } from "../plugins/speech/exports.js";
import type { ContextManager } from "../plugins/context/context-manager.js";
import type { InstanceContext } from "./instance/instance-context.js";
import { Hook, BusEvent, SessionEv } from "./events.js";
import { extractSender, type TurnContext, type TurnRouting } from "./sessions/turn-context.js";
const log = createChildLogger({ module: "core" });

/**
 * Top-level orchestrator that wires all Viben modules together.
 *
 * Responsibilities:
 * - Registers messaging adapters (Telegram, Slack, SSE, etc.)
 * - Routes incoming messages to the correct Session (by channel + thread)
 * - Manages the full session lifecycle: creation, agent switch, archive, shutdown
 * - Connects agent events to adapter callbacks via SessionBridge
 * - Accesses plugin-provided services (security, notifications, speech, etc.)
 *   through ServiceRegistry rather than direct references, since plugins
 *   register their services asynchronously during boot
 */
export class VibenCore {
  configManager: ConfigManager;
  agentCatalog: AgentCatalog;
  agentManager: AgentManager;
  sessionManager: SessionManager;
  messageTransformer: MessageTransformer;
  adapters: Map<string, IChannelAdapter> = new Map();
  /** "adapterId:sessionId" → SessionBridge — tracks active bridges for disconnect/reconnect */
  private bridges: Map<string, SessionBridge> = new Map();
  /** Set by main.ts — triggers graceful shutdown with restart exit code */
  requestRestart: (() => Promise<void>) | null = null;
  private _tunnelService?: TunnelService;
  sessionStore: SessionStore | null = null;
  eventBus: EventBus;
  sessionFactory: SessionFactory;
  readonly lifecycleManager: LifecycleManager;
  private agentSwitchHandler: AgentSwitchHandler;
  public readonly instanceContext: InstanceContext;
  readonly menuRegistry = new MenuRegistry();
  readonly assistantRegistry = new AssistantRegistry();
  assistantManager!: AssistantManager;

  // Services (security, notifications, speech, etc.) are provided by plugins that
  // register during boot. Core accesses them lazily via ServiceRegistry so it doesn't
  // need compile-time dependencies on plugin implementations.

  /** @throws if the service hasn't been registered by its plugin yet */
  private getService<T>(name: string): T {
    const svc = this.lifecycleManager.serviceRegistry.get<T>(name);
    if (!svc) throw new Error(`Service '${name}' not registered — is the ${name} plugin loaded?`);
    return svc;
  }

  /** Access control and rate-limiting guard (provided by security plugin). */
  get securityGuard(): SecurityGuard {
    return this.getService<SecurityGuard>('security');
  }

  /** Cross-session notification delivery (provided by notifications plugin). */
  get notificationManager(): NotificationManager {
    return this.getService<NotificationManager>('notifications');
  }

  /** File I/O service for agent attachment storage (provided by file-service plugin). */
  get fileService(): FileServiceInterface {
    return this.getService<FileServiceInterface>('file-service');
  }

  /** Text-to-speech / speech-to-text engine (provided by speech plugin). */
  get speechService(): SpeechService {
    return this.getService<SpeechService>('speech');
  }

  /** Conversation history builder for context injection (provided by context plugin). */
  get contextManager(): ContextManager {
    return this.getService<ContextManager>('context');
  }

  /** Per-plugin persistent settings (e.g. API keys). */
  get settingsManager(): SettingsManager | undefined {
    return this.lifecycleManager.settingsManager;
  }

  /**
   * Bootstrap all core subsystems. The boot order matters:
   * 1. AgentCatalog + AgentManager (agent definitions)
   * 2. SessionStore + SessionManager (session persistence and lookup)
   * 3. EventBus (inter-module communication)
   * 4. SessionFactory (session creation pipeline)
   * 5. LifecycleManager (plugin infrastructure)
   * 6. Wire middleware chain into factory + manager
   * 7. AgentSwitchHandler, config listeners, menu/assistant registries
   */
  constructor(configManager: ConfigManager, ctx: InstanceContext) {
    this.configManager = configManager;
    this.instanceContext = ctx;
    const config = configManager.get();
    this.agentCatalog = new AgentCatalog(
      new AgentStore(ctx.paths.agents),
      ctx.paths.registryCache,
      ctx.paths.agentsDir,
    );
    this.agentCatalog.load();

    this.agentManager = new AgentManager(this.agentCatalog);
    const storePath = ctx.paths.sessions;
    this.sessionStore = new JsonFileSessionStore(
      storePath,
      config.sessionStore.ttlDays,
    );
    this.sessionManager = new SessionManager(this.sessionStore);

    this.messageTransformer = new MessageTransformer();
    this.eventBus = new EventBus();
    this.sessionManager.setEventBus(this.eventBus);

    // SessionFactory uses a lazy accessor for speechService (resolved from ServiceRegistry after plugin boot)
    this.sessionFactory = new SessionFactory(
      this.agentManager,
      this.sessionManager,
      () => this.speechService,
      this.eventBus,
      ctx.root,
    );

    // Initialize plugin lifecycle manager (before setting middlewareChain on factory)
    this.lifecycleManager = new LifecycleManager({
      serviceRegistry: new ServiceRegistry(),
      middlewareChain: new MiddlewareChain(),
      errorTracker: new ErrorTracker(),
      eventBus: this.eventBus as any,
      sessions: this.sessionManager,
      config: this.configManager,
      core: this,
      storagePath: ctx.paths.pluginsData,
      instanceRoot: ctx.root,
      log: createChildLogger({ module: "plugin" }),
    });

    // Wire middleware chain to session factory and session manager
    this.sessionFactory.middlewareChain = this.lifecycleManager.middlewareChain;
    this.sessionManager.middlewareChain = this.lifecycleManager.middlewareChain;

    // Wire lazy resume dependencies
    this.sessionFactory.sessionStore = this.sessionStore;
    this.sessionFactory.adapters = this.adapters;
    this.sessionFactory.createFullSession = (params) => this.createSession(params);
    this.sessionFactory.configManager = this.configManager;
    this.sessionFactory.agentCatalog = this.agentCatalog;
    this.sessionFactory.getContextManager = () => this.lifecycleManager.serviceRegistry.get<ContextManager>('context');
    // Whitelist the file-service upload directory so agents can read attachments
    // (images, voice notes) that Telegram/Slack save outside the workspace in ~/.viben/.
    this.sessionFactory.getAgentAllowedPaths = () => {
      const fileService = this.lifecycleManager.serviceRegistry.get<import('../plugins/file-service/file-service.js').FileService>('file-service');
      return fileService ? [fileService.baseDir] : [];
    };

    this.agentSwitchHandler = new AgentSwitchHandler({
      sessionManager: this.sessionManager,
      agentManager: this.agentManager,
      configManager: this.configManager,
      eventBus: this.eventBus,
      adapters: this.adapters,
      bridges: this.bridges,
      createBridge: (session, adapter, adapterId) => this.createBridge(session, adapter, adapterId),
      getSessionBridgeKeys: (sessionId: string) => this.getSessionBridgeKeys(sessionId),
      getMiddlewareChain: () => this.lifecycleManager?.middlewareChain,
      getService: <T>(name: string) => this.lifecycleManager.serviceRegistry.get<T>(name),
    });

    // Hot-reload: handle config changes that need side effects
    this.configManager.on(
      "config:changed",
      async ({ path: configPath, value }: { path: string; value: unknown }) => {
        if (configPath === "logging.level" && typeof value === "string") {
          const { setLogLevel } = await import("./utils/log.js");
          setLogLevel(value);
          log.info({ level: value }, "Log level changed at runtime");
        }
        if (configPath.startsWith("speech.")) {
          const speechSvc = this.lifecycleManager.serviceRegistry.get<SpeechService>('speech');
          if (speechSvc) {
            const settingsMgr = this.settingsManager;
            if (settingsMgr) {
              const pluginCfg = await settingsMgr.loadSettings('@viben/speech');
              const groqApiKey = pluginCfg.groqApiKey as string | undefined;
              const sttProviders: Record<string, { apiKey: string }> = {};
              if (groqApiKey) {
                sttProviders.groq = { apiKey: groqApiKey };
              }
              const newSpeechConfig = {
                stt: {
                  provider: groqApiKey ? 'groq' : null,
                  providers: sttProviders,
                },
                tts: {
                  provider: (pluginCfg.ttsProvider as string) ?? null,
                  providers: {} as Record<string, never>,
                },
              };
              speechSvc.refreshProviders(newSpeechConfig);
              log.info("Speech service config updated at runtime (from plugin settings)");
            }
          }
        }
      },
    );

    // Register core menu items
    registerCoreMenuItems(this.menuRegistry);

    // Set instance root for assistant CLI guidelines
    this.assistantRegistry.setInstanceRoot(path.dirname(ctx.root));

    // Register core assistant sections
    this.assistantRegistry.register(createSessionsSection(this));
    this.assistantRegistry.register(createAgentsSection(this as any));
    this.assistantRegistry.register(createConfigSection(this as any));
    this.assistantRegistry.register(createSystemSection())
    this.assistantRegistry.register(createRemoteSection());

    // Create assistant manager
    this.assistantManager = new AssistantManager(this as any, this.assistantRegistry);

    // Register registries as services for plugin access
    this.lifecycleManager.serviceRegistry.register('menu-registry', this.menuRegistry, 'core');
    this.lifecycleManager.serviceRegistry.register('assistant-registry', this.assistantRegistry, 'core');
  }

  /** Optional tunnel for generating public URLs (code viewer links, etc.). */
  get tunnelService(): TunnelService | undefined {
    return this._tunnelService;
  }

  /** Propagate tunnel service to MessageTransformer so it can generate viewer links. */
  set tunnelService(service: TunnelService | undefined) {
    this._tunnelService = service;
    this.messageTransformer.tunnelService = service;
  }

  /**
   * Register a messaging adapter (e.g. Telegram, Slack, SSE).
   *
   * Adapters must be registered before `start()`. The adapter name serves as its
   * channel ID throughout the system — used in session records, bridge keys, and routing.
   */
  registerAdapter(name: string, adapter: IChannelAdapter): void {
    this.adapters.set(name, adapter);
  }

  /**
   * Start all registered adapters. Adapters that fail are logged but do not
   * prevent others from starting. Throws only if ALL adapters fail.
   */
  async start(): Promise<void> {
    this.agentCatalog.refreshRegistryIfStale().catch((err) => {
      log.warn({ err }, "Background registry refresh failed");
    });
    const failures: Array<{ name: string; error: unknown }> = [];
    for (const [name, adapter] of this.adapters.entries()) {
      try {
        await adapter.start();
      } catch (err) {
        log.error({ err, adapter: name }, `Adapter "${name}" failed to start`);
        failures.push({ name, error: err });
      }
    }
    if (failures.length > 0 && failures.length === this.adapters.size) {
      throw new Error(
        `All adapters failed to start: ${failures.map((f) => f.name).join(", ")}`,
      );
    }
  }

  /**
   * Graceful shutdown: notify users, persist session state, stop adapters.
   * Agent subprocesses are not explicitly killed — they exit with the parent process.
   */
  async stop(): Promise<void> {
    // 1. Notify users (best effort — service may not be available)
    try {
      const nm = this.lifecycleManager.serviceRegistry.get<NotificationManager>('notifications');
      if (nm) {
        await nm.notifyAll({
          sessionId: "system",
          type: "error",
          summary: "Viben is shutting down",
        });
      }
    } catch {
      /* best effort */
    }

    // 2. Persist session state (don't kill agents — they exit with parent)
    await this.sessionManager.shutdownAll();

    // 3. Stop adapters
    for (const adapter of this.adapters.values()) {
      await adapter.stop();
    }
  }

  // --- Archive ---

  /**
   * Archive a session: delete its adapter topic/thread and cancel the session.
   *
   * Sessions in any state except 'initializing' can be archived.
   * Initializing sessions are excluded because the agent subprocess may not be fully started yet.
   * The adapter handles platform-side cleanup (e.g. deleting a Telegram topic).
   */
  async archiveSession(sessionId: string): Promise<{ ok: true } | { ok: false; error: string }> {
    const session = this.sessionManager.getSession(sessionId);

    // Determine channelId and status — prefer live session, fall back to stored record
    let channelId: string;
    let status: string;
    if (session) {
      channelId = session.channelId;
      status = session.status;
    } else {
      const record = this.sessionManager.getSessionRecord(sessionId);
      if (!record) return { ok: false, error: "Session not found" };
      channelId = record.channelId;
      status = record.status;
    }

    // Only archivable from non-initializing states — initializing sessions are excluded
    // because the agent subprocess may not be fully started yet.
    if (status === "initializing") {
      return { ok: false, error: `Cannot archive session in '${status}' state` };
    }

    const adapter = this.adapters.get(channelId);
    if (!adapter) return { ok: false, error: "Adapter not found for session" };
    if (!adapter.archiveSessionTopic) return { ok: false, error: "Adapter does not support topic archiving" };

    try {
      // archiveSessionTopic handles: cleanup trackers → delete topic
      await adapter.archiveSessionTopic(sessionId);

      // Cancel session — stops agent, removes from active sessions, marks record as cancelled
      await this.sessionManager.cancelSession(sessionId);

      return { ok: true };
    } catch (err) {
      // Clear archiving flag on error (only relevant for live sessions)
      if (session) session.archiving = false;
      return { ok: false, error: (err as Error).message };
    }
  }

  // --- Message Routing ---

  /**
   * Route an incoming platform message to the appropriate session.
   *
   * Flow:
   * 1. Run `message:incoming` middleware (plugins can modify or block)
   * 2. SecurityGuard checks user access and per-user session limits
   * 3. Find session by channel+thread (in-memory lookup, then lazy resume from disk)
   * 4. For assistant sessions, prepend any deferred system prompt
   * 5. Emit `message:queued` for SSE clients, then enqueue the prompt on the session
   *
   * If no session is found, the user is told to start one with /new.
   */
  async handleMessage(message: IncomingMessage, initialMeta?: Record<string, unknown>): Promise<void> {
    log.debug(
      {
        channelId: message.channelId,
        threadId: message.threadId,
        userId: message.userId,
      },
      "Incoming message",
    );

    // Generate turnId + meta early so message:incoming middleware can read/enrich them.
    // Adapters may inject channel-specific context (e.g. display name, username) via initialMeta
    // so plugins can read it without needing adapter-specific fields on IncomingMessage.
    const turnId = nanoid(8);
    const meta: TurnMeta = { turnId, ...initialMeta };

    // Hook: message:incoming — modifiable, can block
    if (this.lifecycleManager?.middlewareChain) {
      const result = await this.lifecycleManager.middlewareChain.execute(
        Hook.MESSAGE_INCOMING,
        { ...message, meta },
        async (msg) => msg,
      );
      if (!result) return; // blocked by middleware
      message = result;
    }

    // Security: check user access and session limits
    const access = await this.securityGuard.checkAccess(message);
    if (!access.allowed) {
      log.warn({ userId: message.userId, reason: access.reason }, "Access denied");
      if (access.reason.includes("Session limit")) {
        const adapter = this.adapters.get(message.channelId);
        if (adapter) {
          await adapter.sendMessage(message.threadId, {
            type: "error",
            text: `⚠️ ${access.reason}. Please cancel existing sessions with /cancel before starting new ones.`,
          });
        }
      }
      return;
    }

    // Find session by thread or lazy resume
    let session = await this.sessionFactory.getOrResume(message.channelId, message.threadId);

    if (!session) {
      log.warn(
        { channelId: message.channelId, threadId: message.threadId },
        "No session found for thread (in-memory miss + lazy resume returned null)",
      );
      const adapter = this.adapters.get(message.channelId);
      if (adapter) {
        await adapter.sendMessage(message.threadId, {
          type: "error",
          text: "⚠️ No active session in this topic. Use /new to start one.",
        });
      }
      return;
    }

    // For assistant sessions, prepend deferred system prompt on first real message
    let text = message.text;
    if (this.assistantManager?.isAssistant(session.id)) {
      const pending = this.assistantManager.consumePendingSystemPrompt(message.channelId);
      if (pending) {
        text = `${pending}\n\n---\n\nUser message:\n${text}`;
      }
    }

    // Merge sourceAdapterId into routing so middleware hooks (e.g. history recorder)
    // can identify the originating adapter even when the message is processed by a
    // different adapter (e.g. an API-sourced message routed through a Telegram session).
    // Carry enriched meta from middleware result (plugins may have attached sender info etc.)
    const enrichedMeta = (message as any).meta as TurnMeta | undefined ?? meta;

    await this._dispatchToSession(session, text, message.attachments, {
      sourceAdapterId: message.routing?.sourceAdapterId ?? message.channelId,
      responseAdapterId: message.routing?.responseAdapterId,
    }, turnId, enrichedMeta);
  }

  /**
   * Shared dispatch path for sending a prompt to a session.
   * Called by both handleMessage (Telegram) and handleMessageInSession (SSE/API)
   * after their respective middleware/enrichment steps.
   */
  private async _dispatchToSession(
    session: Session,
    text: string,
    attachments: Attachment[] | undefined,
    routing: TurnRouting,
    turnId: string,
    meta: TurnMeta,
  ): Promise<void> {
    // Update activity timestamp for all sources
    this.sessionManager.patchRecord(session.id, {
      lastActiveAt: new Date().toISOString(),
    });

    // Emit MESSAGE_QUEUED — always, for all sources, no adapter-specific conditions
    this.eventBus.emit(BusEvent.MESSAGE_QUEUED, {
      sessionId: session.id,
      turnId,
      text,
      sourceAdapterId: routing.sourceAdapterId,
      attachments,
      timestamp: new Date().toISOString(),
      queueDepth: session.queueDepth + 1,
      sender: extractSender(meta),
    });

    // Fire-and-forget: return immediately after enqueueing so callers (API route, adapters)
    // get a fast response without waiting for the agent to finish processing.
    // Errors (e.g. blocked by middleware) surface via MESSAGE_FAILED on the event bus.
    session.enqueuePrompt(text, attachments, routing, turnId, meta).catch(err => {
      const reason = err instanceof Error ? err.message : String(err);
      log.warn({ err, sessionId: session.id, turnId, reason }, 'enqueuePrompt failed — emitting message:failed');
      this.eventBus.emit(BusEvent.MESSAGE_FAILED, {
        sessionId: session.id,
        turnId,
        reason,
      });
    });
  }

  /**
   * Send a message to a known session, running the full message:incoming → agent:beforePrompt
   * middleware chain (same as handleMessage) but without the threadId-based session lookup.
   *
   * Used by channels that already hold a direct session reference (e.g. SSE adapter, api-server),
   * where looking up by channelId+threadId is unreliable (API sessions may have no threadId).
   *
   * @param session  The target session — caller is responsible for validating its status.
   * @param message  Sender context and message content.
   * @param initialMeta  Optional adapter-specific context to seed the TurnMeta bag
   *                     (e.g. channelUser with display name/username).
   * @param options  Optional turnId override and response routing.
   */
  async handleMessageInSession(
    session: Session,
    message: { channelId: string; userId: string; text: string; attachments?: Attachment[] },
    initialMeta?: Record<string, unknown>,
    options?: { externalTurnId?: string; responseAdapterId?: string | null },
  ): Promise<{ turnId: string; queueDepth: number }> {
    const turnId = options?.externalTurnId ?? nanoid(8);
    const meta: TurnMeta = { turnId, ...initialMeta };

    // Run message:incoming middleware so plugins can enrich meta (sender identity, @mentions, etc.)
    let text = message.text;
    let { attachments } = message;
    let enrichedMeta: TurnMeta = meta;
    if (this.lifecycleManager?.middlewareChain) {
      const payload = {
        channelId: message.channelId,
        threadId: session.id,
        userId: message.userId,
        text,
        attachments,
        meta,
      };
      const result = await this.lifecycleManager.middlewareChain.execute(
        Hook.MESSAGE_INCOMING,
        payload,
        async (p) => p,
      );
      if (!result) return { turnId, queueDepth: session.queueDepth };
      text = result.text;
      attachments = result.attachments;
      enrichedMeta = (result as any).meta as TurnMeta ?? meta;
    }

    const routing: TurnRouting = {
      sourceAdapterId: message.channelId,
      responseAdapterId: options?.responseAdapterId,
    };
    await this._dispatchToSession(session, text, attachments, routing, turnId, enrichedMeta);

    return { turnId, queueDepth: session.queueDepth };
  }

  // --- Unified Session Creation Pipeline ---

  /**
   * Create (or resume) a session with full wiring: agent, adapter thread, bridge, persistence.
   *
   * This is the single entry point for session creation. The pipeline:
   * 1. SessionFactory spawns/resumes the agent process
   * 2. Adapter creates a thread/topic if requested
   * 3. Initial session record is persisted (so lazy resume can find it by threadId)
   * 4. SessionBridge connects agent events to the adapter
   * 5. For headless sessions (no adapter), fallback event handlers are wired inline
   * 6. Side effects (usage tracking, tunnel cleanup) are attached
   */
  async createSession(params: {
    channelId: string;
    agentName: string;
    workingDirectory: string;
    resumeAgentSessionId?: string;
    existingSessionId?: string;
    createThread?: boolean;
    initialName?: string;
    // threadTitle sets the adapter thread display name without populating session.name.
    // Use this when you want a placeholder thread title (e.g. "Adopted session") but
    // still need auto-naming to run after the first prompt.
    threadTitle?: string;
    threadId?: string;
    isAssistant?: boolean;
    /** Glob patterns matched against bash command descriptions to auto-approve without user prompts. */
    autoApprovedCommands?: string[];
  }): Promise<Session> {
    const adapter = this.adapters.get(params.channelId);

    // Create thread FIRST (before spawning the agent) so the user sees the topic
    // appear immediately. Session ID is not yet known at this point — the adapter
    // logs it as empty and skips tracing; this is updated in the persisted record below.
    let preCreatedThreadId: string | undefined;
    if (params.createThread && adapter) {
      const name = params.threadTitle ?? params.initialName ?? `🔄 ${params.agentName} — New Session`;
      preCreatedThreadId = await adapter.createSessionThread("", name);
    }

    // 1-3. Spawn/resume agent, create Session, register in SessionManager
    const session = await this.sessionFactory.create(params);

    // Apply thread ID: pre-created thread takes priority over params.threadId
    const resolvedThreadId = preCreatedThreadId ?? params.threadId;
    if (resolvedThreadId) {
      session.threadId = resolvedThreadId;
    }

    // 5. Persist initial record BEFORE bridge.connect() so that:
    //    - Lazy resume can find the record by threadId
    //    - sendSkillCommands/renameSessionThread have threadId available
    const existingRecord = this.sessionStore?.get(session.id);
    const platform: Record<string, unknown> = {
      ...(existingRecord?.platform ?? {}),
    };
    if (session.threadId) {
      if (params.channelId === "telegram") {
        platform.topicId = Number(session.threadId);
      } else {
        platform.threadId = session.threadId;
      }
    }

    // Also persist the multi-adapter platforms map so lazy resume can find sessions
    // by threadId for non-Telegram adapters (which use threadId instead of topicId).
    const platforms: Record<string, Record<string, unknown>> = {
      ...(existingRecord?.platforms ?? {}),
    };
    if (session.threadId) {
      platforms[params.channelId] = params.channelId === "telegram"
        ? { topicId: Number(session.threadId) || session.threadId }
        : { threadId: session.threadId };
    }

    await this.sessionManager.patchRecord(session.id, {
      sessionId: session.id,
      agentSessionId: session.agentSessionId,
      agentName: params.agentName,
      workingDir: params.workingDirectory,
      channelId: params.channelId,
      status: session.status,
      createdAt: session.createdAt.toISOString(),
      lastActiveAt: new Date().toISOString(),
      name: session.name,
      isAssistant: params.isAssistant,
      platform,
      platforms,
      firstAgent: session.firstAgent,
      currentPromptCount: session.promptCount,
      agentSwitchHistory: session.agentSwitchHistory,
      // Cache ACP state for display before agent reconnects on lazy resume
      acpState: session.toAcpStateSnapshot(),
    }, { immediate: true });

    // 6. Connect SessionBridge — agent events can now fire with threadId available
    if (adapter) {
      const bridge = this.createBridge(session, adapter, session.channelId);
      bridge.connect();
      // Flush any skill commands that arrived before threadId was set (safety net)
      adapter.flushPendingSkillCommands?.(session.id).catch((err) => {
        log.warn({ err, sessionId: session.id }, "Failed to flush pending skill commands");
      });
      // Signal that thread is ready — all listeners (adapters, plugins, etc.) can react
      if (params.createThread && session.threadId) {
        this.eventBus.emit(BusEvent.SESSION_THREAD_READY, {
          sessionId: session.id,
          channelId: params.channelId,
          threadId: session.threadId,
        });
      }
    }

    // 6b. Headless sessions (no adapter): wire fallbacks normally handled by SessionBridge.
    if (!adapter) {
      // Auto-approve safe permissions so agents don't hang.
      // Permissions without an explicit allow option are NOT auto-approved — they will time out.
      session.agentInstance.onPermissionRequest = async (permRequest) => {
        const allowOption = permRequest.options.find((o) => o.isAllow);
        if (!allowOption) {
          log.warn(
            { sessionId: session.id, permissionId: permRequest.id, description: permRequest.description },
            "Headless session has no allow option for permission request — skipping auto-approve, will time out",
          );
          return new Promise<string>(() => {}); // never resolves; gate will time out
        }
        log.warn(
          { sessionId: session.id, permissionId: permRequest.id, option: allowOption.id },
          `Auto-approving permission "${permRequest.description}" for headless session — no adapter connected`,
        );
        return allowOption.id;
      };

      // Persist session name and notify SSE clients when autoName fires.
      // For bridged sessions this is handled by SessionBridge's "named" listener;
      // headless sessions have no bridge so we wire it here instead.
      session.on(SessionEv.NAMED, async (name: string) => {
        await this.sessionManager.patchRecord(session.id, { name });
        this.eventBus.emit(BusEvent.SESSION_UPDATED, { sessionId: session.id, name });
      });

      // Forward agent events to EventBus so SSE clients can observe the session.
      // Also handles session lifecycle transitions (session_end → finish, error → fail)
      // and fires agent:beforeEvent middleware — all normally handled by SessionBridge.
      const mw = () => this.lifecycleManager?.middlewareChain;
      session.on(SessionEv.AGENT_EVENT, async (event: AgentEvent) => {
        let processedEvent = event;
        const chain = mw();
        if (chain) {
          const result = await chain.execute(Hook.AGENT_BEFORE_EVENT, { sessionId: session.id, event }, async (e) => e);
          if (!result) return; // blocked by middleware
          processedEvent = result.event;
        }
        if (processedEvent.type === "session_end") {
          session.finish((processedEvent as { reason?: string }).reason);
        } else if (processedEvent.type === "error") {
          session.fail((processedEvent as { message: string }).message);
        }
        this.eventBus.emit(BusEvent.AGENT_EVENT, { sessionId: session.id, turnId: session.activeTurnContext?.turnId ?? '', event: processedEvent });
      });

      // Persist status changes and notify SSE clients — normally wired by SessionBridge.
      session.on(SessionEv.STATUS_CHANGE, (_from: SessionStatus, to: SessionStatus) => {
        this.sessionManager.patchRecord(session.id, {
          status: to,
          lastActiveAt: new Date().toISOString(),
        });
        this.eventBus.emit(BusEvent.SESSION_UPDATED, { sessionId: session.id, status: to });
      });

      // Persist prompt count after each prompt — normally wired by SessionBridge.
      session.on(SessionEv.PROMPT_COUNT_CHANGED, (count: number) => {
        this.sessionManager.patchRecord(session.id, { currentPromptCount: count });
      });

      // Emit message:processing so SSE clients (App) can transition pending → conversation.
      // Normally handled by SessionBridge; headless sessions have no bridge.
      session.on(SessionEv.TURN_STARTED, (ctx: TurnContext) => {
        this.eventBus.emit(BusEvent.MESSAGE_PROCESSING, {
          sessionId: session.id,
          turnId: ctx.turnId,
          sourceAdapterId: ctx.sourceAdapterId,
          userPrompt: ctx.userPrompt,
          finalPrompt: ctx.finalPrompt,
          attachments: ctx.attachments,
          sender: extractSender(ctx.meta),
          timestamp: new Date().toISOString(),
        });
      });
    }

    // 6c. Wire usage tracking and tunnel cleanup
    this.sessionFactory.wireSideEffects(session, {
      eventBus: this.eventBus,
      notificationManager: this.notificationManager,
      tunnelService: this._tunnelService,
    });

    log.info(
      { sessionId: session.id, agentName: params.agentName },
      "Session created via pipeline",
    );
    return session;
  }

  /** Convenience wrapper: create a new session with default agent/workspace resolution. */
  async handleNewSession(
    channelId: string,
    agentName?: string,
    workspacePath?: string,
    options?: { createThread?: boolean; threadId?: string },
  ): Promise<Session> {
    return this.sessionFactory.handleNewSession(channelId, agentName, workspacePath, options);
  }

  /**
   * Adopt an externally-started agent session (e.g. from a CLI `viben adopt` command).
   *
   * Validates that the agent supports resume, checks session limits, avoids duplicates,
   * then creates a full session via the unified pipeline with resume semantics.
   */
  async adoptSession(
    agentName: string,
    agentSessionId: string,
    cwd: string,
    channelId?: string,
  ): Promise<
    | {
        ok: true;
        sessionId: string;
        threadId: string;
        status: "adopted" | "existing";
      }
    | { ok: false; error: string; message: string }
  > {
    // 1. Validate agent supports resume
    const caps = getAgentCapabilities(agentName);
    if (!caps.supportsResume) {
      return {
        ok: false,
        error: "agent_not_supported",
        message: `Agent '${agentName}' does not support session resume`,
      };
    }

    const agentDef = this.agentManager.getAgent(agentName);
    if (!agentDef) {
      return {
        ok: false,
        error: "agent_not_supported",
        message: `Agent '${agentName}' not found`,
      };
    }

    // 2. Validate cwd
    const { existsSync } = await import("node:fs");
    if (!existsSync(cwd)) {
      return {
        ok: false,
        error: "invalid_cwd",
        message: `Directory does not exist: ${cwd}`,
      };
    }

    // 3. Hard cap for the adoptSession path (CLI-initiated session adoption).
    // This is separate from the per-user limits enforced by securityGuard.checkAccess
    // during handleMessage. The security plugin cannot override this value.
    const maxSessions = 20;
    if (this.sessionManager.listSessions().length >= maxSessions) {
      return {
        ok: false,
        error: "session_limit",
        message: "Maximum concurrent sessions reached",
      };
    }

    // 4. Check if session already exists on the same channel
    const existingRecord =
      this.sessionManager.getRecordByAgentSessionId(agentSessionId);
    if (existingRecord) {
      const sameChannel = !channelId || existingRecord.channelId === channelId;
      const platform = existingRecord.platform as { topicId?: number; threadId?: string } | undefined;
      const existingThreadId = platform?.topicId ? String(platform.topicId) : platform?.threadId;
      if (existingThreadId && sameChannel) {
        const adapter = this.adapters.get(existingRecord.channelId) ?? this.adapters.values().next().value;
        if (adapter) {
          try {
            await adapter.sendMessage(existingRecord.sessionId, {
              type: "text",
              text: "Session resumed from CLI.",
            });
          } catch { /* Topic/thread may be deleted */ }
        }
        return {
          ok: true,
          sessionId: existingRecord.sessionId,
          threadId: existingThreadId,
          status: "existing",
        };
      }
    }

    // 5. Find adapter (explicit channel or default first)
    let adapterChannelId: string;
    if (channelId) {
      if (!this.adapters.has(channelId)) {
        const available = Array.from(this.adapters.keys()).join(", ") || "none";
        return { ok: false, error: "adapter_not_found", message: `Adapter '${channelId}' is not connected. Available: ${available}` };
      }
      adapterChannelId = channelId;
    } else {
      if (this.adapters.size === 0) {
        return { ok: false, error: "no_adapter", message: "No channel adapter registered" };
      }
      // If multiple adapters are registered, require explicit --channel so the caller
      // intentionally picks the target platform rather than silently landing in the wrong one.
      if (this.adapters.size > 1) {
        const available = Array.from(this.adapters.keys());
        // Map internal adapter names to human-readable display names for the prompt
        const displayName: Record<string, string> = { sse: "Desktop App" };
        return {
          ok: false,
          error: "channel_required",
          message: `Multiple channels available. Specify one with --channel:\n${available.map(c => `  - ${c} (${displayName[c] ?? c})`).join("\n")}`,
        };
      }
      adapterChannelId = this.adapters.keys().next().value!;
    }

    // 6. Create session via unified pipeline
    let session: Session;
    try {
      session = await this.createSession({
        channelId: adapterChannelId,
        agentName,
        workingDirectory: cwd,
        resumeAgentSessionId: agentSessionId,
        createThread: true,
        // initialName shows a placeholder in the app immediately after adopt.
        // auto-naming checks for this placeholder value and overwrites it on first
        // user message, so the name is still updated automatically.
        initialName: "Adopted session",
        threadTitle: "Adopted session",
      });
    } catch (err) {
      return {
        ok: false,
        error: "resume_failed",
        message: `Failed to resume session: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    // 7. Update store with adopt-specific fields
    const adoptPlatform: Record<string, unknown> = {};
    if (adapterChannelId === 'telegram') {
      adoptPlatform.topicId = Number(session.threadId);
    } else {
      adoptPlatform.threadId = session.threadId;
    }
    const adoptPlatforms: Record<string, Record<string, unknown>> = {};
    if (session.threadId) {
      adoptPlatforms[adapterChannelId] = adapterChannelId === 'telegram'
        ? { topicId: Number(session.threadId) || session.threadId }
        : { threadId: session.threadId };
    }
    await this.sessionManager.patchRecord(session.id, {
      originalAgentSessionId: agentSessionId,
      platform: adoptPlatform,
      platforms: adoptPlatforms,
    });

    return {
      ok: true,
      sessionId: session.id,
      threadId: session.threadId,
      status: "adopted",
    };
  }

  /** Start a new chat within the same agent and workspace as the current session's thread. */
  async handleNewChat(channelId: string, currentThreadId: string): Promise<Session | null> {
    return this.sessionFactory.handleNewChat(channelId, currentThreadId);
  }

  /** Create a session and inject conversation context from a prior session or repo. */
  async createSessionWithContext(params: {
    channelId: string;
    agentName: string;
    workingDirectory: string;
    contextQuery: import("../plugins/context/context-provider.js").ContextQuery;
    contextOptions?: import("../plugins/context/context-provider.js").ContextOptions;
    createThread?: boolean;
    threadId?: string;
  }): Promise<{ session: Session; contextResult: import("../plugins/context/context-provider.js").ContextResult | null }> {
    return this.sessionFactory.createSessionWithContext(params);
  }

  // --- Agent Switch ---

  /** Switch a session's active agent. Delegates to AgentSwitchHandler for state coordination. */
  async switchSessionAgent(sessionId: string, toAgent: string): Promise<{ resumed: boolean }> {
    return this.agentSwitchHandler.switch(sessionId, toAgent);
  }

  /** Find a session by channel+thread, resuming from disk if not in memory. */
  async getOrResumeSession(channelId: string, threadId: string): Promise<Session | null> {
    return this.sessionFactory.getOrResume(channelId, threadId);
  }

  /** Find a session by ID, resuming from disk if not in memory. */
  async getOrResumeSessionById(sessionId: string): Promise<Session | null> {
    return this.sessionFactory.getOrResumeById(sessionId);
  }

  /**
   * Attach an additional adapter to an existing session (multi-adapter support).
   *
   * Creates a thread on the target adapter and connects a SessionBridge so the
   * session's agent events are forwarded to both the primary and attached adapters.
   */
  async attachAdapter(sessionId: string, adapterId: string): Promise<{ threadId: string }> {
    const session = this.sessionManager.getSession(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const adapter = this.adapters.get(adapterId);
    if (!adapter) throw new Error(`Adapter "${adapterId}" not found or not running`);

    // Already attached — return existing threadId
    if (session.attachedAdapters.includes(adapterId)) {
      const existingThread = session.threadIds.get(adapterId) ?? session.id;
      return { threadId: existingThread };
    }

    // Create thread on target adapter
    const threadId = await adapter.createSessionThread(
      session.id,
      session.name ?? `Session ${session.id.slice(0, 6)}`,
    );
    session.threadIds.set(adapterId, threadId);
    session.attachedAdapters.push(adapterId);

    // Create and connect bridge
    const bridge = this.createBridge(session, adapter, adapterId);
    bridge.connect();

    // Persist
    await this.sessionManager.patchRecord(session.id, {
      attachedAdapters: session.attachedAdapters,
      platforms: this.buildPlatformsFromSession(session),
    });

    return { threadId };
  }

  /**
   * Detach a secondary adapter from a session. The primary adapter (channelId) cannot
   * be detached. Disconnects the bridge and cleans up thread mappings.
   */
  async detachAdapter(sessionId: string, adapterId: string): Promise<void> {
    const session = this.sessionManager.getSession(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    if (adapterId === session.channelId) {
      throw new Error("Cannot detach primary adapter (channelId)");
    }

    if (!session.attachedAdapters.includes(adapterId)) {
      return; // Already detached, idempotent
    }

    // Send detach notice before disconnecting
    const adapter = this.adapters.get(adapterId);
    if (adapter) {
      try {
        await adapter.sendMessage(session.id, {
          type: "system_message",
          text: "Session detached from this adapter.",
        });
      } catch { /* best effort */ }
    }

    // Disconnect bridge
    const key = this.bridgeKey(adapterId, session.id);
    const bridge = this.bridges.get(key);
    if (bridge) {
      bridge.disconnect();
      this.bridges.delete(key);
    }

    // Update session state
    session.attachedAdapters = session.attachedAdapters.filter(a => a !== adapterId);
    session.threadIds.delete(adapterId);

    // Persist
    await this.sessionManager.patchRecord(session.id, {
      attachedAdapters: session.attachedAdapters,
      platforms: this.buildPlatformsFromSession(session),
    });
  }

  /** Build the platforms map (adapter → thread/topic IDs) for persistence. */
  private buildPlatformsFromSession(session: Session): Record<string, Record<string, unknown>> {
    const platforms: Record<string, Record<string, unknown>> = {};
    for (const [adapterId, threadId] of session.threadIds) {
      if (adapterId === "telegram") {
        platforms.telegram = { topicId: Number(threadId) || threadId };
      } else {
        platforms[adapterId] = { threadId };
      }
    }
    return platforms;
  }

  // --- Event Wiring ---

  /** Composite bridge key: "adapterId:sessionId" */
  private bridgeKey(adapterId: string, sessionId: string): string {
    return `${adapterId}:${sessionId}`;
  }

  /** Get all bridge keys for a session (regardless of adapter) */
  private getSessionBridgeKeys(sessionId: string): string[] {
    const keys: string[] = [];
    for (const key of this.bridges.keys()) {
      if (key.endsWith(`:${sessionId}`)) keys.push(key);
    }
    return keys;
  }

  /** Connect a session bridge for the given session (used by AssistantManager) */
  connectSessionBridge(session: Session): void {
    const adapter = this.adapters.get(session.channelId);
    if (!adapter) return;
    const bridge = this.createBridge(session, adapter, session.channelId);
    bridge.connect();
  }

  /**
   * Create a SessionBridge for the given session and adapter.
   *
   * The bridge subscribes to Session events (agent output, status changes, naming)
   * and forwards them to the adapter for platform delivery. Disconnects any existing
   * bridge for the same adapter+session first to avoid duplicate event handlers.
   */
  createBridge(session: Session, adapter: IChannelAdapter, adapterId?: string): SessionBridge {
    const id = adapterId ?? adapter.name;
    const key = this.bridgeKey(id, session.id);
    const existing = this.bridges.get(key);
    if (existing) {
      existing.disconnect();
    }
    const bridge = new SessionBridge(session, adapter, {
      messageTransformer: this.messageTransformer,
      notificationManager: this.notificationManager,
      sessionManager: this.sessionManager,
      eventBus: this.eventBus,
      fileService: this.fileService,
      middlewareChain: this.lifecycleManager?.middlewareChain,
    }, id);
    this.bridges.set(key, bridge);
    return bridge;
  }
}
