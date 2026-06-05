/**
 * Allowlisted environment variable patterns for agent subprocesses.
 *
 * Agent processes inherit a filtered subset of the parent environment.
 * This prevents agents from accessing secrets (API keys, tokens, cloud
 * credentials) that happen to be in the Viben process environment.
 *
 * Only shell basics (PATH, HOME, SHELL), locale settings, git/SSH config,
 * and terminal rendering vars are passed through. Patterns ending with "*"
 * match any variable starting with that prefix (e.g. "GIT_*" matches "GIT_AUTHOR_NAME").
 */
export const DEFAULT_ENV_WHITELIST = [
  // Shell basics — agents need these to resolve commands and write temp files
  "PATH", "HOME", "SHELL", "LANG", "LC_*", "TERM", "USER", "LOGNAME",
  "TMPDIR", "XDG_*", "NODE_ENV", "EDITOR",
  // Git — agents need git config and SSH access for code operations
  "GIT_*", "SSH_AUTH_SOCK", "SSH_AGENT_PID",
  // Terminal rendering — ensures correct color output in agent responses
  "COLORTERM", "FORCE_COLOR", "NO_COLOR", "TERM_PROGRAM", "HOSTNAME",
];

/** Supports exact match and trailing wildcard (e.g. "GIT_*" matches "GIT_AUTHOR_NAME"). */
function matchesPattern(key: string, pattern: string): boolean {
  if (pattern.endsWith("*")) {
    return key.startsWith(pattern.slice(0, -1));
  }
  return key === pattern;
}

/**
 * Filters environment variables for an agent subprocess.
 *
 * Only variables matching the whitelist patterns are passed through.
 * Agent-specific env vars (from agent config) are merged on top,
 * allowing agents to override allowlisted values.
 *
 * @param processEnv - The parent process environment (typically `process.env`)
 * @param agentEnv - Additional env vars defined in the agent's configuration
 * @param whitelist - Custom whitelist patterns (defaults to DEFAULT_ENV_WHITELIST)
 */
export function filterEnv(
  processEnv: Record<string, string | undefined>,
  agentEnv?: Record<string, string>,
  whitelist?: string[],
): Record<string, string> {
  const patterns = whitelist ?? DEFAULT_ENV_WHITELIST;
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(processEnv)) {
    if (value === undefined) continue;
    if (patterns.some((p) => matchesPattern(key, p))) {
      result[key] = value;
    }
  }

  if (agentEnv) {
    Object.assign(result, agentEnv);
  }

  return result;
}
