/**
 * viben service - Service management commands
 */

import chalk from 'chalk';
import type { Command } from 'commander';
import type { OutputContext } from '../../types';
import { CliError } from '../../types';
import { output } from '../../lib/output';
import { showServiceStatus, type StatusOptions } from './status';
import { startServiceCommand, type StartOptions } from './start';
import { stopServiceCommand, type StopOptions } from './stop';
import { showServiceLogs, type LogsOptions } from './logs';

interface ServiceOptions {
  name?: string;
  command?: string;
  follow?: boolean;
  lines?: string;
  clear?: boolean;
}

/**
 * Register the service command
 */
export function registerServiceCommand(program: Command): void {
  const serviceCmd = program
    .command('service')
    .description('Manage background services');

  // service status
  serviceCmd
    .command('status [name]')
    .description('Show service status')
    .action((name: string | undefined) => {
      const ctx = getContext(program);

      try {
        const options: StatusOptions = { name };
        showServiceStatus(ctx, options);
      } catch (error) {
        handleError(ctx, error);
      }
    });

  // service start
  serviceCmd
    .command('start <name>')
    .description('Start a service')
    .option('-c, --command <command>', 'Command to run')
    .argument('[args...]', 'Arguments to pass to the command')
    .action(async (name: string, args: string[], options: ServiceOptions) => {
      const ctx = getContext(program);

      try {
        const startOptions: StartOptions = {
          name,
          command: options.command,
          args: args.length > 0 ? args : undefined,
        };

        await startServiceCommand(ctx, startOptions);
      } catch (error) {
        handleError(ctx, error);
      }
    });

  // service stop
  serviceCmd
    .command('stop <name>')
    .description('Stop a service')
    .action(async (name: string) => {
      const ctx = getContext(program);

      try {
        const stopOptions: StopOptions = { name };
        await stopServiceCommand(ctx, stopOptions);
      } catch (error) {
        handleError(ctx, error);
      }
    });

  // service restart
  serviceCmd
    .command('restart <name>')
    .description('Restart a service')
    .option('-c, --command <command>', 'Command to run')
    .argument('[args...]', 'Arguments to pass to the command')
    .action(async (name: string, args: string[], options: ServiceOptions) => {
      const ctx = getContext(program);

      try {
        // Import restartService here to avoid circular dependency
        const { restartService } = await import('../../lib/services');

        const info = await restartService(
          name,
          options.command,
          args.length > 0 ? args : undefined
        );

        output(
          ctx,
          {
            success: true,
            data: {
              name,
              status: info.status,
              pid: info.pid,
            },
          },
          () => {
            if (info.status === 'running') {
              console.log(chalk.green(`Restarted service ${name}`));
              console.log(`  PID: ${info.pid}`);
            } else {
              console.log(chalk.yellow(`Service ${name} status: ${info.status}`));
              if (info.error) {
                console.log(`  Error: ${info.error}`);
              }
            }
          }
        );
      } catch (error) {
        handleError(ctx, error);
      }
    });

  // service logs
  serviceCmd
    .command('logs <name>')
    .description('View service logs')
    .option('-f, --follow', 'Follow log output')
    .option('-n, --lines <number>', 'Number of lines to show', '100')
    .option('--clear', 'Clear service logs')
    .action((name: string, options: ServiceOptions) => {
      const ctx = getContext(program);

      try {
        const logsOptions: LogsOptions = {
          name,
          follow: options.follow,
          lines: options.lines ? parseInt(options.lines, 10) : 100,
          clear: options.clear,
        };

        showServiceLogs(ctx, logsOptions);
      } catch (error) {
        handleError(ctx, error);
      }
    });
}

/**
 * Get output context from program options
 */
function getContext(program: Command): OutputContext {
  const opts = program.opts();
  return {
    json: opts.json || false,
    verbose: opts.verbose || false,
    quiet: opts.quiet || false,
  };
}

/**
 * Handle errors with proper output
 */
function handleError(ctx: OutputContext, error: unknown): void {
  if (error instanceof CliError) {
    output(ctx, error.toResponse(), () => {
      console.error(chalk.red('Error:'), error.message);
    });
    process.exit(1);
  }
  throw error;
}
