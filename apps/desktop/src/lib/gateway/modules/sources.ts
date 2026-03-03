/**
 * Sources Module
 * 已安装源模块
 */

import { GatewayError } from "../error";
import { parseErrorMessage } from "./core";
import type { InstalledSourcesResponse } from "../types";

// ============================================================================
// Installed Sources
// ============================================================================

/**
 * Get installed sources from browse-mcp-cli
 */
export async function getInstalledSources(
  baseUrl: string,
  pythonPath: string
): Promise<InstalledSourcesResponse> {
  const params = new URLSearchParams({ python_path: pythonPath });
  const response = await fetch(
    `${baseUrl}/api/sources/installed?${params.toString()}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get installed sources: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Show details of a specific provider
 */
export async function showInstalledProvider(
  baseUrl: string,
  pythonPath: string,
  provider: string
): Promise<Record<string, unknown>> {
  const params = new URLSearchParams({ python_path: pythonPath });
  const response = await fetch(
    `${baseUrl}/api/sources/provider/${encodeURIComponent(provider)}?${params.toString()}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to show provider: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Install a provider plugin
 */
export async function installProvider(
  baseUrl: string,
  pythonPath: string,
  provider: string,
  upgrade = false
): Promise<string> {
  const response = await fetch(`${baseUrl}/api/sources/provider/install`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      python_path: pythonPath,
      provider,
      upgrade,
    }),
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to install provider: ${errorMessage}`,
      response.status
    );
  }

  const result = await response.json();
  return result.output || "Installation successful";
}
