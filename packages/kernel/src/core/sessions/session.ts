import { nanoid } from "nanoid";
import type { AgentInstance } from "../agents/agent-instance.js";
import type { AgentCapabilities, AgentCommand, AgentEvent, AgentSwitchEntry, Attachment, PermissionRequest, SessionStatus, ConfigOption, SessionModeState, SessionModelState, TurnMeta } from "../types.js";
import { TypedEmitter } from "../utils/typed-emitter.js";
import { PromptQueue } from "./prompt-queue.js";
import { PermissionGate } from "./permission-gate.js";
import { createChildLogger, createSessionLogger, closeSessionLogger, type Logger } from "../utils/log.js";
import type { SpeechService } from "../../plugins/speech/exports.js";
import type { MiddlewareChain } from "../plugin/middleware-chain.js";
import * as fs from "node:fs";
import type { TurnRouting } from "./turn-context.js";
import { createTurnContext, type TurnContext } from "./turn-context.js";
import { Hook, SessionEv } from "../events.js";
const moduleLog = createChildLogger({ module: "session" });

function formatPromptError(err: unknown): string {
  const message = extractErrorMessage(err);
  return message ?? "Unknown error";
}

function extractErrorMessage(value: unknown, seen = new WeakSet<object>()): string | null {
  if (typeof value === "string") return normalizeErrorMessage(value);
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  if (value == null || typeof value !== "object") return null;
  if (seen.has(value)) return null;
  seen.add(value);

  if (value instanceof Error) {
    const direct = normalizeErrorMessage(value.message);
    if (direct && !isGenericPromptErrorMessage(direct)) return direct;

    const cause = extractErrorMessage((value as { cause?: unknown }).cause, seen);
    if (cause) return cause;

    return direct ?? normalizeErrorMessage(value.name);
  }

  const record = value as Record<string, unknown>;
  const direct = typeof record.message === "string" ? normalizeErrorMessage(record.message) : null;
  if (direct && !isGenericPromptErrorMessage(direct)) return direct;

  for (const key of ["error", "reason", "details", "detail", "data", "cause"]) {
    const nested = extractErrorMessage(record[key], seen);
    if (nested) return nested;
  }
  // "message" is already captured in `direct` above; use it as last resort before JSON fallback.
  if (direct) return direct;

  try {
    const json = JSON.stringify(value);
    const jsonMessage = json ? normalizeErrorMessage(json) : null;
    if (jsonMessage && jsonMessage !== "{}") return jsonMessage;
  } catch {
    // Fall through to a stable fallback below.
  }

  const name = (value as { constructor?: { name?: string } }).constructor?.name;
  return name && name !== "Object" ? name : null;
}

function normalizeErrorMessage(message: string | undefined): string | null {
  const trimmed = message?.trim();
  if (!trimmed || trimmed === "[object Object]" || trimmed === "undefined" || trimmed === "null") {
    return null;
  }
  return trimmed;
}

// JSON-RPC -32603 surfaces "Internal error" as its top-level message, which is not
// meaningful to users. Skip it and look for a more specific cause in nested fields.
function isGenericPromptErrorMessage(message: string): boolean {
  return message === "Internal error";
}

// TTS injection pattern: we append TTS_PROMPT_INSTRUCTION to the user's prompt so the
// agent includes a [TTS]...[/TTS] block in its response. After the response completes,
// we extract that block via TTS_BLOCK_REGEX and synthesize speech from it. The TTS block
// is then stripped from the text shown to the user (via tts_strip event).
export const TTS_PROMPT_INSTRUCTION = `\n\nAdditionally, include a [TTS]...[/TTS] block with a spoken-friendly summary of your response. Focus on key information, decisions the user needs to make, or actions required. The agent decides what to say and how long. Respond in the same language the user is using. This instruction applies to this message only.`;
export const TTS_BLOCK_REGEX = /\[TTS\]([\s\S]*?)\[\/TTS\]/;
export const TTS_MAX_LENGTH = 5000;
export const TTS_TIMEOUT_MS = 30_000;

// Session state machine — valid transitions: from → Set<to>
//
//   initializing → active (first prompt received)
//                → error  (agent spawn failed)
//   active       → error     (unrecoverable prompt failure)
//                → finished  (agent signaled session_end)
//                → cancelled (user cancelled the session)
//   error        → active    (retry: user sends a new prompt)
//                → cancelled (user gives up)
//   cancelled    → active    (resume: user sends a new prompt)
//   finished     → (terminal — no further transitions)
const VALID_TRANSITIONS: Record<SessionStatus, Set<SessionStatus>> = {
  initializing: new Set(["active", "error"]),
  active: new Set(["error", "finished", "cancelled"]),
  error: new Set(["active", "cancelled"]),
  cancelled: new Set(["active"]),
  finished: new Set(),
};

