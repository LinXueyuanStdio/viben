import type { Bot } from "grammy";
import { createChildLogger } from "../../core/utils/log.js";
import type { PlanEntry } from "../../core/types.js";
import type { ToolCallMeta, ViewerLinks } from "../../core/adapter-primitives/format-types.js";
import type { SendQueue } from "../../core/adapter-primitives/primitives/send-queue.js";
import type { DebugTracer } from "../../core/utils/debug-tracer.js";
import { ToolCardState } from "../../core/adapter-primitives/primitives/tool-card-state.js";
import type { ToolCardSnapshot } from "../../core/adapter-primitives/primitives/tool-card-state.js";
import { escapeHtml, renderToolCard, splitToolCardText } from "./formatting.js";
import { ToolStateMap } from "../../core/adapter-primitives/stream-accumulator.js";
import { ThoughtBuffer } from "../../core/adapter-primitives/stream-accumulator.js";
import { DisplaySpecBuilder } from "../../core/adapter-primitives/display-spec-builder.js";
import type { ToolDisplaySpec } from "../../core/adapter-primitives/display-spec-builder.js";
import type { OutputMode } from "../../core/adapter-primitives/format-types.js";
import type { TunnelServiceInterface } from "../../core/plugin/types.js";

const log = createChildLogger({ module: "telegram:activity" });

// ─── ThinkingIndicator ────────────────────────────────────────────────────────

// Refresh the "thinking" message every 15s to show elapsed time.
// Auto-stop after 3 minutes to avoid leaving stale indicators.
const THINKING_REFRESH_MS = 15_000;
const THINKING_MAX_MS = 3 * 60 * 1000;

/**
 * Manages the transient "💭 Thinking..." message shown while the agent is reasoning.
 *
 * Sends a message on `show()`, periodically edits it with elapsed time, and
 * dismisses it (leaving the message in chat) when text output begins. Leaving
 * the message avoids an extra API delete call; the indicator is just no longer updated.
 */
export class ThinkingIndicator {
  private msgId?: number;
  private sending = false;
  private dismissed = false;
  private refreshTimer?: ReturnType<typeof setInterval>;
  private showTime = 0;
  private tracer: DebugTracer | null;

  constructor(
    private api: Bot["api"],
    private chatId: number,
    private threadId: number,
    private sendQueue: SendQueue,
    private sessionId: string = "",
    tracer: DebugTracer | null = null,
  ) {
    this.tracer = tracer;
  }

  async show(): Promise<void> {
    if (this.sending || this.dismissed) return;
    if (this.msgId) return;
    this.sending = true;
    this.showTime = Date.now();
    const text = "💭 <i>Thinking...</i>";
    try {
      const result = await this.sendQueue.enqueue(() =>
        this.api.sendMessage(this.chatId, text, {
          message_thread_id: this.threadId,
          parse_mode: "HTML",
          disable_notification: true,
        }),
      );
      if (result) {
        this.tracer?.log("telegram", { action: "thinking:show", sessionId: this.sessionId, msgId: result.message_id });
        if (this.dismissed) {
          // dismissed during queue wait — message stays in chat (no delete to save API calls)
        } else {
          this.msgId = result.message_id;
          this.startRefreshTimer();
        }
      }
    } catch (err) {
      log.warn({ err }, "ThinkingIndicator.show() failed");
    } finally {
      this.sending = false;
    }
  }

  /** Edit the indicator message to append a viewer link, then dismiss. */
  async finalizeWithViewerLink(url: string): Promise<void> {
    this.stopRefreshTimer();
    if (this.msgId && !this.dismissed) {
      const text = `💭 <i>Thinking...</i>      <a href="${escapeHtml(url)}">View thinking</a>`;
      await this.sendQueue
        .enqueue(() => {
          if (!this.msgId) return Promise.resolve(undefined);
          return this.api.editMessageText(this.chatId, this.msgId, text, { parse_mode: "HTML" });
        })
        .catch(() => {});
    }
    this.dismissed = true;
    this.msgId = undefined;
  }

  /** Dismiss indicator: stops refresh timer. Message is left in chat to reduce API calls. */
  async dismiss(): Promise<void> {
    if (this.dismissed) return;
    this.dismissed = true;
    this.tracer?.log("telegram", { action: "thinking:dismiss", sessionId: this.sessionId });
    this.stopRefreshTimer();
    this.msgId = undefined;
  }

  /** Reset for a new prompt cycle */
  reset(): void {
    this.dismissed = false;
  }

