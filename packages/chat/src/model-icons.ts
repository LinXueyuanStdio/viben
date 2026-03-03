/**
 * Model Icon Utilities
 *
 * Provides functions to get appropriate brand icons for AI models.
 * Uses @lobehub/icons for brand icons with lucide-react Bot as fallback.
 */

import * as React from "react";
import Claude from "@lobehub/icons/es/Claude";
import Gemini from "@lobehub/icons/es/Gemini";
import OpenAI from "@lobehub/icons/es/OpenAI";
import Ollama from "@lobehub/icons/es/Ollama";
import Qwen from "@lobehub/icons/es/Qwen";
import DeepSeek from "@lobehub/icons/es/DeepSeek";
import Mistral from "@lobehub/icons/es/Mistral";
import Meta from "@lobehub/icons/es/Meta";
import Groq from "@lobehub/icons/es/Groq";
import Cohere from "@lobehub/icons/es/Cohere";
import HuggingFace from "@lobehub/icons/es/HuggingFace";
import { Bot } from "lucide-react";

// ============================================================================
// Types
// ============================================================================

export interface ModelIconOptions {
  /** Icon size in pixels */
  size?: number;
  /** Additional CSS class names */
  className?: string;
}

// ============================================================================
// Model Icon Function
// ============================================================================

/**
 * Get the appropriate brand icon for a model ID or name.
 * Uses fuzzy matching on the model ID to determine the provider.
 *
 * @param modelId - The model identifier (e.g., "claude-3-opus", "gpt-4", "gemini-pro")
 * @param options - Icon options including size and className
 * @returns React node containing the appropriate icon
 *
 * @example
 * ```tsx
 * // In a component
 * <div className="model-selector">
 *   {getModelIcon("claude-3-opus", { size: 16 })}
 *   <span>Claude 3 Opus</span>
 * </div>
 * ```
 */
export function getModelIcon(
  modelId: string | undefined,
  options: ModelIconOptions = {}
): React.ReactNode {
  const { size = 16, className } = options;
  const id = modelId?.toLowerCase() || "";

  // Claude / Anthropic models
  if (id.includes("claude") || id.includes("anthropic")) {
    return React.createElement(Claude.Color, { size, className });
  }

  // OpenAI models (GPT, o1, etc.)
  if (
    id.includes("gpt") ||
    id.includes("openai") ||
    id.includes("o1") ||
    id.includes("o3") ||
    id.includes("chatgpt")
  ) {
    return React.createElement(OpenAI, { size, className });
  }

  // Google Gemini models
  if (id.includes("gemini") || id.includes("google")) {
    return React.createElement(Gemini.Color, { size, className });
  }

  // Qwen models (Alibaba)
  if (id.includes("qwen") || id.includes("qwq")) {
    return React.createElement(Qwen.Color, { size, className });
  }

  // Meta / Llama models
  if (id.includes("llama") || id.includes("meta")) {
    return React.createElement(Meta.Color, { size, className });
  }

  // DeepSeek models
  if (id.includes("deepseek")) {
    return React.createElement(DeepSeek.Color, { size, className });
  }

  // Mistral models
  if (id.includes("mistral") || id.includes("mixtral")) {
    return React.createElement(Mistral.Color, { size, className });
  }

  // Ollama (local models)
  if (id.includes("ollama")) {
    return React.createElement(Ollama, { size, className });
  }

  // Groq models
  if (id.includes("groq")) {
    return React.createElement(Groq, { size, className });
  }

  // Cohere models
  if (id.includes("cohere") || id.includes("command-r")) {
    return React.createElement(Cohere.Color, { size, className });
  }

  // HuggingFace models
  if (id.includes("huggingface") || id.includes("hf/")) {
    return React.createElement(HuggingFace.Color, { size, className });
  }

  // Default fallback
  return React.createElement(Bot, {
    className,
    style: { width: size, height: size },
  });
}
