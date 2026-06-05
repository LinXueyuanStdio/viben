import { spawn } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { expandHome } from '../core/config/config.js'

// Daemon lifecycle utilities.
// The daemon model runs the server as a detached child process (PID file tracking).
// This allows `viben start` to return immediately while the server keeps running
// independently of the terminal session.

/** Returns the path to the PID file for the given instance root. */
export function getPidPath(root: string): string {
  return path.join(root, 'viben.pid')
}

/** Returns the default log directory for the given instance root. */
export function getLogDir(root: string): string {
  return path.join(root, 'logs')
}

/**
 * Returns the path to the "running" marker file.
 * The marker exists while the daemon is intentionally running, so launchd/systemd
 * knows whether to restart it after a crash vs. leaving it stopped after `viben stop`.
 */
export function getRunningMarker(root: string): string {
  return path.join(root, 'running')
}

/** Write a PID file, creating the parent directory if needed. */
export function writePidFile(pidPath: string, pid: number): void {
  const dir = path.dirname(pidPath)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(pidPath, String(pid))
}

/** Read a PID from a file. Returns null if the file is missing or malformed. */
export function readPidFile(pidPath: string): number | null {
  try {
    const content = fs.readFileSync(pidPath, 'utf-8').trim()
    const pid = parseInt(content, 10)
    return isNaN(pid) ? null : pid
  } catch {
    return null
  }
}

/** Remove the PID file. Silently ignores ENOENT (already gone). */
export function removePidFile(pidPath: string): void {
  try {
    fs.unlinkSync(pidPath)
  } catch {
    // ignore if already gone
  }
}

/**
 * Check whether the process recorded in the PID file is alive.
 *
 * Uses `process.kill(pid, 0)` as a non-destructive liveness probe — it throws
 * ESRCH if the PID doesn't exist, or EPERM if owned by another user.
 * Cleans up stale PID files for dead processes.
 */
export function isProcessRunning(pidPath: string): boolean {
  const pid = readPidFile(pidPath)
  if (pid === null) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    // Process not running, clean up stale PID file
    removePidFile(pidPath)
    return false
  }
}

/**
 * Return the running status and PID of the daemon.
 * Cleans up stale PID files if the recorded process is no longer alive.
 */
export function getStatus(pidPath: string): { running: boolean; pid?: number } {
  const pid = readPidFile(pidPath)
  if (pid === null) return { running: false }
  try {
    process.kill(pid, 0)
    return { running: true, pid }
  } catch {
    removePidFile(pidPath)
    return { running: false }
  }
}

/**
 * Fork the daemon as a detached background process.
 *
 * Spawn mechanics:
 * - The child runs `node <cli> --daemon-child` with VIBEN_INSTANCE_ROOT in its env.
 * - `detached: true` creates a new process group so the child survives terminal close.
 * - stdout/stderr are redirected to the log file (append mode); the parent closes its
 *   copies immediately after spawn so the child holds the only references.
 * - `child.unref()` removes the child from the parent's event loop reference count,
 *   allowing the parent (`viben start`) to exit while the child keeps running.
 * - The PID file is written by both parent (early report) and child (authoritative write
 *   in main.ts startServer) to handle race conditions with launchd/systemd starts.
 */
