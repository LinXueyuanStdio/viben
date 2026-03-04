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
 * Notification category types
 */
export type NotificationCategory =
  | "chat"
  | "group"
  | "cron"
  | "agent"
  | "system"
  | "task_complete"
  | "task_failed"
  | "review_needed";

/**
 * Notification delivery method
 */
export type NotificationMethod = "toast" | "system" | "both";

/**
 * Notification preferences configuration
 */
export interface NotificationPreferences {
  /** Master toggle for all notifications */
  enabled: boolean;
  /** Whether to play notification sounds */
  sound: boolean;
  /** Per-category toggles */
  categories: Record<NotificationCategory, boolean>;
  /** Notification method per category */
  methods: Record<NotificationCategory, NotificationMethod>;
  /** Do not disturb settings */
  do_not_disturb: {
    enabled: boolean;
    /** Start time in 24h format (e.g., "22:00") */
    start: string;
    /** End time in 24h format (e.g., "08:00") */
    end: string;
  };
  /** Number of days to retain notifications */
  retention_days: number;
}

/**
 * Default notification preferences
 */
const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  enabled: true,
  sound: true,
  categories: {
    chat: true,
    group: true,
    cron: true,
    agent: true,
    system: true,
    task_complete: true,
    task_failed: true,
    review_needed: true,
  },
  methods: {
    chat: "both",
    group: "both",
    cron: "both",
    agent: "both",
    system: "both",
    task_complete: "both",
    task_failed: "both",
    review_needed: "both",
  },
  do_not_disturb: {
    enabled: false,
    start: "22:00",
    end: "08:00",
  },
  retention_days: 30,
};

/**
 * Full preferences response
 */
export interface PreferencesResponse {
  developer: DeveloperPreferences;
  notifications?: NotificationPreferences;
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

/**
 * Load notification preferences from config
 */
async function loadNotificationPreferences(): Promise<NotificationPreferences> {
  const enabled = await gitConfigManager.get("notifications.enabled", { global: true });
  const sound = await gitConfigManager.get("notifications.sound", { global: true });
  const categoriesStr = await gitConfigManager.get("notifications.categories", { global: true });
  const methodsStr = await gitConfigManager.get("notifications.methods", { global: true });
  const dndEnabled = await gitConfigManager.get("notifications.do_not_disturb.enabled", { global: true });
  const dndStart = await gitConfigManager.get("notifications.do_not_disturb.start", { global: true });
  const dndEnd = await gitConfigManager.get("notifications.do_not_disturb.end", { global: true });
  const retentionDays = await gitConfigManager.get("notifications.retention_days", { global: true });

  // Parse categories and methods from JSON strings
  let categories = DEFAULT_NOTIFICATION_PREFERENCES.categories;
  let methods = DEFAULT_NOTIFICATION_PREFERENCES.methods;

  if (categoriesStr && typeof categoriesStr === "string") {
    try {
      categories = { ...DEFAULT_NOTIFICATION_PREFERENCES.categories, ...JSON.parse(categoriesStr) };
    } catch {
      // Use default
    }
  }

  if (methodsStr && typeof methodsStr === "string") {
    try {
      methods = { ...DEFAULT_NOTIFICATION_PREFERENCES.methods, ...JSON.parse(methodsStr) };
    } catch {
      // Use default
    }
  }

  return {
    enabled: enabled !== undefined ? Boolean(enabled) : DEFAULT_NOTIFICATION_PREFERENCES.enabled,
    sound: sound !== undefined ? Boolean(sound) : DEFAULT_NOTIFICATION_PREFERENCES.sound,
    categories,
    methods,
    do_not_disturb: {
      enabled: dndEnabled !== undefined ? Boolean(dndEnabled) : DEFAULT_NOTIFICATION_PREFERENCES.do_not_disturb.enabled,
      start: (dndStart as string | undefined) ?? DEFAULT_NOTIFICATION_PREFERENCES.do_not_disturb.start,
      end: (dndEnd as string | undefined) ?? DEFAULT_NOTIFICATION_PREFERENCES.do_not_disturb.end,
    },
    retention_days: retentionDays !== undefined ? Number(retentionDays) : DEFAULT_NOTIFICATION_PREFERENCES.retention_days,
  };
}

/**
 * Save notification preferences to config
 */
async function saveNotificationPreferences(prefs: Partial<NotificationPreferences>): Promise<void> {
  if (prefs.enabled !== undefined) {
    await gitConfigManager.set("notifications.enabled", prefs.enabled, { global: true });
  }
  if (prefs.sound !== undefined) {
    await gitConfigManager.set("notifications.sound", prefs.sound, { global: true });
  }
  if (prefs.categories !== undefined) {
    await gitConfigManager.set("notifications.categories", JSON.stringify(prefs.categories), { global: true });
  }
  if (prefs.methods !== undefined) {
    await gitConfigManager.set("notifications.methods", JSON.stringify(prefs.methods), { global: true });
  }
  if (prefs.do_not_disturb !== undefined) {
    if (prefs.do_not_disturb.enabled !== undefined) {
      await gitConfigManager.set("notifications.do_not_disturb.enabled", prefs.do_not_disturb.enabled, { global: true });
    }
    if (prefs.do_not_disturb.start !== undefined) {
      await gitConfigManager.set("notifications.do_not_disturb.start", prefs.do_not_disturb.start, { global: true });
    }
    if (prefs.do_not_disturb.end !== undefined) {
      await gitConfigManager.set("notifications.do_not_disturb.end", prefs.do_not_disturb.end, { global: true });
    }
  }
  if (prefs.retention_days !== undefined) {
    await gitConfigManager.set("notifications.retention_days", prefs.retention_days, { global: true });
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
    const notifications = await loadNotificationPreferences();
    return { developer, notifications };
  });

  /**
   * Update all preferences
   * PUT /api/preferences
   */
  fastify.put<{
    Body: Partial<PreferencesResponse>;
  }>("/api/preferences", async (request) => {
    const { developer, notifications } = request.body;

    if (developer) {
      await saveDeveloperPreferences(developer);
    }
    if (notifications) {
      await saveNotificationPreferences(notifications);
    }

    // Return updated preferences
    const updatedDeveloper = await loadDeveloperPreferences();
    const updatedNotifications = await loadNotificationPreferences();
    return { developer: updatedDeveloper, notifications: updatedNotifications };
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

  /**
   * Get notification preferences
   * GET /api/preferences/notifications
   */
  fastify.get("/api/preferences/notifications", async () => {
    return await loadNotificationPreferences();
  });

  /**
   * Update notification preferences
   * PATCH /api/preferences/notifications
   */
  fastify.patch<{
    Body: Partial<NotificationPreferences>;
  }>("/api/preferences/notifications", async (request) => {
    await saveNotificationPreferences(request.body);
    return await loadNotificationPreferences();
  });
}
