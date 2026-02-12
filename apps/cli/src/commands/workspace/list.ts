/**
 * viben workspace list - List all known workspaces
 */

import chalk from 'chalk';
import type { OutputContext } from '../../types';
import { output, successResponse, outputTable } from '../../lib/output';
import { listWorkspaces, getCurrentWorkspacePath } from '../../lib/workspace';

/**
 * List all known workspaces
 */
export async function listWorkspacesCommand(ctx: OutputContext): Promise<void> {
  const workspaces = await listWorkspaces();
  const currentPath = getCurrentWorkspacePath();

  const response = successResponse({
    current: currentPath,
    workspaces: workspaces.map((ws) => ({
      path: ws.path,
      name: ws.name,
      mcp: ws.mcp?.enabled || [],
      skills: ws.skills?.enabled || [],
      agents: ws.agents || [],
      isCurrent: ws.path === currentPath,
    })),
    count: workspaces.length,
  });

  output(ctx, response, () => {
    if (workspaces.length === 0) {
      console.log(chalk.gray('No known workspaces.'));
      console.log();
      console.log('Initialize a workspace with:');
      console.log(chalk.cyan('  viben init'));
      return;
    }

    console.log(chalk.bold('Known Workspaces:'));
    console.log();

    const headers = ['Name', 'Path', 'MCP', 'Skills'];
    const rows = workspaces.map((ws) => {
      const name = ws.path === currentPath
        ? `${ws.name}${chalk.yellow('*')}`
        : ws.name;

      const mcpCount = ws.mcp?.enabled?.length || 0;
      const skillsCount = ws.skills?.enabled?.length || 0;

      return [
        name,
        chalk.gray(ws.path),
        mcpCount > 0 ? chalk.green(`${mcpCount} enabled`) : chalk.gray('none'),
        skillsCount > 0 ? chalk.green(`${skillsCount} enabled`) : chalk.gray('none'),
      ];
    });

    outputTable({ ...ctx, json: false }, headers, rows);

    if (currentPath) {
      console.log();
      console.log(chalk.yellow('* = current workspace'));
    }
  });
}
