import { Bot, InputFile, InlineKeyboard } from "grammy";
import path from "node:path";
import { BusEvent } from "../../core/events.js";
import type {
  VibenCore,
  OutgoingMessage,
  PermissionRequest,
  NotificationMessage,
  AgentCommand,
  FileServiceInterface,
} from "../../core/index.js";
import { createChildLogger } from "../../core/utils/log.js";
import type { DebugTracer } from "../../core/utils/debug-tracer.js";
const log = createChildLogger({ module: "telegram" });
import type { TelegramChannelConfig } from "./types.js";
import type { CommandRegistry } from "../../core/command-registry.js";
import type { CommandResponse } from "../../core/plugin/types.js";
import {
  ensureTopics,
  createSessionTopic,
  renameSessionTopic,
  deleteSessionTopic,
} from "./topics.js";
import {
  setupMenuCallbacks,
  setupDangerousModeCallbacks,
  setupTTSCallbacks,
  setupVerbosityCallbacks,
  setupIntegrateCallbacks,
  buildMenuKeyboard,
  STATIC_COMMANDS,
} from "./commands/index.js";
import { TELEGRAM_OVERRIDES } from './commands/telegram-overrides.js'
import { buildSessionStatusText, buildSessionControlKeyboard, isBypassActive } from "./commands/admin.js";
import type { TelegramPlatformData } from "../../core/types.js";
import { PermissionHandler } from "./permissions.js";
import {
  redirectToAssistant,
  buildWelcomeMessage,
} from "./assistant.js";
import { escapeHtml, formatUsage } from "./formatting.js";
import { ActivityTracker } from "./activity.js";
import { SendQueue } from "../../core/adapter-primitives/primitives/send-queue.js";
import { DraftManager } from "./draft-manager.js";
import { SkillCommandManager } from "./skill-command-manager.js";
import {
  MessagingAdapter,
  type MessagingAdapterConfig,
} from "../../core/adapter-primitives/messaging-adapter.js";
import type { IRenderer } from "../../core/adapter-primitives/rendering/renderer.js";
import { TelegramRenderer } from "./renderer.js";
import type { AdapterCapabilities } from "../../core/channel.js";
import type {
  DisplayVerbosity,
  ToolCallMeta,
  ToolUpdateMeta,
  OutputMode,
} from "../../core/adapter-primitives/format-types.js";
import { OutputModeResolver } from "../../core/adapter-primitives/output-mode-resolver.js";
import type { TunnelServiceInterface } from "../../core/plugin/types.js";
// evaluateNoise is handled by MessagingAdapter.shouldDisplay()

interface PlanMetadata {
  entries: Array<{ content: string; status: string; priority: string }>;
}

interface UsageMetadata {
  tokensUsed?: number;
  contextSize?: number;
}

/**
 * Wrap native fetch to work around grammY's polyfilled AbortController.
 *
 * grammY uses an abort-controller polyfill whose AbortSignal fails `instanceof`
 * checks in Node 24+ native fetch. This wrapper re-creates a native AbortSignal
 * from the polyfilled signal object before forwarding the request.
 */
function patchedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  if (init?.signal && !(init.signal instanceof AbortSignal)) {
    const nativeController = new AbortController();
    const polyfillSignal = init.signal as unknown as {
      aborted: boolean;
      addEventListener: (event: string, fn: () => void) => void;
    };
    if (polyfillSignal.aborted) {
      nativeController.abort();
    } else {
      polyfillSignal.addEventListener("abort", () => nativeController.abort());
    }
    init = { ...init, signal: nativeController.signal };
  }
  return fetch(input, init);
}

/**
 * Telegram adapter — bridges the Viben session system to a Telegram supergroup.
 *
 * Architecture overview:
 * - **Topic-per-session model**: each agent session lives in its own Telegram forum
 *   topic. The topic ID is stored as `session.threadId` and used to route all
 *   inbound and outbound messages.
 * - **Two system topics**: "📋 Notifications" (cross-session alerts) and
 *   "🤖 Assistant" (conversational AI). Created once on first run, IDs persisted.
 * - **Streaming**: agent text arrives as `text_delta` chunks. A `MessageDraft`
 *   accumulates chunks and edits the message in-place every 5 seconds, reducing
 *   API calls while keeping the response live.
 * - **Callback routing**:
 *   - `p:<key>:<optionId>` — permission approval buttons
 *   - `c/<command>` (or `c/#<id>` for long commands) — command button actions
 *   - `m:<itemId>` — MenuRegistry item dispatch
 *   - Domain prefixes (`d:`, `v:`, `ns:`, `sw:`, etc.) — specific feature flows
 * - **Two-phase startup**: Phase 1 starts the bot and registers handlers.
 *   Phase 2 checks group prerequisites (admin, topics enabled) and creates
 *   system topics. If prerequisites are not met, a background watcher retries.
 */
export class TelegramAdapter extends MessagingAdapter {
  readonly name = "telegram";
  readonly renderer: IRenderer = new TelegramRenderer();
  readonly capabilities: AdapterCapabilities = {
    streaming: true,
    richFormatting: true,
    threads: true,
    reactions: true,
    fileUpload: true,
    voice: true,
  };

  private core: VibenCore;
  private bot!: Bot;
  private telegramConfig: TelegramChannelConfig;
  private saveTopicIds?: (updates: { notificationTopicId?: number; assistantTopicId?: number }) => Promise<void>;
  private permissionHandler!: PermissionHandler;
  private notificationTopicId!: number;
  private assistantTopicId!: number;
  private sendQueue = new SendQueue({ minInterval: 3000 });
  private _sessionThreadIds = new Map<string, number>();
  private outputModeResolver = new OutputModeResolver();

  // Extracted managers
  private draftManager!: DraftManager;
  private skillManager!: SkillCommandManager;
  private fileService!: FileServiceInterface;
  private sessionTrackers: Map<string, ActivityTracker> = new Map();
  private callbackCache = new Map<string, string>();
  private callbackCounter = 0;
  /** Pending skill commands queued when session.threadId was not yet set */
  private _pendingSkillCommands = new Map<string, AgentCommand[]>();
  /** Control message IDs per session (for updating status text/buttons) */
  private controlMsgIds = new Map<string, number>();
  /** Last usage message ID per session — replaced on each new prompt cycle */
  private usageMsgIds = new Map<string, number>();
  private _threadReadyHandler?: (data: { sessionId: string; channelId: string; threadId: string }) => void;
  private _configChangedHandler?: (data: { sessionId: string }) => void;
  /** Mutable ref passed to callbacks before topics are ready; updated in-place by initTopicDependentFeatures */
  private _systemTopicIds = { notificationTopicId: 0, assistantTopicId: 0 };
  /**
   * Tracks queue notification state per turnId:
   * - 'pending': notification is being sent (sendQueue delay), not yet assigned a msgId
   * - 'delete': MESSAGE_PROCESSING fired before the send completed — delete as soon as it's sent
   * - number: notification sent successfully, this is the Telegram message_id to delete
   */
  private _queueNotifications = new Map<string, number | 'pending' | 'delete'>();
  /** True once topics are initialized and Phase 2 is complete */
  private _topicsInitialized = false;
  /** Background watcher timer — cancelled on stop() or when topics succeed */
  private _prerequisiteWatcher: ReturnType<typeof setTimeout> | null = null;
  /** Set during normal shutdown so bot.stop() does not trigger a self-restart. */
  private _stopping = false;

  /** Returns the configured Telegram supergroup chat ID. */
  getChatId(): number {
    return this.telegramConfig.chatId
  }

  /**
   * Persist the control message ID both in-memory and to the session record.
   * The control message is the pinned status card with bypass/TTS buttons; its ID
   * is needed after a restart to edit it when config changes.
   */
  private storeControlMsgId(sessionId: string, msgId: number): void {
    this.controlMsgIds.set(sessionId, msgId);
    const record = this.core.sessionManager.getSessionRecord(sessionId);
    this.core.sessionManager.patchRecord(sessionId, {
      platform: { ...(record?.platform ?? {}), controlMsgId: msgId },
    }).catch(() => {});
  }

  /** Get control message ID (from Map, with fallback to session record) */
  private getControlMsgId(sessionId: string): number | undefined {
    let msgId = this.controlMsgIds.get(sessionId);
    if (!msgId) {
      const record = this.core.sessionManager.getSessionRecord(sessionId);
      const platform = record?.platform as TelegramPlatformData | undefined;
      if (platform?.controlMsgId) {
        msgId = platform.controlMsgId;
        this.storeControlMsgId(sessionId, msgId);
      }
    }
    return msgId;
  }

  private getThreadId(sessionId: string): number {
    const threadId = this._sessionThreadIds.get(sessionId);
    if (threadId === undefined) {
      throw new Error(`No threadId stored for session ${sessionId}`);
    }
    return threadId;
  }

  private getOrCreateTracker(
    sessionId: string,
    threadId: number,
    outputMode: OutputMode = "medium",
  ): ActivityTracker {
    let tracker = this.sessionTrackers.get(sessionId);
    if (!tracker) {
      const tunnelService = this.core.lifecycleManager?.serviceRegistry?.get("tunnel") as TunnelServiceInterface | undefined;
      const session = this.core.sessionManager.getSession(sessionId);
      const sessionContext = session ? {
        id: sessionId,
        workingDirectory: session.workingDirectory,
      } : undefined;
      tracker = new ActivityTracker(
        this.bot.api,
        this.telegramConfig.chatId,
        threadId,
        this.sendQueue,
        outputMode,
        sessionId,
        this.getTracer(sessionId),
        tunnelService,
        sessionContext,
      );
      this.sessionTrackers.set(sessionId, tracker);
    } else {
      tracker.setOutputMode(outputMode);
    }
    return tracker;
  }

