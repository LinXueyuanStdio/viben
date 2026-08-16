import { describe, expect, test, vi } from "vitest";

const spies = vi.hoisted(() => ({
  abortChatInstanceTransport: vi.fn((_chatId: string) => {}),
  removeChatInstance: vi.fn((_chatId: string) => {}),
  clearChatWorkspaceStatus: vi.fn((_chatId: string) => {}),
}));

vi.mock("@/lib/chat-instance-manager", () => ({
  abortChatInstanceTransport: spies.abortChatInstanceTransport,
  removeChatInstance: spies.removeChatInstance,
}));

vi.mock("@/lib/workspace-status-store", () => ({
  clearChatWorkspaceStatus: spies.clearChatWorkspaceStatus,
}));

import { cleanupChatRouteOnUnmount } from "./chat-route-cleanup";

describe("cleanupChatRouteOnUnmount", () => {
  test("aborts local transport and removes chat instance", () => {
    const calls: string[] = [];
    const abortTransport = vi.fn((chatId: string) => {
      calls.push(`abort:${chatId}`);
    });
    const removeInstance = vi.fn((chatId: string) => {
      calls.push(`remove:${chatId}`);
    });
    const clearWorkspaceStatus = vi.fn((chatId: string) => {
      calls.push(`clear:${chatId}`);
    });

    cleanupChatRouteOnUnmount("chat-123", {
      abortTransport,
      removeInstance,
      clearWorkspaceStatus,
    });

    expect(abortTransport).toHaveBeenCalledWith("chat-123");
    expect(removeInstance).toHaveBeenCalledWith("chat-123");
    expect(clearWorkspaceStatus).toHaveBeenCalledWith("chat-123");
    expect(calls).toEqual([
      "abort:chat-123",
      "remove:chat-123",
      "clear:chat-123",
    ]);
  });

  test("clears workspace status with default dependencies", () => {
    cleanupChatRouteOnUnmount("chat-789");

    expect(spies.clearChatWorkspaceStatus).toHaveBeenCalledWith("chat-789");
  });

  test("never issues a server stop signal during route teardown", () => {
    const abortTransport = vi.fn((_chatId: string) => {});
    const removeInstance = vi.fn((_chatId: string) => {});
    const stopStream = vi.fn((_chatId: string) => {});

    cleanupChatRouteOnUnmount("chat-456", {
      abortTransport,
      removeInstance,
      stopStream,
    });

    expect(abortTransport).toHaveBeenCalledTimes(1);
    expect(removeInstance).toHaveBeenCalledTimes(1);
    expect(stopStream).not.toHaveBeenCalled();
  });
});
