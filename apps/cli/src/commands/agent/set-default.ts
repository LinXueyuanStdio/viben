/**
 * viben agent set-default - Set the default agent
 */

import * as path from 'path';
import chalk from 'chalk';
import type { OutputContext } from '../../types';
import { CliError } from '../../types';
import { output, successResponse } from '../../lib/output';
import { findAgent } from '../../lib/agents';
import { readConfigFile, writeConfigFile } from '../../lib/config';
import { getGlobalConfigDir, ensureDir, CONFIG_FILE } from '../../lib/scope';

interface SetDefaultOptions {
  name: string;
}

/**
 * Set the default agent
 */
export function setDefaultAgent(ctx: OutputContext, options: SetDefaultOptions): void {
  const id = options.name;

  // Verify the agent exists
  const result = findAgent(id);

  if (!result) {
    throw new CliError(
      `Agent "${id}" not found`,
      'AGENT_NOT_FOUND'
    );
  }

  // Update global config to set the default agent
  const globalDir = getGlobalConfigDir();
  ensureDir(globalDir);

  const configPath = path.join(globalDir, CONFIG_FILE);
  let config = readConfigFile(configPath);

  if (!config) {
    config = {
      version: 1,
      settings: {},
      agents: [],
    };
  }

  // Add settings if not present
  if (!config.settings) {
    config.settings = {};
  }

  // Store the default agent in settings
  (config.settings as Record<string, unknown>).default_agent = id;

  // Also ensure the agent is in the agents list
  if (!config.agents) {
    config.agents = [];
  }
  if (!config.agents.includes(id)) {
    config.agents.push(id);
  }

  writeConfigFile(configPath, config);

  output(
    ctx,
    successResponse({
      default_agent: id,
      path: configPath,
    }),
    () => {
      console.log(chalk.green('OK') + ` Set default agent to "${chalk.cyan(id)}"`);
      console.log();
      console.log('The default agent will be used when no agent is specified.');
      console.log();
      console.log('You can also set the agent via:');
      console.log(chalk.cyan(`  export VIBEN_AGENT=${id}`));
    }
  );
}
