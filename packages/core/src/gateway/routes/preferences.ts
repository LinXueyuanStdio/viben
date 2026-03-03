/**
 * Preferences routes
 *
 * Provides HTTP API for managing user preferences stored in ~/.viben/config.yaml
 * This includes IDE preferences, terminal preferences, and other developer settings.
 */
import type { FastifyInstance } from "fastify";
import { gitConfigManager } from "../../config/manager";

// ============================================================================
// Types
// ============================================================================

/**
 * Developer preferences configuration
 */
export interface DeveloperPreferences {
  /** Preferred IDE for opening files */
  preferred_ide?: string;
  /** Preferred terminal application */
  preferred_terminal?: string;
  /** Skip permission prompts (dangerous) */
  dangerously_skip_permissions?: boolean;
}

/**
 * Full preferences response
 */
export interface PreferencesResponse {
  developer: DeveloperPreferences;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Load developer preferences from config
 */
async function loadDeveloperPreferences(): Promise<DeveloperPreferences> {
  const preferredIDE = await gitConfigManager.get("developer.preferred_ide", { global: true });
  const preferredTerminal = await gitConfigManager.get("developer.preferred_terminal", { global: true });
  const dangerouslySkipPermissions = await gitConfigManager.get("developer.dangerously_skip_permissions", { global: true });

  return {
    preferred_ide: preferredIDE as string | undefined,
    preferred_terminal: preferredTerminal as string | undefined,
    dangerously_skip_permissions: dangerouslySkipPermissions as boolean | undefined,
  };
}

/**
 * Save developer preferences to config
 */
async function saveDeveloperPreferences(prefs: DeveloperPreferences): Promise<void> {
  if (prefs.preferred_ide !== undefined) {
    await gitConfigManager.set("developer.preferred_ide", prefs.preferred_ide, { global: true });
  }
  if (prefs.preferred_terminal !== undefined) {
    await gitConfigManager.set("developer.preferred_terminal", prefs.preferred_terminal, { global: true });
  }
  if (prefs.dangerously_skip_permissions !== undefined) {
    await gitConfigManager.set("developer.dangerously_skip_permissions", prefs.dangerously_skip_permissions, { global: true });
  }
}

// ============================================================================
// Routes
// ============================================================================

export function registerPreferencesRoutes(fastify: FastifyInstance): void {
  /**
   * Get all preferences
   * GET /api/preferences
   */
  fastify.get("/api/preferences", async () => {
    const developer = await loadDeveloperPreferences();
    return { developer };
  });

  /**
   * Update all preferences
   * PUT /api/preferences
   */
  fastify.put<{
    Body: Partial<PreferencesResponse>;
  }>("/api/preferences", async (request) => {
    const { developer } = request.body;

    if (developer) {
      await saveDeveloperPreferences(developer);
    }

    // Return updated preferences
    const updatedDeveloper = await loadDeveloperPreferences();
    return { developer: updatedDeveloper };
  });

  /**
   * Get developer preferences
   * GET /api/preferences/developer
   */
  fastify.get("/api/preferences/developer", async () => {
    return await loadDeveloperPreferences();
  });

  /**
   * Update developer preferences
   * PATCH /api/preferences/developer
   */
  fastify.patch<{
    Body: Partial<DeveloperPreferences>;
  }>("/api/preferences/developer", async (request) => {
    await saveDeveloperPreferences(request.body);
    return await loadDeveloperPreferences();
  });

  /**
   * Get preferred IDE
   * GET /api/preferences/developer/ide
   */
  fastify.get("/api/preferences/developer/ide", async () => {
    const preferredIDE = await gitConfigManager.get("developer.preferred_ide", { global: true });
    return { preferred_ide: preferredIDE as string | undefined ?? "vscode" };
  });

  /**
   * Set preferred IDE
   * PUT /api/preferences/developer/ide
   */
  fastify.put<{
    Body: { preferred_ide: string };
  }>("/api/preferences/developer/ide", async (request) => {
    const { preferred_ide } = request.body;
    await gitConfigManager.set("developer.preferred_ide", preferred_ide, { global: true });
    return { preferred_ide };
  });

  /**
   * Get preferred terminal
   * GET /api/preferences/developer/terminal
   */
  fastify.get("/api/preferences/developer/terminal", async () => {
    const preferredTerminal = await gitConfigManager.get("developer.preferred_terminal", { global: true });
    return { preferred_terminal: preferredTerminal as string | undefined ?? "system" };
  });

  /**
   * Set preferred terminal
   * PUT /api/preferences/developer/terminal
   */
  fastify.put<{
    Body: { preferred_terminal: string };
  }>("/api/preferences/developer/terminal", async (request) => {
    const { preferred_terminal } = request.body;
    await gitConfigManager.set("developer.preferred_terminal", preferred_terminal, { global: true });
    return { preferred_terminal };
  });
}
