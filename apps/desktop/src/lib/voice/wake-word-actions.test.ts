import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth-store";
import { useOverlayStore } from "@/stores/overlay-store";
import { useUiStore } from "@/stores/ui-store";
import { handleWakeWordDetected } from "./wake-word-actions";

const connectVoiceAgent = vi.hoisted(() => vi.fn<() => Promise<void>>());

vi.mock("sonner", () => ({
  toast: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("./voice-agent-service", () => ({
  connectVoiceAgent,
}));

vi.hoisted(() => {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
    },
  });
});

describe("handleWakeWordDetected", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    connectVoiceAgent.mockResolvedValue(undefined);
    useAuthStore.setState({ isAuthenticated: false, user: null });
    useOverlayStore.setState({ visible: false, waveState: "idle" });
    useUiStore.setState({ isChatPopupOpen: false });
  });

  it("opens the chat popup when an unauthenticated user detects the wake word", () => {
    handleWakeWordDetected();

    expect(useUiStore.getState().isChatPopupOpen).toBe(true);
  });

  it("shows a toast instead of reopening when an unauthenticated user's chat popup is already open", () => {
    useUiStore.setState({ isChatPopupOpen: true });

    handleWakeWordDetected();

    expect(toast.info).toHaveBeenCalledWith("聊天面板已打开");
  });

  it("shows the listening overlay and connects voice agent when an authenticated user detects the wake word", () => {
    useAuthStore.setState({ isAuthenticated: true });

    handleWakeWordDetected();

    expect(useOverlayStore.getState().visible).toBe(true);
    expect(useOverlayStore.getState().waveState).toBe("listening");
    expect(connectVoiceAgent).toHaveBeenCalledTimes(1);
    expect(useUiStore.getState().isChatPopupOpen).toBe(false);
  });
});