/** Events emitted by a Session instance — SessionBridge subscribes to relay them to adapters. */
export interface SessionEvents {
  agent_event: (event: AgentEvent) => void;
  permission_request: (request: PermissionRequest) => void;
  session_end: (reason: string) => void;
  status_change: (from: SessionStatus, to: SessionStatus) => void;
  named: (name: string) => void;
  error: (error: Error) => void;
  prompt_count_changed: (count: number) => void;
  turn_started: (ctx: TurnContext) => void;
  /** Fired synchronously when a prompt is placed behind a running prompt in the queue. */
  prompt_queued: (data: { turnId: string | undefined; position: number; routing: TurnRouting | undefined }) => void;
}

/**
 * Manages a single conversation between a user and an AI agent.
 *
 * Wraps an AgentInstance with serial prompt queuing (via PromptQueue), permission
 * gating (via PermissionGate), TTS/STT integration, auto-naming, and a state
 * machine tracking the session lifecycle. SessionBridge subscribes to this
 * emitter to forward agent output to channel adapters.
 *
 * A session can be attached to multiple adapters simultaneously (e.g., Telegram
 * and SSE). The `threadIds` map tracks which thread each adapter uses.
 */
export class Session extends TypedEmitter<SessionEvents> {
  id: string;
  channelId: string;
  /** @deprecated Use threadIds map directly. Getter returns primary adapter's threadId. */
  get threadId(): string {
    return this.threadIds.get(this.channelId) ?? "";
  }
  set threadId(value: string) {
    if (value) {
      this.threadIds.set(this.channelId, value);
    }
  }
  agentName: string;
  workingDirectory: string;
  private _agentInstance!: AgentInstance;
  get agentInstance(): AgentInstance { return this._agentInstance; }
  /** Setting agentInstance wires the agent→session event relay and commands buffer.
   *  This happens both at construction and on agent switch (switchAgent). */
  set agentInstance(agent: AgentInstance) {
    this._agentInstance = agent;
    this.wireAgentRelay();
    this.wireCommandsBuffer();
  }
  agentSessionId: string = "";
  private _status: SessionStatus = "initializing";
  name?: string;
  createdAt: Date = new Date();
  voiceMode: "off" | "next" | "on" = "off";
  configOptions: ConfigOption[] = [];
  clientOverrides: { bypassPermissions?: boolean } = {};
  agentCapabilities?: AgentCapabilities;
  archiving: boolean = false;
  promptCount: number = 0;
  firstAgent: string;
  agentSwitchHistory: AgentSwitchEntry[] = [];
  isAssistant: boolean = false;
  log: Logger;
  middlewareChain?: MiddlewareChain;
  /** Latest commands emitted by the agent — buffered before bridge connects so they're not lost */
  latestCommands: AgentCommand[] | null = null;
  /** Adapters currently attached to this session (including primary) */
  attachedAdapters: string[] = [];
  /** Per-adapter thread IDs: adapterId → threadId */
  threadIds: Map<string, string> = new Map();
  /** Active turn context — sealed on prompt dequeue, cleared on turn end */
  activeTurnContext: TurnContext | null = null;

  readonly permissionGate = new PermissionGate();
  private readonly queue: PromptQueue;
  private speechService?: SpeechService;
  private pendingContext: string | null = null;
  /** Per-turn abort tracking — avoids race when next turn resets before current turn reads */
  private _abortedTurnIds = new Set<string>();
  /** Last completed turnId — used by abortPrompt() to retroactively mark a just-finished turn as interrupted */
  private _lastCompletedTurnId: string | null = null;

  private _autoApprovedCommands: string[] = []

  get autoApprovedCommands(): string[] {
    return this._autoApprovedCommands
  }

  constructor(opts: {
    id?: string;
    channelId: string;
    agentName: string;
    workingDirectory: string;
    agentInstance: AgentInstance;
    speechService?: SpeechService;
    isAssistant?: boolean;
    autoApprovedCommands?: string[];
  }) {
    super();
    this.id = opts.id || nanoid(12);
    this.channelId = opts.channelId;
    this.attachedAdapters = [opts.channelId];
    this.agentName = opts.agentName;
    this.firstAgent = opts.agentName;
    this.workingDirectory = opts.workingDirectory;
    this.agentInstance = opts.agentInstance;
    this.speechService = opts.speechService;
    this.isAssistant = opts.isAssistant ?? false;
    this._autoApprovedCommands = opts.autoApprovedCommands ?? [];
    this.log = createSessionLogger(this.id, moduleLog);
    this.log.info({ agentName: this.agentName }, "Session created");

    this.queue = new PromptQueue(
      (text, userPrompt, attachments, routing, turnId, meta) => this.processPrompt(text, userPrompt, attachments, routing, turnId, meta),
      (err) => {
        this.log.error({ err }, "Prompt execution failed");
        const message = formatPromptError(err);
        this.fail(message);
        this.emit(SessionEv.AGENT_EVENT, { type: "error", message: `Prompt execution failed: ${message}` });
      },
      (turnId, position, routing) => {
        this.emit(SessionEv.PROMPT_QUEUED, { turnId, position, routing });
      },
    );

  }

