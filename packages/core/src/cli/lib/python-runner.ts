/**
 * Python script runner utility
 *
 * Provides a shared interface for running Python scripts from the .viben/scripts directory.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Result of running a Python script
 */
export interface PythonScriptResult {
  /** Standard output */
  stdout: string;
  /** Standard error */
  stderr: string;
  /** Exit code */
  code: number;
}

/**
 * Options for running a Python script
 */
export interface RunVibenScriptOptions {
  /** Working directory (defaults to workspace root) */
  cwd?: string;
  /** Environment variables to pass to the script */
  env?: Record<string, string>;
  /** Timeout in milliseconds (default: 30000) */
  timeout?: number;
}

/**
 * The Viben workflow directory name
 */
const VIBEN_DIR = ".viben";

/**
 * The scripts directory within .viben
 */
const SCRIPTS_DIR = "scripts";

/**
 * Find the workspace root by looking for .viben directory
 */
export function findVibenRoot(startDir?: string): string | null {
  let currentDir = resolve(startDir || process.cwd());
  const root = process.platform === "win32" ? currentDir.split(":")[0] + ":\\" : "/";

  while (currentDir !== root) {
    const vibenDir = join(currentDir, VIBEN_DIR);
    if (existsSync(vibenDir)) {
      return currentDir;
    }

    const parentDir = join(currentDir, "..");
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }

  return null;
}

/**
 * Get the path to a script in the .viben/scripts directory
 */
export function getVibenScriptPath(workspaceRoot: string, scriptName: string): string {
  return join(workspaceRoot, VIBEN_DIR, SCRIPTS_DIR, scriptName);
}

/**
 * Run a Python script from the .viben/scripts directory
 *
 * @param scriptName - Name of the script file (e.g., "get_context.py")
 * @param args - Arguments to pass to the script
 * @param options - Additional options
 * @returns Promise with stdout, stderr, and exit code
 *
 * @example
 * ```typescript
 * const result = await runVibenScript("get_context.py", ["--json"]);
 * if (result.code === 0) {
 *   console.log(result.stdout);
 * }
 * ```
 */
export async function runVibenScript(
  scriptName: string,
  args: string[] = [],
  options: RunVibenScriptOptions = {}
): Promise<PythonScriptResult> {
  const workspaceRoot = findVibenRoot(options.cwd);

  if (!workspaceRoot) {
    return {
      stdout: "",
      stderr: "Not in a Viben workspace. Run 'viben team init' to initialize.",
      code: 1,
    };
  }

  const scriptPath = getVibenScriptPath(workspaceRoot, scriptName);

  if (!existsSync(scriptPath)) {
    return {
      stdout: "",
      stderr: `Script not found: ${scriptPath}`,
      code: 1,
    };
  }

  return new Promise((resolve) => {
    const timeout = options.timeout ?? 30000;
    let stdout = "";
    let stderr = "";
    let timedOut = false;

    // Use python3 on Unix, python on Windows
    const pythonCmd = process.platform === "win32" ? "python" : "python3";

    const child = spawn(pythonCmd, [scriptPath, ...args], {
      cwd: workspaceRoot,
      env: {
        ...process.env,
        ...options.env,
        // Ensure UTF-8 encoding for Python output
        PYTHONIOENCODING: "utf-8",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    const timeoutId = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeout);

    child.stdout?.on("data", (data: Buffer) => {
      stdout += data.toString("utf-8");
    });

    child.stderr?.on("data", (data: Buffer) => {
      stderr += data.toString("utf-8");
    });

    child.on("error", (err) => {
      clearTimeout(timeoutId);
      resolve({
        stdout,
        stderr: err.message,
        code: 1,
      });
    });

    child.on("close", (code) => {
      clearTimeout(timeoutId);
      if (timedOut) {
        resolve({
          stdout,
          stderr: `Script timed out after ${timeout}ms`,
          code: 124,
        });
      } else {
        resolve({
          stdout,
          stderr,
          code: code ?? 0,
        });
      }
    });
  });
}
