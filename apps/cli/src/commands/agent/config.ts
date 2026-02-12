/**
 * viben agent config - Configure an agent
 *
 * Uses NAPI bindings to Rust viben-core.
 */

import * as yaml from 'yaml';
import chalk from 'chalk';
import type { OutputContext } from '../../types';
import { CliError } from '../../types';
import { output, successResponse } from '../../lib/output';
import { agentGet, agentUpdate, type Agent, type UpdateAgentOptions } from '../../lib/native';

interface ConfigOptions {
  name: string;
  action?: string;
  key?: string;
  value?: string;
}

/**
 * Get a value from agent using key
 */
function getAgentValue(agent: Agent, key: string): unknown {
  const agentRecord = agent as unknown as Record<string, unknown>;
  return agentRecord[key];
}

/**
 * Format a value for display
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return chalk.gray('(not set)');
  }
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}

/**
 * Show agent configuration
 */
async function showConfig(ctx: OutputContext, agentId: string): Promise<void> {
  const agent = await agentGet(agentId);

  if (!agent) {
    throw new CliError(`Agent "${agentId}" not found`, 'AGENT_NOT_FOUND');
  }

  output(
    ctx,
    successResponse({
      agent,
      path: agent.path,
    }),
    () => {
      console.log(chalk.bold.underline(`Agent: ${agent.id}`));
      console.log();

      // Print YAML representation
      const yamlContent = yaml.stringify(agent, { indent: 2 });
      console.log(yamlContent);

      if (agent.path) {
        console.log(chalk.gray('Agent directory:'), agent.path);
      }
    }
  );
}

/**
 * Get a specific config value
 */
async function getConfig(ctx: OutputContext, agentId: string, key: string): Promise<void> {
  const agent = await agentGet(agentId);

  if (!agent) {
    throw new CliError(`Agent "${agentId}" not found`, 'AGENT_NOT_FOUND');
  }

  const value = getAgentValue(agent, key);

  output(
    ctx,
    successResponse({
      key,
      value,
    }),
    () => {
      console.log(formatValue(value));
    }
  );
}

/**
 * Set a config value
 */
async function setConfig(ctx: OutputContext, agentId: string, key: string, value: string): Promise<void> {
  const agent = await agentGet(agentId);

  if (!agent) {
    throw new CliError(`Agent "${agentId}" not found`, 'AGENT_NOT_FOUND');
  }

  // Parse the value - try JSON first, then string
  let parsedValue: unknown = value;
  try {
    parsedValue = JSON.parse(value);
  } catch {
    // Keep as string if not valid JSON
    parsedValue = value;
  }

  // Build update options based on the key
  const updateOptions: UpdateAgentOptions = {};

  // Map keys to update options
  const keyMap: Record<string, keyof UpdateAgentOptions> = {
    name: 'name',
    description: 'description',
    model: 'model',
    provider: 'provider',
    systemPrompt: 'systemPrompt',
    system_prompt: 'systemPrompt',
    temperature: 'temperature',
    maxTokens: 'maxTokens',
    max_tokens: 'maxTokens',
  };

  const mappedKey = keyMap[key];
  if (!mappedKey) {
    throw new CliError(`Unknown configuration key: ${key}`, 'INVALID_KEY');
  }

  // Set the value with proper typing
  (updateOptions as Record<string, unknown>)[mappedKey] = parsedValue;

  // Update via NAPI
  const updatedAgent = await agentUpdate(agentId, updateOptions);
  const newValue = getAgentValue(updatedAgent, mappedKey);

  output(
    ctx,
    successResponse({
      key,
      value: newValue,
      updated: true,
    }),
    () => {
      console.log(chalk.green('OK') + ` Set ${chalk.cyan(key)} = ${formatValue(newValue)}`);
    }
  );
}

/**
 * Configure an agent (main entry point)
 */
export async function configAgent(ctx: OutputContext, options: ConfigOptions): Promise<void> {
  const { name, action, key, value } = options;

  if (action === 'set') {
    // viben agent config -n <id> set <key> <value>
    if (!key) {
      throw new CliError('Key is required for set action', 'MISSING_KEY');
    }
    if (value === undefined) {
      throw new CliError('Value is required for set action', 'MISSING_VALUE');
    }
    await setConfig(ctx, name, key, value);
  } else if (action === 'get') {
    // viben agent config -n <id> get <key>
    if (!key) {
      throw new CliError('Key is required for get action', 'MISSING_KEY');
    }
    await getConfig(ctx, name, key);
  } else if (action && !key) {
    // viben agent config -n <id> <key> (shorthand for get)
    await getConfig(ctx, name, action);
  } else {
    // viben agent config -n <id> (show all)
    await showConfig(ctx, name);
  }
}