  /** Wire the agent→session event relay on the current agentInstance.
   *  Removes any previous relay first to avoid duplicates on agent switch.
   *  This relay ensures session.emit("agent_event") fires for ALL sessions,
   *  including headless API sessions that have no SessionBridge attached. */
  private agentRelayCleanup?: () => void;
  private wireAgentRelay(): void {
    this.agentRelayCleanup?.();
    const instance = this._agentInstance;
    const handler = (event: AgentEvent) => {
      this.emit(SessionEv.AGENT_EVENT, event);
    };
    instance.on(SessionEv.AGENT_EVENT, handler);
    this.agentRelayCleanup = () => instance.off(SessionEv.AGENT_EVENT, handler);
  }

  /** Wire a listener on the current agentInstance to buffer commands_update events.
   *  Must be called after every agentInstance replacement (constructor + switchAgent). */
  private commandsBufferCleanup?: () => void;
  private wireCommandsBuffer(): void {
    // Remove previous listener (if switching agents) to avoid leaks
    this.commandsBufferCleanup?.();
    const instance = this._agentInstance;
    const handler = (event: AgentEvent) => {
      if (event.type === "commands_update") {
        this.latestCommands = event.commands;
      }
    };
    instance.on(SessionEv.AGENT_EVENT, handler);
    this.commandsBufferCleanup = () => instance.off(SessionEv.AGENT_EVENT, handler);
  }

  // --- State Machine ---

  get status(): SessionStatus {
    return this._status;
  }


  /** Transition to active — from initializing, error, or cancelled */
  activate(): void {
    this.transition("active");
  }

  /** Transition to error — from initializing or active. Idempotent if already in error. */
  fail(reason: string): void {
    if (this._status === "error") return;
    this.transition("error");
    this.emit(SessionEv.ERROR, new Error(reason));
  }

  /** Transition to finished — from active only. Emits session_end for backward compat. */
  finish(reason?: string): void {
    this.transition("finished");
    this.emit(SessionEv.SESSION_END, reason ?? "completed");
  }

  /** Transition to cancelled — from active or error (terminal session cancel) */
  markCancelled(): void {
    this.transition("cancelled");
  }

  private transition(to: SessionStatus): void {
    const from = this._status;
    const allowed = VALID_TRANSITIONS[from];
    if (!allowed?.has(to)) {
      throw new Error(
        `Invalid session transition: ${from} → ${to}`,
      );
    }
    this._status = to;
    this.log.debug({ from, to }, "Session status transition");
    this.emit(SessionEv.STATUS_CHANGE, from, to);
  }

  /** Number of prompts waiting in queue */
  get queueDepth(): number {
    return this.queue.pending;
  }

  /** Whether a prompt is currently being processed by the agent */
  get promptRunning(): boolean {
    return this.queue.isProcessing;
  }

  /** Snapshot of queued (not yet processing) items — for inspection by API consumers. */
  get queueItems() {
    return this.queue.pendingItems;
  }

  // --- Context Injection ---

  /** Store context markdown to be prepended to the next prompt (used for session resume with history). */
  setContext(markdown: string): void {
    this.pendingContext = markdown;
  }

  // --- Voice Mode ---

  /** Set TTS mode: "off" = disabled, "next" = one-shot (auto-resets after prompt), "on" = persistent. */
  setVoiceMode(mode: "off" | "next" | "on"): void {
    this.voiceMode = mode;
    this.log.info({ voiceMode: mode }, "TTS mode changed");
  }

  // --- Public API ---

