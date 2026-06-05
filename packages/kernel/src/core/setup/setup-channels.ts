/**
 * Channel configuration step — manages messaging platform setup
 * (Telegram, Discord, Desktop App) via plugin install/configure hooks.
 */

import * as clack from "@clack/prompts";
import type { Config } from "../config/config.js";
import type { SettingsManager } from "../plugin/settings-manager.js";
import type { ConfiguredChannelAction, ChannelId, ChannelStatus } from "./types.js";
import { CHANNEL_META } from "./types.js";
import { guardCancel, ok, c } from "./helpers.js";

// Maps logical channel ID → plugin name used for settings storage and dynamic import.
// Telegram is built-in, so it uses a direct import path instead of this map.
const CHANNEL_PLUGIN_NAME: Record<string, string> = {
  discord: "@viben/discord-adapter",
};

/**
 * Reads the current configuration status of all known channels by
 * checking plugin settings for required credentials.
 */
export async function getChannelStatuses(config: Config, settingsManager?: SettingsManager): Promise<ChannelStatus[]> {
  const statuses: ChannelStatus[] = [];

  for (const [id, meta] of Object.entries(CHANNEL_META) as [ChannelId, typeof CHANNEL_META[ChannelId]][]) {
    let configured = false;
    let enabled = false;
    let hint: string | undefined;

    // Read channel status from plugin settings (channels migrated out of config.json)
    if (settingsManager && id === "telegram") {
      const ps = await settingsManager.loadSettings("@viben/telegram");
      if (ps.botToken && ps.chatId) {
        configured = true;
        enabled = ps.enabled !== false; // enabled by default when configured
        hint = `Chat ID: ${ps.chatId}`;
      }
    } else if (settingsManager && id === "discord") {
      const ps = await settingsManager.loadSettings("@viben/discord-adapter");
      if (ps.guildId || ps.token) {
        configured = true;
        enabled = ps.enabled !== false;
        hint = ps.guildId ? `Guild: ${ps.guildId}` : undefined;
      }
    }

    statuses.push({ id, label: meta.label, configured, enabled, hint });
  }

  return statuses;
}

/** Prints a formatted summary of all channel statuses to the console. */
export async function noteChannelStatus(config: Config, settingsManager?: SettingsManager): Promise<void> {
  const statuses = await getChannelStatuses(config, settingsManager);
  const lines = statuses.map((s) => {
    const status = s.enabled ? "enabled" : s.configured ? "disabled" : "not configured";
    const hintStr = s.hint ? ` — ${s.hint}` : "";
    return `  ${s.label}: ${status}${hintStr}`;
  });

  console.log("");
  console.log(`${c.bold}  Channel status${c.reset}`);
  for (const line of lines) console.log(line);
  console.log("");
}

async function promptConfiguredAction(label: string): Promise<ConfiguredChannelAction> {
  return guardCancel(
    await clack.select({
      message: `${label} already configured. What do you want to do?`,
      options: [
        { value: "modify" as const, label: "Modify settings" },
        { value: "disable" as const, label: "Disable bot" },
        { value: "delete" as const, label: "Delete config" },
        { value: "skip" as const, label: "Skip (leave as-is)" },
      ],
      initialValue: "modify" as const,
    }),
  );
}

/**
 * Delegates channel configuration to the plugin's install() or configure() hook.
 *
 * First-time setup calls install() for the full guided flow;
 * reconfiguration calls configure() for editing individual settings.
 */
async function configureViaPlugin(channelId: string, isConfigured: boolean, settingsManager?: SettingsManager): Promise<void> {
  // SSE (Desktop App) connects automatically; no user configuration needed.
  if (channelId === 'sse') return;

  let plugin: any;
  if (channelId === 'telegram') {
    const pluginModule = await import('../../plugins/telegram/index.js');
    plugin = pluginModule.default;
  } else {
    // Use the known plugin package name; fall back to scoped package name for unknown adapters.
    const packageName = CHANNEL_PLUGIN_NAME[channelId] ?? `@viben/${channelId}`;
    try {
      const pluginModule = await import(packageName);
      plugin = pluginModule.default;
    } catch (err) {
      console.log(`Could not load plugin "${packageName}": ${(err as Error).message}`);
      return;
    }
  }

  if (!plugin) {
    console.log(`Plugin for channel "${channelId}" did not export a valid default.`);
    return;
  }

  const { createInstallContext } = await import('../plugin/install-context.js');
  if (!settingsManager) {
    console.log(`Skipping ${channelId} configuration: no settings manager available.`);
    return;
  }
  const sm = settingsManager;
  const ctx = createInstallContext({
    pluginName: plugin.name,
    settingsManager: sm,
    basePath: sm.getBasePath(),
  });

  if (!isConfigured && plugin.install) {
    // First-time setup: run the full guided install flow
    await plugin.install(ctx);
  } else if (plugin.configure) {
    // Already configured: allow editing individual settings
    await plugin.configure(ctx);
  }
}

/**
 * Interactive channel management loop — lets users select a channel,
 * configure/modify/disable/delete it, then repeat until they choose "Finished".
 *
 * Channel credentials are stored in plugin settings (not config.json),
 * so changes here write to ~/.viben/plugins/data/<plugin>/settings.json.
 */
export async function configureChannels(config: Config, settingsManager?: SettingsManager): Promise<{ config: Config; changed: boolean }> {
  const next = structuredClone(config);
  let changed = false;

  await noteChannelStatus(next, settingsManager);

  while (true) {
    const statuses = await getChannelStatuses(next, settingsManager);
    const options = statuses.map((s) => {
      const status = s.enabled ? "enabled" : s.configured ? "disabled" : "not configured";
      return {
        value: s.id,
        label: `${s.label} (${CHANNEL_META[s.id].method})`,
        hint: status + (s.hint ? ` · ${s.hint}` : ""),
      };
    });

    const choice = guardCancel(
      await clack.select({
        message: "Select a channel",
        options: [
          ...options,
          { value: "__done__" as const, label: "Finished" },
        ],
      }),
    );

    if (choice === "__done__") break;

    const channelId = choice as ChannelId;
    const meta = CHANNEL_META[channelId];
    const statuses2 = await getChannelStatuses(next, settingsManager);
    const isConfigured = statuses2.find(s => s.id === channelId)?.configured ?? false;

    if (isConfigured) {
      const action = await promptConfiguredAction(meta.label);

      if (action === "skip") continue;
      const pluginName = CHANNEL_PLUGIN_NAME[channelId] ?? `@viben/${channelId}`;

      if (action === "disable") {
        // Disable via plugin settings (channels migrated out of config.json)
        if (settingsManager) {
          await settingsManager.updatePluginSettings(pluginName, { enabled: false });
        }
        changed = true;
        console.log(ok(`${meta.label} disabled`));
        continue;
      }
      if (action === "delete") {
        const confirmed = guardCancel(
          await clack.confirm({
            message: `Delete ${meta.label} config? This cannot be undone.`,
            initialValue: false,
          }),
        );
        if (confirmed) {
          // Clear plugin settings (channels migrated out of config.json)
          if (settingsManager) {
            await settingsManager.updatePluginSettings(pluginName, {});
          }
          changed = true;
          console.log(ok(`${meta.label} config deleted`));
        }
        continue;
      }
      // action === "modify" — fall through to plugin configure
    }

    // Run channel configuration via plugin install() or configure()
    await configureViaPlugin(channelId, isConfigured, settingsManager);
    changed = true;
  }

  return { config: next, changed };
}
