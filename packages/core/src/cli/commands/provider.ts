/**
 * Provider management CLI commands
 */
import type { Command } from "commander";
import chalk from "chalk";
import type { OutputContext } from "../types";
import {
  output,
  successResponse,
  outputTable,
  outputKeyValue,
  outputSuccess,
  handleCommandError,
} from "../lib";
import { providerManager, DEFAULT_BASE_URLS, ENV_VAR_NAMES } from "../../providers";
import type { ProviderType } from "../../types";

/**
 * Get output context from command
 */
function getContext(cmd: Command): OutputContext {
  const opts = cmd.optsWithGlobals();
  return {
    json: opts.json ?? false,
    verbose: opts.verbose ?? false,
    quiet: opts.quiet ?? false,
  };
}

/**
 * Valid provider types
 */
const PROVIDER_TYPES: ProviderType[] = [
  "openai",
  "anthropic",
  "azure",
  "ollama",
  "openrouter",
  "google",
  "custom",
];

/**
 * Register provider command and subcommands
 */
export function registerProviderCommand(program: Command): void {
  const provider = program
    .command("provider")
    .description("Manage AI providers");

  // provider list
  provider
    .command("list")
    .description("List all configured providers")
    .action(async function (this: Command) {
      const ctx = getContext(this);
      try {
        const providers = await providerManager.listProviders();
        const defaultId = await providerManager.getDefault();

        output(ctx, successResponse({ providers, default: defaultId }), () => {
          if (providers.length === 0) {
            console.log(chalk.gray("No providers configured"));
            console.log(
              chalk.gray("Use 'viben provider create <id>' to add a provider")
            );
            return;
          }

          outputTable(
            ctx,
            ["ID", "Type", "Base URL", "Default", "Enabled"],
            providers.map((p) => [
              p.id,
              p.type,
              p.baseUrl || chalk.gray("(default)"),
              p.isDefault ? chalk.green("Yes") : "",
              p.enabled ? "Yes" : chalk.red("No"),
            ])
          );
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // provider create <id>
  provider
    .command("create <id>")
    .description("Create a new provider")
    .option("-t, --type <type>", `Provider type (${PROVIDER_TYPES.join(", ")})`)
    .option("-u, --base-url <url>", "Custom base URL")
    .option("-k, --api-key <key>", "API key")
    .option("-n, --name <name>", "Display name for the provider")
    .option("--timeout <seconds>", "Request timeout in seconds", parseInt)
    .option("--max-retries <count>", "Maximum retry attempts", parseInt)
    .option("-d, --default", "Set as default provider")
    .action(async function (
      this: Command,
      id: string,
      options: {
        type?: string;
        baseUrl?: string;
        apiKey?: string;
        name?: string;
        timeout?: number;
        maxRetries?: number;
        default?: boolean;
      }
    ) {
      const ctx = getContext(this);
      try {
        // Validate provider type
        const type = (options.type || "custom") as ProviderType;
        if (!PROVIDER_TYPES.includes(type)) {
          throw new Error(
            `Invalid provider type: ${type}. Valid types: ${PROVIDER_TYPES.join(", ")}`
          );
        }

        // Try to get API key from environment if not provided
        let apiKey = options.apiKey;
        if (!apiKey && ENV_VAR_NAMES[type]) {
          apiKey = process.env[ENV_VAR_NAMES[type]!];
        }

        const provider = await providerManager.createProvider({
          type,
          name: options.name || id,
          apiKey,
          baseUrl: options.baseUrl || DEFAULT_BASE_URLS[type],
          timeout: options.timeout,
          maxRetries: options.maxRetries,
          setAsDefault: options.default,
        });

        output(ctx, successResponse({ provider }), () => {
          outputSuccess(ctx, `Created provider "${provider.id}"`);
          if (provider.isDefault) {
            console.log(chalk.gray("Set as default provider"));
          }
          if (!apiKey && ENV_VAR_NAMES[type]) {
            console.log(
              chalk.yellow(
                `Note: No API key provided. Set ${ENV_VAR_NAMES[type]} or update with 'viben provider update ${provider.id} --api-key <key>'`
              )
            );
          }
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // provider remove <id>
  provider
    .command("remove <id>")
    .alias("rm")
    .description("Remove a provider")
    .action(async function (this: Command, id: string) {
      const ctx = getContext(this);
      try {
        await providerManager.removeProvider(id);
        output(ctx, successResponse({ removed: id }), () => {
          outputSuccess(ctx, `Removed provider "${id}"`);
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // provider set-default <id>
  provider
    .command("set-default <id>")
    .description("Set the default provider")
    .action(async function (this: Command, id: string) {
      const ctx = getContext(this);
      try {
        await providerManager.setDefault(id);
        output(ctx, successResponse({ default: id }), () => {
          outputSuccess(ctx, `Set "${id}" as default provider`);
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // provider status [id]
  provider
    .command("status [id]")
    .description("Show provider status")
    .action(async function (this: Command, id?: string) {
      const ctx = getContext(this);
      try {
        if (id) {
          // Show status for specific provider
          const status = await providerManager.checkStatus(id);
          output(ctx, successResponse({ status }), () => {
            console.log(chalk.bold(`Provider: ${id}`));
            outputKeyValue(ctx, {
              Connected: status.connected ? chalk.green("Yes") : chalk.red("No"),
              Latency: status.latency ? `${status.latency}ms` : "-",
              Error: status.error || "-",
              "Checked At": status.checkedAt,
            });
          });
        } else {
          // Show status for all providers
          const statuses = await providerManager.checkAllStatus();
          const statusList = Object.values(statuses);

          output(ctx, successResponse({ statuses }), () => {
            if (statusList.length === 0) {
              console.log(chalk.gray("No providers configured"));
              return;
            }

            outputTable(
              ctx,
              ["Provider", "Connected", "Latency", "Error"],
              statusList.map((s) => [
                s.id,
                s.connected ? chalk.green("Yes") : chalk.red("No"),
                s.latency ? `${s.latency}ms` : "-",
                s.error || "-",
              ])
            );
          });
        }
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // provider show <id>
  provider
    .command("show <id>")
    .description("Show provider details")
    .action(async function (this: Command, id: string) {
      const ctx = getContext(this);
      try {
        const p = await providerManager.getProvider(id);
        if (!p) {
          throw new Error(`Provider "${id}" not found`);
        }

        output(ctx, successResponse({ provider: p }), () => {
          console.log(chalk.bold(`Provider: ${p.id}`));
          outputKeyValue(ctx, {
            Type: p.type,
            Name: p.name,
            "Base URL": p.baseUrl || "(default)",
            "API Key": p.apiKey ? "********" : chalk.gray("(not set)"),
            "API Version": p.apiVersion || "-",
            Deployment: p.deployment || "-",
            Timeout: p.timeout ? `${p.timeout}s` : "-",
            "Max Retries": p.maxRetries ?? "-",
            Default: p.isDefault ? "Yes" : "No",
            Enabled: p.enabled ? "Yes" : "No",
            Created: p.createdAt,
            Updated: p.updatedAt,
          });
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // provider update <id>
  provider
    .command("update <id>")
    .description("Update a provider")
    .option("-t, --type <type>", "Provider type")
    .option("-u, --base-url <url>", "Custom base URL")
    .option("-k, --api-key <key>", "API key")
    .option("-n, --name <name>", "Display name")
    .option("--timeout <seconds>", "Request timeout in seconds", parseInt)
    .option("--max-retries <count>", "Maximum retry attempts", parseInt)
    .action(async function (
      this: Command,
      id: string,
      options: {
        type?: string;
        baseUrl?: string;
        apiKey?: string;
        name?: string;
        timeout?: number;
        maxRetries?: number;
      }
    ) {
      const ctx = getContext(this);
      try {
        // Validate provider type if provided
        if (options.type && !PROVIDER_TYPES.includes(options.type as ProviderType)) {
          throw new Error(
            `Invalid provider type: ${options.type}. Valid types: ${PROVIDER_TYPES.join(", ")}`
          );
        }

        const provider = await providerManager.updateProvider(id, {
          type: options.type as ProviderType | undefined,
          name: options.name,
          apiKey: options.apiKey,
          baseUrl: options.baseUrl,
          timeout: options.timeout,
          maxRetries: options.maxRetries,
        });

        output(ctx, successResponse({ provider }), () => {
          outputSuccess(ctx, `Updated provider "${id}"`);
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // provider enable <id>
  provider
    .command("enable <id>")
    .description("Enable a provider")
    .action(async function (this: Command, id: string) {
      const ctx = getContext(this);
      try {
        await providerManager.setEnabled(id, true);
        output(ctx, successResponse({ enabled: id }), () => {
          outputSuccess(ctx, `Enabled provider "${id}"`);
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // provider disable <id>
  provider
    .command("disable <id>")
    .description("Disable a provider")
    .action(async function (this: Command, id: string) {
      const ctx = getContext(this);
      try {
        await providerManager.setEnabled(id, false);
        output(ctx, successResponse({ disabled: id }), () => {
          outputSuccess(ctx, `Disabled provider "${id}"`);
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // provider types
  provider
    .command("types")
    .description("List supported provider types")
    .action(function (this: Command) {
      const ctx = getContext(this);

      const typeInfo = PROVIDER_TYPES.map((type) => ({
        type,
        defaultUrl: DEFAULT_BASE_URLS[type] || "(custom)",
        envVar: ENV_VAR_NAMES[type] || "-",
      }));

      output(ctx, successResponse({ types: typeInfo }), () => {
        outputTable(
          ctx,
          ["Type", "Default Base URL", "API Key Env Var"],
          typeInfo.map((t) => [t.type, t.defaultUrl, t.envVar])
        );
      });
    });
}
