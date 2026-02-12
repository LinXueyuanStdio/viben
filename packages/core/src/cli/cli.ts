/**
 * Viben CLI main program
 */
import { Command } from "commander";
import { registerCommands } from "./commands";

// Read version from package.json at build time
const VERSION = "1.0.0";

/**
 * Create the CLI program
 */
export function createProgram(): Command {
  const program = new Command();

  program
    .name("viben")
    .description("Viben - AI Agent Orchestration Platform")
    .version(VERSION, "-v, --version", "Output the version number");

  // Global options
  program
    .option("--json", "Output in JSON format")
    .option("--verbose", "Verbose output")
    .option("--quiet", "Minimal output")
    .option("--global", "Use global config instead of workspace");

  // Register all commands
  registerCommands(program);

  return program;
}

/**
 * Run the CLI
 */
export async function run(args: string[] = process.argv): Promise<void> {
  const program = createProgram();
  await program.parseAsync(args);
}
