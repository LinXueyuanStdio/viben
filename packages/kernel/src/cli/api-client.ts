import * as fs from 'node:fs'
import * as path from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'

// The daemon writes its bound port to api.port once it is ready to accept requests.
// The CLI reads this file to discover how to talk to the daemon.

function defaultPortFile(root: string): string {
  return path.join(root, 'api.port')
}

function defaultSecretFile(root: string): string {
  return path.join(root, 'api-secret')
}

/**
 * Poll the api.port file until it appears (daemon has bound its port) or timeout.
 * Returns the port number, or null if the daemon did not start within timeoutMs.
 *
 * Used after `viben start` to wait for the daemon to become ready before
 * reporting the port in JSON output.
 */
export async function waitForPortFile(
  portFilePath: string,
  timeoutMs = 5000,
  intervalMs = 100,
): Promise<number | null> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const port = readApiPort(portFilePath)
    if (port !== null) return port
    await sleep(intervalMs)
  }
  // One final attempt at deadline in case the write landed in the last interval
  return readApiPort(portFilePath)
}

/**
 * Read the daemon's API port from the port file.
 * Returns null if the file doesn't exist or contains an invalid value,
 * which indicates the daemon is not running.
 */
export function readApiPort(portFilePath?: string, instanceRoot?: string): number | null {
  const filePath = portFilePath ?? defaultPortFile(instanceRoot!)
  try {
    const content = fs.readFileSync(filePath, 'utf-8').trim()
    const port = parseInt(content, 10)
    return isNaN(port) ? null : port
  } catch {
    return null
  }
}

/**
 * Read the shared secret used to authenticate CLI requests to the daemon.
 * Returns null if the file doesn't exist (daemon not running or API auth disabled).
 */
export function readApiSecret(secretFilePath?: string, instanceRoot?: string): string | null {
  const filePath = secretFilePath ?? defaultSecretFile(instanceRoot!)
  try {
    const content = fs.readFileSync(filePath, 'utf-8').trim()
    return content || null
  } catch {
    return null
  }
}

/**
 * Remove a stale api.port file left behind by an unclean daemon shutdown.
 * Stale files cause the CLI to think the daemon is running when it isn't.
 */
export function removeStalePortFile(portFilePath?: string, instanceRoot?: string): void {
  const filePath = portFilePath ?? defaultPortFile(instanceRoot!)
  try {
    fs.unlinkSync(filePath)
  } catch {
    // ignore
  }
}

/**
 * Make an authenticated HTTP request to the running daemon.
 *
 * All daemon API calls go to 127.0.0.1 (loopback only — no external exposure).
 * The shared secret is injected as a Bearer token for each request.
 */
export async function apiCall(
  port: number,
  urlPath: string,
  options?: RequestInit,
  instanceRoot?: string,
): Promise<Response> {
  const secret = readApiSecret(undefined, instanceRoot)
  const headers = new Headers(options?.headers)
  if (secret) {
    headers.set('Authorization', `Bearer ${secret}`)
  }
  return fetch(`http://127.0.0.1:${port}${urlPath}`, { ...options, headers })
}