  /**
   * Enqueue a user prompt for serial processing.
   *
   * Runs the prompt through agent:beforePrompt middleware (which can modify or block),
   * then adds it to the PromptQueue. Returns a turnId that callers can use to correlate
   * queued/processing events before the prompt actually runs.
   */
  async enqueuePrompt(text: string, attachments?: Attachment[], routing?: TurnRouting, externalTurnId?: string, meta?: TurnMeta): Promise<string> {
    // Use pre-generated turnId if provided (so callers can emit events before awaiting the queue)
    const turnId = externalTurnId ?? nanoid(8);
    const turnMeta: TurnMeta = meta ?? { turnId };
    // Capture raw user prompt before middleware can modify it
    const userPrompt = text;
    // Hook: agent:beforePrompt — modifiable, can block
    if (this.middlewareChain) {
      const payload = { text, attachments, sessionId: this.id, sourceAdapterId: routing?.sourceAdapterId, meta: turnMeta };
      const result = await this.middlewareChain.execute(Hook.AGENT_BEFORE_PROMPT, payload, async (p) => p);
      if (!result) throw new Error('PROMPT_BLOCKED'); // blocked by middleware — caller must emit message:failed
      text = result.text;
      attachments = result.attachments;
    }
    await this.queue.enqueue(text, userPrompt, attachments, routing, turnId, turnMeta);
    return turnId;
  }

  private async processPrompt(text: string, userPrompt: string, attachments?: Attachment[], routing?: TurnRouting, turnId?: string, meta?: TurnMeta): Promise<void> {
    // Don't process prompts for finished sessions (queue may still drain)
    if (this._status === "finished") return;

    // Seal turn context — bridges use this to decide routing for every emitted event
    // Pass the pre-generated turnId so message:queued and message:processing share the same ID
    this.activeTurnContext = createTurnContext(
      routing?.sourceAdapterId ?? this.channelId,
      routing?.responseAdapterId,
      turnId,
      userPrompt,
      text,      // finalPrompt (after middleware transformations)
      attachments,
      meta,
    );

    // Emit turn_started so SessionBridge can emit message:processing on EventBus
    this.emit(SessionEv.TURN_STARTED, this.activeTurnContext);

    this.promptCount++;
    this.emit(SessionEv.PROMPT_COUNT_CHANGED, this.promptCount);

    if (this._status === "initializing" || this._status === "cancelled" || this._status === "error") {
      this.activate();
    }
    const promptStart = Date.now();
    this.log.debug("Prompt execution started");

    // Context injection: prepend on first real prompt only
    const contextUsed = this.pendingContext;
    if (contextUsed) {
      text = `[CONVERSATION HISTORY - This is context from previous sessions, not current conversation]\n\n${contextUsed}\n\n[END CONVERSATION HISTORY]\n\n${text}`;
      this.log.debug("Context injected into prompt");
    }

    // STT: transcribe audio attachments if agent doesn't support audio
    const processed = await this.maybeTranscribeAudio(text, attachments);

    // TTS: determine if TTS is active for this prompt
    const ttsActive =
      this.voiceMode !== "off" &&
      !!this.speechService?.isTTSAvailable();

    // TTS: inject prompt instruction
    if (ttsActive) {
      processed.text += TTS_PROMPT_INSTRUCTION;
    }

    // TTS: set up text accumulator before prompting
    let accumulatedText = "";
    const accumulatorListener = ttsActive
      ? (event: AgentEvent) => {
          if (event.type === "text") {
            accumulatedText += event.content;
          }
        }
      : null;

    if (accumulatorListener) {
      this.on(SessionEv.AGENT_EVENT, accumulatorListener);
    }

    // Buffer text events for agent:afterTurn hook — accumulates full response text
    const turnTextBuffer: string[] = [];
    const turnTextListener = (event: AgentEvent) => {
      if (event.type === 'text' && typeof (event as any).content === 'string') {
        turnTextBuffer.push((event as any).content);
      }
    };
    this.on(SessionEv.AGENT_EVENT, turnTextListener);

    // Hook: agent:afterEvent — fire for every agent event, including headless API sessions.
    // Listens directly on agentInstance so it works regardless of whether a SessionBridge is connected.
    // The bridge previously fired this hook from dispatchAgentEvent, but that path is skipped when
    // no adapter is attached (headless), causing AI response steps to be missing from history.
    const mw = this.middlewareChain;
    const afterEventListener = mw
      ? (event: AgentEvent) => {
          mw.execute(Hook.AGENT_AFTER_EVENT, { sessionId: this.id, event, outgoingMessage: { type: 'text' as const, text: '' } }, async (e) => e).catch(() => {});
        }
      : null;

    if (afterEventListener) {
      this.agentInstance.on(SessionEv.AGENT_EVENT, afterEventListener);
    }

    // Hook: turn:start — read-only, fire-and-forget
    if (this.middlewareChain) {
      this.middlewareChain.execute(Hook.TURN_START, {
        sessionId: this.id,
        promptText: processed.text,
        promptNumber: this.promptCount,
        turnId: this.activeTurnContext?.turnId ?? turnId ?? '',
        meta,
        userPrompt: this.activeTurnContext?.userPrompt,
        sourceAdapterId: this.activeTurnContext?.sourceAdapterId,
        responseAdapterId: this.activeTurnContext?.responseAdapterId,
      }, async (p) => p).catch(() => {});
    }

    let stopReason: string = 'end_turn';
    let promptError: unknown;
    try {
      const response = await this.agentInstance.prompt(processed.text, processed.attachments);
      if (response && typeof response === 'object' && 'stopReason' in response) {
        stopReason = (response as { stopReason?: string }).stopReason ?? 'end_turn';
      }
      // Clear context only after successful prompt — if prompt fails, context is preserved for retry
      if (contextUsed) {
        this.pendingContext = null;
      }
      // Reset "next" voice mode only after successful prompt
      if (ttsActive && this.voiceMode === "next") {
        this.voiceMode = "off";
      }
    } catch (err) {
      stopReason = 'error';
      promptError = err;
    } finally {
      if (accumulatorListener) {
        this.off(SessionEv.AGENT_EVENT, accumulatorListener);
      }
      if (afterEventListener) {
        this.agentInstance.off(SessionEv.AGENT_EVENT, afterEventListener);
      }
      this.off(SessionEv.AGENT_EVENT, turnTextListener);

      const finalTurnId = this.activeTurnContext?.turnId ?? turnId ?? '';
      const wasAborted = this._abortedTurnIds.has(finalTurnId);
      if (wasAborted) this._abortedTurnIds.delete(finalTurnId);
      const finalStopReason = wasAborted ? 'interrupted' : stopReason;

      // Hook: turn:end — always fires, even on error
      if (this.middlewareChain) {
        this.middlewareChain.execute(Hook.TURN_END, { sessionId: this.id, stopReason: finalStopReason as import('../types.js').StopReason, durationMs: Date.now() - promptStart, turnId: finalTurnId, meta }, async (p) => p).catch(() => {});
      }

      // Hook: agent:afterTurn — full assembled text, read-only, fire-and-forget
      if (this.middlewareChain) {
        this.middlewareChain.execute(Hook.AGENT_AFTER_TURN, {
          sessionId: this.id,
          turnId: finalTurnId,
          fullText: turnTextBuffer.join(''),
          stopReason: finalStopReason as import('../types.js').StopReason,
          meta,
        }, async (p) => p).catch(() => {});
      }

      // Track the completed turnId so late abortPrompt() calls can retroactively mark it
      this._lastCompletedTurnId = finalTurnId || null;
      // Always clear turn context so routing state is never stale after a failed turn
      this.activeTurnContext = null;
    }

    // Re-throw so PromptQueue error handler can call this.fail()
    if (promptError !== undefined) {
      throw promptError;
    }

    this.log.info(
      { durationMs: Date.now() - promptStart },
      "Prompt execution completed",
    );

    // TTS: fire-and-forget post-response synthesis
    if (ttsActive && accumulatedText) {
      this.processTTSResponse(accumulatedText).catch((err) => {
        this.log.warn({ err }, "TTS post-processing failed");
      });
    }

    // Also trigger auto-naming when name is still the adopted session placeholder.
    if (!this.name || this.name === "Adopted session") {
      await this.autoName();
    }
  }

