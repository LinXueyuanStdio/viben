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
  ProviderListOptions,
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
  baseUrl: string,
  options?: ProviderListOptions
): Promise<ProvidersListResponse> {
  const params = new URLSearchParams();
  if (options?.category) {
    params.set("category", options.category);
  }
  if (options?.surface) {
    params.set("surface", options.surface);
  }

  const queryString = params.toString();
  const url = queryString
    ? `${baseUrl}/api/providers?${queryString}`
    : `${baseUrl}/api/providers`;

  const response = await fetch(url, {
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
): Promise<ProviderResponse> {
  const response = await fetch(
    `${baseUrl}/api/providers/${encodeURIComponent(providerId)}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    }
  );

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
      category: options.category,
      surfaces: options.surfaces,
      supports_custom_model: options.supportsCustomModel,
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
        category: updates.category,
        surfaces: updates.surfaces,
        supports_custom_model: updates.supportsCustomModel,
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
    `${baseUrl}/api/providers/${encodeURIComponent(providerId)}/discover-models`,
    {
      method: "GET",
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

/**
 * List enabled models for a specific provider
 */
export async function listProviderEnabledModels(
  baseUrl: string,
  providerId: string
): Promise<string[]> {
  const data = await getProviderEnabledModels(baseUrl, providerId);
  return data.models.filter((model) => model.enabled).map((model) => model.id);
}

/**
 * List configured models for a specific provider, including enabled state
 */
export async function listProviderConfiguredModels(
  baseUrl: string,
  providerId: string
): Promise<ProviderModelResponse[]> {
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
      `Failed to list provider configured models: ${errorMessage}`,
      response.status
    );
  }

  const data = await response.json() as ProviderEnabledModelsResponse;
  return data.models;
}

/**
 * Enable a model for a specific provider
 */
export async function enableProviderModel(
  baseUrl: string,
  providerId: string,
  modelId: string
): Promise<void> {
  const response = await fetch(
    `${baseUrl}/api/providers/${encodeURIComponent(providerId)}/models/${encodeURIComponent(modelId)}/enable`,
    {
      method: "POST",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to enable provider model: ${errorMessage}`,
      response.status
    );
  }
}

/**
 * Disable a model for a specific provider
 */
export async function disableProviderModel(
  baseUrl: string,
  providerId: string,
  modelId: string
): Promise<void> {
  const response = await fetch(
    `${baseUrl}/api/providers/${encodeURIComponent(providerId)}/models/${encodeURIComponent(modelId)}/disable`,
    {
      method: "POST",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to disable provider model: ${errorMessage}`,
      response.status
    );
  }
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

// ============================================================================
// Additional Provider Operations
// ============================================================================

/**
 * Get default provider
 */
export async function getDefaultProvider(
  baseUrl: string
): Promise<{ default_provider_id: string | null; provider: ProviderResponse | null }> {
  const response = await fetch(`${baseUrl}/api/providers/default`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get default provider: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Enable a provider
 */
export async function enableProvider(
  baseUrl: string,
  providerId: string
): Promise<void> {
  const response = await fetch(
    `${baseUrl}/api/providers/${encodeURIComponent(providerId)}/enable`,
    {
      method: "POST",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to enable provider: ${errorMessage}`,
      response.status
    );
  }
}

/**
 * Disable a provider
 */
export async function disableProvider(
  baseUrl: string,
  providerId: string
): Promise<void> {
  const response = await fetch(
    `${baseUrl}/api/providers/${encodeURIComponent(providerId)}/disable`,
    {
      method: "POST",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to disable provider: ${errorMessage}`,
      response.status
    );
  }
}
