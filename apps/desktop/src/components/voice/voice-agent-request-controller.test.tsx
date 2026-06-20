/**
 * @vitest-environment jsdom
 */

import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { useVoiceAgentRequestStore } from "@/stores/voice-agent-request-store";
import { VoiceAgentRequestController } from "./voice-agent-request-controller";

const connect = vi.fn<() => Promise<void>>();
let voiceState = "idle";
let voiceConnected = false;

vi.mock("@/hooks/use-voice-agent", () => ({
  useVoiceAgent: () => ({
    state: voiceState,
    isConnected: voiceConnected,
    isListening: false,
    isSpeaking: false,
    connect,
    disconnect: vi.fn(),
    toggleMicrophone: vi.fn(),
    userTranscript: "",
    agentResponse: {
      text: "",
      charCount: 0,
      isStreaming: false,
      showPopup: false,
      popupOpacity: 1,
      responseId: null,
    },
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function render(element: React.ReactElement) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root?.render(element);
  });
}

describe("VoiceAgentRequestController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    connect.mockResolvedValue(undefined);
    voiceState = "idle";
    voiceConnected = false;
    useVoiceAgentRequestStore.setState({
      connectionRequestId: 0,
      connectionRequestSource: null,
    });
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    container?.remove();
    root = null;
    container = null;
  });

  it("connects the voice agent when a wake word connection request arrives", () => {
    render(<VoiceAgentRequestController />);

    act(() => {
      useVoiceAgentRequestStore.getState().requestConnection("wake_word");
    });

    expect(connect).toHaveBeenCalledTimes(1);
  });

  it("does not reconnect while voice agent is already connected", () => {
    voiceConnected = true;
    render(<VoiceAgentRequestController />);

    act(() => {
      useVoiceAgentRequestStore.getState().requestConnection("wake_word");
    });

    expect(connect).not.toHaveBeenCalled();
  });
});
