/**
 * Service Keys Module
 * 服务 API 密钥模块
 */

import { GatewayError } from "../error";
import { parseErrorMessage } from "./core";
import type { ServiceApiKey } from "../types";

// ============================================================================
// Service API Keys
// ============================================================================

/**
 * Get all service API keys
 */
export async function getServiceKeys(
  baseUrl: string
): Promise<ServiceApiKey[]> {
  const response = await fetch(`${baseUrl}/api/service-keys`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get service keys: ${errorMessage}`,
      response.status
    );
  }

  const result = await response.json();
  return result.keys;
}

/**
 * Create a new service API key
 */
export async function createServiceKey(
  baseUrl: string,
  name: string
): Promise<ServiceApiKey> {
  const response = await fetch(`${baseUrl}/api/service-keys`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ name }),
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to create service key: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Get a service API key by ID
 */
export async function getServiceKeyById(
  baseUrl: string,
  keyId: string
): Promise<ServiceApiKey | null> {
  const response = await fetch(
    `${baseUrl}/api/service-keys/${encodeURIComponent(keyId)}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    }
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get service key: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Delete a service API key
 */
export async function deleteServiceKey(
  baseUrl: string,
  keyId: string
): Promise<void> {
  const response = await fetch(
    `${baseUrl}/api/service-keys/${encodeURIComponent(keyId)}`,
    {
      method: "DELETE",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to delete service key: ${errorMessage}`,
      response.status
    );
  }
}

/**
 * Validate a service API key
 */
export async function validateServiceKey(
  baseUrl: string,
  apiKey: string
): Promise<boolean> {
  const response = await fetch(`${baseUrl}/api/service-keys/validate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ api_key: apiKey }),
  });

  if (!response.ok) {
    return false;
  }

  const result = await response.json();
  return result.valid;
}
