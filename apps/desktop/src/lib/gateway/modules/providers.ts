/**
 * Providers Module
 * 供应商模块
 */

import { GatewayError } from "../error";
import { parseErrorMessage } from "./core";
import type {
  ProviderResponse,
  CreateProviderOptions,
  ProviderUpdate,
  ProvidersListResponse,
  ProviderStatus,
  ApiKeyProvidersResponse,
  DiscoverModelsResponse,
  ProviderEnabledModelsResponse,
} from "../types";

// ============================================================================
// Provider CRUD
// ============================================================================

/**
 * List all providers
 */
export async function listProviders(
  baseUrl: string
): Promise<ProvidersListResponse> {
  const response = await fetch(`${baseUrl}/api/providers`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to list providers: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Get provider by ID
 */
export async function getProvider(
  baseUrl: string,
  providerId: string
): Promise<ProviderResponse | null> {
  const response = await fetch(
    `${baseUrl}/api/providers/${encodeURIComponent(providerId)}`,
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
      `Failed to get provider: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Create provider
 */
export async function createProvider(
  baseUrl: string,
  options: CreateProviderOptions
): Promise<ProviderResponse> {
  const response = await fetch(`${baseUrl}/api/providers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      type: options.type,
      name: options.name,
      api_key: options.apiKey,
      base_url: options.baseUrl,
      api_version: options.apiVersion,
      deployment: options.deployment,
      timeout: options.timeout,
      max_retries: options.maxRetries,
      headers: options.headers,
      set_as_default: options.setAsDefault,
    }),
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to create provider: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Update provider
 */
export async function updateProvider(
  baseUrl: string,
  providerId: string,
  updates: ProviderUpdate
): Promise<ProviderResponse> {
  const response = await fetch(
    `${baseUrl}/api/providers/${encodeURIComponent(providerId)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        type: updates.type,
        name: updates.name,
        api_key: updates.apiKey,
        base_url: updates.baseUrl,
        api_version: updates.apiVersion,
        deployment: updates.deployment,
        timeout: updates.timeout,
        max_retries: updates.maxRetries,
        headers: updates.headers,
      }),
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to update provider: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Delete provider
 */
export async function deleteProvider(
  baseUrl: string,
  providerId: string
): Promise<void> {
  const response = await fetch(
    `${baseUrl}/api/providers/${encodeURIComponent(providerId)}`,
    {
      method: "DELETE",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to delete provider: ${errorMessage}`,
      response.status
    );
  }
}

// ============================================================================
// Default Provider
// ============================================================================

/**
 * Set default provider
 */
export async function setDefaultProvider(
  baseUrl: string,
  providerId: string
): Promise<void> {
  const response = await fetch(`${baseUrl}/api/providers/default`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ provider_id: providerId }),
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to set default provider: ${errorMessage}`,
      response.status
    );
  }
}

// ============================================================================
// Provider Status
// ============================================================================

/**
 * Test provider connection
 */
export async function testProvider(
  baseUrl: string,
  providerId: string
): Promise<ProviderStatus> {
  const response = await fetch(
    `${baseUrl}/api/providers/${encodeURIComponent(providerId)}/test`,
    {
      method: "POST",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to test provider: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

// ============================================================================
// Model Discovery
// ============================================================================

/**
 * Discover models from provider
 */
export async function discoverModels(
  baseUrl: string,
  providerId: string
): Promise<DiscoverModelsResponse> {
  const response = await fetch(
    `${baseUrl}/api/providers/${encodeURIComponent(providerId)}/discover`,
    {
      method: "POST",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to discover models: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Get enabled models for provider
 */
export async function getProviderEnabledModels(
  baseUrl: string,
  providerId: string
): Promise<ProviderEnabledModelsResponse> {
  const response = await fetch(
    `${baseUrl}/api/providers/${encodeURIComponent(providerId)}/models`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get provider enabled models: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Update enabled models for provider
 */
export async function updateProviderEnabledModels(
  baseUrl: string,
  providerId: string,
  modelIds: string[]
): Promise<ProviderEnabledModelsResponse> {
  const response = await fetch(
    `${baseUrl}/api/providers/${encodeURIComponent(providerId)}/models`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ model_ids: modelIds }),
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to update provider enabled models: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

// ============================================================================
// API Keys Info
// ============================================================================

/**
 * Get API key providers info
 */
export async function getApiKeyProviders(
  baseUrl: string
): Promise<ApiKeyProvidersResponse> {
  const response = await fetch(`${baseUrl}/api/providers/api-keys`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get API key providers: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}
