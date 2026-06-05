import { createChildLogger } from "../core/utils/log.js";
import { commandExists } from "../core/agents/agent-dependencies.js";
import type { Config } from "../core/config/config.js";
import type { InstanceContext } from "../core/instance/instance-context.js";

const log = createChildLogger({ module: "post-upgrade" });

/**
 * Run dependency and integration health checks after each start.
 *
 * Checks are best-effort: each section is wrapped in a try/catch so a failure in
 * one check never blocks the daemon from starting. All checks are read-only unless
 * auto-install is triggered (e.g., cloudflared, jq). Silent when everything is OK.
 *
 * Checks performed:
 * 1. Tunnel provider binary (cloudflared auto-install, or warn for others)
 * 2. Claude CLI integration + jq (warns if handoff is installed but jq is missing)
 * 3. unzip (needed for binary agent distribution installs)
 * 4. uvx (needed for Python-based agents via uv)
 */
export async function runPostUpgradeChecks(config: Config, ctx?: InstanceContext): Promise<void> {
  // 1. Tunnel provider binary — read from plugin settings (tunnel migrated out of config.json)
  try {
    const { SettingsManager } = await import("../core/plugin/settings-manager.js");
    const pluginsDataPath = ctx!.paths.pluginsData;
    const sm = new SettingsManager(pluginsDataPath);
    const tunnelSettings = await sm.loadSettings("@viben/tunnel");
    const tunnelEnabled = (tunnelSettings.enabled as boolean) ?? false;
    const tunnelProvider = (tunnelSettings.provider as string) ?? "cloudflare";

    if (tunnelEnabled) {
      if (tunnelProvider === "cloudflare") {
        try {
          const { ensureCloudflared } = await import(
            "../plugins/tunnel/providers/install-cloudflared.js"
          );
          await ensureCloudflared();
        } catch (err) {
          log.warn(
            { err: (err as Error).message },
            "Could not install cloudflared. Tunnel may not work.",
          );
        }
      } else {
        if (!commandExists(tunnelProvider)) {
          log.warn(
            `Tunnel provider "${tunnelProvider}" is not installed. Install it or switch to cloudflare (free, auto-installed).`,
          );
        }
      }
    }
  } catch {
    // tunnel settings not available — skip tunnel check
  }

  // 2. Claude CLI integration + jq
  try {
    const { getIntegration } = await import("./integrate.js");
    const integration = getIntegration("claude");
    if (integration) {
      const allInstalled = integration.items.every((item) => item.isInstalled());
      if (!allInstalled) {
        log.info(
          'Claude CLI integration not installed. Run "viben integrate claude" for session transfer + tunnel skill.',
        );
      }

      const handoff = integration.items.find((i) => i.id === "handoff");
      if (handoff?.isInstalled() && !commandExists("jq")) {
        try {
          const { ensureJq } = await import("../core/utils/install-jq.js");
          await ensureJq();
        } catch (err) {
          log.warn(
            { err: (err as Error).message },
            "Could not install jq. Handoff hooks may not work.",
          );
        }
      }
    }
  } catch {
    // integrate module not available — skip
  }

  // 3. unzip (needed for binary agent installs)
  if (!commandExists("unzip")) {
    log.warn(
      "unzip is not installed. Some agent installations (binary distribution) may fail. Install: brew install unzip (macOS) or apt install unzip (Linux)",
    );
  }

  // 4. uvx (needed for Python-based agents)
  try {
    const { AgentStore } = await import("../core/agents/agent-store.js");
    const store = new AgentStore(ctx!.paths.agents);
    store.load();
    const entries = store.getInstalled();
    const hasUvxAgent = Object.values(entries).some(
      (a: { distribution?: string }) => a.distribution === "uvx",
    );
    if (hasUvxAgent && !commandExists("uvx")) {
      log.warn(
        "uvx is not installed but you have Python-based agents. Install: pip install uv",
      );
    }
  } catch {
    // skip
  }
}
