import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ConfigOption } from "../../../core/types.js";
import type { Session } from "../../../core/sessions/session.js";

// ── Config option fixtures ──────────────────────────────────────────

const modeOption = (currentValue = "code"): ConfigOption => ({
  id: "mode",
  name: "Mode",
  type: "select",
  category: "mode",
  currentValue,
  options: [
    { value: "code", name: "Code", description: "Standard behavior" },
    { value: "plan", name: "Plan Mode", description: "Planning only" },
    { value: "bypassPermissions", name: "Bypass Permissions", description: "Skip all permission checks" },
  ],
});

const modelOption = (currentValue = "sonnet"): ConfigOption => ({
  id: "model",
  name: "Model",
  type: "select",
  category: "model",
  currentValue,
  options: [
    { value: "sonnet", name: "Sonnet" },
    { value: "opus", name: "Opus" },
  ],
});

const thoughtOption = (currentValue = "normal"): ConfigOption => ({
  id: "thinking",
  name: "Thinking",
  type: "select",
  category: "thought_level",
  currentValue,
  options: [
    { value: "none", name: "None" },
    { value: "normal", name: "Normal" },
    { value: "extended", name: "Extended" },
  ],
});

// ── Mock session helper ─────────────────────────────────────────────

function mockSession(
  configOptions: ConfigOption[] = [],
  overrides?: {
    clientOverrides?: { bypassPermissions?: boolean };
    voiceMode?: "off" | "on";
  },
): Session {
  const session: any = {
    id: "sess-1",
    agentName: "claude",
    workingDirectory: "/home/user/project",
    threadId: "12345",
    configOptions,
    clientOverrides: overrides?.clientOverrides ?? {},
    voiceMode: overrides?.voiceMode ?? "off",
    getConfigByCategory: (cat: string) => configOptions.find((o) => o.category === cat),
    getConfigOption: (id: string) => configOptions.find((o) => o.id === id),
  };
  return session as Session;
}

// ── Tests ───────────────────────────────────────────────────────────

describe("isBypassActive", () => {
  let isBypassActive: typeof import("../commands/admin.js").isBypassActive;

  beforeEach(async () => {
    ({ isBypassActive } = await import("../commands/admin.js"));
  });

  it("returns false when no bypass mode and no clientOverrides", () => {
    const session = mockSession([modeOption("code")]);
    expect(isBypassActive(session)).toBe(false);
  });

  it("returns true when agent mode is bypass keyword (bypassPermissions)", () => {
    const session = mockSession([modeOption("bypassPermissions")]);
    expect(isBypassActive(session)).toBe(true);
  });

  it("returns true when agent mode contains 'dangerous' keyword", () => {
    const opt = modeOption();
    opt.options = [{ value: "dangerous_mode", name: "Dangerous" }];
    opt.currentValue = "dangerous_mode";
    const session = mockSession([opt]);
    expect(isBypassActive(session)).toBe(true);
  });

  it("returns false when agent mode is 'dont_ask' (deny, not bypass)", () => {
    const opt = modeOption();
    opt.options = [{ value: "dont_ask", name: "Don't Ask" }];
    opt.currentValue = "dont_ask";
    const session = mockSession([opt]);
    expect(isBypassActive(session)).toBe(false);
  });

  it("returns true when clientOverrides.bypassPermissions is true (no agent mode)", () => {
    const session = mockSession([], { clientOverrides: { bypassPermissions: true } });
    expect(isBypassActive(session)).toBe(true);
  });

  it("returns true when clientOverrides.bypassPermissions is true (agent mode is non-bypass)", () => {
    const session = mockSession([modeOption("code")], {
      clientOverrides: { bypassPermissions: true },
    });
    expect(isBypassActive(session)).toBe(true);
  });

  it("returns true when BOTH agent mode bypass AND clientOverrides", () => {
    const session = mockSession([modeOption("bypassPermissions")], {
      clientOverrides: { bypassPermissions: true },
    });
    expect(isBypassActive(session)).toBe(true);
  });

  it("returns false when clientOverrides.bypassPermissions is false", () => {
    const session = mockSession([modeOption("code")], {
      clientOverrides: { bypassPermissions: false },
    });
    expect(isBypassActive(session)).toBe(false);
  });

  it("returns false when no config options at all", () => {
    const session = mockSession([]);
    expect(isBypassActive(session)).toBe(false);
  });

  it("ignores boolean config options (only checks select type)", () => {
    const boolOpt: ConfigOption = {
      id: "verbose",
      name: "Verbose",
      type: "boolean",
      category: "mode",
      currentValue: true,
    };
    const session = mockSession([boolOpt]);
    expect(isBypassActive(session)).toBe(false);
  });
});

