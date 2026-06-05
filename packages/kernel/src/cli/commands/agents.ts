import { wantsHelp } from './helpers.js'
import { isJsonMode, jsonSuccess, jsonError, ErrorCodes, muteForJson } from '../output.js'

/** Create an AgentCatalog bound to the given instance root for install/list operations. */
async function createCatalog(instanceRoot: string) {
  const { AgentCatalog } = await import("../../core/agents/agent-catalog.js");
  const { AgentStore } = await import("../../core/agents/agent-store.js");
  const pathMod = await import('node:path');
  const store = new AgentStore(pathMod.join(instanceRoot, 'agents.json'));
  return new AgentCatalog(store, pathMod.join(instanceRoot, 'registry-cache.json'), pathMod.join(instanceRoot, 'agents'));
}

/**
 * `viben agents` — Browse, install, uninstall, and inspect AI coding agents.
 *
 * Dispatches to subcommands: install, uninstall, info, run, list, refresh.
 * Uses fuzzy matching (suggestMatch) to hint at the correct subcommand on typos.
 */
export async function cmdAgents(args: string[], instanceRoot?: string): Promise<void> {
  const subcommand = args[0];

  if (wantsHelp(args) && (!subcommand || subcommand === '--help' || subcommand === '-h')) {
    console.log(`
\x1b[1mviben agents\x1b[0m — Manage AI coding agents

\x1b[1mUsage:\x1b[0m
  viben agents                       Browse all agents (installed + available)
  viben agents install <name>        Install an agent from the ACP Registry
  viben agents uninstall <name>      Remove an installed agent
  viben agents info <name>           Show details, dependencies & setup guide
  viben agents run <name> [-- args]  Run agent CLI directly (login, config...)
  viben agents refresh               Force-refresh agent list from registry

\x1b[1mOptions:\x1b[0m
  --json                                 Output result as JSON
  -h, --help                           Show this help message

\x1b[1mExamples:\x1b[0m
  viben agents install gemini           Install Gemini CLI
  viben agents run gemini               Login to Google (first run)
  viben agents info cursor              See setup instructions

\x1b[2mRun 'viben agents <command> --help' for more info on a subcommand.\x1b[0m
`)
    return;
  }

  // Extract positional argument (first non-flag after subcommand)
  const positional = args.slice(1).find(a => !a.startsWith('-'));

  switch (subcommand) {
    case "install":
      return agentsInstall(positional, args.includes("--force"), wantsHelp(args), instanceRoot, isJsonMode(args));
    case "uninstall":
      return agentsUninstall(positional, wantsHelp(args), instanceRoot, isJsonMode(args));
    case "refresh":
      if (wantsHelp(args)) {
        console.log(`
\x1b[1mviben agents refresh\x1b[0m — Force-refresh agent list from registry

\x1b[1mUsage:\x1b[0m
  viben agents refresh

Fetches the latest agent catalog from the ACP Registry,
bypassing the normal staleness check.
`)
        return;
      }
      return agentsRefresh(instanceRoot);
    case "info":
      return agentsInfo(positional, wantsHelp(args), instanceRoot, isJsonMode(args));
    case "run":
      return agentsRun(args[1], args.slice(2), wantsHelp(args), instanceRoot);
    case "list":
    case undefined:
      return agentsList(instanceRoot, args.includes("--json"));
    default: {
      const { suggestMatch } = await import('../suggest.js');
      const agentSubcommands = ["install", "uninstall", "refresh", "info", "run", "list"];
      const suggestion = suggestMatch(subcommand, agentSubcommands);
      console.error(`Unknown agents command: ${subcommand}`);
      if (suggestion) console.error(`Did you mean: ${suggestion}?`);
      console.error(`\nRun 'viben agents' to see available agents.`);
      process.exit(1);
    }
  }
}

