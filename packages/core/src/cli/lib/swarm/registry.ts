/**
 * Agent Registry Management
 *
 * Provides functions for managing the multi-agent registry.
 * Registry file is located at `.viben/workspace/{developerName}/.agents/registry.json`
 *
 * Replaces Python implementation in templates/viben/scripts/common/registry.py
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// =============================================================================
// Types
// =============================================================================

/**
 * Agent entry in the registry
 */
export interface AgentEntry {
  id: string;
  worktree_path: string;
  pid: number;
  task_dir: string;
  started_at: string;
  platform: string;
}

/**
 * Registry structure
 */
export interface Registry {
  agents: AgentEntry[];
}

// =============================================================================
// Internal Helpers
// =============================================================================

/**
 * Get developer name from .developer file
 *
 * @param repoRoot - Repository root path
 * @returns Developer name or null if not initialized
 */
function getDeveloperName(repoRoot: string): string | null {
  const developerFile = join(repoRoot, ".viben", ".developer");

  if (!existsSync(developerFile)) {
    return null;
  }

  try {
    const content = readFileSync(developerFile, "utf-8");
    for (const line of content.split("\n")) {
      if (line.startsWith("name=")) {
        // Use substring to handle values containing '='
        const value = line.substring(line.indexOf("=") + 1).trim();
        return value || null;
      }
    }
  } catch {
    // Ignore errors
  }

  return null;
}

/**
 * Get agents directory path for current developer
 *
 * @param repoRoot - Repository root path
 * @returns Path to agents directory, or null if developer not initialized
 */
function getAgentsDir(repoRoot: string): string | null {
  const developerName = getDeveloperName(repoRoot);
  if (!developerName) {
    return null;
  }
  return join(repoRoot, ".viben", "workspace", developerName, ".agents");
}

/**
 * Ensure registry file exists with valid structure
 *
 * @param repoRoot - Repository root path
 * @returns Path to registry file, or null if cannot create
 */
