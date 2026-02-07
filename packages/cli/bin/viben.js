#!/usr/bin/env node

/**
 * Viben CLI Entry Point
 *
 * This script serves as the main entry point for the Viben CLI.
 * It routes to either:
 * - The TypeScript CLI (Commander.js) for workspace management commands
 * - The Python browse-mcp wrapper for MCP server functionality
 *
 * Usage:
 *   viben init                # Initialize workspace (TypeScript CLI)
 *   viben config list         # List config (TypeScript CLI)
 *   viben agent list          # List agents (TypeScript CLI)
 *   viben channel list        # List channels (TypeScript CLI)
 *   viben cron list           # List cron jobs (TypeScript CLI)
 *   viben serve               # Start MCP server (Python wrapper)
 *   viben mcp                 # Start MCP server (Python wrapper, alias)
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { spawnSync, execSync } from 'child_process';
import { platform } from 'os';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration for Python wrapper
const PYTHON_PACKAGE = 'browse-mcp';
const MIN_PYTHON_VERSION = '3.10';
const BRAND_NAME = 'Viben';

// Commands that should be handled by the TypeScript CLI
const TS_CLI_COMMANDS = ['init', 'config', 'agent', 'channel', 'cron'];

// Commands that should be handled by the Python wrapper
const PYTHON_COMMANDS = ['serve', 'mcp'];

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function info(message) {
  console.log(`${colors.blue}[INFO]${colors.reset} ${message}`);
}

function success(message) {
  console.log(`${colors.green}[OK]${colors.reset} ${message}`);
}

function warn(message) {
  console.log(`${colors.yellow}[WARN]${colors.reset} ${message}`);
}

function error(message) {
  console.error(`${colors.red}[ERROR]${colors.reset} ${message}`);
}

function commandExists(cmd) {
  try {
    const isWindows = platform() === 'win32';
    const checkCmd = isWindows ? `where ${cmd}` : `command -v ${cmd}`;
    execSync(checkCmd, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function getPythonVersion(pythonCmd) {
  try {
    const result = execSync(
      `${pythonCmd} -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    return result.trim();
  } catch {
    return null;
  }
}

function versionGte(version, minVersion) {
  const v1 = version.split('.').map(Number);
  const v2 = minVersion.split('.').map(Number);

  for (let i = 0; i < Math.max(v1.length, v2.length); i++) {
    const a = v1[i] || 0;
    const b = v2[i] || 0;
    if (a > b) return true;
    if (a < b) return false;
  }
  return true;
}

function findPython() {
  const candidates = ['python3', 'python'];

  for (const cmd of candidates) {
    if (commandExists(cmd)) {
      const version = getPythonVersion(cmd);
      if (version && versionGte(version, MIN_PYTHON_VERSION)) {
        return { cmd, version };
      }
    }
  }

  return null;
}

function isBrowseMcpInstalled(pythonCmd) {
  try {
    execSync(`${pythonCmd} -c "import browse_mcp"`, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return true;
  } catch {
    return false;
  }
}

function browseMcpCommandExists() {
  return commandExists('browse-mcp');
}

function installBrowseMcp(pythonCmd) {
  info(`Installing ${PYTHON_PACKAGE}...`);

  if (commandExists('uv')) {
    info('Using uv for installation...');
    let result = spawnSync('uv', ['pip', 'install', PYTHON_PACKAGE], {
      stdio: 'inherit',
    });
    if (result.status === 0) {
      success(`${PYTHON_PACKAGE} installed successfully`);
      return true;
    }
    result = spawnSync('uv', ['pip', 'install', '--system', PYTHON_PACKAGE], {
      stdio: 'inherit',
    });
    if (result.status === 0) {
      success(`${PYTHON_PACKAGE} installed successfully`);
      return true;
    }
  }

  if (commandExists('pip3')) {
    info('Using pip3 for installation...');
    const result = spawnSync('pip3', ['install', PYTHON_PACKAGE], {
      stdio: 'inherit',
    });
    if (result.status === 0) {
      success(`${PYTHON_PACKAGE} installed successfully`);
      return true;
    }
  }

  if (commandExists('pip')) {
    info('Using pip for installation...');
    const result = spawnSync('pip', ['install', PYTHON_PACKAGE], {
      stdio: 'inherit',
    });
    if (result.status === 0) {
      success(`${PYTHON_PACKAGE} installed successfully`);
      return true;
    }
  }

  if (pythonCmd) {
    info(`Using ${pythonCmd} -m pip for installation...`);
    const result = spawnSync(pythonCmd, ['-m', 'pip', 'install', PYTHON_PACKAGE], {
      stdio: 'inherit',
    });
    if (result.status === 0) {
      success(`${PYTHON_PACKAGE} installed successfully`);
      return true;
    }
  }

  return false;
}

function runBrowseMcp(args, pythonCmd) {
  if (browseMcpCommandExists()) {
    const result = spawnSync('browse-mcp', args, { stdio: 'inherit' });
    process.exit(result.status || 0);
  }

  if (pythonCmd) {
    const result = spawnSync(pythonCmd, ['-m', 'browse_mcp', ...args], {
      stdio: 'inherit',
    });
    process.exit(result.status || 0);
  }

  error('Could not run browse-mcp');
  process.exit(1);
}

async function runTypeScriptCli(args) {
  try {
    const { run } = await import('../dist/index.js');
    await run(['node', 'viben', ...args]);
  } catch (err) {
    // If dist doesn't exist, try running from source (development mode)
    try {
      const { run } = await import('../src/index.ts');
      await run(['node', 'viben', ...args]);
    } catch {
      error('CLI not built. Run "npm run build" in packages/cli first.');
      console.error(err);
      process.exit(1);
    }
  }
}

function handlePythonCommand(args) {
  // Remove 'serve' or 'mcp' from args if present
  const filteredArgs = args.filter((a) => a !== 'serve' && a !== 'mcp');

  const python = findPython();
  if (!python) {
    error(`Python ${MIN_PYTHON_VERSION}+ is required but not found.`);
    console.log('');
    console.log('Please install Python:');
    if (platform() === 'darwin') {
      console.log('  brew install python@3.12');
    } else if (platform() === 'linux') {
      console.log('  sudo apt install python3 python3-pip');
    } else {
      console.log('  https://www.python.org/downloads/');
    }
    process.exit(1);
  }

  const isInstalled = browseMcpCommandExists() || isBrowseMcpInstalled(python.cmd);

  if (!isInstalled) {
    warn(`${PYTHON_PACKAGE} is not installed.`);
    console.log('');
    info('Installing automatically...');
    if (!installBrowseMcp(python.cmd)) {
      error('Automatic installation failed.');
      console.log('');
      console.log('Please install manually:');
      console.log(`  pip install ${PYTHON_PACKAGE}`);
      console.log('');
      console.log('Or with uv:');
      console.log(`  uv pip install ${PYTHON_PACKAGE}`);
      process.exit(1);
    }
    console.log('');
  }

  runBrowseMcp(filteredArgs, python.cmd);
}

function printHelp() {
  const pkg = require('../package.json');
  console.log(`
${colors.cyan}${colors.bold}${BRAND_NAME} CLI${colors.reset} v${pkg.version}

Orchestrate AI agent clusters in your local workspace.

${colors.bold}Usage:${colors.reset}
  viben <command> [options]

${colors.bold}Workspace Commands:${colors.reset}
  init                  Initialize a Viben workspace
  config <subcommand>   Manage configuration (get, set, list, edit, unset)
  agent <subcommand>    Manage agents (list, create, show)
  channel <subcommand>  Manage chat channels (list, create, remove, status)
  cron <subcommand>     Manage scheduled tasks (list, add, remove, run)

${colors.bold}Server Commands:${colors.reset}
  serve                 Start the MCP server (browse-mcp)
  mcp                   Alias for serve

${colors.bold}Global Options:${colors.reset}
  --json                Output in JSON format
  -g, --global          Use global scope
  -w, --workspace       Use workspace scope
  --verbose             Enable verbose output
  -q, --quiet           Suppress non-essential output
  -v, --version         Show version
  -h, --help            Show help

${colors.bold}Examples:${colors.reset}
  viben init                    # Initialize workspace
  viben config list             # List all config
  viben config set settings.editor vim
  viben agent list              # List all agents
  viben agent create -n my-agent
  viben serve                   # Start MCP server
  viben serve -t sse --port 8080

${colors.bold}Environment Variables:${colors.reset}
  VIBEN_STATE_DIR       State directory (default: ~/.viben)
  VIBEN_AGENT           Current agent ID
  VIBEN_SCOPE           Default scope (global/workspace)

${colors.bold}More information:${colors.reset}
  https://github.com/LinXueyuanStdio/viben
`);
}

/**
 * Find the first command (non-flag) argument
 */
