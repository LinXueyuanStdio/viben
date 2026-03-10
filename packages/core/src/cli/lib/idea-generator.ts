/**
 * Idea Generator
 *
 * AI-powered idea generation for the viben idea command.
 * Orchestrates prompt loading, AI calls, response parsing, and file writing.
 */
import {
  existsSync,
  readdirSync,
  statSync,
  readFileSync,
} from "node:fs";
import { join, basename } from "node:path";
import {
  type IdeaGenerateOptions,
  type IdeaType,
  type Idea,
  type EffortLevel,
  type RawIdeaSession,
  getIdeaIdPrefix,
  isValidEffortLevel,
  DEFAULT_MAX_IDEAS,
} from "./idea-types";
import {
  getIdeaType,
  loadIdeaTypePrompt,
  generateSessionId,
  createSessionDir,
  writeSessionMetadata,
  readSessionMetadata,
  getIdeaFilePath,
  writeIdeasToFile,
  readIdeasFromFile,
  getLatestSession,
} from "./idea-store";
import { modelManager } from "../../models";

// =============================================================================
// Types
// =============================================================================

/**
 * Result of idea generation
 */
export interface GenerateResult {
  /** Session ID */
  sessionId: string;
  /** Session directory path */
  sessionDir: string;
  /** All generated ideas */
  ideas: Idea[];
  /** Count by type */
  byType: Record<string, number>;
  /** Errors encountered */
  errors: string[];
}

/**
 * Result of generating ideas for a single type
 */
export interface AIResponse {
  /** Type that was generated */
  type: string;
  /** Generated ideas */
  ideas: Idea[];
  /** Error if generation failed */
  error?: string;
}

/**
 * Simplified project context for AI prompts
 */
export interface ProjectContext {
  /** Project name */
  projectName: string;
  /** Detected tech stack */
  techStack: string[];
  /** Total file count */
  fileCount: number;
  /** Whether project has tests */
  hasTests: boolean;
  /** Whether project has docs */
  hasDocs: boolean;
  /** Root directory */
  rootDir: string;
}

// =============================================================================
// Project Context
// =============================================================================

/**
 * Gather project context for AI prompts
 *
 * Analyzes the project structure to provide context to the AI.
 * This is a simplified version without Graphiti integration.
 *
 * @param repoRoot - Repository root path
 * @returns ProjectContext object
 */
export function gatherProjectContext(repoRoot: string): ProjectContext {
  const context: ProjectContext = {
    projectName: basename(repoRoot),
    techStack: [],
    fileCount: 0,
    hasTests: false,
    hasDocs: false,
    rootDir: repoRoot,
  };

  // Try to read package.json for project name and tech stack
  const packageJsonPath = join(repoRoot, "package.json");
  if (existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
      context.projectName = pkg.name || context.projectName;

      // Detect tech stack from dependencies
      const allDeps = {
        ...(pkg.dependencies || {}),
        ...(pkg.devDependencies || {}),
      };

      if (allDeps.react) context.techStack.push("React");
      if (allDeps.vue) context.techStack.push("Vue");
      if (allDeps.angular) context.techStack.push("Angular");
      if (allDeps.next) context.techStack.push("Next.js");
      if (allDeps.express) context.techStack.push("Express");
      if (allDeps.fastify) context.techStack.push("Fastify");
      if (allDeps.typescript) context.techStack.push("TypeScript");
      if (allDeps.tailwindcss) context.techStack.push("Tailwind CSS");
      if (allDeps.prisma) context.techStack.push("Prisma");
      if (allDeps.drizzle) context.techStack.push("Drizzle");
    } catch {
      // Ignore parse errors
    }
  }

  // Check for common project structures
  const commonDirs = ["src", "lib", "app", "pages", "components"];
  for (const dir of commonDirs) {
    if (existsSync(join(repoRoot, dir))) {
      context.techStack.push(dir);
      break;
    }
  }

  // Check for tests
  const testDirs = ["test", "tests", "__tests__", "spec"];
  for (const dir of testDirs) {
    if (existsSync(join(repoRoot, dir))) {
      context.hasTests = true;
      break;
    }
  }
  // Also check for test files in src
  if (!context.hasTests && existsSync(join(repoRoot, "src"))) {
    try {
      const srcFiles = readdirSync(join(repoRoot, "src"), { recursive: true });
      context.hasTests = srcFiles.some(
        (f) =>
          typeof f === "string" &&
          (f.includes(".test.") || f.includes(".spec."))
      );
    } catch {
      // Ignore errors
    }
  }

  // Check for docs
  const docDirs = ["docs", "documentation", "doc"];
  for (const dir of docDirs) {
    if (existsSync(join(repoRoot, dir))) {
      context.hasDocs = true;
      break;
    }
  }
  // Also check for README
  if (!context.hasDocs) {
    context.hasDocs = existsSync(join(repoRoot, "README.md"));
  }

  // Count source files (simplified)
  try {
    const srcDir = existsSync(join(repoRoot, "src"))
      ? join(repoRoot, "src")
      : repoRoot;
    context.fileCount = countSourceFiles(srcDir);
  } catch {
    context.fileCount = 0;
  }

  return context;
}

