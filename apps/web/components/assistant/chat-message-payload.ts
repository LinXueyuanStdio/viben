import type { FileUIPart } from "ai";
import type { WebAgentUIMessage } from "@/app/types";
import type { TextAttachment } from "@/lib/text-attachment-utils";

interface BuildChatMessagePayloadInput {
  text: string;
  files: FileUIPart[];
  textAttachments: TextAttachment[];
}

export type ChatMessagePayload =
  | { text: string; files: FileUIPart[] | undefined }
  | { parts: WebAgentUIMessage["parts"] };

export function buildChatMessagePayload({
  text,
  files,
  textAttachments,
}: BuildChatMessagePayloadInput): ChatMessagePayload {
  if (textAttachments.length === 0) {
    return {
      text,
      files: files.length > 0 ? files : undefined,
    };
  }

  const parts: WebAgentUIMessage["parts"] = [];
  if (text.trim()) {
    parts.push({ type: "text", text });
  }
  parts.push(...files);
  for (const attachment of textAttachments) {
    parts.push({
      type: "data-snippet",
      id: attachment.id,
      data: {
        content: attachment.content,
        filename: attachment.filename,
      },
    });
  }

  return { parts };
}
