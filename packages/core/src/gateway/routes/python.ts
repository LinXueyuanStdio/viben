/**
 * Python detection routes, CLI tools detection, and system info
 *
 * Provides Python interpreter detection, CLI tools detection (git, gh, claude),
 * package checking capabilities, and system information for onboarding and
 * environment setup.
 */
import type { FastifyInstance } from "fastify";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { homedir, platform, arch, hostname, release, type } from "node:os";
import { join } from "node:path";
import { access, constants, readdir, realpath } from "node:fs/promises";
import { getConfigPath } from "../../config/paths";
import { readYaml, writeYaml } from "../../config/yaml";
import { logger as globalLogger } from "../../telemetry";

// Module-level logger
const log = globalLogger.child({ module: "python" });

const execAsync = promisify(exec);

// ============================================================================
// Types
// ============================================================================

export interface PythonInfo {
  path: string;
  version: string | null;
  is_valid: boolean;
}

export interface PackageInfo {
  name: string;
  version: string | null;
  installed: boolean;
}

/**
 * A single detected CLI tool path
 */
export interface CliToolPath {
  path: string;
  version?: string;
  source: "user-config" | "homebrew" | "nvm" | "pyenv" | "pip" | "npm" | "cargo" | "system-path" | "fallback";
}

/**
 * CLI tool detection result
 */
export interface CliToolInfo {
  found: boolean;
  path?: string;
  version?: string;
  source: "user-config" | "homebrew" | "nvm" | "pyenv" | "pip" | "npm" | "cargo" | "system-path" | "fallback";
  message?: string;
  /** All discovered paths for this tool */
  alternatives?: CliToolPath[];
  /** User's selected path from config file */
  selectedPath?: string;
}

/**
 * Supported CLI tools
 */
export type CliToolName =
  | "python"  // Python interpreter
  | "git"     // Version control
  | "gh"      // GitHub CLI
  | "claude"  // Claude Code CLI
  | "codex"   // OpenAI Codex CLI
  | "aider"   // Aider coding assistant
  | "goose"   // Goose coding assistant
  | "cline"   // Cline CLI
  | "continue" // Continue dev CLI
  | "cursor"  // Cursor CLI (if available)
  | "viben";  // Viben CLI

/**
 * All CLI tools detection result
 */
export interface CliToolsInfo {
  python: CliToolInfo;
  git: CliToolInfo;
  gh: CliToolInfo;
  claude: CliToolInfo;
  codex: CliToolInfo;
  aider: CliToolInfo;
  goose: CliToolInfo;
  cline: CliToolInfo;
  continue: CliToolInfo;
  cursor: CliToolInfo;
  viben: CliToolInfo;
}

/**
 * CLI tools selected paths stored in config.yaml under cli_tools key
 */
export interface CliToolsConfig {
  python?: string;
  git?: string;
  gh?: string;
  claude?: string;
  codex?: string;
  aider?: string;
  goose?: string;
  cline?: string;
  continue?: string;
  cursor?: string;
  viben?: string;
}

// ============================================================================
// Config File Operations
// ============================================================================

/**
 * Read CLI tools selected paths from ~/.viben/config.yaml
 */
async function readCliToolsConfig(): Promise<CliToolsConfig> {
  const configPath = getConfigPath();
  const config = await readYaml<Record<string, unknown>>(configPath);
  return (config?.cli_tools as CliToolsConfig) || {};
}

/**
 * Write CLI tools selected paths to ~/.viben/config.yaml
 */
