/**
 * Detection for permission-bypass configuration values.
 *
 * When a user sets an agent's permission mode to a bypass value (e.g., "yolo",
 * "dangerous"), ALL tool calls are auto-approved without prompting. This is
 * distinct from "dontask"/"dont_ask"/"skip" which DENY unknown permissions
 * rather than approving them.
 *
 * Used by PermissionGate to determine whether to show permission prompts
 * or auto-approve.
 */

/** Keywords that indicate a permission-bypass (auto-approve) value.
 * NOTE: "dontask"/"dont_ask"/"skip" are NOT bypass — they DENY unknown permissions. */
export const BYPASS_KEYWORDS = ['bypass', 'dangerous', 'auto_accept', 'yolo']

/** Returns true if the given value string contains a bypass keyword (case-insensitive). */
export function isPermissionBypass(value: string): boolean {
  const lower = value.toLowerCase()
  return BYPASS_KEYWORDS.some(kw => lower.includes(kw))
}
