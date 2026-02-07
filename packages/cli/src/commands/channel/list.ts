/**
 * viben channel list - List all channels
 */

import chalk from 'chalk';
import type { OutputContext } from '../../types';
import { output, successResponse, outputTable } from '../../lib/output';
import { listChannelConfigs, getDefaultChannelId } from '../../lib/channels';

/**
 * List all configured channels
 */
export function listChannels(ctx: OutputContext): void {
  const channels = listChannelConfigs();
  const defaultId = getDefaultChannelId();

  const response = successResponse({
    default: defaultId,
    channels: channels.map((ch) => ({
      id: ch.id,
      type: ch.type,
      enabled: ch.enabled,
      isDefault: ch.id === defaultId,
    })),
  });

  output(ctx, response, () => {
    if (channels.length === 0) {
      console.log(chalk.gray('No channels configured.'));
      console.log();
      console.log('Create a channel with:');
      console.log(chalk.cyan('  viben channel create -n <id> --type telegram --token <token>'));
      return;
    }

    console.log(chalk.bold('Channels:'));
    console.log();

    const headers = ['ID', 'Type', 'Status'];
    const rows = channels.map((ch) => {
      const id = ch.id === defaultId ? `${ch.id}${chalk.yellow('*')}` : ch.id;
      const status = ch.enabled ? chalk.green('enabled') : chalk.gray('disabled');
      return [id, ch.type, status];
    });

    outputTable({ ...ctx, json: false }, headers, rows);

    if (defaultId) {
      console.log();
      console.log(chalk.yellow('* = default channel'));
    }
  });
}