  constructor(
    core: VibenCore,
    config: TelegramChannelConfig,
    saveTopicIds?: (updates: { notificationTopicId?: number; assistantTopicId?: number }) => Promise<void>,
  ) {
    super({ configManager: core.configManager }, {
      ...(config as Record<string, unknown>),
      maxMessageLength: 4096,
      enabled: config.enabled ?? true,
    } as MessagingAdapterConfig);
    this.core = core;
    this.telegramConfig = config;
    this.saveTopicIds = saveTopicIds;
  }

  /**
   * Set up the grammY bot, register all callback and message handlers, then perform
   * two-phase startup: Phase 1 starts polling immediately; Phase 2 checks group
   * prerequisites (bot is admin, topics are enabled) and creates/restores system topics.
   * If prerequisites are not met, a background watcher retries until they are.
   */
  async start(): Promise<void> {
    this._stopping = false;
    this.bot = new Bot(this.telegramConfig.botToken, {
      client: {
        baseFetchConfig: { duplex: "half" } as RequestInit,
        fetch: patchedFetch,
      },
    });
    this.fileService = this.core.fileService;

    // Initialize extracted managers
    this.draftManager = new DraftManager(
      this.bot,
      this.telegramConfig.chatId,
      this.sendQueue,
    );
    this.skillManager = new SkillCommandManager(
      this.bot,
      this.telegramConfig.chatId,
      this.sendQueue,
      this.core.sessionManager,
    );

    // Global error handler — prevent unhandled errors from crashing the bot
    this.bot.catch((err) => {
      const rootCause = err.error instanceof Error ? err.error : err;
      log.error({ err: rootCause }, "Telegram bot error");
    });

    // Auto-retry on 429 (Too Many Requests)
    this.bot.api.config.use(async (prev, method, payload, signal) => {
      const maxRetries = 3;
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const result = await prev(method, payload, signal);
        if (
          result.ok ||
          (result as { error_code?: number }).error_code !== 429 ||
          attempt === maxRetries
        ) {
          return result;
        }
        const retryAfter =
          ((result as { parameters?: { retry_after?: number } }).parameters
            ?.retry_after ?? 5) + 1;
        const rateLimitedMethods = [
          "sendMessage",
          "editMessageText",
          "editMessageReplyMarkup",
        ];
        if (rateLimitedMethods.includes(method)) {
          this.sendQueue.onRateLimited();
        }
        log.warn(
          { method, retryAfter, attempt: attempt + 1 },
          "Rate limited by Telegram, retrying",
        );
        await new Promise((r) => setTimeout(r, retryAfter * 1000));
      }
      return prev(method, payload, signal);
    });

    // Ensure allowed_updates includes callback_query on every poll
    this.bot.api.config.use((prev, method, payload, signal) => {
      if (method === "getUpdates") {
        const p = payload as Record<string, unknown>;
        p.allowed_updates = (p.allowed_updates as string[] | undefined) ?? [
          "message",
          "callback_query",
        ];
      }
      return prev(method, payload, signal);
    });

    // Register Telegram autocomplete commands after all plugins finish setup.
    // Keeps listening persistently so hot-reload (dev plugin) and community plugin
    // changes re-sync the command list without restarting the server.
    const onCommandsReady = ({ commands }: { commands: Array<{ name: string; description: string; category?: string }> }) => {
      this.syncCommandsWithRetry(commands);
    };
    this.core.eventBus.on(BusEvent.SYSTEM_COMMANDS_READY, onCommandsReady);

    // Middleware: only accept updates from configured chatId
    this.bot.use((ctx, next) => {
      const chatId = ctx.chat?.id ?? ctx.callbackQuery?.message?.chat?.id;
      if (chatId !== this.telegramConfig.chatId) return;
      return next();
    });

    // Setup permission handler
    this.permissionHandler = new PermissionHandler(
      this.bot,
      this.telegramConfig.chatId,
      (sessionId) => this.core.sessionManager.getSession(sessionId),
      (notification) => this.sendNotification(notification),
    );

    // Generic CommandRegistry dispatch — handles any command registered via plugin system.
    // Must be early so registry commands run before legacy bot.command() handlers.
    // Command handler — guard when topics not yet initialized
    this.bot.on("message:text", async (ctx, next) => {
      const text = ctx.message?.text;
      if (!text?.startsWith("/")) return next();

      // /retry is always allowed — it is specifically for recovering from the not-initialized state
      const rawCmd = text.split(" ")[0].slice(1).split("@")[0].toLowerCase();
      if (rawCmd === "retry") {
        await this.handleRetryCommand(ctx);
        return;
      }

      if (!this._topicsInitialized) {
        await ctx.reply(
          "⏳ Viben is still setting up. Open the Topics list of this group and check the 📌 General topic for setup instructions. Or send /retry to re-check now.",
        ).catch(() => {});
        return;
      }

      const registry =
        this.core.lifecycleManager?.serviceRegistry?.get<CommandRegistry>(
          "command-registry",
        );
      if (!registry) return next();

      // Extract command name (remove / and @botname suffix)
      const rawCommand = text.split(" ")[0].slice(1);
      const atIdx = rawCommand.indexOf("@");
      // If command is directed at another bot, ignore it
      if (
        atIdx !== -1 &&
        rawCommand.slice(atIdx + 1).toLowerCase() !==
          ctx.me.username.toLowerCase()
      ) {
        return next();
      }
      const commandName =
        atIdx === -1 ? rawCommand : rawCommand.slice(0, atIdx);
      const def = registry.get(commandName);
      if (!def) return next(); // not in registry, fall through to existing handlers

      // Telegram-specific override — use rich handler instead of core CommandRegistry
      const telegramOverride = TELEGRAM_OVERRIDES[commandName]
      if (telegramOverride) {
        try {
          await telegramOverride(ctx, this.core as VibenCore)
        } catch (err) {
          await ctx.reply(`⚠️ Command failed: ${String(err)}`)
        }
        return
      }

      const chatId = ctx.chat.id;
      const topicId = ctx.message.message_thread_id;

      try {
        const sessionId =
          topicId != null
            ? ((await this.core.getOrResumeSession(
                "telegram",
                String(topicId),
              ))?.id ?? null)
            : null;

        const response = await registry.execute(text, {
          raw: "",
          sessionId,
          channelId: "telegram",
          userId: String(ctx.from?.id),
          reply: async (content) => {
            if (typeof content === "string") {
              await ctx.reply(content);
            } else if (
              typeof content === "object" &&
              content !== null &&
              "type" in content
            ) {
              await this.renderCommandResponse(
                content as CommandResponse,
                chatId,
                topicId,
              );
            }
          },
        });

        if (response.type === "delegated") {
          // Delegated means assistant will handle the response — don't render anything
          return;
        }
        if (response.type === "silent") {
          // Silent means fall through to message routing (backward compat for commands not yet migrated)
          return next();
        }
        await this.renderCommandResponse(response, chatId, topicId);
      } catch (err) {
        await ctx.reply(`\u26a0\ufe0f Command failed: ${String(err)}`);
      }
    });

    // Callback query handler for command buttons (c/ prefix)
    this.bot.callbackQuery(/^c\//, async (ctx) => {
      if (!this._topicsInitialized) {
        await ctx.answerCallbackQuery().catch(() => {});
        return;
      }

      const data = ctx.callbackQuery.data;
      const command = this.fromCallbackData(data);

      const registry =
        this.core.lifecycleManager?.serviceRegistry?.get<CommandRegistry>(
          "command-registry",
        );
      if (!registry) return;

      const chatId = ctx.chat!.id;
      const topicId = ctx.callbackQuery.message?.message_thread_id;

      try {
        const sessionId =
          topicId != null
            ? ((await this.core.getOrResumeSession(
                "telegram",
                String(topicId),
              ))?.id ?? null)
            : null;

        const response = await registry.execute(command, {
          raw: "",
          sessionId,
          channelId: "telegram",
          userId: String(ctx.from?.id),
          reply: async (content) => {
            if (typeof content === "string") {
              await ctx.editMessageText(content).catch(() => {});
            }
          },
        });

        await ctx.answerCallbackQuery();
        if (response.type !== "silent") {
          // Always edit the callback message in-place (no new messages)
          if (response.type === "menu") {
            const keyboard = response.options.map((opt) => [
              {
                text: `${opt.label}${opt.hint ? ` \u2014 ${opt.hint}` : ""}`,
                callback_data: this.toCallbackData(opt.command),
              },
            ]);
            try {
              await ctx.editMessageText(response.title, {
                reply_markup: { inline_keyboard: keyboard },
              });
            } catch {
              /* message unchanged or deleted */
            }
          } else if (response.type === "text" || response.type === "error" || response.type === "adaptive") {
            let text: string;
            let parseMode: 'HTML' | 'Markdown' | 'MarkdownV2' | undefined;
            if (response.type === "adaptive") {
              const variant = response.variants?.['telegram'] as
                | { text?: string; parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2' }
                | undefined;
              text = variant?.text ?? response.fallback;
              parseMode = variant?.parse_mode;
            } else {
              text = response.type === "text" ? response.text : `❌ ${response.message}`;
              parseMode = "Markdown";
            }
            try {
              await ctx.editMessageText(text, { ...(parseMode && { parse_mode: parseMode }) });
            } catch {
              /* message unchanged or deleted */
            }
          }
        }
      } catch {
        await ctx.answerCallbackQuery({ text: "Command failed" });
      }
    });

