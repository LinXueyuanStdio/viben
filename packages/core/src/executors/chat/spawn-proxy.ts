/**
 * Spawn Chat Proxy
 *
 * Executes AI agent chat via the unified Executor interface.
 * Delegates to executor.chat() which handles subprocess spawning internally.
 */

import type { ChatProxy, ChatResult } from "./types";
import type { ChatOptions } from "../ops/types";
import type { Executor } from "../ops/types";
import type { ExecutorType } from "../../types";
import { getExecutor } from "../ops";

/**
 * SpawnChatProxy - Uses the unified Executor.chat() for chat execution
 *
 * This proxy delegates to the unified executor's chat() method, which
 * handles subprocess spawning with stdio: "inherit" for transparent
 * pass-through of input/output.
 */
export class SpawnChatProxy implements ChatProxy {
  readonly proxyType = "spawn" as const;

  private executor: Executor;

  constructor(executorType: ExecutorType) {
    this.executor = getExecutor(executorType);
  }

  /**
   * Execute chat via the unified executor interface
   */
  async execute(options: ChatOptions): Promise<ChatResult> {
    const result = await this.executor.chat({
      prompt: options.prompt || "",
      cwd: options.cwd,
      model: options.model,
      sessionId: options.sessionId,
      resume: options.resume,
      inputFormat: options.inputFormat,
      outputFormat: options.outputFormat,
      verbose: options.verbose,
      dangerouslySkipPermissions: options.dangerouslySkipPermissions,
      env: options.env,
    });
    return { exitCode: result.exitCode ?? (result.success ? 0 : 1) };
  }
}

/**
 * Create a SpawnChatProxy instance
 */
export function createSpawnChatProxy(executorType: ExecutorType): SpawnChatProxy {
  return new SpawnChatProxy(executorType);
}
