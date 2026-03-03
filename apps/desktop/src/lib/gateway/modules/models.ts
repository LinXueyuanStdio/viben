/**
 * Models Module
 * 模型模块
 */

import { GatewayError } from "../error";
import { parseErrorMessage } from "./core";
import type {
  ModelResponse,
  CreateModelOptions,
  ModelUpdate,
  DefaultModelResponse,
} from "../types";

// ============================================================================
// Model CRUD
// ============================================================================

/**
 * List all models
 */
export async function listModels(
  baseUrl: string
): Promise<ModelResponse[]> {
  const response = await fetch(`${baseUrl}/api/models`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to list models: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Get model by ID
 */
export async function getModel(
  baseUrl: string,
  modelId: string
): Promise<ModelResponse | null> {
  const response = await fetch(
    `${baseUrl}/api/models/${encodeURIComponent(modelId)}`,
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
      `Failed to get model: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Create model
 */
export async function createModel(
  baseUrl: string,
  options: CreateModelOptions
): Promise<ModelResponse> {
  const response = await fetch(`${baseUrl}/api/models`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(options),
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to create model: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Update model
 */
export async function updateModel(
  baseUrl: string,
  modelId: string,
  updates: ModelUpdate
): Promise<ModelResponse> {
  const response = await fetch(
    `${baseUrl}/api/models/${encodeURIComponent(modelId)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(updates),
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to update model: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Delete model
 */
export async function deleteModel(
  baseUrl: string,
  modelId: string
): Promise<void> {
  const response = await fetch(
    `${baseUrl}/api/models/${encodeURIComponent(modelId)}`,
    {
      method: "DELETE",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to delete model: ${errorMessage}`,
      response.status
    );
  }
}

// ============================================================================
// Default Model
// ============================================================================

/**
 * Get default model
 */
export async function getDefaultModel(
  baseUrl: string
): Promise<DefaultModelResponse> {
  const response = await fetch(`${baseUrl}/api/models/default`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get default model: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Set default model
 */
export async function setDefaultModel(
  baseUrl: string,
  modelId: string
): Promise<void> {
  const response = await fetch(`${baseUrl}/api/models/default`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ model_id: modelId }),
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to set default model: ${errorMessage}`,
      response.status
    );
  }
}

// ============================================================================
// Model Enable/Disable
// ============================================================================

/**
 * Enable model
 */
export async function enableModel(
  baseUrl: string,
  modelId: string
): Promise<ModelResponse> {
  const response = await fetch(
    `${baseUrl}/api/models/${encodeURIComponent(modelId)}/enable`,
    {
      method: "POST",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to enable model: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Disable model
 */
export async function disableModel(
  baseUrl: string,
  modelId: string
): Promise<ModelResponse> {
  const response = await fetch(
    `${baseUrl}/api/models/${encodeURIComponent(modelId)}/disable`,
    {
      method: "POST",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to disable model: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}
