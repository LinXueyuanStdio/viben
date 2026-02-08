/**
 * viben agent config - Configure an agent
 */

import * as yaml from 'yaml';
import chalk from 'chalk';
import type { OutputContext } from '../../types';
import { CliError } from '../../types';
import { output, successResponse } from '../../lib/output';
import { findAgent, writeAgentConfig, type AgentConfig } from '../../lib/agents';

interface ConfigOptions {
  name: string;
  action?: string;
  key?: string;
  value?: string;
}

/**
 * Get a value from config using dot notation
 */
function getConfigValue(config: AgentConfig, key: string): unknown {
  const parts = key.split('.');
  let current: unknown = config;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Set a value in config using dot notation
 */
function setConfigValue(config: AgentConfig, key: string, value: string): AgentConfig {
  const parts = key.split('.');
  const newConfig = JSON.parse(JSON.stringify(config)) as AgentConfig;
  let current: Record<string, unknown> = newConfig as unknown as Record<string, unknown>;

  // Navigate to parent, creating objects as needed
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (current[part] === undefined || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }

  // Parse the value - try JSON first, then string
  const lastKey = parts[parts.length - 1];
  let parsedValue: unknown = value;

  // Try to parse as JSON (for arrays, objects, booleans, numbers)
  try {
    parsedValue = JSON.parse(value);
  } catch {
    // Keep as string if not valid JSON
    parsedValue = value;
  }

  current[lastKey] = parsedValue;
  return newConfig;
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
function showConfig(ctx: OutputContext, agentId: string): void {
  const result = findAgent(agentId);

  if (!result) {
    throw new CliError(
      `Agent "${agentId}" not found`,
      'AGENT_NOT_FOUND'
    );
  }

  const { config, path: agentPath, source } = result;

  output(
    ctx,
    successResponse({
      config,
      path: agentPath,
      source,
    }),
    () => {
      console.log(chalk.bold.underline(`Agent: ${config.id || agentId}`));
      console.log();

      // Print YAML representation
      const yamlContent = yaml.stringify(config, { indent: 2 });
      console.log(yamlContent);

      console.log(chalk.gray('Config file:'), agentPath);
      console.log(chalk.gray('Source:'), source);
    }
  );
}

/**
 * Get a specific config value
 */
function getConfig(ctx: OutputContext, agentId: string, key: string): void {
  const result = findAgent(agentId);

  if (!result) {
    throw new CliError(
      `Agent "${agentId}" not found`,
      'AGENT_NOT_FOUND'
    );
  }

  const { config } = result;
  const value = getConfigValue(config, key);

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
function setConfig(ctx: OutputContext, agentId: string, key: string, value: string): void {
  const result = findAgent(agentId);

  if (!result) {
    throw new CliError(
      `Agent "${agentId}" not found`,
      'AGENT_NOT_FOUND'
    );
  }

  const { config, source } = result;
  const newConfig = setConfigValue(config, key, value);

  // Write back to file
  writeAgentConfig(source, agentId, newConfig);

  output(
    ctx,
    successResponse({
      key,
      value: getConfigValue(newConfig, key),
      updated: true,
    }),
    () => {
      console.log(chalk.green('OK') + ` Set ${chalk.cyan(key)} = ${formatValue(getConfigValue(newConfig, key))}`);
    }
  );
}

/**
 * Configure an agent (main entry point)
 */
export function configAgent(ctx: OutputContext, options: ConfigOptions): void {
  const { name, action, key, value } = options;

  if (action === 'set') {
    // viben agent config -n <id> set <key> <value>
    if (!key) {
      throw new CliError('Key is required for set action', 'MISSING_KEY');
    }
    if (value === undefined) {
      throw new CliError('Value is required for set action', 'MISSING_VALUE');
    }
    setConfig(ctx, name, key, value);
  } else if (action === 'get') {
    // viben agent config -n <id> get <key>
    if (!key) {
      throw new CliError('Key is required for get action', 'MISSING_KEY');
    }
    getConfig(ctx, name, key);
  } else if (action && !key) {
    // viben agent config -n <id> <key> (shorthand for get)
    getConfig(ctx, name, action);
  } else {
    // viben agent config -n <id> (show all)
    showConfig(ctx, name);
  }
}
