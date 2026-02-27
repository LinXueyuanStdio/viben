/**
 * Python detection routes and system info
 *
 * Provides Python interpreter detection, package checking capabilities,
 * and system information for onboarding and environment setup.
 */
import type { FastifyInstance } from "fastify";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { homedir, platform, arch, hostname, release, type } from "node:os";
import { join } from "node:path";
import { access, constants } from "node:fs/promises";

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

/**
 * Check if a package is installed in a Python environment
 */
async function checkPackageInstalled(
  pythonPath: string,
  packageName: string,
): Promise<PackageInfo> {
  try {
    const { stdout } = await execAsync(
      `"${pythonPath}" -m pip show ${packageName}`,
      { timeout: 10000 },
    );

    // Parse version from pip show output
    const versionMatch = stdout.match(/^Version:\s*(.+)$/m);
    const version = versionMatch ? versionMatch[1].trim() : null;

    return {
      name: packageName,
      version,
      installed: true,
    };
  } catch {
    return {
      name: packageName,
      version: null,
      installed: false,
    };
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