  /**
   * Transcribe audio attachments to text if the agent doesn't support audio natively.
   * Audio attachments are removed and their transcriptions are appended to the prompt text.
   */
  private async maybeTranscribeAudio(
    text: string,
    attachments?: Attachment[],
  ): Promise<{ text: string; attachments?: Attachment[] }> {
    if (!attachments?.length || !this.speechService) {
      return { text, attachments };
    }

    const hasAudioCapability = this.agentInstance.promptCapabilities?.audio === true;
    if (hasAudioCapability) {
      return { text, attachments };
    }

    if (!this.speechService.isSTTAvailable()) {
      return { text, attachments };
    }

    let transcribedText = text;
    const remainingAttachments: Attachment[] = [];

    for (const att of attachments) {
      if (att.type !== "audio") {
        remainingAttachments.push(att);
        continue;
      }

      try {
        const audioPath = att.originalFilePath || att.filePath;
        const audioMime = att.originalFilePath ? "audio/ogg" : att.mimeType;
        const audioBuffer = await fs.promises.readFile(audioPath);
        const result = await this.speechService.transcribe(audioBuffer, audioMime);
        this.log.info({ provider: "stt", duration: result.duration }, "Voice transcribed");
        // Notify user of transcription result
        this.emit(SessionEv.AGENT_EVENT, {
          type: "system_message",
          message: `🎤 You said: ${result.text}`,
        });
        // Strip [Audio: ...] placeholder since we have the transcription
        transcribedText = transcribedText.replace(/\[Audio:\s*[^\]]*\]\s*/g, "").trim();
        transcribedText = transcribedText
          ? `${transcribedText}\n${result.text}`
          : result.text;
      } catch (err) {
        this.log.warn({ err }, "STT transcription failed, keeping audio attachment");
        this.emit(SessionEv.AGENT_EVENT, {
          type: "error",
          message: `Voice transcription failed: ${(err as Error).message}`,
        });
        remainingAttachments.push(att);
      }
    }