  private startRefreshTimer(): void {
    this.stopRefreshTimer();
    this.refreshTimer = setInterval(() => {
      if (
        this.dismissed ||
        !this.msgId ||
        Date.now() - this.showTime >= THINKING_MAX_MS
      ) {
        this.stopRefreshTimer();
        return;
      }
      const elapsed = Math.round((Date.now() - this.showTime) / 1000);
      const refreshText = `💭 <i>Still thinking... (${elapsed}s)</i>`;
      this.sendQueue
        .enqueue(() => {
          // Re-check after waiting in queue — dismiss may have been called
          if (this.dismissed || !this.msgId) return Promise.resolve(undefined);
          return this.api.editMessageText(
            this.chatId,
            this.msgId,
            refreshText,
            { parse_mode: "HTML" },
          );
        })
        .then(() => {})
        .catch(() => {});
    }, THINKING_REFRESH_MS);
  }

  private stopRefreshTimer(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = undefined;
    }
  }
}

// ─── ToolCard ─────────────────────────────────────────────────────────────────

/**
 * Displays the live tool execution card for a prompt cycle.
 *
 * Receives tool state updates via `ToolCardState` (which batches rapid updates
 * and calls `onFlush` with a snapshot). Each flush either sends a new message or
 * edits the existing one. When the card exceeds Telegram's 4096-char limit, it is
 * split into overflow messages that are recycled on subsequent renders.
 */
export class ToolCard {
  private state: ToolCardState;
  private msgId?: number;
  private lastSentText?: string;
  private flushPromise: Promise<void> = Promise.resolve();
  private overflowMsgIds: number[] = [];
  private aborted = false;
  private tracer: DebugTracer | null;
  private sessionId: string;

  constructor(
    private api: Bot["api"],
    private chatId: number,
    private threadId: number,
    private sendQueue: SendQueue,
    sessionId: string = "",
    tracer: DebugTracer | null = null,
  ) {
    this.tracer = tracer;
    this.sessionId = sessionId;
    this.state = new ToolCardState({
      onFlush: (snapshot) => {
        this.flushPromise = this.flushPromise
          .then(() => {
            if (this.aborted) return;
            return this._sendOrEdit(snapshot);
          })
          .catch(() => {});
      },
    });
  }

  updateFromSpec(spec: ToolDisplaySpec): void {
    this.state.updateFromSpec(spec);
  }

  updatePlan(entries: PlanEntry[]): void {
    this.state.updatePlan(entries);
  }

  appendUsage(usage: { tokensUsed?: number; contextSize?: number; cost?: number }): void {
    this.state.appendUsage(usage);
  }

  async finalize(): Promise<void> {
    this.state.finalize();
    await this.flushPromise;
  }

  destroy(): void {
    this.aborted = true;
    this.state.destroy();
  }

  hasContent(): boolean {
    return this.state.hasContent();
  }

  getMsgId(): number | undefined {
    return this.msgId;
  }

  private async _sendOrEdit(snapshot: ToolCardSnapshot): Promise<void> {
    // Overflow strip: if full render exceeds Telegram limit, strip inline outputContent
    let snapshotToRender = snapshot;
    let fullText = renderToolCard(snapshotToRender);
    if (fullText.length > 4096) {
      snapshotToRender = {
        ...snapshot,
        specs: snapshot.specs.map((s) =>
          s.outputContent ? { ...s, outputContent: null } : s
        ),
      };
      fullText = renderToolCard(snapshotToRender);
    }

    if (!fullText) return;
    if (this.msgId && fullText === this.lastSentText) return;
    this.lastSentText = fullText;

    const chunks = splitToolCardText(fullText);
    this.tracer?.log("telegram", { action: "toolCard:render", sessionId: this.sessionId, chunks: chunks.length, total: snapshot.totalVisible, completed: snapshot.completedVisible, allComplete: snapshot.allComplete, msgId: this.msgId, entries: snapshot.specs.map(s => ({ id: s.id, kind: s.kind, icon: s.icon, title: s.title })), html: fullText });

    try {
      const firstChunk = chunks[0];
      if (this.msgId) {
        await this.sendQueue.enqueue(() =>
          this.api.editMessageText(this.chatId, this.msgId!, firstChunk, { parse_mode: "HTML" }),
        );
        this.tracer?.log("telegram", { action: "telegram:edit", sessionId: this.sessionId, msgId: this.msgId, html: firstChunk });
      } else {
        const result = await this.sendQueue.enqueue(() =>
          this.api.sendMessage(this.chatId, firstChunk, {
            message_thread_id: this.threadId,
            parse_mode: "HTML",
            disable_notification: true,
          }),
        );
        if (result) this.msgId = result.message_id;
        this.tracer?.log("telegram", { action: "telegram:send", sessionId: this.sessionId, msgId: result?.message_id, html: firstChunk });
      }

      for (let i = 1; i < chunks.length; i++) {
        const overflowIdx = i - 1;
        if (overflowIdx < this.overflowMsgIds.length) {
          await this.sendQueue.enqueue(() =>
            this.api.editMessageText(this.chatId, this.overflowMsgIds[overflowIdx], chunks[i], { parse_mode: "HTML" }),
          );
          this.tracer?.log("telegram", { action: "telegram:edit:overflow", sessionId: this.sessionId, msgId: this.overflowMsgIds[overflowIdx] });
        } else {
          const result = await this.sendQueue.enqueue(() =>
            this.api.sendMessage(this.chatId, chunks[i], {
              message_thread_id: this.threadId,
              parse_mode: "HTML",
              disable_notification: true,
            }),
          );
          if (result) this.overflowMsgIds.push(result.message_id);
          this.tracer?.log("telegram", { action: "telegram:send:overflow", sessionId: this.sessionId, msgId: result?.message_id });
        }
      }

      // Clean up stale overflow messages when chunk count decreases
      const neededOverflow = chunks.length - 1;
      while (this.overflowMsgIds.length > neededOverflow) {
        const staleId = this.overflowMsgIds.pop()!;
        await this.sendQueue.enqueue(() =>
          this.api.deleteMessage(this.chatId, staleId).catch(() => {}),
        );
        this.tracer?.log("telegram", { action: "telegram:delete:overflow", sessionId: this.sessionId, msgId: staleId });
      }
    } catch (err) {
      log.warn({ err }, "[ToolCard] send/edit failed");
    }
  }
}