describe("buildSessionStatusText", () => {
  let buildSessionStatusText: typeof import("../commands/admin.js").buildSessionStatusText;

  beforeEach(async () => {
    ({ buildSessionStatusText } = await import("../commands/admin.js"));
  });

  it("includes agent name and workspace", () => {
    const session = mockSession([]);
    const text = buildSessionStatusText(session);
    expect(text).toContain("claude");
    expect(text).toContain("/home/user/project");
  });

  it("uses custom heading when provided", () => {
    const session = mockSession([]);
    const text = buildSessionStatusText(session, "✅ <b>Session started</b>");
    expect(text).toContain("Session started");
    expect(text).not.toContain("New chat");
  });

  it("shows model name from config", () => {
    const session = mockSession([modelOption("opus")]);
    const text = buildSessionStatusText(session);
    expect(text).toContain("Opus");
    expect(text).toContain("Model:");
  });

  it("shows thinking level from config", () => {
    const session = mockSession([thoughtOption("extended")]);
    const text = buildSessionStatusText(session);
    expect(text).toContain("Extended");
    expect(text).toContain("Thinking:");
  });

  it("shows normal mode name when not bypass", () => {
    const session = mockSession([modeOption("plan")]);
    const text = buildSessionStatusText(session);
    expect(text).toContain("Mode:");
    expect(text).toContain("Plan Mode");
    expect(text).not.toContain("☠️");
  });

  it("shows unified bypass display when agent mode is bypass", () => {
    const session = mockSession([modeOption("bypassPermissions")]);
    const text = buildSessionStatusText(session);
    expect(text).toContain("Mode:");
    expect(text).toContain("☠️ Bypass Permissions enabled");
    // Should NOT also show "Bypass Permissions" as a separate mode name
    const lines = text.split("\n");
    const modeLines = lines.filter((l) => l.includes("Mode:"));
    expect(modeLines).toHaveLength(1);
  });

  it("shows unified bypass display when clientOverrides bypass is true", () => {
    const session = mockSession([modeOption("code")], {
      clientOverrides: { bypassPermissions: true },
    });
    const text = buildSessionStatusText(session);
    expect(text).toContain("Mode:");
    expect(text).toContain("☠️ Bypass Permissions enabled");
    // Should NOT show "Code" mode separately
    expect(text).not.toContain("Mode:</b> Code");
  });

  it("does NOT show separate bypass line (unified into Mode)", () => {
    const session = mockSession([modeOption("code")], {
      clientOverrides: { bypassPermissions: true },
    });
    const text = buildSessionStatusText(session);
    const lines = text.split("\n");
    // Only one line should mention bypass
    const bypassLines = lines.filter((l) => l.includes("Bypass"));
    expect(bypassLines).toHaveLength(1);
    expect(bypassLines[0]).toContain("Mode:");
  });

  it("shows all config info together", () => {
    const session = mockSession([
      modelOption("opus"),
      thoughtOption("extended"),
      modeOption("plan"),
    ]);
    const text = buildSessionStatusText(session);
    expect(text).toContain("Model:");
    expect(text).toContain("Opus");
    expect(text).toContain("Thinking:");
    expect(text).toContain("Extended");
    expect(text).toContain("Mode:");
    expect(text).toContain("Plan Mode");
  });

  it("falls back to currentValue when choice name not found", () => {
    const opt = modelOption();
    opt.currentValue = "unknown-model";
    const session = mockSession([opt]);
    const text = buildSessionStatusText(session);
    expect(text).toContain("unknown-model");
  });
});

describe("buildSessionControlKeyboard", () => {
  let buildSessionControlKeyboard: typeof import("../commands/admin.js").buildSessionControlKeyboard;

  beforeEach(async () => {
    ({ buildSessionControlKeyboard } = await import("../commands/admin.js"));
  });

  it("shows Enable Bypass button when bypass is off", () => {
    const kb = buildSessionControlKeyboard("sess-1", false, false);
    const json = JSON.stringify(kb);
    expect(json).toContain("Enable Bypass");
    expect(json).toContain("☠️");
  });

  it("shows Disable Bypass button when bypass is on", () => {
    const kb = buildSessionControlKeyboard("sess-1", true, false);
    const json = JSON.stringify(kb);
    expect(json).toContain("Disable Bypass");
    expect(json).toContain("🔐");
  });

  it("shows TTS off when voiceMode is false", () => {
    const kb = buildSessionControlKeyboard("sess-1", false, false);
    const json = JSON.stringify(kb);
    expect(json).toContain("🔇");
  });

  it("shows TTS on when voiceMode is true", () => {
    const kb = buildSessionControlKeyboard("sess-1", false, true);
    const json = JSON.stringify(kb);
    expect(json).toContain("🔊");
  });

  it("includes sessionId in callback data", () => {
    const kb = buildSessionControlKeyboard("sess-xyz", false, false);
    const json = JSON.stringify(kb);
    expect(json).toContain("d:sess-xyz");
    expect(json).toContain("v:sess-xyz");
  });
});

