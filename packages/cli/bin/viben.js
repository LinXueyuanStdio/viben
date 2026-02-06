#!/usr/bin/env node

/**
 * Viben CLI Wrapper
 *
 * This script wraps the browse-mcp Python package, providing a convenient
 * way to run Viben via npx without manual Python setup.
 *
 * Usage:
 *   npx viben              # Run the MCP server
 *   npx viben --help       # Show help
 *   npx viben serve        # Explicit serve command
 */

const { spawnSync, execSync } = require("child_process");
const { platform } = require("os");

// Configuration
const PYTHON_PACKAGE = "browse-mcp";
const MIN_PYTHON_VERSION = "3.10";
const BRAND_NAME = "Viben";

// ANSI colors
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
};

/**
 * Print colored message
 */
function log(message, color = "") {
  console.log(`${color}${message}${colors.reset}`);
}

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

/**
 * Check if a command exists
 */
function commandExists(cmd) {
  try {
    const isWindows = platform() === "win32";
    const checkCmd = isWindows ? `where ${cmd}` : `command -v ${cmd}`;
    execSync(checkCmd, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get Python version
 */
function getPythonVersion(pythonCmd) {
  try {
    const result = execSync(
      `${pythonCmd} -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"`,
      { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
    );
    return result.trim();
  } catch {
    return null;
  }
}

/**
 * Compare version strings
 */
function versionGte(version, minVersion) {
  const v1 = version.split(".").map(Number);
  const v2 = minVersion.split(".").map(Number);

  for (let i = 0; i < Math.max(v1.length, v2.length); i++) {
    const a = v1[i] || 0;
    const b = v2[i] || 0;
    if (a > b) return true;
    if (a < b) return false;
  }
  return true;
}

/**
 * Find suitable Python command
 */
function findPython() {
  const candidates = ["python3", "python"];

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

/**
 * Check if browse-mcp is installed
 */
function isBrowseMcpInstalled(pythonCmd) {
  try {
    execSync(`${pythonCmd} -c "import browse_mcp"`, {
      stdio: ["pipe", "pipe", "pipe"],
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if browse-mcp command is available
 */
function browseMcpCommandExists() {
  return commandExists("browse-mcp");
}

/**
 * Install browse-mcp package
 */
function installBrowseMcp(pythonCmd) {
  info(`Installing ${PYTHON_PACKAGE}...`);

  // Try uv first (faster)
  if (commandExists("uv")) {
    info("Using uv for installation...");
    const result = spawnSync("uv", ["pip", "install", PYTHON_PACKAGE], {
      stdio: "inherit",
    });
    if (result.status === 0) {
      success(`${PYTHON_PACKAGE} installed successfully`);
      return true;
    }
    // Try with --system flag
    const resultSystem = spawnSync(
      "uv",
      ["pip", "install", "--system", PYTHON_PACKAGE],
      { stdio: "inherit" }
    );
    if (resultSystem.status === 0) {
      success(`${PYTHON_PACKAGE} installed successfully`);
      return true;
    }
  }

  // Try pip3
  if (commandExists("pip3")) {
    info("Using pip3 for installation...");
    const result = spawnSync("pip3", ["install", PYTHON_PACKAGE], {
      stdio: "inherit",
    });
    if (result.status === 0) {
      success(`${PYTHON_PACKAGE} installed successfully`);
      return true;
    }
  }

  // Try pip
  if (commandExists("pip")) {
    info("Using pip for installation...");
    const result = spawnSync("pip", ["install", PYTHON_PACKAGE], {
      stdio: "inherit",
    });
    if (result.status === 0) {
      success(`${PYTHON_PACKAGE} installed successfully`);
      return true;
    }
  }

  // Try python -m pip
  if (pythonCmd) {
    info(`Using ${pythonCmd} -m pip for installation...`);
    const result = spawnSync(pythonCmd, ["-m", "pip", "install", PYTHON_PACKAGE], {
      stdio: "inherit",
    });
    if (result.status === 0) {
      success(`${PYTHON_PACKAGE} installed successfully`);
      return true;
    }
  }

  return false;
}

/**
 * Run browse-mcp with given arguments
 */
function runBrowseMcp(args, pythonCmd) {
  // Try browse-mcp command first
  if (browseMcpCommandExists()) {
    const result = spawnSync("browse-mcp", args, { stdio: "inherit" });
    process.exit(result.status || 0);
  }

  // Fall back to python -m browse_mcp
  if (pythonCmd) {
    const result = spawnSync(pythonCmd, ["-m", "browse_mcp", ...args], {
      stdio: "inherit",
    });
    process.exit(result.status || 0);
  }

  error("Could not run browse-mcp");
  process.exit(1);
}

/**
 * Print help message
 */
function printHelp() {
  console.log(`
${colors.cyan}${colors.bold}${BRAND_NAME} CLI${colors.reset}

A wrapper for the ${PYTHON_PACKAGE} Python package.

${colors.bold}Usage:${colors.reset}
  npx viben [OPTIONS] [COMMAND]

${colors.bold}Options:${colors.reset}
  --help, -h          Show this help message
  --install           Force reinstall ${PYTHON_PACKAGE}
  --version, -v       Show version

${colors.bold}Commands:${colors.reset}
  (default)           Start the MCP server (stdio mode)
  serve               Start the MCP server
  --host <host>       Bind host (SSE/HTTP only)
  --port <port>       Bind port (SSE/HTTP only)
  -t, --transport     Transport: stdio, sse, streamable-http, http

${colors.bold}Examples:${colors.reset}
  npx viben                    # Start MCP server
  npx viben --help             # Show browse-mcp help
  npx viben -t sse --port 8080 # Start SSE server

${colors.bold}Requirements:${colors.reset}
  - Python ${MIN_PYTHON_VERSION}+
  - pip or uv package manager

${colors.bold}More information:${colors.reset}
  https://github.com/LinXueyuanStdio/viben
`);
}

/**
 * Main entry point
 */
function main() {
  const args = process.argv.slice(2);

  // Handle --help for this wrapper
  if (args.includes("--install")) {
    const python = findPython();
    if (!python) {
      error(`Python ${MIN_PYTHON_VERSION}+ is required`);
      process.exit(1);
    }
    if (installBrowseMcp(python.cmd)) {
      success("Installation complete");
      process.exit(0);
    } else {
      error("Installation failed");
      process.exit(1);
    }
  }

  // Handle wrapper-specific help
  if (args.length === 1 && (args[0] === "-h" || args[0] === "--help")) {
    printHelp();
    process.exit(0);
  }

  // Handle version
  if (args.length === 1 && (args[0] === "-v" || args[0] === "--version")) {
    const pkg = require("../package.json");
    console.log(`${BRAND_NAME} CLI v${pkg.version}`);
    console.log(`Wraps: ${PYTHON_PACKAGE}`);
    process.exit(0);
  }

  // Check Python
  const python = findPython();
  if (!python) {
    error(`Python ${MIN_PYTHON_VERSION}+ is required but not found.`);
    console.log("");
    console.log("Please install Python:");
    if (platform() === "darwin") {
      console.log("  brew install python@3.12");
    } else if (platform() === "linux") {
      console.log("  sudo apt install python3 python3-pip");
    } else {
      console.log("  https://www.python.org/downloads/");
    }
    process.exit(1);
  }

  // Check if browse-mcp is installed
  const isInstalled =
    browseMcpCommandExists() || isBrowseMcpInstalled(python.cmd);

  if (!isInstalled) {
    warn(`${PYTHON_PACKAGE} is not installed.`);
    console.log("");

    // Auto-install
    info("Installing automatically...");
    if (!installBrowseMcp(python.cmd)) {
      error("Automatic installation failed.");
      console.log("");
      console.log("Please install manually:");
      console.log(`  pip install ${PYTHON_PACKAGE}`);
      console.log("");
      console.log("Or with uv:");
      console.log(`  uv pip install ${PYTHON_PACKAGE}`);
      process.exit(1);
    }
    console.log("");
  }

  // Run browse-mcp with all arguments
  runBrowseMcp(args, python.cmd);
}

main();