// ─── ActivityTracker ──────────────────────────────────────────────────────────

/**
 * Per-session coordinator for all live activity indicators in a topic.
 *
 * Owns the ThinkingIndicator and the current ToolCard for a session. On each
 * new prompt cycle (`onNewPrompt`), the previous card is finalized (frozen) and
 * a fresh card and thinking indicator are created for the new turn.
 *
 * The "seal" mechanism (`sealToolCardIfNeeded`) finalizes the current tool card
 * when text output begins, preserving tool results as a historical record while
 * the new streaming draft message appears below them.
 */
export class ActivityTracker {
  private isFirstEvent = true;
  private thinking: ThinkingIndicator;
  private toolCard: ToolCard;
  private previousToolCard?: ToolCard;
  private toolStateMap: ToolStateMap;
  private previousToolStateMap?: ToolStateMap;
  private specBuilder: DisplaySpecBuilder;
  private thoughtBuffer: ThoughtBuffer;
  private _outputMode: OutputMode;
  private tracer: DebugTracer | null;
  private sessionId: string;
  private sessionContext?: { id: string; workingDirectory: string };
  private tunnelService?: TunnelServiceInterface;

  constructor(
    private api: Bot["api"],
    private chatId: number,
    private threadId: number,
    private sendQueue: SendQueue,
    outputMode: OutputMode = "medium",
    sessionId: string = "",
    tracer: DebugTracer | null = null,
    tunnelService?: TunnelServiceInterface,
    sessionContext?: { id: string; workingDirectory: string },
  ) {
    this._outputMode = outputMode;
    this.tracer = tracer;
    this.sessionId = sessionId;
    this.sessionContext = sessionContext;
    this.tunnelService = tunnelService;
    this.specBuilder = new DisplaySpecBuilder(tunnelService);
    this.toolStateMap = new ToolStateMap();
    this.thoughtBuffer = new ThoughtBuffer();
    this.thinking = new ThinkingIndicator(api, chatId, threadId, sendQueue, sessionId, tracer);
    this.toolCard = new ToolCard(api, chatId, threadId, sendQueue, sessionId, tracer);
  }

  setOutputMode(mode: OutputMode): void {
    this._outputMode = mode;
  }

  async onNewPrompt(): Promise<void> {
    this.tracer?.log("telegram", { action: "tracker:newPrompt", sessionId: this.sessionId });
    this.isFirstEvent = true;
    this.thoughtBuffer.reset();
    await this.thinking.dismiss();
    this.thinking.reset();
    await this.toolCard.finalize();
    // Clear previous card references so tool updates from new prompt don't leak into old messages
    this.previousToolCard = undefined;
    this.previousToolStateMap = undefined;
    this.toolStateMap.clear();
    this.toolCard = new ToolCard(this.api, this.chatId, this.threadId, this.sendQueue, this.sessionId, this.tracer);
  }

  async onThought(text: string): Promise<void> {
    this.tracer?.log("telegram", { action: "tracker:thought", sessionId: this.sessionId });
    this.isFirstEvent = false;
    if (!this.thoughtBuffer.isSealed()) this.thoughtBuffer.append(text);
    await this.sealToolCardIfNeeded();
    await this.thinking.show();
  }

