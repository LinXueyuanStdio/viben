/**
 * Executor Provider Constraints
 *
 * Defines which providers are supported by each executor type.
 * Used to filter model selection in UI components.
 */

import type { ExecutorType } from "@/types";
import i18n from "@/i18n";

/**
 * Provider IDs that match the provider_id in WorkspaceModel
 */
export type ProviderId =
  | "anthropic"
  | "openai"
  | "google"
  | "azure"
  | "ollama"
  | "openrouter"
  | "volcengine"
  | "grok"
  | "aihubmix"
  | "custom";

/**
 * Mapping of executor types to their allowed provider IDs.
 * If an executor is not in this map, it supports all providers.
 * If an executor maps to an empty array, it supports all providers.
 */
export const EXECUTOR_PROVIDER_CONSTRAINTS: Partial<Record<ExecutorType, ProviderId[]>> = {
  // Claude Code only works with Anthropic models
  CLAUDE_CODE: ["anthropic"],

  // Codex app-server works with OpenAI-compatible model providers
  CODEX: ["openai", "azure", "openrouter", "ollama", "volcengine", "grok", "aihubmix", "custom"],

  // Gemini only works with Google models
  GEMINI: ["google"],

  // Cursor Agent supports multiple providers
  CURSOR_AGENT: ["anthropic", "openai", "google"],

  // Amp supports multiple providers
  AMP: ["anthropic", "openai"],

  // Qwen Code works with OpenAI-compatible APIs and custom
  QWEN_CODE: ["openai", "ollama", "custom"],

  // GitHub Copilot uses OpenAI
  COPILOT: ["openai"],

  // OpenCode supports multiple providers
  OPENCODE: ["anthropic", "openai", "ollama"],

  // Droid supports multiple providers
  DROID: ["anthropic", "openai", "google"],

  // OpenClaw has its own model routing, supports all providers
  OPENCLAW: [],

  // Aider supports multiple providers
  AIDER: ["anthropic", "openai", "ollama"],

  // Continue supports multiple providers
  CONTINUE: ["anthropic", "openai", "google", "ollama"],
};

/**
 * Get allowed provider IDs for an executor type.
 * Returns undefined if the executor supports all providers.
 *
 * @param executorType - The executor type to check
 * @returns Array of allowed provider IDs, or undefined if all providers are allowed
 */
export function getAllowedProviders(executorType?: string): ProviderId[] | undefined {
  if (!executorType) return undefined;
  return EXECUTOR_PROVIDER_CONSTRAINTS[executorType as ExecutorType];
}

/**
 * Check if a provider is allowed for an executor type.
 *
 * @param executorType - The executor type to check
 * @param providerId - The provider ID to check
 * @returns true if the provider is allowed, false otherwise
 */
export function isProviderAllowed(executorType?: string, providerId?: string): boolean {
  if (!executorType || !providerId) return true;

  const allowedProviders = getAllowedProviders(executorType);
  if (!allowedProviders || allowedProviders.length === 0) return true;

  return allowedProviders.includes(providerId as ProviderId);
}

/**
 * Filter models by executor type constraints.
 *
 * @param models - Array of models with provider_id field
 * @param executorType - The executor type to filter for
 * @returns Filtered array of models that are compatible with the executor
 */
export function filterModelsByExecutor<T extends { provider_id?: string }>(
  models: T[],
  executorType?: string
): T[] {
  const allowedProviders = getAllowedProviders(executorType);
  if (!allowedProviders || allowedProviders.length === 0) return models;

  return models.filter((model) => {
    if (!model.provider_id) return true;
    return allowedProviders.includes(model.provider_id as ProviderId);
  });
}

/**
 * Get a human-readable description of provider constraints for an executor.
 *
 * @param executorType - The executor type
 * @returns Description string or undefined if no constraints
 */
export function getProviderConstraintDescription(executorType?: string): string | undefined {
  const allowedProviders = getAllowedProviders(executorType);
  if (!allowedProviders || allowedProviders.length === 0) return undefined;

  const names = allowedProviders
    .map((p) => i18n.t(`executor.providerNames.${p}`))
    .join(", ");
  return i18n.t("executor.onlyModelsSupported", { names });
}
