/**
 * viben model list - List available models
 */

import chalk from 'chalk';
import type { OutputContext } from '../../types';
import { output, successResponse, outputTable } from '../../lib/output';
import {
  listModels,
  groupModelsByProvider,
  formatContextWindow,
  formatCost,
} from '../../lib/models';

/**
 * List all available models
 */
export function listAvailableModels(ctx: OutputContext, providerFilter?: string): void {
  const models = listModels(providerFilter);
  const groupedModels = groupModelsByProvider(models);

  const responseData = {
    models: models.map((m) => ({
      id: m.id,
      provider: m.provider,
      isDefault: m.isDefault,
      contextWindow: m.capabilities?.context_window,
      costInput: m.capabilities?.cost_per_1k_input,
      costOutput: m.capabilities?.cost_per_1k_output,
    })),
    count: models.length,
    providers: Array.from(groupedModels.keys()),
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
          ['Model', 'Context', 'Cost (in/out)'],
          providerModels.map((model) => {
            const contextStr = formatContextWindow(model.capabilities?.context_window);
            const costStr = model.capabilities?.cost_per_1k_input !== undefined
              ? `${formatCost(model.capabilities.cost_per_1k_input)}/${formatCost(model.capabilities.cost_per_1k_output)}`
              : '-';

            const modelName = model.isDefault
              ? `${model.id}${chalk.yellow('*')}`
              : model.id;

            return [
              `    ${modelName}`,
              contextStr,
              costStr,
            ];
          })
        );

        console.log();
      }

      console.log(chalk.gray('* = default model'));
    }
  );
}
