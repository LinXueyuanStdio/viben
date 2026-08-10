import type { ImageAttachment } from "@/lib/image-utils";
import type { TextAttachment } from "@/lib/text-attachment-utils";

export interface StarterMessageDraft {
  text: string;
  images: ImageAttachment[];
  textAttachments: TextAttachment[];
  modelId: string | null;
}

const drafts = new Map<string, StarterMessageDraft>();

export function putStarterMessage(
  chatId: string,
  draft: StarterMessageDraft,
): void {
  drafts.set(chatId, draft);
}

export function takeStarterMessage(chatId: string): StarterMessageDraft | null {
  const draft = drafts.get(chatId) ?? null;
  drafts.delete(chatId);
  return draft;
}
