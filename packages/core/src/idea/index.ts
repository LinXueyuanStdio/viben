/**
 * Idea Module
 *
 * AI-driven idea generation and management for project improvements.
 *
 * Features:
 * - Generate improvement ideas by analyzing codebase
 * - Support for 6 built-in types and custom types
 * - Promote ideas to tasks
 * - Track idea status (draft, promoted, dismissed)
 *
 * Usage:
 * ```typescript
 * import { generateIdeas, listIdeas, promoteIdea } from '@viben/core/idea';
 *
 * // Generate ideas
 * const result = await generateIdeas(repoRoot, {
 *   types: ['code_improvements', 'security_hardening'],
 *   model: 'sonnet',
 * });
 *
 * // List ideas
 * const ideas = listIdeas(repoRoot, { status: 'draft' });
 *
 * // Promote to task
 * const task = promoteIdea(repoRoot, 'a1b2c3d4', { start: true });
 * ```
 */

// Re-export everything from ops
export * from "./ops";
