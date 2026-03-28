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
              p.base_url || chalk.gray("(default)"),
              p.isDefault ? chalk.green("Yes") : "",
              p.enabled ? "Yes" : chalk.red("No"),
            ])
          );
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // provider create
  provider
    .command("create")
    .description("Create a new provider")
    .option("-n, --name <name>", "Provider name (auto-generated if not provided)")
    .option("-t, --type <type>", `Provider type (${PROVIDER_TYPES.join(", ")})`)
    .option("-u, --base-url <url>", "Custom base URL")
    .option("-k, --api-key <key>", "API key")
    .option("-c, --config <file>", "Config file path")
    .option("--auth <method>", "Authentication method")
    .option("--timeout <seconds>", "Request timeout in seconds", parseInt)
    .option("--max-retries <count>", "Maximum retry attempts", parseInt)
    .option("-d, --default", "Set as default provider")
    .action(async function (
      this: Command,
      options: {
        name?: string;
        type?: string;
        baseUrl?: string;
        apiKey?: string;
        config?: string;
        auth?: string;
        timeout?: number;
        maxRetries?: number;
        default?: boolean;
      }
    ) {
      const ctx = getContext(this);
      try {
        // Validate provider type (default to custom if not provided)
        const type = (options.type || "custom") as ProviderType;
        if (!PROVIDER_TYPES.includes(type)) {
          throw new Error(
            `Invalid provider type: ${type}. Valid types: ${PROVIDER_TYPES.join(", ")}`
          );
        }

        // Auto-generate name if not provided: type-timestamp
        const name = options.name || `${type}-${Date.now()}`;

        // Try to get API key from environment if not provided
        let apiKey = options.apiKey;
        if (!apiKey && ENV_VAR_NAMES[type]) {
          apiKey = process.env[ENV_VAR_NAMES[type]!];
        }

        const provider = await providerManager.createProvider({
          type,
          name,
          apiKey,
          base_url: options.baseUrl || DEFAULT_BASE_URLS[type],
          timeout: options.timeout,
          max_retries: options.maxRetries,
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

  // provider remove
  provider
    .command("remove")
    .alias("rm")
    .description("Remove a provider")
    .requiredOption("-n, --name <name>", "Provider name to remove")
    .action(async function (
      this: Command,
      options: { name: string }
    ) {
      const ctx = getContext(this);
      try {
        await providerManager.removeProvider(options.name);
        output(ctx, successResponse({ removed: options.name }), () => {
          outputSuccess(ctx, `Removed provider "${options.name}"`);
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // provider set-default
  provider
    .command("set-default")
    .description("Set the default provider")
    .requiredOption("-n, --name <name>", "Provider name to set as default")
    .action(async function (
      this: Command,
      options: { name: string }
    ) {
      const ctx = getContext(this);
      try {
        await providerManager.setDefault(options.name);
        output(ctx, successResponse({ default: options.name }), () => {
          outputSuccess(ctx, `Set "${options.name}" as default provider`);
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // provider status
  provider
    .command("status")
    .description("Show provider status")
    .option("-n, --name <name>", "Provider name (show all if not provided)")
    .action(async function (
      this: Command,
      options: { name?: string }
    ) {
      const ctx = getContext(this);
      try {
        if (options.name) {
          // Show status for specific provider
          const status = await providerManager.checkStatus(options.name);
          output(ctx, successResponse({ status }), () => {
            console.log(chalk.bold(`Provider: ${options.name}`));
            outputKeyValue(ctx, {
              Connected: status.connected ? chalk.green("Yes") : chalk.red("No"),
              Latency: status.latency ? `${status.latency}ms` : "-",
              Error: status.error || "-",
              "Checked At": status.checked_at,
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

  // provider show
  provider
    .command("show")
    .description("Show provider details")
    .requiredOption("-n, --name <name>", "Provider name to show")
    .action(async function (
      this: Command,
      options: { name: string }
    ) {
      const ctx = getContext(this);
      try {
        const p = await providerManager.getProvider(options.name);
        if (!p) {
          throw new Error(`Provider "${options.name}" not found`);
        }

        output(ctx, successResponse({ provider: p }), () => {
          console.log(chalk.bold(`Provider: ${p.id}`));
          outputKeyValue(ctx, {
            Type: p.type,
            Name: p.name,
            "Base URL": p.base_url || "(default)",
            "API Key": p.apiKey ? "********" : chalk.gray("(not set)"),
            "API Version": p.apiVersion || "-",
            Deployment: p.deployment || "-",
            Timeout: p.timeout ? `${p.timeout}s` : "-",
            "Max Retries": p.max_retries ?? "-",
            Default: p.isDefault ? "Yes" : "No",
            Enabled: p.enabled ? "Yes" : "No",
            Created: p.created_at,
            Updated: p.updated_at,
          });
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // provider update
  provider
    .command("update")
    .description("Update a provider")
    .requiredOption("-n, --name <name>", "Provider name to update")
    .option("-t, --type <type>", "Provider type")
    .option("-u, --base-url <url>", "Custom base URL")
    .option("-k, --api-key <key>", "API key")
    .option("--display-name <displayName>", "Display name")
    .option("--timeout <seconds>", "Request timeout in seconds", parseInt)
    .option("--max-retries <count>", "Maximum retry attempts", parseInt)
    .action(async function (
      this: Command,
      options: {
        name: string;
        type?: string;
        baseUrl?: string;
        apiKey?: string;
        displayName?: string;
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

        const provider = await providerManager.updateProvider(options.name, {
          type: options.type as ProviderType | undefined,
          name: options.displayName,
          apiKey: options.apiKey,
          base_url: options.baseUrl,
          timeout: options.timeout,
          max_retries: options.maxRetries,
        });

        output(ctx, successResponse({ provider }), () => {
          outputSuccess(ctx, `Updated provider "${options.name}"`);
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // provider enable
  provider
    .command("enable")
    .description("Enable a provider")
    .requiredOption("-n, --name <name>", "Provider name to enable")
    .action(async function (
      this: Command,
      options: { name: string }
    ) {
      const ctx = getContext(this);
      try {
        await providerManager.setEnabled(options.name, true);
        output(ctx, successResponse({ enabled: options.name }), () => {
          outputSuccess(ctx, `Enabled provider "${options.name}"`);
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // provider disable
  provider
    .command("disable")
    .description("Disable a provider")
    .requiredOption("-n, --name <name>", "Provider name to disable")
    .action(async function (
      this: Command,
      options: { name: string }
    ) {
      const ctx = getContext(this);
      try {
        await providerManager.setEnabled(options.name, false);
        output(ctx, successResponse({ disabled: options.name }), () => {
          outputSuccess(ctx, `Disabled provider "${options.name}"`);
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
