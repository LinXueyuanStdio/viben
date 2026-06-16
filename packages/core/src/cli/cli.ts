/**
 * Viben CLI main program
 */
import { Command } from "commander";
import { registerCommands } from "./commands";

// Injected by tsup at build time
declare const __VERSION__: string;
const VERSION = typeof __VERSION__ !== "undefined" ? __VERSION__ : "0.0.0-dev";

/**
 * Create the CLI program with lazy-loaded commands
 */
export async function createProgram(): Promise<Command> {
  const program = new Command();

  program
    .name("viben")
    .description("Viben - Agent Swarm × Code Evolution")
    .version(VERSION, "-v, --version", "Output the version number");

  // Global options
  program
    .option("--json", "Output in JSON format")
    .option("--verbose", "Verbose output")
    .option("--quiet", "Minimal output")
    .option("--global", "Use global config instead of workspace");

  // Register commands (lazy loaded based on argv)
  await registerCommands(program);

  return program;
}

/**
 * Run the CLI
 */
export async function run(args: string[] = process.argv): Promise<void> {
  const program = await createProgram();
  await program.parseAsync(args);
}
