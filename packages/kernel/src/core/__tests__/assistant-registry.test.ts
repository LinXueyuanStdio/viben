import { describe, it, expect } from "vitest";
import { AssistantRegistry, type AssistantSection } from "../assistant/assistant-registry.js";

function makeSection(overrides: Partial<AssistantSection> = {}): AssistantSection {
  return {
    id: "test:section",
    title: "Test Section",
    priority: 100,
    buildContext: () => "test context",
    ...overrides,
  };
}

describe("AssistantRegistry", () => {
  it("builds system prompt with sections sorted by priority", () => {
    const reg = new AssistantRegistry();
    reg.register(makeSection({ id: "b", title: "B", priority: 20, buildContext: () => "B content" }));
    reg.register(makeSection({ id: "a", title: "A", priority: 10, buildContext: () => "A content" }));
    const prompt = reg.buildSystemPrompt();
    const aIdx = prompt.indexOf("## A");
    const bIdx = prompt.indexOf("## B");
    expect(aIdx).toBeLessThan(bIdx);
  });

  it("skips sections that return null", () => {
    const reg = new AssistantRegistry();
    reg.register(makeSection({ id: "show", title: "Shown", buildContext: () => "visible" }));
    reg.register(makeSection({ id: "skip", title: "Skipped", buildContext: () => null }));
    const prompt = reg.buildSystemPrompt();
    expect(prompt).toContain("## Shown");
    expect(prompt).not.toContain("## Skipped");
  });

  it("catches buildContext errors and skips section", () => {
    const reg = new AssistantRegistry();
    reg.register(makeSection({
      id: "broken",
      title: "Broken",
      buildContext: () => { throw new Error("boom"); },
    }));
    reg.register(makeSection({ id: "ok", title: "OK", buildContext: () => "fine" }));
    const prompt = reg.buildSystemPrompt();
    expect(prompt).not.toContain("## Broken");
    expect(prompt).toContain("## OK");
  });

  it("includes command blocks when commands provided", () => {
    const reg = new AssistantRegistry();
    reg.register(makeSection({
      id: "cmds",
      title: "With Commands",
      buildContext: () => "context",
      commands: [{ command: "viben api status", description: "Show status" }],
    }));
    const prompt = reg.buildSystemPrompt();
    expect(prompt).toContain("viben api status");
    expect(prompt).toContain("Show status");
  });

  it("unregisters sections", () => {
    const reg = new AssistantRegistry();
    reg.register(makeSection({ id: "gone", title: "Gone" }));
    reg.unregister("gone");
    const prompt = reg.buildSystemPrompt();
    expect(prompt).not.toContain("## Gone");
  });

  it("includes preamble and guidelines", () => {
    const reg = new AssistantRegistry();
    const prompt = reg.buildSystemPrompt();
    expect(prompt).toContain("You are the Viben Assistant");
    expect(prompt).toContain("NEVER show");
  });
});
