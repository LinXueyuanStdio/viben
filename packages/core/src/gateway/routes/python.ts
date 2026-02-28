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
import { access, constants, readdir } from "node:fs/promises";

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
 * CLI tool detection result
 */
export interface CliToolInfo {
  found: boolean;
  path?: string;
  version?: string;
  source: "user-config" | "homebrew" | "nvm" | "system-path" | "fallback";
  message?: string;
}

/**
 * All CLI tools detection result
 */
export interface CliToolsInfo {
  git: CliToolInfo;
  gh: CliToolInfo;
  claude: CliToolInfo;
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
 * Get CLI tool candidates based on platform
 */
function getCliToolCandidates(tool: "git" | "gh" | "claude"): string[] {
  const candidates: string[] = [];
  const home = homedir();

  if (process.platform === "darwin") {
    // macOS: Homebrew paths (Apple Silicon and Intel)
    const homebrewPaths = [
      `/opt/homebrew/bin/${tool}`,
      `/usr/local/bin/${tool}`,
    ];
    candidates.push(...homebrewPaths);

    // Claude specific: NVM paths
    if (tool === "claude") {
      const nvmDir = join(home, ".nvm/versions/node");
      candidates.push(nvmDir); // Will be handled specially
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

    if (tool === "git") {
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
    } else if (tool === "claude") {
      candidates.push(
        join(localAppData, "Programs/claude/claude.exe"),
        join(home, "AppData/Roaming/npm/claude.cmd"),
        join(home, ".local/bin/claude.exe"),
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
  }

  return candidates;
}

/**
 * Detect a CLI tool's version by running --version
 */
async function detectCliToolVersion(
  toolPath: string,
  tool: "git" | "gh" | "claude",
): Promise<{ version: string | null; valid: boolean }> {
  try {
    const { stdout, stderr } = await execAsync(`"${toolPath}" --version`, {
      timeout: 5000,
    });

    const output = stdout.trim() || stderr.trim();
    let version: string | null = null;

    if (tool === "git") {
      // git version 2.39.0
      const match = output.match(/git version (\d+\.\d+\.\d+)/);
      version = match ? match[1] : null;
    } else if (tool === "gh") {
      // gh version 2.40.0 (2023-12-05)
      const match = output.match(/gh version (\d+\.\d+\.\d+)/);
      version = match ? match[1] : null;
    } else if (tool === "claude") {
      // claude-code version 1.0.0 or similar
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
  if (toolPath.includes("/usr/bin/") || toolPath.includes("/usr/local/bin/")) {
    return "system-path";
  }
  return "system-path";
}

/**
 * Detect a single CLI tool
 */
async function detectCliTool(
  tool: "git" | "gh" | "claude",
  userConfigPath?: string,
): Promise<CliToolInfo> {
  const home = homedir();

  // 1. Check user-configured path first
  if (userConfigPath) {
    const { version, valid } = await detectCliToolVersion(userConfigPath, tool);
    if (valid) {
      return {
        found: true,
        path: userConfigPath,
        version: version || undefined,
        source: "user-config",
        message: `Using user-configured ${tool}`,
      };
    }
  }

  // 2. Check Homebrew paths (macOS)
  if (process.platform === "darwin") {
    const homebrewPaths = [
      `/opt/homebrew/bin/${tool}`,
      `/usr/local/bin/${tool}`,
    ];

    for (const toolPath of homebrewPaths) {
      if (await isExecutable(toolPath)) {
        const { version, valid } = await detectCliToolVersion(toolPath, tool);
        if (valid) {
          return {
            found: true,
            path: toolPath,
            version: version || undefined,
            source: "homebrew",
            message: `Using Homebrew ${tool}`,
          };
        }
      }
    }
  }

  // 3. Try system PATH using 'which' (Unix) or 'where' (Windows)
  try {
    const whichCmd = process.platform === "win32" ? "where" : "which";
    const { stdout } = await execAsync(`${whichCmd} ${tool}`, { timeout: 5000 });
    const toolPath = stdout.trim().split("\n")[0]; // Take first result

    if (toolPath) {
      const { version, valid } = await detectCliToolVersion(toolPath, tool);
      if (valid) {
        return {
          found: true,
          path: toolPath,
          version: version || undefined,
          source: getToolSource(toolPath),
          message: `Using system ${tool}`,
        };
      }
    }
  } catch {
    // which/where failed, continue to other methods
  }

  // 4. Check NVM paths for Claude (Unix only)
  if (tool === "claude" && process.platform !== "win32") {
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
        const claudePath = join(nvmVersionsDir, dir.name, "bin/claude");
        if (await isExecutable(claudePath)) {
          const { version, valid } = await detectCliToolVersion(claudePath, tool);
          if (valid) {
            return {
              found: true,
              path: claudePath,
              version: version || undefined,
              source: "nvm",
              message: `Using NVM Claude CLI`,
            };
          }
        }
      }
    } catch {
      // NVM directory not found or not readable
    }
  }

  // 5. Check platform-specific standard locations
  const candidates = getCliToolCandidates(tool);
  for (const toolPath of candidates) {
    if (toolPath.includes(".nvm")) continue; // Already handled above
    if (await isExecutable(toolPath)) {
      const { version, valid } = await detectCliToolVersion(toolPath, tool);
      if (valid) {
        return {
          found: true,
          path: toolPath,
          version: version || undefined,
          source: getToolSource(toolPath),
          message: `Using ${tool}`,
        };
      }
    }
  }

  // 6. Not found
  return {
    found: false,
    source: "fallback",
    message: `${tool} not found`,
  };
}

/**
 * Detect all CLI tools (git, gh, claude)
 */
async function detectAllCliTools(config?: {
  gitPath?: string;
  ghPath?: string;
  claudePath?: string;
}): Promise<CliToolsInfo> {
  const [git, gh, claude] = await Promise.all([
    detectCliTool("git", config?.gitPath),
    detectCliTool("gh", config?.ghPath),
    detectCliTool("claude", config?.claudePath),
  ]);

  return { git, gh, claude };
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
  console.log(`[Python] Checking package with pip: ${pipCommand}`);

  try {
    const { stdout, stderr } = await execAsync(pipCommand, { timeout: 10000 });
    console.log(`[Python] pip show stdout: ${stdout.slice(0, 200)}`);
    if (stderr) {
      console.log(`[Python] pip show stderr: ${stderr.slice(0, 200)}`);
    }

    // Parse version from pip show output
    const versionMatch = stdout.match(/^Version:\s*(.+)$/m);
    const version = versionMatch ? versionMatch[1].trim() : null;

    console.log(`[Python] Package ${packageName} found via pip, version: ${version}`);
    return {
      name: packageName,
      version,
      installed: true,
    };
  } catch (pipErr) {
    const pipError = pipErr as { message?: string; stderr?: string };
    console.log(`[Python] pip show failed: ${pipError.message || String(pipErr)}`);

    // Method 2: Try importing the module directly (works for uv tool installs)
    const moduleName = packageName.replace(/-/g, "_"); // browse-mcp -> browse_mcp
    const importCommand = `"${pythonPath}" -c "import ${moduleName}; print(getattr(${moduleName}, '__version__', 'unknown'))"`;
    console.log(`[Python] Trying import: ${importCommand}`);

    try {
      const { stdout: importStdout } = await execAsync(importCommand, { timeout: 10000 });
      const version = importStdout.trim() || "unknown";
      console.log(`[Python] Package ${packageName} found via import, version: ${version}`);
      return {
        name: packageName,
        version: version === "unknown" ? null : version,
        installed: true,
      };
    } catch (importErr) {
      const importError = importErr as { message?: string; stderr?: string };
      console.log(`[Python] import failed: ${importError.message || String(importErr)}`);

      // Method 3: Try running the module directly (e.g., python -m browse_mcp --version)
      const moduleCommand = `"${pythonPath}" -m ${moduleName} --version`;
      console.log(`[Python] Trying module version: ${moduleCommand}`);

      try {
        const { stdout: modStdout } = await execAsync(moduleCommand, { timeout: 10000 });
        const versionMatch = modStdout.match(/(\d+\.\d+\.\d+)/);
        const version = versionMatch ? versionMatch[1] : "installed";
        console.log(`[Python] Package ${packageName} found via module, version: ${version}`);
        return {
          name: packageName,
          version,
          installed: true,
        };
      } catch (modErr) {
        console.log(`[Python] All methods failed, package not installed`);
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
   * Detect all CLI tools (git, gh, claude)
   */
  fastify.get<{
    Querystring: {
      git_path?: string;
      gh_path?: string;
      claude_path?: string;
    };
  }>("/api/cli-tools/detect", async (request) => {
    const { git_path, gh_path, claude_path } = request.query;
    const tools = await detectAllCliTools({
      gitPath: git_path,
      ghPath: gh_path,
      claudePath: claude_path,
    });
    return tools;
  });

  /**
   * POST /api/cli-tools/check
   * Check a specific CLI tool path
   */
  fastify.post<{
    Body: {
      tool: "git" | "gh" | "claude";
      path: string;
    };
  }>("/api/cli-tools/check", async (request) => {
    const { tool, path } = request.body;
    const result = await detectCliTool(tool, path);
    return result;
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