async function agentsList(instanceRoot?: string, json = false): Promise<void> {
  if (json) await muteForJson()
  const catalog = await createCatalog(instanceRoot!);
  catalog.load();
  await catalog.refreshRegistryIfStale();

  const items = catalog.getAvailable();

  if (json) {
    jsonSuccess({
      agents: items.map((item) => ({
        key: item.key,
        name: item.name,
        version: item.version,
        distribution: item.distribution,
        description: item.description ?? "",
        installed: item.installed,
        available: item.available ?? true,
        missingDeps: item.missingDeps ?? [],
      })),
    });
  }

  const installed = items.filter((i) => i.installed);
  const available = items.filter((i) => !i.installed);

  console.log("");
  if (installed.length > 0) {
    console.log("  \x1b[1mInstalled agents:\x1b[0m\n");
    for (const item of installed) {
      const deps = item.missingDeps?.length
        ? `  \x1b[33m(needs: ${item.missingDeps.join(", ")})\x1b[0m`
        : "";
      console.log(
        `  \x1b[32m✓\x1b[0m ${item.key.padEnd(18)} ${item.name.padEnd(22)} v${item.version.padEnd(10)} ${item.distribution}${deps}`,
      );
      if (item.description) {
        console.log(`    \x1b[2m${item.description}\x1b[0m`);
      }
    }
    console.log("");
  }

  if (available.length > 0) {
    console.log("  \x1b[1mAvailable to install:\x1b[0m\n");
    for (const item of available) {
      const icon = item.available ? "\x1b[2m⬇\x1b[0m" : "\x1b[33m⚠\x1b[0m";
      const deps = item.missingDeps?.length
        ? `  \x1b[33m(needs: ${item.missingDeps.join(", ")})\x1b[0m`
        : "";
      console.log(
        `  ${icon} ${item.key.padEnd(18)} ${item.name.padEnd(22)} v${item.version.padEnd(10)} ${item.distribution}${deps}`,
      );
      if (item.description) {
        console.log(`    \x1b[2m${item.description}\x1b[0m`);
      }
    }
    console.log("");
  }

  console.log(
    `  \x1b[2mInstall an agent: viben agents install <name>\x1b[0m`,
  );
  console.log("");
}

/**
 * Install an agent from the ACP Registry. After installation, automatically installs
 * the handoff integration if the agent supports it, and prints any setup steps.
 */