  async onTextStart(): Promise<void> {
    this.tracer?.log("telegram", { action: "tracker:textStart", sessionId: this.sessionId });
    this.isFirstEvent = false;
    this.thoughtBuffer.seal();

    // In high mode with tunnel: store thought content and show a viewer link before dismissing
    if (this._outputMode === "high" && this.tunnelService && this.sessionContext) {
      const thoughtText = this.thoughtBuffer.getText();
      if (thoughtText.trim().length > 0) {
        const id = this.tunnelService.getStore().storeOutput(
          this.sessionContext.id,
          "thinking",
          thoughtText,
        );
        if (id !== null) {
          await this.thinking.finalizeWithViewerLink(this.tunnelService.outputUrl(id));
        } else {
          await this.thinking.dismiss();
        }
      } else {
        await this.thinking.dismiss();
      }
    } else {
      await this.thinking.dismiss();
    }

    await this.sealToolCardIfNeeded();
  }

  async onToolCall(
    meta: ToolCallMeta,
    kind: string,
    rawInput: unknown,
  ): Promise<void> {
    this.tracer?.log("telegram", { action: "tracker:toolCall", sessionId: this.sessionId, meta, kind, rawInput });
    this.isFirstEvent = false;
    await this.thinking.dismiss();
    this.thinking.reset();

    const entry = this.toolStateMap.upsert(meta, kind, rawInput);
    const spec = this.specBuilder.buildToolSpec(entry, this._outputMode, this.sessionContext);
    this.toolCard.updateFromSpec(spec);
  }

  async onToolUpdate(
    id: string,
    status: string,
    viewerLinks?: ViewerLinks,
    viewerFilePath?: string,
    content?: string | null,
    rawInput?: unknown,
    diffStats?: { added: number; removed: number },
  ): Promise<void> {
    this.tracer?.log("telegram", { action: "tracker:toolUpdate", sessionId: this.sessionId, toolId: id, status, viewerLinks, viewerFilePath, hasPrevCard: !!this.previousToolCard });

    // Forward to previous card first if the tool originated there (out-of-order update after seal)
    if (this.previousToolStateMap?.get(id)) {
      this.previousToolStateMap.merge(id, status, rawInput, content, viewerLinks, diffStats);
      const prevEntry = this.previousToolStateMap.get(id);
      if (prevEntry) {
        const prevSpec = this.specBuilder.buildToolSpec(prevEntry, this._outputMode, this.sessionContext);
        this.previousToolCard?.updateFromSpec(prevSpec);
      }
    }

    const existed = !!this.toolStateMap.get(id);
    const entry = this.toolStateMap.merge(id, status, rawInput, content, viewerLinks, diffStats);
    // Skip spec build for out-of-order updates — buffered in pendingUpdates
    if (!existed || !entry) return;

    if (viewerLinks || entry.viewerLinks) {
      log.debug({ toolId: id, status, hasIncomingLinks: !!viewerLinks, hasEntryLinks: !!entry.viewerLinks, entryLinks: entry.viewerLinks }, "toolUpdate: viewer links trace");
    }
    const spec = this.specBuilder.buildToolSpec(entry, this._outputMode, this.sessionContext);
    this.toolCard.updateFromSpec(spec);
  }

  async onPlan(entries: PlanEntry[]): Promise<void> {
    this.tracer?.log("telegram", { action: "tracker:plan", sessionId: this.sessionId, entries });
    this.isFirstEvent = false;
    await this.thinking.dismiss();
    this.toolCard.updatePlan(entries);
  }

  /** @deprecated Usage is now sent as a separate message by the adapter */
  async sendUsage(_usage: {
    tokensUsed?: number;
    contextSize?: number;
    cost?: number;
  }): Promise<void> {
    // no-op — adapter sends usage as a standalone message
  }

  getToolCardMsgId(): number | undefined {
    return this.toolCard.getMsgId();
  }

  async cleanup(): Promise<void> {
    await this.thinking.dismiss();
    await this.toolCard.finalize();
    this.toolCard.destroy();
  }

  destroy(): void {
    void this.thinking.dismiss();
    this.toolCard.destroy();
  }

  private async sealToolCardIfNeeded(): Promise<void> {
    if (!this.toolCard.hasContent()) return;
    this.tracer?.log("telegram", { action: "tracker:seal", sessionId: this.sessionId });
    await this.toolCard.finalize();
    this.previousToolCard = this.toolCard;
    this.previousToolStateMap = this.toolStateMap;
    this.toolStateMap = new ToolStateMap();
    this.toolCard = new ToolCard(this.api, this.chatId, this.threadId, this.sendQueue, this.sessionId, this.tracer);
  }
}
