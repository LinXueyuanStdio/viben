/**
 * CLI channel command - Manage notification channels
 *
 * Uses channelManager and CHANNEL_TYPES from channels module.
 */
import chalk from "chalk";
import type { Command } from "commander";
import type { OutputContext } from "../types";
import type { ChannelType, CreateChannelOptions } from "../../channels/types";
import {
  output,
  successResponse,
  outputTable,
  outputKeyValue,
  outputSuccess,
  handleCommandError,
} from "../lib";
import { channelManager, CHANNEL_TYPES, testChannel, sendTestMessage } from "../../channels";

/**
 * Get output context from program options
 */
function getOutputContext(program: Command): OutputContext {
  const opts = program.opts();
  return {
    json: opts.json ?? false,
    verbose: opts.verbose ?? false,
    quiet: opts.quiet ?? false,
  };
}

/**
 * Register the channel command
 */
export function registerChannelCommand(program: Command): void {
  const channel = program
    .command("channel")
    .description("Manage notification channels");

  // channel types - list supported channel types
  channel
    .command("types")
    .description("List supported channel types")
    .action(async () => {
      const ctx = getOutputContext(program);
      try {
        const types = CHANNEL_TYPES;
        output(ctx, successResponse({ types }), () => {
          console.log(chalk.bold("Supported Channel Types:"));
          console.log();
          outputTable(
            ctx,
            ["Type", "Name", "Description", "Difficulty"],
            types.map((t) => [t.id, t.name, t.description, t.setupDifficulty])
          );
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // channel list - list all channels
  channel
    .command("list")
    .description("List all configured channels")
    .action(async () => {
      const ctx = getOutputContext(program);
      try {
        const channels = await channelManager.listChannels();
        const defaultChannel = await channelManager.getDefaultChannel();

        output(
          ctx,
          successResponse({
            channels,
            default: defaultChannel?.id,
            count: channels.length,
          }),
          () => {
            if (channels.length === 0) {
              console.log(chalk.gray("No channels configured."));
              console.log();
              console.log("Create a channel with:");
              console.log(
                chalk.cyan(
                  "  viben channel create my-telegram --type telegram --token <BOT_TOKEN>"
                )
              );
              return;
            }

            console.log(chalk.bold("Channels:"));
            console.log();
            outputTable(
              ctx,
              ["ID", "Name", "Type", "Status", "Default"],
              channels.map((ch) => [
                ch.id,
                ch.name,
                ch.type,
                ch.enabled ? chalk.green("enabled") : chalk.gray("disabled"),
                ch.is_default ? chalk.yellow("*") : "",
              ])
            );

            if (defaultChannel) {
              console.log();
              console.log(chalk.yellow("* = default channel"));
            }
          }
        );
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // channel create <id> - create a new channel
  channel
    .command("create <id>")
    .description("Create a new channel")
    .requiredOption(
      "--type <type>",
      "Channel type: telegram, discord, feishu, whatsapp, slack, webhook"
    )
    .option("-n, --name <name>", "Channel display name (defaults to ID)")
    .option("--token <token>", "Bot token (for Telegram, Discord, Slack)")
    .option("--chat-id <id>", "Default chat ID")
    .option("--app-id <id>", "App ID (for Feishu)")
    .option("--app-secret <secret>", "App Secret (for Feishu)")
    .option("--url <url>", "Webhook URL (for Webhook)")
    .option("--bridge-url <url>", "Bridge URL (for WhatsApp)")
    .option("--proxy <url>", "Proxy URL (for Telegram)")
    .option("--disabled", "Create channel as disabled")
    .option("--set-default", "Set as default channel")
    .action(
      async (
        id: string,
        options: {
          type: string;
          name?: string;
          token?: string;
          chatId?: string;
          appId?: string;
          appSecret?: string;
          url?: string;
          bridgeUrl?: string;
          proxy?: string;
          disabled?: boolean;
          setDefault?: boolean;
        }
      ) => {
        const ctx = getOutputContext(program);
        try {
          const validTypes: ChannelType[] = [
            "telegram",
            "discord",
            "feishu",
            "whatsapp",
            "slack",
            "webhook",
          ];
          const channelType = options.type.toLowerCase() as ChannelType;

          if (!validTypes.includes(channelType)) {
            throw new Error(
              `Invalid channel type: ${options.type}. Valid types: ${validTypes.join(", ")}`
            );
          }

          const createOptions: CreateChannelOptions = {
            id,
            name: options.name || id,
            type: channelType,
            enabled: !options.disabled,
            set_as_default: options.setDefault,
            token: options.token,
            proxy: options.proxy,
            app_id: options.appId,
            app_secret: options.appSecret,
            bridge_url: options.bridgeUrl,
            url: options.url,
            channel_id: options.chatId,
          };

          const created = await channelManager.createChannel(createOptions);

          output(ctx, successResponse({ channel: created }), () => {
            outputSuccess(ctx, `Channel "${created.id}" created successfully`);
            console.log();
            outputKeyValue(ctx, {
              ID: created.id,
              Name: created.name,
              Type: created.type,
              Status: created.enabled ? "enabled" : "disabled",
              Default: created.is_default ? "yes" : "no",
            });
          });
        } catch (error) {
          handleCommandError(ctx, error);
        }
      }
    );

  // channel remove -n <id> - remove a channel
  channel
    .command("remove")
    .description("Remove a channel")
    .requiredOption("-n, --name <id>", "Channel ID to remove")
    .option("-f, --force", "Skip confirmation")
    .action(async (options: { name: string; force?: boolean }) => {
      const ctx = getOutputContext(program);
      const id = options.name;
      try {
        // Get channel first to show what's being removed
        const existing = await channelManager.getChannel(id);
        if (!existing) {
          throw new Error(`Channel "${id}" not found`);
        }

        await channelManager.removeChannel(id);

        output(ctx, successResponse({ removed: id }), () => {
          outputSuccess(ctx, `Channel "${id}" removed successfully`);
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // channel enable -n <id> - enable a channel
  channel
    .command("enable")
    .description("Enable a channel")
    .requiredOption("-n, --name <id>", "Channel ID to enable")
    .action(async (options: { name: string }) => {
      const ctx = getOutputContext(program);
      const id = options.name;
      try {
        const updated = await channelManager.enableChannel(id);

        output(ctx, successResponse({ channel: updated }), () => {
          outputSuccess(ctx, `Channel "${id}" enabled`);
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // channel disable -n <id> - disable a channel
  channel
    .command("disable")
    .description("Disable a channel")
    .requiredOption("-n, --name <id>", "Channel ID to disable")
    .action(async (options: { name: string }) => {
      const ctx = getOutputContext(program);
      const id = options.name;
      try {
        const updated = await channelManager.disableChannel(id);

        output(ctx, successResponse({ channel: updated }), () => {
          outputSuccess(ctx, `Channel "${id}" disabled`);
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // channel set-default -n <id> - set default channel
  channel
    .command("set-default")
    .description("Set the default channel")
    .requiredOption("-n, --name <id>", "Channel ID to set as default")
    .action(async (options: { name: string }) => {
      const ctx = getOutputContext(program);
      const id = options.name;
      try {
        const updated = await channelManager.setDefaultChannel(id);

        output(ctx, successResponse({ channel: updated }), () => {
          outputSuccess(ctx, `Channel "${id}" set as default`);
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // channel status [-n <id>] - show channel status
  channel
    .command("status")
    .description("Show channel status (tests connectivity)")
    .option("-n, --name <id>", "Channel ID to check status for")
    .action(async (options: { name?: string }) => {
      const ctx = getOutputContext(program);
      const id = options.name;
      try {
        if (id) {
          // Show status for specific channel
          const status = await channelManager.getChannelStatus(id);

          output(ctx, successResponse({ status }), () => {
            console.log(chalk.bold(`Channel: ${status.id}`));
            console.log();
            outputKeyValue(ctx, {
              Name: status.name,
              Type: status.type,
              Enabled: status.enabled ? "yes" : "no",
              Default: status.is_default ? "yes" : "no",
              Status: formatStatus(status.status),
              Details: status.details || "-",
              Error: status.error || "-",
              Latency: status.latency_ms ? `${status.latency_ms}ms` : "-",
            });
          });
        } else {
          // Show status for all channels
          const statuses = await channelManager.getAllChannelStatuses();

          output(ctx, successResponse({ statuses, count: statuses.length }), () => {
            if (statuses.length === 0) {
              console.log(chalk.gray("No channels configured."));
              return;
            }

            console.log(chalk.bold("Channel Status:"));
            console.log();
            outputTable(
              ctx,
              ["ID", "Type", "Enabled", "Status", "Latency"],
              statuses.map((s) => [
                s.is_default ? `${s.id}${chalk.yellow("*")}` : s.id,
                s.type,
                s.enabled ? chalk.green("yes") : chalk.gray("no"),
                formatStatus(s.status),
                s.latency_ms ? `${s.latency_ms}ms` : "-",
              ])
            );
          });
        }
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // channel config -n <id> [action] [key] [value] - show/edit channel config
  channel
    .command("config")
    .description("Show or edit channel configuration")
    .requiredOption("-n, --name <id>", "Channel ID")
    .argument("[action]", "Action: set")
    .argument("[key]", "Configuration key")
    .argument("[value]", "Configuration value")
    .action(
      async (
        action: string | undefined,
        key: string | undefined,
        value: string | undefined,
        options: { name: string }
      ) => {
        const ctx = getOutputContext(program);
        const id = options.name;
        try {
          const ch = await channelManager.getChannel(id);
          if (!ch) {
            throw new Error(`Channel "${id}" not found`);
          }

          if (action === "set" && key) {
            // Set a config value
            const updated = await channelManager.updateChannelConfig(id, key, value);

            output(ctx, successResponse({ channel: updated }), () => {
              outputSuccess(ctx, `Channel "${id}" config updated: ${key}=${value}`);
            });
          } else {
            // Show config
            output(ctx, successResponse({ channel: ch }), () => {
              console.log(chalk.bold(`Channel: ${ch.id}`));
              console.log();
              outputKeyValue(ctx, {
                ID: ch.id,
                Name: ch.name,
                Type: ch.type,
                Enabled: ch.enabled ? "yes" : "no",
                Default: ch.is_default ? "yes" : "no",
                "Created At": new Date(ch.created_at).toLocaleString(),
                "Updated At": ch.updated_at
                  ? new Date(ch.updated_at).toLocaleString()
                  : "-",
                "Notification Mode": ch.notification_mode,
                "Allow From": ch.allow_from.length > 0
                  ? ch.allow_from.join(", ")
                  : "(all)",
              });

              // Show type-specific config
              if (Object.keys(ch.config).length > 0) {
                console.log();
                console.log(chalk.bold("Type-specific Config:"));
                console.log();
                const configPairs: Record<string, string> = {};
                for (const [k, v] of Object.entries(ch.config)) {
                  // Mask sensitive values
                  if (k === "token" || k === "app_secret") {
                    configPairs[k] = v ? maskSecret(String(v)) : "-";
                  } else {
                    configPairs[k] = v != null ? String(v) : "-";
                  }
                }
                outputKeyValue(ctx, configPairs);
              }

              console.log();
              console.log("To update a config value:");
              console.log(
                chalk.cyan(`  viben channel config ${id} set <key> <value>`)
              );
            });
          }
        } catch (error) {
          handleCommandError(ctx, error);
        }
      }
    );

  // channel login <type> - interactive login for a channel type
  channel
    .command("login <type>")
    .description("Interactive login for a channel type")
    .option("-n, --name <id>", "Channel ID to login (for existing channel)")
    .action(async (type: string, options: { name?: string }) => {
      const ctx = getOutputContext(program);
      try {
        const validTypes: ChannelType[] = [
          "telegram",
          "discord",
          "feishu",
          "whatsapp",
          "slack",
          "webhook",
        ];
        const channelType = type.toLowerCase() as ChannelType;

        if (!validTypes.includes(channelType)) {
          throw new Error(
            `Invalid channel type: ${type}. Valid types: ${validTypes.join(", ")}`
          );
        }

        // If channel ID provided, login to existing channel
        if (options.name) {
          const ch = await channelManager.getChannel(options.name);
          if (!ch) {
            throw new Error(`Channel "${options.name}" not found`);
          }

          // For WhatsApp, we'd need to trigger QR code login
          if (ch.type === "whatsapp") {
            console.log(chalk.yellow("WhatsApp login requires bridge interaction."));
            console.log("Please ensure your WhatsApp bridge is running and scan the QR code.");
            return;
          }

          console.log(chalk.gray(`Login flow for ${ch.type} is not yet implemented.`));
          console.log("Please configure credentials manually:");
          console.log(chalk.cyan(`  viben channel config ${ch.id} set token <YOUR_TOKEN>`));
          return;
        }

        // Interactive login guide based on type
        output(ctx, successResponse({ type: channelType, guide: true }), () => {
          console.log(chalk.bold(`Login Guide for ${channelType}:`));
          console.log();

          switch (channelType) {
            case "telegram":
              console.log("1. Open Telegram and search for @BotFather");
              console.log("2. Send /newbot and follow the instructions");
              console.log("3. Copy the bot token");
              console.log("4. Create the channel:");
              console.log(
                chalk.cyan(
                  "   viben channel create my-telegram --type telegram --token <BOT_TOKEN>"
                )
              );
              break;

            case "discord":
              console.log("1. Go to https://discord.com/developers/applications");
              console.log("2. Create a new application");
              console.log("3. Go to Bot section and create a bot");
              console.log("4. Copy the bot token");
              console.log("5. Create the channel:");
              console.log(
                chalk.cyan(
                  "   viben channel create my-discord --type discord --token <BOT_TOKEN>"
                )
              );
              break;

            case "feishu":
              console.log("1. Go to https://open.feishu.cn/");
              console.log("2. Create a new application");
              console.log("3. Get App ID and App Secret");
              console.log("4. Create the channel:");
              console.log(
                chalk.cyan(
                  "   viben channel create my-feishu --type feishu --app-id <ID> --app-secret <SECRET>"
                )
              );
              break;

            case "slack":
              console.log("1. Go to https://api.slack.com/apps");
              console.log("2. Create a new app");
              console.log("3. Install to your workspace");
              console.log("4. Copy the Bot User OAuth Token");
              console.log("5. Create the channel:");
              console.log(
                chalk.cyan(
                  "   viben channel create my-slack --type slack --token <BOT_TOKEN>"
                )
              );
              break;

            case "whatsapp":
              console.log("WhatsApp requires a bridge server.");
              console.log("1. Set up a WhatsApp bridge (e.g., whatsapp-web.js)");
              console.log("2. Create the channel:");
              console.log(
                chalk.cyan(
                  "   viben channel create my-whatsapp --type whatsapp --bridge-url <BRIDGE_URL>"
                )
              );
              console.log("3. Login via bridge QR code");
              break;

            case "webhook":
              console.log("Webhook channels send messages to a URL.");
              console.log("1. Set up your webhook endpoint");
              console.log("2. Create the channel:");
              console.log(
                chalk.cyan(
                  "   viben channel create my-webhook --type webhook --url <WEBHOOK_URL>"
                )
              );
              break;
          }
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // channel test <id> [chat-id] - test channel connectivity
  channel
    .command("test <id>")
    .description("Send a test message through the channel")
    .argument("[chat-id]", "Target chat/channel ID to send test message")
    .action(async (id: string, chatId?: string) => {
      const ctx = getOutputContext(program);
      try {
        const ch = await channelManager.getChannel(id);
        if (!ch) {
          throw new Error(`Channel "${id}" not found`);
        }

        // Build channel config for testing
        const config = channelManager.buildChannelConfig(id, {
          type: ch.type,
          name: ch.name,
          enabled: ch.enabled,
          created_at: ch.created_at,
          allow_from: ch.allow_from,
          ...ch.config,
        });

        // First test connectivity
        console.log(chalk.gray("Testing channel connectivity..."));
        const testResult = await testChannel(config);

        if (!testResult.success) {
          throw new Error(`Channel test failed: ${testResult.error}`);
        }

        console.log(chalk.green("Connectivity test passed."));

        // If chat ID provided, send a test message
        if (chatId) {
          console.log(chalk.gray("Sending test message..."));
          const sendResult = await sendTestMessage(config, chatId);

          if (!sendResult.success) {
            throw new Error(`Failed to send test message: ${sendResult.error}`);
          }

          output(ctx, successResponse({ test: "passed", message: "sent" }), () => {
            outputSuccess(ctx, "Test message sent successfully!");
            if (sendResult.messageId) {
              console.log(chalk.gray(`Message ID: ${sendResult.messageId}`));
            }
          });
        } else {
          output(ctx, successResponse({ test: "passed" }), () => {
            outputSuccess(ctx, "Channel connectivity test passed!");
            if (testResult.details) {
              console.log(chalk.gray(testResult.details));
            }
            console.log();
            console.log("To send a test message:");
            console.log(chalk.cyan(`  viben channel test ${id} <CHAT_ID>`));
          });
        }
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });
}

/**
 * Format connection status with color
 */
function formatStatus(status: string): string {
  switch (status) {
    case "connected":
      return chalk.green("connected");
    case "disconnected":
      return chalk.gray("disconnected");
    case "error":
      return chalk.red("error");
    case "disabled":
      return chalk.gray("disabled");
    default:
      return status;
  }
}

/**
 * Mask a secret value for display
 */
function maskSecret(value: string): string {
  if (value.length <= 8) {
    return "****";
  }
  return value.substring(0, 4) + "****" + value.substring(value.length - 4);
}
