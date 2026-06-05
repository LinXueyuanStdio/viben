/**
 * Doctor check: Tunnel — verifies tunnel provider binary availability and
 * port configuration when tunneling is enabled. Currently supports Cloudflare
 * tunnel (cloudflared). Missing binary is auto-fixable via download.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { execFileSync } from "node:child_process";
import type { DoctorCheck, CheckResult } from "../types.js";

export const tunnelCheck: DoctorCheck = {
  name: "Tunnel",
  order: 8,
  async run(ctx) {
    const results: CheckResult[] = [];

    if (!ctx.config) {
      results.push({ status: "fail", message: "Cannot check tunnel — config not loaded" });
      return results;
    }

    // Read tunnel settings from plugin settings (tunnel migrated out of config.json)
    const { SettingsManager } = await import("../../plugin/settings-manager.js");
    const sm = new SettingsManager(path.join(ctx.pluginsDir, "data"));
    const tunnelSettings = await sm.loadSettings("@viben/tunnel");
    const tunnelEnabled = (tunnelSettings.enabled as boolean) ?? false;
    const provider = (tunnelSettings.provider as string) ?? "cloudflare";
    const tunnelPort = (tunnelSettings.port as number) ?? 3100;

    if (!tunnelEnabled) {
      results.push({ status: "pass", message: "Tunnel not enabled (skipped)" });
      return results;
    }

    results.push({ status: "pass", message: `Tunnel provider: ${provider}` });

    if (provider === "cloudflare") {
      const binName = os.platform() === "win32" ? "cloudflared.exe" : "cloudflared";
      const binPath = path.join(ctx.dataDir, "bin", binName);
      let found = false;
      if (fs.existsSync(binPath)) {
        found = true;
      } else {
        try {
          execFileSync("which", ["cloudflared"], { stdio: "pipe" });
          found = true;
        } catch {
          // not found
        }
      }

      if (found) {
        results.push({ status: "pass", message: "cloudflared binary found" });
      } else {
        results.push({
          status: "warn",
          message: "cloudflared binary not found",
          fixable: true,
          fixRisk: "safe",
          fix: async () => {
            try {
              const { ensureCloudflared } = await import("../../../plugins/tunnel/providers/install-cloudflared.js");
              await ensureCloudflared();
              return { success: true, message: "installed cloudflared" };
            } catch (err) {
              return { success: false, message: err instanceof Error ? err.message : String(err) };
            }
          },
        });
      }
    }

    // tunnelPort already set from plugin settings above
    if (tunnelPort < 1 || tunnelPort > 65535) {
      results.push({ status: "fail", message: `Invalid tunnel port: ${tunnelPort}` });
    } else {
      results.push({ status: "pass", message: `Tunnel port: ${tunnelPort}` });
    }

    return results;
  },
};
