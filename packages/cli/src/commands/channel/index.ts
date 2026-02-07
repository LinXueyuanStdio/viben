/**
 * viben channel - Channel management commands
 */

import chalk from 'chalk';
import type { Command } from 'commander';
import type { OutputContext } from '../../types';
import { CliError } from '../../types';
import { output } from '../../lib/output';
import { listChannels } from './list';
import { createChannel, type CreateChannelOptions } from './create';
import { removeChannel, type RemoveChannelOptions } from './remove';
import { enableChannel, disableChannel, type EnableChannelOptions } from './enable';
import { showChannelStatus, type StatusOptions } from './status';
import { configureChannel, type ConfigOptions } from './config';
import { setDefault, type SetDefaultOptions } from './set-default';
import type { ChannelType } from '../../lib/channels';

interface ChannelOptions {
  name?: string;
  type?: string;
  token?: string;
  appId?: string;
  appSecret?: string;
  encryptKey?: string;
  verificationToken?: string;
  allowFrom?: string;
  proxy?: string;
  enabled?: boolean;
  force?: boolean;
  setDefault?: boolean;
}

/**
 * Register the channel command
 */
export function registerChannelCommand(program: Command): void {
  const channelCmd = program
    .command('channel')
    .description('Manage chat channels (Telegram, Discord, Feishu)');

  // channel list
  channelCmd
    .command('list')
    .description('List all channels')
    .action(() => {
      const ctx = getContext(program);

      try {
        listChannels(ctx);
      } catch (error) {
        handleError(ctx, error);
      }
    });

  // channel create
  channelCmd
    .command('create')
    .description('Create a new channel')
    .requiredOption('-n, --name <id>', 'Channel ID (required)')
    .requiredOption('--type <type>', 'Channel type: telegram, discord, feishu, whatsapp')
    .option('--token <token>', 'Bot token (for Telegram, Discord)')
    .option('--app-id <id>', 'App ID (for Feishu)')
    .option('--app-secret <secret>', 'App Secret (for Feishu)')
    .option('--encrypt-key <key>', 'Encrypt key (for Feishu)')
    .option('--verification-token <token>', 'Verification token (for Feishu)')
    .option('--allow-from <ids>', 'Allowed user IDs (JSON array or comma-separated)')
    .option('--proxy <url>', 'Proxy URL (for Telegram)')
    .option('--disabled', 'Create channel as disabled')
    .option('--set-default', 'Set as default channel')
    .action((options: ChannelOptions) => {
      const ctx = getContext(program);

      try {
        if (!options.name) {
          throw new CliError('Channel ID is required (-n, --name)', 'MISSING_ID');
        }
        if (!options.type) {
          throw new CliError('Channel type is required (--type)', 'MISSING_TYPE');
        }

        const validTypes = ['telegram', 'discord', 'feishu', 'whatsapp'];
        if (!validTypes.includes(options.type)) {
          throw new CliError(
            `Invalid channel type: ${options.type}. Valid types: ${validTypes.join(', ')}`,
            'INVALID_TYPE'
          );
        }

        const createOptions: CreateChannelOptions = {
          name: options.name,
          type: options.type as ChannelType,
          token: options.token,
          appId: options.appId,
          appSecret: options.appSecret,
          encryptKey: options.encryptKey,
          verificationToken: options.verificationToken,
          allowFrom: options.allowFrom,
          proxy: options.proxy,
          enabled: options.enabled !== false && !(options as { disabled?: boolean }).disabled,
          setDefault: options.setDefault,
        };

        createChannel(ctx, createOptions);
      } catch (error) {
        handleError(ctx, error);
      }
    });

  // channel remove
  channelCmd
    .command('remove')
    .description('Remove a channel')
    .requiredOption('-n, --name <id>', 'Channel ID (required)')
    .option('-f, --force', 'Skip confirmation')
    .action((options: ChannelOptions) => {
      const ctx = getContext(program);

      try {
        if (!options.name) {
          throw new CliError('Channel ID is required (-n, --name)', 'MISSING_ID');
        }

        const removeOptions: RemoveChannelOptions = {
          name: options.name,
          force: options.force,
        };

        removeChannel(ctx, removeOptions);
      } catch (error) {
        handleError(ctx, error);
      }
    });

  // channel enable
  channelCmd
    .command('enable')
    .description('Enable a channel')
    .requiredOption('-n, --name <id>', 'Channel ID (required)')
    .action((options: ChannelOptions) => {
      const ctx = getContext(program);

      try {
        if (!options.name) {
          throw new CliError('Channel ID is required (-n, --name)', 'MISSING_ID');
        }

        const enableOptions: EnableChannelOptions = {
          name: options.name,
        };

        enableChannel(ctx, enableOptions);
      } catch (error) {
        handleError(ctx, error);
      }
    });

  // channel disable
  channelCmd
    .command('disable')
    .description('Disable a channel')
    .requiredOption('-n, --name <id>', 'Channel ID (required)')
    .action((options: ChannelOptions) => {
      const ctx = getContext(program);

      try {
        if (!options.name) {
          throw new CliError('Channel ID is required (-n, --name)', 'MISSING_ID');
        }

        const enableOptions: EnableChannelOptions = {
          name: options.name,
        };

        disableChannel(ctx, enableOptions);
      } catch (error) {
        handleError(ctx, error);
      }
    });

  // channel status
  channelCmd
    .command('status')
    .description('Show channel status')
    .option('-n, --name <id>', 'Channel ID (show status for specific channel)')
    .action(async (options: ChannelOptions) => {
      const ctx = getContext(program);

      try {
        const statusOptions: StatusOptions = {
          name: options.name,
        };

        await showChannelStatus(ctx, statusOptions);
      } catch (error) {
        handleError(ctx, error);
      }
    });

  // channel config
  channelCmd
    .command('config')
    .description('Configure channel settings')
    .requiredOption('-n, --name <id>', 'Channel ID (required)')
    .argument('[action]', 'Action: set')
    .argument('[key]', 'Configuration key')
    .argument('[value]', 'Configuration value')
    .action((action: string | undefined, key: string | undefined, value: string | undefined, options: ChannelOptions) => {
      const ctx = getContext(program);

      try {
        if (!options.name) {
          throw new CliError('Channel ID is required (-n, --name)', 'MISSING_ID');
        }

        const configOptions: ConfigOptions = {
          name: options.name,
        };

        // Parse "viben channel config -n <id> set <key> <value>"
        if (action === 'set' && key) {
          configOptions.key = key;
          configOptions.value = value;
        }

        configureChannel(ctx, configOptions);
      } catch (error) {
        handleError(ctx, error);
      }
    });

  // channel set-default
  channelCmd
    .command('set-default')
    .description('Set the default channel')
    .requiredOption('-n, --name <id>', 'Channel ID (required)')
    .action((options: ChannelOptions) => {
      const ctx = getContext(program);

      try {
        if (!options.name) {
          throw new CliError('Channel ID is required (-n, --name)', 'MISSING_ID');
        }

        const setDefaultOptions: SetDefaultOptions = {
          name: options.name,
        };

        setDefault(ctx, setDefaultOptions);
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
