/**
 * Types for trace visualization components
 */

/**
 * Trace event attached to a span
 */
export interface TraceEvent {
  name: string;
  time: number;
  attributes?: Record<string, unknown>;
}

/**
 * Base trace span data
 */
export interface TraceSpan {
  spanId: string;
  parentSpanId?: string;
  name: string;
  displayName: string;
  kind: number;
  startTime: number;
  endTime: number;
  duration: number;
  status: {
    code: number;
    message?: string;
  };
  attributes: Record<string, unknown>;
  events: TraceEvent[];
}

/**
 * Trace span with children for tree visualization
 */
export interface TraceSpanNode extends TraceSpan {
  children: TraceSpanNode[];
}

/**
 * Complete trace tree structure
 */
export interface TraceTree {
  traceId: string;
  startTime: number;
  endTime: number;
  totalDuration: number;
  root: TraceSpanNode;
}

/**
 * Summary of a trace for list display
 */
export interface TraceSummary {
  traceId: string;
  size: number;
  mtime: string;
}

/**
 * Summary of traces for a date
 */
export interface DateSummary {
  date: string;
  count: number;
  totalSize: number;
}

/**
 * Statistics for a trace
 */
export interface TraceStats {
  totalSpans: number;
  successSpans: number;
  errorSpans: number;
  maxDepth: number;
  operations: Array<{
    name: string;
    count: number;
    totalDuration: number;
    avgDuration: number;
  }>;
}

/**
 * Span kind names mapping
 */
export const SPAN_KIND_NAMES: Record<number, string> = {
  0: "INTERNAL",
  1: "SERVER",
  2: "CLIENT",
  3: "PRODUCER",
  4: "CONSUMER",
};
