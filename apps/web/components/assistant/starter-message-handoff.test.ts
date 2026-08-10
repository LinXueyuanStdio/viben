import { describe, expect, test } from "vitest";
import {
  putStarterMessage,
  takeStarterMessage,
  type StarterMessageDraft,
} from "./starter-message-handoff";

const draft: StarterMessageDraft = {
  text: "Build the dashboard",
  images: [],
  textAttachments: [],
  modelId: "openai/gpt-5",
};

describe("starter message handoff", () => {
  test("returns a draft exactly once for its chat", () => {
    putStarterMessage("handoff-once", draft);

    expect(takeStarterMessage("handoff-once")).toEqual(draft);
    expect(takeStarterMessage("handoff-once")).toBeNull();
  });

  test("keeps drafts isolated by chat id", () => {
    putStarterMessage("handoff-isolated", draft);

    expect(takeStarterMessage("different-chat")).toBeNull();
    expect(takeStarterMessage("handoff-isolated")).toEqual(draft);
  });

  test("replaces a stale draft when the same chat is queued again", () => {
    putStarterMessage("handoff-replaced", draft);
    putStarterMessage("handoff-replaced", {
      ...draft,
      text: "Use the latest prompt",
    });

    expect(takeStarterMessage("handoff-replaced")?.text).toBe(
      "Use the latest prompt",
    );
  });
});
