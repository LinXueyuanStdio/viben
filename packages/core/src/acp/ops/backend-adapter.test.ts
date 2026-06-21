import { describe, expect, it, vi } from "vitest";
import { Transform } from "node:stream";
import { createAcpBackendDiagnosticError } from "./backend-adapter";
import { AcpPromptError } from "./errors";

describe("createAcpBackendDiagnosticError", () => {
  it("preserves structured ACP backend errors instead of stringifying them as [object Object]", () => {
    const error = createAcpBackendDiagnosticError(
      {
        code: -32603,
        message: "unexpected status 401 Unauthorized",
        data: {
          status: 401,
          details: "Authentication Fails",
        },
      },
      {
        child: {
          exitCode: null,
          signalCode: null,
        },
        command: "node",
        args: ["claude-agent-acp"],
        cwd: "/tmp/workspace",
        cwdExists: true,
        stdoutTransform: new Transform(),
        stderr: { toString: () => "" },
        claudeConfigDir: "/tmp/claude-config",
        resolutionDiagnostics: {
          requestedCommand: "claude-agent-acp",
          resolvedCommand: "node",
          resolvedArgs: ["claude-agent-acp"],
        },
        kill: vi.fn(),
      } as unknown as Parameters<typeof createAcpBackendDiagnosticError>[1],
      "ACP backend prompt failed"
    );

    expect(error).toBeInstanceOf(AcpPromptError);
    if (!(error instanceof AcpPromptError)) {
      throw new Error("Expected structured ACP prompt error");
    }
    expect(error.message).toBe("unexpected status 401 Unauthorized");
    expect(error.message).not.toBe("[object Object]");
    expect(error.detail).toMatchObject({
      code: -32603,
      data: {
        status: 401,
        details: "Authentication Fails",
      },
      command: "node",
      args: ["claude-agent-acp"],
      cwd: "/tmp/workspace",
      cwdExists: true,
      claudeConfigDir: "/tmp/claude-config",
      resolution: {
        requestedCommand: "claude-agent-acp",
        resolvedCommand: "node",
        resolvedArgs: ["claude-agent-acp"],
      },
    });
  });
});
