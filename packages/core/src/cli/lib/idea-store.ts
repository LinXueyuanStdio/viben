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
 *         ├── idea_code_improvements.md
 *         └── idea_<type>.md
 *
 * docs/
 * └── idea-types/                  # Custom type prompts
 *     └── <type>.md
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  statSync,
  unlinkSync,
  rmSync,
} from "node:fs";
import { join, resolve, dirname, basename } from "node:path";
import {
  BUILTIN_IDEA_TYPES,
  CUSTOM_IDEA_TYPES_DIR,
  IDEAS_DIR,
  IDEA_JSON_FILE,
  IDEA_FILE_PREFIX,
  DEFAULT_MAX_IDEAS,
  type IdeaType,
  type IdeaTypeSource,
  type IdeaStatus,
  type Idea,
  type IdeaSession,
  type IdeaListOptions,
  type RawIdeaSession,
  type EffortLevel,
  isValidEffortLevel,
  isValidIdeaStatus,
  getIdeaIdPrefix,
  parseRawSession,
} from "./idea-types";
import { DIR_VIBEN, getDatePrefix } from "./viben-workspace";

// =============================================================================
// Constants
// =============================================================================

/**
 * Path to built-in prompt templates (relative to packages/core/src)
 */
const BUILTIN_PROMPTS_DIR = "prompts/idea-types";

/**
 * Built-in type descriptions
 */
const BUILTIN_TYPE_DESCRIPTIONS: Record<string, string> = {
  code_improvements: "Code improvement opportunities based on existing patterns",
  code_quality: "Code quality improvements and refactoring opportunities",
  documentation_gaps: "Missing or incomplete documentation",
  performance_optimizations: "Performance bottlenecks and optimization opportunities",
  security_hardening: "Security vulnerabilities and hardening measures",
  ui_ux_improvements: "UI/UX improvements for better user experience",
};

// =============================================================================
// Path Utilities
// =============================================================================

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
 * Get the builtin prompts directory path
 *
 * Looks for the prompts directory relative to the current file location.
 * Falls back to searching in common locations.
 *
 * @returns Absolute path to builtin prompts directory
 */
export function getBuiltinPromptsDir(): string {
  // Try to find prompts relative to this file's location
  // This file is at: packages/core/src/cli/lib/idea-store.ts
  // Prompts are at: packages/core/src/prompts/idea-types/
  const currentDir = dirname(__filename);
  const relativeToSrc = join(currentDir, "..", "..", BUILTIN_PROMPTS_DIR);
  if (existsSync(relativeToSrc)) {
    return resolve(relativeToSrc);
  }

  // Fallback: Try common locations for built prompts
  const fallbackPaths = [
    join(process.cwd(), "packages/core/src", BUILTIN_PROMPTS_DIR),
    join(process.cwd(), "node_modules/@viben/core/dist", BUILTIN_PROMPTS_DIR),
    join(__dirname, "..", "..", BUILTIN_PROMPTS_DIR),
  ];

  for (const p of fallbackPaths) {
    if (existsSync(p)) {
      return resolve(p);
    }
  }

  // Return the relative path even if it doesn't exist (for error reporting)
  return resolve(relativeToSrc);
}

/**
 * Get the custom idea types directory path
 *
 * @param repoRoot - Repository root path
 * @returns Absolute path to custom idea types directory
 */
export function getCustomTypesDir(repoRoot: string): string {
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
 * Get the builtin prompt file path for a specific type
 *
 * @param type - Idea type name
 * @returns Absolute path to builtin prompt file
 */
export function getBuiltinPromptPath(type: string): string {
  return join(getBuiltinPromptsDir(), `${type}.md`);
}

/**
 * Get the custom prompt file path for a specific type
 *
 * @param repoRoot - Repository root path
 * @param type - Idea type name
 * @returns Path to custom prompt file in docs/idea-types/
 */
export function getCustomPromptPath(repoRoot: string, type: string): string {
  return join(getCustomTypesDir(repoRoot), `${type}.md`);
}

// =============================================================================
// Idea Type Management
// =============================================================================

/**
 * Parse YAML frontmatter from a markdown file
 *
 * @param content - File content
 * @returns Object with frontmatter and body
 */
function parseFrontmatter(content: string): {
  frontmatter: Record<string, unknown>;
  body: string;
} {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    return { frontmatter: {}, body: content };
  }

  const [, yamlStr, body] = match;
  const frontmatter: Record<string, unknown> = {};

  // Simple YAML parsing (key: value only)
  for (const line of yamlStr.split("\n")) {
    const colonIndex = line.indexOf(":");
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      let value: unknown = line.slice(colonIndex + 1).trim();

      // Remove quotes
      if (
        (value as string).startsWith('"') && (value as string).endsWith('"') ||
        (value as string).startsWith("'") && (value as string).endsWith("'")
      ) {
        value = (value as string).slice(1, -1);
      }

      // Parse numbers
      if (/^\d+$/.test(value as string)) {
        value = parseInt(value as string, 10);
      }

      frontmatter[key] = value;
    }
  }

  return { frontmatter, body };
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
  // Check custom types first
  const customPath = join(getCustomTypesDir(repoRoot), `${typeName}.md`);
  const customType = loadIdeaTypeFromFile(customPath, "custom");
  if (customType) {
    return customType;
  }

  // Check built-in types
  const builtinPath = join(getBuiltinPromptsDir(), `${typeName}.md`);
  const builtinType = loadIdeaTypeFromFile(builtinPath, "builtin");
  if (builtinType) {
    return builtinType;
  }

  return null;
}

