/**
 * viben init - Initialize a Viben workspace
 */

import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import type { Command } from 'commander';
import type { OutputContext, VibenConfig } from '../types';
import { CliError } from '../types';
import { DEFAULT_CONFIG, writeConfigFile } from '../lib/config';
import { WORKSPACE_DIR, CONFIG_FILE, findWorkspaceRoot } from '../lib/scope';
import { output, successResponse, errorResponse } from '../lib/output';

interface InitOptions {
  from?: string;
}

/**
 * Initialize workspace in the given directory
 */
function initWorkspace(targetDir: string, template?: string): VibenConfig {
  const vibenDir = path.join(targetDir, WORKSPACE_DIR);
  const configPath = path.join(vibenDir, CONFIG_FILE);

  // Check if already initialized
  if (fs.existsSync(configPath)) {
    throw new CliError(
      'Workspace already initialized. Use "viben config" to modify settings.',
      'WORKSPACE_EXISTS'
    );
  }

  // Create .viben directory
  if (!fs.existsSync(vibenDir)) {
    fs.mkdirSync(vibenDir, { recursive: true });
  }

  // Determine config to use
  let config: VibenConfig;

  if (template) {
    // TODO: Support template loading from registry or local file
    // For now, just use default config
    config = {
      ...DEFAULT_CONFIG,
      version: 1,
    };
  } else {
    config = {
      ...DEFAULT_CONFIG,
      version: 1,
    };
  }

  // Write config file
  writeConfigFile(configPath, config);

  // Create agents directory
  const agentsDir = path.join(vibenDir, 'agents');
  if (!fs.existsSync(agentsDir)) {
    fs.mkdirSync(agentsDir, { recursive: true });
  }

  // Create default agent config
  const mainAgentPath = path.join(agentsDir, 'main.yaml');
  if (!fs.existsSync(mainAgentPath)) {
    const mainAgentConfig = `# Main agent configuration
id: main
name: Main Agent
description: Default workspace agent

# Model configuration (optional, uses defaults)
# model: claude-sonnet-4-20250514
# provider: anthropic
`;
    fs.writeFileSync(mainAgentPath, mainAgentConfig, 'utf-8');
  }

  return config;
}

/**
 * Register the init command
 */
export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize a Viben workspace in the current directory')
    .option('--from <template>', 'Initialize from a template')
    .action(async (options: InitOptions) => {
      const ctx: OutputContext = {
        json: program.opts().json || false,
        verbose: program.opts().verbose || false,
        quiet: program.opts().quiet || false,
      };

      try {
        const targetDir = process.cwd();

        // Check if already inside a workspace
        const existingWorkspace = findWorkspaceRoot(targetDir);
        if (existingWorkspace && existingWorkspace !== targetDir) {
          throw new CliError(
            `Already inside workspace at ${existingWorkspace}`,
            'NESTED_WORKSPACE'
          );
        }

        const config = initWorkspace(targetDir, options.from);

        output(
          ctx,
          successResponse({
            workspaceDir: path.join(targetDir, WORKSPACE_DIR),
            configPath: path.join(targetDir, WORKSPACE_DIR, CONFIG_FILE),
            config,
          }),
          () => {
            console.log(chalk.green('Workspace initialized successfully!'));
            console.log();
            console.log('Created:');
            console.log(chalk.gray('  .viben/config.yaml') + '    - Workspace configuration');
            console.log(chalk.gray('  .viben/agents/main.yaml') + ' - Default agent');
            console.log();
            console.log('Next steps:');
            console.log(chalk.cyan('  viben config list') + '      - View configuration');
            console.log(chalk.cyan('  viben agent list') + '       - List agents');
            console.log(chalk.cyan('  viben config set <key> <value>') + ' - Modify settings');
          }
        );
      } catch (error) {
        if (error instanceof CliError) {
          output(ctx, error.toResponse(), () => {
            console.error(chalk.red('Error:'), error.message);
          });
          process.exit(1);
        }
        throw error;
      }
    });
}
