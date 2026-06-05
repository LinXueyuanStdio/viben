import * as clack from '@clack/prompts'
import type { TerminalIO } from './types.js'

// @clack/prompts returns a symbol when the user cancels (Ctrl+C).
// We convert that to an Error so callers can handle cancellation uniformly.

function isCancel(value: unknown): value is symbol {
  return typeof value === 'symbol'
}

function guardCancel<T>(value: T | symbol): T {
  if (isCancel(value)) {
    throw new Error('cancelled')
  }
  return value as T
}

/**
 * Create a TerminalIO implementation backed by @clack/prompts.
 *
 * Used during plugin install/configure flows — these are CLI-only operations
 * that require interactive terminal access. Not available during normal
 * runtime (headless server mode).
 */
export function createTerminalIO(): TerminalIO {
  return {
    async text(opts) {
      const result = await clack.text(opts as Parameters<typeof clack.text>[0])
      return guardCancel(result)
    },
    async select<T>(opts: {
      message: string
      options: { value: T; label: string; hint?: string }[]
    }): Promise<T> {
      const result = await clack.select(opts as Parameters<typeof clack.select>[0])
      return guardCancel(result) as T
    },
    async confirm(opts) {
      const result = await clack.confirm(opts as Parameters<typeof clack.confirm>[0])
      return guardCancel(result)
    },
    async password(opts) {
      const result = await clack.password(opts as Parameters<typeof clack.password>[0])
      return guardCancel(result)
    },
    async multiselect<T>(opts: {
      message: string
      options: { value: T; label: string; hint?: string }[]
      required?: boolean
    }): Promise<T[]> {
      const result = await clack.multiselect(opts as Parameters<typeof clack.multiselect>[0])
      return guardCancel(result) as T[]
    },
    log: {
      info: (msg) => clack.log.info(msg),
      success: (msg) => clack.log.success(msg),
      warning: (msg) => clack.log.warning(msg),
      error: (msg) => clack.log.error(msg),
      step: (msg) => clack.log.step(msg),
    },
    spinner() {
      const s = clack.spinner()
      return {
        start: (msg: string) => s.start(msg),
        stop: (msg?: string) => s.stop(msg),
        fail: (msg?: string) => s.stop(msg ?? 'Failed'),
      }
    },
    note: (msg, title) => clack.note(msg, title),
    cancel: (msg) => clack.cancel(msg),
  }
}
