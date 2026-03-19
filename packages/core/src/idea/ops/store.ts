/**
 * Idea Store
 *
 * Storage utilities for managing idea sessions and idea files.
 *
 * Directory Structure:
 * .viben/
 * └── ideas/
 *     └── <date>-<slug>/           # Session directory
 *         ├── idea.json            # Session metadata
 *         ├── idea_<type>_<name1>.md
 *         └── idea_<type>_<name2>.md
 *
 * docs/
 * └── idea-types/                  # Idea type prompts (builtin + custom)
 *     └── <type>.md                # Copied from templates via `viben team init`
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
  rmSync,
} from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

import {
  CUSTOM_IDEA_TYPES_DIR,
  IDEAS_DIR,
  IDEA_JSON_FILE,
  IDEA_FILE_PREFIX,
  DEFAULT_MAX_IDEAS,
  BUILTIN_IDEA_TYPES,
  type IdeaType,
  type IdeaTypeSource,
  type IdeaStatus,
  type Idea,
  type IdeaSession,
  type IdeaListOptions,
  type RawIdeaSession,
  isValidEffortLevel,
  isValidIdeaStatus,
  getIdeaIdPrefix,
  parseRawSession,
  generateShortUuid,
} from "./types";

// =============================================================================
// Constants
// =============================================================================

/** .viben directory name */
const DIR_VIBEN = ".viben";

/**
 * Built-in type descriptions (fallback when prompt file doesn't exist)
 */
const BUILTIN_TYPE_DESCRIPTIONS: Record<string, string> = {
  code_improvements: "代码改进 - 基于现有模式的改进机会",
  code_quality: "代码质量 - 代码质量改进和重构模式",
  documentation_gaps: "文档缺失 - 缺失或不足的文档",
  performance_optimizations: "性能优化 - 性能瓶颈和优化技术",
  security_hardening: "安全加固 - 安全漏洞和加固措施",
  ui_ux_improvements: "UI/UX 改进 - 视觉和交互增强",
};

// =============================================================================
// Path Utilities
// =============================================================================

/**
 * Get date prefix in MM-DD format
 * @internal - Not exported to avoid conflicts with viben-workspace.ts
 */
