/**
 * Doctor check: Agents — verifies configured agents are installed and
 * their commands are accessible via PATH or local node_modules/.bin.
 * Missing the default agent is a "fail"; missing optional agents are "warn".
 */

import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import type { DoctorCheck, CheckResult } from "../types.js";

/** Checks PATH first, then walks up the directory tree looking for node_modules/.bin. */
function commandExists(cmd: string): boolean {
  try {
    execFileSync("which", [cmd], { stdio: "pipe" });
    return true;
  } catch {
    // not in PATH — fall through to node_modules check
  }
  let dir = process.cwd();
  while (true) {
    const binPath = path.join(dir, "node_modules", ".bin", cmd);
    if (fs.existsSync(binPath)) return true;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return false;
}

export const agentsCheck: DoctorCheck = {
  name: "Agents",
  order: 2,
  async run(ctx) {
    const results: CheckResult[] = [];
    if (!ctx.config) {
      results.push({ status: "fail", message: "Cannot check agents — config not loaded" });
      return results;
    }

    const defaultAgent = ctx.config.defaultAgent;

    // Read agents from agents.json (agents were migrated out of config.json)
    let agents: Record<string, { command: string }> = {};
    try {
      const agentsPath = path.join(ctx.dataDir, "agents.json");
      if (fs.existsSync(agentsPath)) {
        const data = JSON.parse(fs.readFileSync(agentsPath, "utf-8"));
        agents = data.installed ?? {};
      }
    } catch { /* proceed with empty agents */ }

    if (!agents[defaultAgent]) {
      results.push({
        status: "fail",
        message: `Default agent "${defaultAgent}" not found in agents config`,
      });
    }

    for (const [name, agent] of Object.entries(agents)) {
      const isDefault = name === defaultAgent;
      const agentEntry = agent as { command?: string };
      const agentCommand = agentEntry.command ?? name;
      if (commandExists(agentCommand)) {
        results.push({
          status: "pass",
          message: `${agentCommand} found${isDefault ? " (default)" : ""}`,
        });
      } else {
        results.push({
          status: isDefault ? "fail" : "warn",
          message: `${agentCommand} not found in PATH${isDefault ? " (default agent!)" : ""}`,
        });
      }
    }

    return results;
  },
};
