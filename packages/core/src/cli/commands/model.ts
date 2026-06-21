/**
 * Model management CLI commands
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
import { modelManager, DEFAULT_ALIASES } from "../../models";
import { providerManager } from "../../providers";
import type { ModelCategory, ModelSurface } from "../../models";

const MODEL_CATEGORIES: ModelCategory[] = ["llm", "media"];
const MODEL_SURFACES: ModelSurface[] = [
  "chat",
  "image",
  "video",
  "music",
  "speech",
  "sfx",
];

function collectValues(value: string, previous: string[] | undefined): string[] {
  return [...(previous ?? []), value];
}

function parseCategory(category: string | undefined): ModelCategory | undefined {
  if (category === undefined) return undefined;
  if (MODEL_CATEGORIES.includes(category as ModelCategory)) {
    return category as ModelCategory;
  }
  throw new Error(
    `Invalid model category: ${category}. Valid categories: ${MODEL_CATEGORIES.join(", ")}`
  );
}

function parseSurface(surface: string | undefined): ModelSurface | undefined {
  if (surface === undefined) return undefined;
  if (MODEL_SURFACES.includes(surface as ModelSurface)) {
    return surface as ModelSurface;
  }
  throw new Error(
    `Invalid model surface: ${surface}. Valid surfaces: ${MODEL_SURFACES.join(", ")}`
  );
}

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
 * Format price for display
 */
function formatPrice(price: number | undefined): string {
  if (price === undefined) return "-";
  return `$${price.toFixed(2)}/1M`;
}

/**
 * Format context length for display
 */
function formatContextLength(length: number | undefined): string {
  if (length === undefined) return "-";
  if (length >= 1000000) return `${(length / 1000000).toFixed(1)}M`;
  if (length >= 1000) return `${(length / 1000).toFixed(0)}K`;
  return length.toString();
}

/**
 * Register model command and subcommands
 */