function findCommand(args) {
  for (const arg of args) {
    if (!arg.startsWith('-')) {
      return arg;
    }
  }
  return null;
}

async function main() {
  const args = process.argv.slice(2);
  const firstArg = args[0];

  // Handle --install (Python package installation)
  if (args.includes('--install')) {
    const python = findPython();
    if (!python) {
      error(`Python ${MIN_PYTHON_VERSION}+ is required`);
      process.exit(1);
    }
    if (installBrowseMcp(python.cmd)) {
      success('Installation complete');
      process.exit(0);
    } else {
      error('Installation failed');
      process.exit(1);
    }
  }

  // Handle version (only if it's the only argument)
  if (args.length === 1 && (firstArg === '-v' || firstArg === '--version')) {
    const pkg = require('../package.json');
    console.log(`${BRAND_NAME} CLI v${pkg.version}`);
    process.exit(0);
  }

  // Handle help (only if no command is present)
  if (args.length === 0) {
    printHelp();
    process.exit(0);
  }

  // Find the first command argument (skip flags)
  const command = findCommand(args);

  // If only help flag and no command
  if (!command && (args.includes('-h') || args.includes('--help'))) {
    printHelp();
    process.exit(0);
  }

  // Route to appropriate handler based on command
  if (command && TS_CLI_COMMANDS.includes(command)) {
    // TypeScript CLI commands (pass all args including global flags)
    await runTypeScriptCli(args);
  } else if (command && PYTHON_COMMANDS.includes(command)) {
    // Python wrapper commands
    handlePythonCommand(args);
  } else if (command) {
    // Unknown command - try TypeScript CLI (it will show proper error)
    await runTypeScriptCli(args);
  } else {
    // No command found - show help
    printHelp();
    process.exit(0);
  }
}

main().catch((err) => {
  error(err.message || 'Unknown error');
  process.exit(1);
});