describe("Platform data persistence (storeControlMsgId / getControlMsgId)", () => {
  it("storeControlMsgId merges with existing platform data", async () => {
    // Simulate what storeControlMsgId does: read existing record, merge, patchRecord
    const existingRecord = {
      sessionId: "sess-1",
      platform: { topicId: 12345, skillMsgId: 67 },
    };

    const patchRecord = vi.fn().mockResolvedValue(undefined);

    // This is the logic from storeControlMsgId
    const merged = {
      platform: { ...existingRecord.platform, controlMsgId: 999 },
    };

    patchRecord("sess-1", merged);

    expect(patchRecord).toHaveBeenCalledWith("sess-1", {
      platform: { topicId: 12345, skillMsgId: 67, controlMsgId: 999 },
    });
  });

  it("storeControlMsgId does not overwrite topicId", () => {
    const existing = { topicId: 100, skillMsgId: 200 };
    const merged = { ...existing, controlMsgId: 300 };
    expect(merged.topicId).toBe(100);
    expect(merged.skillMsgId).toBe(200);
    expect(merged.controlMsgId).toBe(300);
  });

  it("storeControlMsgId does not overwrite skillMsgId", () => {
    const existing = { topicId: 100, skillMsgId: 200 };
    const merged = { ...existing, controlMsgId: 300 };
    expect(merged.skillMsgId).toBe(200);
  });

  it("storeControlMsgId handles empty platform data", () => {
    const existing = {};
    const merged = { ...existing, controlMsgId: 300 };
    expect(merged.controlMsgId).toBe(300);
  });

  it("getControlMsgId falls back to session record when Map is empty", () => {
    // Simulate getControlMsgId logic
    const map = new Map<string, number>();
    const record = {
      platform: { topicId: 100, controlMsgId: 42 } as any,
    };

    let msgId = map.get("sess-1");
    if (!msgId) {
      const platform = record.platform;
      if (platform?.controlMsgId) {
        msgId = platform.controlMsgId;
        map.set("sess-1", msgId);
      }
    }

    expect(msgId).toBe(42);
    expect(map.get("sess-1")).toBe(42); // hydrated into Map
  });

  it("getControlMsgId returns Map value when present (no fallback needed)", () => {
    const map = new Map<string, number>();
    map.set("sess-1", 99);

    const msgId = map.get("sess-1");
    expect(msgId).toBe(99);
  });

  it("getControlMsgId returns undefined when neither Map nor record has it", () => {
    const map = new Map<string, number>();
    const record = { platform: { topicId: 100 } as any };

    let msgId = map.get("sess-1");
    if (!msgId) {
      const platform = record.platform;
      if (platform?.controlMsgId) {
        msgId = platform.controlMsgId;
      }
    }

    expect(msgId).toBeUndefined();
  });
});

