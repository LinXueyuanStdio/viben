import type { ContextMode } from "../context-provider.js";
import type { Turn, Step, ToolCallStep } from "./types.js";

/**
 * Choose a rendering mode based on the total number of turns.
 * Short sessions get full fidelity; large sessions fall back to compact
 * to stay within the prompt token budget.
 *   ≤10 turns  → full
 *   11-25 turns → balanced
 *   >25 turns  → compact
 */
export function selectLevel(turnCount: number): ContextMode {
  if (turnCount <= 10) return "full";
  if (turnCount <= 25) return "balanced";
  return "compact";
}

// Rough heuristic: 1 token ≈ 4 chars for English/code mixed text.
export function estimateTokens(text: string): number {
  return Math.floor(text.length / 4);
}

/**
 * Render a list of turns to markdown in the requested detail level.
 * Used both for single-session display and as a building block for merged output.
 */
export function buildHistoryMarkdown(turns: Turn[], mode: ContextMode): string {
  if (turns.length === 0) return "";
  switch (mode) {
    case "full":
      return buildFull(turns);
    case "balanced":
      return buildBalanced(turns);
    case "compact":
      return buildCompact(turns);
  }
}

// ─── Full Mode ───────────────────────────────────────────────────────────────

function buildFull(turns: Turn[]): string {
  const out: string[] = [];
  let userIndex = 0;

  for (const turn of turns) {
    if (turn.role === "user") {
      userIndex++;
      out.push(`**User [${userIndex}]:**`);
      out.push(turn.content ?? "");
      if (turn.attachments?.length) {
        out.push(turn.attachments.map((a) => `[${a.type}: ${a.fileName}]`).join(" "));
      }
      out.push("");
    } else if (turn.role === "assistant" && turn.steps?.length) {
      out.push("**Assistant:**");

      for (const step of turn.steps) {
        out.push(renderStepFull(step));
      }

      if (turn.usage) {
        const parts: string[] = [];
        if (turn.usage.tokensUsed) parts.push(`${turn.usage.tokensUsed.toLocaleString()} tokens`);
        if (turn.usage.cost) parts.push(`$${turn.usage.cost.amount.toFixed(4)}`);
        if (parts.length) out.push(`**Usage**: ${parts.join(", ")}`);
      }

      out.push("");
      out.push("---");
      out.push("");
    }
  }

  return out.join("\n");
}

function renderStepFull(step: Step): string {
  switch (step.type) {
    case "thinking":
      return `> **Thinking**: ${step.content}\n`;
    case "text":
      return `${step.content}\n`;
    case "tool_call":
      return renderToolCallFull(step);
    case "plan":
      return renderPlan(step.entries);
    case "image":
      return `[Image: ${step.mimeType}]\n`;
    case "audio":
      return `[Audio: ${step.mimeType}]\n`;
    case "resource":
      return `[Resource: ${step.name}] ${step.uri}\n`;
    case "resource_link":
      return `[Resource Link: ${step.name}] ${step.uri}\n`;
    case "mode_change":
      return `*Mode changed to: ${step.modeId}*\n`;
    case "config_change":
      return `*Config ${step.configId} set to: ${step.value}*\n`;
  }
}

function renderToolCallFull(step: ToolCallStep): string {
  const lines: string[] = [];
  const loc = step.locations?.[0];
  const locStr = loc ? (loc.line ? `${loc.path}:${loc.line}` : loc.path) : "";

  if (step.diff) {
    lines.push(`**[${step.name}]** \`${locStr || step.diff.path}\``);
    lines.push("```diff");
    if (step.diff.oldText) {
      for (const line of step.diff.oldText.split("\n")) lines.push(`- ${line}`);
    }
    for (const line of step.diff.newText.split("\n")) lines.push(`+ ${line}`);
    lines.push("```");
  } else {
    lines.push(`**[${step.name}]** \`${locStr}\``);
  }

  if (step.permission) {
    lines.push(`*Permission: ${step.permission.outcome}*`);
  }

  lines.push("");
  return lines.join("\n");
}

function renderPlan(entries: { content: string; priority: string; status: string }[]): string {
  const lines = ["**Plan:**"];
  for (const e of entries) {
    const icon = e.status === "completed" || e.status === "done" ? "✅" : e.status === "in_progress" ? "🔄" : "⬜";
    lines.push(`${icon} ${e.content} (${e.priority})`);
  }
  lines.push("");
  return lines.join("\n");
}

// ─── Balanced Mode ───────────────────────────────────────────────────────────

function buildBalanced(turns: Turn[]): string {
  const out: string[] = [];
  let userIndex = 0;

  for (const turn of turns) {
    if (turn.role === "user") {
      userIndex++;
      out.push(`**User [${userIndex}]:**`);
      out.push(turn.content ?? "");
      out.push("");
    } else if (turn.role === "assistant" && turn.steps?.length) {
      out.push("**Assistant:**");

      for (const step of turn.steps) {
        if (step.type === "thinking") continue;

        if (step.type === "text") {
          out.push(step.content);
        } else if (step.type === "tool_call") {
          out.push(renderToolCallBalanced(step));
        } else if (step.type === "plan") {
          out.push(renderPlan(step.entries));
        } else {
          out.push(renderStepFull(step));
        }
      }

      out.push("");
      out.push("---");
      out.push("");
    }
  }

  return out.join("\n");
}

function renderToolCallBalanced(step: ToolCallStep): string {
  const loc = step.locations?.[0];
  const locStr = loc ? (loc.line ? `${loc.path}:${loc.line}` : loc.path) : "";

  if (step.diff) {
    const oldLines = step.diff.oldText?.split("\n").length ?? 0;
    const newLines = step.diff.newText.split("\n").length;
    return `- ${step.name} \`${locStr || step.diff.path}\` (-${oldLines}/+${newLines} lines)`;
  }

  return `- ${step.name} \`${locStr}\``;
}

// ─── Compact Mode ────────────────────────────────────────────────────────────

function buildCompact(turns: Turn[]): string {
  const out: string[] = [];
  let i = 0;

  while (i < turns.length) {
    const turn = turns[i];
    if (turn.role === "user") {
      const userText = (turn.content ?? "").slice(0, 100);
      const nextTurn = turns[i + 1];
      if (nextTurn?.role === "assistant" && nextTurn.steps?.length) {
        const tools = nextTurn.steps
          .filter((s) => s.type === "tool_call")
          .map((s) => (s as ToolCallStep).name);
        const texts = nextTurn.steps
          .filter((s) => s.type === "text")
          .map((s) => (s as { content: string }).content.slice(0, 80));
        const parts: string[] = [];
        if (tools.length) parts.push(tools.join(", "));
        if (texts.length) parts.push(texts.join(" "));
        out.push(`User: ${userText} → Assistant: ${parts.join(" | ")}`);
        i += 2;
      } else {
        out.push(`User: ${userText}`);
        i++;
      }
    } else {
      i++;
    }
  }

  return out.join("\n");
}
