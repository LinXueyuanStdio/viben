/**
 * FileRL Idea Generator
 *
 * Generates ideas for a specific FileRL run iteration.
 * Ideas are saved to the FileRL directory structure:
 * .viben/filerl/<run-name>/iter{N}/<idea-id>/idea.md
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { Idea } from "../../idea/ops/types";
import {
  gatherProjectContext,
  buildPrompt,
  generateIdeasForType,
} from "../../idea/ops/generator";
import { getIdeaType, loadIdeaTypePrompt } from "../../idea/ops/store";
import { generateShortUuid } from "../../idea/ops/types";

import { getFileRlDir, readState, writeState } from "./state";
import { parseTarget } from "./parser";

// =============================================================================
// Types
// =============================================================================

/**
 * Options for generating ideas for FileRL
 */
export interface GenerateIdeasForFileRlOptions {
  /** Maximum ideas to generate per type */
  maxIdeas?: number;
  /** Model to use for generation */
  model?: string;
  /** Progress callback */
  onProgress?: (message: string) => void;
}

/**
 * Result of generating ideas for FileRL
 */
export interface GenerateIdeasForFileRlResult {
  /** Whether the operation succeeded */
  success: boolean;
  /** Generated ideas */
  ideas: Idea[];
  /** Ideas grouped by type */
  byType: Record<string, number>;
  /** Error message if failed */
  error?: string;
  /** Errors per type */
  typeErrors?: string[];
}

// =============================================================================
// Idea File Generation
// =============================================================================

/**
 * Generate markdown content for an idea file
 *
 * @param idea - The idea to render
 * @returns Markdown content
 */
function generateIdeaMarkdown(idea: Idea): string {
  const lines: string[] = [];

  // YAML frontmatter
  lines.push("---");
  lines.push(`id: ${idea.id}`);
  lines.push(`type: ${idea.type}`);
  lines.push(`title: "${idea.title.replace(/"/g, '\\"')}"`);
  lines.push(`estimated_effort: ${idea.estimatedEffort}`);
  lines.push(`status: ${idea.status}`);
  lines.push(`created_at: ${idea.created_at}`);
  if (idea.affectedFiles && idea.affectedFiles.length > 0) {
    lines.push("affected_files:");
    for (const file of idea.affectedFiles) {
      lines.push(`  - ${file}`);
    }
  }
  if (idea.existingPatterns && idea.existingPatterns.length > 0) {
    lines.push("existing_patterns:");
    for (const pattern of idea.existingPatterns) {
      lines.push(`  - ${pattern}`);
    }
  }
  lines.push("---");
  lines.push("");

  // Title
  lines.push(`# ${idea.title}`);
  lines.push("");

  // Description
  lines.push("## Description");
  lines.push("");
  lines.push(idea.description);
  lines.push("");

  // Rationale
  if (idea.rationale) {
    lines.push("## Rationale");
    lines.push("");
    lines.push(idea.rationale);
    lines.push("");
  }

  // Implementation Approach
  if (idea.implementationApproach) {
    lines.push("## Implementation Approach");
    lines.push("");
    lines.push(idea.implementationApproach);
    lines.push("");
  }

  // Expected Impact
  lines.push("## Expected Impact");
  lines.push("");
  lines.push(`- **Effort Level**: ${idea.estimatedEffort}`);
  if (idea.affectedFiles && idea.affectedFiles.length > 0) {
    lines.push(`- **Affected Files**: ${idea.affectedFiles.length} file(s)`);
  }
  lines.push("");

  return lines.join("\n");
}

/**
 * Save an idea to the FileRL iteration directory
 *
 * @param filerlDir - FileRL run directory
 * @param iteration - Iteration number
 * @param idea - Idea to save
 * @returns Path to the saved idea file
 */
function saveIdeaToIterDir(
  filerlDir: string,
  iteration: number,
  idea: Idea
): string {
  const iterDir = join(filerlDir, `iter${iteration}`);
  const ideaDir = join(iterDir, idea.id);

  // Create directories
  if (!existsSync(ideaDir)) {
    mkdirSync(ideaDir, { recursive: true });
  }

  // Write idea.md
  const ideaPath = join(ideaDir, "idea.md");
  const content = generateIdeaMarkdown(idea);
  writeFileSync(ideaPath, content, "utf-8");

  return ideaPath;
}

// =============================================================================
// Main Generator
// =============================================================================

/**
 * Generate ideas for a FileRL run iteration
 *
 * This function:
 * 1. Loads the FileRL run state and configuration
 * 2. Gathers project context for AI
 * 3. Generates ideas using the idea generator
 * 4. Saves ideas to .viben/filerl/<name>/iter{N}/<idea-id>/idea.md
 * 5. Updates state.json with generated idea IDs
 *
 * @param repoRoot - Repository root path
 * @param name - FileRL run name
 * @param iteration - Target iteration number
 * @param types - Idea types to generate
 * @param options - Generation options
 * @returns Generation result
 */
