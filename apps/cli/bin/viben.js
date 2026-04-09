#!/usr/bin/env node

/**
 * Viben CLI Entry Point
 *
 * This script serves as the main entry point for the Viben CLI.
 * It routes to either:
 * - The @viben/core CLI for all commands
 * - The Python browse-mcp wrapper for MCP server functionality
 *
 * Usage:
 *   viben init                # Initialize workspace
 *   viben config list         # List config
 *   viben agent list          # List agents
 *   viben mcp serve           # Start MCP server (Python wrapper)
 */

import { spawnSync, execSync } from 'child_process';
import { platform } from 'os';

// Configuration for Python wrapper
const PYTHON_PACKAGE = 'browse-mcp';
const MIN_PYTHON_VERSION = '3.10';

// Subcommands of 'mcp' that should be handled by the Python wrapper
const MCP_PYTHON_SUBCOMMANDS = ['serve'];

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
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

function handlePythonCommand(args) {
  // Remove 'mcp' and 'serve' from args if present
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

async function runCoreCli(args) {
  try {
    const { run } = await import('../dist/index.js');
    await run(['node', 'viben', ...args]);
  } catch (err) {
    error('Failed to load Viben CLI');
    console.error(err);
    process.exit(1);
  }
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

/**
 * Find the subcommand (second non-flag argument)
 */
function findSubcommand(args) {
  let count = 0;
  for (const arg of args) {
    if (!arg.startsWith('-')) {
      count++;
      if (count === 2) {
        return arg;
      }
    }
  }
  return null;
}

async function main() {
  const args = process.argv.slice(2);
  const command = findCommand(args);

  // Handle Python-specific mcp subcommands
  if (command === 'mcp') {
    const subcommand = findSubcommand(args);
    if (subcommand && MCP_PYTHON_SUBCOMMANDS.includes(subcommand)) {
      // mcp serve -> Python wrapper
      handlePythonCommand(args);
      return;
    }
  }

  // All other commands go to @viben/core CLI
  await runCoreCli(args);
}

main().catch((err) => {
  error(err.message || 'Unknown error');
  process.exit(1);
});
