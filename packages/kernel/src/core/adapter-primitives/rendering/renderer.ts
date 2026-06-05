import type {
  OutgoingMessage,
  PermissionRequest,
  NotificationMessage,
} from "../../types.js";
import type {
  DisplayVerbosity,
  ToolCallMeta,
  ToolUpdateMeta,
} from "../format-types.js";
import {
  formatToolSummary,
  formatToolTitle,
  resolveToolIcon,
} from "../message-formatter.js";
import { progressBar, formatTokens } from "../format-utils.js";

/**
 * A rendered message ready for platform delivery.
 * The `format` field tells the adapter how to interpret the body
 * (e.g., pass as HTML to Telegram, or as plain text to SSE).
 */
export interface RenderedMessage<TComponents = unknown> {
  body: string;
  format: "html" | "markdown" | "plain" | "structured";
  attachments?: RenderedAttachment[];
  /** Platform-specific UI components (e.g., Telegram inline keyboards). */
  components?: TComponents;
}

/** A rendered permission request with approve/deny action buttons. */
export interface RenderedPermission<
  TComponents = unknown,
> extends RenderedMessage<TComponents> {
  actions: RenderedAction[];
}

/** A single action button for permission requests. */
export interface RenderedAction {
  id: string;
  label: string;
  isAllow?: boolean;
}

/** A file, image, or audio attachment to include with a rendered message. */
export interface RenderedAttachment {
  type: "file" | "image" | "audio";
  data: Buffer | string;
  mimeType?: string;
  filename?: string;
}

/**
 * Rendering contract for platform-specific message formatting.
 *
 * Each adapter provides its own IRenderer implementation (e.g., TelegramRenderer
 * outputs HTML, a CLI renderer might output ANSI). Required methods handle the
 * core message types; optional methods handle less common types and fall back
 * to no-ops if not implemented.
 */
export interface IRenderer {
  renderText(
    content: OutgoingMessage,
    verbosity: DisplayVerbosity,
  ): RenderedMessage;
  renderToolCall(
    content: OutgoingMessage,
    verbosity: DisplayVerbosity,
  ): RenderedMessage;
  renderToolUpdate(
    content: OutgoingMessage,
    verbosity: DisplayVerbosity,
  ): RenderedMessage;
  renderPlan(content: OutgoingMessage): RenderedMessage;
  renderUsage(
    content: OutgoingMessage,
    verbosity: DisplayVerbosity,
  ): RenderedMessage;
  renderPermission(request: PermissionRequest): RenderedPermission;
  renderError(content: OutgoingMessage): RenderedMessage;
  renderNotification(notification: NotificationMessage): RenderedMessage;
  renderThought?(
    content: OutgoingMessage,
    verbosity: DisplayVerbosity,
  ): RenderedMessage;
  renderAttachment?(content: OutgoingMessage): RenderedMessage;
  renderSessionEnd?(content: OutgoingMessage): RenderedMessage;
  renderSystemMessage?(content: OutgoingMessage): RenderedMessage;
  renderModeChange?(
    content: OutgoingMessage,
    verbosity: DisplayVerbosity,
  ): RenderedMessage;
  renderConfigUpdate?(
    content: OutgoingMessage,
    verbosity: DisplayVerbosity,
  ): RenderedMessage;
  renderModelUpdate?(
    content: OutgoingMessage,
    verbosity: DisplayVerbosity,
  ): RenderedMessage;
  renderResource?(content: OutgoingMessage): RenderedMessage;
  renderResourceLink?(content: OutgoingMessage): RenderedMessage;
}

/**
 * Default renderer producing plain-text output for all message types.
 *
 * Platform-specific renderers (e.g., TelegramRenderer) extend this class
 * and override methods to produce HTML, markdown, or structured output.
 * Methods not overridden fall back to these plain-text defaults.
 */
export class BaseRenderer implements IRenderer {
  renderText(content: OutgoingMessage): RenderedMessage {
    return { body: content.text, format: "plain" };
  }

  renderToolCall(
    content: OutgoingMessage,
    verbosity: DisplayVerbosity,
  ): RenderedMessage {
    const meta = (content.metadata ?? {}) as Partial<ToolCallMeta>;
    const name = meta.name ?? content.text ?? "Tool";
    const icon = resolveToolIcon(meta);
    const label =
      verbosity === "low"
        ? formatToolTitle(
            name,
            meta.rawInput,
            meta.displayTitle as string | undefined,
          )
        : formatToolSummary(
            name,
            meta.rawInput,
            meta.displaySummary as string | undefined,
          );
    return { body: `${icon} ${label}`, format: "plain" };
  }

