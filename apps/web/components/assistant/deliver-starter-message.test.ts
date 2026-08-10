import { describe, expect, test, vi } from "vitest";
import type { StarterMessageDraft } from "./starter-message-handoff";
import { deliverStarterMessage } from "./deliver-starter-message";

const draft: StarterMessageDraft = {
  text: "Build it",
  images: [],
  textAttachments: [],
  modelId: "openai/gpt-5",
};

describe("deliverStarterMessage", () => {
  test("updates the model before sending the queued draft", async () => {
    const events: string[] = [];
    const delivered = await deliverStarterMessage({
      draft,
      currentModelId: "anthropic/claude",
      updateModel: vi.fn(async () => {
        events.push("model");
      }),
      sendDraft: vi.fn(async () => {
        events.push("send");
      }),
      restoreDraft: vi.fn(),
    });

    expect(delivered).toBe(true);
    expect(events).toEqual(["model", "send"]);
  });

  test("restores the complete draft when delivery fails", async () => {
    const restoreDraft = vi.fn();
    const delivered = await deliverStarterMessage({
      draft,
      currentModelId: "openai/gpt-5",
      updateModel: vi.fn(),
      sendDraft: vi.fn().mockRejectedValue(new Error("send failed")),
      restoreDraft,
    });

    expect(delivered).toBe(false);
    expect(restoreDraft).toHaveBeenCalledWith(draft);
  });
});
