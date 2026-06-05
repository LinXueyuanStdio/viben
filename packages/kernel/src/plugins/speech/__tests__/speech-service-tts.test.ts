import { describe, it, expect, vi } from "vitest";
import { SpeechService } from "../speech-service.js";
import type { TTSProvider, SpeechServiceConfig } from "../speech-types.js";

function makeConfig(overrides?: Partial<SpeechServiceConfig>): SpeechServiceConfig {
  return {
    stt: { provider: null, providers: {} },
    tts: { provider: null, providers: {} },
    ...overrides,
  };
}

function mockTTSProvider(name: string): TTSProvider {
  return {
    name,
    synthesize: vi.fn().mockResolvedValue({
      audioBuffer: Buffer.from("fake-audio"),
      mimeType: "audio/mp3",
    }),
  };
}

describe("SpeechService TTS (apiKey optional)", () => {
  describe("isTTSAvailable", () => {
    it("returns true when provider configured without apiKey and registered", () => {
      const svc = new SpeechService(makeConfig({
        tts: {
          provider: "edge-tts",
          providers: { "edge-tts": {} },
        },
      }));
      svc.registerTTSProvider("edge-tts", mockTTSProvider("edge-tts"));
      expect(svc.isTTSAvailable()).toBe(true);
    });

    it("returns false when no provider configured", () => {
      const svc = new SpeechService(makeConfig());
      expect(svc.isTTSAvailable()).toBe(false);
    });

    it("returns false when provider set but not registered", () => {
      const svc = new SpeechService(makeConfig({
        tts: {
          provider: "edge-tts",
          providers: { "edge-tts": {} },
        },
      }));
      // Not calling registerTTSProvider
      expect(svc.isTTSAvailable()).toBe(false);
    });
  });

  describe("synthesize", () => {
    it("works without apiKey", async () => {
      const provider = mockTTSProvider("edge-tts");
      const svc = new SpeechService(makeConfig({
        tts: {
          provider: "edge-tts",
          providers: { "edge-tts": {} },
        },
      }));
      svc.registerTTSProvider("edge-tts", provider);
      const result = await svc.synthesize("hello");
      expect(result.audioBuffer).toBeInstanceOf(Buffer);
      expect(result.mimeType).toBe("audio/mp3");
      expect(provider.synthesize).toHaveBeenCalledWith("hello", undefined);
    });

    it("throws when provider not registered", async () => {
      const svc = new SpeechService(makeConfig({
        tts: {
          provider: "edge-tts",
          providers: { "edge-tts": {} },
        },
      }));
      await expect(svc.synthesize("hello"))
        .rejects.toThrow('TTS provider "edge-tts" not registered');
    });
  });

  describe("isSTTAvailable still requires apiKey", () => {
    it("returns false when provider configured without apiKey", () => {
      const svc = new SpeechService(makeConfig({
        stt: {
          provider: "groq",
          providers: { groq: {} },
        },
      }));
      expect(svc.isSTTAvailable()).toBe(false);
    });

    it("returns true when provider configured with apiKey", () => {
      const svc = new SpeechService(makeConfig({
        stt: {
          provider: "groq",
          providers: { groq: { apiKey: "gsk_test" } },
        },
      }));
      expect(svc.isSTTAvailable()).toBe(true);
    });
  });
});
