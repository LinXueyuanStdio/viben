import { BaseRenderer } from "../../core/adapter-primitives/rendering/renderer.js";
import type { RenderedMessage } from "../../core/adapter-primitives/rendering/renderer.js";
import type { OutgoingMessage, NotificationMessage } from "../../core/types.js";
import type {
  DisplayVerbosity,
  ToolCallMeta,
  ToolUpdateMeta,
} from "../../core/adapter-primitives/format-types.js";
import {
  escapeHtml,
  formatToolCall,
  formatToolUpdate,
  formatPlan,
  formatUsage,
} from "./formatting.js";

/**
 * Telegram-specific renderer for structured `OutgoingMessage` types.
 *
 * Produces HTML strings (Telegram parse_mode: 'HTML') for each message kind.
 * Plain text rendering is not used because HTML mode handles agent output
 * (code fences, diffs, etc.) more reliably than MarkdownV2.
 */
export class TelegramRenderer extends BaseRenderer {
  renderToolCall(
    content: OutgoingMessage,
    verbosity: DisplayVerbosity,
  ): RenderedMessage {
    const meta = (content.metadata ?? {}) as Partial<ToolCallMeta>;
    return {
      body: formatToolCall(meta as ToolCallMeta, verbosity),
      format: "html",
    };
  }

  renderToolUpdate(
    content: OutgoingMessage,
    verbosity: DisplayVerbosity,
  ): RenderedMessage {
    const meta = (content.metadata ?? {}) as Partial<ToolUpdateMeta>;
    return {
      body: formatToolUpdate(meta as ToolUpdateMeta, verbosity),
      format: "html",
    };
  }

  renderPlan(content: OutgoingMessage): RenderedMessage {
    const meta = content.metadata as
      | { entries?: Array<{ content: string; status: string }> }
      | undefined;
    return {
      body: formatPlan({ entries: meta?.entries ?? [] }),
      format: "html",
    };
  }

  renderUsage(
    content: OutgoingMessage,
    verbosity: DisplayVerbosity,
  ): RenderedMessage {
    const meta = content.metadata as
      | { tokensUsed?: number; contextSize?: number; cost?: number }
      | undefined;
    return { body: formatUsage(meta ?? {}, verbosity), format: "html" };
  }

  renderError(content: OutgoingMessage): RenderedMessage {
    return {
      body: `❌ <b>Error:</b> ${escapeHtml(content.text)}`,
      format: "html",
    };
  }

  renderNotification(notification: NotificationMessage): RenderedMessage {
    const emoji: Record<string, string> = {
      completed: "✅",
      error: "❌",
      permission: "🔐",
      input_required: "💬",
      budget_warning: "⚠️",
    };
    let text = `${emoji[notification.type] || "ℹ️"} <b>${escapeHtml(notification.sessionName || "Session")}</b>\n`;
    text += escapeHtml(notification.summary);
    return { body: text, format: "html" };
  }

  renderSystemMessage(content: OutgoingMessage): RenderedMessage {
    return { body: escapeHtml(content.text), format: "html" };
  }

  renderModeChange(content: OutgoingMessage): RenderedMessage {
    const modeId = (content.metadata as Record<string, unknown>)?.modeId ?? "";
    return {
      body: `🔄 <b>Mode:</b> ${escapeHtml(String(modeId))}`,
      format: "html",
    };
  }

  renderConfigUpdate(): RenderedMessage {
    return { body: "⚙️ <b>Config updated</b>", format: "html" };
  }

  renderModelUpdate(content: OutgoingMessage): RenderedMessage {
    const modelId =
      (content.metadata as Record<string, unknown>)?.modelId ?? "";
    return {
      body: `🤖 <b>Model:</b> ${escapeHtml(String(modelId))}`,
      format: "html",
    };
  }
}
