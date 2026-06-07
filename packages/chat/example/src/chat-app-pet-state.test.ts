import { describe, expect, test } from "vitest";
import type { AgentMessage } from "@viben/chat";
import { getAssistantPetState, getPetInteractionForSessionStatus } from "./chat-app-pet-state";

const messages: AgentMessage[] = [
  { id: "u1", type: "user", content: "Build the overlay" },
  { id: "a1", type: "text", content: "I am preparing the popup." },
];

describe("getAssistantPetState", () => {
  test("maps playback and messages to pet animation states", () => {
    expect(getAssistantPetState([], false, "idle")).toBe("idle");
    expect(getAssistantPetState(messages, true, "playing")).toBe("review");
    expect(getAssistantPetState(messages, false, "playing")).toBe("waiting");
    expect(getAssistantPetState(messages, false, "paused")).toBe("waving");
    expect(getAssistantPetState(messages, false, "idle")).toBe("idle");
  });

  test("does not stay failed after later successful activity", () => {
    expect(getAssistantPetState([
      { id: "error-1", type: "error", message: "API error" },
      { id: "text-1", type: "text", content: "Recovered and continuing." },
    ], false, "idle")).toBe("idle");
    expect(getAssistantPetState([
      { id: "text-1", type: "text", content: "Working." },
      { id: "error-1", type: "error", message: "API error" },
    ], false, "idle")).toBe("failed");
  });
});

describe("getPetInteractionForSessionStatus", () => {
  test("maps session playback status to pet interaction states", () => {
    expect(getPetInteractionForSessionStatus("idle", false, false)).toBe("idle");
    expect(getPetInteractionForSessionStatus("playing", false, false)).toBe("waiting");
    expect(getPetInteractionForSessionStatus("playing", true, false)).toBe("waiting");
    expect(getPetInteractionForSessionStatus("paused", false, false)).toBe("hover");
    expect(getPetInteractionForSessionStatus("idle", false, true)).toBe("waiting");
  });
});
