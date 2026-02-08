import type { Options } from '@wdio/types';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Determine the path to the Tauri binary
function getTauriBinaryPath(): string {
  const platform = os.platform();
  const binaryName = platform === 'win32' ? 'viben-desktop.exe' : 'viben-desktop';

  // Check for release build first, then debug
  const releaseDir = path.join(
    __dirname,
    'src-tauri',
    'target',
    'release',
    binaryName
  );
  const debugDir = path.join(
    __dirname,
    'src-tauri',
    'target',
    'debug',
    binaryName
  );

  // Check if release exists, otherwise use debug
  if (fs.existsSync(releaseDir)) {
    return releaseDir;
  }
  return debugDir;
}

export const config: Options.Testrunner = {
  // ====================
  // Runner Configuration
  // ====================
  runner: 'local',
  autoCompileOpts: {
    tsNodeOpts: {
      project: './tsconfig.json',
    },
  },

  // ==================
  // Specify Test Files
  // ==================
  specs: ['./tests/e2e/**/*.spec.ts'],
  exclude: [],

  // ============
  // Capabilities
  // ============
  maxInstances: 1, // Tauri only supports one instance at a time
  capabilities: [
    {
      maxInstances: 1,
      'tauri:options': {
        application: getTauriBinaryPath(),
      },
    } as WebdriverIO.Capabilities,
  ],

  // ===================
  // Test Configurations
  // ===================
  logLevel: 'info',
  bail: 0,
  baseUrl: '',
  waitforTimeout: 10000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,

  // Use tauri-driver as the service
  hostname: '127.0.0.1',
  port: 4444,

  // Framework
  framework: 'mocha',
  reporters: ['spec'],

  // Mocha options
  mochaOpts: {
    ui: 'bdd',
    timeout: 60000,
  },

  // =====
  // Hooks
  // =====
  onPrepare: async function () {
    // Start tauri-driver before tests
    const { spawn } = await import('child_process');
    const tauriDriver = spawn('tauri-driver', [], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // Wait for tauri-driver to be ready
    await new Promise<void>((resolve) => {
      tauriDriver.stdout?.on('data', (data: Buffer) => {
        const output = data.toString();
        if (output.includes('listening')) {
          resolve();
        }
      });
      // Timeout after 10 seconds
      setTimeout(resolve, 10000);
    });

    // Store the process for cleanup
    (global as any).__TAURI_DRIVER__ = tauriDriver;
  },

  onComplete: async function () {
    // Kill tauri-driver after tests
    const tauriDriver = (global as any).__TAURI_DRIVER__;
    if (tauriDriver) {
      tauriDriver.kill();
    }
  },
};
