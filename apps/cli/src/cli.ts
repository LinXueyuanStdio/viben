/**
 * Viben CLI - Commander.js Setup
 */

import { Command } from "commander";

// Create the main CLI program
export const cli = new Command();

cli
  .name("viben")
  .description("Viben CLI - Multi-agent command line interface")
  .version("0.1.0");

// Global options
cli
  .option("--json", "Output as JSON (for Agent parsing)")
  .option("-g, --global", "Use global config")
  .option("--workspace", "Use workspace config (current directory)")
  .option("-n, --name <id>", "Specify agent name/ID", "main")
  .option("-v, --verbose", "Verbose output")
  .option("-q, --quiet", "Suppress non-essential output");

// === Commands ===

// viben init
cli
  .command("init")
  .description("Initialize workspace in current directory")
  .option("--from <template>", "Initialize from template")
  .action(async (options) => {
    const { init } = await import("./commands/init.js");
    await init(options, cli.opts());
  });

// viben config
cli
  .command("config")
  .description("Configuration management (git-style)")
  .argument("[action]", "Action: get, set, list, edit, unset")
  .argument("[key]", "Config key (dot notation)")
  .argument("[value]", "Config value (for set)")
  .option("--show-origin", "Show config file origin")
  .action(async (action, key, value, options) => {
    const { config } = await import("./commands/config.js");
    await config(action, key, value, options, cli.opts());
  });

// viben version
cli
  .command("version")
  .description("Show version info")
  .action(() => {
    console.log("viben version 0.1.0");
  });

// Export for testing
export default cli;
