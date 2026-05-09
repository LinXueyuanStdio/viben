/**
 * Completion Callback Registry
 *
 * When a presentation tool_use group finishes executing all its steps,
 * the registered callback is invoked with the final result (screenshots + text).
 */

import type { ClientToolResult } from "./types"

type CompletionCallback = (result: ClientToolResult) => void

const callbacks = new Map<string, CompletionCallback>()

/**
 * Register a callback for when a tool_use completes all its presentation steps.
 */
export function registerCompletionCallback(toolUseId: string, cb: CompletionCallback): void {
  callbacks.set(toolUseId, cb)
}

/**
 * Remove a registered callback (e.g., on timeout).
 */
export function removeCompletionCallback(toolUseId: string): void {
  callbacks.delete(toolUseId)
}

/**
 * Check if a callback exists for the given tool_use.
 */
export function hasCompletionCallback(toolUseId: string): boolean {
  return callbacks.has(toolUseId)
}

/**
 * Consume (invoke and remove) a callback for the given tool_use.
 * Returns true if a callback was found and invoked.
 */
export function consumeCompletionCallback(toolUseId: string, result: ClientToolResult): boolean {
  const cb = callbacks.get(toolUseId)
  if (!cb) return false
  callbacks.delete(toolUseId)
  cb(result)
  return true
}