function getDatePrefix(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${month}-${day}`;
}

/**
 * Get the ideas directory path
 *
 * @param repoRoot - Repository root path
 * @param customOutput - Optional custom output directory
 * @returns Absolute path to ideas directory
 */
export function getIdeasDir(repoRoot: string, customOutput?: string): string {
  if (customOutput) {
    return resolve(repoRoot, customOutput);
  }
  return join(repoRoot, DIR_VIBEN, IDEAS_DIR);
}

/**
 * Get the idea types directory path
 *
 * All idea types (builtin + custom) are stored in docs/idea-types/.
 * Builtin types are copied there by `viben team init`.
 *
 * @param repoRoot - Repository root path
 * @returns Absolute path to idea types directory
 */
export function getIdeaTypesDir(repoRoot: string): string {
  return join(repoRoot, CUSTOM_IDEA_TYPES_DIR);
}

/**
 * Get a specific idea session directory path
 *
 * @param repoRoot - Repository root path
 * @param sessionId - Session ID (e.g., "03-11-api-improvement")
 * @returns Absolute path to session directory
 */
export function getIdeaSessionDir(repoRoot: string, sessionId: string): string {
  return join(getIdeasDir(repoRoot), sessionId);
}

/**
 * Get the idea.json file path within a session directory
 *
 * @param sessionDir - Session directory path
 * @returns Path to idea.json file
 */
export function getIdeaJsonPath(sessionDir: string): string {
  return join(sessionDir, IDEA_JSON_FILE);
}

/**
 * Get the idea markdown file path for a specific type
 *
 * @param sessionDir - Session directory path
 * @param type - Idea type name (e.g., "code_improvements")
 * @returns Path to idea_<type>.md file
 */
export function getIdeaMarkdownPath(sessionDir: string, type: string): string {
  return join(sessionDir, `${IDEA_FILE_PREFIX}${type}.md`);
}

/**
 * Get the prompt file path for a specific idea type
 *
 * @param repoRoot - Repository root path
 * @param type - Idea type name
 * @returns Path to prompt file in docs/idea-types/
 */
export function getIdeaTypePromptPath(repoRoot: string, type: string): string {
  return join(getIdeaTypesDir(repoRoot), `${type}.md`);
}

/**
 * Get the built-in prompt file path for a specific idea type
 *
 * Built-in prompts are located in packages/core/src/prompts/idea-types/
 *
 * @param type - Idea type name
 * @returns Path to built-in prompt file
 */
export function getBuiltinIdeaTypePromptPath(type: string): string {
  // Get the directory where this file is located
  const currentDir = dirname(fileURLToPath(import.meta.url));
  // After bundling with tsup, CLI code is bundled into dist/cli/bin.js
  // So currentDir is dist/cli/, and prompts are at dist/prompts/idea-types
  const srcPromptsDir = resolve(currentDir, "../prompts/idea-types");
  return join(srcPromptsDir, `${type}.md`);
}

// =============================================================================
// Idea Type Management
// =============================================================================

/**
 * Parse YAML frontmatter from a markdown file using gray-matter
 *
 * @param content - File content
 * @returns Object with frontmatter (data) and body (content)
 */
function parseFrontmatter(content: string): {
  frontmatter: Record<string, unknown>;
  body: string;
} {
  try {
    const parsed = matter(content);
    return {
      frontmatter: parsed.data as Record<string, unknown>,
      body: parsed.content,
    };
  } catch {
    return { frontmatter: {}, body: content };
  }
}

/**
 * Parse an Idea from parsed frontmatter and body content
 *
 * @param frontmatter - Parsed YAML frontmatter
 * @param body - Markdown body content
 * @returns Idea or null if invalid
 */
function parseIdeaFromFrontmatterAndBody(
  frontmatter: Record<string, unknown>,
  body: string
): Idea | null {
  if (!frontmatter.id) {
    return null;
  }

  // Parse from frontmatter
  const affectedFiles = Array.isArray(frontmatter.affected_files)
    ? frontmatter.affected_files.map(String)
    : [];
  const existingPatterns = Array.isArray(frontmatter.existing_patterns)
    ? frontmatter.existing_patterns.map(String)
    : [];

  // Body is the implementation approach
  const implementationApproach = body.trim() || undefined;

  const effortStr = String(frontmatter.estimated_effort || "medium");

  return {
    id: String(frontmatter.id),
    type: String(frontmatter.type || ""),
    name: frontmatter.name ? String(frontmatter.name) : undefined,
    title: String(frontmatter.title || ""),
    description: String(frontmatter.description || ""),
    rationale: String(frontmatter.rationale || ""),
    estimatedEffort: isValidEffortLevel(effortStr) ? effortStr : "medium",
    status:
      frontmatter.status === "promoted"
        ? "promoted"
        : frontmatter.status === "dismissed"
          ? "dismissed"
          : "draft",
    promotedTo:
      frontmatter.promoted_to && frontmatter.promoted_to !== "null"
        ? String(frontmatter.promoted_to)
        : undefined,
    createdAt: String(frontmatter.created_at || new Date().toISOString()),
    affectedFiles: affectedFiles.length > 0 ? affectedFiles : undefined,
    existingPatterns:
      existingPatterns.length > 0 ? existingPatterns : undefined,
    implementationApproach,
    category: frontmatter.category
      ? String(frontmatter.category)
      : undefined,
    severity: frontmatter.severity
      ? String(frontmatter.severity)
      : undefined,
  };
}

/**
 * Load an idea type from a file
 *
 * @param promptPath - Path to the prompt file
 * @param source - Source of the idea type
 * @returns IdeaType object or null if file doesn't exist
 */
function loadIdeaTypeFromFile(
  promptPath: string,
  source: IdeaTypeSource
): IdeaType | null {
  if (!existsSync(promptPath)) {
    return null;
  }

  try {
    const content = readFileSync(promptPath, "utf-8");
    const { frontmatter } = parseFrontmatter(content);

    // Get type name from frontmatter or filename
    const fileName = promptPath.split("/").pop()?.replace(".md", "") || "";
    const name = (frontmatter.name as string) || fileName;

    return {
      name,
      description:
        (frontmatter.description as string) ||
        BUILTIN_TYPE_DESCRIPTIONS[name] ||
        `Custom type: ${name}`,
      maxIdeas: (frontmatter.max_ideas as number) || DEFAULT_MAX_IDEAS,
      source,
      promptPath,
    };
  } catch {
    return null;
  }
}

/**
 * Check if a type name is a builtin type
 */
function isBuiltinTypeName(name: string): boolean {
  return BUILTIN_IDEA_TYPES.includes(name as typeof BUILTIN_IDEA_TYPES[number]);
}

/**
 * Get a single idea type by name
 *
 * Search order:
 * 1. Custom types (docs/idea-types/*.md)
 * 2. Built-in types (packages/core/src/prompts/idea-types/*.md)
 *
 * @param typeName - Name of the idea type
 * @param repoRoot - Repository root path
 * @returns IdeaType object or null if not found
 */
export function getIdeaType(typeName: string, repoRoot: string): IdeaType | null {
  // First, try custom/project-local types in docs/idea-types/
  const customPromptPath = getIdeaTypePromptPath(repoRoot, typeName);
  if (existsSync(customPromptPath)) {
    const source: IdeaTypeSource = isBuiltinTypeName(typeName) ? "builtin" : "custom";
    return loadIdeaTypeFromFile(customPromptPath, source);
  }

  // Fallback to built-in types in packages/core/src/prompts/idea-types/
  if (isBuiltinTypeName(typeName)) {
    const builtinPromptPath = getBuiltinIdeaTypePromptPath(typeName);
    if (existsSync(builtinPromptPath)) {
      return loadIdeaTypeFromFile(builtinPromptPath, "builtin");
    }
  }

  return null;
}

/**
 * List all available idea types
 *
 * Search order:
 * 1. Custom types in docs/idea-types/ (project-local)
 * 2. Built-in types in packages/core/src/prompts/idea-types/ (fallback)
 *
 * @param repoRoot - Repository root path
 * @returns Array of IdeaType objects
 */
export function listIdeaTypes(repoRoot: string): IdeaType[] {
  const types: IdeaType[] = [];
  const seenNames = new Set<string>();

  // First, read custom/project-local types from docs/idea-types/
  const customTypesDir = getIdeaTypesDir(repoRoot);
  if (existsSync(customTypesDir)) {
    try {
      const files = readdirSync(customTypesDir);
      for (const file of files) {
        if (file.endsWith(".md")) {
          const promptPath = join(customTypesDir, file);
          const typeName = file.replace(".md", "");
          const source: IdeaTypeSource = isBuiltinTypeName(typeName) ? "builtin" : "custom";
          const ideaType = loadIdeaTypeFromFile(promptPath, source);
          if (ideaType && !seenNames.has(ideaType.name)) {
            types.push(ideaType);
            seenNames.add(ideaType.name);
          }
        }
      }
    } catch {
      // Ignore errors reading types directory
    }
  }

  // Then, add built-in types that weren't overridden
  for (const typeName of BUILTIN_IDEA_TYPES) {
    if (!seenNames.has(typeName)) {
      const builtinPromptPath = getBuiltinIdeaTypePromptPath(typeName);
      if (existsSync(builtinPromptPath)) {
        const ideaType = loadIdeaTypeFromFile(builtinPromptPath, "builtin");
        if (ideaType) {
          types.push(ideaType);
          seenNames.add(ideaType.name);
        }
      }
    }
  }

  return types.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Load the prompt content for an idea type
 *
 * @param ideaType - IdeaType object
 * @returns Prompt content (without frontmatter) or null
 */
export function loadIdeaTypePrompt(ideaType: IdeaType): string | null {
  if (!existsSync(ideaType.promptPath)) {
    return null;
  }

  try {
    const content = readFileSync(ideaType.promptPath, "utf-8");
    const { body } = parseFrontmatter(content);
    return body.trim();
  } catch {
    return null;
  }
}

// =============================================================================
// Idea Type CRUD Operations
// =============================================================================

/**
 * Input for creating/updating an idea type file
 */
export interface IdeaTypeFileInput {
  name?: string;
  description?: string;
  maxIdeas?: number;
  promptContent?: string;
}

/**
 * Create a new custom idea type
 *
 * Creates a markdown file with YAML frontmatter in docs/idea-types/.
 *
 * @param repoRoot - Repository root path
 * @param input - Idea type data
 * @returns Created IdeaType object
 */
export function createIdeaType(
  repoRoot: string,
  input: Required<Pick<IdeaTypeFileInput, "name" | "description">> & IdeaTypeFileInput
): IdeaType {
  const typesDir = getIdeaTypesDir(repoRoot);

  // Ensure directory exists
  if (!existsSync(typesDir)) {
    mkdirSync(typesDir, { recursive: true });
  }

  const promptPath = join(typesDir, `${input.name}.md`);

  // Build YAML frontmatter
  const frontmatterLines = [
    "---",
    `name: ${input.name}`,
    `description: ${input.description}`,
  ];

  if (input.maxIdeas !== undefined) {
    frontmatterLines.push(`max_ideas: ${input.maxIdeas}`);
  }

  frontmatterLines.push("---");

  // Combine frontmatter with prompt content
  const content = frontmatterLines.join("\n") + "\n\n" + (input.promptContent || "");
  writeFileSync(promptPath, content, "utf-8");

  return {
    name: input.name,
    description: input.description,
    maxIdeas: input.maxIdeas ?? DEFAULT_MAX_IDEAS,
    source: "custom",
    promptPath,
  };
}

/**
 * Update an existing idea type
 *
 * Updates the markdown file in docs/idea-types/.
 *
 * @param repoRoot - Repository root path
 * @param typeName - Name of the type to update
 * @param input - Fields to update
 * @returns Updated IdeaType object
 */
export function updateIdeaType(
  repoRoot: string,
  typeName: string,
  input: IdeaTypeFileInput
): IdeaType {
  const promptPath = getIdeaTypePromptPath(repoRoot, typeName);

  if (!existsSync(promptPath)) {
    throw new Error(`Idea type file not found: ${promptPath}`);
  }

  // Read existing content
  const content = readFileSync(promptPath, "utf-8");
  const { frontmatter, body } = parseFrontmatter(content);

  // Update frontmatter fields
  const newFrontmatter = {
    name: typeName,
    description: input.description ?? (frontmatter.description as string) ?? "",
    max_ideas: input.maxIdeas ?? (frontmatter.max_ideas as number) ?? DEFAULT_MAX_IDEAS,
  };

  // Build new content
  const frontmatterLines = [
    "---",
    `name: ${newFrontmatter.name}`,
    `description: ${newFrontmatter.description}`,
    `max_ideas: ${newFrontmatter.max_ideas}`,
    "---",
  ];

  const newBody = input.promptContent !== undefined ? input.promptContent : body;
  const newContent = frontmatterLines.join("\n") + "\n\n" + newBody.trim() + "\n";

  writeFileSync(promptPath, newContent, "utf-8");

  return {
    name: typeName,
    description: newFrontmatter.description,
    maxIdeas: newFrontmatter.max_ideas,
    source: isBuiltinTypeName(typeName) ? "builtin" : "custom",
    promptPath,
  };
}

/**
 * Delete a custom idea type
 *
 * Removes the markdown file from docs/idea-types/.
 *
 * @param repoRoot - Repository root path
 * @param typeName - Name of the type to delete
 */
export function deleteIdeaType(repoRoot: string, typeName: string): void {
  const promptPath = getIdeaTypePromptPath(repoRoot, typeName);

  if (!existsSync(promptPath)) {
    throw new Error(`Idea type file not found: ${promptPath}`);
  }

  unlinkSync(promptPath);
}

// =============================================================================
// Session Management
// =============================================================================

/**
 * Generate a session ID
 *
 * Format: MM-DD-<slug>
 *
 * @param types - Array of types being generated
 * @returns Session ID string
 */
export function generateSessionId(types: string[]): string {
  const datePrefix = getDatePrefix();

  // Generate slug from types
  let slug: string;
  if (types.length === 1) {
    // Single type: use type name
    slug = types[0].replace(/_/g, "-");
  } else if (types.length <= 3) {
    // Few types: abbreviate each
    slug = types.map((t) => getIdeaIdPrefix(t)).join("-");
  } else {
    // Many types: use "mixed"
    slug = "mixed";
  }

  return `${datePrefix}-${slug}`;
}

/**
 * Create a new session directory
 *
 * @param repoRoot - Repository root path
 * @param sessionId - Session ID
 * @param customOutput - Optional custom output directory
 * @returns Absolute path to session directory
 */
export function createSessionDir(
  repoRoot: string,
  sessionId: string,
  customOutput?: string
): string {
  const ideasDir = getIdeasDir(repoRoot, customOutput);
  const sessionDir = join(ideasDir, sessionId);

  if (!existsSync(sessionDir)) {
    mkdirSync(sessionDir, { recursive: true });
  }

  return sessionDir;
}

/**
 * Write session metadata (idea.json)
 *
 * @param sessionDir - Session directory path
 * @param session - Session data
 */
export function writeSessionMetadata(
  sessionDir: string,
  session: RawIdeaSession
): void {
  const jsonPath = join(sessionDir, IDEA_JSON_FILE);
  writeFileSync(jsonPath, JSON.stringify(session, null, 2), "utf-8");
}

/**
 * Read session metadata (idea.json)
 *
 * @param sessionDir - Session directory path
 * @returns Session data or null if not found
 */
export function readSessionMetadata(sessionDir: string): IdeaSession | null {
  const jsonPath = join(sessionDir, IDEA_JSON_FILE);
  if (!existsSync(jsonPath)) {
    return null;
  }

  try {
    const content = readFileSync(jsonPath, "utf-8");
    const raw = JSON.parse(content) as RawIdeaSession;
    return parseRawSession(raw);
  } catch {
    return null;
  }
}

/**
 * List all sessions
 *
 * @param repoRoot - Repository root path
 * @param customOutput - Optional custom output directory
 * @returns Array of session directories (sorted by date, newest first)
 */
export function listSessions(
  repoRoot: string,
  customOutput?: string
): string[] {
  const ideasDir = getIdeasDir(repoRoot, customOutput);
  if (!existsSync(ideasDir)) {
    return [];
  }

  try {
    const dirs = readdirSync(ideasDir, { withFileTypes: true });
    return dirs
      .filter((d) => d.isDirectory())
      .filter((d) => existsSync(join(ideasDir, d.name, IDEA_JSON_FILE)))
      .map((d) => join(ideasDir, d.name))
      .sort((a, b) => {
        // Sort by directory name (which includes date prefix)
        const aName = a.split("/").pop() || "";
        const bName = b.split("/").pop() || "";
        return bName.localeCompare(aName);
      });
  } catch {
    return [];
  }
}

/**
 * Get the latest session directory
 *
 * @param repoRoot - Repository root path
 * @param customOutput - Optional custom output directory
 * @returns Session directory path or null
 */
export function getLatestSession(
  repoRoot: string,
  customOutput?: string
): string | null {
  const sessions = listSessions(repoRoot, customOutput);
  return sessions.length > 0 ? sessions[0] : null;
}

/**
 * List all idea sessions with their metadata
 *
 * @param repoRoot - Repository root path
 * @returns Array of IdeaSessions, sorted by date descending
 */
export function listIdeaSessions(repoRoot: string): IdeaSession[] {
  const sessionDirs = listSessions(repoRoot);
  const sessions: IdeaSession[] = [];

  for (const sessionDir of sessionDirs) {
    const session = readSessionMetadata(sessionDir);
    if (session) {
      sessions.push(session);
    }
  }

  return sessions;
}

/**
 * Write an idea session to its directory
 *
 * @param sessionDir - Path to session directory
 * @param session - IdeaSession to write
 */
export function writeIdeaSession(
  sessionDir: string,
  session: IdeaSession
): void {
  // Convert to raw format for storage
  const raw: RawIdeaSession = {
    id: session.id,
    types: session.types,
    model: session.model,
    summary: {
      total_ideas: session.summary.totalIdeas,
      by_type: session.summary.byType,
      by_status: session.summary.byStatus,
    },
    files: session.files,
    generated_at: session.generatedAt,
    updated_at: session.updatedAt,
  };

  writeSessionMetadata(sessionDir, raw);
}

// =============================================================================
// Idea File Management
// =============================================================================

/**
 * Get the path to an idea file for a type (legacy - all ideas in one file)
 *
 * @param sessionDir - Session directory path
 * @param typeName - Idea type name
 * @returns Absolute path to idea file
 */
export function getIdeaFilePath(sessionDir: string, typeName: string): string {
  return join(sessionDir, `${IDEA_FILE_PREFIX}${typeName}.md`);
}

/**
 * Get the path to a single idea file
 *
 * @param sessionDir - Session directory path
 * @param typeName - Idea type name
 * @param ideaName - Idea name (e.g., "add-pagination-sessions")
 * @returns Absolute path to individual idea file
 */
export function getSingleIdeaFilePath(
  sessionDir: string,
  typeName: string,
  ideaName: string
): string {
  return join(sessionDir, `${IDEA_FILE_PREFIX}${typeName}_${ideaName}.md`);
}

/**
 * Get the filename for a single idea file
 *
 * @param typeName - Idea type name
 * @param ideaName - Idea name
 * @returns Filename without path
 */
export function getSingleIdeaFileName(
  typeName: string,
  ideaName: string
): string {
  return `${IDEA_FILE_PREFIX}${typeName}_${ideaName}.md`;
}

/**
 * Write ideas to a markdown file
 *
 * Each idea is written as a section with YAML frontmatter.
 *
 * @param filePath - Path to write the file
 * @param ideas - Array of ideas to write
 */
export function writeIdeasToFile(filePath: string, ideas: Idea[]): void {
  const sections: string[] = [];

  for (const idea of ideas) {
    const frontmatter: string[] = [
      "---",
      `id: ${idea.id}`,
      `type: ${idea.type}`,
      `title: ${idea.title}`,
      `description: ${idea.description}`,
      `rationale: ${idea.rationale}`,
      `estimated_effort: ${idea.estimatedEffort}`,
      `status: ${idea.status}`,
      `promoted_to: ${idea.promotedTo || "null"}`,
      `created_at: ${idea.createdAt}`,
    ];

    // Add affected files to frontmatter as YAML array
    if (idea.affectedFiles && idea.affectedFiles.length > 0) {
      frontmatter.push("affected_files:");
      for (const file of idea.affectedFiles) {
        frontmatter.push(`  - ${file}`);
      }
    }

    // Add existing patterns to frontmatter as YAML array
    if (idea.existingPatterns && idea.existingPatterns.length > 0) {
      frontmatter.push("existing_patterns:");
      for (const pattern of idea.existingPatterns) {
        frontmatter.push(`  - ${pattern}`);
      }
    }

    frontmatter.push("---");

    // Body contains implementation approach directly
    const body = idea.implementationApproach || "";

    sections.push(frontmatter.join("\n") + "\n\n" + body);
  }

  const content = sections.join("\n---\n\n");
  writeFileSync(filePath, content, "utf-8");
}

/**
 * Write a single idea to its own file
 *
 * @param sessionDir - Session directory path
 * @param idea - Idea to write
 * @returns The filename that was written
 */
export function writeSingleIdeaToFile(sessionDir: string, idea: Idea): string {
  // Use name if available, fallback to id
  const ideaName = idea.name || idea.id;
  const filePath = getSingleIdeaFilePath(sessionDir, idea.type, ideaName);
  const fileName = getSingleIdeaFileName(idea.type, ideaName);

  const frontmatter: string[] = [
    "---",
    `id: ${idea.id}`,
    `type: ${idea.type}`,
    `name: ${ideaName}`,
    `title: ${idea.title}`,
    `description: ${idea.description}`,
    `rationale: ${idea.rationale}`,
    `estimated_effort: ${idea.estimatedEffort}`,
    `status: ${idea.status}`,
    `promoted_to: ${idea.promotedTo || "null"}`,
    `created_at: ${idea.createdAt}`,
  ];

  // Add affected files to frontmatter as YAML array
  if (idea.affectedFiles && idea.affectedFiles.length > 0) {
    frontmatter.push("affected_files:");
    for (const file of idea.affectedFiles) {
      frontmatter.push(`  - ${file}`);
    }
  }

  // Add existing patterns to frontmatter as YAML array
  if (idea.existingPatterns && idea.existingPatterns.length > 0) {
    frontmatter.push("existing_patterns:");
    for (const pattern of idea.existingPatterns) {
      frontmatter.push(`  - ${pattern}`);
    }
  }

  frontmatter.push("---");

  // Body contains implementation approach directly (no header needed)
  const body = idea.implementationApproach || "";

  const content = frontmatter.join("\n") + "\n\n" + body + "\n";
  writeFileSync(filePath, content, "utf-8");

  return fileName;
}

/**
 * Write ideas - each idea to its own file
 *
 * @param sessionDir - Session directory path
 * @param ideas - Array of ideas to write
 * @returns Array of filenames that were written
 */
export function writeIdeasToSeparateFiles(
  sessionDir: string,
  ideas: Idea[]
): string[] {
  const files: string[] = [];
  for (const idea of ideas) {
    const fileName = writeSingleIdeaToFile(sessionDir, idea);
    files.push(fileName);
  }
  return files;
}

/**
 * Parse ideas from a markdown file
 *
 * Supports both:
 * - Single idea per file (new format): starts with ---\nfrontmatter\n---
 * - Multiple ideas per file (legacy format): multiple --- separated sections
 *
 * Uses gray-matter for robust YAML frontmatter parsing.
 *
 * @param filePath - Path to the idea file
 * @returns Array of parsed ideas
 */
export function readIdeasFromFile(filePath: string): Idea[] {
  if (!existsSync(filePath)) {
    return [];
  }

  try {
    const content = readFileSync(filePath, "utf-8").trim();

    // Use gray-matter to parse the file
    const { frontmatter, body } = parseFrontmatter(content);

    // If frontmatter has an id, this is a single-idea file
    if (frontmatter.id) {
      const idea = parseIdeaFromFrontmatterAndBody(frontmatter, body);
      if (idea) {
        return [idea];
      }
    }

    // Legacy format: multiple ideas separated by \n---\n
    // This happens when ideas were written with writeIdeasToFile (multiple per file)
    const ideas: Idea[] = [];
    const sections = content.split(/\n---\n+/);

    for (const section of sections) {
      const trimmed = section.trim();
      if (!trimmed) {
        continue;
      }

      // Section might start with --- or not (if it was split)
      const sectionToparse = trimmed.startsWith("---")
        ? trimmed
        : "---\n" + trimmed;
      const { frontmatter: fm, body: bd } = parseFrontmatter(sectionToparse);

      if (fm.id) {
        const idea = parseIdeaFromFrontmatterAndBody(fm, bd);
        if (idea) {
          ideas.push(idea);
        }
      }
    }

    return ideas;
  } catch {
    return [];
  }
}

/**
 * Get all ideas from a session
 *
 * @param sessionDir - Session directory path
 * @returns Array of all ideas in the session
 */
export function getAllIdeasFromSession(sessionDir: string): Idea[] {
  const ideas: Idea[] = [];

  try {
    const files = readdirSync(sessionDir);
    for (const file of files) {
      if (file.startsWith(IDEA_FILE_PREFIX) && file.endsWith(".md")) {
        const filePath = join(sessionDir, file);
        const fileIdeas = readIdeasFromFile(filePath);
        ideas.push(...fileIdeas);
      }
    }
  } catch {
    // Ignore errors
  }

  return ideas;
}

/**
 * Find an idea by ID
 *
 * @param repoRoot - Repository root path
 * @param ideaId - Idea ID to find
 * @param customOutput - Optional custom output directory
 * @returns Object with idea and session directory, or null
 */
export function findIdeaById(
  repoRoot: string,
  ideaId: string,
  customOutput?: string
): { idea: Idea; sessionDir: string; filePath: string } | null {
  const sessions = listSessions(repoRoot, customOutput);

  for (const sessionDir of sessions) {
    try {
      const files = readdirSync(sessionDir);
      for (const file of files) {
        if (file.startsWith(IDEA_FILE_PREFIX) && file.endsWith(".md")) {
          const filePath = join(sessionDir, file);
          const ideas = readIdeasFromFile(filePath);
          const found = ideas.find((i) => i.id === ideaId);
          if (found) {
            return { idea: found, sessionDir, filePath };
          }
        }
      }
    } catch {
      // Continue to next session
    }
  }

  return null;
}

/**
 * Update an idea in its file
 *
 * @param filePath - Path to the idea file
 * @param ideaId - ID of the idea to update
 * @param updates - Partial idea updates
 * @returns True if updated, false if not found
 */
export function updateIdea(
  filePath: string,
  ideaId: string,
  updates: Partial<Idea>
): boolean {
  const ideas = readIdeasFromFile(filePath);
  const index = ideas.findIndex((i) => i.id === ideaId);

  if (index === -1) {
    return false;
  }

  ideas[index] = { ...ideas[index], ...updates };
  writeIdeasToFile(filePath, ideas);
  return true;
}

// =============================================================================
// Idea Query Functions
// =============================================================================

/**
 * Get all ideas from all sessions with optional filtering
 *
 * @param repoRoot - Repository root path
 * @param options - Optional filter options
 * @returns Array of Ideas
 */
export function getAllIdeas(
  repoRoot: string,
  options?: IdeaListOptions
): Idea[] {
  const sessionDirs = listSessions(repoRoot);
  const allIdeas: Idea[] = [];

  for (const sessionDir of sessionDirs) {
    const sessionIdeas = getAllIdeasFromSession(sessionDir);
    allIdeas.push(...sessionIdeas);
  }

  // Apply filters
  let filtered = allIdeas;

  if (options?.type) {
    filtered = filtered.filter((idea) => idea.type === options.type);
  }

  if (options?.effort) {
    filtered = filtered.filter(
      (idea) => idea.estimatedEffort === options.effort
    );
  }

  if (options?.status) {
    filtered = filtered.filter((idea) => idea.status === options.status);
  }

  return filtered;
}

/**
 * Get an idea by its ID
 *
 * @param repoRoot - Repository root path
 * @param ideaId - Idea ID (e.g., "a1b2c3d4")
 * @returns Idea or null if not found
 */
export function getIdeaById(repoRoot: string, ideaId: string): Idea | null {
  const result = findIdeaById(repoRoot, ideaId);
  return result ? result.idea : null;
}

/**
 * Update an idea's status
 *
 * @param repoRoot - Repository root path
 * @param ideaId - Idea ID
 * @param status - New status
 * @param promotedTo - Optional task ID if promoting
 */
export function updateIdeaStatus(
  repoRoot: string,
  ideaId: string,
  status: string,
  promotedTo?: string
): void {
  const location = findIdeaById(repoRoot, ideaId);
  if (!location) {
    return;
  }

  const updates: Partial<Idea> = {};
  if (isValidIdeaStatus(status)) {
    updates.status = status;
  }
  if (promotedTo !== undefined) {
    updates.promotedTo = promotedTo;
  }

  updateIdea(location.filePath, ideaId, updates);

  // Update session summary
  updateSessionSummary(location.sessionDir);
}

/**
 * Remove an idea by ID
 *
 * @param repoRoot - Repository root path
 * @param ideaId - Idea ID
 * @returns True if removed, false if not found
 */
export function removeIdea(repoRoot: string, ideaId: string): boolean {
  const location = findIdeaById(repoRoot, ideaId);
  if (!location) {
    return false;
  }

  const ideas = readIdeasFromFile(location.filePath);
  const filteredIdeas = ideas.filter((idea) => idea.id !== ideaId);

  if (filteredIdeas.length === ideas.length) {
    return false; // Not found
  }

  writeIdeasToFile(location.filePath, filteredIdeas);

  // Update session summary
  updateSessionSummary(location.sessionDir);

  return true;
}

/**
 * Remove all ideas of a specific type
 *
 * @param repoRoot - Repository root path
 * @param type - Idea type to remove
 * @returns Number of ideas removed
 */
export function removeIdeasByType(repoRoot: string, type: string): number {
  const sessionDirs = listSessions(repoRoot);
  let removedCount = 0;

  for (const sessionDir of sessionDirs) {
    const mdPath = getIdeaMarkdownPath(sessionDir, type);

    if (existsSync(mdPath)) {
      const ideas = readIdeasFromFile(mdPath);
      removedCount += ideas.length;

      // Remove the file
      unlinkSync(mdPath);

      // Update session summary
      updateSessionSummary(sessionDir);
    }
  }

  return removedCount;
}

/**
 * Remove all ideas
 *
 * @param repoRoot - Repository root path
 * @returns Number of ideas removed
 */
export function removeAllIdeas(repoRoot: string): number {
  const sessions = listIdeaSessions(repoRoot);
  let removedCount = 0;

  for (const session of sessions) {
    removedCount += session.summary.totalIdeas;
    const sessionDir = getIdeaSessionDir(repoRoot, session.id);

    // Remove entire session directory
    if (existsSync(sessionDir)) {
      rmSync(sessionDir, { recursive: true, force: true });
    }
  }

  return removedCount;
}

/**
 * Update session summary after modifying ideas
 *
 * @param sessionDir - Session directory path
 */
function updateSessionSummary(sessionDir: string): void {
  const session = readSessionMetadata(sessionDir);
  if (!session) {
    return;
  }

  // Recalculate summary
  session.summary.totalIdeas = 0;
  session.summary.byType = {};
  session.summary.byStatus = { draft: 0, promoted: 0, dismissed: 0 };

  // Check which types still have files
  const remainingTypes: string[] = [];

  for (const type of session.types) {
    const mdPath = getIdeaMarkdownPath(sessionDir, type);
    if (existsSync(mdPath)) {
      const ideas = readIdeasFromFile(mdPath);

      if (ideas.length > 0) {
        remainingTypes.push(type);
        session.summary.byType[type] = ideas.length;
        session.summary.totalIdeas += ideas.length;

        for (const idea of ideas) {
          if (idea.status in session.summary.byStatus) {
            session.summary.byStatus[idea.status as IdeaStatus]++;
          }
        }
      }
    }
  }

  session.types = remainingTypes;
  session.updatedAt = new Date().toISOString();
  writeIdeaSession(sessionDir, session);
}
