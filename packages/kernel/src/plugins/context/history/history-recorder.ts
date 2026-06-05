import type { AgentEvent, Attachment } from "../../../core/types.js";
import type { HistoryStore } from "./history-store.js";
import type {
  HistoryAttachment,
  ResourceLinkStep,
  ResourceStep,
  SessionHistory,
  Step,
  ToolCallStep,
  Turn,
} from "./types.js";

export interface RecorderState {
  history: SessionHistory;
  currentAssistantTurn: Turn | null;
}

function toHistoryAttachment(att: Attachment): HistoryAttachment {
  return {
    type: att.type,
    fileName: att.fileName,
    mimeType: att.mimeType,
    size: att.size,
  };
}

function extractDiff(
  content: unknown,
): { path: string; oldText?: string; newText: string } | null {
  if (!Array.isArray(content)) return null;
  for (const item of content) {
    if (
      item &&
      typeof item === "object" &&
      (item as Record<string, unknown>).type === "diff"
    ) {
      const d = item as Record<string, unknown>;
      if (typeof d.path === "string" && typeof d.newText === "string") {
        const result: { path: string; oldText?: string; newText: string } = {
          path: d.path,
          newText: d.newText,
        };
        if (typeof d.oldText === "string") result.oldText = d.oldText;
        return result;
      }
    }
  }
  return null;
}

function extractLocations(
  locations: unknown,
): { path: string; line?: number }[] | undefined {
  if (!Array.isArray(locations)) return undefined;
  const result: { path: string; line?: number }[] = [];
  for (const loc of locations) {
    if (loc && typeof loc === "object" && typeof (loc as any).path === "string") {
      const entry: { path: string; line?: number } = { path: (loc as any).path };
      if (typeof (loc as any).line === "number") entry.line = (loc as any).line;
      result.push(entry);
    }
  }
  return result.length > 0 ? result : undefined;
}

// These event types carry no meaningful conversation history — skip them to keep
// the history compact and avoid noise in future context builds.
const IGNORED_TYPES = new Set([
  "session_end",
  "error",
  "system_message",
  "commands_update",
  "session_info_update",
  "model_update",
  "user_message_chunk",
  "tts_strip",
]);

// Debounce intermediate writes — during a long agent turn, events arrive at high
// frequency. We flush at most once per 2s so we don't hammer the disk, but we
// always do a final write on turn end regardless of the debounce timer.
const DEBOUNCE_MS = 2000;

/**
 * Records conversation turns to the HistoryStore in real-time by hooking into
 * the `agent:beforePrompt`, `agent:afterEvent`, `turn:end`, `permission:afterResolve`,
 * and `session:afterDestroy` middleware hooks.
 *
 * Each call to `onBeforePrompt` opens a new user→assistant turn pair.
 * `onAfterEvent` streams agent events into the current assistant turn.
 * `onTurnEnd` finalises the turn and flushes to disk.
 *
 * In-memory state is keyed by sessionId. Sessions are cleaned up on destroy
 * or explicit `finalize()`.
 */
export class HistoryRecorder {
  private states = new Map<string, RecorderState>();
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(private readonly store: HistoryStore) {}

  onBeforePrompt(
    sessionId: string,
    text: string,
    attachments: Attachment[] | undefined,
    sourceAdapterId?: string,
    meta?: Record<string, unknown>,
  ): void {
    let state = this.states.get(sessionId);
    if (!state) {
      state = {
        history: { version: 1, sessionId, turns: [] },
        currentAssistantTurn: null,
      };
      this.states.set(sessionId, state);
    }

    const userTurn: Turn = {
      index: state.history.turns.length,
      role: "user",
      timestamp: new Date().toISOString(),
      content: text,
    };
    if (attachments && attachments.length > 0) {
      userTurn.attachments = attachments.map(toHistoryAttachment);
    }
    if (sourceAdapterId) {
      userTurn.sourceAdapterId = sourceAdapterId;
    }
    if (meta && Object.keys(meta).length > 0) {
      userTurn.meta = meta;
    }
    state.history.turns.push(userTurn);

    const assistantTurn: Turn = {
      index: state.history.turns.length,
      role: "assistant",
      timestamp: new Date().toISOString(),
      steps: [],
    };
    state.history.turns.push(assistantTurn);
    state.currentAssistantTurn = assistantTurn;
  }

