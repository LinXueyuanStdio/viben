/**
 * Configuration for the SecurityGuard access policy.
 *
 * `allowedUserIds`: if non-empty, only users whose string ID appears in this list
 * are permitted. An empty array means "allow all" (open access).
 * `maxConcurrentSessions`: caps how many active/initializing sessions may exist
 * at once across all users, preventing resource exhaustion.
 */
export interface SecurityConfig {
  allowedUserIds: string[];
  maxConcurrentSessions: number;
}

/**
 * Enforces user allowlist and global session-count limits on every incoming message.
 *
 * Implemented as a plugin service (rather than baked into core) so that the access
 * policy is swappable — deployments can replace or extend it without touching core.
 * The plugin registers this guard as a `message:incoming` middleware handler.
 */
export class SecurityGuard {
  constructor(
    private getSecurityConfig: () => Promise<SecurityConfig>,
    private sessionManager: { listSessions(): Array<{ status: string }> },
  ) {}

  /**
   * Returns `{ allowed: true }` when the message may proceed, or
   * `{ allowed: false, reason }` when it should be blocked.
   *
   * Two checks run in order:
   * 1. **Allowlist** — if `allowedUserIds` is non-empty, the user's ID (coerced to string)
   *    must appear in the list. Telegram/Slack IDs are numbers, so coercion is required.
   * 2. **Session cap** — counts sessions in `active` or `initializing` state. `initializing`
   *    is included because a session holds resources before it reaches `active`.
   */
  async checkAccess(message: { userId: string | number }):
    Promise<{ allowed: true } | { allowed: false; reason: string }>
  {
    const config = await this.getSecurityConfig();
    const allowedIds = config.allowedUserIds ?? [];
    const maxSessions = config.maxConcurrentSessions ?? 20;

    if (allowedIds.length > 0) {
      // Coerce to string: platform adapters may deliver userId as a number (e.g. Telegram)
      const userId = String(message.userId);
      if (!allowedIds.includes(userId)) {
        return { allowed: false, reason: "Unauthorized user" };
      }
    }
    const active = this.sessionManager.listSessions()
      .filter(s => s.status === "active" || s.status === "initializing");
    if (active.length >= maxSessions) {
      return { allowed: false, reason: `Session limit reached (${maxSessions})` };
    }
    return { allowed: true };
  }
}
