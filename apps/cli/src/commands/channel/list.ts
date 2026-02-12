/**
 * viben channel list - List all channels
 *
 * Uses NAPI bindings to Rust viben-core.
 */

import chalk from 'chalk';
import type { OutputContext } from '../../types';
import { output, successResponse, outputTable } from '../../lib/output';
import { channelList, channelGetDefault, type Channel } from '../../lib/native';

/**
 * List all configured channels
 */
export async function listChannels(ctx: OutputContext): Promise<void> {
  const channels = await channelList();
  const defaultId = await channelGetDefault();

  const response = successResponse({
    default: defaultId,
    channels: channels.map((ch) => ({
      id: ch.id,
      type: ch.channelType,
      name: ch.name,
      enabled: ch.enabled,
      isDefault: ch.isDefault,
    })),
  });

  output(ctx, response, () => {
    if (channels.length === 0) {
      console.log(chalk.gray('No channels configured.'));
      console.log();
      console.log('Create a channel with:');
      console.log(chalk.cyan('  viben channel create -n <name> --type telegram --chat-id <id>'));
      return;
    }

    console.log(chalk.bold('Channels:'));
    console.log();

    const headers = ['ID', 'Name', 'Type', 'Status'];
    const rows = channels.map((ch) => {
      const id = ch.isDefault ? `${ch.id}${chalk.yellow('*')}` : ch.id;
      const status = ch.enabled ? chalk.green('enabled') : chalk.gray('disabled');
      return [id, ch.name, ch.channelType, status];
    });

    outputTable({ ...ctx, json: false }, headers, rows);

    if (defaultId) {
      console.log();
      console.log(chalk.yellow('* = default channel'));
    }
  });
}
