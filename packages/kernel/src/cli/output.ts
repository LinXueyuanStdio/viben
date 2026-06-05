// CLI output utilities: machine-readable JSON mode and human-readable text mode.
//
// When --json is passed, all output is a single JSON line on stdout; human-readable
// text (pino logs, progress messages) is suppressed via muteForJson(). This makes
// commands scriptable and consumable by tools like the Viben App.

// --- Types ---

/** Successful JSON response envelope. */
export interface JsonSuccess<T = unknown> {
  success: true
  data: T
}

/** Error JSON response envelope. */
export interface JsonError {
  success: false
  error: {
    code: string
    message: string
  }
}

/** Union type for all JSON CLI output shapes. */
export type JsonOutput<T = unknown> = JsonSuccess<T> | JsonError

// --- Error Codes ---

/** Stable machine-readable error codes for JSON output. Do not rename existing values. */
export const ErrorCodes = {
  DAEMON_NOT_RUNNING: 'DAEMON_NOT_RUNNING',
  INSTANCE_NOT_FOUND: 'INSTANCE_NOT_FOUND',
  PLUGIN_NOT_FOUND: 'PLUGIN_NOT_FOUND',
  AGENT_NOT_FOUND: 'AGENT_NOT_FOUND',
  CONFIG_INVALID: 'CONFIG_INVALID',
  CONFIG_NOT_FOUND: 'CONFIG_NOT_FOUND',
  SETUP_FAILED: 'SETUP_FAILED',
  API_ERROR: 'API_ERROR',
  TUNNEL_ERROR: 'TUNNEL_ERROR',
  INSTALL_FAILED: 'INSTALL_FAILED',
  UNINSTALL_FAILED: 'UNINSTALL_FAILED',
  MISSING_ARGUMENT: 'MISSING_ARGUMENT',
  UNKNOWN_COMMAND: 'UNKNOWN_COMMAND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes]

// --- Functions ---

/** Returns true if the command was invoked with --json output mode. */
export function isJsonMode(args: string[]): boolean {
  return args.includes('--json')
}

/**
 * Emit a success JSON envelope and exit 0.
 * Declared as `never` because it always calls `process.exit`.
 */
export function jsonSuccess(data: unknown): never {
  console.log(JSON.stringify({ success: true, data }))
  process.exit(0)
}

/**
 * Emit an error JSON envelope and exit 1.
 * Declared as `never` because it always calls `process.exit`.
 */
export function jsonError(code: ErrorCode, message: string): never {
  console.log(JSON.stringify({ success: false, error: { code, message } }))
  process.exit(1)
}

/**
 * Suppress pino logger output when running in --json mode.
 * Pino logs to stdout by default; in JSON mode that would corrupt the machine-readable output.
 * Dynamic import so commands that never use JSON don't pay the pino import cost.
 */
export async function muteForJson(): Promise<void> {
  try {
    const { muteLogger } = await import('../core/utils/log.js')
    muteLogger()
  } catch {
    // pino not initialized — nothing to mute, that's fine
  }
}