export function startDaemon(pidPath: string, logDir: string | undefined, instanceRoot: string): { pid: number } | { error: string } {
  // Mark as running so auto-start works on next boot
  markRunning(instanceRoot)

  // Check if already running
  if (isProcessRunning(pidPath)) {
    const pid = readPidFile(pidPath)!
    return { error: `Already running (PID ${pid})` }
  }

  const resolvedLogDir = logDir ? expandHome(logDir) : getLogDir(instanceRoot)
  fs.mkdirSync(resolvedLogDir, { recursive: true })
  const logFile = path.join(resolvedLogDir, 'viben.log')

  // Find the CLI entry point — must be the same binary that invoked this function
  const cliPath = path.resolve(process.argv[1])
  const nodePath = process.execPath

  const out = fs.openSync(logFile, 'a')
  const err = fs.openSync(logFile, 'a')

  const child = spawn(nodePath, [cliPath, '--daemon-child'], {
    detached: true,
    stdio: ['ignore', out, err],
    env: {
      ...process.env,
      ...(instanceRoot ? { VIBEN_INSTANCE_ROOT: instanceRoot } : {}),
    },
  })

  // Close file descriptors in parent — child has its own copies
  fs.closeSync(out)
  fs.closeSync(err)

  if (!child.pid) {
    return { error: 'Failed to spawn daemon process' }
  }

  // PID file is written by the child process itself (in main.ts startServer)
  // to avoid race conditions and ensure consistency with LaunchAgent/systemd starts.
  // We still write it here as a fallback in case the child hasn't written it yet
  // when the parent needs to report the PID.
  writePidFile(pidPath, child.pid)
  child.unref()

  return { pid: child.pid }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Three-way liveness probe: alive, dead (ESRCH), or EPERM.
 * EPERM means the PID exists but belongs to a different user — the PID file was
 * likely reused by the OS for an unrelated process after the daemon exited.
 */
function isProcessAlive(pid: number): 'alive' | 'dead' | 'eperm' {
  try {
    process.kill(pid, 0)
    return 'alive'
  } catch (e) {
    const err = e as NodeJS.ErrnoException
    if (err.code === 'EPERM') return 'eperm'
    return 'dead'
  }
}

/**
 * Gracefully stop the daemon, escalating to SIGKILL if it doesn't exit.
 *
 * Stop sequence:
 * 1. Send SIGTERM; poll every 100ms for up to 5 seconds.
 * 2. If still alive after 5s, send SIGKILL; poll for up to 1 more second.
 * 3. If still alive after SIGKILL, the process is in uninterruptible I/O — very rare.
 *
 * Also clears the "running" marker so the daemon is not restarted on next login.
 */
export async function stopDaemon(pidPath: string, instanceRoot: string): Promise<{ stopped: boolean; pid?: number; error?: string }> {
  const pid = readPidFile(pidPath)
  if (pid === null) return { stopped: false, error: 'Not running (no PID file)' }

  const status = isProcessAlive(pid)
  if (status === 'dead') {
    removePidFile(pidPath)
    return { stopped: false, error: 'Not running (stale PID file removed)' }
  }
  if (status === 'eperm') {
    removePidFile(pidPath)
    return { stopped: false, error: 'PID belongs to another process (stale PID file removed)' }
  }

  try {
    process.kill(pid, 'SIGTERM')
  } catch (e) {
    return { stopped: false, error: `Failed to stop: ${(e as Error).message}` }
  }

  clearRunning(instanceRoot)

  const POLL_INTERVAL = 100
  const TIMEOUT = 5000
  const start = Date.now()

  while (Date.now() - start < TIMEOUT) {
    await sleep(POLL_INTERVAL)
    const s = isProcessAlive(pid)
    if (s === 'dead' || s === 'eperm') {
      removePidFile(pidPath)
      return { stopped: true, pid }
    }
  }

  try {
    process.kill(pid, 'SIGKILL')
  } catch (e) {
    const err = e as NodeJS.ErrnoException
    if (err.code === 'EPERM') {
      return { stopped: false, pid, error: 'PID may have been reused by another process. Run `viben status` to verify, or manually delete the PID file.' }
    }
  }

  const killStart = Date.now()
  while (Date.now() - killStart < 1000) {
    await sleep(POLL_INTERVAL)
    const s = isProcessAlive(pid)
    if (s === 'dead' || s === 'eperm') {
      removePidFile(pidPath)
      return { stopped: true, pid }
    }
  }

  // SIGKILL sent but process still alive after 1s — extremely rare (uninterruptible I/O).
  return { stopped: false, pid, error: 'Process did not exit after SIGKILL (possible uninterruptible I/O). PID file retained.' }
}

/** Mark that the daemon should auto-start on boot */
export function markRunning(root: string): void {
  const marker = getRunningMarker(root)
  fs.mkdirSync(path.dirname(marker), { recursive: true })
  fs.writeFileSync(marker, '')
}

/** Remove running marker — daemon won't auto-start on boot */
export function clearRunning(root: string): void {
  try { fs.unlinkSync(getRunningMarker(root)) } catch { /* ignore */ }
}

/** Check if the daemon was running before (should auto-start on boot) */
export function shouldAutoStart(root: string): boolean {
  return fs.existsSync(getRunningMarker(root))
}
