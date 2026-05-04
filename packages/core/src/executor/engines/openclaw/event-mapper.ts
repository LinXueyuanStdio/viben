/**
 * OpenClaw Event Mapper
 *
 * Maps @openclaw/sdk normalized events to viben SSEMessage format.
 */

import type { OpenClawEvent } from "@openclaw/sdk";
import type { SSEMessage } from "../../ops/types";

/**
 * Map an OpenClaw SDK event to a viben SSEMessage.
 * Returns null for events that should be skipped.
 */
export function mapOpenClawEvent(event: OpenClawEvent): SSEMessage | null {
  const data = event.data as Record<string, unknown> | undefined;

  switch (event.type) {
    case "assistant.delta": {
      const delta = (data?.delta as string) ?? (data?.text as string) ?? "";
      if (!delta) return null;
      return { type: "text", content: delta };
    }

    case "assistant.message": {
      const content = (data?.text as string) ?? (data?.content as string) ?? "";
      if (!content) return null;
      return { type: "text", content };
    }

    case "tool.call.started": {
      const id = (data?.toolCallId as string) ?? (data?.id as string) ?? event.id;
      const name = (data?.name as string) ?? "unknown";
      const input = data?.args ?? data?.input ?? {};
      return { type: "tool_use", id, name, input };
    }

    case "tool.call.completed": {
      const toolUseId = (data?.toolCallId as string) ?? (data?.id as string) ?? "";
      const output = (data?.output as string) ?? (data?.result as string) ?? JSON.stringify(data ?? {});
      const isError = (data?.isError as boolean) ?? false;
      return { type: "tool_result", tool_use_id: toolUseId, output, is_error: isError };
    }

    case "tool.call.failed": {
      const toolUseId = (data?.toolCallId as string) ?? (data?.id as string) ?? "";
      const errorMsg = (data?.error as string) ?? (data?.message as string) ?? "Tool call failed";
      return { type: "tool_result", tool_use_id: toolUseId, output: errorMsg, is_error: true };
    }

    case "run.completed": {
      const usage = data?.usage as Record<string, unknown> | undefined;
      const cost = (usage?.costUsd as number) ?? undefined;
      return { type: "result", subtype: "success", cost };
    }

    case "run.failed": {
      const message = (data?.error as string) ?? (data?.message as string) ?? "Run failed";
      return { type: "error", message };
    }

    case "run.cancelled":
    case "run.timed_out": {
      return { type: "result", subtype: "error" };
    }

    case "session.created": {
      const sessionKey = event.sessionKey ?? (data?.key as string) ?? "";
      if (!sessionKey) return null;
      return { type: "sdk_session", sdk_session_id: sessionKey };
    }

    case "approval.requested":
    case "question.requested": {
      const id = (data?.id as string) ?? event.id;
      const questions = (data?.questions as Array<unknown>) ?? [];
      return {
        type: "question",
        id,
        questions: questions.map((q) => {
          const qr = q as Record<string, unknown>;
          return {
            question: (qr.question as string) ?? "",
            header: (qr.header as string) ?? "",
            options: ((qr.options as Array<unknown>) ?? []).map((o) => {
              const or = o as Record<string, unknown>;
              return { label: (or.label as string) ?? "", description: or.description as string | undefined };
            }),
            multiSelect: (qr.multiSelect as boolean) ?? false,
          };
        }),
      };
    }

    case "thinking.delta":
    case "tool.call.delta":
    case "run.created":
    case "run.queued":
    case "run.started":
    case "approval.resolved":
    case "question.answered":
    case "artifact.created":
    case "artifact.updated":
    case "session.updated":
    case "session.compacted":
    case "task.updated":
    case "git.branch":
    case "git.diff":
    case "git.pr":
    case "raw":
      return null;

    default:
      return null;
  }
}
