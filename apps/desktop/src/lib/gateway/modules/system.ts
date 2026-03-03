/**
 * System Module
 * 系统模块 - 系统信息/Python/CLI 工具
 */

import { GatewayError } from "../error";
import { parseErrorMessage } from "./core";
import type {
  SystemInfo,
  PythonInfo,
  PythonPackageInfo,
  CliToolName,
  CliToolInfo,
  CliToolsInfo,
  CliToolsConfig,
} from "../types";

// ============================================================================
// System Info
// ============================================================================

/**
 * Get system information including home directory
 */
export async function getSystemInfo(baseUrl: string): Promise<SystemInfo> {
  const response = await fetch(`${baseUrl}/api/system/info`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get system info: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

// ============================================================================
// Python Detection
// ============================================================================

/**
 * Detect available Python interpreters on the system
 */
export async function detectPython(baseUrl: string): Promise<PythonInfo[]> {
  const response = await fetch(`${baseUrl}/api/python/detect`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to detect Python: ${errorMessage}`,
      response.status
    );
  }

  const data = await response.json();
  return data.pythons;
}

/**
 * Check if a specific Python path is valid
 */
export async function checkPythonPath(
  baseUrl: string,
  pythonPath: string
): Promise<PythonInfo> {
  const response = await fetch(`${baseUrl}/api/python/check`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ python_path: pythonPath }),
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to check Python path: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Check if a package is installed in a Python environment
 */
export async function checkPythonPackage(
  baseUrl: string,
  pythonPath: string,
  packageName: string
): Promise<PythonPackageInfo> {
  const response = await fetch(`${baseUrl}/api/python/package/check`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ python_path: pythonPath, package_name: packageName }),
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to check package: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Get the install command for a package
 */
export async function getPythonInstallCommand(
  baseUrl: string,
  pythonPath: string,
  packageName: string
): Promise<{ command: string; uv_command: string }> {
  const response = await fetch(`${baseUrl}/api/python/package/install-command`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ python_path: pythonPath, package_name: packageName }),
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get install command: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

// ============================================================================
// CLI Tools Detection
// ============================================================================

/**
 * Detect all CLI tools
 */
export async function detectCliTools(
  baseUrl: string,
  config?: {
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
  }
): Promise<CliToolsInfo> {
  const params = new URLSearchParams();
  if (config?.pythonPath) params.append("python_path", config.pythonPath);
  if (config?.gitPath) params.append("git_path", config.gitPath);
  if (config?.ghPath) params.append("gh_path", config.ghPath);
  if (config?.claudePath) params.append("claude_path", config.claudePath);
  if (config?.codexPath) params.append("codex_path", config.codexPath);
  if (config?.aiderPath) params.append("aider_path", config.aiderPath);
  if (config?.goosePath) params.append("goose_path", config.goosePath);
  if (config?.clinePath) params.append("cline_path", config.clinePath);
  if (config?.continuePath) params.append("continue_path", config.continuePath);
  if (config?.cursorPath) params.append("cursor_path", config.cursorPath);

  const url = params.toString()
    ? `${baseUrl}/api/cli-tools/detect?${params}`
    : `${baseUrl}/api/cli-tools/detect`;

  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to detect CLI tools: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Check a specific CLI tool path
 */
export async function checkCliToolPath(
  baseUrl: string,
  tool: CliToolName,
  path: string
): Promise<CliToolInfo> {
  const response = await fetch(`${baseUrl}/api/cli-tools/check`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ tool, path }),
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to check CLI tool path: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Get CLI tools config from config file
 */
export async function getCliToolsConfig(
  baseUrl: string
): Promise<CliToolsConfig> {
  const response = await fetch(`${baseUrl}/api/cli-tools/config`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get CLI tools config: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Save CLI tools config to config file
 */
export async function saveCliToolsConfig(
  baseUrl: string,
  config: CliToolsConfig
): Promise<void> {
  const response = await fetch(`${baseUrl}/api/cli-tools/config`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(config),
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to save CLI tools config: ${errorMessage}`,
      response.status
    );
  }
}

/**
 * Update a single CLI tool selected path
 */
export async function updateCliToolPath(
  baseUrl: string,
  tool: CliToolName,
  path: string | null
): Promise<void> {
  const response = await fetch(`${baseUrl}/api/cli-tools/config`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ tool, path }),
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to update CLI tool path: ${errorMessage}`,
      response.status
    );
  }
}
