import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureDir, writeFile } from "../utils/file-writer.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type TemplateCategory = "markdown" | "commands";

/**
 * Get the path to the viben templates directory.
 *
 * This reads from src/templates/viben/ (development) or dist/templates/viben/ (production).
 * These are GENERIC templates, not the Viben project's own .viben/ configuration.
 */
export function getVibenTemplatePath(): string {
  // Templates are in the same directory as this file
  const templatePath = path.join(__dirname, "viben");
  if (fs.existsSync(templatePath)) {
    return templatePath;
  }

  throw new Error(
    "Could not find viben templates directory. Expected at templates/viben/",
  );
}

/**
 * Get the path to the cursor templates directory.
 *
 * This reads from src/templates/cursor/ (development) or dist/templates/cursor/ (production).
 * These are GENERIC templates, not the Viben project's own .cursor/ configuration.
 */
export function getCursorTemplatePath(): string {
  const templatePath = path.join(__dirname, "cursor");
  if (fs.existsSync(templatePath)) {
    return templatePath;
  }

  throw new Error(
    "Could not find cursor templates directory. Expected at templates/cursor/",
  );
}

/**
 * Get the path to the claude templates directory.
 *
 * This reads from src/templates/claude/ (development) or dist/templates/claude/ (production).
 * These are GENERIC templates, not the Viben project's own .claude/ configuration.
 */
export function getClaudeTemplatePath(): string {
  const templatePath = path.join(__dirname, "claude");
  if (fs.existsSync(templatePath)) {
    return templatePath;
  }

  throw new Error(
    "Could not find claude templates directory. Expected at templates/claude/",
  );
}

/**
 * Get the path to the opencode templates directory.
 *
 * This reads from src/templates/opencode/ (development) or dist/templates/opencode/ (production).
 * These are GENERIC templates, not the Viben project's own .opencode/ configuration.
 */
export function getOpenCodeTemplatePath(): string {
  const templatePath = path.join(__dirname, "opencode");
  if (fs.existsSync(templatePath)) {
    return templatePath;
  }

  throw new Error(
    "Could not find opencode templates directory. Expected at templates/opencode/",
  );
}

/**
 * Get the path to the iflow templates directory.
 *
 * This reads from src/templates/iflow/ (development) or dist/templates/iflow/ (production).
 * These are GENERIC templates, not the Viben project's own .iflow/ configuration.
 */
export function getIflowTemplatePath(): string {
  const templatePath = path.join(__dirname, "iflow");
  if (fs.existsSync(templatePath)) {
    return templatePath;
  }

  throw new Error(
    "Could not find iflow templates directory. Expected at templates/iflow/",
  );
}

/**
 * Get the path to the kilo templates directory.
 *
 * This reads from src/templates/kilo/ (development) or dist/templates/kilo/ (production).
 * These are GENERIC templates, not the Viben project's own .kilo/ configuration.
 */
export function getKiloTemplatePath(): string {
  const templatePath = path.join(__dirname, "kilo");
  if (fs.existsSync(templatePath)) {
    return templatePath;
  }

  throw new Error(
    "Could not find kilo templates directory. Expected at templates/kilo/",
  );
}

/**
 * Get the path to the kiro templates directory.
 *
 * This reads from src/templates/kiro/ (development) or dist/templates/kiro/ (production).
 * These are GENERIC templates, not the Viben project's own .kiro/ configuration.
 */
export function getKiroTemplatePath(): string {
  const templatePath = path.join(__dirname, "kiro");
  if (fs.existsSync(templatePath)) {
    return templatePath;
  }

  throw new Error(
    "Could not find kiro templates directory. Expected at templates/kiro/",
  );
}

/**
 * Get the path to the antigravity templates directory.
 *
 * This reads from src/templates/antigravity/ (development) or dist/templates/antigravity/ (production).
 * These are GENERIC templates, not the Viben project's own .agent/workflows configuration.
 */
export function getAntigravityTemplatePath(): string {
  const templatePath = path.join(__dirname, "antigravity");
  if (fs.existsSync(templatePath)) {
    return templatePath;
  }

  throw new Error(
    "Could not find antigravity templates directory. Expected at templates/antigravity/",
  );
}

/**
 * Read a file from the viben templates directory
 * @param relativePath - Path relative to templates/viben/ (e.g., 'workflow.md')
 * @returns File content as string
 */
export function readVibenFile(relativePath: string): string {
  const vibenPath = getVibenTemplatePath();
  const filePath = path.join(vibenPath, relativePath);
  return fs.readFileSync(filePath, "utf-8");
}