/**
 * Count source files in a directory (recursively)
 *
 * @param dir - Directory to count files in
 * @param maxDepth - Maximum recursion depth
 * @returns Number of source files
 */
function countSourceFiles(dir: string, maxDepth = 5): number {
  if (maxDepth <= 0) return 0;

  let count = 0;
  const sourceExtensions = [".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs"];

  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      // Skip common non-source directories
      if (
        entry.name.startsWith(".") ||
        entry.name === "node_modules" ||
        entry.name === "dist" ||
        entry.name === "build"
      ) {
        continue;
      }

      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        count += countSourceFiles(fullPath, maxDepth - 1);
      } else if (
        entry.isFile() &&
        sourceExtensions.some((ext) => entry.name.endsWith(ext))
      ) {
        count++;
      }
    }
  } catch {
    // Ignore errors
  }

  return count;
}

// =============================================================================
// AI Integration
// =============================================================================

/**
 * Placeholder for AI service integration
 *
 * This function will be connected to viben's AI service.
 * For now, it throws an error indicating integration is needed.
 *
 * TODO: Integrate with viben's AI service (Claude, OpenAI, etc.)
 *
 * @param prompt - The full prompt to send to the AI
 * @param model - Model identifier to use
 * @returns AI response text
 */
async function callAI(prompt: string, model: string): Promise<string> {
  // Resolve model alias if needed
  const resolvedModel = await modelManager.resolveAlias(model);

  // TODO: Integrate with viben's AI service
  // This could use:
  // 1. The Claude Agent SDK (already available in the codebase)
  // 2. Direct API calls to providers
  // 3. A unified AI service abstraction

  // For now, throw an error with helpful information
  throw new Error(
    `AI integration not yet implemented. ` +
    `Model requested: ${resolvedModel}. ` +
    `Please implement callAI() with viben's AI service.`
  );
}

/**
 * Build the full prompt for idea generation
 *
 * @param typePrompt - The type-specific prompt content
 * @param context - Project context
 * @param maxIdeas - Maximum number of ideas to generate
 * @returns Full prompt string
 */
export function buildPrompt(
  typePrompt: string,
  context: ProjectContext,
  maxIdeas: number
): string {
  const contextSummary = `
## Project Context

- **Project Name**: ${context.projectName}
- **Tech Stack**: ${context.techStack.join(", ") || "Not detected"}
- **Source Files**: ~${context.fileCount} files
- **Has Tests**: ${context.hasTests ? "Yes" : "No"}
- **Has Documentation**: ${context.hasDocs ? "Yes" : "No"}
`;

  const outputInstructions = `
## Output Requirements

Generate up to ${maxIdeas} ideas. Return them as a JSON array.

Each idea MUST include these fields:
- id: string (will be assigned by the system, use placeholder like "001", "002")
- type: string (the idea type)
- title: string (short, descriptive title)
- description: string (what the improvement does)
- rationale: string (why this improvement is needed)
- estimated_effort: "trivial" | "small" | "medium" | "large" | "complex"
- affected_files: string[] (list of affected file paths)
- existing_patterns: string[] (patterns to follow, if any)
- implementation_approach: string (how to implement)

Return ONLY the JSON array, no markdown code blocks or other text.

Example output format:
[
  {
    "id": "001",
    "type": "code_improvements",
    "title": "Add retry logic to API calls",
    "description": "Implement automatic retry with exponential backoff for API calls",
    "rationale": "Current implementation fails immediately on network errors",
    "estimated_effort": "small",
    "affected_files": ["src/api/client.ts"],
    "existing_patterns": ["src/utils/retry.ts"],
    "implementation_approach": "Use existing retry utility pattern from utils"
  }
]
`;

  return `${typePrompt}\n\n${contextSummary}\n\n${outputInstructions}`;
}

/**
 * Parse AI response into Idea objects
 *
 * @param response - AI response text
 * @param type - Idea type for ID generation
 * @returns Array of parsed ideas
 */
