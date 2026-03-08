/**
 * Variable Resolver for Agent Templates
 *
 * Handles three types of template variables:
 * - Predefined: {{workspace_name}}, {{current_date}}, etc.
 * - Environment: {{env.API_KEY}}
 * - Custom: {{custom.project_type}}
 */
import { homedir, platform } from "node:os";

/**
 * Context for resolving variables
 */
export interface VariableContext {
  /** Workspace information */
  workspace?: {
    name: string;
    path: string;
  };
  /** Agent information */
  agent?: {
    name: string;
  };
  /** Custom variable values */
  customValues?: Record<string, string>;
}

/**
 * Extracted variables categorized by type
 */
export interface ExtractedVariables {
  /** Predefined system variables */
  predefined: string[];
  /** Environment variables (from env.XXX) */
  env: string[];
  /** Custom variables (from custom.XXX or unknown) */
  custom: string[];
}

/**
 * Result of resolving variables
 */
export interface ResolveResult {
  /** Text with resolved variables */
  resolved: string;
  /** List of unresolved custom variables */
  unresolvedCustom: string[];
}

/**
 * Regex pattern to match template variables
 * Matches: {{variable_name}}, {{env.VAR}}, {{custom.var}}
 */
const VARIABLE_REGEX = /\{\{([a-zA-Z_][a-zA-Z0-9_.]*)\}\}/g;

/**
 * List of predefined variable names
 */
export const PREDEFINED_VARIABLES = [
  "workspace_name",
  "workspace_path",
  "agent_name",
  "current_date",
  "current_time",
  "current_datetime",
  "os_platform",
  "user_home",
] as const;

/**
 * Type for predefined variable names
 */
export type PredefinedVariable = (typeof PREDEFINED_VARIABLES)[number];

/**
 * Extract all variables from text, categorized by type
 *
 * @param text - Text containing template variables
 * @returns Extracted variables categorized by type
 */
export function extractVariables(text: string): ExtractedVariables {
  const predefined = new Set<string>();
  const env = new Set<string>();
  const custom = new Set<string>();

  const matches = Array.from(text.matchAll(VARIABLE_REGEX));
  for (const match of matches) {
    const varName = match[1];

    if (varName.startsWith("env.")) {
      // Environment variable: env.VAR_NAME
      const envVar = varName.slice(4);
      if (envVar) {
        env.add(envVar);
      }
    } else if (varName.startsWith("custom.")) {
      // Custom variable: custom.var_name
      const customVar = varName.slice(7);
      if (customVar) {
        custom.add(customVar);
      }
    } else if (isPredefinedVariable(varName)) {
      // Predefined variable
      predefined.add(varName);
    } else {
      // Unknown variable - treat as custom
      custom.add(varName);
    }
  }

  return {
    predefined: Array.from(predefined),
    env: Array.from(env),
    custom: Array.from(custom),
  };
}

/**
 * Check if a variable name is a predefined variable
 */
function isPredefinedVariable(name: string): name is PredefinedVariable {
  return PREDEFINED_VARIABLES.includes(name as PredefinedVariable);
}

/**
 * Resolve all variables in text using the provided context
 *
 * @param text - Text containing template variables
 * @param context - Context for resolving variables
 * @returns Resolved text and list of unresolved custom variables
 */
export function resolveVariables(
  text: string,
  context: VariableContext
): ResolveResult {
  const unresolvedCustom: string[] = [];

  const resolved = text.replace(VARIABLE_REGEX, (match, varName: string) => {
    // Try to resolve the variable
    const value = resolveVariable(varName, context, unresolvedCustom);
    return value !== undefined ? value : match;
  });

  // Deduplicate unresolved custom variables
  const uniqueUnresolved = Array.from(new Set(unresolvedCustom));

  return {
    resolved,
    unresolvedCustom: uniqueUnresolved,
  };
}

/**
 * Resolve a single variable
 *
 * @param varName - Variable name (e.g., "workspace_name", "env.API_KEY", "custom.project")
 * @param context - Context for resolving variables
 * @param unresolvedCustom - Array to track unresolved custom variables
 * @returns Resolved value or undefined if cannot resolve
 */
function resolveVariable(
  varName: string,
  context: VariableContext,
  unresolvedCustom: string[]
): string | undefined {
  // Environment variables: env.VAR_NAME
  if (varName.startsWith("env.")) {
    const envVar = varName.slice(4);
    const value = process.env[envVar];
    return value; // Returns undefined if not set, which preserves the placeholder
  }

  // Custom variables: custom.var_name
  if (varName.startsWith("custom.")) {
    const customVar = varName.slice(7);
    const value = context.customValues?.[customVar];
    if (value === undefined) {
      unresolvedCustom.push(customVar);
    }
    return value;
  }

  // Predefined variables
  if (isPredefinedVariable(varName)) {
    return resolvePredefinedVariable(varName, context);
  }

  // Unknown variable - treat as custom (unresolved)
  unresolvedCustom.push(varName);
  return undefined;
}

/**
 * Resolve a predefined variable
 */
function resolvePredefinedVariable(
  varName: PredefinedVariable,
  context: VariableContext
): string | undefined {
  switch (varName) {
    case "workspace_name":
      return context.workspace?.name;

    case "workspace_path":
      return context.workspace?.path;

    case "agent_name":
      return context.agent?.name;

    case "current_date":
      return formatDate(new Date());

    case "current_time":
      return formatTime(new Date());

    case "current_datetime":
      return formatDateTime(new Date());

    case "os_platform":
      return platform();

    case "user_home":
      return homedir();

    default:
      return undefined;
  }
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Format time as HH:MM
 */
function formatTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

/**
 * Format date and time as YYYY-MM-DD HH:MM
 */
function formatDateTime(date: Date): string {
  return `${formatDate(date)} ${formatTime(date)}`;
}
