import { describe, it, expect, vi, beforeEach } from "vitest";
import { Session, TTS_PROMPT_INSTRUCTION, TTS_MAX_LENGTH } from "../session.js";
import type { AgentInstance } from "../../agents/agent-instance.js";
import type { SpeechService } from "../../../plugins/speech/exports.js";
import type { AgentEvent } from "../../types.js";

function mockAgent(): AgentInstance {
  return {
    sessionId: "test-session",
    promptCapabilities: {},
    prompt: vi.fn().mockResolvedValue({}),
    cancel: vi.fn(),
    cleanup: vi.fn(),
    destroy: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  } as any;
}

function mockSpeechService(ttsAvailable: boolean): SpeechService {
  return {
    isSTTAvailable: () => false,
    isTTSAvailable: () => ttsAvailable,
    synthesize: vi.fn().mockResolvedValue({
      audioBuffer: Buffer.from("fake audio"),
      mimeType: "audio/mpeg",
    }),
    transcribe: vi.fn(),
  } as any;
}

function createSession(agent: AgentInstance, speech?: SpeechService): Session {
  return new Session({
    channelId: "test",
    agentName: "test-agent",
    workingDirectory: "/tmp",
    agentInstance: agent,
    speechService: speech,
  });
}

describe("Session TTS integration", () => {
  describe("voiceMode property", () => {
    it("defaults to 'off'", () => {
      const session = createSession(mockAgent());
      expect(session.voiceMode).toBe("off");
    });

    it("setVoiceMode changes voiceMode", () => {
      const session = createSession(mockAgent());
      session.setVoiceMode("on");
      expect(session.voiceMode).toBe("on");
      session.setVoiceMode("next");
      expect(session.voiceMode).toBe("next");
      session.setVoiceMode("off");
      expect(session.voiceMode).toBe("off");
    });
  });

  describe("TTS prompt injection", () => {
    it("appends TTS instruction when voiceMode 'on' and TTS available", async () => {
      const agent = mockAgent();
      const speech = mockSpeechService(true);
      const session = createSession(agent, speech);
      session.setVoiceMode("on");

      await session.enqueuePrompt("hello");

      await vi.waitFor(() => {
        expect(agent.prompt).toHaveBeenCalled();
      });

      const [text] = (agent.prompt as any).mock.calls[0];
      expect(text).toContain("hello");
      expect(text).toContain(TTS_PROMPT_INSTRUCTION);
    });

    it("does NOT inject when voiceMode 'off'", async () => {
      const agent = mockAgent();
      const speech = mockSpeechService(true);
      const session = createSession(agent, speech);
      // voiceMode defaults to "off"

      await session.enqueuePrompt("hello");

      await vi.waitFor(() => {
        expect(agent.prompt).toHaveBeenCalled();
      });

      const [text] = (agent.prompt as any).mock.calls[0];
      expect(text).toBe("hello");
      expect(text).not.toContain("[TTS]");
    });

    it("resets voiceMode to 'off' after 'next'", async () => {
      const agent = mockAgent();
      const speech = mockSpeechService(true);
      const session = createSession(agent, speech);
      session.setVoiceMode("next");

      await session.enqueuePrompt("hello");

      await vi.waitFor(() => {
        expect(agent.prompt).toHaveBeenCalled();
      });

      const [text] = (agent.prompt as any).mock.calls[0];
      expect(text).toContain(TTS_PROMPT_INSTRUCTION);
      expect(session.voiceMode).toBe("off");
    });

    it("preserves voiceMode 'next' when prompt fails", async () => {
      const agent = mockAgent();
      const speech = mockSpeechService(true);
      const session = createSession(agent, speech);
      session.setVoiceMode("next");

      (agent.prompt as any).mockRejectedValue(new Error("agent crashed"));

      await session.enqueuePrompt("hello");

      await vi.waitFor(() => {
        expect(agent.prompt).toHaveBeenCalled();
      });

      // Allow queue error handler to run
      await new Promise((r) => setTimeout(r, 50));
      expect(session.voiceMode).toBe("next");
    });

    it("keeps voiceMode 'on' after prompt", async () => {
      const agent = mockAgent();
      const speech = mockSpeechService(true);
      const session = createSession(agent, speech);
      session.setVoiceMode("on");

      await session.enqueuePrompt("hello");

      await vi.waitFor(() => {
        expect(agent.prompt).toHaveBeenCalled();
      });

      expect(session.voiceMode).toBe("on");
    });

    it("does NOT inject when TTS not available", async () => {
      const agent = mockAgent();
      const speech = mockSpeechService(false);
      const session = createSession(agent, speech);
      session.setVoiceMode("on");

      await session.enqueuePrompt("hello");

      await vi.waitFor(() => {
        expect(agent.prompt).toHaveBeenCalled();
      });

      const [text] = (agent.prompt as any).mock.calls[0];
      expect(text).toBe("hello");
      expect(text).not.toContain(TTS_PROMPT_INSTRUCTION);
    });
  });

  describe("Post-response TTS pipeline", () => {
    it("emits audio_content when response contains [TTS] block", async () => {
      const agent = mockAgent();
      const speech = mockSpeechService(true);
      const session = createSession(agent, speech);
      session.setVoiceMode("on");

      // Simulate agent emitting text with TTS block during prompt
      (agent.prompt as any).mockImplementation(async () => {
        session.emit("agent_event", {
          type: "text",
          content: "Here is the answer. [TTS]Spoken summary here[/TTS]",
        });
      });

      const audioEvents: AgentEvent[] = [];
      session.on("agent_event", (event) => {
        if (event.type === "audio_content") {
          audioEvents.push(event);
        }
      });

      await session.enqueuePrompt("hello");

      await vi.waitFor(() => {
        expect(audioEvents.length).toBe(1);
      });

      const audioEvent = audioEvents[0] as Extract<AgentEvent, { type: "audio_content" }>;
      expect(audioEvent.mimeType).toBe("audio/mpeg");
      expect(audioEvent.data).toBe(Buffer.from("fake audio").toString("base64"));
      expect(speech.synthesize).toHaveBeenCalledWith("Spoken summary here");
    });

    it("does not emit audio_content when no [TTS] block", async () => {
      const agent = mockAgent();
      const speech = mockSpeechService(true);
      const session = createSession(agent, speech);
      session.setVoiceMode("on");

      (agent.prompt as any).mockImplementation(async () => {
        session.emit("agent_event", {
          type: "text",
          content: "Here is the answer without TTS block.",
        });
      });

      const audioEvents: AgentEvent[] = [];
      session.on("agent_event", (event) => {
        if (event.type === "audio_content") {
          audioEvents.push(event);
        }
      });

      await session.enqueuePrompt("hello");

      await vi.waitFor(() => {
        expect(agent.prompt).toHaveBeenCalled();
      });

      // Give time for any fire-and-forget to complete
      await new Promise((r) => setTimeout(r, 50));
      expect(audioEvents.length).toBe(0);
      expect(speech.synthesize).not.toHaveBeenCalled();
    });

    it("skips TTS silently when synthesize fails", async () => {
      const agent = mockAgent();
      const speech = mockSpeechService(true);
      (speech.synthesize as any).mockRejectedValue(new Error("synthesis failed"));
      const session = createSession(agent, speech);
      session.setVoiceMode("on");

      (agent.prompt as any).mockImplementation(async () => {
        session.emit("agent_event", {
          type: "text",
          content: "Answer [TTS]Spoken text[/TTS]",
        });
      });

      const audioEvents: AgentEvent[] = [];
      session.on("agent_event", (event) => {
        if (event.type === "audio_content") {
          audioEvents.push(event);
        }
      });

      await session.enqueuePrompt("hello");

      await vi.waitFor(() => {
        expect(speech.synthesize).toHaveBeenCalled();
      });

      // Give time for fire-and-forget to complete
      await new Promise((r) => setTimeout(r, 50));
      expect(audioEvents.length).toBe(0);
    });

    it("truncates TTS text at TTS_MAX_LENGTH chars", async () => {
      const agent = mockAgent();
      const speech = mockSpeechService(true);
      const session = createSession(agent, speech);
      session.setVoiceMode("on");

      const longText = "a".repeat(TTS_MAX_LENGTH + 1000);
      (agent.prompt as any).mockImplementation(async () => {
        session.emit("agent_event", {
          type: "text",
          content: `Answer [TTS]${longText}[/TTS]`,
        });
      });

      await session.enqueuePrompt("hello");

      await vi.waitFor(() => {
        expect(speech.synthesize).toHaveBeenCalled();
      });

      const [synthesizedText] = (speech.synthesize as any).mock.calls[0];
      expect(synthesizedText.length).toBe(TTS_MAX_LENGTH);
    });
  });
});
