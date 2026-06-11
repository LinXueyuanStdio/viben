// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeClientTool, isGuiExecuteTool } from "./client-tool-executor";
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

  it("executes builtin read_window instead of requiring an action-store registration", async () => {
    const result = await executeClientTool({
      sessionId: "session-1",
      toolCallId: "tool-call-1",
      toolName: "mcp__client_side__GUI_execute",
      input: { action: "read_window" },
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0]).toEqual({
      type: "image",
      data: "bmF0aXZlLXBuZw==",
      mimeType: "image/png",
    });
  });

  it("includes builtin actions in ACP list_actions", async () => {
    const result = await executeClientTool({
      sessionId: "session-1",
      toolCallId: "tool-call-1",
      toolName: "GUI_execute",
      input: { action: "list_actions" },
    });

    expect(result.isError).toBeUndefined();
    expect(JSON.parse(result.content[0]?.type === "text" ? result.content[0].text : "[]")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "read_window" }),
        expect.objectContaining({ name: "navigate_to" }),
      ])
    );
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

  it("recognizes the unified client_side MCP server tool names", () => {
    expect(isGuiExecuteTool("GUI_execute")).toBe(true);
    expect(isGuiExecuteTool("mcp__client_side__GUI_execute")).toBe(true);
    expect(isGuiExecuteTool("mcp__client_side__ClientSideBash")).toBe(true);
  });
});
