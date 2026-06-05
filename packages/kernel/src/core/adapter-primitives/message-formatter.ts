import type { NoiseAction, NoiseRule } from "./format-types.js";
import { STATUS_ICONS, KIND_ICONS } from "./format-types.js";

/**
 * Recursively extracts plain text from an agent's response content.
 *
 * Agent responses can be strings, arrays of content blocks, or nested
 * objects with `text`, `content`, `input`, or `output` fields. This
 * function normalizes all variants into a single string. Falls back
 * to JSON serialization for unrecognized structures to avoid silently
 * dropping edge-case responses.
 */
export function extractContentText(content: unknown, depth = 0): string {
  if (!content || depth > 5) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((c) => extractContentText(c, depth + 1))
      .filter(Boolean)
      .join("\n");
  }
  if (typeof content !== "object") return String(content);

  const obj = content as Record<string, unknown>;
  if (obj.text && typeof obj.text === "string") return obj.text;
  if (obj.content) {
    if (typeof obj.content === "string") return obj.content;
    if (Array.isArray(obj.content)) {
      return obj.content
        .map((c) => extractContentText(c, depth + 1))
        .filter(Boolean)
        .join("\n");
    }
    return extractContentText(obj.content, depth + 1);
  }
  if (obj.input) return extractContentText(obj.input, depth + 1);
  if (obj.output) return extractContentText(obj.output, depth + 1);

  // Skip objects with only a 'type' key and no content fields
  const keys = Object.keys(obj).filter((k) => k !== "type");
  if (keys.length === 0) return "";

  // Fallback: serialize unrecognized objects so edge-case agent responses are not silently dropped
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return "";
  }
}

function parseRawInput(rawInput: unknown): Record<string, unknown> {
  try {
    if (typeof rawInput === "string") {
      return JSON.parse(rawInput) as Record<string, unknown>;
    }
    if (typeof rawInput === "object" && rawInput !== null) {
      return rawInput as Record<string, unknown>;
    }
  } catch {
    // fall through
  }
  return {};
}

/**
 * Builds a human-readable summary line for a tool call (used at medium/high verbosity).
 *
 * Includes an icon and key arguments (e.g., "Read src/foo.ts (50 lines)").
 * If the agent provides a `displaySummary` override, it takes precedence.
 */
export function formatToolSummary(
  name: string,
  rawInput: unknown,
  displaySummary?: string,
): string {
  if (displaySummary && typeof displaySummary === "string") {
    return displaySummary;
  }

  const args = parseRawInput(rawInput);
  const lowerName = name.toLowerCase();

  if (lowerName === "read") {
    const fp = args.file_path ?? args.filePath ?? "";
    const limit = args.limit ? ` (${args.limit} lines)` : "";
    return fp ? `📖 Read ${fp}${limit}` : `🔧 ${name}`;
  }
  if (lowerName === "edit") {
    const fp = args.file_path ?? args.filePath ?? "";
    return fp ? `✏️ Edit ${fp}` : `🔧 ${name}`;
  }
  if (lowerName === "write") {
    const fp = args.file_path ?? args.filePath ?? "";
    return fp ? `📝 Write ${fp}` : `🔧 ${name}`;
  }
  if (lowerName === "bash" || lowerName === "terminal") {
    const cmd = String(args.command ?? args.cmd ?? "").slice(0, 60);
    return cmd ? `▶️ Run: ${cmd}` : `▶️ Terminal`;
  }
  if (lowerName === "grep") {
    const pattern = args.pattern ?? "";
    const path = args.path ?? "";
    return pattern
      ? `🔍 Grep "${pattern}"${path ? ` in ${path}` : ""}`
      : `🔧 ${name}`;
  }
  if (lowerName === "glob") {
    const pattern = args.pattern ?? "";
    return pattern ? `🔍 Glob ${pattern}` : `🔧 ${name}`;
  }
  if (lowerName === "agent") {
    const desc = String(args.description ?? "").slice(0, 60);
    return desc ? `🧠 Agent: ${desc}` : `🔧 ${name}`;
  }
  if (lowerName === "webfetch" || lowerName === "web_fetch") {
    const raw = args.url ?? "";
    const url = (raw !== "undefined" ? String(raw) : "").slice(0, 60);
    return url ? `🌐 Fetch ${url}` : `🔧 ${name}`;
  }
  if (lowerName === "websearch" || lowerName === "web_search") {
    const raw = args.query ?? "";
    const query = (raw !== "undefined" ? String(raw) : "").slice(0, 60);
    return query ? `🌐 Search "${query}"` : `🔧 ${name}`;
  }

  return `🔧 ${name}`;
}

