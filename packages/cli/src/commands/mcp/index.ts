/**
 * viben mcp - MCP (Model Context Protocol) utilities
 */

import { Command } from 'commander';
import { spawn } from 'child_process';
import type { OutputContext } from '../../types';

interface InspectorOptions {
  config?: string;
  server?: string;
  cli?: boolean;
  transport?: string;
  serverUrl?: string;
  env?: string[];
}

/**
 * Start the MCP Inspector
 * This is a thin wrapper around @modelcontextprotocol/inspector
 */
export async function startInspector(
  args: string[],
  options: InspectorOptions,
  ctx: OutputContext
): Promise<void> {
  // Build arguments for mcp-inspector
  const inspectorArgs: string[] = [];

  // Add options
  if (options.config) {
    inspectorArgs.push('--config', options.config);
  }

  if (options.server) {
    inspectorArgs.push('--server', options.server);
  }

  if (options.cli) {
    inspectorArgs.push('--cli');
  }

  if (options.transport) {
    inspectorArgs.push('--transport', options.transport);
  }

  if (options.serverUrl) {
    inspectorArgs.push('--server-url', options.serverUrl);
  }

  // Add environment variables
  if (options.env && options.env.length > 0) {
    for (const envVar of options.env) {
      inspectorArgs.push('-e', envVar);
    }
  }

  // Add remaining arguments (command and its args)
  if (args.length > 0) {
    inspectorArgs.push('--', ...args);
  }

  if (!ctx.quiet) {
    console.log('Starting MCP Inspector Proxy...');
    if (ctx.verbose) {
      console.log(`Arguments: npx @modelcontextprotocol/inspector ${inspectorArgs.join(' ')}`);
    }
  }

  // Spawn the inspector using npx
  // Disable auto browser opening - we only want the proxy server
  const child = spawn('npx', ['@modelcontextprotocol/inspector', ...inspectorArgs], {
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      MCP_AUTO_OPEN_ENABLED: 'false',
    },
  });

  // Handle process exit
  child.on('error', (err) => {
    console.error(`Failed to start MCP Inspector: ${err.message}`);
    process.exit(1);
  });

  child.on('exit', (code, signal) => {
    if (code !== 0 && code !== null) {
      process.exit(code);
    } else if (signal) {
      console.log(`MCP Inspector terminated by signal ${signal}`);
    }
  });

  // Handle SIGINT/SIGTERM to gracefully shutdown
  const shutdown = () => {
    child.kill('SIGTERM');
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Wait for process to complete
  await new Promise<void>((resolve) => {
    child.on('exit', () => resolve());
  });
}

/**
 * Register MCP commands
 */
export function registerMcpCommand(program: Command): void {
  const mcp = program
    .command('mcp')
    .description('MCP (Model Context Protocol) utilities');

  mcp
    .command('inspector [command] [args...]')
    .description('Start the MCP Inspector for testing and debugging MCP servers')
    .option('-c, --config <path>', 'Path to config file (JSON format with mcpServers)')
    .option('-s, --server <name>', 'Server name from config file')
    .option('--cli', 'Run in CLI mode (non-interactive)')
    .option('-t, --transport <type>', 'Transport type (stdio, sse, http)')
    .option('-u, --server-url <url>', 'Server URL for SSE/HTTP transport')
    .option('-e, --env <key=value...>', 'Environment variables to pass to the MCP server')
    .allowUnknownOption()
    .action(async (command: string | undefined, args: string[], options) => {
      const ctx = program.opts() as OutputContext;
      const allArgs = command ? [command, ...args] : [];
      await startInspector(allArgs, options, ctx);
    });

  // Note: 'serve' subcommand is handled by bin/viben.js routing to Python wrapper
  // This entry is just for help display
  mcp
    .command('serve')
    .description('Start the MCP server (browse-mcp)')
    .allowUnknownOption()
    .action(() => {
      // This should never be reached - bin/viben.js routes to Python wrapper
      console.log('This command is handled by the Python wrapper.');
      console.log('If you see this message, there is a routing issue.');
      process.exit(1);
    });
}
