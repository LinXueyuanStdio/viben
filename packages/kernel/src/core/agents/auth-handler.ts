import type { AgentCapabilities } from "../types.js";

/**
 * Handles authentication for agent instances.
 * Checks agent capabilities for auth methods and triggers authentication if needed.
 */
export class AuthHandler {
  /**
   * Check if the agent requires authentication and handle it.
   * Calls authenticate() on the agent instance for each auth method that needs handling.
   */
  async handleIfNeeded(
    agentInstance: { authenticate(methodId: string): Promise<void> },
    caps: AgentCapabilities,
  ): Promise<void> {
    if (!caps.authMethods || caps.authMethods.length === 0) {
      return;
    }

    for (const method of caps.authMethods) {
      if (method.type === "agent") {
        // Agent-managed auth — trigger authentication flow
        await agentInstance.authenticate("agent");
      }
      // Other auth types (env_var, terminal) are handled by the agent itself
      // or by the environment — no explicit call needed from our side
    }
  }
}
