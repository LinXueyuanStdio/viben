/**
 * viben agent - Agent management commands
 *
 * Uses NAPI bindings to Rust viben-core for consistent behavior with Desktop/Gateway.
 */

import chalk from 'chalk';
import type { Command } from 'commander';
import type { OutputContext } from '../../types';
import { CliError } from '../../types';
import { output } from '../../lib/output';
import { listAgents } from './list';
import { createAgent } from './create';
import { showAgent } from './show';
import { removeAgent } from './remove';
import { configAgent } from './config';
import { setDefaultAgent } from './set-default';
import { statusAgent } from './status';

interface AgentOptions {
  name?: string;
  description?: string;
  model?: string;
  provider?: string;
  global?: boolean;
  workspace?: boolean;
  force?: boolean;
}

/**
 * Register the agent command
 */
export function registerAgentCommand(program: Command): void {
  const agentCmd = program
    .command('agent')
    .description('Manage agents');

  // agent list
  agentCmd
    .command('list')
    .description('List all agents')
    .action(async () => {
      const ctx: OutputContext = {
        json: program.opts().json || false,
        verbose: program.opts().verbose || false,
        quiet: program.opts().quiet || false,
      };

      try {
        await listAgents(ctx);
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

  // agent create
  agentCmd
    .command('create')
    .description('Create a new agent')
    .requiredOption('-n, --name <id>', 'Agent ID (required)')
    .option('-d, --description <text>', 'Agent description')
    .option('-m, --model <model>', 'Model to use')
    .option('-p, --provider <provider>', 'Provider name')
    .option('-s, --system-prompt <prompt>', 'System prompt')
    .option('-t, --temperature <temp>', 'Temperature (0-2)', parseFloat)
    .option('--max-tokens <tokens>', 'Max tokens', parseInt)
    .option('--from-template <template>', 'Create from template')
    .option('-g, --global', 'Create in global scope')
    .option('-w, --workspace', 'Create in workspace scope')
    .action(async (options: AgentOptions & { systemPrompt?: string; temperature?: number; maxTokens?: number; fromTemplate?: string }) => {
      const ctx: OutputContext = {
        json: program.opts().json || false,
        verbose: program.opts().verbose || false,
        quiet: program.opts().quiet || false,
      };

      try {
        if (!options.name) {
          throw new CliError('Agent ID is required (-n, --name)', 'MISSING_ID');
        }
        await createAgent(ctx, {
          name: options.name,
          description: options.description,
          model: options.model,
          provider: options.provider,
          systemPrompt: options.systemPrompt,
          temperature: options.temperature,
          maxTokens: options.maxTokens,
          fromTemplate: options.fromTemplate,
          global: options.global || program.opts().global,
          workspace: options.workspace || program.opts().workspace,
        });
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

  // agent show
  agentCmd
    .command('show')
    .description('Show agent details')
    .requiredOption('-n, --name <id>', 'Agent ID (required)')
    .action(async (options: AgentOptions) => {
      const ctx: OutputContext = {
        json: program.opts().json || false,
        verbose: program.opts().verbose || false,
        quiet: program.opts().quiet || false,
      };

      try {
        if (!options.name) {
          throw new CliError('Agent ID is required (-n, --name)', 'MISSING_ID');
        }
        await showAgent(ctx, options.name);
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

  // agent remove
  agentCmd
    .command('remove')
    .description('Remove an agent')
    .requiredOption('-n, --name <id>', 'Agent ID (required)')
    .option('-f, --force', 'Skip confirmation')
    .action(async (options: AgentOptions) => {
      const ctx: OutputContext = {
        json: program.opts().json || false,
        verbose: program.opts().verbose || false,
        quiet: program.opts().quiet || false,
      };

      try {
        if (!options.name) {
          throw new CliError('Agent ID is required (-n, --name)', 'MISSING_ID');
        }
        await removeAgent(ctx, {
          name: options.name,
          force: options.force,
        });
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

  // agent config
  agentCmd
    .command('config')
    .description('Configure an agent')
    .requiredOption('-n, --name <id>', 'Agent ID (required)')
    .argument('[action]', 'Action: set, get, or key name')
    .argument('[key]', 'Config key (for set/get)')
    .argument('[value]', 'Config value (for set)')
    .action(async (action: string | undefined, key: string | undefined, value: string | undefined, options: AgentOptions) => {
      const ctx: OutputContext = {
        json: program.opts().json || false,
        verbose: program.opts().verbose || false,
        quiet: program.opts().quiet || false,
      };

      try {
        if (!options.name) {
          throw new CliError('Agent ID is required (-n, --name)', 'MISSING_ID');
        }
        await configAgent(ctx, {
          name: options.name,
          action,
          key,
          value,
        });
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

  // agent set-default
  agentCmd
    .command('set-default')
    .description('Set the default agent')
    .requiredOption('-n, --name <id>', 'Agent ID (required)')
    .action(async (options: AgentOptions) => {
      const ctx: OutputContext = {
        json: program.opts().json || false,
        verbose: program.opts().verbose || false,
        quiet: program.opts().quiet || false,
      };

      try {
        if (!options.name) {
          throw new CliError('Agent ID is required (-n, --name)', 'MISSING_ID');
        }
        await setDefaultAgent(ctx, {
          name: options.name,
        });
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

  // agent status
  agentCmd
    .command('status')
    .description('Show agent status')
    .option('-n, --name <id>', 'Agent ID (optional, shows all if not specified)')
    .action(async (options: AgentOptions) => {
      const ctx: OutputContext = {
        json: program.opts().json || false,
        verbose: program.opts().verbose || false,
        quiet: program.opts().quiet || false,
      };

      try {
        await statusAgent(ctx, {
          name: options.name,
        });
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
