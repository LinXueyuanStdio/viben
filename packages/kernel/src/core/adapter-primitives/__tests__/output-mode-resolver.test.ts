// src/core/adapter-primitives/__tests__/output-mode-resolver.test.ts
import { describe, it, expect } from "vitest";
import { OutputModeResolver } from "../output-mode-resolver.js";

function makeConfig(global?: string, adapterMode?: string) {
  return {
    get: () => ({
      outputMode: global,
      channels: { telegram: { outputMode: adapterMode } },
    }),
  } as any;
}

function makeSessionManager(sessionMode?: string) {
  return {
    getSessionRecord: (id: string) => id === "sess1" ? { outputMode: sessionMode } : undefined,
  } as any;
}

describe("OutputModeResolver", () => {
  const resolver = new OutputModeResolver();

  it("returns medium as default when nothing configured", () => {
    expect(resolver.resolve(makeConfig(), "telegram")).toBe("medium");
  });

  it("uses global outputMode when set", () => {
    expect(resolver.resolve(makeConfig("low"), "telegram")).toBe("low");
  });

  it("adapter-level overrides global", () => {
    expect(resolver.resolve(makeConfig("low", "high"), "telegram")).toBe("high");
  });

  it("session-level overrides adapter", () => {
    const result = resolver.resolve(
      makeConfig("low", "medium"),
      "telegram",
      "sess1",
      makeSessionManager("high"),
    );
    expect(result).toBe("high");
  });

  it("skips session override when sessionManager not provided", () => {
    const result = resolver.resolve(
      makeConfig("low", "medium"),
      "telegram",
      "sess1",
      undefined, // no sessionManager
    );
    expect(result).toBe("medium");
  });

  it("skips session override when sessionId not provided", () => {
    const result = resolver.resolve(
      makeConfig("low", "medium"),
      "telegram",
      undefined,
      makeSessionManager("high"),
    );
    expect(result).toBe("medium");
  });

  // Additional flow tests:
  it("flow: all three levels set — session wins", () => {
    const result = resolver.resolve(makeConfig("low", "medium"), "telegram", "sess1", makeSessionManager("high"));
    expect(result).toBe("high");
  });

  it("flow: only session set — falls through to medium default", () => {
    // session set but no sessionId provided → adapter/global both unset → medium
    expect(resolver.resolve(makeConfig(), "telegram", undefined, makeSessionManager("high"))).toBe("medium");
  });

  it("adapter channel not present — falls back to global", () => {
    const config = { get: () => ({ outputMode: "low", channels: {} }) } as any;
    expect(resolver.resolve(config, "telegram")).toBe("low");
  });

  // --- Invalid values at each cascade level ---

  it("ignores invalid global outputMode and falls back to medium", () => {
    expect(resolver.resolve(makeConfig("verbose"), "telegram")).toBe("medium");
  });

  it("ignores invalid adapter outputMode and falls back to global", () => {
    expect(resolver.resolve(makeConfig("low", "verbose"), "telegram")).toBe("low");
  });

  it("ignores invalid session outputMode and falls back to adapter", () => {
    const result = resolver.resolve(
      makeConfig(undefined, "high"),
      "telegram",
      "sess1",
      makeSessionManager("verbose"),
    );
    expect(result).toBe("high");
  });

  it("ignores invalid values at all three levels, returns medium", () => {
    const result = resolver.resolve(
      makeConfig("invalid", "bogus"),
      "telegram",
      "sess1",
      makeSessionManager("nonsense"),
    );
    expect(result).toBe("medium");
  });

  // --- Non-string type rejection ---

  it("ignores numeric global outputMode", () => {
    const config = { get: () => ({ outputMode: 42 }) } as any;
    expect(resolver.resolve(config, "telegram")).toBe("medium");
  });

  it("ignores null global outputMode", () => {
    const config = { get: () => ({ outputMode: null }) } as any;
    expect(resolver.resolve(config, "telegram")).toBe("medium");
  });

  it("ignores empty string global outputMode", () => {
    const config = { get: () => ({ outputMode: "" }) } as any;
    expect(resolver.resolve(config, "telegram")).toBe("medium");
  });

  // --- Session record edge cases ---

  it("falls back to adapter when sessionManager returns undefined for unknown session", () => {
    const result = resolver.resolve(
      makeConfig(undefined, "high"),
      "telegram",
      "unknown",
      makeSessionManager("low"),
    );
    expect(result).toBe("high");
  });

  it("falls back to adapter when session record has no outputMode", () => {
    const sm = { getSessionRecord: () => ({}) } as any;
    const result = resolver.resolve(makeConfig(undefined, "high"), "telegram", "sess1", sm);
    expect(result).toBe("high");
  });

  it("falls back to adapter when session record has null outputMode", () => {
    const sm = { getSessionRecord: () => ({ outputMode: null }) } as any;
    const result = resolver.resolve(makeConfig(undefined, "high"), "telegram", "sess1", sm);
    expect(result).toBe("high");
  });

  // --- Adapter name mismatch ---

  it("falls back to global when resolving for adapter not in channels config", () => {
    expect(resolver.resolve(makeConfig("low", "high"), "discord")).toBe("low");
  });

  it("falls back to medium when resolving for unknown adapter and no global", () => {
    expect(resolver.resolve(makeConfig(undefined, "high"), "discord")).toBe("medium");
  });

  // --- No channels key in config ---

  it("handles config with no channels key", () => {
    const config = { get: () => ({ outputMode: "low" }) } as any;
    expect(resolver.resolve(config, "telegram")).toBe("low");
  });

  it("handles config with channels set to undefined", () => {
    const config = { get: () => ({ outputMode: "low", channels: undefined }) } as any;
    expect(resolver.resolve(config, "telegram")).toBe("low");
  });

  // --- Case sensitivity ---

  it("rejects uppercase mode 'High'", () => {
    expect(resolver.resolve(makeConfig("High"), "telegram")).toBe("medium");
  });

  it("rejects uppercase mode 'LOW'", () => {
    expect(resolver.resolve(makeConfig("LOW"), "telegram")).toBe("medium");
  });

  // --- All 3 valid modes at each level ---

  it("global outputMode 'high' is respected", () => {
    expect(resolver.resolve(makeConfig("high"), "telegram")).toBe("high");
  });

  it("adapter outputMode 'low' overrides global 'high'", () => {
    expect(resolver.resolve(makeConfig("high", "low"), "telegram")).toBe("low");
  });

  it("session outputMode 'medium' overrides adapter 'high'", () => {
    const result = resolver.resolve(
      makeConfig(undefined, "high"),
      "telegram",
      "sess1",
      makeSessionManager("medium"),
    );
    expect(result).toBe("medium");
  });

  // --- Backward compat ---

  it("ignores legacy displayVerbosity at global level", () => {
    const config = { get: () => ({ displayVerbosity: "high" }) } as any;
    expect(resolver.resolve(config, "telegram")).toBe("medium");
  });
});