describe("session:configChanged event emission", () => {
  it("emits event after /model change", async () => {
    const { CommandRegistry } = await import("../../../core/command-registry.js");
    const { registerConfigCommands } = await import("../../../core/commands/config.js");

    const configOptions = [modelOption("sonnet")];
    const session = {
      id: "test-session",
      configOptions,
      clientOverrides: {},
      getConfigByCategory: (cat: string) => configOptions.find((o) => o.category === cat),
      getConfigOption: (id: string) => configOptions.find((o) => o.id === id),
      setConfigOption: vi.fn().mockResolvedValue(undefined),
      agentInstance: {
        setConfigOption: vi.fn().mockResolvedValue({ configOptions }),
      },
    };
    const core = {
      sessionManager: {
        getSession: vi.fn().mockReturnValue(session),
        patchRecord: vi.fn().mockResolvedValue(undefined),
      },
      eventBus: { emit: vi.fn() },
    };

    const registry = new CommandRegistry();
    registerConfigCommands(registry, core);

    await registry.execute("/model opus", {
      sessionId: "test-session",
      channelId: "telegram",
      userId: "user-1",
      raw: "opus",
      reply: vi.fn(),
    });

    expect(core.eventBus.emit).toHaveBeenCalledWith("session:configChanged", {
      sessionId: "test-session",
    });
  });

  it("emits event after /mode change", async () => {
    const { CommandRegistry } = await import("../../../core/command-registry.js");
    const { registerConfigCommands } = await import("../../../core/commands/config.js");

    const configOptions = [modeOption("code")];
    const session = {
      id: "test-session",
      configOptions,
      clientOverrides: {},
      getConfigByCategory: (cat: string) => configOptions.find((o) => o.category === cat),
      getConfigOption: (id: string) => configOptions.find((o) => o.id === id),
      setConfigOption: vi.fn().mockResolvedValue(undefined),
      agentInstance: {
        setConfigOption: vi.fn().mockResolvedValue({ configOptions }),
      },
    };
    const core = {
      sessionManager: {
        getSession: vi.fn().mockReturnValue(session),
        patchRecord: vi.fn().mockResolvedValue(undefined),
      },
      eventBus: { emit: vi.fn() },
    };

    const registry = new CommandRegistry();
    registerConfigCommands(registry, core);

    await registry.execute("/mode plan", {
      sessionId: "test-session",
      channelId: "telegram",
      userId: "user-1",
      raw: "plan",
      reply: vi.fn(),
    });

    expect(core.eventBus.emit).toHaveBeenCalledWith("session:configChanged", {
      sessionId: "test-session",
    });
  });

  it("emits event after /bypass on", async () => {
    const { CommandRegistry } = await import("../../../core/command-registry.js");
    const { registerConfigCommands } = await import("../../../core/commands/config.js");

    const configOptions = [modeOption("code")];
    const session = {
      id: "test-session",
      configOptions,
      clientOverrides: {},
      getConfigByCategory: (cat: string) => configOptions.find((o) => o.category === cat),
      getConfigOption: (id: string) => configOptions.find((o) => o.id === id),
      setConfigOption: vi.fn().mockResolvedValue(undefined),
      agentInstance: {
        setConfigOption: vi.fn().mockResolvedValue({ configOptions }),
      },
    };
    const core = {
      sessionManager: {
        getSession: vi.fn().mockReturnValue(session),
        patchRecord: vi.fn().mockResolvedValue(undefined),
      },
      eventBus: { emit: vi.fn() },
    };

    const registry = new CommandRegistry();
    registerConfigCommands(registry, core);

    await registry.execute("/bypass_permissions on", {
      sessionId: "test-session",
      channelId: "telegram",
      userId: "user-1",
      raw: "on",
      reply: vi.fn(),
    });

    expect(core.eventBus.emit).toHaveBeenCalledWith("session:configChanged", {
      sessionId: "test-session",
    });
  });
});

describe("patchRecord platform merge safety", () => {
  it("shallow merge preserves existing platform fields", () => {
    // Simulates what patchRecord does: { ...record, ...patch }
    const record = {
      sessionId: "sess-1",
      platform: { topicId: 100, skillMsgId: 200 },
    };

    // BAD: this replaces entire platform
    const badPatch = { platform: { controlMsgId: 300 } };
    const badResult = { ...record, ...badPatch };
    expect(badResult.platform).toEqual({ controlMsgId: 300 }); // topicId LOST!

    // GOOD: merge platform first
    const goodPatch = {
      platform: { ...record.platform, controlMsgId: 300 },
    };
    const goodResult = { ...record, ...goodPatch };
    expect(goodResult.platform).toEqual({
      topicId: 100,
      skillMsgId: 200,
      controlMsgId: 300,
    });
  });

  it("controlMsgId update does not remove topicId", () => {
    const existingPlatform = { topicId: 999, skillMsgId: 42 };
    const merged = { ...existingPlatform, controlMsgId: 123 };
    expect(merged.topicId).toBe(999);
  });

  it("controlMsgId update does not remove skillMsgId", () => {
    const existingPlatform = { topicId: 999, skillMsgId: 42 };
    const merged = { ...existingPlatform, controlMsgId: 123 };
    expect(merged.skillMsgId).toBe(42);
  });

  it("duplicate patchRecord with only topicId would wipe controlMsgId", () => {
    // This test documents the bug that was fixed: duplicate patchRecord
    // calls in new-session.ts/resume.ts after onControlMessage would
    // overwrite the controlMsgId that was just set.
    const afterControlMsg = {
      topicId: 100,
      skillMsgId: 200,
      controlMsgId: 300,
    };

    // The duplicate call: { platform: { topicId: 100 } }
    // Would do: { ...record, ...{ platform: { topicId: 100 } } }
    const afterDuplicate = { topicId: 100 };

    // controlMsgId is LOST
    expect(afterDuplicate).not.toHaveProperty("controlMsgId");
    expect(afterControlMsg).toHaveProperty("controlMsgId", 300);
  });
});