  onAfterEvent(sessionId: string, event: AgentEvent): void {
    const state = this.states.get(sessionId);
    if (!state || !state.currentAssistantTurn) return;

    const turn = state.currentAssistantTurn;
    const steps = turn.steps!;

    if (IGNORED_TYPES.has(event.type)) return;

    switch (event.type) {
      case "text": {
        const last = steps[steps.length - 1];
        if (last && last.type === "text") {
          last.content += event.content;
        } else {
          steps.push({ type: "text", content: event.content });
        }
        break;
      }

      case "thought": {
        const last = steps[steps.length - 1];
        if (last && last.type === "thinking") {
          last.content += event.content;
        } else {
          steps.push({ type: "thinking", content: event.content });
        }
        break;
      }

      case "tool_call": {
        const step: ToolCallStep = {
          type: "tool_call",
          id: event.id,
          name: event.name,
          status: event.status,
        };
        if (event.kind) step.kind = event.kind;
        // rawInput may arrive in the initial tool_call event (not just tool_update)
        if (event.rawInput !== undefined) step.input = event.rawInput;
        steps.push(step);
        break;
      }

      case "tool_update": {
        const existing = this.findToolCall(steps, event.id);
        if (!existing) break;
        existing.status = event.status;
        if (event.rawInput !== undefined) existing.input = event.rawInput;
        if (event.rawOutput !== undefined) existing.output = event.rawOutput;
        if (event.content !== undefined) {
          const diff = extractDiff(event.content);
          if (diff) existing.diff = diff;
        }
        if (event.locations !== undefined) {
          const locs = extractLocations(event.locations);
          if (locs) existing.locations = locs;
        }
        break;
      }

      case "plan": {
        steps.push({
          type: "plan",
          entries: event.entries.map((e) => ({
            content: e.content,
            priority: e.priority,
            status: e.status,
          })),
        });
        break;
      }

      case "usage": {
        turn.usage = {};
        if (event.tokensUsed !== undefined) turn.usage.tokensUsed = event.tokensUsed;
        if (event.contextSize !== undefined) turn.usage.contextSize = event.contextSize;
        if (event.cost) turn.usage.cost = event.cost;
        break;
      }

      case "image_content": {
        steps.push({
          type: "image",
          mimeType: event.mimeType,
          filePath: "",
        });
        break;
      }

      case "audio_content": {
        steps.push({
          type: "audio",
          mimeType: event.mimeType,
          filePath: "",
        });
        break;
      }

      case "resource_content": {
        const step: ResourceStep = {
          type: "resource",
          uri: event.uri,
          name: event.name,
        };
        if (event.text !== undefined) step.text = event.text;
        steps.push(step);
        break;
      }

      case "resource_link": {
        const step: ResourceLinkStep = {
          type: "resource_link",
          uri: event.uri,
          name: event.name,
        };
        if (event.title !== undefined) step.title = event.title;
        if (event.description !== undefined)
          step.description = event.description;
        steps.push(step);
        break;
      }

      case "config_option_update": {
        for (const opt of event.options) {
          steps.push({
            type: "config_change",
            configId: opt.id,
            value: String(opt.currentValue),
          });
        }
        break;
      }
    }

    this.scheduleDebounce(sessionId);
  }

  onPermissionResolved(
    sessionId: string,
    requestId: string,
    decision: string,
  ): void {
    const state = this.states.get(sessionId);
    if (!state || !state.currentAssistantTurn) return;
    const step = this.findToolCall(state.currentAssistantTurn.steps!, requestId);
    if (!step) return;
    step.permission = { requested: true, outcome: decision };
  }

  async onTurnEnd(sessionId: string, stopReason: string): Promise<void> {
    const state = this.states.get(sessionId);
    if (!state) return;
    this.cancelDebounce(sessionId);
    if (state.currentAssistantTurn) {
      // Turn still in-progress — finalize it
      state.currentAssistantTurn.stopReason = stopReason;
      state.currentAssistantTurn = null;
    } else if (stopReason === 'interrupted' && state.history.turns.length > 0) {
      // Retroactive interrupt: turn already completed but cancel arrived late.
      // Update the last assistant turn's stopReason so clients see "interrupted" on reload.
      const lastTurn = state.history.turns[state.history.turns.length - 1];
      if (lastTurn.role === 'assistant') {
        lastTurn.stopReason = 'interrupted';
      }
    } else {
      return; // nothing to update
    }
    await this.store.write(state.history);
  }

  /** Flush any in-progress turn as "interrupted" and clean up. Called on session destroy. */
  async onSessionDestroy(sessionId: string): Promise<void> {
    const state = this.states.get(sessionId);
    if (!state) return;
    this.cancelDebounce(sessionId);
    if (state.currentAssistantTurn) {
      state.currentAssistantTurn.stopReason = "interrupted";
      state.currentAssistantTurn = null;
      await this.store.write(state.history);
    }
    this.finalize(sessionId);
  }

  finalize(sessionId: string): void {
    this.cancelDebounce(sessionId);
    this.states.delete(sessionId);
  }

  /**
   * Flush any in-memory state for a session to disk immediately.
   * Marks any in-progress turn as "interrupted".
   * Called before buildContext during agent switches to ensure the last turn
   * is persisted before the new agent reads history.
   */
  async flush(sessionId: string): Promise<void> {
    const state = this.states.get(sessionId);
    if (!state) return;
    this.cancelDebounce(sessionId);
    if (state.currentAssistantTurn) {
      state.currentAssistantTurn.stopReason = "interrupted";
      state.currentAssistantTurn = null;
    }
    await this.store.write(state.history);
  }

  getState(sessionId: string): RecorderState | undefined {
    return this.states.get(sessionId);
  }

  private scheduleDebounce(sessionId: string): void {
    this.cancelDebounce(sessionId);
    const state = this.states.get(sessionId);
    if (!state) return;
    const timer = setTimeout(() => {
      this.debounceTimers.delete(sessionId);
      this.store.write(state.history).catch(() => {});
    }, DEBOUNCE_MS);
    this.debounceTimers.set(sessionId, timer);
  }

  private cancelDebounce(sessionId: string): void {
    const timer = this.debounceTimers.get(sessionId);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.debounceTimers.delete(sessionId);
    }
  }

  // Search backwards so we match the most recent tool call with this ID first,
  // in case the same tool is invoked multiple times within one turn.
  private findToolCall(steps: Step[], id: string): ToolCallStep | undefined {
    for (let i = steps.length - 1; i >= 0; i--) {
      const s = steps[i];
      if (s.type === "tool_call" && s.id === id) return s;
    }
    return undefined;
  }
}
