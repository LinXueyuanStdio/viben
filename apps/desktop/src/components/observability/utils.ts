/**
 * Utility functions for trace visualization
 */
import { Server, Globe, Database, Zap } from "lucide-react";
import { createElement } from "react";
import type { TraceSpan, TraceSpanNode, TraceTree } from "./types";

/**
 * Get icon for span kind
 */
export function getSpanKindIcon(kind: number) {
  switch (kind) {
    case 1:
      return createElement(Server, { className: "h-3 w-3" });
    case 2:
      return createElement(Globe, { className: "h-3 w-3" });
    case 3:
    case 4:
      return createElement(Database, { className: "h-3 w-3" });
    default:
      return createElement(Zap, { className: "h-3 w-3" });
  }
}

/**
 * Copy to clipboard helper
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a span has request/response data (is an API call or tool)
 */
export function hasDetailData(span: TraceSpan): boolean {
  return !!(
    span.attributes["http.request.body"] ||
    span.attributes["http.response.body"] ||
    span.attributes["tool.input"] ||
    span.attributes["tool_result.output"]
  );
}

/**
 * Format duration for display
 */
export function formatDuration(ms: number): string {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(2)}s`;
  }
  return `${ms.toFixed(2)}ms`;
}

/**
 * Format time for display
 */
export function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString();
}

/**
 * Format full datetime for display
 */
export function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

/**
 * Build a tree structure from flat spans
 */
export function buildTraceTree(spans: TraceSpan[]): TraceTree | null {
  if (spans.length === 0) return null;

  // Create a map of spanId to node
  const nodeMap = new Map<string, TraceSpanNode>();

  // First pass: create nodes
  for (const span of spans) {
    nodeMap.set(span.spanId, {
      ...span,
      children: [],
    });
  }

  // Second pass: build tree structure
  let root: TraceSpanNode | null = null;

  for (const span of spans) {
    const node = nodeMap.get(span.spanId)!;
    if (span.parentSpanId && nodeMap.has(span.parentSpanId)) {
      const parent = nodeMap.get(span.parentSpanId)!;
      parent.children.push(node);
    } else {
      // This is a root span
      if (!root || span.startTime < root.startTime) {
        root = node;
      }
    }
  }

  if (!root) return null;

  // Sort children by start time
  const sortChildren = (node: TraceSpanNode) => {
    node.children.sort((a, b) => a.startTime - b.startTime);
    node.children.forEach(sortChildren);
  };
  sortChildren(root);

  // Calculate trace timing
  let minStart = root.startTime;
  let maxEnd = root.endTime;

  const traverse = (node: TraceSpanNode) => {
    if (node.startTime < minStart) minStart = node.startTime;
    if (node.endTime > maxEnd) maxEnd = node.endTime;
    node.children.forEach(traverse);
  };
  traverse(root);

  return {
    traceId: "", // Will be set by caller
    startTime: minStart,
    endTime: maxEnd,
    totalDuration: maxEnd - minStart,
    root,
  };
}

/**
 * Flatten tree into array for timeline view
 */
export function flattenSpans(tree: TraceTree): TraceSpanNode[] {
  const spans: TraceSpanNode[] = [];
  const traverse = (node: TraceSpanNode) => {
    spans.push(node);
    node.children.forEach(traverse);
  };
  traverse(tree.root);
  return spans;
}

/**
 * Filter spans by search query
 */
export function filterSpans(spans: TraceSpanNode[], query: string): TraceSpanNode[] {
  if (!query.trim()) return spans;
  const lowerQuery = query.toLowerCase();
  return spans.filter(
    (span) =>
      span.displayName.toLowerCase().includes(lowerQuery) ||
      span.name.toLowerCase().includes(lowerQuery) ||
      span.spanId.toLowerCase().includes(lowerQuery) ||
      JSON.stringify(span.attributes).toLowerCase().includes(lowerQuery)
  );
}
