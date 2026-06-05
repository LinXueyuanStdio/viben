import { describe, expect, it, vi } from "vitest";
import type { ExecutionContext } from "./types";
import { createClientSideBash } from "./client-side-bash";

function createContext(): ExecutionContext {
  return {
    sessionId: "session-1",
    toolUseId: "tool-use-1",
    requireApproval: async () => true,
  };
}

function getText(result: Awaited<ReturnType<ReturnType<typeof createClientSideBash>["execute"]>>): string {
  const content = result.content[0];
  if (content.type !== "text") {
    throw new Error(`Expected text result, got ${content.type}`);
  }
  return content.text;
}

describe("ClientSideBash", () => {
  it("runs a just-bash script that invokes GUI actions through the gui command", async () => {
    const executeGUIAction = vi.fn(async (input: { action: string; payload?: unknown }) => ({
      content: [{ type: "text" as const, text: `ran:${input.action}:${JSON.stringify(input.payload)}` }],
    }));
    const bash = createClientSideBash({ executeGUIAction });
    const ctx = createContext();

    const result = await bash.execute(
      {
        script: 'gui execute --json \'{"action":"demo.echo","payload":{"text":"hello"}}\'',
      },
      ctx
    );

    expect(executeGUIAction).toHaveBeenCalledWith(
      { action: "demo.echo", payload: { text: "hello" } },
      ctx
    );
    expect(result.isError).toBeUndefined();
    expect(getText(result)).toContain("ran:demo.echo");
  });

  it("reports an error when any gui command fails even if a later command succeeds", async () => {
    const executeGUIAction = vi.fn(async () => ({
      content: [{ type: "text" as const, text: "gui action failed" }],
      isError: true,
    }));
    const bash = createClientSideBash({ executeGUIAction });

    const result = await bash.execute(
      {
        script: 'gui execute --json \'{"action":"demo.fail"}\'; echo "after"',
      },
      createContext()
    );

    expect(executeGUIAction).toHaveBeenCalledOnce();
    expect(result.isError).toBe(true);
    expect(getText(result)).toContain("gui action failed");
    expect(getText(result)).toContain("exit_code: 0");
  });

  it("rejects GUI_execute-shaped input instead of falling back to conversion", async () => {
    const executeGUIAction = vi.fn(async (input: { action: string; payload?: unknown }) => ({
      content: [{ type: "text" as const, text: `ran:${input.action}` }],
    }));
    const bash = createClientSideBash({ executeGUIAction });

    const result = await bash.execute(
      {
        action: "demo.echo",
        payload: { text: "from gui execute" },
      } as unknown as { script: string },
      createContext()
    );

    expect(executeGUIAction).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
    expect(getText(result)).toContain('validation_error: missing required field "script"');
  });
});
