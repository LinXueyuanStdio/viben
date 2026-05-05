/**
 * Model Icon Utilities
 *
 * Provides functions to get appropriate brand icons for AI models and executors.
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
import { Bot, Sparkles, Terminal } from "lucide-react";
import { GithubIcon as Github } from "@/components/ui/icons";
import type { ExecutorType } from "@/types";
import i18n from "@/i18n";

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
// Executor Icon Function
// ============================================================================

/**
 * Get the appropriate brand icon for an executor type.
 *
 * @param executorType - The executor type (e.g., "CLAUDE_CODE", "CODEX", "GEMINI")
 * @param options - Icon options including size and className
 * @returns React node containing the appropriate icon
 *
 * @example
 * ```tsx
 * // In a component
 * <div className="avatar">
 *   {getExecutorIcon("CLAUDE_CODE", { size: 20 })}
 * </div>
 * ```
 */
export function getExecutorIcon(
  executorType: ExecutorType | string | undefined,
  options: ModelIconOptions = {}
): React.ReactNode {
  const { size = 16, className } = options;
  const type = executorType?.toUpperCase();

  switch (type) {
    case "CLAUDE_CODE":
      return React.createElement(Claude.Color, { size, className });
    case "CODEX":
      return React.createElement(OpenAI, { size, className });
    case "GEMINI":
      return React.createElement(Gemini.Color, { size, className });
    case "QWEN_CODE":
      return React.createElement(Qwen.Color, { size, className });
    case "CURSOR_AGENT":
    case "CURSOR":
      return React.createElement(Sparkles, {
        className: className ? `${className} h-4 w-4` : "h-4 w-4",
        style: { width: size, height: size },
      });
    case "COPILOT":
      return React.createElement(Github, {
        className,
        style: { width: size, height: size },
      });
    case "AMP":
      return React.createElement(Terminal, {
        className,
        style: { width: size, height: size },
      });
    case "OPENCODE":
      return React.createElement(Terminal, {
        className,
        style: { width: size, height: size },
      });
    case "OPENCLAW":
      return React.createElement(Bot, {
        className: className ? `${className} text-red-500` : "text-red-500",
        style: { width: size, height: size },
      });
    case "DROID":
      return React.createElement(Bot, {
        className,
        style: { width: size, height: size },
      });
    default:
      return React.createElement(Bot, {
        className,
        style: { width: size, height: size },
      });
  }
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

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get executor display name for UI
 *
 * @param executorType - The executor type
 * @returns Human-readable display name
 */
export function getExecutorDisplayName(
  executorType: ExecutorType | string | undefined
): string {
  const type = executorType?.toUpperCase();
  switch (type) {
    case "CLAUDE_CODE":
      return i18n.t("executor.displayNames.claudeCode");
    case "CODEX":
      return i18n.t("executor.displayNames.codex");
    case "GEMINI":
      return i18n.t("executor.displayNames.gemini");
    case "CURSOR_AGENT":
    case "CURSOR":
      return i18n.t("executor.displayNames.cursor");
    case "COPILOT":
      return i18n.t("executor.displayNames.githubCopilot");
    case "QWEN_CODE":
      return i18n.t("executor.displayNames.qwenCode");
    case "AMP":
      return i18n.t("executor.displayNames.amp");
    case "OPENCODE":
      return i18n.t("executor.displayNames.opencode");
    case "OPENCLAW":
      return i18n.t("executor.displayNames.openclaw");
    case "DROID":
      return i18n.t("executor.displayNames.droid");
    default:
      return executorType || i18n.t("executor.displayNames.agent");
  }
}

/**
 * Get avatar gradient for executor type
 *
 * @param executorType - The executor type
 * @returns Tailwind gradient class string
 */
export function getExecutorAvatarGradient(
  executorType: ExecutorType | string | undefined
): string {
  const type = executorType?.toUpperCase();
  switch (type) {
    case "CLAUDE_CODE":
      return "from-orange-500 to-amber-400";
    case "CODEX":
      return "from-emerald-500 to-teal-400";
    case "GEMINI":
      return "from-blue-500 to-indigo-400";
    case "CURSOR_AGENT":
    case "CURSOR":
      return "from-violet-500 to-purple-400";
    case "COPILOT":
      return "from-gray-600 to-gray-500";
    case "QWEN_CODE":
      return "from-blue-600 to-cyan-400";
    case "AMP":
      return "from-pink-500 to-rose-400";
    case "OPENCODE":
      return "from-green-500 to-emerald-400";
    case "OPENCLAW":
      return "from-red-500 to-orange-400";
    case "DROID":
      return "from-yellow-500 to-orange-400";
    default:
      return "from-blue-500 to-cyan-400";
  }
}
