/**
 * Browse Plugins Module
 * 搜索源插件模块
 */

import { GatewayError } from "../error";
import { parseErrorMessage } from "./core";
import type {
  BrowsePluginRegistry,
  InstalledBrowsePluginsResponse,
  InstallBrowsePluginResponse,
} from "../types";

/**
 * Get browse plugins registry (online)
 */
export async function getBrowsePluginRegistry(
  baseUrl: string,
  forceRefresh = false
): Promise<BrowsePluginRegistry> {
  const params = new URLSearchParams();
  if (forceRefresh) params.set("force_refresh", "true");

  const response = await fetch(
    `${baseUrl}/api/browse-plugins/registry?${params.toString()}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get browse plugins registry: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * List installed browse plugins
 */
export async function getInstalledBrowsePlugins(
  baseUrl: string
): Promise<InstalledBrowsePluginsResponse> {
  const response = await fetch(`${baseUrl}/api/browse-plugins/installed`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get installed browse plugins: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Install a browse plugin
 */
export async function installBrowsePlugin(
  baseUrl: string,
  pluginId: string,
  downloadUrl: string
): Promise<InstallBrowsePluginResponse> {
  const response = await fetch(`${baseUrl}/api/browse-plugins/install`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ plugin_id: pluginId, download_url: downloadUrl }),
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to install browse plugin: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Uninstall a browse plugin
 */
export async function uninstallBrowsePlugin(
  baseUrl: string,
  pluginId: string
): Promise<void> {
  const response = await fetch(
    `${baseUrl}/api/browse-plugins/${encodeURIComponent(pluginId)}`,
    {
      method: "DELETE",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to uninstall browse plugin: ${errorMessage}`,
      response.status
    );
  }
}