export function parseAIResponse(response: string, type: string): Idea[] {
  const ideas: Idea[] = [];
  const prefix = getIdeaIdPrefix(type);
  const now = new Date().toISOString();

  try {
    // Try to extract JSON from the response
    let jsonStr = response.trim();

    // Remove markdown code blocks if present
    if (jsonStr.startsWith("```json")) {
      jsonStr = jsonStr.slice(7);
    } else if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.slice(3);
    }
    if (jsonStr.endsWith("```")) {
      jsonStr = jsonStr.slice(0, -3);
    }

    jsonStr = jsonStr.trim();

    // Parse as JSON array
    const parsed = JSON.parse(jsonStr);

    if (!Array.isArray(parsed)) {
      // AI returned a single object instead of array, wrap it
      return parseAIResponse(JSON.stringify([parsed]), type);
    }

    for (let i = 0; i < parsed.length; i++) {
      const raw = parsed[i];
      if (!raw || typeof raw !== "object") continue;

      // Generate proper ID
      const id = generateIdeaId(type, i);

      // Parse effort level
      let effort: EffortLevel = "medium";
      if (raw.estimated_effort && isValidEffortLevel(raw.estimated_effort)) {
        effort = raw.estimated_effort;
      }

      const idea: Idea = {
        id,
        type,
        title: String(raw.title || "Untitled"),
        description: String(raw.description || ""),
        rationale: String(raw.rationale || ""),
        estimatedEffort: effort,
        status: "draft",
        createdAt: now,
        affectedFiles: Array.isArray(raw.affected_files)
          ? raw.affected_files.map(String)
          : undefined,
        existingPatterns: Array.isArray(raw.existing_patterns)
          ? raw.existing_patterns.map(String)
          : undefined,
        implementationApproach: raw.implementation_approach
          ? String(raw.implementation_approach)
          : undefined,
        category: raw.category ? String(raw.category) : undefined,
        severity: raw.severity ? String(raw.severity) : undefined,
      };

      ideas.push(idea);
    }
  } catch {
    // Failed to parse AI response, try to salvage partial JSON
    try {
      // Look for array pattern in the response
      const match = response.match(/\[[\s\S]*\]/);
      if (match) {
        return parseAIResponse(match[0], type);
      }
    } catch {
      // Give up, return empty array
    }
  }

  return ideas;
}

/**
 * Generate a unique idea ID
 *
 * Format: <prefix>-<number> (e.g., ci-001, sec-002)
 *
 * @param type - Idea type
 * @param index - Index in the list (0-based)
 * @returns Generated ID string
 */
export function generateIdeaId(type: string, index: number): string {
  const prefix = getIdeaIdPrefix(type);
  const num = String(index + 1).padStart(3, "0");
  return `${prefix}-${num}`;
}

/**
 * Generate ideas for a single type
 *
 * @param type - Idea type name
 * @param prompt - Full prompt to use
 * @param context - Project context
 * @param model - Model to use
 * @param maxIdeas - Maximum ideas to generate
 * @returns AIResponse with ideas or error
 */
export async function generateIdeasForType(
  type: string,
  prompt: string,
  context: ProjectContext,
  model: string,
  maxIdeas: number
): Promise<AIResponse> {
  try {
    // Build the full prompt
    const fullPrompt = buildPrompt(prompt, context, maxIdeas);

    // Call AI service
    const response = await callAI(fullPrompt, model);

    // Parse the response
    const ideas = parseAIResponse(response, type);

    return {
      type,
      ideas,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      type,
      ideas: [],
      error: message,
    };
  }
}

// =============================================================================
// Main Generator
// =============================================================================

/**
 * Generate ideas for the specified types
 *
 * This is the main entry point for idea generation.
 *
 * @param repoRoot - Repository root path
 * @param options - Generation options
 * @param onProgress - Optional progress callback
 * @returns GenerateResult with all generated ideas
 */