    // Callback query handler for queue management buttons (q: prefix).
    // Buttons are attached to queue notification messages sent by the MESSAGE_QUEUED listener.
    this.bot.callbackQuery(/^q:/, async (ctx) => {
      const data = ctx.callbackQuery.data!;
      const parts = data.split(':');
      const action = parts[1];
      const sessionId = parts[2];

      const session = this.core.sessionManager.getSession(sessionId);
      if (!session) {
        await ctx.answerCallbackQuery({ text: 'Session not found.' });
        return;
      }

      if (action === 'now') {
        const turnId = parts[3];
        const found = await session.prioritizePrompt(turnId);
        await ctx.answerCallbackQuery({ text: found ? '⏭ Processing now!' : 'Message already processed.' });
      } else if (action === 'clear') {
        session.clearQueue();
        await ctx.answerCallbackQuery({ text: '🗑 Queue cleared.' });
      } else if (action === 'cancel') {
        await session.abortPrompt();
        await ctx.answerCallbackQuery({ text: '⛔ Current prompt cancelled.' });
      } else if (action === 'flush') {
        await session.flushAll();
        session.markCancelled();
        await ctx.answerCallbackQuery({ text: '🔄 Session flushed.' });
      }

      // For clear/flush/now, all queued notifications are obsolete — dismiss them all.
      // For sent notifications (number), delete via API immediately.
      // For pending notifications (not yet sent due to sendQueue delay), mark as 'delete'
      // so the send handler deletes them right after sending.
      if (action === 'clear' || action === 'flush' || action === 'now') {
        for (const [turnId, entry] of this._queueNotifications) {
          if (typeof entry === 'number') {
            this.bot.api.deleteMessage(this.telegramConfig.chatId, entry).catch(() => {});
            this._queueNotifications.delete(turnId);
          } else if (entry === 'pending') {
            this._queueNotifications.set(turnId, 'delete');
          }
          // 'delete' entries are already handled
        }
      }

      // Delete this notification message
      try { await ctx.deleteMessage(); } catch { /* already deleted */ }
    });

    // Callback registration order matters!
    setupDangerousModeCallbacks(this.bot, this.core as VibenCore);
    setupTTSCallbacks(this.bot, this.core as VibenCore);
    setupVerbosityCallbacks(this.bot, this.core as VibenCore);
    setupIntegrateCallbacks(this.bot, this.core as VibenCore);
    this.permissionHandler.setupCallbackHandler();

    // Register topic-dependent callbacks using a mutable ref (_systemTopicIds).
    // The ref is updated in-place by initTopicDependentFeatures() once topics are ready.
    setupMenuCallbacks(
      this.bot,
      this.core as VibenCore,
      this.telegramConfig.chatId,
      this._systemTopicIds,
      () => {
        const assistant = this.core.assistantManager?.get('telegram');
        if (!assistant) return undefined;
        return {
          topicId: this.assistantTopicId,
          enqueuePrompt: (p: string) => {
            const pending = this.core.assistantManager?.consumePendingSystemPrompt('telegram');
            const text = pending ? `${pending}\n\n---\n\nUser message:\n${p}` : p;
            return assistant.enqueuePrompt(text);
          },
        };
      },
      (sessionId: string, msgId: number) => {
        this.storeControlMsgId(sessionId, msgId);
      },
    );
    this.setupRoutes();

    // Start bot polling. Supervise the promise so a rejected poll triggers a restart
    // instead of silently leaving the process alive but no longer consuming messages.
    void this.bot.start({
      allowed_updates: ["message", "callback_query"],
      onStart: () => log.info({ chatId: this.telegramConfig.chatId }, "Telegram bot started"),
    }).catch((err: unknown) => {
      if (this._stopping) return;

      // grammY sometimes wraps the real error in an { error } envelope.
      const inner = (err as Record<string, unknown>)?.error;
      const rootCause = err instanceof Error ? err : inner instanceof Error ? inner : err;

      log.error({ err: rootCause }, "Telegram polling stopped unexpectedly");
      if (this.core.requestRestart) {
        const requestRestart = this.core.requestRestart;
        log.error("Restarting Viben because Telegram polling stopped");
        setImmediate(() => {
          if (this._stopping) return;
          void requestRestart().catch((restartErr: unknown) => {
            log.error({ err: restartErr }, "Viben restart request failed after Telegram polling stopped");
          });
        });
      } else {
        log.error("Exiting because Telegram polling stopped and no restart hook is available");
        setImmediate(() => {
          if (this._stopping) return;
          process.exit(1);
        });
      }
    });

    // Phase 2: check prerequisites and either initialize topics now or start watcher
    log.info(
      {
        chatId: this.telegramConfig.chatId,
        notificationTopicId: this.telegramConfig.notificationTopicId,
        assistantTopicId: this.telegramConfig.assistantTopicId,
      },
      'Telegram adapter: starting prerequisite check (existing topic IDs shown)',
    );
    const { checkTopicsPrerequisites } = await import('./validators.js');
    const prereqResult = await checkTopicsPrerequisites(
      this.telegramConfig.botToken,
      this.telegramConfig.chatId,
    );

