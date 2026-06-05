import type { Bot } from "grammy";
import { MessageDraft } from "./streaming.js";
import type { SendQueue } from "../../core/adapter-primitives/primitives/send-queue.js";
import type { DebugTracer } from "../../core/utils/debug-tracer.js";

// Retains a finalized draft so tts_strip can edit the message after finalization.
// The draft's stripPattern() still holds the message ID and can make a single edit.
interface FinalizedDraft {
  messageId: number;
  draft: MessageDraft;
}

/**
 * Per-session draft lifecycle manager.
 *
 * Owns the active `MessageDraft` for each session (the streaming message being
 * assembled from text_delta events) and keeps a short-lived reference after
 * finalization so post-send edits (e.g. TTS block removal) can still update
 * the message in-place.
 */
export class DraftManager {
  private drafts: Map<string, MessageDraft> = new Map();
  private textBuffers: Map<string, string> = new Map();
  private finalizedDrafts: Map<string, FinalizedDraft> = new Map();

  constructor(
    private bot: Bot,
    private chatId: number,
    private sendQueue: SendQueue,
  ) {}

  /**
   * Return the active draft for a session, creating one if it doesn't exist yet.
   * Only one draft per session exists at a time.
   */
  getOrCreate(sessionId: string, threadId: number, tracer: DebugTracer | null = null): MessageDraft {
    let draft = this.drafts.get(sessionId);
    if (!draft) {
      draft = new MessageDraft(
        this.bot,
        this.chatId,
        threadId,
        this.sendQueue,
        sessionId,
        tracer,
      );
      this.drafts.set(sessionId, draft);
    }
    return draft;
  }

  hasDraft(sessionId: string): boolean {
    return this.drafts.has(sessionId);
  }

  getDraft(sessionId: string): MessageDraft | undefined {
    return this.drafts.get(sessionId);
  }

  appendText(sessionId: string, text: string): void {
    this.textBuffers.set(
      sessionId,
      (this.textBuffers.get(sessionId) ?? "") + text,
    );
  }

  /**
   * Finalize the active draft for a session and retain a short-lived reference for post-send edits.
   *
   * Removes the draft from the active map before awaiting to prevent concurrent calls from
   * double-finalizing the same draft. If the draft produces a message ID, stores it as a
   * `FinalizedDraft` so `stripPattern` (e.g. TTS block removal) can still edit the message
   * after it has been sent.
   */
  async finalize(
    sessionId: string,
    _assistantSessionId?: string,
  ): Promise<void> {
    const draft = this.drafts.get(sessionId);
    if (!draft) return;

    // Delete BEFORE awaiting to prevent concurrent finalizeDraft() calls
    // from double-finalizing the same draft
    this.drafts.delete(sessionId);
    const finalMsgId = await draft.finalize();

    // Keep finalized draft reference so tts_strip can edit after finalization
    if (finalMsgId) {
      this.finalizedDrafts.set(sessionId, { messageId: finalMsgId, draft });
    }

    this.textBuffers.delete(sessionId);
  }

  /**
   * Strip a regex pattern from the active or finalized draft for a session.
   * Used by tts_strip to remove [TTS]...[/TTS] blocks after TTS audio is sent.
   */
  async stripPattern(sessionId: string, pattern: RegExp): Promise<void> {
    const draft = this.drafts.get(sessionId);
    if (draft) {
      await draft.stripPattern(pattern);
      return;
    }
    const finalized = this.finalizedDrafts.get(sessionId);
    if (finalized) {
      await finalized.draft.stripPattern(pattern);
    }
    // If no draft found (e.g., TTS synthesis slower than next prompt cycle), the
    // [TTS] block will remain visible. This is a rare edge case — log for debugging.
  }

  /**
   * Discard all draft state for a session without sending anything.
   *
   * Removes the active draft, text buffer, and finalized draft reference. Called when a
   * session ends or is reset and any unsent content should be silently dropped.
   */
  cleanup(sessionId: string): void {
    this.drafts.delete(sessionId);
    this.textBuffers.delete(sessionId);
    this.finalizedDrafts.delete(sessionId);
  }
}
