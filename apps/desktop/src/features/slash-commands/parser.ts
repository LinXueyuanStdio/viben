import type { WorkspaceCommandFile, SkillCommandFile } from "./types";

/**
 * Parse a workspace command markdown file
 * Format:
 * # Title
 * Description paragraph
 * ---
 * ...content...
 */
export function parseWorkspaceCommand(
  filePath: string,
  content: string
): WorkspaceCommandFile | null {
  // Extract filename and namespace from path
  // e.g., .claude/commands/viben/start.md -> viben:start
  const pathParts = filePath.split("/");
  const fileName = pathParts[pathParts.length - 1].replace(".md", "");
  const commandsIndex = pathParts.indexOf("commands");

  let fullName = fileName;
  if (commandsIndex !== -1 && pathParts.length > commandsIndex + 2) {
    // Has namespace (folder between commands and file)
    const namespace = pathParts.slice(commandsIndex + 1, -1).join(":");
    fullName = `${namespace}:${fileName}`;
  }

  // Parse markdown content
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

  // Find description (first non-empty paragraph after title)
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

  // Get the remaining content
  const commandContent = lines.slice(contentStartIndex).join("\n").trim();

  if (!title) {
    title = fileName;
  }

  return {
    name: fileName,
    fullName,
    path: filePath,
    title,
    description: description || title,
    content: commandContent || content,
  };
}

/**
 * Parse SKILL.md frontmatter to extract metadata
 */
export function parseSkillFile(
  filePath: string,
  content: string
): SkillCommandFile | null {
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

  // Simple YAML parsing for frontmatter
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
          // Inline array: triggers: ["a", "b"]
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

  const name = (metadata.name as string) || filePath.split("/").slice(-2, -1)[0];
  const triggers = (metadata.triggers as string[]) || [name];
  const description = (metadata.description as string) || "";
  const skillContent = lines.slice(frontmatterEnd).join("\n").trim();

  return {
    name,
    triggers,
    description,
    path: filePath,
    content: skillContent || content,
  };
}

/**
 * Parse command input to extract command name and arguments
 * e.g., "/model sonnet" -> { name: "model", args: "sonnet" }
 */
export function parseCommandInput(input: string): {
  name: string;
  args?: string;
} | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) {
    return null;
  }

  const withoutSlash = trimmed.slice(1);
  const spaceIndex = withoutSlash.indexOf(" ");

  if (spaceIndex === -1) {
    return { name: withoutSlash };
  }

  return {
    name: withoutSlash.slice(0, spaceIndex),
    args: withoutSlash.slice(spaceIndex + 1).trim(),
  };
}