    if (prereqResult.ok) {
      log.info('Telegram adapter: prerequisites OK, initializing topic-dependent features');
      await this.initTopicDependentFeatures();
    } else {
      log.warn({ issues: prereqResult.issues }, 'Telegram adapter: prerequisites NOT met, starting watcher');
      for (const issue of prereqResult.issues) {
        log.warn({ issue }, 'Telegram prerequisite not met');
      }
      this.startPrerequisiteWatcher(prereqResult.issues);
    }
  }

  /**
   * Retry an async operation with exponential backoff.
   * Used for Telegram API calls that may fail due to transient network issues.
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    label: string,
    maxRetries = 5,
    baseDelayMs = 2000,
  ): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        if (attempt === maxRetries) throw err;
        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        log.warn(
          { err, attempt, maxRetries, delayMs: delay, operation: label },
          `${label} failed, retrying in ${delay}ms`,
        );
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    throw new Error("unreachable");
  }

  /**
   * Sync Telegram autocomplete commands after all plugins are ready.
   * Merges STATIC_COMMANDS (hardcoded system commands) with plugin commands
   * from the registry, deduplicating by command name. Non-critical.
   */
  private syncCommandsWithRetry(registryCommands: Array<{ name: string; description: string; category?: string }>): void {
    const staticNames = new Set(STATIC_COMMANDS.map((c) => c.command));

    // Only add plugin commands not already in STATIC_COMMANDS.
    // Telegram command names must be lowercase alphanumeric + underscore only.
    const pluginCommands = registryCommands
      .filter((c) => c.category === 'plugin' && !staticNames.has(c.name) && /^[a-z0-9_]+$/.test(c.name))
      .map((c) => ({ command: c.name, description: c.description.slice(0, 256) }))

    const allCommands = [...STATIC_COMMANDS, ...pluginCommands].slice(0, 100)

    this.retryWithBackoff(
      () => this.bot.api.setMyCommands(allCommands, {
        scope: { type: "chat", chat_id: this.telegramConfig.chatId },
      }),
      "setMyCommands",
    ).catch((err) => {
      log.warn({ err }, "Failed to register Telegram commands after retries (non-critical)");
    });
  }

  private async initTopicDependentFeatures(): Promise<void> {
    if (this._topicsInitialized) return; // idempotent guard
    log.info(
      { notificationTopicId: this.telegramConfig.notificationTopicId, assistantTopicId: this.telegramConfig.assistantTopicId },
      'initTopicDependentFeatures: starting (existing IDs in config)',
    );
    // Ensure system topics exist (retry on transient network failures)
    const topics = await this.retryWithBackoff(
      () => ensureTopics(
        this.bot,
        this.telegramConfig.chatId,
        this.telegramConfig,
        async (updates) => {
          if (this.saveTopicIds) {
            await this.saveTopicIds(updates);
          } else {
            // Fallback for legacy usage without plugin settings
            await this.core.configManager.save({
              channels: { telegram: updates },
            });
          }
        },
      ),
      "ensureTopics",
    );
    this.notificationTopicId = topics.notificationTopicId;
    this.assistantTopicId = topics.assistantTopicId;
    // Update the mutable ref so callbacks registered before bot.start() see the correct IDs
    this._systemTopicIds.notificationTopicId = topics.notificationTopicId;
    this._systemTopicIds.assistantTopicId = topics.assistantTopicId;
    log.info(
      { notificationTopicId: this.notificationTopicId, assistantTopicId: this.assistantTopicId },
      'initTopicDependentFeatures: topics ready',
    );

    // Send initial messages when a new session thread is created via API/CLI
    this._threadReadyHandler = ({ sessionId, channelId, threadId }) => {
      if (channelId !== "telegram") return;
      const session = this.core.sessionManager.getSession(sessionId);
      if (!session) return;
      const numThreadId = Number(threadId);
      if (!numThreadId) return;
      // Skip assistant session — it manages its own welcome message
      if (sessionId === this.core.assistantManager?.get('telegram')?.id) return;

      // Send "Setting up..." then control message with real session state
      this.sendQueue.enqueue(() =>
        this.bot.api.sendMessage(this.telegramConfig.chatId, `⏳ Setting up session, please wait...`, {
          message_thread_id: numThreadId,
          parse_mode: 'HTML',
        }),
      ).then(() =>
        this.sendQueue.enqueue(() =>
          this.bot.api.sendMessage(
            this.telegramConfig.chatId,
            buildSessionStatusText(session, '✅ <b>Session started</b>'),
            {
              message_thread_id: numThreadId,
              parse_mode: 'HTML',
              reply_markup: buildSessionControlKeyboard(sessionId, isBypassActive(session), session.voiceMode === "on"),
            },
          ),
        ),
      ).then((msg) => {
        if (msg) this.storeControlMsgId(sessionId, msg.message_id);
      }).catch((err) => {
        log.warn({ err, sessionId }, 'Failed to send initial messages for new session');
      });
    };
    this.core.eventBus.on(BusEvent.SESSION_THREAD_READY, this._threadReadyHandler);

    // Update control message when config changes via commands (/model, /mode, /bypass, etc.)
    this._configChangedHandler = ({ sessionId }) => {
      this.updateControlMessage(sessionId).catch(() => {});
    };
    this.core.eventBus.on("session:configChanged", this._configChangedHandler);

    // Show an inline notification when a message is actually placed in the pending queue
    // behind an active prompt. The PROMPT_WAITING event fires from inside PromptQueue.enqueue()
    // with accurate state, eliminating the race condition from checking promptRunning asynchronously.
    this.core.eventBus.on(BusEvent.PROMPT_WAITING, async (data) => {
      if (data.sourceAdapterId !== 'telegram') return;
      const session = this.core.sessionManager.getSession(data.sessionId);
      if (!session) return;
      const threadId = Number(session.threadId);
      if (!threadId) return;

      const position = data.queueDepth;
      const keyboard = new InlineKeyboard()
        .text('⏭ Process Now', `q:now:${data.sessionId}:${data.turnId}`)
        .text('🗑 Clear Queue', `q:clear:${data.sessionId}`)
        .row()
        .text('⛔ Cancel Current', `q:cancel:${data.sessionId}`)
        .text('🔄 Flush All', `q:flush:${data.sessionId}`);

      const text = [
        `📋 <b>Message queued</b> (#${position} in line)`,
        '',
        '<i>Agent is processing another prompt.</i>',
        '',
        '⏭ <b>Process Now</b> — Skip queue, process immediately',
        '🗑 <b>Clear Queue</b> — Remove queued messages',
        '⛔ <b>Cancel Current</b> — Stop current prompt',
        '🔄 <b>Flush All</b> — Cancel everything, start fresh',
      ].join('\n');

      // Mark as 'pending' BEFORE awaiting sendQueue so MESSAGE_PROCESSING can observe this
      // turnId and mark it for deletion if the message is processed before the notification is sent.
      // Without this, MESSAGE_PROCESSING may fire during the 3s sendQueue delay and see no entry.
      this._queueNotifications.set(data.turnId, 'pending');
      try {
        const result = await this.sendQueue.enqueue(() =>
          this.bot.api.sendMessage(this.telegramConfig.chatId, text, {
            message_thread_id: threadId,
            parse_mode: 'HTML',
            reply_markup: keyboard,
            disable_notification: true,
          }),
        );
        const current = this._queueNotifications.get(data.turnId);
        if (current === 'delete') {
          // MESSAGE_PROCESSING fired while we were waiting — delete the notification immediately
          this._queueNotifications.delete(data.turnId);
          if (result) {
            this.bot.api.deleteMessage(this.telegramConfig.chatId, result.message_id).catch((err) => {
              log.warn({ err }, 'Failed to delete queue notification after race');
            });
          }
        } else if (result) {
          this._queueNotifications.set(data.turnId, result.message_id);
        } else {
          this._queueNotifications.delete(data.turnId);
        }
      } catch (err) {
        this._queueNotifications.delete(data.turnId);
        log.warn({ err }, 'Failed to send queue notification');
      }
    });

    // Dismiss the queue notification once the queued message starts processing.
    // Handles two cases: notification already sent (number) → delete via API immediately;
    // notification still in sendQueue ('pending') → mark as 'delete' so the send handler cleans up.
    this.core.eventBus.on(BusEvent.MESSAGE_PROCESSING, async (data) => {
      const entry = this._queueNotifications.get(data.turnId);
      if (entry === undefined) return;
      if (typeof entry === 'number') {
        this._queueNotifications.delete(data.turnId);
        this.bot.api.deleteMessage(this.telegramConfig.chatId, entry).catch((err) => {
          log.warn({ err }, 'Failed to delete queue notification on processing');
        });
      } else if (entry === 'pending') {
        // Notification not sent yet — mark for deletion when the sendQueue flush completes
        this._queueNotifications.set(data.turnId, 'delete');
      }
      // 'delete' state: already handled
    });

    // Send welcome message
    log.info({ assistantTopicId: this.assistantTopicId }, 'initTopicDependentFeatures: sending welcome message');
    try {
      const config = this.core.configManager.get();
      const agents = this.core.agentManager.getAvailableAgents();
      const allRecords = this.core.sessionManager.listRecords();

      const welcomeText = buildWelcomeMessage({
        activeCount: allRecords.filter(
          (r) => r.status === "active" || r.status === "initializing",
        ).length,
        errorCount: allRecords.filter((r) => r.status === "error").length,
        totalCount: allRecords.length,
        agents: agents.map((a) => a.name),
        defaultAgent: config.defaultAgent,
        workspace: this.core.configManager.resolveWorkspace(),
      });

      await this.bot.api.sendMessage(this.telegramConfig.chatId, welcomeText, {
        message_thread_id: this.assistantTopicId,
        parse_mode: "HTML",
        reply_markup: buildMenuKeyboard(
          this.core.lifecycleManager?.serviceRegistry?.get('menu-registry') as import('../../core/menu-registry.js').MenuRegistry | undefined,
        ),
      });
      log.info('initTopicDependentFeatures: welcome message sent');
    } catch (err) {
      log.warn({ err }, "Failed to send welcome message");
    }

    // Spawn assistant via AssistantManager
    try {
      await this.core.assistantManager.getOrSpawn("telegram", String(this.assistantTopicId));
    } catch (err) {
      log.error({ err }, "Failed to spawn assistant");
    }

    this._topicsInitialized = true;
    log.info("Telegram adapter fully initialized");
  }

  /**
   * Handle the /retry command — re-runs prerequisite checks immediately.
   *
   * This command is allowed even before topics are initialized so users can
   * trigger a recheck right after fixing permissions, without waiting for the
   * next automatic retry cycle.
   */
  private async handleRetryCommand(ctx: { reply: (text: string, opts?: Record<string, unknown>) => Promise<unknown> }): Promise<void> {
    if (this._topicsInitialized) {
      await ctx.reply("✅ Viben is already running.").catch(() => {});
      return;
    }

    await ctx.reply("🔄 Re-checking prerequisites...").catch(() => {});

    const { checkTopicsPrerequisites } = await import('./validators.js');
    const result = await checkTopicsPrerequisites(
      this.telegramConfig.botToken,
      this.telegramConfig.chatId,
    );

    if (result.ok) {
      try {
        // Cancel the background watcher since we're handling init inline
        if (this._prerequisiteWatcher !== null) {
          clearTimeout(this._prerequisiteWatcher);
          this._prerequisiteWatcher = null;
        }
        await this.initTopicDependentFeatures();
        const assistantTopicLink = this.assistantTopicId
          ? ` <a href="https://t.me/c/${String(this.telegramConfig.chatId).replace(/^-100/, '')}/${this.assistantTopicId}">🤖 Assistant</a>`
          : ' 🤖 Assistant';
        await ctx.reply(
          `✅ <b>Viben is ready!</b> Tap${assistantTopicLink} to get started.`,
          { parse_mode: 'HTML' },
        ).catch(() => {});
      } catch (err) {
        log.error({ err }, 'handleRetryCommand: init failed after prerequisites met');
        await ctx.reply("⚠️ Prerequisites are met but initialization failed. Check server logs and try /retry again.").catch(() => {});
      }
    } else {
      const issueText = result.issues.join('\n\n');
      await ctx.reply(
        `⚠️ <b>Still not ready:</b>\n\n${issueText}\n\nFix the issues above and send /retry again.`,
        { parse_mode: 'HTML' },
      ).catch(() => {});
    }
  }

  private startPrerequisiteWatcher(issues: string[]): void {
    const setupMessage =
      `⚠️ <b>Viben needs setup before it can start.</b>\n\n` +
      issues.join('\n\n') +
      `\n\nViben will automatically retry every 30 seconds. After fixing the issues above, send /retry to re-check immediately.`;

    this.bot.api.sendMessage(this.telegramConfig.chatId, setupMessage, {
      parse_mode: 'HTML',
    }).catch((err) => {
      log.warn({ err }, 'Failed to send setup guidance to General topic');
    });

    const schedule = [5_000, 10_000, 30_000];
    let attempt = 1;

    const retry = async () => {
      if (this._prerequisiteWatcher === null) return; // cancelled by stop()

      const { checkTopicsPrerequisites } = await import('./validators.js');
      const result = await checkTopicsPrerequisites(
        this.telegramConfig.botToken,
        this.telegramConfig.chatId,
      );

      if (result.ok) {
        log.info('Prerequisites met — completing Telegram adapter initialization');
        try {
          await this.initTopicDependentFeatures();
          // Only cancel watcher after successful init — if init fails we keep retrying
          this._prerequisiteWatcher = null;
          const assistantTopicLink = this.assistantTopicId
            ? ` <a href="https://t.me/c/${String(this.telegramConfig.chatId).replace(/^-100/, '')}/${this.assistantTopicId}">🤖 Assistant</a>`
            : ' 🤖 Assistant';
          await this.bot.api.sendMessage(
            this.telegramConfig.chatId,
            `✅ <b>Viben is ready!</b>\n\nSystem topics have been created. Tap${assistantTopicLink} to get started.`,
            { parse_mode: 'HTML' },
          );
        } catch (err) {
          log.error({ err }, 'Failed to complete initialization after prerequisites met — will retry');
          // Don't cancel watcher; schedule next retry so init can be reattempted
          const delay = schedule[Math.min(attempt, schedule.length - 1)];
          attempt++;
          this._prerequisiteWatcher = setTimeout(retry, delay);
        }
        return;
      }

      log.debug({ issues: result.issues }, 'Prerequisites not yet met, retrying');
      const delay = schedule[Math.min(attempt, schedule.length - 1)];
      attempt++;
      this._prerequisiteWatcher = setTimeout(retry, delay);
    };

    this._prerequisiteWatcher = setTimeout(retry, schedule[0]);
  }

  /**
   * Tear down the bot and release all associated resources.
   *
   * Cancels the background prerequisite watcher, destroys all per-session activity
   * trackers (which hold interval timers), removes eventBus listeners, clears the
   * send queue, and stops the grammY bot polling loop.
   */
  async stop(): Promise<void> {
    this._stopping = true;

    // Cancel background prerequisite watcher if running
    if (this._prerequisiteWatcher !== null) {
      clearTimeout(this._prerequisiteWatcher);
      this._prerequisiteWatcher = null;
    }

    // Cleanup activity trackers (interval timers)
    for (const tracker of this.sessionTrackers.values()) {
      tracker.destroy();
    }
    this.sessionTrackers.clear();

    // Remove direct eventBus listeners
    if (this._threadReadyHandler) {
      this.core.eventBus.off(BusEvent.SESSION_THREAD_READY, this._threadReadyHandler);
      this._threadReadyHandler = undefined;
    }
    if (this._configChangedHandler) {
      this.core.eventBus.off("session:configChanged", this._configChangedHandler);
      this._configChangedHandler = undefined;
    }

    // Clear send queue
    this.sendQueue.clear();

    await this.bot.stop();
    log.info("Telegram bot stopped");
  }

  // --- CommandRegistry response rendering ---

  private async renderCommandResponse(
    response: CommandResponse,
    chatId: number,
    topicId?: number,
  ): Promise<void> {
    switch (response.type) {
      case "text":
        await this.bot.api.sendMessage(chatId, response.text, {
          message_thread_id: topicId,
        });
        break;
      case "adaptive": {
        const variant = response.variants?.['telegram'] as
          | { text?: string; parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2' }
          | undefined;
        const text = variant?.text ?? response.fallback;
        await this.bot.api.sendMessage(chatId, text, {
          message_thread_id: topicId,
          ...(variant?.parse_mode && { parse_mode: variant.parse_mode }),
        });
        break;
      }
      case "error":
        await this.bot.api.sendMessage(
          chatId,
          `\u26a0\ufe0f ${response.message}`,
          { message_thread_id: topicId },
        );
        break;
      case "menu": {
        const keyboard = response.options.map((opt) => [
          {
            text: `${opt.label}${opt.hint ? ` \u2014 ${opt.hint}` : ""}`,
            callback_data: this.toCallbackData(opt.command),
          },
        ]);
        await this.bot.api.sendMessage(chatId, response.title, {
          message_thread_id: topicId,
          reply_markup: { inline_keyboard: keyboard },
        });
        break;
      }
      case "list": {
        const lines = response.items.map(
          (i) => `\u2022 ${i.label}${i.detail ? ` \u2014 ${i.detail}` : ""}`,
        );
        const text = `${response.title}\n${lines.join("\n")}`;
        await this.bot.api.sendMessage(chatId, text, {
          message_thread_id: topicId,
        });
        break;
      }
      case "confirm": {
        const buttons = [
          [
            {
              text: "\u2705 Yes",
              callback_data: this.toCallbackData(response.onYes),
            },
          ],
        ];
        if (response.onNo) {
          buttons[0].push({
            text: "\u274c No",
            callback_data: this.toCallbackData(response.onNo),
          });
        }
        await this.bot.api.sendMessage(chatId, response.question, {
          message_thread_id: topicId,
          reply_markup: { inline_keyboard: buttons },
        });
        break;
      }
      case "silent":
        break;
    }
  }

  private toCallbackData(command: string): string {
    const data = `c/${command}`;
    if (data.length <= 64) return data;
    const id = String(++this.callbackCounter);
    this.callbackCache.set(id, command);
    if (this.callbackCache.size > 1000) {
      const first = this.callbackCache.keys().next().value;
      if (first) this.callbackCache.delete(first);
    }
    return `c/#${id}`;
  }

  private fromCallbackData(data: string): string {
    if (data.startsWith("c/#")) {
      return this.callbackCache.get(data.slice(3)) ?? data.slice(2);
    }
    return data.slice(2);
  }

  private setupRoutes(): void {
    this.bot.on("message:text", async (ctx) => {
      // Guard: topics not yet initialized — non-command messages would use stale/zero topic IDs
      if (!this._topicsInitialized) {
        await ctx.reply(
          "⏳ Viben is still setting up. Open the Topics list of this group and check the 📌 General topic for setup instructions. Or send /retry to re-check now.",
        ).catch(() => {});
        return;
      }

      const threadId = ctx.message.message_thread_id;
      const text = ctx.message.text;

      // General topic or no thread → redirect to assistant
      if (!threadId) {
        const html = redirectToAssistant(
          this.telegramConfig.chatId,
          this.assistantTopicId,
        );
        await ctx.reply(html, { parse_mode: "HTML" });
        return;
      }

      // Notification topic → ignore
      if (threadId === this.notificationTopicId) return;

      // Strip leading "/" from unrecognized commands — registered commands
      // are handled by the CommandRegistry dispatch middleware above.
      // Unrecognized slash commands are stripped to avoid agent subprocess hangs.
      const forwardText = text.startsWith("/") ? text.slice(1) : text;

      // All topics (including assistant) → forward to core
      const sessionId = (await this.core.getOrResumeSession(
        "telegram",
        String(threadId),
      ))?.id;
      if (sessionId) {
        this.getTracer(sessionId)?.log("telegram", { action: "incoming:message", sessionId, userId: String(ctx.from?.id), text: ctx.message?.text });
        const assistantSession = this.core.assistantManager?.get('telegram');
        await this.draftManager.finalize(sessionId, assistantSession?.id);
      }
      if (sessionId) {
        await this.drainAndResetTracker(sessionId);
      }
      ctx.replyWithChatAction("typing").catch(() => {});
      const fromName = [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(' ') || undefined
      this.core
        .handleMessage(
          {
            channelId: "telegram",
            threadId: String(threadId),
            userId: String(ctx.from.id),
            text: forwardText,
          },
          // Inject structured channel user info into TurnMeta so plugins can identify
          // the sender by name without adapter-specific fields on IncomingMessage.
          {
            channelUser: {
              channelId: 'telegram',
              userId: String(ctx.from.id),
              displayName: fromName,
              username: ctx.from.username,
            },
          },
        )
        .catch((err) => log.error({ err }, "handleMessage error"));
    });

    // --- Incoming media handlers ---

    this.bot.on("message:photo", async (ctx) => {
      const threadId = ctx.message.message_thread_id;
      if (!threadId || threadId === this.notificationTopicId) return;

      const photos = ctx.message.photo;
      const largest = photos[photos.length - 1];
      const ext = ".jpg";
      await this.handleIncomingMedia(
        threadId,
        ctx.from.id,
        largest.file_id,
        `photo${ext}`,
        "image/jpeg",
        ctx.message.caption || undefined,
      );
    });

    this.bot.on("message:document", async (ctx) => {
      const threadId = ctx.message.message_thread_id;
      if (!threadId || threadId === this.notificationTopicId) return;

      const doc = ctx.message.document;
      await this.handleIncomingMedia(
        threadId,
        ctx.from.id,
        doc.file_id,
        doc.file_name || "document",
        doc.mime_type || "application/octet-stream",
        ctx.message.caption || undefined,
      );
    });

    this.bot.on("message:voice", async (ctx) => {
      const threadId = ctx.message.message_thread_id;
      if (!threadId || threadId === this.notificationTopicId) return;

      const voice = ctx.message.voice;
      await this.handleIncomingMedia(
        threadId,
        ctx.from.id,
        voice.file_id,
        "voice.wav",
        "audio/wav",
        undefined,
        true,
      );
    });

    this.bot.on("message:audio", async (ctx) => {
      const threadId = ctx.message.message_thread_id;
      if (!threadId || threadId === this.notificationTopicId) return;

      const audio = ctx.message.audio;
      await this.handleIncomingMedia(
        threadId,
        ctx.from.id,
        audio.file_id,
        audio.file_name || "audio.mp3",
        audio.mime_type || "audio/mpeg",
        ctx.message.caption || undefined,
      );
    });

    this.bot.on("message:video_note", async (ctx) => {
      const threadId = ctx.message.message_thread_id;
      if (!threadId || threadId === this.notificationTopicId) return;

      const videoNote = ctx.message.video_note;
      await this.handleIncomingMedia(
        threadId,
        ctx.from.id,
        videoNote.file_id,
        "video_note.mp4",
        "video/mp4",
      );
    });
  }

  // --- MessagingAdapter overrides ---

  /**
   * Per-session serial dispatch queues.
   * SessionBridge fires sendMessage() as fire-and-forget, so multiple events
   * (tool_call, tool_update, text) can arrive concurrently. Without serialization,
   * fast handlers (tool_update) overtake slow ones (tool_call with draftManager.finalize),
   * causing out-of-order processing where a tool's completion update is processed before
   * its creation event. This queue ensures events are processed in the order they arrive.
   */
  private _dispatchQueues = new Map<string, Promise<void>>();

  /**
   * Drain pending event dispatches from the previous prompt, then reset the
   * activity tracker so late tool_call events don't leak into the new card.
   */
  private async drainAndResetTracker(sessionId: string): Promise<void> {
    const pendingDispatch = this._dispatchQueues.get(sessionId);
    if (pendingDispatch) await pendingDispatch;

    const tracker = this.sessionTrackers.get(sessionId);
    if (tracker) await tracker.onNewPrompt();
  }

  private getTracer(sessionId: string): DebugTracer | null {
    return this.core.sessionManager.getSession(sessionId)?.agentInstance?.debugTracer ?? null;
  }

  /**
   * Primary outbound dispatch method — routes an agent message to the session's Telegram topic.
   *
   * Wraps the base class `sendMessage` in a per-session promise chain (`_dispatchQueues`)
   * so that concurrent events fired from SessionBridge are serialized and delivered in the
   * order they arrive, preventing fast handlers from overtaking slower ones.
   */
  async sendMessage(
    sessionId: string,
    content: OutgoingMessage,
  ): Promise<void> {
    const session = this.core.sessionManager.getSession(sessionId);
    if (!session) return;

    // Drop messages while topic is being recreated (archive in progress)
    if (session.archiving) return;
    const threadId = Number(session.threadId);
    if (!threadId || isNaN(threadId)) {
      log.warn(
        { sessionId, threadId: session.threadId },
        "Session has no valid threadId, skipping message",
      );
      return;
    }

    // Serialize dispatch per session to preserve event ordering
    const prev = this._dispatchQueues.get(sessionId) ?? Promise.resolve();
    const next = prev.then(async () => {
      this.getTracer(sessionId)?.log("telegram", { action: "dispatch:enter", sessionId, message: content });
      this._sessionThreadIds.set(sessionId, threadId);
      try {
        await super.sendMessage(sessionId, content);
      } finally {
        this._sessionThreadIds.delete(sessionId);
      }
    }).catch((err) => {
      log.warn({ err, sessionId }, "Dispatch queue error");
    });
    this._dispatchQueues.set(sessionId, next);
    await next;
  }

  protected async handleThought(
    sessionId: string,
    content: OutgoingMessage,
    _verbosity: DisplayVerbosity,
  ): Promise<void> {
    this.getTracer(sessionId)?.log("telegram", { action: "handle:thought", sessionId, text: content.text });
    const threadId = this.getThreadId(sessionId);
    const mode = this.outputModeResolver.resolve(
      this.context.configManager,
      this.name,
      sessionId,
      this.core.sessionManager,
    );
    const tracker = this.getOrCreateTracker(sessionId, threadId, mode);
    await tracker.onThought(content.text);
  }

  protected async handleText(
    sessionId: string,
    content: OutgoingMessage,
  ): Promise<void> {
    this.getTracer(sessionId)?.log("telegram", { action: "handle:text", sessionId, text: content.text });
    const threadId = this.getThreadId(sessionId);
    // Per-session dispatch queue serializes all events, so we can safely await here.
    if (!this.draftManager.hasDraft(sessionId)) {
      const mode = this.outputModeResolver.resolve(
        this.context.configManager,
        this.name,
        sessionId,
        this.core.sessionManager,
      );
      const tracker = this.getOrCreateTracker(sessionId, threadId, mode);
      await tracker.onTextStart();
    }
    const draft = this.draftManager.getOrCreate(sessionId, threadId, this.getTracer(sessionId));
    draft.append(content.text);
    this.draftManager.appendText(sessionId, content.text);
  }

  protected async handleToolCall(
    sessionId: string,
    content: OutgoingMessage,
    _verbosity: DisplayVerbosity,
  ): Promise<void> {
    const threadId = this.getThreadId(sessionId);
    const meta = (content.metadata ?? {}) as Partial<ToolCallMeta>;
    this.getTracer(sessionId)?.log("telegram", { action: "handle:toolCall", sessionId, toolId: meta.id, toolName: meta.name, kind: meta.kind, status: meta.status, displaySummary: meta.displaySummary, rawInput: meta.rawInput });

    const mode = this.outputModeResolver.resolve(
      this.context.configManager,
      this.name,
      sessionId,
      this.core.sessionManager,
    );
    const tracker = this.getOrCreateTracker(sessionId, threadId, mode);
    await this.draftManager.finalize(sessionId, this.core.assistantManager?.get('telegram')?.id);
    await tracker.onToolCall(
      {
        id: meta.id ?? "",
        name: meta.name ?? content.text ?? "Tool",
        kind: meta.kind,
        status: meta.status,
        content: meta.content,
        rawInput: meta.rawInput,
        viewerLinks: meta.viewerLinks,
        viewerFilePath: meta.viewerFilePath,
        displaySummary: meta.displaySummary as string | undefined,
        displayTitle: meta.displayTitle as string | undefined,
        displayKind: meta.displayKind as string | undefined,
      },
      String(meta.kind ?? ""),
      meta.rawInput,
    );
  }

  protected async handleToolUpdate(
    sessionId: string,
    content: OutgoingMessage,
    _verbosity: DisplayVerbosity,
  ): Promise<void> {
    const threadId = this.getThreadId(sessionId);
    const meta = (content.metadata ?? {}) as Partial<ToolUpdateMeta>;
    this.getTracer(sessionId)?.log("telegram", { action: "handle:toolUpdate", sessionId, toolId: meta.id, name: meta.name, kind: meta.kind, status: meta.status, viewerLinks: meta.viewerLinks, viewerFilePath: meta.viewerFilePath });
    const mode = this.outputModeResolver.resolve(
      this.context.configManager,
      this.name,
      sessionId,
      this.core.sessionManager,
    );
    const tracker = this.getOrCreateTracker(sessionId, threadId, mode);
    await tracker.onToolUpdate(
      meta.id ?? "",
      meta.status ?? "completed",
      meta.viewerLinks as { file?: string; diff?: string } | undefined,
      meta.viewerFilePath as string | undefined,
      typeof meta.content === "string" ? meta.content : null,
      meta.rawInput ?? undefined,
      (meta as any).diffStats as { added: number; removed: number } | undefined,
    );
  }

  protected async handlePlan(
    sessionId: string,
    content: OutgoingMessage,
    _verbosity: DisplayVerbosity,
  ): Promise<void> {
    const threadId = this.getThreadId(sessionId);
    const meta = (content.metadata ?? {}) as Partial<PlanMetadata>;
    const entries = meta.entries ?? [];
    this.getTracer(sessionId)?.log("telegram", { action: "handle:plan", sessionId, entryCount: entries.length });
    const mode = this.outputModeResolver.resolve(
      this.context.configManager,
      this.name,
      sessionId,
      this.core.sessionManager,
    );
    const tracker = this.getOrCreateTracker(sessionId, threadId, mode);
    await tracker.onPlan(
      entries.map((e) => ({
        content: e.content,
        status: e.status as "pending" | "in_progress" | "completed",
        priority: (e.priority ?? "medium") as "high" | "medium" | "low",
      })),
    );
  }

  protected async handleUsage(
    sessionId: string,
    content: OutgoingMessage,
    verbosity: DisplayVerbosity,
  ): Promise<void> {
    const threadId = this.getThreadId(sessionId);
    const meta = content.metadata as UsageMetadata | undefined;
    this.getTracer(sessionId)?.log("telegram", { action: "handle:usage", sessionId, tokensUsed: meta?.tokensUsed, contextSize: meta?.contextSize, cost: (meta as Record<string, unknown>)?.cost });
    await this.draftManager.finalize(sessionId, this.core.assistantManager?.get('telegram')?.id);

    // Delete previous usage message for this session before sending the new one
    const prevUsageMsgId = this.usageMsgIds.get(sessionId);
    if (prevUsageMsgId) {
      this.sendQueue
        .enqueue(() => this.bot.api.deleteMessage(this.telegramConfig.chatId, prevUsageMsgId).catch(() => {}))
        .catch(() => {});
      this.usageMsgIds.delete(sessionId);
    }

    // Send usage as a separate message (not part of the tool card)
    const usageText = formatUsage(meta ?? {}, verbosity);
    let usageMsgId: number | undefined;
    try {
      const result = await this.sendQueue.enqueue(() =>
        this.bot.api.sendMessage(this.telegramConfig.chatId, usageText, {
          message_thread_id: threadId,
          parse_mode: "HTML",
          disable_notification: true,
        }),
      );
      usageMsgId = result?.message_id;
      if (usageMsgId) this.usageMsgIds.set(sessionId, usageMsgId);
    } catch (err) {
      log.warn({ err, sessionId }, "Failed to send usage message");
    }

  }

  protected async handleAttachment(
    sessionId: string,
    content: OutgoingMessage,
  ): Promise<void> {
    this.getTracer(sessionId)?.log("telegram", { action: "handle:attachment", sessionId, type: content.attachment?.type, fileName: content.attachment?.fileName });
    const threadId = this.getThreadId(sessionId);
    if (!content.attachment) return;
    const { attachment } = content;

    // Telegram bot API upload limit: 50MB
    if (attachment.size > 50 * 1024 * 1024) {
      log.warn(
        {
          sessionId,
          fileName: attachment.fileName,
          size: attachment.size,
        },
        "File too large for Telegram (>50MB)",
      );
      await this.sendQueue.enqueue(() =>
        this.bot.api.sendMessage(
          this.telegramConfig.chatId,
          `⚠️ File too large to send (${Math.round(attachment.size / 1024 / 1024)}MB): ${escapeHtml(attachment.fileName)}`,
          { message_thread_id: threadId, parse_mode: "HTML" },
        ),
      );
      return;
    }

    try {
      const inputFile = new InputFile(attachment.filePath);
      if (attachment.type === "image") {
        await this.sendQueue.enqueue(() =>
          this.bot.api.sendPhoto(this.telegramConfig.chatId, inputFile, {
            message_thread_id: threadId,
          }),
        );
      } else if (attachment.type === "audio") {
        await this.sendQueue.enqueue(() =>
          this.bot.api.sendVoice(this.telegramConfig.chatId, inputFile, {
            message_thread_id: threadId,
          }),
        );
        // Strip [TTS]...[/TTS] block from the text message after voice is sent
        const draft = this.draftManager.getDraft(sessionId);
        if (draft) {
          draft.stripPattern(/\[TTS\][\s\S]*?\[\/TTS\]/g).catch(() => {});
        }
      } else {
        await this.sendQueue.enqueue(() =>
          this.bot.api.sendDocument(this.telegramConfig.chatId, inputFile, {
            message_thread_id: threadId,
          }),
        );
      }
    } catch (err) {
      log.error(
        { err, sessionId, fileName: attachment.fileName },
        "Failed to send attachment",
      );
    }
  }

  protected async handleSessionEnd(
    sessionId: string,
    _content: OutgoingMessage,
  ): Promise<void> {
    this.getTracer(sessionId)?.log("telegram", { action: "handle:sessionEnd", sessionId });
    const threadId = this.getThreadId(sessionId);
    await this.draftManager.finalize(sessionId, this.core.assistantManager?.get('telegram')?.id);
    this.draftManager.cleanup(sessionId);
    await this.skillManager.cleanup(sessionId);

    // Notify the Notifications topic once the turn is fully done
    const lastUsageMsgId = this.usageMsgIds.get(sessionId);
    this.usageMsgIds.delete(sessionId);
    if (this.notificationTopicId && sessionId !== this.core.assistantManager?.get('telegram')?.id) {
      const sess = this.core.sessionManager.getSession(sessionId);
      const sessionName = sess?.name || "Session";
      const chatIdStr = String(this.telegramConfig.chatId);
      const numericId = chatIdStr.startsWith("-100")
        ? chatIdStr.slice(4)
        : chatIdStr.replace("-", "");
      const deepLink = lastUsageMsgId
        ? `https://t.me/c/${numericId}/${threadId}/${lastUsageMsgId}`
        : `https://t.me/c/${numericId}/${threadId}`;
      const text = `✅ <b>${escapeHtml(sessionName)}</b>\nTask completed.\n\n<a href="${deepLink}">→ Go to topic</a>`;
      this.sendQueue
        .enqueue(() =>
          this.bot.api.sendMessage(this.telegramConfig.chatId, text, {
            message_thread_id: this.notificationTopicId,
            parse_mode: "HTML",
            disable_notification: false,
          }),
        )
        .catch(() => {});
    }
    const tracker = this.sessionTrackers.get(sessionId);
    if (tracker) {
      await tracker.cleanup();
      this.sessionTrackers.delete(sessionId);
    } else {
      await this.sendQueue.enqueue(() =>
        this.bot.api.sendMessage(this.telegramConfig.chatId, `✅ <b>Done</b>`, {
          message_thread_id: threadId,
          parse_mode: "HTML",
          disable_notification: true,
        }),
      );
    }
  }

  protected async handleConfigUpdate(
    sessionId: string,
    _content: OutgoingMessage,
  ): Promise<void> {
    await this.updateControlMessage(sessionId);
  }

  /**
   * Edit the pinned control message to reflect current session state
   * (model, thought level, mode, bypass status).
   */
  async updateControlMessage(sessionId: string): Promise<void> {
    const session = this.core.sessionManager.getSession(sessionId);
    if (!session) return;

    const controlMsgId = this.getControlMsgId(sessionId);
    if (!controlMsgId) return;

    const threadId = Number(session.threadId);
    if (!threadId || isNaN(threadId)) return;

    const text = buildSessionStatusText(session);
    const keyboard = buildSessionControlKeyboard(
      sessionId,
      isBypassActive(session),
      session.voiceMode === "on",
    );

    try {
      // Update text first
      await this.bot.api.editMessageText(
        this.telegramConfig.chatId,
        controlMsgId,
        text,
        { parse_mode: "HTML" },
      );
      // Then update keyboard separately
      await this.bot.api.editMessageReplyMarkup(
        this.telegramConfig.chatId,
        controlMsgId,
        { reply_markup: keyboard },
      );
    } catch {
      /* message unchanged or deleted — ignore */
    }
  }

  protected async handleError(
    sessionId: string,
    content: OutgoingMessage,
  ): Promise<void> {
    this.getTracer(sessionId)?.log("telegram", { action: "handle:error", sessionId, text: content.text });
    const threadId = this.getThreadId(sessionId);
    await this.draftManager.finalize(sessionId, this.core.assistantManager?.get('telegram')?.id);
    const tracker = this.sessionTrackers.get(sessionId);
    if (tracker) {
      tracker.destroy();
      this.sessionTrackers.delete(sessionId);
    }
    await this.sendQueue.enqueue(() =>
      this.bot.api.sendMessage(
        this.telegramConfig.chatId,
        `❌ <b>Error:</b> ${escapeHtml(content.text)}`,
        {
          message_thread_id: threadId,
          parse_mode: "HTML",
          disable_notification: true,
        },
      ),
    );
  }

  protected async handleSystem(
    sessionId: string,
    content: OutgoingMessage,
  ): Promise<void> {
    this.getTracer(sessionId)?.log("telegram", { action: "handle:system", sessionId, text: content.text });
    const threadId = this.getThreadId(sessionId);
    await this.sendQueue.enqueue(() =>
      this.bot.api.sendMessage(
        this.telegramConfig.chatId,
        escapeHtml(content.text),
        {
          message_thread_id: threadId,
          parse_mode: "HTML",
          disable_notification: true,
        },
      ),
    );
  }

  /**
   * Render a PermissionRequest as an inline keyboard in the session topic and
   * notify the Notifications topic. Runs inside a sendQueue item, so
   * notification is fire-and-forget to avoid deadlock.
   */
  async sendPermissionRequest(
    sessionId: string,
    request: PermissionRequest,
  ): Promise<void> {
    this.getTracer(sessionId)?.log("telegram", { action: "permission:send", sessionId, requestId: request.id, description: request.description });
    log.info({ sessionId, requestId: request.id }, "Permission request sent");
    const session = this.core.sessionManager.getSession(sessionId);
    if (!session) return;

    await this.sendQueue.enqueue(() =>
      this.permissionHandler.sendPermissionRequest(session, request),
    );
  }

  /**
   * Post a notification to the Notifications topic.
   * Assistant session notifications are suppressed — the assistant topic is
   * the user's primary interface and does not need a separate alert.
   */
  async sendNotification(notification: NotificationMessage): Promise<void> {
    this.getTracer(notification.sessionId)?.log("telegram", { action: "notification:send", sessionId: notification.sessionId, type: notification.type });
    if (notification.sessionId === this.core.assistantManager?.get('telegram')?.id) return;

    log.info(
      { sessionId: notification.sessionId, type: notification.type },
      "Notification sent",
    );
    if (!this.notificationTopicId) return;
    const emoji: Record<string, string> = {
      completed: "✅",
      error: "❌",
      permission: "🔐",
      input_required: "💬",
    };
    let text = `${emoji[notification.type] || "ℹ️"} <b>${escapeHtml(notification.sessionName || "New session")}</b>\n`;
    text += escapeHtml(notification.summary);

    const deepLink =
      notification.deepLink ??
      (() => {
        const session = this.core.sessionManager.getSession(
          notification.sessionId,
        );
        const threadId = session?.threadId;
        if (!threadId) return undefined;
        const chatIdStr = String(this.telegramConfig.chatId);
        const numericId = chatIdStr.startsWith("-100")
          ? chatIdStr.slice(4)
          : chatIdStr.replace("-", "");
        return `https://t.me/c/${numericId}/${threadId}`;
      })();

    if (deepLink) {
      text += `\n\n<a href="${deepLink}">→ Go to topic</a>`;
    }

    await this.sendQueue.enqueue(() =>
      this.bot.api.sendMessage(this.telegramConfig.chatId, text, {
        message_thread_id: this.notificationTopicId,
        parse_mode: "HTML",
        disable_notification: false,
      }),
    );
  }

  /**
   * Create a new Telegram forum topic for a session and return its thread ID as a string.
   * Called by the core when a session is created via the API or CLI (not from the Telegram UI).
   *
   * Sends "⏳ Setting up..." immediately after topic creation so the user sees
   * activity while the agent subprocess initializes in the background.
   */
  async createSessionThread(sessionId: string, name: string): Promise<string> {
    this.getTracer(sessionId)?.log("telegram", { action: "thread:create", sessionId, name });
    log.info({ sessionId, name }, "Session topic created");
    const threadId = await createSessionTopic(this.bot, this.telegramConfig.chatId, name);
    // Non-critical — fire and forget so topic creation still succeeds even if this fails
    this.bot.api.sendMessage(
      this.telegramConfig.chatId,
      "⏳ Setting up session, please wait...",
      { message_thread_id: threadId, parse_mode: "HTML" },
    ).catch((err) => {
      log.warn({ err, sessionId, threadId }, "Failed to send setup message to new topic");
    });
    return String(threadId);
  }

  /**
   * Rename the forum topic for a session and update the session record's display name.
   * No-ops silently if the session doesn't have a threadId yet (e.g. still initializing).
   */
  async renameSessionThread(sessionId: string, newName: string): Promise<void> {
    this.getTracer(sessionId)?.log("telegram", { action: "thread:rename", sessionId, newName });
    const session = this.core.sessionManager.getSession(sessionId);
    if (!session) return;
    const threadId = Number(session.threadId);
    if (!threadId) {
      log.debug({ sessionId, newName }, "Cannot rename thread — threadId not set yet");
      return;
    }
    await renameSessionTopic(
      this.bot,
      this.telegramConfig.chatId,
      threadId,
      newName,
    );
    await this.core.sessionManager.patchRecord(sessionId, { name: newName });
  }

  /** Delete the forum topic associated with a session. */
  async deleteSessionThread(sessionId: string): Promise<void> {
    const record = this.core.sessionManager.getSessionRecord(sessionId);
    const platform = record?.platform as
      | import("../../core/types.js").TelegramPlatformData
      | undefined;
    const topicId = platform?.topicId;
    if (!topicId) return;

    try {
      await this.bot.api.deleteForumTopic(this.telegramConfig.chatId, topicId);
    } catch (err) {
      log.warn(
        { err, sessionId, topicId },
        "Failed to delete forum topic (may already be deleted)",
      );
    }
  }

  /**
   * Display or update the pinned skill commands message for a session.
   * If the session's threadId is not yet set (e.g. session created from API),
   * the commands are queued and flushed once the thread becomes available.
   */
  async sendSkillCommands(
    sessionId: string,
    commands: AgentCommand[],
  ): Promise<void> {
    if (sessionId === this.core.assistantManager?.get('telegram')?.id) return;

    const session = this.core.sessionManager.getSession(sessionId);
    if (!session) return;
    const threadId = Number(session.threadId);
    if (!threadId) {
      // Queue for later — flushed when threadId is assigned via flushPendingSkillCommands()
      this._pendingSkillCommands.set(sessionId, commands);
      return;
    }

    await this.skillManager.send(sessionId, threadId, commands);
  }

  /** Flush any skill commands that were queued before threadId was available */
  async flushPendingSkillCommands(sessionId: string): Promise<void> {
    const commands = this._pendingSkillCommands.get(sessionId);
    if (!commands) return;
    this._pendingSkillCommands.delete(sessionId);
    const session = this.core.sessionManager.getSession(sessionId);
    if (!session) return;
    const threadId = Number(session.threadId);
    if (!threadId) return;
    await this.skillManager.send(sessionId, threadId, commands);
  }

  private async resolveSessionId(threadId: number): Promise<string | undefined> {
    return (await this.core.getOrResumeSession(
      "telegram",
      String(threadId),
    ))?.id;
  }

  private async downloadTelegramFile(
    fileId: string,
  ): Promise<{ buffer: Buffer; filePath: string } | null> {
    try {
      const file = await this.bot.api.getFile(fileId);
      if (!file.file_path) return null;
      const url = `https://api.telegram.org/file/bot${this.telegramConfig.botToken}/${file.file_path}`;
      const response = await fetch(url);
      if (!response.ok) return null;
      const buffer = Buffer.from(await response.arrayBuffer());
      return { buffer, filePath: file.file_path };
    } catch (err) {
      log.error({ err }, "Failed to download file from Telegram");
      return null;
    }
  }

  private async handleIncomingMedia(
    threadId: number,
    userId: number,
    fileId: string,
    fileName: string,
    mimeType: string,
    caption?: string,
    convertOggToWav?: boolean,
  ): Promise<void> {
    const downloaded = await this.downloadTelegramFile(fileId);
    if (!downloaded) return;

    let buffer = downloaded.buffer;
    let originalFilePath: string | undefined;
    const sessionId = (await this.resolveSessionId(threadId)) || "unknown";

    if (convertOggToWav) {
      // Save original OGG for STT (smaller, API-compatible)
      const oggAtt = await this.fileService.saveFile(
        sessionId,
        "voice.ogg",
        downloaded.buffer,
        "audio/ogg",
      );
      originalFilePath = oggAtt.filePath;

      try {
        buffer = await this.fileService.convertOggToWav(buffer);
      } catch (err) {
        log.warn({ err }, "OGG→WAV conversion failed, saving original OGG");
        fileName = "voice.ogg";
        mimeType = "audio/ogg";
        originalFilePath = undefined;
      }
    }

    const att = await this.fileService.saveFile(
      sessionId,
      fileName,
      buffer,
      mimeType,
    );
    if (originalFilePath) {
      att.originalFilePath = originalFilePath;
    }

    const rawText =
      caption ||
      `[${att.type === "image" ? "Photo" : att.type === "audio" ? "Audio" : "File"}: ${att.fileName}]`;
    const text = rawText.startsWith("/") ? rawText.slice(1) : rawText;

    // Assistant topic
    if (threadId === this.assistantTopicId) {
      const assistantSession = this.core.assistantManager?.get('telegram');
      if (assistantSession) {
        await assistantSession.enqueuePrompt(text, [att]);
      }
      return;
    }

    // Session topic
    const sid = await this.resolveSessionId(threadId);
    if (sid) {
      await this.draftManager.finalize(sid, this.core.assistantManager?.get('telegram')?.id);
      await this.drainAndResetTracker(sid);
    }
    this.core
      .handleMessage({
        channelId: "telegram",
        threadId: String(threadId),
        userId: String(userId),
        text,
        attachments: [att],
      })
      .catch((err) => log.error({ err }, "handleMessage error"));
  }

  /**
   * Remove skill slash commands from the Telegram bot command list for a session.
   *
   * Clears any queued pending commands that hadn't been sent yet, then delegates
   * to `SkillCommandManager` to delete the commands from the Telegram API. Called
   * when a session with registered skill commands ends.
   */
  async cleanupSkillCommands(sessionId: string): Promise<void> {
    this._pendingSkillCommands.delete(sessionId);
    await this.skillManager.cleanup(sessionId);
  }

  /**
   * Clean up all adapter state associated with a session.
   *
   * Finalizes and discards any in-flight draft, destroys the activity tracker
   * (stopping ThinkingIndicator timers and finalizing any open ToolCard), and
   * clears pending skill commands. Called when a session ends or is reset.
   */
  async cleanupSessionState(sessionId: string): Promise<void> {
    this._pendingSkillCommands.delete(sessionId);
    // Finalize and clean up draft state
    await this.draftManager.finalize(sessionId, this.core.assistantManager?.get('telegram')?.id);
    this.draftManager.cleanup(sessionId);

    // Destroy activity tracker (stops ThinkingIndicator timers, finalizes ToolCard)
    const tracker = this.sessionTrackers.get(sessionId);
    if (tracker) {
      tracker.destroy();
      this.sessionTrackers.delete(sessionId);
    }
  }

  /**
   * Remove `[TTS]...[/TTS]` blocks from the active or finalized draft for a session.
   *
   * The agent embeds these blocks so the speech plugin can extract the TTS text, but
   * they should never appear in the chat message. Called after TTS audio has been sent.
   */
  async stripTTSBlock(sessionId: string): Promise<void> {
    await this.draftManager.stripPattern(sessionId, /\[TTS\][\s\S]*?\[\/TTS\]/g);
  }

  /**
   * Archive a session by deleting its forum topic.
   *
   * Sets `session.archiving = true` to suppress any outgoing messages while the
   * topic is being torn down, finalizes pending drafts, cleans up all trackers,
   * then deletes the Telegram topic (which removes all messages).
   */
  async archiveSessionTopic(sessionId: string): Promise<void> {
    this.getTracer(sessionId)?.log("telegram", { action: "thread:archive", sessionId });
    const core = this.core as VibenCore;
    const session = core.sessionManager.getSession(sessionId);

    const chatId = this.telegramConfig.chatId;
    let oldTopicId: number;

    if (session) {
      // Set archiving flag — sendMessage will skip while this is true.
      session.archiving = true;
      oldTopicId = Number(session.threadId);

      // Finalize any pending draft
      await this.draftManager.finalize(session.id, this.core.assistantManager?.get('telegram')?.id);

      // Cleanup all trackers
      this.draftManager.cleanup(session.id);
      await this.skillManager.cleanup(session.id);
      const tracker = this.sessionTrackers.get(session.id);
      if (tracker) {
        tracker.destroy();
        this.sessionTrackers.delete(session.id);
      }
    } else {
      // Session not in memory — get topicId from stored record
      const record = core.sessionManager.getSessionRecord(sessionId);
      const platform = record?.platform as TelegramPlatformData | undefined;
      if (!platform?.topicId) throw new Error("Session not found");
      oldTopicId = platform.topicId;
    }

    // Delete topic (removes all messages) — no recreation
    await deleteSessionTopic(this.bot, chatId, oldTopicId);
  }
}
