/**
 * Idea CRUD Operations
 *
 * Create, Read, Update, Delete operations for ideas.
 * Used by both CLI and API endpoints.
 */

import { createTask, type CreateTaskOptions } from "../../task/ops/crud";

import {
  type Idea,
  type IdeaListOptions,
  type IdeaPromoteOptions,
  type IdeaRemoveOptions,
  type IdeaListResult,
  type IdeaViewResult,
  type IdeaPromoteResult,
  type IdeaRemoveResult,
  type IdeaListTypesResult,
  type EffortLevel,
  EFFORT_PRIORITY_MAP,
  isValidEffortLevel,
  isValidIdeaStatus,
  EFFORT_LEVELS,
  IDEA_STATUSES,
} from "./types";

import {
  listIdeaTypes,
  getIdeaType,
  getAllIdeas,
  getIdeaById,
  findIdeaById,
  updateIdeaStatus,
  removeIdea,
  removeIdeasByType,
  removeAllIdeas,
} from "./store";

// =============================================================================
// List Ideas
// =============================================================================

/**
 * List all ideas with optional filtering
 *
 * @param repoRoot - Repository root path
 * @param options - Filter options
 * @returns List of ideas
 */
export function listIdeas(
  repoRoot: string,
  options?: IdeaListOptions
): IdeaListResult {
  try {
    // Validate filters
    if (options?.effort && !isValidEffortLevel(options.effort)) {
      return {
        success: false,
        ideas: [],
        count: 0,
        error: `Invalid effort level. Must be one of: ${EFFORT_LEVELS.join(", ")}`,
      };
    }

    if (options?.status && !isValidIdeaStatus(options.status)) {
      return {
        success: false,
        ideas: [],
        count: 0,
        error: `Invalid status. Must be one of: ${IDEA_STATUSES.join(", ")}`,
      };
    }

    const ideas = getAllIdeas(repoRoot, options);

    return {
      success: true,
      ideas,
      count: ideas.length,
    };
  } catch (error) {
    return {
      success: false,
      ideas: [],
      count: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// =============================================================================
// List Idea Types
// =============================================================================

/**
 * List all available idea types (builtin + custom)
 *
 * @param repoRoot - Repository root path
 * @returns List of idea types
 */
export function listTypes(repoRoot: string): IdeaListTypesResult {
  try {
    const types = listIdeaTypes(repoRoot);

    return {
      success: true,
      types,
      count: types.length,
    };
  } catch (error) {
    return {
      success: false,
      types: [],
      count: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// =============================================================================
// View Idea
// =============================================================================

/**
 * Get idea details by ID
 *
 * @param repoRoot - Repository root path
 * @param ideaId - Idea ID
 * @returns Idea details
 */
export function viewIdea(repoRoot: string, ideaId: string): IdeaViewResult {
  try {
    const result = findIdeaById(repoRoot, ideaId);

    if (!result) {
      return {
        success: false,
        error: `Idea not found: ${ideaId}`,
      };
    }

    return {
      success: true,
      idea: result.idea,
      sessionDir: result.sessionDir,
      filePath: result.filePath,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// =============================================================================
// Promote Idea
// =============================================================================

/**
 * Promote an idea to a task
 *
 * Creates a new task from an idea, using the idea's title and description.
 * Updates the idea's status to "promoted" and links it to the created task.
 *
 * @param repoRoot - Repository root path
 * @param ideaId - Idea ID to promote
 * @param options - Task creation options
 * @returns Promotion result
 */
export function promoteIdea(
  repoRoot: string,
  ideaId: string,
  options: IdeaPromoteOptions = {}
): IdeaPromoteResult {
  try {
    // Get idea first to validate and get effort for default priority
    const idea = getIdeaById(repoRoot, ideaId);
    if (!idea) {
      return {
        success: false,
        error: `Idea not found: ${ideaId}`,
      };
    }

    if (idea.status === "promoted") {
      return {
        success: false,
        error: `Idea "${ideaId}" has already been promoted to task "${idea.promotedTo}"`,
      };
    }

    // Use effort-based priority if not specified
    const priority =
      options.priority || EFFORT_PRIORITY_MAP[idea.estimatedEffort] || "P2";

    // Create task using the idea's title
    const taskOptions: CreateTaskOptions = {
      slug: options.slug,
      assignee: options.assignee,
      priority,
      description: options.description || idea.description,
      branch: options.branch,
      agent: options.agent,
      executor: options.executor,
      model: options.model,
      start: options.start,
      worktree: options.worktree,
    };

    const result = createTask(repoRoot, idea.title, taskOptions);

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to create task",
      };
    }

    // Update idea status to promoted
    updateIdeaStatus(repoRoot, idea.id, "promoted", result.dirName);

    return {
      success: true,
      ideaId: ideaId,
      ideaTitle: idea.title,
      taskId: result.dirName,
      taskDir: result.taskDir,
      dirName: result.dirName,
      priority,
      status: options.start ? "queue" : "backlog",
      worktree: options.worktree || false,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// =============================================================================
// Remove Ideas
// =============================================================================

/**
 * Remove ideas by ID, type, or all
 *
 * @param repoRoot - Repository root path
 * @param ideaIds - Array of idea IDs to remove (optional)
 * @param options - Remove options
 * @returns Remove result
 */
export function removeIdeas(
  repoRoot: string,
  ideaIds: string[] = [],
  options: IdeaRemoveOptions = {}
): IdeaRemoveResult {
  try {
    // Validate that at least one option is provided
    if (!ideaIds.length && !options.type && !options.all) {
      return {
        success: false,
        removed: [],
        count: 0,
        error: "Must specify idea IDs, --type, or --all",
      };
    }

    let removedCount = 0;
    const removedIds: string[] = [];

    if (options.all) {
      removedCount = removeAllIdeas(repoRoot);
    } else if (options.type) {
      removedCount = removeIdeasByType(repoRoot, options.type);
    } else if (ideaIds.length > 0) {
      for (const id of ideaIds) {
        if (removeIdea(repoRoot, id)) {
          removedIds.push(id);
          removedCount++;
        }
      }
    }

    return {
      success: true,
      removed: removedIds,
      count: removedCount,
    };
  } catch (error) {
    return {
      success: false,
      removed: [],
      count: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// =============================================================================
// Dismiss Idea
// =============================================================================

/**
 * Dismiss an idea (mark as not worth pursuing)
 *
 * @param repoRoot - Repository root path
 * @param ideaId - Idea ID to dismiss
 * @returns Whether the idea was dismissed
 */
export function dismissIdea(
  repoRoot: string,
  ideaId: string
): { success: boolean; error?: string } {
  try {
    const idea = getIdeaById(repoRoot, ideaId);
    if (!idea) {
      return {
        success: false,
        error: `Idea not found: ${ideaId}`,
      };
    }

    if (idea.status === "promoted") {
      return {
        success: false,
        error: `Cannot dismiss promoted idea "${ideaId}"`,
      };
    }

    updateIdeaStatus(repoRoot, ideaId, "dismissed");

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// =============================================================================
// Validate Idea Type
// =============================================================================

/**
 * Validate that an idea type exists
 *
 * @param repoRoot - Repository root path
 * @param typeName - Type name to validate
 * @returns Whether the type exists
 */
export function validateIdeaType(
  repoRoot: string,
  typeName: string
): { valid: boolean; error?: string } {
  const ideaType = getIdeaType(typeName, repoRoot);
  if (!ideaType) {
    return {
      valid: false,
      error: `Unknown idea type: ${typeName}. Use "viben idea list-types" to see available types.`,
    };
  }
  return { valid: true };
}

/**
 * Validate multiple idea types
 *
 * @param repoRoot - Repository root path
 * @param typeNames - Type names to validate
 * @returns Validation result with invalid types
 */
export function validateIdeaTypes(
  repoRoot: string,
  typeNames: string[]
): { valid: boolean; invalidTypes: string[] } {
  const invalidTypes: string[] = [];

  for (const typeName of typeNames) {
    const ideaType = getIdeaType(typeName, repoRoot);
    if (!ideaType) {
      invalidTypes.push(typeName);
    }
  }

  return {
    valid: invalidTypes.length === 0,
    invalidTypes,
  };
}