async function agentsInstall(nameOrId: string | undefined, force: boolean, help = false, instanceRoot?: string, json = false): Promise<void> {
  if (json) await muteForJson()

  if (!json && (help || !nameOrId)) {
    console.log(`
\x1b[1mviben agents install\x1b[0m — Install an agent from the ACP Registry

\x1b[1mUsage:\x1b[0m
  viben agents install <name> [--force]

\x1b[1mArguments:\x1b[0m
  <name>          Agent name or ID (e.g. claude, gemini, copilot)

\x1b[1mOptions:\x1b[0m
  --force         Reinstall even if already installed
  --json          Output result as JSON
  -h, --help      Show this help message

\x1b[1mExamples:\x1b[0m
  viben agents install claude
  viben agents install gemini --force

Run 'viben agents' to see available agents.
`)
    return;
  }

  if (!nameOrId) {
    if (json) jsonError(ErrorCodes.MISSING_ARGUMENT, 'Agent name is required')
    return
  }

  const catalog = await createCatalog(instanceRoot!);
  catalog.load();
  await catalog.refreshRegistryIfStale();

  const progress: import("../../core/types.js").InstallProgress = json ? {
    onStart() {},
    onStep() {},
    onDownloadProgress() {},
    onSuccess() {},
    onError() {},
  } : {
    onStart(_id, name) {
      process.stdout.write(`\n  ⏳ Installing ${name}...\n`);
    },
    onStep(step) {
      process.stdout.write(`  \x1b[32m✓\x1b[0m ${step}\n`);
    },
    onDownloadProgress(percent) {
      const filled = Math.round(percent / 5);
      const empty = 20 - filled;
      const bar = "█".repeat(filled) + "░".repeat(empty);
      process.stdout.write(`\r  ${bar} ${String(percent).padStart(3)}%`);
      if (percent >= 100) process.stdout.write("\n");
    },
    onSuccess(name) {
      console.log(`\n  \x1b[32m✓ ${name} installed successfully!\x1b[0m\n`);
    },
    onError(error) {
      console.log(`\n  \x1b[31m✗ ${error}\x1b[0m\n`);
    },
  };

  const result = await catalog.install(nameOrId, progress, force);
  if (!result.ok) {
    if (json) jsonError(ErrorCodes.INSTALL_FAILED, result.error ?? 'Installation failed')
    if (result.error?.includes('not found')) {
      const { suggestMatch } = await import('../suggest.js');
      const allKeys = catalog.getAvailable().map((a) => a.key);
      const suggestion = suggestMatch(nameOrId, allKeys);
      if (suggestion) console.log(`  Did you mean: ${suggestion}?`);
    }
    process.exit(1);
  }

  if (json) {
    const installed = catalog.getInstalledAgent(result.agentKey)
    jsonSuccess({ key: result.agentKey, version: installed?.version ?? 'unknown', installed: true })
  }

  // Auto-integrate handoff if agent supports it
  const { getAgentCapabilities } = await import("../../core/agents/agent-dependencies.js");
  const caps = getAgentCapabilities(result.agentKey);
  if (caps.integration) {
    const { installIntegration } = await import("../integrate.js");
    const intResult = await installIntegration(result.agentKey, caps.integration);
    if (intResult.success) {
      console.log(`  \x1b[32m✓\x1b[0m Handoff integration installed for ${result.agentKey}`);
    } else {
      console.log(`  \x1b[33m⚠ Handoff integration failed: ${intResult.logs[intResult.logs.length - 1] ?? "unknown error"}\x1b[0m`);
    }
  }

  // Show setup steps if any
  if (result.setupSteps?.length) {
    console.log("  \x1b[1mNext steps to get started:\x1b[0m\n");
    for (const step of result.setupSteps) {
      console.log(`  → ${step}`);
    }
    console.log(`\n  \x1b[2mRun 'viben agents info ${result.agentKey}' for more details.\x1b[0m\n`);
  }
}

async function agentsUninstall(name: string | undefined, help = false, instanceRoot?: string, json = false): Promise<void> {
  if (json) await muteForJson()

  if (!json && (help || !name)) {
    console.log(`
\x1b[1mviben agents uninstall\x1b[0m — Remove an installed agent

\x1b[1mUsage:\x1b[0m
  viben agents uninstall <name>

\x1b[1mArguments:\x1b[0m
  <name>          Agent name to remove

\x1b[1mOptions:\x1b[0m
  --json          Output result as JSON
  -h, --help      Show this help message

\x1b[1mExamples:\x1b[0m
  viben agents uninstall gemini
`)
    return;
  }

  if (!name) {
    if (json) jsonError(ErrorCodes.MISSING_ARGUMENT, 'Agent name is required')
    return
  }

  const catalog = await createCatalog(instanceRoot!);
  catalog.load();

  const result = await catalog.uninstall(name);
  if (result.ok) {
    // Auto-uninstall handoff integration if exists
    const { getAgentCapabilities } = await import("../../core/agents/agent-dependencies.js");
    const caps = getAgentCapabilities(name);
    if (caps.integration) {
      const { uninstallIntegration } = await import("../integrate.js");
      await uninstallIntegration(name, caps.integration);
      console.log(`  \x1b[32m✓\x1b[0m Handoff integration removed for ${name}`);
    }
    if (json) jsonSuccess({ key: name, uninstalled: true })
    console.log(`\n  \x1b[32m✓ ${name} removed.\x1b[0m\n`);
  } else {
    if (json) jsonError(ErrorCodes.UNINSTALL_FAILED, result.error ?? 'Uninstall failed')
    console.log(`\n  \x1b[31m✗ ${result.error}\x1b[0m`);
    if (result.error?.includes('not installed')) {
      const { suggestMatch } = await import('../suggest.js');
      const installedKeys = Object.keys(catalog.getInstalledEntries());
      const suggestion = suggestMatch(name, installedKeys);
      if (suggestion) console.log(`  Did you mean: ${suggestion}?`);
    }
    console.log();
  }
}

