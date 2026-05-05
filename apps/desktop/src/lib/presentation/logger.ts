/**
 * Presentation File Logger
 *
 * Writes presentation debug logs to ~/.viben/logs/presentation.log
 * Reuses the existing log_screenshot_trace Tauri command to write to a JSONL file.
 * Falls back to console-only if invoke fails.
 */

import { invoke } from "@tauri-apps/api/core"

let _buffer: string[] = []
let _flushTimer: ReturnType<typeof setTimeout> | null = null
const TRACE_ID = "presentation-" + Date.now()

function scheduleFlush() {
  if (_flushTimer) return
  _flushTimer = setTimeout(flush, 300)
}

async function flush() {
  _flushTimer = null
  if (_buffer.length === 0) return
  const lines = [..._buffer]
  _buffer = []
  for (const line of lines) {
    try {
      await invoke("log_screenshot_trace", {
        traceId: TRACE_ID,
        source: "presentation",
        stage: "log",
        details: { message: line },
      })
    } catch {
      // Invoke not available or failed — already logged to console
    }
  }
}

/**
 * Log a message to the presentation log file.
 * Also logs to console for immediate visibility.
 */
export function plog(msg: string, ...args: unknown[]) {
  const timestamp = new Date().toISOString()
  // Format args into the message (simple %s/%d replacement)
  let formatted = msg
  let argIdx = 0
  formatted = formatted.replace(/%[sd]/g, () => {
    if (argIdx < args.length) {
      const val = args[argIdx++]
      return typeof val === "object" ? JSON.stringify(val) : String(val)
    }
    return "%s"
  })
  // Append remaining args
  if (argIdx < args.length) {
    formatted += " " + args.slice(argIdx).map(a => typeof a === "object" ? JSON.stringify(a) : String(a)).join(" ")
  }

  const line = `[${timestamp}] ${formatted}`
  console.log(line)
  _buffer.push(line)
  scheduleFlush()
}

/**
 * Force flush all buffered logs immediately.
 * Call this before presentation stops.
 */
export async function pflush() {
  if (_flushTimer) {
    clearTimeout(_flushTimer)
    _flushTimer = null
  }
  await flush()
}

/**
 * Clear marker (start new session in the log file).
 */
export async function pclear() {
  try {
    await invoke("log_screenshot_trace", {
      traceId: TRACE_ID,
      source: "presentation",
      stage: "session_start",
      details: { message: "=== New Presentation Session ===" },
    })
  } catch {
    // ignore
  }
}