    return {
      text: transcribedText,
      attachments: remainingAttachments.length > 0 ? remainingAttachments : undefined,
    };
  }

  /** Extract [TTS] block from agent response, synthesize speech, and emit audio_content event. */
  private async processTTSResponse(responseText: string): Promise<void> {
    const match = TTS_BLOCK_REGEX.exec(responseText);
    if (!match?.[1]) {
      this.log.debug("No [TTS] block found in response, skipping synthesis");
      return;
    }

    let ttsText = match[1].trim();
    if (!ttsText) return;

    if (ttsText.length > TTS_MAX_LENGTH) {
      ttsText = ttsText.slice(0, TTS_MAX_LENGTH);
    }

    try {
      let ttsTimer: ReturnType<typeof setTimeout>;
      const timeoutPromise = new Promise<never>((_, reject) => {
        ttsTimer = setTimeout(() => reject(new Error("TTS synthesis timed out")), TTS_TIMEOUT_MS);
      });
      try {
        const result = await Promise.race([
          this.speechService!.synthesize(ttsText),
          timeoutPromise,
        ]);
        const base64 = result.audioBuffer.toString("base64");
        this.emit(SessionEv.AGENT_EVENT, {
          type: "audio_content",
          data: base64,
          mimeType: result.mimeType,
        });
        this.emit(SessionEv.AGENT_EVENT, { type: "tts_strip" });
        this.log.info("TTS synthesis completed");
      } finally {
        clearTimeout(ttsTimer!);
      }
    } catch (err) {
      this.log.warn({ err }, "TTS synthesis failed, skipping");
    }
  }

  // Sends a special prompt to the agent to generate a short session title.
  // The session emitter is paused (excluding non-agent_event emissions) so the naming
  // prompt's output is intercepted by a capture handler instead of being forwarded to adapters.
  private async autoName(): Promise<void> {
    let title = "";

    // Temporarily remove all agent_event listeners so auto-name output
    // is not forwarded to the adapter. Add a capture-only listener instead.
    const captureHandler = (event: AgentEvent) => {
      if (event.type === "text") title += event.content;
      // Swallow all other events from auto-name prompt
    };

    // Pause the session emitter so agent_event emissions from SessionBridge
    // don't reach the adapter during auto-name. The AgentInstance emitter
    // stays active — we just intercept with our capture handler.
    this.pause((event) => event !== SessionEv.AGENT_EVENT);
    this.agentInstance.on(SessionEv.AGENT_EVENT, captureHandler);

    try {
      await this.agentInstance.prompt(
        "Summarize this conversation in max 5 words for a topic title. Reply ONLY with the title, nothing else.",
      );
      this.name = title.trim().slice(0, 50) || `Session ${this.id.slice(0, 6)}`;
      this.log.info({ name: this.name }, "Session auto-named");

      // Emit named event — SessionBridge listens to rename the thread
      this.emit(SessionEv.NAMED, this.name);
    } catch {
      this.name = `Session ${this.id.slice(0, 6)}`;
    } finally {
      this.agentInstance.off(SessionEv.AGENT_EVENT, captureHandler);
      // Discard buffered auto-name agent_events, then resume normal delivery
      this.clearBuffer();
      this.resume();
    }
  }


  // --- ACP Mode / Config / Model State ---

  setInitialConfigOptions(options: ConfigOption[]): void {
    this.configOptions = options ?? [];
  }

  setAgentCapabilities(caps: AgentCapabilities | undefined): void {
    this.agentCapabilities = caps;
  }

  /**
   * Hydrate configOptions and agentCapabilities from a spawn response.
   * Handles both the native configOptions format and legacy modes/models fields.
   */
  applySpawnResponse(resp: { modes?: unknown; configOptions?: unknown; models?: unknown } | undefined, caps: AgentCapabilities | undefined): void {
    if (caps) this.agentCapabilities = caps;
    if (!resp) return;

    if (resp.configOptions) {
      this.configOptions = resp.configOptions as ConfigOption[];
      return;
    }

    // Convert legacy modes/models fields (old ACP format) to configOptions
    const legacyOptions: ConfigOption[] = [];
    if (resp.modes) {
      const m = resp.modes as SessionModeState;
      legacyOptions.push({
        id: 'mode', name: 'Mode', category: 'mode', type: 'select',
        currentValue: m.currentModeId,
        options: m.availableModes.map(x => ({ value: x.id, name: x.name, description: x.description })),
      });
    }
    if (resp.models) {
      const m = resp.models as SessionModelState;
      legacyOptions.push({
        id: 'model', name: 'Model', category: 'model', type: 'select',
        currentValue: m.currentModelId,
        options: m.availableModels.map(x => ({ value: (x as any).modelId ?? x.id, name: x.name, description: x.description })),
      });
    }
    if (legacyOptions.length > 0) this.configOptions = legacyOptions;
  }

  getConfigOption(id: string): ConfigOption | undefined {
    return this.configOptions.find(o => o.id === id);
  }

  getConfigByCategory(category: string): ConfigOption | undefined {
    return this.configOptions.find(o => o.category === category);
  }

  getConfigValue(id: string): string | undefined {
    const option = this.getConfigOption(id);
    if (!option) return undefined;
    return String(option.currentValue);
  }

  /** Set session name explicitly and emit 'named' event */
  setName(name: string): void {
    this.name = name;
    this.emit(SessionEv.NAMED, name);
  }

  /** Send a config option change to the agent and update local state from the response. */
  async setConfigOption(configId: string, value: import("../types.js").SetConfigOptionValue): Promise<void> {
    const response = await this.agentInstance.setConfigOption(configId, value);
    if (response.configOptions && response.configOptions.length > 0) {
      await this.updateConfigOptions(response.configOptions as ConfigOption[]);
    } else if (value.type === 'select') {
      // Legacy agents return empty configOptions — update currentValue optimistically.
      const updated = this.configOptions.map((o): ConfigOption =>
        o.id === configId && o.type === 'select' ? { ...o, currentValue: value.value as string } : o
      );
      await this.updateConfigOptions(updated);
    }
  }

  async updateConfigOptions(options: ConfigOption[]): Promise<void> {
    // Hook: config:beforeChange — await-able, can block
    if (this.middlewareChain) {
      const result = await this.middlewareChain.execute(Hook.CONFIG_BEFORE_CHANGE, { sessionId: this.id, configId: 'options', oldValue: this.configOptions, newValue: options }, async (p) => p);
      if (!result) return; // blocked by middleware
    }
    this.configOptions = options;
  }

  /** Snapshot of current ACP state for persistence */
  toAcpStateSnapshot(): NonNullable<import("../types.js").SessionRecord["acpState"]> {
    return {
      configOptions: this.configOptions.length > 0 ? this.configOptions : undefined,
      agentCapabilities: this.agentCapabilities,
    };
  }

  /** Check if the agent supports a specific session capability */
  supportsCapability(cap: 'list' | 'fork' | 'close' | 'loadSession'): boolean {
    if (cap === 'loadSession') return this.agentCapabilities?.loadSession === true;
    return this.agentCapabilities?.sessionCapabilities?.[cap] === true;
  }

  /** Cancel the current prompt. Queued prompts continue processing. Stays in active state. */
  async abortPrompt(): Promise<void> {
    // Hook: agent:beforeCancel — modifiable, can block
    if (this.middlewareChain) {
      const result = await this.middlewareChain.execute(Hook.AGENT_BEFORE_CANCEL, { sessionId: this.id }, async (p) => p);
      if (!result) return; // blocked by middleware
    }
    const turnId = this.activeTurnContext?.turnId;

    if (turnId) {
      // Turn is still in-flight — mark for interrupted stopReason in the finally block
      this._abortedTurnIds.add(turnId);

      // Cancel agent FIRST so the orphaned processPrompt resolves before
      // drainNext starts the next item. Timeout prevents hanging if agent
      // is unresponsive — queue abort proceeds regardless after 5 seconds.
      await Promise.race([
        this.agentInstance.cancel().catch(() => {}),
        new Promise<void>((r) => setTimeout(r, 5000)),
      ]);

      this.queue.abortCurrent();
    } else if (this._lastCompletedTurnId && !this.queue.isProcessing) {
      // Turn already completed before cancel arrived — retroactively update
      // the history record so the client sees stopReason: "interrupted" on reload.
      const retroTurnId = this._lastCompletedTurnId;
      this._lastCompletedTurnId = null;
      if (this.middlewareChain) {
        await this.middlewareChain.execute(Hook.TURN_END, {
          sessionId: this.id,
          stopReason: 'interrupted' as import('../types.js').StopReason,
          durationMs: 0,
          turnId: retroTurnId,
        }, async (p) => p).catch(() => {});
      }
    }

    this.log.info("Prompt aborted (queue preserved, %d pending)", this.queue.pending);
  }

  /** Discard all queued prompts without interrupting the in-flight prompt. */
  clearQueue(): void {
    const dropped = this.queue.pending;
    this.queue.clearPending();
    this.log.info("Queue cleared (%d pending prompts discarded)", dropped);
  }

  /**
   * Cancel the in-flight prompt AND discard all queued prompts.
   * Full reset — nothing remains in the pipeline after this call.
   */
  async flushAll(): Promise<void> {
    // Hook: agent:beforeCancel — modifiable, can block
    if (this.middlewareChain) {
      const result = await this.middlewareChain.execute(Hook.AGENT_BEFORE_CANCEL, { sessionId: this.id }, async (p) => p);
      if (!result) return; // blocked by middleware
    }
    const turnId = this.activeTurnContext?.turnId;
    if (turnId) this._abortedTurnIds.add(turnId);

    // Cancel agent first, then clear everything
    await Promise.race([
      this.agentInstance.cancel().catch(() => {}),
      new Promise<void>((r) => setTimeout(r, 5000)),
    ]);

    this.queue.clear();
    this.log.info("Session flushed (prompt cancelled, queue cleared)");
  }

  /**
   * Skip the queue: cancel the in-flight prompt, discard all other queued
   * items, and promote the specified turn to process next.
   *
   * Used when the user clicks "Process Now" on a queued message — they want
   * THIS message handled immediately, discarding everything else in the pipeline.
   *
   * @returns true if the turn was found and promoted, false if already processed
   */
  async prioritizePrompt(turnId: string): Promise<boolean> {
    // Rearrange queue: keep only the target item
    const found = this.queue.prioritize(turnId);
    if (!found) return false;

    // Cancel agent so the current processPrompt resolves and drainNext
    // picks up the promoted item. Timeout fallback if agent is unresponsive.
    await Promise.race([
      this.agentInstance.cancel().catch(() => {}),
      new Promise<void>((r) => setTimeout(r, 5000)),
    ]);

    // If the process didn't settle naturally (timeout), force abort
    if (this.queue.isProcessing) {
      this.queue.abortCurrent();
    }

    this.log.info({ turnId }, "Prompt prioritized");
    return true;
  }

  /** Search backward through agentSwitchHistory for the last entry matching agentName */
  findLastSwitchEntry(agentName: string): AgentSwitchEntry | undefined {
    for (let i = this.agentSwitchHistory.length - 1; i >= 0; i--) {
      if (this.agentSwitchHistory[i].agentName === agentName) {
        return this.agentSwitchHistory[i];
      }
    }
    return undefined;
  }

  /** Switch the agent instance in-place, preserving session identity */
  async switchAgent(agentName: string, createAgent: () => Promise<AgentInstance>): Promise<void> {
    if (agentName === this.agentName) {
      throw new Error(`Already using ${agentName}`);
    }

    // Record current agent in history
    this.agentSwitchHistory.push({
      agentName: this.agentName,
      agentSessionId: this.agentSessionId,
      switchedAt: new Date().toISOString(),
      promptCount: this.promptCount,
    });

    // Clear queued prompts and abort in-flight prompt before destroying old agent
    this.queue.clear();

    // Reject any pending permission request before destroying old agent
    if (this.permissionGate.isPending) {
      this.permissionGate.reject("Agent switched");
    }

    // Destroy old agent
    await this.agentInstance.destroy();

    // Create and wire new agent
    const newAgent = await createAgent();
    this.agentInstance = newAgent;
    this.agentName = agentName;
    this.agentSessionId = newAgent.sessionId;
    this.promptCount = 0;

    // Hydrate ACP state from the new agent's spawn response
    this.agentCapabilities = undefined;
    this.configOptions = [];
    this.latestCommands = null;
    this.applySpawnResponse(newAgent.initialSessionResponse, newAgent.agentCapabilities);

    this.log.info({ from: this.agentSwitchHistory.at(-1)!.agentName, to: agentName }, "Agent switched");
  }

  /** Tear down the session: reject pending permissions, clear queue, destroy agent subprocess. */
  async destroy(): Promise<void> {
    this.log.info("Session destroyed");
    // Reject any pending permission promise so callers don't hang
    if (this.permissionGate.isPending) {
      this.permissionGate.reject("Session destroyed");
    }
    // Clear queued prompts
    this.queue.clear();
    await this.agentInstance.destroy();
    closeSessionLogger(this.log);
  }
}