function ensureRegistry(repoRoot: string): string | null {
  const registryFile = getRegistryPath(repoRoot);
  if (!registryFile) {
    return null;
  }

  const agentsDir = getAgentsDir(repoRoot);
  if (!agentsDir) {
    return null;
  }

  try {
    // Create agents directory if needed
    if (!existsSync(agentsDir)) {
      mkdirSync(agentsDir, { recursive: true });
    }

    // Create registry file with empty structure if it doesn't exist
    if (!existsSync(registryFile)) {
      writeFileSync(registryFile, JSON.stringify({ agents: [] }, null, 2), "utf-8");
    }

    return registryFile;
  } catch {
    return null;
  }
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Get the registry file path
 *
 * @param repoRoot - Repository root path
 * @returns Path to registry.json, or null if developer not initialized
 */
export function getRegistryPath(repoRoot: string): string | null {
  const agentsDir = getAgentsDir(repoRoot);
  if (!agentsDir) {
    return null;
  }
  return join(agentsDir, "registry.json");
}

/**
 * Read the agent registry
 *
 * @param repoRoot - Repository root path
 * @returns Registry object (empty registry if file doesn't exist or is invalid)
 */
export function readRegistry(repoRoot: string): Registry {
  const registryPath = getRegistryPath(repoRoot);
  if (!registryPath || !existsSync(registryPath)) {
    return { agents: [] };
  }

  try {
    const content = readFileSync(registryPath, "utf-8");
    const data = JSON.parse(content) as Registry;
    // Ensure agents array exists
    if (!Array.isArray(data.agents)) {
      return { agents: [] };
    }
    return data;
  } catch {
    return { agents: [] };
  }
}

/**
 * Write the agent registry
 *
 * @param repoRoot - Repository root path
 * @param registry - Registry to write
 * @returns True on success, false on error
 */
export function writeRegistry(repoRoot: string, registry: Registry): boolean {
  const registryPath = ensureRegistry(repoRoot);
  if (!registryPath) {
    return false;
  }

  try {
    writeFileSync(
      registryPath,
      JSON.stringify(registry, null, 2),
      "utf-8"
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Add agent to registry (replaces if same ID exists)
 *
 * @param agentId - Agent ID
 * @param worktreePath - Worktree path
 * @param pid - Process ID
 * @param taskDir - Task directory path
 * @param repoRoot - Repository root path
 * @param platform - Platform used (defaults to 'claude')
 * @returns True on success, false on error
 */
export function registryAddAgent(
  agentId: string,
  worktreePath: string,
  pid: number,
  taskDir: string,
  repoRoot: string,
  platform: string = "claude"
): boolean {
  // Ensure registry exists
  const registryPath = ensureRegistry(repoRoot);
  if (!registryPath) {
    return false;
  }

  const registry = readRegistry(repoRoot);

  // Remove existing agent with same ID
  registry.agents = registry.agents.filter((a) => a.id !== agentId);

  // Create new agent record
  const newAgent: AgentEntry = {
    id: agentId,
    worktree_path: worktreePath,
    pid,
    started_at: new Date().toISOString(),
    task_dir: taskDir,
    platform,
  };

  registry.agents.push(newAgent);
  return writeRegistry(repoRoot, registry);
}

/**
 * Remove agent by ID
 *
 * @param agentId - Agent ID
 * @param repoRoot - Repository root path
 * @returns True on success
 */
export function registryRemoveById(agentId: string, repoRoot: string): boolean {
  const registry = readRegistry(repoRoot);

  // If registry is empty, nothing to remove
  if (registry.agents.length === 0) {
    return true;
  }

  registry.agents = registry.agents.filter((a) => a.id !== agentId);
  return writeRegistry(repoRoot, registry);
}

/**
 * Remove agent by worktree path
 *
 * @param worktreePath - Worktree path
 * @param repoRoot - Repository root path
 * @returns True on success
 */
export function registryRemoveByWorktree(
  worktreePath: string,
  repoRoot: string
): boolean {
  const registry = readRegistry(repoRoot);

  // If registry is empty, nothing to remove
  if (registry.agents.length === 0) {
    return true;
  }

  registry.agents = registry.agents.filter(
    (a) => a.worktree_path !== worktreePath
  );
  return writeRegistry(repoRoot, registry);
}

/**
 * Get agent by ID
 *
 * @param agentId - Agent ID
 * @param repoRoot - Repository root path
 * @returns Agent entry, or undefined if not found
 */
export function registryGetAgentById(
  agentId: string,
  repoRoot: string
): AgentEntry | undefined {
  const registry = readRegistry(repoRoot);
  return registry.agents.find((a) => a.id === agentId);
}

/**
 * Get agent by worktree path
 *
 * @param worktreePath - Worktree path
 * @param repoRoot - Repository root path
 * @returns Agent entry, or undefined if not found
 */
export function registryGetAgentByWorktree(
  worktreePath: string,
  repoRoot: string
): AgentEntry | undefined {
  const registry = readRegistry(repoRoot);
  return registry.agents.find((a) => a.worktree_path === worktreePath);
}

/**
 * Search agent by ID or task_dir containing search term
 *
 * @param search - Search term
 * @param repoRoot - Repository root path
 * @returns First matching agent, or undefined if not found
 */
export function registrySearchAgent(
  search: string,
  repoRoot: string
): AgentEntry | undefined {
  const registry = readRegistry(repoRoot);

  for (const agent of registry.agents) {
    // Exact ID match
    if (agent.id === search) {
      return agent;
    }
    // Partial match on task_dir
    if (agent.task_dir.includes(search)) {
      return agent;
    }
  }

  return undefined;
}

/**
 * Get task directory for a worktree
 *
 * @param worktreePath - Worktree path
 * @param repoRoot - Repository root path
 * @returns Task directory path, or null if not found
 */
export function registryGetTaskDir(
  worktreePath: string,
  repoRoot: string
): string | null {
  const agent = registryGetAgentByWorktree(worktreePath, repoRoot);
  if (agent) {
    return agent.task_dir;
  }
  return null;
}

/**
 * List all agents
 *
 * @param repoRoot - Repository root path
 * @returns List of agent entries
 */
export function registryListAgents(repoRoot: string): AgentEntry[] {
  const registry = readRegistry(repoRoot);
  return registry.agents;
}
