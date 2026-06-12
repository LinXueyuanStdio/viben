// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeClientTool } from "./client-tool-executor";
import { setApprovalHandler } from "@/lib/action-system/execution-context";
import { useActionStore } from "@/stores/action-store";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async () => ({
    data: "data:image/png;base64,bmF0aXZlLXBuZw==",
    width: 100,
    height: 80,
  })),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    outerPosition: async () => ({ x: 0, y: 0 }),
    outerSize: async () => ({ width: 100, height: 80 }),
  }),
}));

describe("ACP client tool executor", () => {
  beforeEach(() => {
    useActionStore.setState({ registry: new Map() });
    document.body.innerHTML = '<div id="root">Desktop</div>';
    setApprovalHandler((pending) => pending.resolve(true));
  });

  it("returns error for GUI_execute (now handled via socket.io)", async () => {
    const result = await executeClientTool({
      sessionId: "session-1",
      toolCallId: "tool-call-1",
      toolName: "mcp__client_side__GUI_execute",
      input: { action: "read_window" },
    });

    expect(result.isError).toBe(true);
  });

  it("executes ClientSideBash through the ACP client-side tool bridge", async () => {
    const result = await executeClientTool({
      sessionId: "session-1",
      toolCallId: "tool-call-1",
      toolName: "mcp__client_side__ClientSideBash",
      input: { script: "echo desktop-bash" },
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0]?.type === "text" ? result.content[0].text : "").toContain("desktop-bash");
  });

  it("returns error for unknown tools", async () => {
    const result = await executeClientTool({
      sessionId: "session-1",
      toolCallId: "tool-call-1",
      toolName: "unknown_tool",
      input: {},
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.type === "text" ? result.content[0].text : "").toContain("no handler");
  });
});
