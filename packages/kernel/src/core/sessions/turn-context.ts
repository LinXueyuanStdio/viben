import { nanoid } from "nanoid";
import type { AgentEvent } from "../types.js";
import type { Attachment, TurnMeta } from "../types.js";

/**
 * Immutable context for a single user-prompt → agent-response cycle ("turn").
 *
 * Sealed when a prompt is dequeued from the PromptQueue and cleared after the turn
 * completes. Bridges use this to route agent events to the correct adapter when
 * multiple adapters are attached to the same session.
 */
export interface TurnContext {
  /** Unique identifier for this turn — shared between message:queued and message:processing events. */
  turnId: string;
  /** The adapter that originated this prompt. */
  sourceAdapterId: string;
  /** Where to send the response: null = silent (suppress), undefined = same as source, string = explicit target. */
  responseAdapterId?: string | null;
  /** The raw user prompt before any middleware modifications. */
  userPrompt: string;
  /** The final prompt text sent to the agent after all middleware transformations. */
  finalPrompt: string;
  /** File or media attachments included with the prompt. */
  attachments?: Attachment[];
  /** Caller-supplied metadata for this turn (e.g., identity, source info). */
  meta?: TurnMeta;
}

/**
 * Routing hints attached to an incoming prompt — carried through the queue
 * and used to construct TurnContext when the prompt is dequeued.
 */
export interface TurnRouting {
  sourceAdapterId: string;
  responseAdapterId?: string | null;
}

/** Identity and display info for the user who sent the turn. */
export interface TurnSender {
  userId: string;
  identityId: string;
  displayName?: string;
  username?: string;
}

/**
 * Extract sender identity from turn metadata.
 * Returns null if identity fields are missing or incomplete.
 */
export function extractSender(meta?: TurnMeta): TurnSender | null {
  const identity = (meta as any)?.identity;
  if (!identity || !identity.userId || !identity.identityId) return null;
  return {
    userId: identity.userId,
    identityId: identity.identityId,
    displayName: identity.displayName,
    username: identity.username,
  };
}

/**
 * Get the effective response adapter for a turn.
 * - null → silent (no adapter renders)
 * - undefined → fallback to sourceAdapterId
 * - string → explicit target
 */
export function getEffectiveTarget(ctx: TurnContext): string | null {
  if (ctx.responseAdapterId === null) return null;
  return ctx.responseAdapterId ?? ctx.sourceAdapterId;
}

/**
 * Create a new TurnContext. Called when a prompt is dequeued from the queue.
 * If a pre-generated turnId is provided (from enqueuePrompt), it is used; otherwise a new one is generated.
 */
export function createTurnContext(
  sourceAdapterId: string,
  responseAdapterId: string | null | undefined,
  turnId: string | undefined,
  userPrompt: string,
  finalPrompt: string,
  attachments?: Attachment[],
  meta?: TurnMeta,
): TurnContext {
  return {
    turnId: turnId ?? nanoid(8),
    sourceAdapterId,
    responseAdapterId,
    userPrompt,
    finalPrompt,
    attachments,
    meta,
  };
}

/**
 * System events are broadcast to ALL attached adapters.
 * Turn events are routed only to the response adapter.
 */
const SYSTEM_EVENT_TYPES = new Set([
  "session_end",
  "system_message",
  "session_info_update",
  "config_option_update",
  "commands_update",
  "tts_strip",
]);

export function isSystemEvent(event: AgentEvent): boolean {
  return SYSTEM_EVENT_TYPES.has(event.type);
}
