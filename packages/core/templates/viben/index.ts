/**
 * Viben workflow templates
 *
 * These are GENERIC templates for user projects.
 * Do NOT use Viben project's own .viben/ directory (which may be customized).
 *
 * Users should use viben CLI commands:
 *   - viben task (task management)
 *   - viben swarm (multi-agent pipeline)
 *   - viben user (developer identity)
 *
 * Directory structure:
 *   viben/
 *   ├── workflow.md            # Workflow guide
 *   ├── worktree.yaml          # Worktree configuration
 *   └── gitignore.txt          # .gitignore content
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function readTemplate(relativePath: string): string {
  return readFileSync(join(__dirname, relativePath), "utf-8");
}

// Configuration files
export const workflowMdTemplate = readTemplate("workflow.md");
export const worktreeYamlTemplate = readTemplate("worktree.yaml");
export const gitignoreTemplate = readTemplate("gitignore.txt");
