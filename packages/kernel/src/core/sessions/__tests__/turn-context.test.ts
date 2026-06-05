import { describe, it, expect } from "vitest";
import { isSystemEvent, createTurnContext, getEffectiveTarget } from "../turn-context.js";

describe("TurnContext", () => {
  describe("createTurnContext", () => {
    it("creates context with unique turnId", () => {
      const ctx = createTurnContext("telegram");
      expect(ctx.turnId).toBeTruthy();
      expect(ctx.sourceAdapterId).toBe("telegram");
      expect(ctx.responseAdapterId).toBeUndefined();
    });

    it("accepts explicit responseAdapterId", () => {
      const ctx = createTurnContext("system", "discord");
      expect(ctx.sourceAdapterId).toBe("system");
      expect(ctx.responseAdapterId).toBe("discord");
    });

    it("accepts null responseAdapterId for silent prompts", () => {
      const ctx = createTurnContext("system", null);
      expect(ctx.responseAdapterId).toBeNull();
    });
  });

  describe("isSystemEvent", () => {
    it("classifies session_end as system event", () => {
      expect(isSystemEvent({ type: "session_end", reason: "done" })).toBe(true);
    });

    it("classifies system_message as system event", () => {
      expect(isSystemEvent({ type: "system_message", message: "hi" })).toBe(true);
    });

    it("classifies config_option_update as system event", () => {
      expect(isSystemEvent({ type: "config_option_update", options: [] })).toBe(true);
    });

    it("classifies session_info_update as system event", () => {
      expect(isSystemEvent({ type: "session_info_update", title: "test" })).toBe(true);
    });

    it("classifies commands_update as system event", () => {
      expect(isSystemEvent({ type: "commands_update", commands: [] })).toBe(true);
    });

    it("classifies text as turn event (not system)", () => {
      expect(isSystemEvent({ type: "text", content: "hi" })).toBe(false);
    });

    it("classifies thought as turn event", () => {
      expect(isSystemEvent({ type: "thought", content: "thinking" })).toBe(false);
    });

    it("classifies tool_call as turn event", () => {
      expect(isSystemEvent({ type: "tool_call", id: "1", name: "read", status: "done" })).toBe(false);
    });

    it("classifies tool_update as turn event", () => {
      expect(isSystemEvent({ type: "tool_update", id: "1", status: "done" })).toBe(false);
    });

    it("classifies usage as turn event", () => {
      expect(isSystemEvent({ type: "usage" })).toBe(false);
    });

    it("classifies plan as turn event", () => {
      expect(isSystemEvent({ type: "plan", entries: [] })).toBe(false);
    });

    it("classifies error as turn event", () => {
      expect(isSystemEvent({ type: "error", message: "fail" })).toBe(false);
    });

    it("classifies image_content as turn event", () => {
      expect(isSystemEvent({ type: "image_content", data: "", mimeType: "image/png" })).toBe(false);
    });

    it("classifies audio_content as turn event", () => {
      expect(isSystemEvent({ type: "audio_content", data: "", mimeType: "audio/mp3" })).toBe(false);
    });
  });

  describe("getEffectiveTarget", () => {
    it("returns null for silent prompts (responseAdapterId=null)", () => {
      const ctx = createTurnContext("telegram", null);
      expect(getEffectiveTarget(ctx)).toBeNull();
    });

    it("falls back to sourceAdapterId when responseAdapterId is undefined", () => {
      const ctx = createTurnContext("telegram");
      expect(getEffectiveTarget(ctx)).toBe("telegram");
    });

    it("returns explicit responseAdapterId when set", () => {
      const ctx = createTurnContext("system", "discord");
      expect(getEffectiveTarget(ctx)).toBe("discord");
    });
  });
});
