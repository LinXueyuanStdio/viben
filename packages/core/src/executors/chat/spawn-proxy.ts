/**
 * Spawn Chat Proxy
 *
 * Executes AI agent chat by spawning a subprocess with stdio inherit.
 * This is the original implementation method that works with all executors.
 */

import { spawn } from "node:child_process";
import type { ChatProxy, ChatResult } from "./types";
import type { ChatOptions } from "../ops/types";
import type { Executor } from "../ops/types";
import type { ExecutorType } from "../../types";
import { getExecutor } from "../ops";
import { ExecutorError } from "../../error";

/**
 * SpawnChatProxy - Uses subprocess spawning for chat execution
 *
 * This proxy spawns a child process with stdio: "inherit" for transparent
 * pass-through of input/output. It works with any executor that implements
 * the chat capability.
 */
export class SpawnChatProxy implements ChatProxy {
  readonly proxyType = "spawn" as const;

  private executor: Executor;

  constructor(executorType: ExecutorType) {
    this.executor = getExecutor(executorType);
  }

  /**
   * Execute chat by spawning a subprocess using the executor's CLI command
   */
  async execute(options: ChatOptions): Promise<ChatResult> {
    const cliName = this.executor.getCliName();
    if (!cliName) {
      throw ExecutorError.chatNotSupported(this.executor.type);
    }

    return this.spawnGenericChat(cliName, options);
  }

  /**
   * Generic chat spawn using the executor's CLI command
   */
  private async spawnGenericChat(
    chatCommand: string,
    options: ChatOptions
  ): Promise<ChatResult> {
    const {
      prompt,
      cwd = process.cwd(),
      inputFormat = "text",
      outputFormat = "text",
      verbose = false,
      sessionId,
      resume,
      model,
      dangerouslySkipPermissions = false,
    } = options;

    // Build command arguments
    const args: string[] = ["-p"];
    if (prompt) {
      args.push(prompt);
    }

    // Format arguments
    if (inputFormat !== "text") {
      args.push("--input-format", inputFormat);
    }
    if (outputFormat !== "text") {
      args.push("--output-format", outputFormat);
    }

    // Optional arguments
    if (verbose) {
      args.push("--verbose");
    }
    if (sessionId) {
      args.push("--session-id", sessionId);
    }
    if (resume) {
      args.push("--resume", resume);
    }
    if (model) {
      args.push("--model", model);
    }
    if (dangerouslySkipPermissions) {
      args.push("--dangerously-skip-permissions");
    }

    return new Promise<ChatResult>((resolve, reject) => {
      const child = spawn(chatCommand, args, {
        cwd,
        stdio: "inherit",
        shell: true,
      });

      child.on("error", (error) => {
        reject(new Error(`Failed to start ${chatCommand}: ${error.message}`));
      });

      child.on("exit", (code, signal) => {
        if (signal) {
          // Process was killed by signal
          resolve({ exitCode: 0 });
          return;
        }
        resolve({ exitCode: code ?? 1 });
      });
    });
  }
}

/**
 * Create a SpawnChatProxy instance
 */
export function createSpawnChatProxy(executorType: ExecutorType): SpawnChatProxy {
  return new SpawnChatProxy(executorType);
}