export async function generateIdeas(
  repoRoot: string,
  options: IdeaGenerateOptions,
  onProgress?: (message: string) => void
): Promise<GenerateResult> {
  const {
    types,
    output: customOutput,
    model = "sonnet",
    maxIdeas = DEFAULT_MAX_IDEAS,
    append = false,
    override = false,
  } = options;

  const errors: string[] = [];
  const allIdeas: Idea[] = [];
  const byType: Record<string, number> = {};

  // Report progress
  const progress = (msg: string) => {
    if (onProgress) {
      onProgress(msg);
    }
  };

  progress("Starting idea generation...");

  // Gather project context
  progress("Gathering project context...");
  const context = gatherProjectContext(repoRoot);
  progress(
    `Project: ${context.projectName}, Files: ${context.fileCount}, Tech: ${context.techStack.join(", ")}`
  );

  // Load idea types and prompts
  progress("Loading idea type prompts...");
  const typePrompts: Map<string, { ideaType: IdeaType; prompt: string }> =
    new Map();

  for (const typeName of types) {
    const ideaType = getIdeaType(typeName, repoRoot);
    if (!ideaType) {
      errors.push(`Unknown idea type: ${typeName}`);
      continue;
    }

    const prompt = loadIdeaTypePrompt(ideaType);
    if (!prompt) {
      errors.push(`Failed to load prompt for type: ${typeName}`);
      continue;
    }

    typePrompts.set(typeName, { ideaType, prompt });
  }

  if (typePrompts.size === 0) {
    return {
      sessionId: "",
      sessionDir: "",
      ideas: [],
      byType: {},
      errors: errors.length > 0 ? errors : ["No valid idea types specified"],
    };
  }

  // Generate or use existing session
  let sessionId: string;
  let sessionDir: string;

  if (append) {
    // Try to find the latest session
    const latestSession = getLatestSession(repoRoot, customOutput);
    if (latestSession) {
      sessionDir = latestSession;
      sessionId = basename(latestSession);
      progress(`Appending to existing session: ${sessionId}`);
    } else {
      // No existing session, create new one
      sessionId = generateSessionId(types);
      sessionDir = createSessionDir(repoRoot, sessionId, customOutput);
      progress(`Creating new session: ${sessionId}`);
    }
  } else {
    sessionId = generateSessionId(types);
    sessionDir = createSessionDir(repoRoot, sessionId, customOutput);
    progress(`Creating session: ${sessionId}`);
  }

  // Generate ideas for each type in parallel
  progress(`Generating ideas for ${typePrompts.size} types...`);

  const generatePromises: Promise<AIResponse>[] = [];

  for (const entry of Array.from(typePrompts.entries())) {
    const [typeName, { ideaType, prompt }] = entry;
    // Check if we should skip this type (append mode without override)
    if (append && !override) {
      const existingFile = getIdeaFilePath(sessionDir, typeName);
      if (existsSync(existingFile)) {
        const existingIdeas = readIdeasFromFile(existingFile);
        if (existingIdeas.length > 0) {
          progress(`Skipping ${typeName} (already has ${existingIdeas.length} ideas)`);
          allIdeas.push(...existingIdeas);
          byType[typeName] = existingIdeas.length;
          continue;
        }
      }
    }

    progress(`Generating ${typeName} ideas...`);
    const typeMaxIdeas = ideaType.maxIdeas || maxIdeas;

    generatePromises.push(
      generateIdeasForType(typeName, prompt, context, model, typeMaxIdeas)
    );
  }

  // Wait for all generations to complete
  const results = await Promise.all(generatePromises);

  // Process results
  for (const result of results) {
    if (result.error) {
      errors.push(`${result.type}: ${result.error}`);
      progress(`Error generating ${result.type}: ${result.error}`);
    }

    if (result.ideas.length > 0) {
      // Handle append mode - merge with existing ideas
      let finalIdeas = result.ideas;

      if (append) {
        const existingFile = getIdeaFilePath(sessionDir, result.type);
        if (existsSync(existingFile)) {
          const existingIdeas = readIdeasFromFile(existingFile);
          // Re-number new ideas to avoid ID conflicts
          const startIndex = existingIdeas.length;
          finalIdeas = result.ideas.map((idea, i) => ({
            ...idea,
            id: generateIdeaId(result.type, startIndex + i),
          }));
          finalIdeas = [...existingIdeas, ...finalIdeas];
        }
      }

      // Write ideas to file
      const filePath = getIdeaFilePath(sessionDir, result.type);
      writeIdeasToFile(filePath, finalIdeas);

      allIdeas.push(...finalIdeas);
      byType[result.type] = finalIdeas.length;

      progress(`Generated ${result.ideas.length} ${result.type} ideas`);
    }
  }

  // Write session metadata
  const sessionData: RawIdeaSession = {
    id: sessionId,
    types: Array.from(typePrompts.keys()),
    model,
    summary: {
      total_ideas: allIdeas.length,
      by_type: byType,
      by_status: {
        draft: allIdeas.filter((i) => i.status === "draft").length,
        promoted: allIdeas.filter((i) => i.status === "promoted").length,
        dismissed: allIdeas.filter((i) => i.status === "dismissed").length,
      },
    },
    generated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  writeSessionMetadata(sessionDir, sessionData);

  progress(
    `Generation complete: ${allIdeas.length} ideas in ${Object.keys(byType).length} types`
  );

  return {
    sessionId,
    sessionDir,
    ideas: allIdeas,
    byType,
    errors,
  };
}

// =============================================================================
// Re-exports
// =============================================================================

export {
  type IdeaGenerateOptions,
  type IdeaType,
  type Idea,
  type EffortLevel,
} from "./idea-types";
