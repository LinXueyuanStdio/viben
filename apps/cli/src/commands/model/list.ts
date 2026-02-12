/**
 * viben model list - List available models
 *
 * Uses NAPI bindings to Rust viben-core.
 */

import chalk from 'chalk';
import type { OutputContext } from '../../types';
import { output, successResponse, outputTable } from '../../lib/output';
import { modelList, modelGetDefault, type Model } from '../../lib/native';

/**
 * Format context window for display
 */
function formatContextWindow(contextWindow?: number): string {
  if (!contextWindow) return chalk.gray('-');
  if (contextWindow >= 1000000) {
    return `${(contextWindow / 1000000).toFixed(1)}M`;
  }
  if (contextWindow >= 1000) {
    return `${Math.round(contextWindow / 1000)}K`;
  }
  return String(contextWindow);
}

/**
 * Group models by provider
 */
function groupModelsByProvider(models: Model[]): Map<string, Model[]> {
  const grouped = new Map<string, Model[]>();
  for (const model of models) {
    const provider = model.provider;
    if (!grouped.has(provider)) {
      grouped.set(provider, []);
    }
    grouped.get(provider)!.push(model);
  }
  return grouped;
}

/**
 * List all available models
 */
export async function listAvailableModels(ctx: OutputContext, providerFilter?: string): Promise<void> {
  let models = await modelList();
  const defaultId = await modelGetDefault();

  // Filter by provider if specified
  if (providerFilter) {
    models = models.filter((m: Model) =>
      m.provider.toLowerCase() === providerFilter.toLowerCase()
    );
  }

  const groupedModels = groupModelsByProvider(models);

  const responseData = {
    models: models.map((m: Model) => ({
      id: m.id,
      name: m.name,
      provider: m.provider,
      enabled: m.enabled,
      isDefault: m.isDefault,
      contextWindow: m.contextWindow,
      maxOutputTokens: m.maxOutputTokens,
    })),
    count: models.length,
    providers: Array.from(groupedModels.keys()),
    defaultModel: defaultId,
  };

  output(
    ctx,
    successResponse(responseData),
    () => {
      if (models.length === 0) {
        console.log(chalk.gray('No models configured.'));
        console.log();
        console.log('Configure a model with:');
        console.log(chalk.cyan('  viben model set-default -n <model-id>'));
        return;
      }

      console.log('Available Models:');
      console.log();

      // Output by provider
      for (const [provider, providerModels] of groupedModels) {
        console.log(chalk.bold(`  Provider: ${provider}`));

        outputTable(
          { ...ctx, json: false }, // Force human output for inner table
          ['Model', 'Name', 'Context', 'Max Output', 'Enabled'],
          providerModels.map((model: Model) => {
            const contextStr = formatContextWindow(model.contextWindow);
            const maxOutputStr = formatContextWindow(model.maxOutputTokens);

            const modelId = model.isDefault
              ? `${model.id}${chalk.yellow('*')}`
              : model.id;

            return [
              `    ${modelId}`,
              model.name || chalk.gray('(unnamed)'),
              contextStr,
              maxOutputStr,
              model.enabled ? chalk.green('yes') : chalk.gray('no'),
            ];
          })
        );

        console.log();
      }

      console.log(chalk.gray('* = default model'));
    }
  );
}