/**
 * List all available idea types
 *
 * @param repoRoot - Repository root path
 * @returns Array of IdeaType objects
 */
export function listIdeaTypes(repoRoot: string): IdeaType[] {
  const types: IdeaType[] = [];
  const seenNames = new Set<string>();

  // Add custom types first (they take precedence)
  const customDir = getCustomTypesDir(repoRoot);
  if (existsSync(customDir)) {
    try {
      const files = readdirSync(customDir);
      for (const file of files) {
        if (file.endsWith(".md")) {
          const promptPath = join(customDir, file);
          const ideaType = loadIdeaTypeFromFile(promptPath, "custom");
          if (ideaType) {
            types.push(ideaType);
            seenNames.add(ideaType.name);
          }
        }
      }
    } catch {
      // Ignore errors reading custom types directory
    }
  }

  // Add built-in types (skip if custom override exists)
  const builtinDir = getBuiltinPromptsDir();
  if (existsSync(builtinDir)) {
    try {
      const files = readdirSync(builtinDir);
      for (const file of files) {
        if (file.endsWith(".md")) {
          const typeName = file.replace(".md", "");
          if (!seenNames.has(typeName)) {
            const promptPath = join(builtinDir, file);
            const ideaType = loadIdeaTypeFromFile(promptPath, "builtin");
            if (ideaType) {
              types.push(ideaType);
            }
          }
        }
      }
    } catch {
      // Ignore errors reading builtin types directory
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

/**
 * Parse the YAML header from a prompt template file
 *
 * @param content - File content
 * @returns Parsed header with name, description, max_ideas
 */
export function parsePromptHeader(content: string): {
  name: string;
  description: string;
  max_ideas?: number;
} {
  const { frontmatter } = parseFrontmatter(content);

  return {
    name: String(frontmatter.name || ""),
    description: String(frontmatter.description || ""),
    max_ideas:
      frontmatter.max_ideas !== undefined
        ? Number(frontmatter.max_ideas)
        : undefined,
  };
}

/**
 * Alias for getIdeaType for API compatibility
 */
export const loadIdeaType = getIdeaType;

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
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

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

  return `${month}-${day}-${slug}`;
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

// =============================================================================
// Idea File Management
// =============================================================================

/**
 * Get the path to an idea file for a type
 *
 * @param sessionDir - Session directory path
 * @param typeName - Idea type name
 * @returns Absolute path to idea file
 */
export function getIdeaFilePath(sessionDir: string, typeName: string): string {
  return join(sessionDir, `${IDEA_FILE_PREFIX}${typeName}.md`);
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
    const frontmatter = [
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
      "---",
    ];

    const body: string[] = [];

    if (idea.affectedFiles && idea.affectedFiles.length > 0) {
      body.push("## Affected Files", "");
      for (const file of idea.affectedFiles) {
        body.push(`- ${file}`);
      }
      body.push("");
    }

    if (idea.existingPatterns && idea.existingPatterns.length > 0) {
      body.push("## Existing Patterns", "");
      for (const pattern of idea.existingPatterns) {
        body.push(`- ${pattern}`);
      }
      body.push("");
    }

    if (idea.implementationApproach) {
      body.push("## Implementation Approach", "");
      body.push(idea.implementationApproach);
      body.push("");
    }

    sections.push(frontmatter.join("\n") + "\n\n" + body.join("\n"));
  }

  const content = sections.join("\n---\n\n");
  writeFileSync(filePath, content, "utf-8");
}

/**
 * Parse ideas from a markdown file
 *
 * @param filePath - Path to the idea file
 * @returns Array of parsed ideas
 */
export function readIdeasFromFile(filePath: string): Idea[] {
  if (!existsSync(filePath)) {
    return [];
  }

  try {
    const content = readFileSync(filePath, "utf-8");
    const ideas: Idea[] = [];

    // Split by document separator (---)
    const sections = content.split(/\n---\n+/);

    for (const section of sections) {
      const trimmed = section.trim();
      if (!trimmed || !trimmed.startsWith("---")) {
        continue;
      }

      const { frontmatter, body } = parseFrontmatter(trimmed);
      if (!frontmatter.id) {
        continue;
      }

      // Parse affected files from body
      const affectedFiles: string[] = [];
      const existingPatterns: string[] = [];
      let implementationApproach: string | undefined;

      const lines = body.split("\n");
      let currentSection = "";

      for (const line of lines) {
        if (line.startsWith("## Affected Files")) {
          currentSection = "affected";
        } else if (line.startsWith("## Existing Patterns")) {
          currentSection = "patterns";
        } else if (line.startsWith("## Implementation Approach")) {
          currentSection = "implementation";
        } else if (line.startsWith("## ")) {
          currentSection = "";
        } else if (line.startsWith("- ") && currentSection === "affected") {
          affectedFiles.push(line.slice(2).trim());
        } else if (line.startsWith("- ") && currentSection === "patterns") {
          existingPatterns.push(line.slice(2).trim());
        } else if (currentSection === "implementation" && line.trim()) {
          implementationApproach = implementationApproach
            ? implementationApproach + "\n" + line
            : line;
        }
      }

      const effortStr = String(frontmatter.estimated_effort || "medium");

      ideas.push({
        id: String(frontmatter.id),
        type: String(frontmatter.type || ""),
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
      });
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