async function agentsRefresh(instanceRoot?: string): Promise<void> {
  const catalog = await createCatalog(instanceRoot!);
  catalog.load();
  console.log("\n  Updating agent list...");
  await catalog.fetchRegistry();
  console.log("  \x1b[32m✓ Agent list updated.\x1b[0m\n");
}

async function agentsInfo(nameOrId: string | undefined, help = false, instanceRoot?: string, json = false): Promise<void> {
  if (json) await muteForJson()

  if (!json && (help || !nameOrId)) {
    console.log(`
\x1b[1mviben agents info\x1b[0m — Show agent details, dependencies & setup guide

\x1b[1mUsage:\x1b[0m
  viben agents info <name>

\x1b[1mArguments:\x1b[0m
  <name>          Agent name or ID

Shows version, distribution type, command, setup steps, and
whether the agent is installed or available from the registry.

\x1b[1mOptions:\x1b[0m
  --json          Output result as JSON
  -h, --help      Show this help message

\x1b[1mExamples:\x1b[0m
  viben agents info claude
  viben agents info cursor
`)
    return;
  }

  if (!nameOrId) {
    if (json) jsonError(ErrorCodes.MISSING_ARGUMENT, 'Agent name is required')
    return
  }

  const catalog = await createCatalog(instanceRoot!);
  catalog.load();

  const { getAgentSetup } = await import("../../core/agents/agent-dependencies.js");

  const installed = catalog.getInstalledAgent(nameOrId);
  if (installed) {
    if (json) {
      jsonSuccess({
        key: installed.registryId ?? nameOrId,
        name: installed.name,
        version: installed.version,
        distribution: installed.distribution,
        installed: true,
        command: installed.command,
        binaryPath: installed.binaryPath ?? null,
        registryId: installed.registryId ?? null,
      })
    }
    console.log(`\n  \x1b[1m${installed.name}\x1b[0m`);
    console.log(`  Version:      ${installed.version}`);
    console.log(`  Type:         ${installed.distribution}`);
    console.log(`  Command:      ${installed.command} ${installed.args.join(" ")}`);
    console.log(`  Installed:    ${new Date(installed.installedAt).toLocaleDateString()}`);
    if (installed.binaryPath) console.log(`  Binary path:  ${installed.binaryPath}`);

    const setup = installed.registryId ? getAgentSetup(installed.registryId) : undefined;
    if (setup) {
      console.log(`\n  \x1b[1mSetup:\x1b[0m`);
      for (const step of setup.setupSteps) {
        console.log(`  → ${step}`);
      }
    }

    console.log(`\n  Run agent CLI:  viben agents run ${nameOrId} -- <args>`);
    console.log("");
    return;
  }

  const regAgent = catalog.findRegistryAgent(nameOrId);
  if (regAgent) {
    if (json) {
      jsonSuccess({
        key: regAgent.id,
        name: regAgent.name,
        version: regAgent.version,
        description: regAgent.description ?? '',
        installed: false,
      })
    }
    const availability = catalog.checkAvailability(nameOrId);
    console.log(`\n  \x1b[1m${regAgent.name}\x1b[0m \x1b[2m(not installed)\x1b[0m`);
    console.log(`  ${regAgent.description}`);
    console.log(`  Version:    ${regAgent.version}`);
    console.log(`  License:    ${regAgent.license ?? "unknown"}`);
    if (regAgent.website) console.log(`  Website:    ${regAgent.website}`);
    if (regAgent.repository) console.log(`  Source:     ${regAgent.repository}`);
    console.log(`  Available:  ${availability.available ? "\x1b[32mYes\x1b[0m" : `\x1b[33mNo\x1b[0m — ${availability.reason}`}`);

    const setup = getAgentSetup(regAgent.id);
    if (setup) {
      console.log(`\n  \x1b[1mSetup after install:\x1b[0m`);
      for (const step of setup.setupSteps) {
        console.log(`  → ${step}`);
      }
    }

    console.log(`\n  Install: viben agents install ${nameOrId}\n`);
    return;
  }

  if (json) jsonError(ErrorCodes.AGENT_NOT_FOUND, `"${nameOrId}" not found.`)
  const { suggestMatch } = await import('../suggest.js');
  const allKeys = catalog.getAvailable().map((a) => a.key);
  const suggestion = suggestMatch(nameOrId, allKeys);
  console.log(`\n  \x1b[31m"${nameOrId}" not found.\x1b[0m`);
  if (suggestion) console.log(`  Did you mean: ${suggestion}?`);
  console.log(`  Run 'viben agents' to see available agents.\n`);
}

async function agentsRun(nameOrId: string | undefined, extraArgs: string[], help = false, instanceRoot?: string): Promise<void> {
  if (help || !nameOrId) {
    console.log(`
\x1b[1mviben agents run\x1b[0m — Run agent CLI directly

\x1b[1mUsage:\x1b[0m
  viben agents run <name> [-- <args>]

\x1b[1mArguments:\x1b[0m
  <name>          Installed agent name
  <args>          Arguments to pass to the agent CLI

Use \x1b[1m--\x1b[0m to separate Viben flags from agent arguments.
ACP-specific flags are automatically stripped.

\x1b[1mExamples:\x1b[0m
  viben agents run gemini               Login to Google (first run)
  viben agents run copilot              Login to GitHub Copilot (first run)
  viben agents run cline                Setup API keys (first run)
`)
    return;
  }

  const catalog = await createCatalog(instanceRoot!);
  catalog.load();

  const installed = catalog.getInstalledAgent(nameOrId);
  if (!installed) {
    const { suggestMatch } = await import('../suggest.js');
    const installedKeys = Object.keys(catalog.getInstalledEntries());
    const suggestion = suggestMatch(nameOrId, installedKeys);
    console.log(`\n  \x1b[31m"${nameOrId}" is not installed.\x1b[0m`);
    if (suggestion) {
      console.log(`  Did you mean: ${suggestion}?`);
      console.log(`  Install first: viben agents install ${suggestion}\n`);
    } else {
      console.log(`  Install first: viben agents install ${nameOrId}\n`);
    }
    return;
  }

  // Strip leading "--" separator if present (convention to pass args through to the agent)
  const userArgs = extraArgs[0] === "--" ? extraArgs.slice(1) : extraArgs;

  const { spawnSync } = await import("node:child_process");
  const command = installed.command;

  // Include agent's base args (e.g., package name for npx) but strip ACP-specific flags
  // so running the agent interactively doesn't accidentally enable ACP mode.
  const acpFlags = new Set(["--acp", "acp", "--acp=true", "--experimental-skills"]);
  const baseArgs: string[] = [];
  for (let i = 0; i < installed.args.length; i++) {
    const arg = installed.args[i]!;
    // Skip standalone ACP flags
    if (acpFlags.has(arg)) continue;
    // Skip "--output-format acp" pair (factory-droid pattern)
    if (arg === "--output-format" && installed.args[i + 1] === "acp") { i++; continue; }
    // Skip "exec" subcommand used only in ACP mode (factory-droid)
    if (arg === "exec" && installed.args[i + 1] === "--output-format") continue;
    baseArgs.push(arg);
  }
  const fullArgs = [...baseArgs, ...userArgs];

  console.log(`\n  Running: ${command} ${fullArgs.join(" ")}\n`);

  const result = spawnSync(command, fullArgs, {
    stdio: "inherit",
    env: { ...process.env, ...installed.env },
    cwd: process.cwd(),
  });

  if (result.status !== null && result.status !== 0) {
    process.exit(result.status);
  }
}
