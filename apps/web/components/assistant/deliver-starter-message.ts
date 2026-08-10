import type { StarterMessageDraft } from "./starter-message-handoff";

interface DeliverStarterMessageOptions {
  draft: StarterMessageDraft;
  currentModelId: string | null;
  updateModel: (modelId: string) => Promise<unknown>;
  sendDraft: (draft: StarterMessageDraft) => Promise<unknown>;
  restoreDraft: (draft: StarterMessageDraft) => void;
}

export async function deliverStarterMessage({
  draft,
  currentModelId,
  updateModel,
  sendDraft,
  restoreDraft,
}: DeliverStarterMessageOptions): Promise<boolean> {
  try {
    if (draft.modelId && draft.modelId !== currentModelId) {
      await updateModel(draft.modelId);
    }
    await sendDraft(draft);
    return true;
  } catch {
    restoreDraft(draft);
    return false;
  }
}
