/**
 * viben service status - Show service status
 */

import chalk from 'chalk';
import type { OutputContext } from '../../types';
import { output, successResponse, outputTable } from '../../lib/output';
import { listServices, getServiceStatus, type ServiceInfo } from '../../lib/services';

/**
 * Options for status command
 */
export interface StatusOptions {
  name?: string;
}

/**
 * Format status for display
 */
function formatStatus(info: ServiceInfo): string {
  switch (info.status) {
    case 'running':
      return chalk.green('running');
    case 'stopped':
      return chalk.gray('stopped');
    case 'error':
      return chalk.red('error');
    default:
      return chalk.yellow('unknown');
  }
}

/**
 * Show service status
 */
export function showServiceStatus(ctx: OutputContext, options: StatusOptions): void {
  if (options.name) {
    // Show single service status
    const info = getServiceStatus(options.name);

    output(ctx, successResponse(info), () => {
      console.log(chalk.bold(`Service: ${info.name}`));
      console.log();
      console.log(`  ${chalk.cyan('Type:')}    ${info.type}`);
      console.log(`  ${chalk.cyan('Status:')}  ${formatStatus(info)}`);

      if (info.pid) {
        console.log(`  ${chalk.cyan('PID:')}     ${info.pid}`);
      }

      if (info.uptime) {
        console.log(`  ${chalk.cyan('Uptime:')}  ${info.uptime}`);
      }

      if (info.command) {
        const fullCmd = info.args?.length
          ? `${info.command} ${info.args.join(' ')}`
          : info.command;
        console.log(`  ${chalk.cyan('Command:')} ${fullCmd}`);
      }

      if (info.error) {
        console.log(`  ${chalk.cyan('Error:')}   ${chalk.red(info.error)}`);
      }
    });
    return;
  }

  // Show all services status
  const services = listServices();

  const response = successResponse({
    services: services.map((s) => ({
      name: s.name,
      type: s.type,
      status: s.status,
      pid: s.pid,
      uptime: s.uptime,
    })),
    count: services.length,
  });

  output(ctx, response, () => {
    console.log(chalk.bold('Services:'));
    console.log();

    if (services.length === 0) {
      console.log(chalk.gray('  No services tracked.'));
      return;
    }

    const headers = ['Name', 'Status', 'PID', 'Uptime'];
    const rows = services.map((s) => [
      s.name,
      formatStatus(s),
      s.pid?.toString() || chalk.gray('-'),
      s.uptime || chalk.gray('-'),
    ]);

    outputTable({ ...ctx, json: false }, headers, rows);
  });
}
