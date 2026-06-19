import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUiStore } from "@/stores/ui-store";
import { handleWakeWordDetected } from "./wake-word-actions";

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
    useUiStore.setState({ isChatPopupOpen: false });
  });

  it("opens the chat popup when the wake word is detected", () => {
    handleWakeWordDetected();

    expect(useUiStore.getState().isChatPopupOpen).toBe(true);
  });
});