async function writeCliToolsConfig(cliTools: CliToolsConfig): Promise<void> {
  const configPath = getConfigPath();
  const config = await readYaml<Record<string, unknown>>(configPath) || {};
  config.cli_tools = cliTools;
  await writeYaml(configPath, config);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get Python interpreter candidates based on platform
 */
function getPythonCandidates(): string[] {
  const candidates: string[] = [];
  const home = homedir();

  // Common paths for all platforms
  candidates.push("python3", "python");

  if (process.platform === "darwin") {
    // macOS paths
    candidates.push(
      "/usr/bin/python3",
      "/usr/local/bin/python3",
      "/opt/homebrew/bin/python3",
      "/opt/homebrew/bin/python3.13",
      "/opt/homebrew/bin/python3.12",
      "/opt/homebrew/bin/python3.11",
      "/opt/homebrew/bin/python3.10",
      join(home, ".pyenv/shims/python3"),
    );
  } else if (process.platform === "win32") {
    // Windows paths
    const localAppData = process.env.LOCALAPPDATA || join(home, "AppData/Local");
    candidates.push(
      join(localAppData, "Programs/Python/Python313/python.exe"),
      join(localAppData, "Programs/Python/Python312/python.exe"),
      join(localAppData, "Programs/Python/Python311/python.exe"),
      join(localAppData, "Programs/Python/Python310/python.exe"),
    );
  } else {
    // Linux paths
    candidates.push(
      "/usr/bin/python3",
      "/usr/bin/python",
      "/usr/local/bin/python3",
      join(home, ".pyenv/shims/python3"),
    );
  }

  return candidates;
}

/**
 * Check if a path exists and is executable
 */
async function isExecutable(path: string): Promise<boolean> {
  try {
    await access(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check a Python interpreter and get its version
 */
async function checkPython(path: string): Promise<PythonInfo | null> {
  try {
    // For non-absolute paths, use which to resolve
    let actualPath = path;
    if (!path.startsWith("/") && !path.includes("\\")) {
      try {
        const { stdout } = await execAsync(`which ${path}`);
        actualPath = stdout.trim();
      } catch {
        // which failed, try the path directly
      }
    }

    // Check if file exists and is executable
    if (actualPath.startsWith("/") || actualPath.includes("\\")) {
      if (!await isExecutable(actualPath)) {
        return null;
      }
    }

    // Get Python version
    const { stdout, stderr } = await execAsync(`"${actualPath}" --version`, {
      timeout: 5000,
    });

    const versionOutput = stdout.trim() || stderr.trim();
    const versionMatch = versionOutput.match(/Python\s+(\d+\.\d+\.\d+)/);
    const version = versionMatch ? versionMatch[1] : null;

    // Check if version >= 3.10
    let isValid = false;
    if (version) {
      const parts = version.split(".");
      if (parts.length >= 2) {
        const major = parseInt(parts[0], 10);
        const minor = parseInt(parts[1], 10);
        isValid = major >= 3 && minor >= 10;
      }
    }

    return {
      path: actualPath,
      version,
      is_valid: isValid,
    };
  } catch {
    return null;
  }
}

/**
 * Detect all available Python interpreters
 */
async function detectPythonInterpreters(): Promise<PythonInfo[]> {
  const candidates = getPythonCandidates();
  const pythons: PythonInfo[] = [];
  const seenVersions = new Set<string>();

  for (const candidate of candidates) {
    const info = await checkPython(candidate);
    if (info) {
      // Avoid duplicates (same version at different paths)
      const key = `${info.version}-${info.is_valid}`;
      if (!seenVersions.has(key)) {
        seenVersions.add(key);
        pythons.push(info);
      }
    }
  }

  return pythons;
}

// ============================================================================
// CLI Tools Detection
// ============================================================================

/**
 * Tool configuration for detection
 */
interface ToolConfig {
  // Version command to run (default: --version)
  versionArg?: string;
  // Regex to extract version from output
  versionRegex?: RegExp;
  // Special detection method
  detectMethod?: "python" | "npm-global" | "pip" | "cargo" | "standard";
  // Additional candidate paths
  extraPaths?: string[];
}

/**
 * Tool configurations
 */
const TOOL_CONFIGS: Record<CliToolName, ToolConfig> = {
  python: {
    versionArg: "--version",
    versionRegex: /Python\s+(\d+\.\d+\.\d+)/,
    detectMethod: "python",
  },
  git: {
    versionArg: "--version",
    versionRegex: /git version (\d+\.\d+\.\d+)/,
  },
  gh: {
    versionArg: "--version",
    versionRegex: /gh version (\d+\.\d+\.\d+)/,
  },
  claude: {
    versionArg: "--version",
    versionRegex: /(\d+\.\d+\.\d+)/,
    detectMethod: "npm-global",
  },
  codex: {
    versionArg: "--version",
    versionRegex: /(\d+\.\d+\.\d+)/,
    detectMethod: "npm-global",
  },
  aider: {
    versionArg: "--version",
    versionRegex: /aider (\d+\.\d+\.\d+)|(\d+\.\d+\.\d+)/,
    detectMethod: "pip",
  },
  goose: {
    versionArg: "--version",
    versionRegex: /(\d+\.\d+\.\d+)/,
    detectMethod: "pip",
  },
  cline: {
    versionArg: "--version",
    versionRegex: /(\d+\.\d+\.\d+)/,
    detectMethod: "npm-global",
  },
  continue: {
    versionArg: "--version",
    versionRegex: /(\d+\.\d+\.\d+)/,
    detectMethod: "npm-global",
  },
  cursor: {
    versionArg: "--version",
    versionRegex: /(\d+\.\d+\.\d+)/,
  },
  viben: {
    versionArg: "--version",
    versionRegex: /(\d+\.\d+\.\d+)/,
    detectMethod: "npm-global",
  },
};

/**
 * Get CLI tool candidates based on platform
 */
function getCliToolCandidates(tool: CliToolName): string[] {
  const candidates: string[] = [];
  const home = homedir();
  const config = TOOL_CONFIGS[tool];

  // Add extra paths from config
  if (config.extraPaths) {
    candidates.push(...config.extraPaths);
  }

  if (process.platform === "darwin") {
    // macOS: Homebrew paths (Apple Silicon and Intel)
    candidates.push(
      `/opt/homebrew/bin/${tool}`,
      `/usr/local/bin/${tool}`,
    );

    // Python-specific paths
    if (tool === "python") {
      candidates.push(
        "/usr/bin/python3",
        "/opt/homebrew/bin/python3",
        "/opt/homebrew/bin/python3.13",
        "/opt/homebrew/bin/python3.12",
        "/opt/homebrew/bin/python3.11",
        "/opt/homebrew/bin/python3.10",
        join(home, ".pyenv/shims/python3"),
        join(home, ".pyenv/shims/python"),
      );
    }

    // pip-installed tools
    if (config.detectMethod === "pip") {
      candidates.push(
        join(home, ".local/bin", tool),
        `/opt/homebrew/bin/${tool}`,
        join(home, "Library/Python/3.11/bin", tool),
        join(home, "Library/Python/3.12/bin", tool),
      );
    }

    // npm-global tools
    if (config.detectMethod === "npm-global") {
      candidates.push(
        join(home, ".npm-global/bin", tool),
        `/opt/homebrew/bin/${tool}`,
      );
    }

    // viben-specific paths
    if (tool === "viben") {
      candidates.push(
        "/opt/homebrew/bin/viben",
        "/usr/local/bin/viben",
        join(home, ".npm-global/bin/viben"),
      );
    }

    // Standard paths
    candidates.push(
      `/usr/bin/${tool}`,
      join(home, ".local/bin", tool),
      join(home, "bin", tool),
    );
  } else if (process.platform === "win32") {
    // Windows paths
    const localAppData = process.env.LOCALAPPDATA || join(home, "AppData/Local");
    const programFiles = process.env.ProgramFiles || "C:\\Program Files";
    const programFilesX86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";

    if (tool === "python") {
      candidates.push(
        join(localAppData, "Programs/Python/Python313/python.exe"),
        join(localAppData, "Programs/Python/Python312/python.exe"),
        join(localAppData, "Programs/Python/Python311/python.exe"),
        join(localAppData, "Programs/Python/Python310/python.exe"),
      );
    } else if (tool === "git") {
      candidates.push(
        join(programFiles, "Git/cmd/git.exe"),
        join(programFilesX86, "Git/cmd/git.exe"),
        join(programFiles, "Git/bin/git.exe"),
      );
    } else if (tool === "gh") {
      candidates.push(
        join(programFiles, "GitHub CLI/gh.exe"),
        join(programFilesX86, "GitHub CLI/gh.exe"),
      );
    } else if (config.detectMethod === "npm-global") {
      candidates.push(
        join(home, "AppData/Roaming/npm", `${tool}.cmd`),
        join(home, ".local/bin", `${tool}.exe`),
      );
    } else if (config.detectMethod === "pip") {
      candidates.push(
        join(home, "AppData/Local/Programs/Python/Python312/Scripts", `${tool}.exe`),
        join(home, "AppData/Local/Programs/Python/Python311/Scripts", `${tool}.exe`),
      );
    }

    // viben-specific paths (Windows)
    if (tool === "viben") {
      const appData = process.env.APPDATA || join(home, "AppData/Roaming");
      candidates.push(
        join(appData, "npm/viben.cmd"),
        join(home, "scoop/shims/viben.exe"),
      );
    }
  } else {
    // Linux paths
    candidates.push(
      `/usr/bin/${tool}`,
      `/usr/local/bin/${tool}`,
      join(home, ".local/bin", tool),
      join(home, "bin", tool),
    );

    if (tool === "python") {
      candidates.push(
        "/usr/bin/python3",
        join(home, ".pyenv/shims/python3"),
        join(home, ".pyenv/shims/python"),
      );
    }

    if (config.detectMethod === "pip") {
      candidates.push(join(home, ".local/bin", tool));
    }

    if (config.detectMethod === "npm-global") {
      candidates.push(
        join(home, ".npm-global/bin", tool),
        join(home, ".nvm/versions/node/*/bin", tool),
      );
    }

    // viben-specific paths (Linux)
    if (tool === "viben") {
      candidates.push(
        "/usr/bin/viben",
        "/usr/local/bin/viben",
        join(home, ".npm-global/bin/viben"),
        "/snap/bin/viben",
      );
    }
  }

  return candidates;
}

/**
 * Detect a CLI tool's version by running --version
 */
async function detectCliToolVersion(
  toolPath: string,
  tool: CliToolName,
): Promise<{ version: string | null; valid: boolean }> {
  const config = TOOL_CONFIGS[tool];
  const versionArg = config.versionArg || "--version";

  try {
    const { stdout, stderr } = await execAsync(`"${toolPath}" ${versionArg}`, {
      timeout: 5000,
    });

    const output = stdout.trim() || stderr.trim();
    let version: string | null = null;

    if (config.versionRegex) {
      const match = output.match(config.versionRegex);
      version = match ? (match[1] || match[2] || null) : null;
    } else {
      // Generic version extraction
      const match = output.match(/(\d+\.\d+\.\d+)/);
      version = match ? match[1] : null;
    }

    return { version, valid: true };
  } catch {
    return { version: null, valid: false };
  }
}

/**
 * Determine the source of a detected tool path
 */
function getToolSource(toolPath: string): CliToolInfo["source"] {
  if (toolPath.includes("/opt/homebrew/") || toolPath.includes("/usr/local/Cellar/")) {
    return "homebrew";
  }
  if (toolPath.includes(".nvm/versions/node")) {
    return "nvm";
  }
  if (toolPath.includes(".pyenv/")) {
    return "pyenv";
  }
  if (toolPath.includes("site-packages") || toolPath.includes("Scripts") || toolPath.includes("Library/Python")) {
    return "pip";
  }
  if (toolPath.includes(".npm-global") || toolPath.includes("AppData/Roaming/npm")) {
    return "npm";
  }
  if (toolPath.includes(".cargo/bin")) {
    return "cargo";
  }
  if (toolPath.includes("/usr/bin/") || toolPath.includes("/usr/local/bin/")) {
    return "system-path";
  }
  return "system-path";
}

/**
 * Detect a single CLI tool and collect all valid paths
 */
async function detectCliTool(
  tool: CliToolName,
  userConfigPath?: string,
): Promise<CliToolInfo> {
  const home = homedir();
  const config = TOOL_CONFIGS[tool];
  const allPaths: CliToolPath[] = [];
  const seenRealPaths = new Set<string>(); // Track resolved real paths to avoid symlink duplicates

  // Helper to add a valid path (resolves symlinks for deduplication)
  const addPath = async (path: string, version: string | undefined, source: CliToolPath["source"]) => {
    // Normalize path
    const normalizedPath = path.replace(/\/+$/, "");

    // Resolve symlinks to get the real path for deduplication
    let realPath: string;
    try {
      realPath = await realpath(normalizedPath);
    } catch {
      // If realpath fails, use the normalized path
      realPath = normalizedPath;
    }

    // Check if we've already seen this real path
    if (!seenRealPaths.has(realPath)) {
      seenRealPaths.add(realPath);
      allPaths.push({ path: normalizedPath, version, source });
    }
  };

  // 1. Check user-configured path first
  if (userConfigPath) {
    const { version, valid } = await detectCliToolVersion(userConfigPath, tool);
    if (valid) {
      await addPath(userConfigPath, version || undefined, "user-config");
    }
  }

  // 2. Check Homebrew paths (macOS)
  if (process.platform === "darwin") {
    const homebrewPaths = [
      `/opt/homebrew/bin/${tool}`,
      `/usr/local/bin/${tool}`,
    ];

    // Python-specific homebrew paths
    if (tool === "python") {
      homebrewPaths.push(
        "/opt/homebrew/bin/python3",
        "/opt/homebrew/bin/python3.13",
        "/opt/homebrew/bin/python3.12",
        "/opt/homebrew/bin/python3.11",
        "/opt/homebrew/bin/python3.10",
        "/usr/local/bin/python3",
      );
    }

    for (const toolPath of homebrewPaths) {
      if (await isExecutable(toolPath)) {
        const { version, valid } = await detectCliToolVersion(toolPath, tool);
        if (valid) {
          await addPath(toolPath, version || undefined, "homebrew");
        }
      }
    }
  }

  // 3. Try system PATH using 'which' (Unix) or 'where' (Windows)
  const toolCmd = tool === "python" ? "python3" : tool;
  try {
    const whichCmd = process.platform === "win32" ? "where" : "which";
    const { stdout } = await execAsync(`${whichCmd} ${toolCmd}`, { timeout: 5000 });
    const toolPath = stdout.trim().split("\n")[0]; // Take first result

    if (toolPath) {
      const { version, valid } = await detectCliToolVersion(toolPath, tool);
      if (valid) {
        await addPath(toolPath, version || undefined, getToolSource(toolPath));
      }
    }
  } catch {
    // which/where failed, continue to other methods
  }

  // 4. Check NVM paths for npm-global tools (Unix only)
  if (config.detectMethod === "npm-global" && process.platform !== "win32") {
    const nvmVersionsDir = join(home, ".nvm/versions/node");
    try {
      const entries = await readdir(nvmVersionsDir, { withFileTypes: true });
      // Sort by version (newest first)
      const versionDirs = entries
        .filter((e) => e.isDirectory() && /^v\d+\.\d+\.\d+$/.test(e.name))
        .sort((a, b) => {
          const vA = a.name.slice(1).split(".").map(Number);
          const vB = b.name.slice(1).split(".").map(Number);
          for (let i = 0; i < 3; i++) {
            const diff = (vB[i] ?? 0) - (vA[i] ?? 0);
            if (diff !== 0) return diff;
          }
          return 0;
        });

      for (const dir of versionDirs) {
        const toolPathNvm = join(nvmVersionsDir, dir.name, "bin", tool);
        if (await isExecutable(toolPathNvm)) {
          const { version, valid } = await detectCliToolVersion(toolPathNvm, tool);
          if (valid) {
            await addPath(toolPathNvm, version || undefined, "nvm");
          }
        }
      }
    } catch {
      // NVM directory not found or not readable
    }
  }

  // 5. Check pyenv paths for python (Unix only)
  if (tool === "python" && process.platform !== "win32") {
    const pyenvPaths = [
      join(home, ".pyenv/shims/python3"),
      join(home, ".pyenv/shims/python"),
    ];
    for (const pyenvPath of pyenvPaths) {
      if (await isExecutable(pyenvPath)) {
        const { version, valid } = await detectCliToolVersion(pyenvPath, tool);
        if (valid) {
          await addPath(pyenvPath, version || undefined, "pyenv");
        }
      }
    }
  }

  // 6. Check conda/anaconda paths for python (Unix only)
  if (tool === "python" && process.platform !== "win32") {
    const condaPaths = [
      join(home, "anaconda3/bin/python3"),
      join(home, "anaconda3/bin/python"),
      join(home, "miniconda3/bin/python3"),
      join(home, "miniconda3/bin/python"),
      "/opt/anaconda3/bin/python3",
      "/opt/miniconda3/bin/python3",
    ];
    for (const condaPath of condaPaths) {
      if (await isExecutable(condaPath)) {
        const { version, valid } = await detectCliToolVersion(condaPath, tool);
        if (valid) {
          await addPath(condaPath, version || undefined, "system-path");
        }
      }
    }
  }

  // 7. Check platform-specific standard locations
  const candidates = getCliToolCandidates(tool);
  for (const toolPath of candidates) {
    if (toolPath.includes("*")) continue; // Skip glob patterns
    if (await isExecutable(toolPath)) {
      const { version, valid } = await detectCliToolVersion(toolPath, tool);
      if (valid) {
        await addPath(toolPath, version || undefined, getToolSource(toolPath));
      }
    }
  }

  // 8. Check system paths
  if (tool === "python") {
    const systemPaths = ["/usr/bin/python3", "/usr/bin/python"];
    for (const sysPath of systemPaths) {
      if (await isExecutable(sysPath)) {
        const { version, valid } = await detectCliToolVersion(sysPath, tool);
        if (valid) {
          await addPath(sysPath, version || undefined, "system-path");
        }
      }
    }
  }

  // Return result with alternatives (excluding primary to avoid duplication)
  if (allPaths.length > 0) {
    const primary = allPaths[0];
    // Only include alternatives that are different from the primary
    const alternatives = allPaths.slice(1);
    return {
      found: true,
      path: primary.path,
      version: primary.version,
      source: primary.source,
      message: `Using ${tool}`,
      alternatives: alternatives.length > 0 ? alternatives : undefined,
    };
  }

  // Not found
  return {
    found: false,
    source: "fallback",
    message: `${tool} not found`,
  };
}

/**
 * Detect all CLI tools (git, gh, claude, python, codex, aider, goose, cline, continue, cursor, viben)
 * Also reads selected paths from ~/.viben/config.yaml
 */
async function detectAllCliTools(config?: {
  pythonPath?: string;
  gitPath?: string;
  ghPath?: string;
  claudePath?: string;
  codexPath?: string;
  aiderPath?: string;
  goosePath?: string;
  clinePath?: string;
  continuePath?: string;
  cursorPath?: string;
  vibenPath?: string;
}): Promise<CliToolsInfo> {
  // Read selected paths from config file
  const selectedPaths = await readCliToolsConfig();

  const [python, git, gh, claude, codex, aider, goose, cline, continueInfo, cursor, viben] = await Promise.all([
    detectCliTool("python", config?.pythonPath),
    detectCliTool("git", config?.gitPath),
    detectCliTool("gh", config?.ghPath),
    detectCliTool("claude", config?.claudePath),
    detectCliTool("codex", config?.codexPath),
    detectCliTool("aider", config?.aiderPath),
    detectCliTool("goose", config?.goosePath),
    detectCliTool("cline", config?.clinePath),
    detectCliTool("continue", config?.continuePath),
    detectCliTool("cursor", config?.cursorPath),
    detectCliTool("viben", config?.vibenPath),
  ]);

  // Add selected paths from config
  return {
    python: { ...python, selectedPath: selectedPaths.python },
    git: { ...git, selectedPath: selectedPaths.git },
    gh: { ...gh, selectedPath: selectedPaths.gh },
    claude: { ...claude, selectedPath: selectedPaths.claude },
    codex: { ...codex, selectedPath: selectedPaths.codex },
    aider: { ...aider, selectedPath: selectedPaths.aider },
    goose: { ...goose, selectedPath: selectedPaths.goose },
    cline: { ...cline, selectedPath: selectedPaths.cline },
    continue: { ...continueInfo, selectedPath: selectedPaths.continue },
    cursor: { ...cursor, selectedPath: selectedPaths.cursor },
    viben: { ...viben, selectedPath: selectedPaths.viben },
  };
}

/**
 * Check if a package is installed in a Python environment
 */
async function checkPackageInstalled(
  pythonPath: string,
  packageName: string,
): Promise<PackageInfo> {
  // Method 1: Try pip show
  const pipCommand = `"${pythonPath}" -m pip show ${packageName}`;
  log.debug({ pipCommand }, "Checking package with pip");

  try {
    const { stdout, stderr } = await execAsync(pipCommand, { timeout: 10000 });
    log.debug({ stdout: stdout.slice(0, 200) }, "pip show stdout");
    if (stderr) {
      log.debug({ stderr: stderr.slice(0, 200) }, "pip show stderr");
    }

    // Parse version from pip show output
    const versionMatch = stdout.match(/^Version:\s*(.+)$/m);
    const version = versionMatch ? versionMatch[1].trim() : null;

    log.debug({ packageName, version }, "Package found via pip");
    return {
      name: packageName,
      version,
      installed: true,
    };
  } catch (pipErr) {
    const pipError = pipErr as { message?: string; stderr?: string };
    log.debug({ err: pipError.message || String(pipErr) }, "pip show failed");

    // Method 2: Try importing the module directly (works for uv tool installs)
    const moduleName = packageName.replace(/-/g, "_"); // browse-mcp -> browse_mcp
    const importCommand = `"${pythonPath}" -c "import ${moduleName}; print(getattr(${moduleName}, '__version__', 'unknown'))"`;
    log.debug({ importCommand }, "Trying import");

    try {
      const { stdout: importStdout } = await execAsync(importCommand, { timeout: 10000 });
      const version = importStdout.trim() || "unknown";
      log.debug({ packageName, version }, "Package found via import");
      return {
        name: packageName,
        version: version === "unknown" ? null : version,
        installed: true,
      };
    } catch (importErr) {
      const importError = importErr as { message?: string; stderr?: string };
      log.debug({ err: importError.message || String(importErr) }, "import failed");

      // Method 3: Try running the module directly (e.g., python -m browse_mcp --version)
      const moduleCommand = `"${pythonPath}" -m ${moduleName} --version`;
      log.debug({ moduleCommand }, "Trying module version");

      try {
        const { stdout: modStdout } = await execAsync(moduleCommand, { timeout: 10000 });
        const versionMatch = modStdout.match(/(\d+\.\d+\.\d+)/);
        const version = versionMatch ? versionMatch[1] : "installed";
        log.debug({ packageName, version }, "Package found via module");
        return {
          name: packageName,
          version,
          installed: true,
        };
      } catch (modErr) {
        log.debug("All methods failed, package not installed");
        return {
          name: packageName,
          version: null,
          installed: false,
        };
      }
    }
  }
}

// ============================================================================
// Routes
// ============================================================================

export function registerPythonRoutes(fastify: FastifyInstance): void {
  /**
   * GET /api/python/detect
   * Detect available Python interpreters on the system
   */
  fastify.get("/api/python/detect", async () => {
    const pythons = await detectPythonInterpreters();
    return { pythons };
  });

  /**
   * POST /api/python/check
   * Check if a specific Python path is valid
   */
  fastify.post<{
    Body: { python_path: string };
  }>("/api/python/check", async (request) => {
    const { python_path } = request.body;
    const info = await checkPython(python_path);

    if (info) {
      return info;
    }

    return {
      path: python_path,
      version: null,
      is_valid: false,
    };
  });

  /**
   * POST /api/python/package/check
   * Check if a package is installed in a Python environment
   */
  fastify.post<{
    Body: { python_path: string; package_name: string };
  }>("/api/python/package/check", async (request) => {
    const { python_path, package_name } = request.body;
    const info = await checkPackageInstalled(python_path, package_name);
    return info;
  });

  /**
   * POST /api/python/package/install-command
   * Get the pip install command for a package
   */
  fastify.post<{
    Body: { python_path: string; package_name: string };
  }>("/api/python/package/install-command", async (request) => {
    const { python_path, package_name } = request.body;
    return {
      command: `${python_path} -m pip install ${package_name}`,
      uv_command: `uv tool install ${package_name}`,
    };
  });

  // ==========================================================================
  // CLI Tools Detection Routes
  // ==========================================================================

  /**
   * GET /api/cli-tools/detect
   * Detect all CLI tools (python, git, gh, claude, codex, aider, goose, viben, etc.)
   */
  fastify.get<{
    Querystring: {
      python_path?: string;
      git_path?: string;
      gh_path?: string;
      claude_path?: string;
      codex_path?: string;
      aider_path?: string;
      goose_path?: string;
      cline_path?: string;
      continue_path?: string;
      cursor_path?: string;
      viben_path?: string;
    };
  }>("/api/cli-tools/detect", async (request) => {
    const {
      python_path,
      git_path,
      gh_path,
      claude_path,
      codex_path,
      aider_path,
      goose_path,
      cline_path,
      continue_path,
      cursor_path,
      viben_path,
    } = request.query;
    const tools = await detectAllCliTools({
      pythonPath: python_path,
      gitPath: git_path,
      ghPath: gh_path,
      claudePath: claude_path,
      codexPath: codex_path,
      aiderPath: aider_path,
      goosePath: goose_path,
      clinePath: cline_path,
      continuePath: continue_path,
      cursorPath: cursor_path,
      vibenPath: viben_path,
    });
    return tools;
  });

  /**
   * POST /api/cli-tools/check
   * Check a specific CLI tool path
   */
  fastify.post<{
    Body: {
      tool: CliToolName;
      path: string;
    };
  }>("/api/cli-tools/check", async (request) => {
    const { tool, path } = request.body;
    const result = await detectCliTool(tool, path);
    return result;
  });

  /**
   * GET /api/cli-tools/config
   * Get CLI tools selected paths from config file
   */
  fastify.get("/api/cli-tools/config", async () => {
    const config = await readCliToolsConfig();
    return config;
  });

  /**
   * POST /api/cli-tools/config
   * Save CLI tools selected paths to config file
   */
  fastify.post<{
    Body: CliToolsConfig;
  }>("/api/cli-tools/config", async (request) => {
    const config = request.body;
    await writeCliToolsConfig(config);
    return { success: true };
  });

  /**
   * PATCH /api/cli-tools/config
   * Update a single CLI tool selected path
   */
  fastify.patch<{
    Body: {
      tool: CliToolName;
      path: string | null;
    };
  }>("/api/cli-tools/config", async (request) => {
    const { tool, path } = request.body;
    const config = await readCliToolsConfig();
    if (path === null) {
      delete config[tool];
    } else {
      config[tool] = path;
    }
    await writeCliToolsConfig(config);
    return { success: true };
  });

  // ==========================================================================
  // System Info Routes
  // ==========================================================================

  /**
   * GET /api/system/info
   * Get system information including home directory
   */
  fastify.get("/api/system/info", async () => {
    return {
      home_dir: homedir(),
      platform: platform(),
      arch: arch(),
      hostname: hostname(),
      release: release(),
      type: type(),
      viben_dir: join(homedir(), ".viben"),
    };
  });
}
