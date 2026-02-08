/**
 * viben gateway - Start the Viben Gateway server
 */

import { Command } from 'commander';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

import { output, errorResponse, successResponse } from '../lib/output';
import type { OutputContext } from '../types';

interface GatewayOptions {
  host?: string;
  port?: number;
  logLevel?: string;
}

interface HealthCheckResponse {
  service: string;
  version: string;
  status: string;
}

/**
 * Find the viben-gateway binary
 * Looks in common installation locations
 */
function findGatewayBinary(): string | null {
  const possiblePaths = [
    // Development: build from source
    join(process.cwd(), 'crates', 'target', 'release', 'viben-gateway'),
    join(process.cwd(), 'crates', 'target', 'debug', 'viben-gateway'),
    // Global installation
    join(homedir(), '.viben', 'bin', 'viben-gateway'),
    // System-wide
    '/usr/local/bin/viben-gateway',
    '/opt/viben/bin/viben-gateway',
  ];

  for (const path of possiblePaths) {
    if (existsSync(path)) {
      return path;
    }
  }

  return null;
}

/**
 * Start the gateway server
 */
export async function startGateway(
  options: GatewayOptions,
  ctx: OutputContext
): Promise<void> {
  const binaryPath = findGatewayBinary();

  if (!binaryPath) {
    output(
      ctx,
      errorResponse(
        'GATEWAY_NOT_FOUND',
        'Viben Gateway binary not found.'
      ),
      () => {
        console.error('Viben Gateway binary not found.');
        console.error('');
        console.error('To build from source:');
        console.error('  cd crates && cargo build --release');
        console.error('');
        console.error('Or install the pre-built binary:');
        console.error('  viben install gateway');
      }
    );
    return;
  }

  // Set environment variables for the gateway
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    RUST_LOG: options.logLevel || 'info',
  };

  if (options.host) {
    env.VIBEN_GATEWAY_HOST = options.host;
  }

  if (options.port) {
    env.VIBEN_GATEWAY_PORT = String(options.port);
  }

  const host = options.host || '127.0.0.1';
  const port = options.port || 18790;

  if (!ctx.quiet) {
    console.log(`Starting Viben Gateway on http://${host}:${port}...`);
    console.log(`Binary: ${binaryPath}`);
    if (ctx.verbose) {
      console.log(`Log level: ${options.logLevel || 'info'}`);
    }
  }

  // Spawn the gateway process
  const child = spawn(binaryPath, [], {
    env,
    stdio: 'inherit',
    detached: false,
  });

  // Handle process exit
  child.on('error', (err) => {
    output(
      ctx,
      errorResponse('GATEWAY_START_FAILED', `Failed to start gateway: ${err.message}`),
      () => {
        console.error(`Failed to start gateway: ${err.message}`);
      }
    );
  });

  child.on('exit', (code, signal) => {
    if (code !== 0 && code !== null) {
      console.error(`Gateway exited with code ${code}`);
    } else if (signal) {
      console.log(`Gateway terminated by signal ${signal}`);
    }
  });

  // Handle SIGINT/SIGTERM to gracefully shutdown
  const shutdown = () => {
    if (!ctx.quiet) {
      console.log('\nShutting down gateway...');
    }
    child.kill('SIGTERM');
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

/**
 * Check gateway status
 */
export async function gatewayStatus(ctx: OutputContext): Promise<void> {
  const host = process.env.VIBEN_GATEWAY_HOST || '127.0.0.1';
  const port = process.env.VIBEN_GATEWAY_PORT || '18790';
  const url = `http://${host}:${port}/health`;

  try {
    const response = await fetch(url);
    if (response.ok) {
      const data = (await response.json()) as HealthCheckResponse;
      output(
        ctx,
        successResponse({ gatewayStatus: 'running', service: data.service, version: data.version, healthStatus: data.status }),
        () => {
          console.log(`Gateway is running at http://${host}:${port}`);
          console.log(`  Service: ${data.service}`);
          console.log(`  Version: ${data.version}`);
          console.log(`  Status: ${data.status}`);
        }
      );
    } else {
      output(
        ctx,
        errorResponse('GATEWAY_UNHEALTHY', `Gateway returned status ${response.status}`),
        () => {
          console.error(`Gateway returned status ${response.status}`);
        }
      );
    }
  } catch (err) {
    output(
      ctx,
      successResponse({ status: 'stopped', error: (err as Error).message }),
      () => {
        console.log(`Gateway is not running at http://${host}:${port}`);
        if (ctx.verbose) {
          console.log(`  Error: ${(err as Error).message}`);
        }
      }
    );
  }
}

/**
 * Register gateway commands
 */
export function registerGatewayCommand(program: Command): void {
  const gateway = program
    .command('gateway')
    .description('Viben Gateway server management');

  gateway
    .command('start')
    .description('Start the Viben Gateway server')
    .option('-H, --host <host>', 'Host to bind to', '127.0.0.1')
    .option('-p, --port <port>', 'Port to listen on', '18790')
    .option('-l, --log-level <level>', 'Log level (debug, info, warn, error)', 'info')
    .action(async (options) => {
      const ctx = program.opts() as OutputContext;
      await startGateway(
        {
          host: options.host,
          port: parseInt(options.port, 10),
          logLevel: options.logLevel,
        },
        ctx
      );
    });

  gateway
    .command('status')
    .description('Check if the gateway is running')
    .action(async () => {
      const ctx = program.opts() as OutputContext;
      await gatewayStatus(ctx);
    });

  // Default action (no subcommand) - start the gateway
  gateway.action(async () => {
    const ctx = program.opts() as OutputContext;
    await startGateway({}, ctx);
  });
}
