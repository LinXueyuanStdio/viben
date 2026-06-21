import { describe, expect, it } from "vitest";
import { formatJsonRpcError } from "./acp-client";

describe("formatJsonRpcError", () => {
  it("prioritizes stderr from JSON-RPC error data over generic internal messages", () => {
    expect(formatJsonRpcError({
      code: -32603,
      message: "Internal error: Codex app-server stdout closed",
      data: {
        message: "Codex app-server stdout closed",
        stderr: "Error: error loading default config after config error: Model provider `本地-openai` not found\n",
        command: "codex",
        args: ["app-server"],
      },
    })).toBe("Error: error loading default config after config error: Model provider `本地-openai` not found");
  });
});
