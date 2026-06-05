import type { ToolDisplaySpec } from "../display-spec-builder.js";
import type { PlanEntry } from "../../types.js";

/** Debounce interval for batching rapid tool state updates into a single render. */
const DEBOUNCE_MS = 500;

export type { ToolDisplaySpec };

/** Token usage and cost data appended to the tool card after the turn completes. */
export interface UsageData {
  tokensUsed?: number;
  contextSize?: number;
  cost?: number;
}

/**
 * A point-in-time snapshot of all tool cards in a turn, used for rendering.
 * Includes completion counts so adapters can show progress (e.g., "3/5 tools done").
 */
export interface ToolCardSnapshot {
  specs: ToolDisplaySpec[];
  planEntries?: PlanEntry[];
  usage?: UsageData;
  totalVisible: number;
  completedVisible: number;
  /** True when all visible tools have reached a terminal status. */
  allComplete: boolean;
}

export interface ToolCardStateConfig {
  /** Called with a snapshot whenever the tool card content changes. */
  onFlush: (snapshot: ToolCardSnapshot) => void;
}

const DONE_STATUSES = new Set(["completed", "done", "failed", "error"]);

/**
 * Aggregates tool display specs, plan entries, and usage data for a single
 * turn, then flushes snapshots to the adapter for rendering.
 *
 * Uses debouncing to batch rapid updates (e.g., multiple tools starting
 * in quick succession) into a single render pass. The first update flushes
 * immediately for responsiveness; subsequent updates are debounced.
 */
export class ToolCardState {
  private specs: ToolDisplaySpec[] = [];
  private planEntries?: PlanEntry[];
  private usage?: UsageData;
  // Lifecycle: active (first flush pending) → active (subsequent updates debounced) → finalized.
  // Once finalized, all updateFromSpec/updatePlan/appendUsage/finalize() calls are no-ops —
  // guards against events arriving after the session has ended or the tool has already completed.
  private finalized = false;
  private isFirstFlush = true;
  private debounceTimer?: ReturnType<typeof setTimeout>;
  private onFlush: (snapshot: ToolCardSnapshot) => void;

  constructor(config: ToolCardStateConfig) {
    this.onFlush = config.onFlush;
  }

  /** Adds or updates a tool spec. First call flushes immediately; subsequent calls are debounced. */
  updateFromSpec(spec: ToolDisplaySpec): void {
    if (this.finalized) return;

    const existingIdx = this.specs.findIndex((s) => s.id === spec.id);
    if (existingIdx >= 0) {
      this.specs[existingIdx] = spec;
    } else {
      this.specs.push(spec);
    }

    if (this.isFirstFlush) {
      this.isFirstFlush = false;
      this.flush();
    } else {
      this.scheduleFlush();
    }
  }

  /** Updates the plan entries displayed alongside tool cards. */
  updatePlan(entries: PlanEntry[]): void {
    if (this.finalized) return;
    this.planEntries = entries;

    if (this.specs.length === 0 && this.isFirstFlush) {
      this.isFirstFlush = false;
      this.flush();
    } else {
      this.scheduleFlush();
    }
  }

  /** Appends token usage data to the tool card (typically at end of turn). */
  appendUsage(usage: UsageData): void {
    if (this.finalized) return;
    this.usage = usage;
    this.scheduleFlush();
  }

  /** Marks the turn as complete and flushes the final snapshot immediately. */
  finalize(): void {
    if (this.finalized) return;
    this.finalized = true;
    this.clearDebounce();
    this.flush();
  }

  /** Stops all pending flushes without emitting a final snapshot. */
  destroy(): void {
    this.finalized = true;
    this.clearDebounce();
  }

  hasContent(): boolean {
    return this.specs.length > 0 || this.planEntries !== undefined;
  }

  private snapshot(): ToolCardSnapshot {
    const visible = this.specs.filter((s) => !s.isHidden);
    const completedVisible = visible.filter((s) => DONE_STATUSES.has(s.status)).length;
    const allComplete = visible.length > 0 && completedVisible === visible.length;
    return {
      specs: this.specs,
      planEntries: this.planEntries,
      usage: this.usage,
      totalVisible: visible.length,
      completedVisible,
      allComplete,
    };
  }

  private flush(): void {
    this.clearDebounce();
    this.onFlush(this.snapshot());
  }

  private scheduleFlush(): void {
    this.clearDebounce();
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = undefined;
      this.flush();
    }, DEBOUNCE_MS);
  }

  private clearDebounce(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = undefined;
    }
  }
}
