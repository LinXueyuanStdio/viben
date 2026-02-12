/**
 * viben agent show - Show agent details
 *
 * Uses NAPI bindings to Rust viben-core.
 */

import chalk from 'chalk';
import type { OutputContext } from '../../types';
import { CliError } from '../../types';
import { output, successResponse } from '../../lib/output';
import { agentGet, type Agent } from '../../lib/native';

/**
 * Show agent details
 */
export async function showAgent(ctx: OutputContext, id: string): Promise<void> {
  const agent = await agentGet(id);

  if (!agent) {
    throw new CliError(`Agent "${id}" not found`, 'AGENT_NOT_FOUND');
  }

  output(
    ctx,
    successResponse({ agent }),
    () => {
      console.log(chalk.bold.underline(`Agent: ${agent.id}`));
      console.log();

      const printField = (label: string, value: string | number | boolean | undefined | null, defaultVal?: string) => {
        let displayValue: string;
        if (value === undefined || value === null) {
          displayValue = chalk.gray(defaultVal || '(not set)');
        } else if (typeof value === 'boolean') {
          displayValue = value ? chalk.green('yes') : chalk.gray('no');
        } else {
          displayValue = String(value);
        }
        console.log(`  ${chalk.cyan(label.padEnd(14))} ${displayValue}`);
      };

      printField('Name', agent.name);
      printField('Description', agent.description);
      printField('Model', agent.model, '(default)');
      printField('Provider', agent.provider, '(default)');
      printField('Executor', agent.executorType, 'CLAUDE_CODE');
      printField('System Prompt', agent.systemPrompt ? `${agent.systemPrompt.slice(0, 50)}...` : null);
      printField('Temperature', agent.temperature);
      printField('Max Tokens', agent.maxTokens);
      printField('Plan Mode', agent.planMode);
      printField('Approvals', agent.approvals);

      if (agent.path) {
        console.log();
        console.log(chalk.gray('Agent directory:'), agent.path);
      }
    }
  );
}
