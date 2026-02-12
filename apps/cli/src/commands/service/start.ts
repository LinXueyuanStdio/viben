/**
 * viben service start - Start a service
 */

import chalk from 'chalk';
import type { OutputContext } from '../../types';
import { output, successResponse, errorResponse } from '../../lib/output';
import {
  startService,
  getServiceStatusAsync,
  parseServiceName,
} from '../../lib/services';

/**
 * Options for start command
 */
export interface StartOptions {
  name: string;
  command?: string;
  args?: string[];
}

/**
 * Default commands for known services
 */
function getDefaultCommand(serviceName: string): { command: string; args: string[] } | null {
  const { type, identifier } = parseServiceName(serviceName);

  if (type === 'Mcp') {
    // MCP servers are typically started via npx
    return {
      command: 'npx',
      args: ['-y', `@anthropic-ai/mcp-server-${identifier}`],
    };
  }

  if (type === 'Viben') {
    // Viben services
    switch (identifier) {
      case 'sync':
        return {
          command: 'viben',
          args: ['sync', '--daemon'],
        };
      case 'index':
        return {
          command: 'viben',
          args: ['index', '--daemon'],
        };
      default:
        return null;
    }
  }

  return null;
}

/**
 * Start a service
 */
export async function startServiceCommand(
  ctx: OutputContext,
  options: StartOptions
): Promise<void> {
  const { name } = options;

  // Check if already running
  const current = await getServiceStatusAsync(name);
  if (current.status === 'running') {
    output(
      ctx,
      successResponse({
        name,
        status: 'running',
        message: 'Service is already running',
        pid: current.pid,
        uptime: current.uptime,
      }),
      () => {
        console.log(chalk.yellow(`Service ${name} is already running`));
        console.log(`  PID: ${current.pid}`);
        console.log(`  Uptime: ${current.uptime}`);
      }
    );
    return;
  }

  // Get command to run
  let command = options.command;
  let args = options.args || [];

  if (!command) {
    const defaultCmd = getDefaultCommand(name);
    if (defaultCmd) {
      command = defaultCmd.command;
      args = defaultCmd.args;
    } else {
      output(
        ctx,
        errorResponse(
          'MISSING_COMMAND',
          `No command specified for service ${name} and no default is configured`
        ),
        () => {
          console.error(
            chalk.red('Error:'),
            `No command specified for service ${name}`
          );
          console.log();
          console.log('Specify a command with:');
          console.log(
            chalk.cyan(`  viben service start ${name} --command <cmd> [args...]`)
          );
        }
      );
      return;
    }
  }

  try {
    const info = await startService(name, command, args);

    if (info.status === 'running') {
      output(
        ctx,
        successResponse({
          name,
          status: 'running',
          pid: info.pid,
          command,
          args,
        }),
        () => {
          console.log(chalk.green(`Started service ${name}`));
          console.log(`  PID: ${info.pid}`);
          console.log(`  Command: ${command} ${args.join(' ')}`);
        }
      );
    } else {
      output(
        ctx,
        errorResponse('START_FAILED', `Failed to start service ${name}`, {
          status: info.status,
          error: info.error,
        }),
        () => {
          console.error(chalk.red(`Failed to start service ${name}`));
          if (info.error) {
            console.error(`  Error: ${info.error}`);
          }
        }
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    output(
      ctx,
      errorResponse('START_ERROR', `Error starting service: ${message}`),
      () => {
        console.error(chalk.red('Error starting service:'), message);
      }
    );
  }
}
