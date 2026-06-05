import { describe, it, expect, vi } from "vitest";
import { SpeechService } from "../speech-service.js";
import type { STTProvider, SpeechServiceConfig } from "../speech-types.js";

function makeConfig(overrides?: Partial<SpeechServiceConfig>): SpeechServiceConfig {
  return {
    stt: { provider: null, providers: {} },
    tts: { provider: null, providers: {} },
    ...overrides,
  };
}

describe("SpeechService", () => {
  describe("isSTTAvailable", () => {
    it("returns false when no provider configured", () => {
      const svc = new SpeechService(makeConfig());
      expect(svc.isSTTAvailable()).toBe(false);
    });

    it("returns false when provider set but no matching config", () => {
      const svc = new SpeechService(makeConfig({
        stt: { provider: "groq", providers: {} },
      }));
      expect(svc.isSTTAvailable()).toBe(false);
    });

    it("returns true when provider configured with API key", () => {
      const svc = new SpeechService(makeConfig({
        stt: {
          provider: "groq",
          providers: { groq: { apiKey: "gsk_test" } },
        },
      }));
      expect(svc.isSTTAvailable()).toBe(true);
    });
  });

  describe("isTTSAvailable", () => {
    it("returns false when no provider configured", () => {
      const svc = new SpeechService(makeConfig());
      expect(svc.isTTSAvailable()).toBe(false);
    });
  });

  describe("unregisterTTSProvider", () => {
    it('unregisters a TTS provider', () => {
      const service = new SpeechService({
        stt: { provider: null, providers: {} },
        tts: { provider: 'test', providers: {} },
      })
      const mockProvider = { name: 'test', synthesize: vi.fn() }
      service.registerTTSProvider('test', mockProvider)
      expect(service.isTTSAvailable()).toBe(true)

      service.unregisterTTSProvider('test')
      expect(service.isTTSAvailable()).toBe(false)
    })
  });

  describe("transcribe", () => {
    it("throws when STT not configured", async () => {
      const svc = new SpeechService(makeConfig());
      await expect(svc.transcribe(Buffer.from("test"), "audio/wav"))
        .rejects.toThrow("STT not configured");
    });

    it("delegates to registered provider", async () => {
      const mockProvider: STTProvider = {
        name: "test",
        transcribe: vi.fn().mockResolvedValue({ text: "hello world" }),
      };
      const svc = new SpeechService(makeConfig({
        stt: {
          provider: "test",
          providers: { test: { apiKey: "key123" } },
        },
      }));
      svc.registerSTTProvider("test", mockProvider);
      const result = await svc.transcribe(Buffer.from("audio"), "audio/wav");
      expect(result.text).toBe("hello world");
      expect(mockProvider.transcribe).toHaveBeenCalledWith(
        Buffer.from("audio"), "audio/wav", undefined,
      );
    });

    it("throws when provider not registered", async () => {
      const svc = new SpeechService(makeConfig({
        stt: {
          provider: "unknown",
          providers: { unknown: { apiKey: "key" } },
        },
      }));
      await expect(svc.transcribe(Buffer.from("test"), "audio/wav"))
        .rejects.toThrow('STT provider "unknown" not registered');
    });
  });
});