/**
 * Read template content from a .txt file in commands directory
 * @param category - Template category (only 'commands' uses .txt files now)
 * @param filename - Template filename (e.g., 'common/finish-work.txt')
 * @returns File content as string
 */
export function readTemplate(
  category: TemplateCategory,
  filename: string,
): string {
  const templatePath = path.join(__dirname, category, filename);
  return fs.readFileSync(templatePath, "utf-8");
}

/**
 * Helper to read markdown template from templates/viben/
 * @param relativePath - Path relative to templates/viben/ (e.g., 'workflow.md')
 */
export function readMarkdown(relativePath: string): string {
  return readVibenFile(relativePath);
}

/**
 * Helper to read command template (these still use .txt files in src/templates/commands/)
 */
export function readCommand(filename: string): string {
  return readTemplate("commands", filename);
}

/**
 * Read a file from the .cursor directory (dogfooding)
 * @param relativePath - Path relative to .cursor/ (e.g., 'commands/start.md')
 * @returns File content as string
 */
export function readCursorFile(relativePath: string): string {
  const cursorPath = getCursorTemplatePath();
  const filePath = path.join(cursorPath, relativePath);
  return fs.readFileSync(filePath, "utf-8");
}

/**
 * Read a file from the .claude directory (dogfooding)
 * @param relativePath - Path relative to .claude/ (e.g., 'commands/start.md')
 * @returns File content as string
 */
export function readClaudeFile(relativePath: string): string {
  const claudePath = getClaudeTemplatePath();
  const filePath = path.join(claudePath, relativePath);
  return fs.readFileSync(filePath, "utf-8");
}

/**
 * Read a file from the .opencode directory (dogfooding)
 * @param relativePath - Path relative to .opencode/ (e.g., 'commands/start.md')
 * @returns File content as string
 */
export function readOpenCodeFile(relativePath: string): string {
  const opencodePath = getOpenCodeTemplatePath();
  const filePath = path.join(opencodePath, relativePath);
  return fs.readFileSync(filePath, "utf-8");
}

/**
 * Read a file from the .kilo directory (dogfooding)
 * @param relativePath - Path relative to .kilo/ (e.g., 'commands/start.md')
 * @returns File content as string
 */
export function readKiloFile(relativePath: string): string {
  const kiloPath = getKiloTemplatePath();
  const filePath = path.join(kiloPath, relativePath);
  return fs.readFileSync(filePath, "utf-8");
}

/**
 * Get the path to the gemini templates directory.
 *
 * This reads from src/templates/gemini/ (development) or dist/templates/gemini/ (production).
 * These are GENERIC templates, not the Viben project's own .gemini/ configuration.
 */
export function getGeminiTemplatePath(): string {
  const templatePath = path.join(__dirname, "gemini");
  if (fs.existsSync(templatePath)) {
    return templatePath;
  }

  throw new Error(
    "Could not find gemini templates directory. Expected at templates/gemini/",
  );
}

/**
 * Read a file from the .gemini directory (dogfooding)
 * @param relativePath - Path relative to .gemini/ (e.g., 'commands/viben/start.toml')
 * @returns File content as string
 */
export function readGeminiFile(relativePath: string): string {
  const geminiPath = getGeminiTemplatePath();
  const filePath = path.join(geminiPath, relativePath);
  return fs.readFileSync(filePath, "utf-8");
}

/**
 * Copy a directory from viben templates to target, making Python/shell files executable
 * Uses writeFile to handle file conflicts with the global writeMode setting
 * @param srcRelativePath - Source path relative to templates/viben/ (e.g., 'spec')
 * @param destPath - Absolute destination path
 * @param options - Copy options
 */
export async function copyVibenDir(
  srcRelativePath: string,
  destPath: string,
  options?: { executable?: boolean },
): Promise<void> {
  const vibenPath = getVibenTemplatePath();
  const srcPath = path.join(vibenPath, srcRelativePath);
  await copyDirRecursive(srcPath, destPath, options);
}

/**
 * Recursively copy directory with options
 * Uses writeFile to handle file conflicts
 */
async function copyDirRecursive(
  src: string,
  dest: string,
  options?: { executable?: boolean },
): Promise<void> {
  ensureDir(dest);

  for (const entry of fs.readdirSync(src)) {
    const srcPath = path.join(src, entry);
    const destPath = path.join(dest, entry);
    const stat = fs.statSync(srcPath);

    if (stat.isDirectory()) {
      await copyDirRecursive(srcPath, destPath, options);
    } else {
      const content = fs.readFileSync(srcPath, "utf-8");
      const isExecutable =
        options?.executable && (entry.endsWith(".sh") || entry.endsWith(".py"));
      await writeFile(destPath, content, { executable: isExecutable });
    }
  }
}
