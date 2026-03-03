/**
 * Preferences Module
 * 开发者偏好设置模块
 */

import { GatewayError } from "../error";
import { parseErrorMessage } from "./core";
import type { PreferencesResponse, DeveloperPreferences } from "../types";

// ============================================================================
// Preferences
// ============================================================================

/**
 * Get all preferences
 */
export async function getPreferences(
  baseUrl: string
): Promise<PreferencesResponse> {
  const response = await fetch(`${baseUrl}/api/preferences`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get preferences: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Update all preferences
 */
export async function updatePreferences(
  baseUrl: string,
  prefs: Partial<PreferencesResponse>
): Promise<PreferencesResponse> {
  const response = await fetch(`${baseUrl}/api/preferences`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(prefs),
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to update preferences: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Get developer preferences
 */
export async function getDeveloperPreferences(
  baseUrl: string
): Promise<DeveloperPreferences> {
  const response = await fetch(`${baseUrl}/api/preferences/developer`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get developer preferences: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Update developer preferences
 */
export async function updateDeveloperPreferences(
  baseUrl: string,
  prefs: Partial<DeveloperPreferences>
): Promise<DeveloperPreferences> {
  const response = await fetch(`${baseUrl}/api/preferences/developer`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(prefs),
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to update developer preferences: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Get preferred IDE
 */
export async function getPreferredIDE(baseUrl: string): Promise<string> {
  const response = await fetch(`${baseUrl}/api/preferences/developer/ide`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get preferred IDE: ${errorMessage}`,
      response.status
    );
  }

  const data = await response.json();
  return data.preferred_ide ?? "vscode";
}

/**
 * Set preferred IDE
 */
export async function setPreferredIDE(
  baseUrl: string,
  ide: string
): Promise<void> {
  const response = await fetch(`${baseUrl}/api/preferences/developer/ide`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ preferred_ide: ide }),
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to set preferred IDE: ${errorMessage}`,
      response.status
    );
  }
}

/**
 * Get preferred terminal
 */
export async function getPreferredTerminal(baseUrl: string): Promise<string> {
  const response = await fetch(`${baseUrl}/api/preferences/developer/terminal`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get preferred terminal: ${errorMessage}`,
      response.status
    );
  }

  const data = await response.json();
  return data.preferred_terminal ?? "system";
}

/**
 * Set preferred terminal
 */
export async function setPreferredTerminal(
  baseUrl: string,
  terminal: string
): Promise<void> {
  const response = await fetch(`${baseUrl}/api/preferences/developer/terminal`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ preferred_terminal: terminal }),
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to set preferred terminal: ${errorMessage}`,
      response.status
    );
  }
}
