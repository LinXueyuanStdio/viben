/**
 * Stuck Detection Constants
 *
 * Centralized configuration for stuck detection to ensure consistency
 * between client-side detection and server-side validation.
 */

/**
 * Default threshold for considering a task stuck (in milliseconds)
 * Used when no activity has been detected for this duration.
 */
export const STUCK_THRESHOLD_MS = 60_000; // 60 seconds

/**
 * Server-side stuck threshold (in milliseconds)
 * Slightly longer than client threshold to account for network latency
 */
export const SERVER_STUCK_THRESHOLD_MS = 2 * 60_000; // 2 minutes

/**
 * SSE heartbeat interval (in milliseconds)
 * How often the server sends heartbeat pings to keep connection alive
 */
export const SSE_HEARTBEAT_INTERVAL_MS = 30_000; // 30 seconds

/**
 * Default check interval for stuck detection (in milliseconds)
 * How often the client checks if a task is stuck
 */
export const STUCK_CHECK_INTERVAL_MS = 30_000; // 30 seconds

/**
 * Maximum age for activity records before cleanup (in milliseconds)
 * Activity records older than this will be removed to prevent memory leaks
 */
export const ACTIVITY_MAX_AGE_MS = 10 * 60_000; // 10 minutes

/**
 * Cleanup interval for stale activity records (in milliseconds)
 * How often to run the cleanup routine
 */
export const ACTIVITY_CLEANUP_INTERVAL_MS = 5 * 60_000; // 5 minutes

/**
 * Network retry configuration for checkTaskRunning
 */
export const NETWORK_RETRY_CONFIG = {
  /** Maximum number of retry attempts */
  maxRetries: 2,
  /** Initial delay before first retry (in milliseconds) */
  initialDelayMs: 1000,
  /** Multiplier for exponential backoff */
  backoffMultiplier: 2,
  /** Request timeout (in milliseconds) */
  timeoutMs: 10_000,
} as const;

/**
 * Safety timeout for async operations (in milliseconds)
 * Prevents isCheckingRef from being stuck forever if async operations hang
 */
export const SAFETY_TIMEOUT_MS = 15_000; // 15 seconds