export function registerModelCommand(program: Command): void {
  const model = program.command("model").description("Manage AI models");

  // model list
  model
    .command("list")
    .description("List all registered models")
    .option("-p, --provider <provider>", "Filter by provider")
    .option("--category <category>", "Filter by model category (llm, media)")
    .option("--surface <surface>", "Filter by model surface")
    .action(async function (
      this: Command,
      options: { provider?: string; category?: string; surface?: string }
    ) {
      const ctx = getContext(this);
      try {
        const category = parseCategory(options.category);
        const surface = parseSurface(options.surface);
        const models = await modelManager.listModelsFiltered({
          provider: options.provider,
          category,
          surface,
        });

        const defaultModel = await modelManager.getDefault();

        output(ctx, successResponse({ models, default: defaultModel }), () => {
          if (models.length === 0) {
            console.log(chalk.gray("No models found"));
            return;
          }

          outputTable(
            ctx,
            ["ID", "Name", "Provider", "Category", "Surface", "Caps", "Context", "Default"],
            models.map((m) => [
              m.id,
              m.name,
              m.provider,
              m.category ?? "llm",
              m.surface ?? "chat",
              m.capabilities?.join(",") ?? "-",
              formatContextLength(m.contextLength),
              defaultModel === m.id ? chalk.green("Yes") : "",
            ])
          );
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // model show -n <model>
  model
    .command("show")
    .description("Show model details")
    .requiredOption("-n, --name <model>", "Model ID or alias")
    .action(async function (this: Command, options: { name: string }) {
      const modelId = options.name;
      const ctx = getContext(this);
      try {
        // Resolve alias first
        const resolved = await modelManager.resolveAlias(modelId);
        const info = modelManager.getModelInfo(resolved);
        const config = await modelManager.getModelConfig(modelId);
        const defaultModel = await modelManager.getDefault();

        output(
          ctx,
          successResponse({
            model: info,
            resolved: resolved !== modelId ? resolved : undefined,
            config,
            isDefault: defaultModel === resolved,
          }),
          () => {
            if (!info) {
              console.log(chalk.yellow(`Model "${modelId}" not found`));
              if (resolved !== modelId) {
                console.log(chalk.gray(`Resolved alias: ${resolved}`));
              }
              return;
            }

            console.log(chalk.bold(`Model: ${info.id}`));
            if (resolved !== modelId) {
              console.log(chalk.gray(`(resolved from alias: ${modelId})`));
            }

            outputKeyValue(ctx, {
              Name: info.name,
              Provider: info.provider,
              "Context Length": formatContextLength(info.contextLength),
              "Max Output": formatContextLength(info.maxOutputTokens),
              "Input Price": formatPrice(info.inputPrice),
              "Output Price": formatPrice(info.outputPrice),
              "Is Default": defaultModel === resolved ? "Yes" : "No",
            });

            if (config) {
              console.log();
              console.log(chalk.bold("Custom Configuration:"));
              outputKeyValue(ctx, {
                Temperature: config.temperature ?? "-",
                "Max Tokens": config.maxTokens ?? "-",
                "Top P": config.topP ?? "-",
                "Frequency Penalty": config.frequencyPenalty ?? "-",
                "Presence Penalty": config.presencePenalty ?? "-",
              });
            }
          }
        );
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // model status
  model
    .command("status")
    .description("Show model availability status")
    .action(async function (this: Command) {
      const ctx = getContext(this);
      try {
        const models = await modelManager.listModels();
        const aliases = await modelManager.getAliases();
        const defaultModel = await modelManager.getDefault();

        const providers = [...new Set(models.map((m) => m.provider))];

        output(
          ctx,
          successResponse({
            providers,
            modelCount: models.length,
            aliasCount: Object.keys(aliases).length,
            default: defaultModel,
          }),
          () => {
            console.log(chalk.bold("Model Status"));
            console.log();

            outputKeyValue(ctx, {
              "Known Models": models.length.toString(),
              Providers: providers.join(", "),
              "Configured Aliases": Object.keys(aliases).length.toString(),
              "Default Model": defaultModel || chalk.gray("(not set)"),
            });

            console.log();
            console.log(chalk.bold("Models by Provider:"));
            for (const provider of providers) {
              const count = models.filter((m) => m.provider === provider).length;
              console.log(`  ${provider}: ${count} models`);
            }
          }
        );
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // model set-default -n <model>
  model
    .command("set-default")
    .description("Set the default model")
    .requiredOption("-n, --name <model>", "Model ID or alias")
    .option("--surface <surface>", "Set default for a specific surface")
    .action(async function (this: Command, options: { name: string; surface?: string }) {
      const modelId = options.name;
      const ctx = getContext(this);
      try {
        // Resolve alias to actual model ID
        const resolved = await modelManager.resolveAlias(modelId);
        const surface = parseSurface(options.surface);
        if (surface) {
          await modelManager.setDefaultForSurface(surface, resolved);
        } else {
          await modelManager.setDefault(resolved);
        }

        output(ctx, successResponse({ default: resolved, surface }), () => {
          outputSuccess(
            ctx,
            surface
              ? `Set "${resolved}" as default ${surface} model`
              : `Set "${resolved}" as default model`
          );
          if (resolved !== modelId) {
            console.log(chalk.gray(`(resolved from alias: ${modelId})`));
          }
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // model create
  model
    .command("create")
    .description("Create a custom model")
    .requiredOption("-n, --name <model>", "Model ID")
    .requiredOption("--provider <provider>", "Provider ID or type")
    .option("--display-name <displayName>", "Display name")
    .option("--category <category>", "Model category (llm, media)")
    .option("--surface <surface>", "Model surface")
    .option("--capability <capability>", "Capability tag", collectValues)
    .option("--description <description>", "Description")
    .option("--context-window <tokens>", "Context window", parseInt)
    .option("--max-output-tokens <tokens>", "Max output tokens", parseInt)
    .option("-d, --default", "Set as default model")
    .action(async function (
      this: Command,
      options: {
        name: string;
        provider: string;
        displayName?: string;
        category?: string;
        surface?: string;
        capability?: string[];
        description?: string;
        contextWindow?: number;
        maxOutputTokens?: number;
        default?: boolean;
      }
    ) {
      const ctx = getContext(this);
      try {
        const category = parseCategory(options.category);
        const surface = parseSurface(options.surface);
        const provider = await providerManager.getProvider(options.provider);
        if (!provider) {
          throw new Error(`Provider not found: ${options.provider}`);
        }

        const created = await modelManager.createModel({
          id: options.name,
          name: options.displayName ?? options.name,
          provider: provider.type,
          provider_id: provider.id,
          category,
          surface,
          capabilities: options.capability,
          description: options.description,
          contextWindow: options.contextWindow,
          maxOutputTokens: options.maxOutputTokens,
          setAsDefault: options.default,
        });

        output(ctx, successResponse({ model: created }), () => {
          outputSuccess(ctx, `Created model "${created.id}"`);
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // model alias - subcommand group
  const alias = model.command("alias").description("Manage model aliases");

  // model alias list
  alias
    .command("list")
    .description("List all model aliases")
    .action(async function (this: Command) {
      const ctx = getContext(this);
      try {
        const aliases = await modelManager.getAliases();
        const aliasEntries = Object.entries(aliases);

        output(ctx, successResponse({ aliases }), () => {
          if (aliasEntries.length === 0) {
            console.log(chalk.gray("No aliases configured"));
            return;
          }

          console.log(chalk.bold("Model Aliases:"));
          outputTable(
            ctx,
            ["Alias", "Model", "Built-in"],
            aliasEntries.map(([aliasName, modelName]) => [
              aliasName,
              modelName,
              DEFAULT_ALIASES[aliasName] ? "Yes" : "",
            ])
          );
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // model alias create -n <name> -m <model>
  alias
    .command("create")
    .description("Create or update a model alias")
    .requiredOption("-n, --name <name>", "Alias name")
    .requiredOption("-m, --model <model>", "Target model ID")
    .action(async function (this: Command, options: { name: string; model: string }) {
      const aliasName = options.name;
      const modelId = options.model;
      const ctx = getContext(this);
      try {
        await modelManager.createAlias(aliasName, modelId);

        output(ctx, successResponse({ alias: aliasName, model: modelId }), () => {
          outputSuccess(ctx, `Set alias "${aliasName}" -> "${modelId}"`);
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // model alias remove -n <name>
  alias
    .command("remove")
    .alias("rm")
    .description("Remove a model alias")
    .requiredOption("-n, --name <name>", "Alias name to remove")
    .action(async function (this: Command, options: { name: string }) {
      const aliasName = options.name;
      const ctx = getContext(this);
      try {
        await modelManager.removeAlias(aliasName);

        output(ctx, successResponse({ removed: aliasName }), () => {
          outputSuccess(ctx, `Removed alias "${aliasName}"`);
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // model alias resolve -n <name>
  alias
    .command("resolve")
    .description("Resolve an alias to its model ID")
    .requiredOption("-n, --name <name>", "Alias name to resolve")
    .action(async function (this: Command, options: { name: string }) {
      const aliasName = options.name;
      const ctx = getContext(this);
      try {
        const resolved = await modelManager.resolveAlias(aliasName);

        output(ctx, successResponse({ alias: aliasName, model: resolved }), () => {
          if (resolved === aliasName) {
            console.log(
              chalk.gray(`"${aliasName}" is not an alias, using as model ID`)
            );
          } else {
            console.log(`${aliasName} -> ${resolved}`);
          }
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // model config - subcommand group
  const config = model.command("config").description("Manage model-specific configuration");

  // model config show -n <model>
  config
    .command("show")
    .description("Show model-specific configuration")
    .requiredOption("-n, --name <model>", "Model ID")
    .action(async function (this: Command, options: { name: string }) {
      const modelId = options.name;
      const ctx = getContext(this);
      try {
        const modelConfig = await modelManager.getModelConfig(modelId);

        output(ctx, successResponse({ model: modelId, config: modelConfig }), () => {
          if (!modelConfig) {
            console.log(chalk.gray(`No custom configuration for "${modelId}"`));
            return;
          }

          console.log(chalk.bold(`Configuration for ${modelId}:`));
          outputKeyValue(ctx, {
            Temperature: modelConfig.temperature ?? "-",
            "Max Tokens": modelConfig.maxTokens ?? "-",
            "Top P": modelConfig.topP ?? "-",
            "Frequency Penalty": modelConfig.frequencyPenalty ?? "-",
            "Presence Penalty": modelConfig.presencePenalty ?? "-",
          });
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // model config set -n <model>
  config
    .command("set")
    .description("Set model-specific configuration")
    .requiredOption("-n, --name <model>", "Model ID")
    .option("-t, --temperature <value>", "Temperature (0-2)", parseFloat)
    .option("--max-tokens <value>", "Max tokens", parseInt)
    .option("--top-p <value>", "Top P (0-1)", parseFloat)
    .option("--frequency-penalty <value>", "Frequency penalty (-2 to 2)", parseFloat)
    .option("--presence-penalty <value>", "Presence penalty (-2 to 2)", parseFloat)
    .action(async function (
      this: Command,
      options: {
        name: string;
        temperature?: number;
        maxTokens?: number;
        topP?: number;
        frequencyPenalty?: number;
        presencePenalty?: number;
      }
    ) {
      const modelId = options.name;
      const ctx = getContext(this);
      try {
        // Get existing config and merge with new values
        const existing = await modelManager.getModelConfig(modelId);
        const newConfig = {
          temperature: options.temperature ?? existing?.temperature,
          maxTokens: options.maxTokens ?? existing?.maxTokens,
          topP: options.topP ?? existing?.topP,
          frequencyPenalty: options.frequencyPenalty ?? existing?.frequencyPenalty,
          presencePenalty: options.presencePenalty ?? existing?.presencePenalty,
        };

        await modelManager.setModelConfig(modelId, newConfig);

        output(ctx, successResponse({ model: modelId, config: newConfig }), () => {
          outputSuccess(ctx, `Updated configuration for "${modelId}"`);
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // model config remove -n <model>
  config
    .command("remove")
    .alias("rm")
    .description("Remove model-specific configuration")
    .requiredOption("-n, --name <model>", "Model ID")
    .action(async function (this: Command, options: { name: string }) {
      const modelId = options.name;
      const ctx = getContext(this);
      try {
        await modelManager.removeModelConfig(modelId);

        output(ctx, successResponse({ removed: modelId }), () => {
          outputSuccess(ctx, `Removed configuration for "${modelId}"`);
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // model providers
  model
    .command("providers")
    .description("List available model providers")
    .action(async function (this: Command) {
      const ctx = getContext(this);
      try {
        const models = await modelManager.listModels();
        const providers = [...new Set(models.map((m) => m.provider))];
        const providerInfo = providers.map((p) => ({
          provider: p,
          modelCount: models.filter((m) => m.provider === p).length,
        }));

        output(ctx, successResponse({ providers: providerInfo }), () => {
          console.log(chalk.bold("Available Providers:"));
          outputTable(
            ctx,
            ["Provider", "Models"],
            providerInfo.map((p) => [p.provider, p.modelCount.toString()])
          );
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });
}
