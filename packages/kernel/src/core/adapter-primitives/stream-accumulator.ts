// src/core/adapter-primitives/stream-accumulator.ts
//
// Buffers and accumulates streaming agent output (tool calls, thoughts)
// into structured state that adapters can render at any point during a turn.

import type { ToolCallMeta, ViewerLinks } from "./format-types.js";
import { evaluateNoise } from "./message-formatter.js";

/** Accumulated state for a single tool call during a streaming response. */
export interface ToolEntry {
  id: string;
  name: string;
  kind: string;
  rawInput: unknown;
  /** Tool output content, populated when the tool completes. */
  content: string | null;
  status: string;
  viewerLinks?: ViewerLinks;
  diffStats?: { added: number; removed: number };
  displaySummary?: string;
  displayTitle?: string;
  displayKind?: string;
  /** Whether this tool is considered noise (e.g., ls, glob) and should be hidden at lower verbosities. */
  isNoise: boolean;
}

/** Buffered update for a tool whose initial `tool_call` event has not arrived yet. */
interface PendingUpdate {
  status: string;
  rawInput?: unknown;
  content?: string | null;
  viewerLinks?: ViewerLinks;
  diffStats?: { added: number; removed: number };
}

/**
 * Tracks all tool calls within a single streaming turn.
 *
 * Tool call events and update events can arrive out of order (e.g., a
 * `tool_update` may arrive before the corresponding `tool_call`). This map
 * handles that by buffering updates until the initial call arrives.
 */
export class ToolStateMap {
  private entries: Map<string, ToolEntry> = new Map();
  private pendingUpdates: Map<string, PendingUpdate> = new Map();

  /**
   * Creates or updates an entry from a tool_call event.
   * If a pending update exists for this id, applies it immediately.
   */
  upsert(meta: ToolCallMeta, kind: string, rawInput: unknown): ToolEntry {
    const isNoise = evaluateNoise(meta.name, kind, rawInput) !== null;

    const entry: ToolEntry = {
      id: meta.id,
      name: meta.name,
      kind,
      rawInput,
      content: null,
      status: meta.status ?? "running",
      viewerLinks: meta.viewerLinks,
      displaySummary: meta.displaySummary,
      displayTitle: meta.displayTitle,
      displayKind: meta.displayKind,
      isNoise,
    };

    this.entries.set(meta.id, entry);

    // Apply any pending update that arrived before the initial call
    const pending = this.pendingUpdates.get(meta.id);
    if (pending) {
      this.pendingUpdates.delete(meta.id);
      this._applyUpdate(entry, pending);
    }

    return entry;
  }

  /**
   * Updates an existing entry from a tool_call_update event.
   * If the entry doesn't exist yet (out-of-order delivery), buffers the update.
   */
  merge(
    id: string,
    status: string,
    rawInput?: unknown,
    content?: string | null,
    viewerLinks?: ViewerLinks,
    diffStats?: { added: number; removed: number },
  ): ToolEntry | undefined {
    const entry = this.entries.get(id);

    if (!entry) {
      // Buffer the update for when upsert is called
      this.pendingUpdates.set(id, { status, rawInput, content, viewerLinks, diffStats });
      return undefined;
    }

    this._applyUpdate(entry, { status, rawInput, content, viewerLinks, diffStats });
    return entry;
  }

  private _applyUpdate(entry: ToolEntry, update: PendingUpdate): void {
    entry.status = update.status;
    if (update.rawInput !== undefined) {
      entry.rawInput = update.rawInput;
    }
    if (update.content !== undefined) {
      entry.content = update.content ?? null;
    }
    if (update.viewerLinks !== undefined) {
      entry.viewerLinks = update.viewerLinks;
    }
    if (update.diffStats !== undefined) {
      entry.diffStats = update.diffStats;
    }
  }

  /** Retrieves a tool entry by ID, or undefined if not yet tracked. */
  get(id: string): ToolEntry | undefined {
    return this.entries.get(id);
  }

  /** Resets all state between turns. */
  clear(): void {
    this.entries.clear();
    this.pendingUpdates.clear();
  }
}

/**
 * Buffers partial thought text chunks from the agent's extended thinking.
 *
 * Chunks are appended until `seal()` is called, which marks the thought
 * as complete and returns the full text. Once sealed, further appends
 * are ignored.
 */
export class ThoughtBuffer {
  private chunks: string[] = [];
  private sealed = false;

  /** Appends a thought text chunk. Ignored if already sealed. */
  append(chunk: string): void {
    if (this.sealed) return;
    this.chunks.push(chunk);
  }

  /** Marks the thought as complete and returns the full accumulated text. */
  seal(): string {
    this.sealed = true;
    return this.chunks.join("");
  }

  /** Returns the text accumulated so far without sealing. */
  getText(): string {
    return this.chunks.join("");
  }

  isSealed(): boolean {
    return this.sealed;
  }

  /** Resets the buffer for reuse in a new turn. */
  reset(): void {
    this.chunks = [];
    this.sealed = false;
  }
}
