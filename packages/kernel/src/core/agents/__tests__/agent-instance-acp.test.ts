import { describe, it, expect, vi } from "vitest";
import type { AgentEvent, ConfigOption } from "../../types.js";

/**
 * Tests for new ACP session update event types and method signatures.
 *
 * AgentInstance spawns a real subprocess, so we can't easily unit-test it in isolation.
 * Instead, we verify that the AgentEvent type union correctly supports the new event shapes,
 * and that the new methods exist on the class prototype.
 */

describe("AgentInstance ACP session update event shapes", () => {
  it("session_info_update event has correct shape", () => {
    const event: AgentEvent = {
      type: "session_info_update",
      title: "My Session",
      updatedAt: "2026-03-26T00:00:00Z",
    };
    expect(event.type).toBe("session_info_update");
    if (event.type === "session_info_update") {
      expect(event.title).toBe("My Session");
      expect(event.updatedAt).toBe("2026-03-26T00:00:00Z");
    }
  });

  it("session_info_update event with _meta", () => {
    const event: AgentEvent = {
      type: "session_info_update",
      title: "Updated",
      _meta: { foo: "bar" },
    };
    if (event.type === "session_info_update") {
      expect(event._meta).toEqual({ foo: "bar" });
    }
  });

  it("current_mode_update event has correct shape", () => {
    const event: AgentEvent = {
      type: "current_mode_update",
      modeId: "architect",
    };
    expect(event.type).toBe("current_mode_update");
    if (event.type === "current_mode_update") {
      expect(event.modeId).toBe("architect");
    }
  });

  it("config_option_update event has correct shape", () => {
    const options: ConfigOption[] = [
      {
        id: "model",
        name: "Model",
        type: "select" as const,
        currentValue: "claude-sonnet",
        options: [{ value: "claude-sonnet", label: "Sonnet" }],
      },
    ];
    const event: AgentEvent = {
      type: "config_option_update",
      options,
    };
    expect(event.type).toBe("config_option_update");
    if (event.type === "config_option_update") {
      expect(event.options).toHaveLength(1);
      expect(event.options[0].type).toBe("select");
    }
  });

  it("config_option_update event with boolean option", () => {
    const options: ConfigOption[] = [
      {
        id: "verbose",
        name: "Verbose",
        type: "boolean" as const,
        currentValue: true,
      },
    ];
    const event: AgentEvent = {
      type: "config_option_update",
      options,
    };
    if (event.type === "config_option_update") {
      expect(event.options[0].type).toBe("boolean");
      if (event.options[0].type === "boolean") {
        expect(event.options[0].currentValue).toBe(true);
      }
    }
  });

  it("user_message_chunk event has correct shape", () => {
    const event: AgentEvent = {
      type: "user_message_chunk",
      content: "Hello from replay",
    };
    expect(event.type).toBe("user_message_chunk");
    if (event.type === "user_message_chunk") {
      expect(event.content).toBe("Hello from replay");
    }
  });

  it("model_update event has correct shape", () => {
    const event: AgentEvent = {
      type: "model_update",
      modelId: "claude-opus",
    };
    expect(event.type).toBe("model_update");
    if (event.type === "model_update") {
      expect(event.modelId).toBe("claude-opus");
    }
  });
});

describe("AgentInstance tool event rawOutput field", () => {
  it("tool_call event supports rawOutput", () => {
    const event: AgentEvent = {
      type: "tool_call",
      id: "tc-1",
      name: "read_file",
      status: "completed",
      rawOutput: { content: "file data" },
    };
    if (event.type === "tool_call") {
      expect(event.rawOutput).toEqual({ content: "file data" });
    }
  });

  it("tool_update event supports rawOutput", () => {
    const event: AgentEvent = {
      type: "tool_update",
      id: "tc-1",
      status: "completed",
      rawOutput: "output text",
    };
    if (event.type === "tool_update") {
      expect(event.rawOutput).toEqual("output text");
    }
  });
});