/**
 * Builds a compact title for a tool call (used at low verbosity).
 *
 * Returns just the key identifier (file path, command, pattern) without
 * icons or extra decoration. If `displayTitle` is provided, it takes precedence.
 */
export function formatToolTitle(
  name: string,
  rawInput: unknown,
  displayTitle?: string,
): string {
  if (displayTitle && typeof displayTitle === "string") {
    return displayTitle;
  }

  const args = parseRawInput(rawInput);
  const lowerName = name.toLowerCase();

  if (["read", "edit", "write"].includes(lowerName)) {
    return String(args.file_path ?? args.filePath ?? name);
  }
  if (lowerName === "bash" || lowerName === "terminal") {
    return String(args.command ?? args.cmd ?? name).slice(0, 60);
  }
  if (lowerName === "grep") {
    const pattern = args.pattern ?? "";
    const path = args.path ?? "";
    return pattern ? `"${pattern}"${path ? ` in ${path}` : ""}` : name;
  }
  if (lowerName === "glob") {
    return String(args.pattern ?? name);
  }
  if (lowerName === "agent") {
    return String(args.description ?? name).slice(0, 60);
  }
  if (["webfetch", "web_fetch"].includes(lowerName)) {
    const url = typeof args.url === "string" && args.url !== "undefined" ? args.url : null;
    return (url ?? name).slice(0, 60);
  }
  if (["websearch", "web_search"].includes(lowerName)) {
    const query = typeof args.query === "string" && args.query !== "undefined" ? args.query : null;
    return (query ?? name).slice(0, 60);
  }

  return name;
}

/**
 * Selects the appropriate emoji icon for a tool call card.
 * Priority: status icon (e.g., running, done, error) > kind icon (e.g., read, execute) > default.
 */
export function resolveToolIcon(tool: {
  status?: string;
  displayKind?: string;
  kind?: string;
}): string {
  const statusIcon = STATUS_ICONS[tool.status || ""];
  if (statusIcon) return statusIcon;
  const kind = tool.displayKind ?? tool.kind;
  if (kind && KIND_ICONS[kind]) return KIND_ICONS[kind];
  return "🔧";
}

// Noise filtering — determines which tool calls are low-signal and can be
// hidden or collapsed at lower verbosity levels to reduce chat clutter.

const NOISE_RULES: NoiseRule[] = [
  {
    match: (name) => name.toLowerCase() === "ls",
    action: "hide",
  },
  {
    match: (_name, kind, rawInput) => {
      if (kind !== "read") return false;
      const args = parseRawInput(rawInput);
      const p = String(args.file_path ?? args.filePath ?? args.path ?? "");
      return p.endsWith("/");
    },
    action: "hide",
  },
  {
    match: (name) => name.toLowerCase() === "glob",
    action: "hide",
  },
  {
    match: (name) => name.toLowerCase() === "grep",
    action: "hide",
  },
];

/**
 * Evaluates whether a tool call is considered "noise" based on its name, kind, and input.
 * Returns `"hide"` (suppress entirely) or `"collapse"` (show minimally), or `null` if not noise.
 */
export function evaluateNoise(
  name: string,
  kind: string,
  rawInput: unknown,
): NoiseAction | null {
  for (const rule of NOISE_RULES) {
    if (rule.match(name, kind, rawInput)) return rule.action;
  }
  return null;
}
