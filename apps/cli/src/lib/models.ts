/**
 * Model Management for Viben CLI
 *
 * Handles model configuration, aliases, and fallbacks.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { CliError } from '../types';
import { getStateDir, ensureDir } from './scope';
import {
  type ModelsConfig,
  type Model,
  type ModelConfig,
  type ModelStatus,
  type ModelAliases,
  type ModelFallbacks,
  DEFAULT_MODELS_CONFIG,
  MODELS_CONFIG_FILE,
} from '../types/model';

/**
 * Get the path to the models configuration file
 */
export function getModelsConfigPath(): string {
  const stateDir = getStateDir();
  return path.join(stateDir, MODELS_CONFIG_FILE);
}

/**
 * Read models configuration from file
 * Returns default config if file doesn't exist
 */
export function readModelsConfig(): ModelsConfig {
  const configPath = getModelsConfigPath();

  if (!fs.existsSync(configPath)) {
    return { ...DEFAULT_MODELS_CONFIG };
  }

  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    const parsed = yaml.parse(content) as ModelsConfig;

    // Ensure structure is valid
    return {
      version: parsed.version ?? 1,
      default: parsed.default,
      aliases: parsed.aliases ?? {},
      fallbacks: parsed.fallbacks ?? [],
      model_config: parsed.model_config ?? {},
      model_capabilities: parsed.model_capabilities ?? {},
    };
  } catch (error) {
    throw new CliError(
      `Failed to read models config: ${configPath}`,
      'MODELS_CONFIG_READ_ERROR',
      error
    );
  }
}

/**
 * Write models configuration to file
 */
export function writeModelsConfig(config: ModelsConfig): void {
  const configPath = getModelsConfigPath();
  const stateDir = getStateDir();

  try {
    ensureDir(stateDir);

    const content = yaml.stringify(config, {
      indent: 2,
      lineWidth: 0,
    });

    fs.writeFileSync(configPath, content, 'utf-8');
  } catch (error) {
    throw new CliError(
      `Failed to write models config: ${configPath}`,
      'MODELS_CONFIG_WRITE_ERROR',
      error
    );
  }
}

/**
 * Get the default model ID
 */
export function getDefaultModel(): string | undefined {
  const config = readModelsConfig();
  return config.default;
}

/**
 * Set the default model
 */
export function setDefaultModel(modelId: string): void {
  const config = readModelsConfig();
  config.default = modelId;
  writeModelsConfig(config);
}

/**
 * Resolve a model ID or alias to the actual model ID
 */
export function resolveModel(modelIdOrAlias: string): string {
  const config = readModelsConfig();

  // Check if it's an alias
  if (config.aliases && config.aliases[modelIdOrAlias]) {
    return config.aliases[modelIdOrAlias];
  }

  // Return as-is (it's already a model ID)
  return modelIdOrAlias;
}

/**
 * Get model configuration
 */
export function getModelConfig(modelId: string): ModelConfig | undefined {
  const config = readModelsConfig();
  const resolvedId = resolveModel(modelId);
  return config.model_config?.[resolvedId];
}

/**
 * List all configured models
 */
export function listModels(providerFilter?: string): Model[] {
  const config = readModelsConfig();
  const models: Model[] = [];

  // Get all models from model_config
  if (config.model_config) {
    for (const [id, modelConfig] of Object.entries(config.model_config)) {
      // Apply provider filter if specified
      if (providerFilter && modelConfig.provider !== providerFilter) {
        continue;
      }

      models.push({
        id,
        provider: modelConfig.provider,
        isDefault: config.default === id,
        config: modelConfig,
        capabilities: config.model_capabilities?.[id],
      });
    }
  }

  // If no models in config, show default model if set
  if (models.length === 0 && config.default) {
    models.push({
      id: config.default,
      isDefault: true,
    });
  }

  return models;
}

/**
 * Get all model aliases
 */
export function getAliases(): ModelAliases {
  const config = readModelsConfig();
  return config.aliases ?? {};
}

/**
 * Create or update a model alias
 */
export function createAlias(alias: string, modelId: string): void {
  validateAliasName(alias);

  const config = readModelsConfig();
  if (!config.aliases) {
    config.aliases = {};
  }

  config.aliases[alias] = modelId;
  writeModelsConfig(config);
}

/**
 * Remove a model alias
 * Returns true if the alias was removed, false if it didn't exist
 */
export function removeAlias(alias: string): boolean {
  const config = readModelsConfig();

  if (!config.aliases || !config.aliases[alias]) {
    return false;
  }

  delete config.aliases[alias];
  writeModelsConfig(config);
  return true;
}

