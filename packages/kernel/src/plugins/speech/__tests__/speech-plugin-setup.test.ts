import { describe, it, expect, vi } from "vitest";
import speechPlugin from "../index.js";
import type { SpeechService } from "../speech-service.js";

function makePluginCtx(overrides: {
  pluginConfig?: Record<string, unknown>
}) {
  let registeredService: SpeechService | undefined;

  const ctx = {
    pluginConfig: overrides.pluginConfig ?? {},
    instanceRoot: undefined,
    registerService: vi.fn((_, svc) => { registeredService = svc as SpeechService }),
    registerCommand: vi.fn(),
    registerEditableFields: vi.fn(),
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    core: undefined,
    sessions: undefined,
  } as any;

  return { ctx, getService: () => registeredService };
}

describe("speech plugin setup()", () => {
  it("enables STT when groqApiKey is in plugin settings", async () => {
    const { ctx, getService } = makePluginCtx({
      pluginConfig: { groqApiKey: "gsk_from_settings" },
    });

    await speechPlugin.setup!(ctx);

    expect(getService()!.isSTTAvailable()).toBe(true);
    expect(ctx.log.warn).not.toHaveBeenCalled();
  });

  it("disables STT when groqApiKey is missing from plugin settings", async () => {
    const { ctx, getService } = makePluginCtx({
      pluginConfig: { sttProvider: "groq" }, // no groqApiKey
    });

    await speechPlugin.setup!(ctx);

    expect(getService()!.isSTTAvailable()).toBe(false);
  });
});
