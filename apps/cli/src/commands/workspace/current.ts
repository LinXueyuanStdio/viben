/**
 * viben workspace current - Show current workspace information
 */

import chalk from 'chalk';
import type { OutputContext } from '../../types';
import { output, successResponse, errorResponse } from '../../lib/output';
import { getCurrentWorkspace } from '../../lib/workspace';

/**
 * Show current workspace information
 */
export function showCurrentWorkspace(ctx: OutputContext): void {
  const workspace = getCurrentWorkspace();

  if (!workspace) {
    output(
      ctx,
      errorResponse('NOT_IN_WORKSPACE', 'Not in a workspace'),
      () => {
        console.log(chalk.gray('Not in a workspace.'));
        console.log();
        console.log('Initialize a workspace with:');
        console.log(chalk.cyan('  viben init'));
      }
    );
    return;
  }

  const mcpEnabled = workspace.mcp?.enabled || [];
  const skillsEnabled = workspace.skills?.enabled || [];
  const agents = workspace.agents || [];

  const response = successResponse({
    path: workspace.path,
    name: workspace.name,
    configPath: workspace.configPath,
    mcp: {
      enabled: mcpEnabled,
      count: mcpEnabled.length,
    },
    skills: {
      enabled: skillsEnabled,
      count: skillsEnabled.length,
    },
    agents: {
      list: agents,
      count: agents.length,
    },
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt,
  });

  output(ctx, response, () => {
    console.log(chalk.bold('Current Workspace:'));
    console.log();

    console.log(`  ${chalk.cyan('Path:')}    ${workspace.path}`);
    console.log(`  ${chalk.cyan('Name:')}    ${workspace.name}`);

    // MCP
    if (mcpEnabled.length > 0) {
      console.log(`  ${chalk.cyan('MCP:')}     ${mcpEnabled.join(', ')} (${mcpEnabled.length} enabled)`);
    } else {
      console.log(`  ${chalk.cyan('MCP:')}     ${chalk.gray('none')}`);
    }

    // Skills
    if (skillsEnabled.length > 0) {
      console.log(`  ${chalk.cyan('Skills:')}  ${skillsEnabled.join(', ')} (${skillsEnabled.length} enabled)`);
    } else {
      console.log(`  ${chalk.cyan('Skills:')}  ${chalk.gray('none')}`);
    }

    // Agents
    if (agents.length > 0) {
      console.log(`  ${chalk.cyan('Agents:')}  ${agents.join(', ')} (${agents.length})`);
    } else {
      console.log(`  ${chalk.cyan('Agents:')}  ${chalk.gray('none')}`);
    }
  });
}
