/**
 * Team module - Viben Agent Organization
 *
 * This module implements the `viben team init` command that generates
 * a complete AI-assisted development workflow structure.
 *
 * Templates are read from packages/core/templates/
 * which already have all necessary transformations applied.
 */

export { initTeam, type InitOptions, type InitResult } from "./init";
export { type ProjectType, type ExecutorTemplateConfig, EXECUTOR_TEMPLATE_CONFIGS } from "./types";
// Re-export ExecutorType from main types for convenience
export type { ExecutorType } from "../types";