/**
 * Check if an alias exists
 */
export function aliasExists(alias: string): boolean {
  const config = readModelsConfig();
  return !!config.aliases?.[alias];
}

/**
 * Get the fallback chain
 */
export function getFallbacks(): ModelFallbacks {
  const config = readModelsConfig();
  return config.fallbacks ?? [];
}

/**
 * Add a model to the fallback chain
 */
export function addFallback(modelId: string): void {
  const config = readModelsConfig();
  if (!config.fallbacks) {
    config.fallbacks = [];
  }

  // Don't add duplicates
  if (!config.fallbacks.includes(modelId)) {
    config.fallbacks.push(modelId);
    writeModelsConfig(config);
  }
}

/**
 * Remove a model from the fallback chain
 * Returns true if the model was removed, false if it wasn't in the chain
 */
export function removeFallback(modelId: string): boolean {
  const config = readModelsConfig();

  if (!config.fallbacks) {
    return false;
  }

  const index = config.fallbacks.indexOf(modelId);
  if (index === -1) {
    return false;
  }

  config.fallbacks.splice(index, 1);
  writeModelsConfig(config);
  return true;
}

/**
 * Clear all fallbacks
 */
export function clearFallbacks(): void {
  const config = readModelsConfig();
  config.fallbacks = [];
  writeModelsConfig(config);
}

/**
 * Get model status (availability check)
 * Note: This is a simplified version - actual availability would require provider checks
 */
export function getModelStatus(modelId?: string): ModelStatus[] {
  const config = readModelsConfig();
  const statuses: ModelStatus[] = [];

  if (modelId) {
    // Check specific model
    const resolvedId = resolveModel(modelId);
    const modelConfig = config.model_config?.[resolvedId];

    statuses.push({
      id: resolvedId,
      provider: modelConfig?.provider,
      available: true, // Simplified - actual check would verify provider
    });
  } else {
    // Check all models in fallback chain and model_config
    const modelsToCheck = new Set<string>();

    // Add default
    if (config.default) {
      modelsToCheck.add(config.default);
    }

    // Add fallbacks
    if (config.fallbacks) {
      for (const fallback of config.fallbacks) {
        modelsToCheck.add(fallback);
      }
    }

    // Add all configured models
    if (config.model_config) {
      for (const id of Object.keys(config.model_config)) {
        modelsToCheck.add(id);
      }
    }

    for (const id of modelsToCheck) {
      const modelConfig = config.model_config?.[id];
      statuses.push({
        id,
        provider: modelConfig?.provider,
        available: true, // Simplified
      });
    }
  }

  return statuses;
}

/**
 * Validate alias name format
 */
export function validateAliasName(alias: string): void {
  if (!alias || alias.trim() === '') {
    throw new CliError('Alias name cannot be empty', 'INVALID_ALIAS_NAME');
  }

  if (!/^[a-z0-9][a-z0-9_-]*$/.test(alias)) {
    throw new CliError(
      'Alias name must start with a letter or number and contain only lowercase letters, numbers, underscores, and hyphens',
      'INVALID_ALIAS_NAME'
    );
  }

  if (alias.length > 32) {
    throw new CliError('Alias name must be 32 characters or less', 'INVALID_ALIAS_NAME');
  }
}

/**
 * Group models by provider
 */
export function groupModelsByProvider(models: Model[]): Map<string, Model[]> {
  const grouped = new Map<string, Model[]>();

  for (const model of models) {
    const provider = model.provider || 'unknown';
    if (!grouped.has(provider)) {
      grouped.set(provider, []);
    }
    grouped.get(provider)!.push(model);
  }

  return grouped;
}

/**
 * Format cost display
 */
export function formatCost(costPer1k: number | undefined): string {
  if (costPer1k === undefined) {
    return '-';
  }

  // Format based on magnitude
  if (costPer1k >= 1) {
    return `$${costPer1k.toFixed(0)}`;
  } else if (costPer1k >= 0.1) {
    return `$${costPer1k.toFixed(1)}`;
  } else if (costPer1k >= 0.01) {
    return `$${costPer1k.toFixed(2)}`;
  } else {
    return `$${costPer1k.toFixed(4)}`;
  }
}

/**
 * Format context window size
 */
export function formatContextWindow(tokens: number | undefined): string {
  if (tokens === undefined) {
    return '-';
  }

  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(0)}M`;
  } else if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(0)}K`;
  }
  return String(tokens);
}
