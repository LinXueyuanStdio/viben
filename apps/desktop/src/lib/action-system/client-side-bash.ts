import { Bash, defineCommand } from "just-bash";
import type { Command, CommandContext } from "just-bash";
import type { ClientToolResult } from "../client-side-tool/types";
import type { ExecutionContext } from "./types";

export const CLIENT_SIDE_BASH_TOOL_NAME = "ClientSideBash";

export interface GUIExecuteInput {
  action: string;
  payload?: unknown;
}

export interface ClientSideBashInput {
  script: string;
}

export interface ClientSideBashOptions {
  executeGUIAction: (
    input: GUIExecuteInput,
    ctx: ExecutionContext
  ) => Promise<ClientToolResult>;
}

export interface ClientSideBashRuntime {
  execute: (input: ClientSideBashInput, ctx: ExecutionContext) => Promise<ClientToolResult>;
}

export function isClientSideBashTool(toolName: string): boolean {
  return toolName === CLIENT_SIDE_BASH_TOOL_NAME || toolName === `mcp__client_side_bash__${CLIENT_SIDE_BASH_TOOL_NAME}`;
}

export function createClientSideBash(options: ClientSideBashOptions): ClientSideBashRuntime {
  return {
    execute: (input, ctx) => executeClientSideBash(input, ctx, options),
  };
}

async function executeClientSideBash(
  input: ClientSideBashInput,
  ctx: ExecutionContext,
  options: ClientSideBashOptions
): Promise<ClientToolResult> {
  const script = typeof input.script === "string" ? input.script : "";
  if (!script.trim()) {
    return {
      content: [{ type: "text", text: 'validation_error: missing required field "script"' }],
      isError: true,
    };
  }

  try {
    let guiActionFailed = false;
    const guiCommand = createGUICommand(ctx, options, () => {
      guiActionFailed = true;
    });

    const bash = new Bash({
      customCommands: [guiCommand],
    });
    const result = await bash.exec(script);
    const text = [
      result.stdout ? `stdout:\n${result.stdout}` : "",
      result.stderr ? `stderr:\n${result.stderr}` : "",
      `exit_code: ${result.exitCode}`,
    ].filter(Boolean).join("\n\n");

    return {
      content: [{ type: "text", text }],
      isError: result.exitCode === 0 && !guiActionFailed ? undefined : true,
    };
  } catch (err) {
    return {
      content: [{ type: "text", text: `ClientSideBash failed: ${err instanceof Error ? err.message : String(err)}` }],
      isError: true,
    };
  }
}

function createGUICommand(
  ctx: ExecutionContext,
  options: ClientSideBashOptions,
  onError: () => void
): Command {
  return defineCommand("gui", async (args, commandCtx) => {
    const subcommand = args[0];
    if (!subcommand || subcommand === "--help") {
      return {
        stdout: [
          "gui - desktop GUI action commands",
          "",
          "Usage: gui execute --json '{\"action\":\"list_actions\"}'",
          "",
        ].join("\n"),
        stderr: "",
        exitCode: 0,
      };
    }
    if (subcommand !== "execute") {
      return {
        stdout: "",
        stderr: `gui: unknown subcommand '${subcommand}'\n`,
        exitCode: 1,
      };
    }

    try {
      const guiInput = readGUIExecuteInput(args.slice(1), commandCtx);
      const result = await options.executeGUIAction(guiInput, ctx);
      if (result.isError) {
        onError();
        return {
          stdout: "",
          stderr: `${resultToText(result) || "GUI action failed"}\n`,
          exitCode: 1,
        };
      }
      return {
        stdout: `${JSON.stringify(resultToExecutorValue(result))}\n`,
        stderr: "",
        exitCode: 0,
      };
    } catch (err: unknown) {
      onError();
      const msg = err instanceof Error ? err.message : String(err);
      return {
        stdout: "",
        stderr: `gui execute: ${msg}\n`,
        exitCode: 1,
      };
    }
  });
}

function readGUIExecuteInput(args: string[], ctx: CommandContext): GUIExecuteInput {
  const json = readJsonArg(args, decodeCommandStdin(ctx));
  return normalizeGUIExecuteInput(JSON.parse(json));
}

function readJsonArg(args: string[], stdin: string): string {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--json" && i + 1 < args.length) {
      return args[i + 1];
    }
    if (arg.startsWith("--json=")) {
      return arg.slice("--json=".length);
    }
  }
  if (stdin.trim()) {
    return stdin.trim();
  }
  throw new Error('missing required "--json" argument');
}

function decodeCommandStdin(ctx: CommandContext): string {
  if (typeof ctx.stdin === "string") return ctx.stdin;
  if (ctx.stdin instanceof Uint8Array) {
    return new TextDecoder().decode(ctx.stdin);
  }
  return "";
}

function normalizeGUIExecuteInput(args: unknown): GUIExecuteInput {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("gui.execute args must be an object");
  }
  const record = args as Record<string, unknown>;
  if (typeof record.action !== "string" || record.action.trim() === "") {
    throw new Error('gui.execute args.action must be a non-empty string');
  }
  return {
    action: record.action,
    payload: record.payload,
  };
}

function resultToExecutorValue(result: ClientToolResult): unknown {
  if (result.structuredContent) return result.structuredContent;
  if (result.content.length === 1 && result.content[0].type === "text") {
    const text = result.content[0].text;
    try {
      return JSON.parse(text);
    } catch {
      return { text };
    }
  }
  return {
    content: result.content,
  };
}

function resultToText(result: ClientToolResult): string {
  return result.content.map((item) => item.type === "text" ? item.text : `[${item.mimeType} image]`).join("\n");
}
