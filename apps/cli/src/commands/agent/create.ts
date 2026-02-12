/**
 * viben agent create - Create a new agent
 *
 * Uses NAPI bindings to Rust viben-core.
 */

import chalk from 'chalk';
import type { OutputContext } from '../../types';
import { CliError } from '../../types';
import { output, successResponse } from '../../lib/output';
import { agentCreate, type CreateAgentOptions } from '../../lib/native';

interface CreateOptions {
  name: string;
  description?: string;
  model?: string;
  provider?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  fromTemplate?: string;
  global?: boolean;
  workspace?: boolean;
}

/**
 * Validate agent name (will be used as ID)
 */
function validateAgentName(name: string): void {
  if (!name || name.trim() === '') {
    throw new CliError('Agent name cannot be empty', 'INVALID_NAME');
  }

  // Allow Unicode characters for agent names
  if (name.length > 64) {
    throw new CliError('Agent name must be 64 characters or less', 'INVALID_NAME');
  }
}

/**
 * Create a new agent
 */
export async function createAgent(ctx: OutputContext, options: CreateOptions): Promise<void> {
  validateAgentName(options.name);

  // Note: workspace scope is not yet supported in NAPI
  // TODO: Add workspace_path parameter to NAPI when needed
  if (options.workspace) {
    console.log(chalk.yellow('Warning: --workspace flag is not yet supported, creating in global scope'));
  }

  const createOptions: CreateAgentOptions = {
    name: options.name,
    description: options.description,
    model: options.model,
    provider: options.provider,
    systemPrompt: options.systemPrompt,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
    fromTemplate: options.fromTemplate,
  };

  const agent = await agentCreate(createOptions);

  output(
    ctx,
    successResponse({ agent }),
    () => {
      console.log(chalk.green('OK') + ` Created agent "${chalk.cyan(agent.id)}"`);
      console.log();
      if (agent.path) {
        console.log('Agent directory:', chalk.gray(agent.path));
      }
      console.log();
      console.log('Next steps:');
      console.log(chalk.cyan(`  viben agent show -n ${agent.id}`) + ' - View agent details');
    }
  );
}
