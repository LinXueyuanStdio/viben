import { describe, it, expect, vi, beforeEach } from "vitest";
import { Session } from "../session.js";
import type { AgentInstance } from "../../agents/agent-instance.js";
import type { SpeechService } from "../../../plugins/speech/exports.js";
import { TypedEmitter } from "../../utils/typed-emitter.js";

vi.mock("node:fs", () => ({
  promises: {
    readFile: vi.fn().mockResolvedValue(Buffer.from("fake audio data")),
  },
}));

function mockAgent(hasAudio = false): AgentInstance {
  const emitter = new TypedEmitter();
  return Object.assign(emitter, {
    sessionId: "test-session",
    promptCapabilities: hasAudio ? { audio: true } : {},
    prompt: vi.fn().mockResolvedValue({}),
    cancel: vi.fn(),
    cleanup: vi.fn(),
  }) as any;
}

function mockSpeechService(available: boolean, transcribeResult?: string): SpeechService {
  return {
    isSTTAvailable: () => available,
    transcribe: vi.fn().mockResolvedValue({ text: transcribeResult || "transcribed text" }),
  } as any;
}

describe("Session speech integration", () => {
  it("transcribes audio when agent lacks audio capability and STT is available", async () => {
    const agent = mockAgent(false);
    const speech = mockSpeechService(true, "hello from voice");

    const session = new Session({
      channelId: "test",
      agentName: "test-agent",
      workingDirectory: "/tmp",
      agentInstance: agent,
      speechService: speech,
    });

    await session.enqueuePrompt("", [{
      type: "audio",
      filePath: "/tmp/voice.ogg",
      fileName: "voice.ogg",
      mimeType: "audio/ogg",
      size: 1000,
    }]);

    await vi.waitFor(() => {
      expect(agent.prompt).toHaveBeenCalled();
    });

    const [text, attachments] = (agent.prompt as any).mock.calls[0];
    expect(text).toContain("hello from voice");
    expect(attachments?.some((a: any) => a.type === "audio")).toBeFalsy();
  });

  it("passes audio through when agent supports audio", async () => {
    const agent = mockAgent(true);
    const speech = mockSpeechService(true);

    const session = new Session({
      channelId: "test",
      agentName: "test-agent",
      workingDirectory: "/tmp",
      agentInstance: agent,
      speechService: speech,
    });

    await session.enqueuePrompt("check this", [{
      type: "audio",
      filePath: "/tmp/voice.ogg",
      fileName: "voice.ogg",
      mimeType: "audio/ogg",
      size: 1000,
    }]);

    await vi.waitFor(() => {
      expect(agent.prompt).toHaveBeenCalled();
    });

    const [text, attachments] = (agent.prompt as any).mock.calls[0];
    expect(text).toBe("check this");
    expect(attachments).toHaveLength(1);
    expect(attachments[0].type).toBe("audio");
    expect(speech.transcribe).not.toHaveBeenCalled();
  });

  it("falls back gracefully when STT not configured", async () => {
    const agent = mockAgent(false);
    const speech = mockSpeechService(false);

    const session = new Session({
      channelId: "test",
      agentName: "test-agent",
      workingDirectory: "/tmp",
      agentInstance: agent,
      speechService: speech,
    });

    await session.enqueuePrompt("[Audio: voice.ogg]", [{
      type: "audio",
      filePath: "/tmp/voice.ogg",
      fileName: "voice.ogg",
      mimeType: "audio/ogg",
      size: 1000,
    }]);

    await vi.waitFor(() => {
      expect(agent.prompt).toHaveBeenCalled();
    });

    const [, attachments] = (agent.prompt as any).mock.calls[0];
    expect(attachments).toHaveLength(1);
  });

  it("emits error and keeps attachment when transcription fails", async () => {
    const agent = mockAgent(false);
    const speech = {
      isSTTAvailable: () => true,
      transcribe: vi.fn().mockRejectedValue(new Error("Groq rate limit exceeded")),
    } as any;

    const session = new Session({
      channelId: "test",
      agentName: "test-agent",
      workingDirectory: "/tmp",
      agentInstance: agent,
      speechService: speech,
    });

    const errorEvents: any[] = [];
    session.on("agent_event", (e) => { if (e.type === "error") errorEvents.push(e); });

    await session.enqueuePrompt("[Audio: voice.ogg]", [{
      type: "audio",
      filePath: "/tmp/voice.ogg",
      fileName: "voice.ogg",
      mimeType: "audio/ogg",
      size: 1000,
    }]);

    await vi.waitFor(() => {
      expect(agent.prompt).toHaveBeenCalled();
    });

    const [, attachments] = (agent.prompt as any).mock.calls[0];
    expect(attachments).toHaveLength(1);
    expect(attachments[0].type).toBe("audio");
    expect(errorEvents).toHaveLength(1);
    expect(errorEvents[0].message).toContain("Groq rate limit exceeded");
  });

  it("works without speechService (backward compat)", async () => {
    const agent = mockAgent(false);

    const session = new Session({
      channelId: "test",
      agentName: "test-agent",
      workingDirectory: "/tmp",
      agentInstance: agent,
    });

    await session.enqueuePrompt("hello", [{
      type: "audio",
      filePath: "/tmp/voice.ogg",
      fileName: "voice.ogg",
      mimeType: "audio/ogg",
      size: 1000,
    }]);

    await vi.waitFor(() => {
      expect(agent.prompt).toHaveBeenCalled();
    });

    const [, attachments] = (agent.prompt as any).mock.calls[0];
    expect(attachments).toHaveLength(1);
  });
});