  renderToolUpdate(
    content: OutgoingMessage,
    verbosity: DisplayVerbosity,
  ): RenderedMessage {
    const meta = (content.metadata ?? {}) as Partial<ToolUpdateMeta>;
    const name = meta.name ?? content.text ?? "Tool";
    const icon = resolveToolIcon(meta);
    const label =
      verbosity === "low"
        ? formatToolTitle(
            name,
            meta.rawInput,
            meta.displayTitle as string | undefined,
          )
        : formatToolSummary(
            name,
            meta.rawInput,
            meta.displaySummary as string | undefined,
          );
    return { body: `${icon} ${label}`, format: "plain" };
  }

  renderPlan(content: OutgoingMessage): RenderedMessage {
    const entries =
      (
        content.metadata as {
          entries?: Array<{ content: string; status: string }>;
        }
      )?.entries ?? [];
    const lines = entries.map((e, i) => {
      const icon =
        e.status === "completed"
          ? "✅"
          : e.status === "in_progress"
            ? "🔄"
            : "⬜";
      return `${icon} ${i + 1}. ${e.content}`;
    });
    return { body: `📋 Plan\n${lines.join("\n")}`, format: "plain" };
  }

  renderUsage(
    content: OutgoingMessage,
    verbosity: DisplayVerbosity,
  ): RenderedMessage {
    const meta = content.metadata as
      | { tokensUsed?: number; contextSize?: number; cost?: number }
      | undefined;
    if (!meta?.tokensUsed)
      return { body: "📊 Usage data unavailable", format: "plain" };
    const costStr = meta.cost != null ? ` · $${meta.cost.toFixed(2)}` : "";
    if (verbosity === "medium") {
      return {
        body: `📊 ${formatTokens(meta.tokensUsed)} tokens${costStr}`,
        format: "plain",
      };
    }
    if (!meta.contextSize)
      return {
        body: `📊 ${formatTokens(meta.tokensUsed)} tokens`,
        format: "plain",
      };
    const ratio = meta.tokensUsed / meta.contextSize;
    const pct = Math.round(ratio * 100);
    const bar = progressBar(ratio);
    let text = `📊 ${formatTokens(meta.tokensUsed)} / ${formatTokens(meta.contextSize)} tokens\n${bar} ${pct}%`;
    if (meta.cost != null) text += `\n💰 $${meta.cost.toFixed(2)}`;
    return { body: text, format: "plain" };
  }

  renderPermission(request: PermissionRequest): RenderedPermission {
    return {
      body: request.description,
      format: "plain",
      actions: request.options.map((o) => ({
        id: o.id,
        label: o.label,
        isAllow: o.isAllow,
      })),
    };
  }

  renderError(content: OutgoingMessage): RenderedMessage {
    return { body: `❌ Error: ${content.text}`, format: "plain" };
  }

  renderNotification(notification: NotificationMessage): RenderedMessage {
    const emoji: Record<string, string> = {
      completed: "✅",
      error: "❌",
      permission: "🔐",
      input_required: "💬",
      budget_warning: "⚠️",
    };
    return {
      body: `${emoji[notification.type] || "ℹ️"} ${notification.sessionName || "Session"}\n${notification.summary}`,
      format: "plain",
    };
  }

  renderSystemMessage(content: OutgoingMessage): RenderedMessage {
    return { body: content.text, format: "plain" };
  }

  renderModeChange(content: OutgoingMessage): RenderedMessage {
    const modeId = (content.metadata as Record<string, unknown>)?.modeId ?? "";
    return { body: `🔄 Mode: ${modeId}`, format: "plain" };
  }

  renderConfigUpdate(): RenderedMessage {
    return { body: "⚙️ Config updated", format: "plain" };
  }

  renderModelUpdate(content: OutgoingMessage): RenderedMessage {
    const modelId =
      (content.metadata as Record<string, unknown>)?.modelId ?? "";
    return { body: `🤖 Model: ${modelId}`, format: "plain" };
  }

  renderResource(content: OutgoingMessage): RenderedMessage {
    const uri = (content.metadata as Record<string, unknown>)?.uri ?? "";
    return { body: `📄 Resource: ${content.text} (${uri})`, format: "plain" };
  }

  renderResourceLink(content: OutgoingMessage): RenderedMessage {
    const uri = (content.metadata as Record<string, unknown>)?.uri ?? "";
    return { body: `🔗 ${content.text}: ${uri}`, format: "plain" };
  }
}
