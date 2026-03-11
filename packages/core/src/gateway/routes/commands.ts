/**
 * Slash commands routes
 * Provides API for loading workspace commands and skills
 */
import type { FastifyInstance } from "fastify";
import { readdir, readFile, stat } from "node:fs/promises";
import { join, basename, dirname, relative } from "node:path";
import { homedir } from "node:os";
import { logger as globalLogger } from "../../telemetry";

const log = globalLogger.child({ module: "commands" });

/**
 * Workspace command file
 */
interface WorkspaceCommandFile {
  name: string;
  fullName: string;
  path: string;
  title: string;
  description: string;
  content: string;
}

/**
 * Skill command file
 */
interface SkillCommandFile {
  name: string;
  triggers: string[];
  description: string;
  path: string;
  content: string;
}

/**
 * Parse workspace command markdown file
 */
function parseWorkspaceCommand(
  filePath: string,
  content: string,
  commandsDir: string
): WorkspaceCommandFile {
  const fileName = basename(filePath, ".md");
  const relPath = relative(commandsDir, filePath);
  const dirParts = dirname(relPath).split("/").filter((p) => p && p !== ".");

  // Build full name with namespace
  const fullName = dirParts.length > 0 ? `${dirParts.join(":")}:${fileName}` : fileName;

  const lines = content.split("\n");
  let title = "";
  let description = "";
  let contentStartIndex = 0;

  // Find title (first h1)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("# ")) {
      title = line.slice(2).trim();
      contentStartIndex = i + 1;
      break;
    }
  }

  // Find description (first paragraph)
  let inDescription = false;
  const descLines: string[] = [];
  for (let i = contentStartIndex; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === "---") {
      contentStartIndex = i + 1;
      break;
    }

    if (trimmed === "") {
      if (inDescription && descLines.length > 0) {
        contentStartIndex = i + 1;
        break;
      }
      continue;
    }

    if (!trimmed.startsWith("#")) {
      inDescription = true;
      descLines.push(trimmed);
    }
  }

  description = descLines.join(" ");

  if (!title) {
    title = fileName;
  }

  return {
    name: fileName,
    fullName,
    path: filePath,
    title,
    description: description || title,
    content: lines.slice(contentStartIndex).join("\n").trim() || content,
  };
}

/**
 * Parse SKILL.md file
 */
function parseSkillFile(filePath: string, content: string): SkillCommandFile {
  const lines = content.split("\n");
  let inFrontmatter = false;
  let frontmatterEnd = 0;
  const frontmatterLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === "---") {
      if (!inFrontmatter) {
        inFrontmatter = true;
      } else {
        frontmatterEnd = i + 1;
        break;
      }
      continue;
    }
    if (inFrontmatter) {
      frontmatterLines.push(lines[i]);
    }
  }

  // Simple YAML parsing
  const metadata: Record<string, string | string[]> = {};
  let currentKey = "";
  let inArray = false;
  const arrayValues: string[] = [];

  for (const line of frontmatterLines) {
    const trimmed = line.trim();

    if (inArray) {
      if (trimmed.startsWith("- ")) {
        arrayValues.push(trimmed.slice(2).replace(/['"]/g, "").trim());
        continue;
      } else if (trimmed) {
        metadata[currentKey] = arrayValues.slice();
        inArray = false;
        arrayValues.length = 0;
      }
    }

    const colonIndex = line.indexOf(":");
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim();

      if (value === "" || value === "[" || value.startsWith("[")) {
        currentKey = key;
        if (value.startsWith("[") && value.endsWith("]")) {
          const arrayContent = value.slice(1, -1);
          metadata[key] = arrayContent
            .split(",")
            .map((s) => s.trim().replace(/['"]/g, ""));
        } else {
          inArray = true;
          arrayValues.length = 0;
        }
      } else {
        metadata[key] = value.replace(/['"]/g, "");
      }
    }
  }

  if (inArray && arrayValues.length > 0) {
    metadata[currentKey] = arrayValues;
  }

  const skillDir = dirname(filePath);
  const name = (metadata.name as string) || basename(skillDir);
  const triggers = (metadata.triggers as string[]) || [name];
  const description = (metadata.description as string) || "";

  return {
    name,
    triggers,
    description,
    path: filePath,
    content: lines.slice(frontmatterEnd).join("\n").trim() || content,
  };
}

/**
 * Recursively find all markdown files in a directory
 */
async function findMarkdownFiles(dir: string): Promise<string[]> {
  const files: string[] = [];

  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        const subFiles = await findMarkdownFiles(fullPath);
        files.push(...subFiles);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        files.push(fullPath);
      }
    }
  } catch {
    // Directory doesn't exist or not accessible
  }

  return files;
}

/**
 * Find all SKILL.md files in skills directories
 */
async function findSkillFiles(dirs: string[]): Promise<string[]> {
  const files: string[] = [];

  for (const dir of dirs) {
    try {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const skillPath = join(dir, entry.name, "SKILL.md");
          try {
            await stat(skillPath);
            files.push(skillPath);
          } catch {
            // SKILL.md doesn't exist
          }
        }
      }
    } catch {
      // Directory doesn't exist
    }
  }

  return files;
}

/**
 * Register commands routes
 */
export function registerCommandsRoutes(fastify: FastifyInstance): void {
  /**
   * Get workspace commands from .claude/commands directory
   */
  fastify.get<{
    Querystring: { workspace_path?: string };
  }>("/api/commands/workspace", async (request, reply) => {
    const { workspace_path } = request.query;

    if (!workspace_path) {
      return { commands: [] };
    }

    const commandsDir = join(workspace_path, ".claude", "commands");
    const files = await findMarkdownFiles(commandsDir);

    const commands: WorkspaceCommandFile[] = [];

    for (const file of files) {
      try {
        const content = await readFile(file, "utf-8");
        const command = parseWorkspaceCommand(file, content, commandsDir);
        commands.push(command);
      } catch (error) {
        log.error({ err: error, file }, "Failed to parse command file");
      }
    }

    return { commands };
  });

  /**
   * Get skill commands from various skill directories
   */
  fastify.get<{
    Querystring: { workspace_path?: string; agent_id?: string };
  }>("/api/commands/skills", async (request, reply) => {
    const { workspace_path, agent_id } = request.query;
    const vibenDir = join(homedir(), ".viben");

    // Collect skill directories to search
    const skillDirs: string[] = [
      // Global skills
      join(vibenDir, "skills"),
    ];

    // Workspace skills
    if (workspace_path) {
      skillDirs.push(join(workspace_path, ".viben", "skills"));
    }

    // Agent-specific skills
    if (agent_id) {
      skillDirs.push(join(vibenDir, "agents", agent_id, "skills"));
    }

    const files = await findSkillFiles(skillDirs);
    const skills: SkillCommandFile[] = [];

    for (const file of files) {
      try {
        const content = await readFile(file, "utf-8");
        const skill = parseSkillFile(file, content);
        skills.push(skill);
      } catch (error) {
        log.error({ err: error, file }, "Failed to parse skill file");
      }
    }

    return { skills };
  });
}