describe("AgentInstance setConfigOption legacy fallback", () => {
  it("falls back to setSessionMode when setSessionConfigOption returns -32601 for mode", async () => {
    const { AgentInstance } = await import("../agent-instance.js");
    const instance = Object.create(AgentInstance.prototype) as InstanceType<typeof AgentInstance>;

    const setSessionMode = vi.fn().mockResolvedValue({});
    const setSessionConfigOption = vi.fn().mockRejectedValue(
      Object.assign(new Error('"Method not found": session/set_config_option'), { code: -32601 })
    );
    (instance as any).sessionId = "sess-1";
    (instance as any).connection = { setSessionConfigOption, setSessionMode, unstable_setSessionModel: vi.fn() };

    const result = await instance.setConfigOption("mode", { type: "select", value: "architect" });

    expect(setSessionMode).toHaveBeenCalledWith({ sessionId: "sess-1", modeId: "architect" });
    expect(result).toEqual({ configOptions: [] });
  });

  it("falls back to unstable_setSessionModel when setSessionConfigOption returns -32601 for model", async () => {
    const { AgentInstance } = await import("../agent-instance.js");
    const instance = Object.create(AgentInstance.prototype) as InstanceType<typeof AgentInstance>;

    const unstable_setSessionModel = vi.fn().mockResolvedValue({});
    const setSessionConfigOption = vi.fn().mockRejectedValue(
      Object.assign(new Error('"Method not found": session/set_config_option'), { code: -32601 })
    );
    (instance as any).sessionId = "sess-1";
    (instance as any).connection = { setSessionConfigOption, setSessionMode: vi.fn(), unstable_setSessionModel };

    const result = await instance.setConfigOption("model", { type: "select", value: "gemini-2.5-pro" });

    expect(unstable_setSessionModel).toHaveBeenCalledWith({ sessionId: "sess-1", modelId: "gemini-2.5-pro" });
    expect(result).toEqual({ configOptions: [] });
  });

  it("rethrows -32601 when configId is not mode or model", async () => {
    const { AgentInstance } = await import("../agent-instance.js");
    const instance = Object.create(AgentInstance.prototype) as InstanceType<typeof AgentInstance>;

    const err = Object.assign(new Error('"Method not found": session/set_config_option'), { code: -32601 });
    (instance as any).sessionId = "sess-1";
    (instance as any).connection = { setSessionConfigOption: vi.fn().mockRejectedValue(err) };

    await expect(
      instance.setConfigOption("thought_level", { type: "select", value: "high" })
    ).rejects.toThrow(err);
  });

  it("rethrows non-32601 errors without fallback", async () => {
    const { AgentInstance } = await import("../agent-instance.js");
    const instance = Object.create(AgentInstance.prototype) as InstanceType<typeof AgentInstance>;

    const err = Object.assign(new Error("Internal error"), { code: -32603 });
    (instance as any).sessionId = "sess-1";
    (instance as any).connection = { setSessionConfigOption: vi.fn().mockRejectedValue(err) };

    await expect(
      instance.setConfigOption("mode", { type: "select", value: "architect" })
    ).rejects.toThrow(err);
  });

  it("returns full configOptions when setSessionConfigOption succeeds", async () => {
    const { AgentInstance } = await import("../agent-instance.js");
    const instance = Object.create(AgentInstance.prototype) as InstanceType<typeof AgentInstance>;

    const configOptions = [{ id: "mode", name: "Mode", type: "select" as const, currentValue: "architect", options: [] }];
    (instance as any).sessionId = "sess-1";
    (instance as any).connection = {
      setSessionConfigOption: vi.fn().mockResolvedValue({ configOptions }),
    };

    const result = await instance.setConfigOption("mode", { type: "select", value: "architect" });

    expect(result.configOptions).toEqual(configOptions);
  });
});

describe("AgentInstance new ACP methods exist", () => {
  // We import the class to verify method existence on the prototype
  it("has setConfigOption method", async () => {
    const { AgentInstance } = await import("../agent-instance.js");
    expect(typeof AgentInstance.prototype.setConfigOption).toBe("function");
  });

  it("has listSessions method", async () => {
    const { AgentInstance } = await import("../agent-instance.js");
    expect(typeof AgentInstance.prototype.listSessions).toBe("function");
  });

  it("has loadSession method", async () => {
    const { AgentInstance } = await import("../agent-instance.js");
    expect(typeof AgentInstance.prototype.loadSession).toBe("function");
  });

  it("has authenticate method", async () => {
    const { AgentInstance } = await import("../agent-instance.js");
    expect(typeof AgentInstance.prototype.authenticate).toBe("function");
  });

  it("has forkSession method", async () => {
    const { AgentInstance } = await import("../agent-instance.js");
    expect(typeof AgentInstance.prototype.forkSession).toBe("function");
  });

  it("has closeSession method", async () => {
    const { AgentInstance } = await import("../agent-instance.js");
    expect(typeof AgentInstance.prototype.closeSession).toBe("function");
  });
});
