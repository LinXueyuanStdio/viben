import { describe, expect, it, vi } from "vitest";
import { Transform } from "node:stream";
import {
  buildClaudeAcpSettings,
  createAcpBackendDiagnosticError,
} from "./backend-adapter";
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

describe("buildClaudeAcpSettings", () => {
  it("overrides inherited Claude env with provider id, model, and executor env", async () => {
    const settings = await buildClaudeAcpSettings(
      {
        permissions: {
          defaultMode: "acceptEdits",
        },
        env: {
          ANTHROPIC_AUTH_TOKEN: "sk-old",
          ANTHROPIC_API_KEY: "sk-api-old",
          ANTHROPIC_BASE_URL: "http://localhost:8777",
          ANTHROPIC_MODEL: "claude-opus-4-6-thinking",
          ANTHROPIC_DEFAULT_SONNET_MODEL: "claude-sonnet-4-6",
          KEEP_ME: "yes",
        },
        model: "claude-opus-4-6",
      },
      {
        name: "DeepSeek ClaudeCode",
        executor_type: "CLAUDE_CODE",
        model: "deepseek-v4-pro[1m]",
        executor_config: {
          provider_id: "deepseek-anthropic",
          env: {
            ANTHROPIC_DEFAULT_SONNET_MODEL: "deepseek-v4-flash",
            CLAUDE_CODE_SUBAGENT_MODEL: "deepseek-v4-pro[1m]",
          },
        },
      },
      async (providerId) => providerId === "deepseek-anthropic"
        ? {
            id: "deepseek-anthropic",
            type: "anthropic",
            name: "DeepSeek Anthropic",
            base_url: "https://api.deepseek.com/anthropic",
            api_key: "sk-deepseek",
          }
        : null
    );

    expect(settings).toMatchObject({
      permissions: {
        defaultMode: "acceptEdits",
      },
      model: "deepseek-v4-pro[1m]",
      env: {
        KEEP_ME: "yes",
        ANTHROPIC_AUTH_TOKEN: "sk-deepseek",
        ANTHROPIC_BASE_URL: "https://api.deepseek.com/anthropic",
        ANTHROPIC_MODEL: "deepseek-v4-pro[1m]",
        ANTHROPIC_DEFAULT_SONNET_MODEL: "deepseek-v4-flash",
        CLAUDE_CODE_SUBAGENT_MODEL: "deepseek-v4-pro[1m]",
      },
    });
    expect(settings.env).not.toHaveProperty("ANTHROPIC_API_KEY");
  });
});