export async function generateIdeasForFileRl(
  repoRoot: string,
  name: string,
  iteration: number,
  types: string[],
  options: GenerateIdeasForFileRlOptions = {}
): Promise<GenerateIdeasForFileRlResult> {
  const {
    maxIdeas = 5,
    model = "sonnet",
    onProgress,
  } = options;

  const progress = (msg: string) => {
    if (onProgress) {
      onProgress(msg);
    }
  };

  // Load state
  const state = readState(repoRoot, name);
  if (!state) {
    return {
      success: false,
      ideas: [],
      byType: {},
      error: `FileRL run not found: ${name}`,
    };
  }

  // Load config from target file
  const parseResult = parseTarget(state.target_path, repoRoot);
  if (!parseResult.success || !parseResult.config) {
    return {
      success: false,
      ideas: [],
      byType: {},
      error: parseResult.error || "Failed to parse target file",
    };
  }

  const filerlDir = getFileRlDir(repoRoot, name);

  // Gather project context
  progress("Gathering project context...");
  const context = gatherProjectContext(repoRoot);
  progress(`Project: ${context.projectName}, Files: ${context.fileCount}`);

  // Load idea type prompts
  progress("Loading idea type prompts...");
  const typePrompts: Map<string, string> = new Map();
  const typeErrors: string[] = [];

  for (const typeName of types) {
    const ideaType = getIdeaType(typeName, repoRoot);
    if (!ideaType) {
      typeErrors.push(`Unknown idea type: ${typeName}`);
      continue;
    }

    const prompt = loadIdeaTypePrompt(ideaType);
    if (!prompt) {
      typeErrors.push(`Failed to load prompt for type: ${typeName}`);
      continue;
    }

    typePrompts.set(typeName, prompt);
  }

  if (typePrompts.size === 0) {
    return {
      success: false,
      ideas: [],
      byType: {},
      error: "No valid idea types to generate",
      typeErrors,
    };
  }

  // Generate ideas for each type
  const allIdeas: Idea[] = [];
  const byType: Record<string, number> = {};

  for (const [typeName, prompt] of typePrompts) {
    progress(`Generating ${typeName} ideas...`);

    const result = await generateIdeasForType(
      typeName,
      prompt,
      context,
      model,
      maxIdeas
    );

    if (result.error) {
      typeErrors.push(`${typeName}: ${result.error}`);
      progress(`Error generating ${typeName}: ${result.error}`);
    }

    if (result.ideas.length > 0) {
      // Regenerate IDs to ensure uniqueness within this iteration
      const ideasWithNewIds = result.ideas.map(idea => ({
        ...idea,
        id: generateShortUuid(),
      }));

      allIdeas.push(...ideasWithNewIds);
      byType[typeName] = ideasWithNewIds.length;
      progress(`Generated ${ideasWithNewIds.length} ${typeName} ideas`);
    }
  }

  if (allIdeas.length === 0) {
    return {
      success: false,
      ideas: [],
      byType: {},
      error: "No ideas generated",
      typeErrors: typeErrors.length > 0 ? typeErrors : undefined,
    };
  }

  // Save ideas to iteration directory
  progress("Saving ideas to iteration directory...");
  const ideaIds: string[] = [];

  for (const idea of allIdeas) {
    const ideaPath = saveIdeaToIterDir(filerlDir, iteration, idea);
    ideaIds.push(idea.id);
    progress(`Saved: ${idea.id} -> ${ideaPath}`);
  }

  // Update state with generated idea IDs
  // Find or create the iteration in state
  let iterState = state.iterations.find(iter => iter.iteration === iteration);
  if (!iterState) {
    // Create a new iteration if it doesn't exist
    iterState = {
      iteration,
      phase: "generate_ideas",
      ideas: [],
      tasks: [],
      task_idea_map: {},
      rewards: {},
      selected_task: undefined,
      rejected_tasks: [],
      merge_error: undefined,
      completed: false,
      started_at: new Date().toISOString(),
      completed_at: undefined,
    };
    state.iterations.push(iterState);

    // Update current iteration if needed
    if (iteration > state.current_iteration) {
      state.current_iteration = iteration;
    }
  }

  // Add generated idea IDs to the iteration state
  iterState.ideas = [...new Set([...iterState.ideas, ...ideaIds])];
  iterState.phase = "generate_ideas";

  // Save updated state
  writeState(repoRoot, state);

  progress(`Generation complete: ${allIdeas.length} ideas`);

  return {
    success: true,
    ideas: allIdeas,
    byType,
    typeErrors: typeErrors.length > 0 ? typeErrors : undefined,
  };
}
