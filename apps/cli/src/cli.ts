/**
 * Viben CLI - Commander.js setup
 */

import { Command } from 'commander';
import { createRequire } from 'module';
import { registerInitCommand } from './commands/init';
import { registerConfigCommand } from './commands/config';
import { registerAgentCommand } from './commands/agent';
import { registerCronCommand } from './commands/cron';
import { registerChannelCommand } from './commands/channel';
import { registerGatewayCommand } from './commands/gateway';
import { registerMcpCommand } from './commands/mcp';
import { registerSkillCommand } from './commands/skill';
import { registerProviderCommand } from './commands/provider';
import { registerModelCommand } from './commands/model';
import { registerWorkspaceCommand } from './commands/workspace';
import { registerServiceCommand } from './commands/service';

// Read version from package.json (using createRequire for ESM compatibility)
const require = createRequire(import.meta.url);
const packageJson = require('../package.json');

/**
 * Create and configure the CLI program
 */
export function createProgram(): Command {
  const program = new Command();

  program
    .name('viben')
    .description('Viben CLI - Orchestrate AI agent clusters in your local workspace')
    .version(packageJson.version, '-v, --version', 'Display version number');

  // Global options
  program
    .option('--json', 'Output in JSON format for machine consumption')
    .option('-g, --global', 'Use global scope')
    .option('-w, --workspace', 'Use workspace scope')
    .option('--verbose', 'Enable verbose output')
    .option('-q, --quiet', 'Suppress non-essential output');

  // Register commands
  registerInitCommand(program);
  registerConfigCommand(program);
  registerAgentCommand(program);
  registerCronCommand(program);
  registerChannelCommand(program);
  registerGatewayCommand(program);
  registerMcpCommand(program);
  registerSkillCommand(program);
  registerProviderCommand(program);
  registerModelCommand(program);
  registerWorkspaceCommand(program);
  registerServiceCommand(program);

  return program;
}

/**
 * Run the CLI
 */
export async function run(args?: string[]): Promise<void> {
  const program = createProgram();
  await program.parseAsync(args || process.argv);
}
