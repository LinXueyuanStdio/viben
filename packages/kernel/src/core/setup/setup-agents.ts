/**
 * Agent setup step — detects installed agents, offers additional installs
 * from the agent registry, and lets the user pick a default agent.
 */

import { execFileSync } from "node:child_process";
import * as clack from "@clack/prompts";
import { commandExists } from "../agents/agent-dependencies.js";
import { guardCancel, ok, warn, c } from "./helpers.js";

const KNOWN_AGENTS: Array<{ name: string; commands: string[] }> = [
  // claude-agent-acp is bundled as a dependency — no detection needed, but
  // kept here so detectAgents() still returns it for display purposes.
  { name: "claude", commands: ["claude-agent-acp"] },
  { name: "codex", commands: ["codex"] },
];

/**
 * Scans PATH and local node_modules for known agent commands.
 * Returns the first available command for each agent (priority order).
 */
export async function detectAgents(): Promise<
  Array<{ name: string; command: string }>
> {
  const found: Array<{ name: string; command: string }> = [];
  for (const agent of KNOWN_AGENTS) {
    // Find all available commands for this agent (PATH + node_modules/.bin)
    const available: string[] = [];
    for (const cmd of agent.commands) {
      if (commandExists(cmd)) {
        available.push(cmd);
      }
    }
    if (available.length > 0) {
      // Prefer claude-agent-acp over claude/claude-code (priority order)
      found.push({ name: agent.name, command: available[0] });
    }
  }
  return found;
}

/** Checks whether a command is available in the system PATH. */
export async function validateAgentCommand(command: string): Promise<boolean> {
  try {
    execFileSync("which", [command], { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Runs the agent installation and selection step of the setup wizard.
 *
 * Ensures Claude Agent is always available (bundled fallback), refreshes the
 * agent registry, offers installation of additional agents, and prompts for
 * a default agent when multiple are installed.
 *
 * @returns The key of the selected default agent (e.g. "claude")
 */
export async function setupAgents(instanceRoot?: string): Promise<{
  defaultAgent: string;
}> {
  const { AgentCatalog } = await import("../agents/agent-catalog.js");
  const { AgentStore } = await import("../agents/agent-store.js");
  const pathMod = await import("node:path");
  const { muteLogger, unmuteLogger } = await import("../utils/log.js");

  const root = instanceRoot!;
  const store = new AgentStore(pathMod.join(root, "agents.json"));

  muteLogger();
  const catalog = new AgentCatalog(store, pathMod.join(root, "registry-cache.json"), pathMod.join(root, "agents"));
  catalog.load();

  const s = clack.spinner();
  s.start("Checking available agents...");
  await catalog.refreshRegistryIfStale();

  // Claude is always pre-installed (bundled dependency)
  if (!catalog.getInstalledAgent("claude")) {
    const claudeRegistry = catalog.findRegistryAgent("claude-acp");
    const installed = claudeRegistry ? await catalog.install("claude-acp") : null;
    if (!installed?.ok) {
      // Fallback: register bundled claude-agent-acp directly into the catalog's
      // own store so it shows up in getAvailable() even when Claude CLI is absent.
      catalog.registerFallbackAgent("claude", {
        registryId: "claude-acp",
        name: "Claude Agent",
        version: "bundled",
        distribution: "npx",
        command: "npx",
        args: ["@agentclientprotocol/claude-agent-acp"],
        env: {},
        installedAt: new Date().toISOString(),
        binaryPath: null,
      });
    }
  }
  s.stop(ok("Claude Agent ready"));
  unmuteLogger();

  const available = catalog.getAvailable();
  const installed = available.filter((a) => a.installed);
  const installable = available.filter((a) => !a.installed && a.available);

  // Offer agent selection — show installed agents as pre-checked + installable agents
  if (installed.length > 0 || installable.length > 0) {
    // Deduplicate by key AND name
    const seen = new Set<string>();
    const options: Array<{ label: string; value: string }> = [];

    for (const a of installed) {
      const dedupeKey = `${a.key}::${a.name}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      options.push({
        label: `${a.name} (installed)`,
        value: a.key,
      });
    }
    for (const a of installable) {
      const dedupeKey = `${a.key}::${a.name}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      options.push({
        label: `${a.name} (${a.distribution})`,
        value: a.key,
      });
    }

    const installedKeys = installed.map(a => a.key);
    const selected = guardCancel(
      await clack.autocompleteMultiselect({
        message: "Install additional agents? (type to search, Space to select)",
        options,
        initialValues: installedKeys,
        required: false,
      }),
    ) as string[];

    for (const key of selected) {
      const regAgent = catalog.findRegistryAgent(key);
      if (regAgent) {
        const installSpinner = clack.spinner();
        installSpinner.start(`Installing ${regAgent.name}...`);
        muteLogger();
        const result = await catalog.install(key);
        unmuteLogger();
        if (result.ok) {
          installSpinner.stop(ok("done"));
        } else {
          installSpinner.stop(warn(`skipped: ${result.error}`));
        }
      }
    }
  }

  // Choose default agent
  const installedAgents = Object.keys(catalog.getInstalledEntries());
  let defaultAgent = "claude";

  if (installedAgents.length > 1) {
    defaultAgent = guardCancel(
      await clack.select({
        message: "Which agent should be the default?",
        options: installedAgents.map((key) => {
          const agent = catalog.getInstalledAgent(key)!;
          return { label: `${agent.name} (${key})`, value: key };
        }),
        initialValue: "claude",
      }),
    ) as string;
  }

  console.log(ok(`Default agent: ${c.bold}${defaultAgent}${c.reset}`));
  return { defaultAgent };
}
