/**
 * Workspace-scoped resource discovery routes
 *
 * Provides workspace-specific views of executors, models, and agents.
 * Returns merged data: global availability + workspace-specific configurations.
 *
 * Endpoints:
 * - GET /api/workspaces/executors?workspacePath=...&includeGlobal=true
 * - GET /api/workspaces/agents?workspacePath=...&includeGlobal=true
 * - GET /api/workspaces/models?workspacePath=...&includeGlobal=true
 * - GET /api/workspaces/chat-items?workspacePath=...
 *
 * Default behavior:
 * - workspacePath: defaults to user home directory (~)
 * - includeGlobal: defaults to true
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { agentManager } from "../../agents";
import { modelManager } from "../../models";
import { readJson } from "../../config/yaml";

// ============================================================================
// Types
// ============================================================================

/**
 * Query parameters for workspace endpoints
 */
interface WorkspaceQuery {
  workspacePath?: string;
  includeGlobal?: boolean;
}

/**
 * Executor availability info
 */
interface AvailabilityInfo {
  status: "installed" | "not_found" | "login_detected";
  version?: string;
  path?: string;
}

/**
 * Executor info with workspace context
 */
interface WorkspaceExecutor {
  /** Executor ID (e.g., "CLAUDE_CODE") */
  id: string;
  /** Display name */
  name: string;
  /** Global availability info */
  availability: AvailabilityInfo;
  /** Whether this executor supports MCP */
  supportsMcp: boolean;
  /** Executor capabilities */
  capabilities: string[];
  /** Workspace-specific config exists */
  hasWorkspaceConfig: boolean;
  /** The workspace path this executor config belongs to */
  workspacePath: string;
  /** Path to workspace/project config file (if exists) */
  workspaceConfigPath?: string;
  /** Path to global (~) config file (if exists) */
  globalConfigPath?: string;
}

/**
 * Response for workspace executors
 */
interface WorkspaceExecutorsResponse {
  workspacePath: string;
  executors: WorkspaceExecutor[];
  total: number;
}

/**
 * Agent type enumeration
 */
type WorkspaceAgentType =
  | "viben"
  | "claude_code"
  | "cursor"
  | "vscode"
  | "continue"
  | "zed"
  | "windsurf"
  | "other";

/**
 * Agent info with workspace context
 */
interface WorkspaceAgent {
  /** Agent ID */
  id: string;
  /** Display name */
  name: string;
  /** Agent type */
  agentType: WorkspaceAgentType;
  /** Source: "global" or "workspace" */
  source: string;
  /** The workspace path this agent belongs to */
  workspacePath: string;
  /** Path to agent config */
  configPath?: string;
  /** MCP config path (if applicable) */
  mcpConfigPath?: string;
  /** Number of MCP servers configured */
  mcpServerCount: number;
  /** Number of skills/commands configured */
  skillCount: number;
}

/**
 * Response for workspace agents
 */
interface WorkspaceAgentsResponse {
  workspacePath: string;
  agents: WorkspaceAgent[];
  total: number;
}

/**
 * Model info with workspace context
 */
interface WorkspaceModel {
  /** Model ID (e.g., "claude-sonnet-4-20250514") */
  id: string;
  /** Display name */
  name: string;
  /** Provider ID */
  providerId: string;
  /** Provider name */
  providerName: string;
  /** Model capabilities */
  capabilities?: string[];
  /** Context window size */
  contextWindow?: number;
  /** Whether model is available (API key configured) */
  isAvailable: boolean;
  /** Workspace-specific override exists */
  hasWorkspaceOverride: boolean;
}

/**
 * Response for workspace models
 */
interface WorkspaceModelsResponse {
  workspacePath: string;
  models: WorkspaceModel[];
  total: number;
}

/**
 * Item type in chat list
 */
type ChatListItemType = "group_chat" | "executor" | "agent";

/**
 * A unified chat list item
 */
interface ChatListItem {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Item type */
  itemType: ChatListItemType;
  /** Source: "global" or "workspace" */
  source: string;
  /** The workspace path this item belongs to */
  workspacePath: string;
  /** Description (optional) */
  description?: string;
  /** Icon/avatar hint */
  iconType?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Counts by item type
 */
interface ChatListCounts {
  groupChats: number;
  executors: number;
  agents: number;
}

/**
 * Response for chat list
 */
interface ChatListResponse {
  workspacePath: string;
  items: ChatListItem[];
  total: number;
  counts: ChatListCounts;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Executor config folder patterns
 * [id, name, configFolders]
 */
const EXECUTOR_CONFIGS: [string, string, string[]][] = [
  ["CLAUDE_CODE", "Claude Code", [".claude"]],
  ["CURSOR_AGENT", "Cursor", [".cursor"]],
  ["AMP", "Amp", [".amp"]],
  ["GEMINI", "Gemini CLI", [".gemini"]],
  ["CODEX", "Codex CLI", [".codex"]],
  ["OPENCODE", "OpenCode", [".opencode"]],
  ["QWEN_CODE", "Qwen Coder", [".qwen"]],
  ["COPILOT", "GitHub Copilot", [".copilot"]],
  ["DROID", "Droid", [".droid"]],
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the default workspace path (user home directory)
 */
function getDefaultWorkspacePath(): string {
  return homedir();
}

/**
 * Validate workspace path exists and is a directory
 */
function validateWorkspacePath(path: string): { valid: true; path: string } | { valid: false; error: string } {
  if (!existsSync(path)) {
    return { valid: false, error: `Workspace path does not exist: ${path}` };
  }
  try {
    const stats = statSync(path);
    if (!stats.isDirectory()) {
      return { valid: false, error: `Workspace path is not a directory: ${path}` };
    }
  } catch {
    return { valid: false, error: `Cannot access workspace path: ${path}` };
  }
  return { valid: true, path };
}

/**
 * Find MCP config file in agent directory
 */
function findMcpConfig(agentDir: string): string | undefined {
  const candidates = [
    join(agentDir, "mcp_servers.json"),
    join(agentDir, ".mcp.json"),
    join(agentDir, "mcp.json"),
  ];

  for (const path of candidates) {
    if (existsSync(path)) {
      return path;
    }
  }

  // Also check root .mcp.json (for Claude Code)
  const parentDir = join(agentDir, "..");
  const rootMcp = join(parentDir, ".mcp.json");
  if (existsSync(rootMcp)) {
    return rootMcp;
  }

  return undefined;
}

/**
 * Count MCP servers in config file
 */
function countMcpServers(configPath: string | undefined): number {
  if (!configPath || !existsSync(configPath)) {
    return 0;
  }

  try {
    const content = readFileSync(configPath, "utf-8");
    const json = JSON.parse(content);
    if (json.mcpServers && typeof json.mcpServers === "object") {
      return Object.keys(json.mcpServers).length;
    }
  } catch {
    // Invalid JSON
  }

  return 0;
}

/**
 * Count skills in Claude Code directory
 */
function countSkills(claudeDir: string): number {
  const skillsDir = join(claudeDir, "skills");
  if (!existsSync(skillsDir)) {
    return 0;
  }

  try {
    const entries = readdirSync(skillsDir, { withFileTypes: true });
    return entries.filter((entry) => {
      if (entry.isDirectory()) {
        return existsSync(join(skillsDir, entry.name, "SKILL.md"));
      }
      return entry.name.endsWith(".md");
    }).length;
  } catch {
    return 0;
  }
}

/**
 * Get executor availability info
 * This is a simplified version - full implementation would check actual installations
 */
function getExecutorAvailability(_executorId: string): AvailabilityInfo {
  // TODO: Implement actual availability checking
  return { status: "not_found" };
}

// ============================================================================
// Route Handlers
// ============================================================================

/**
 * List executors available for a workspace
 * GET /api/workspaces/executors?workspacePath=...&includeGlobal=true
 */
async function listWorkspaceExecutors(
  request: FastifyRequest<{ Querystring: WorkspaceQuery }>,
  reply: FastifyReply
): Promise<WorkspaceExecutorsResponse> {
  const workspacePath = request.query.workspacePath || getDefaultWorkspacePath();
  const includeGlobal = request.query.includeGlobal !== false;

  const validation = validateWorkspacePath(workspacePath);
  if (!validation.valid) {
    reply.code(400);
    throw new Error(validation.error);
  }

  const globalWorkspacePath = getDefaultWorkspacePath();
  const executors: WorkspaceExecutor[] = [];

  for (const [id, name, configFolders] of EXECUTOR_CONFIGS) {
    const availability = getExecutorAvailability(id);

    // Check workspace config (project level)
    let hasWorkspaceConfig = false;
    let workspaceConfigPath: string | undefined;

    for (const folder of configFolders) {
      const configDir = join(workspacePath, folder);
      if (existsSync(configDir)) {
        hasWorkspaceConfig = true;
        workspaceConfigPath = configDir;
        break;
      }
    }

    // Check global config (user home level)
    let globalConfigPath: string | undefined;
    if (includeGlobal) {
      for (const folder of configFolders) {
        const configDir = join(globalWorkspacePath, folder);
        if (existsSync(configDir)) {
          globalConfigPath = configDir;
          break;
        }
      }
    }

    // Determine the workspace_path for this executor
    const executorWorkspacePath = hasWorkspaceConfig ? workspacePath : globalWorkspacePath;

    executors.push({
      id,
      name,
      availability,
      supportsMcp: ["CLAUDE_CODE", "CURSOR_AGENT", "AMP"].includes(id),
      capabilities: [],
      hasWorkspaceConfig,
      workspacePath: executorWorkspacePath,
      workspaceConfigPath,
      globalConfigPath,
    });
  }

  return {
    workspacePath,
    executors,
    total: executors.length,
  };
}

/**
 * List agents available for a workspace
 * GET /api/workspaces/agents?workspacePath=...&includeGlobal=true
 */
async function listWorkspaceAgents(
  request: FastifyRequest<{ Querystring: WorkspaceQuery }>,
  reply: FastifyReply
): Promise<WorkspaceAgentsResponse> {
  const workspacePath = request.query.workspacePath || getDefaultWorkspacePath();
  const includeGlobal = request.query.includeGlobal !== false;

  const validation = validateWorkspacePath(workspacePath);
  if (!validation.valid) {
    reply.code(400);
    throw new Error(validation.error);
  }

  const globalWorkspacePath = getDefaultWorkspacePath();
  const agents: WorkspaceAgent[] = [];

  // 1. Check for Viben agents in workspace (.viben/agents)
  const vibenAgentsDir = join(workspacePath, ".viben", "agents");
  if (existsSync(vibenAgentsDir)) {
    try {
      const entries = readdirSync(vibenAgentsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const agentId = entry.name;
          const configPath = join(vibenAgentsDir, agentId, "config.yaml");

          agents.push({
            id: `viben:${agentId}`,
            name: agentId,
            agentType: "viben",
            source: "workspace",
            workspacePath,
            configPath: existsSync(configPath) ? configPath : undefined,
            mcpServerCount: 0,
            skillCount: 0,
          });
        }
      }
    } catch {
      // Directory read error
    }
  }

  // 2. Include global Viben agents from ~/.viben/agents if includeGlobal=true
  if (includeGlobal) {
    const globalAgentsDir = join(globalWorkspacePath, ".viben", "agents");
    if (existsSync(globalAgentsDir)) {
      try {
        const entries = readdirSync(globalAgentsDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const agentId = entry.name;
            const fullId = `viben:${agentId}`;

            // Skip if already exists from workspace (workspace takes precedence)
            if (agents.some((a) => a.id === fullId)) {
              continue;
            }

            const configPath = join(globalAgentsDir, agentId, "config.yaml");

            agents.push({
              id: fullId,
              name: agentId,
              agentType: "viben",
              source: "global",
              workspacePath: globalWorkspacePath,
              configPath: existsSync(configPath) ? configPath : undefined,
              mcpServerCount: 0,
              skillCount: 0,
            });
          }
        }
      } catch {
        // Directory read error
      }
    }
  }

  // 3. Check for Claude Code config
  const claudeDir = join(workspacePath, ".claude");
  if (existsSync(claudeDir)) {
    const mcpConfig = findMcpConfig(claudeDir);
    const mcpCount = countMcpServers(mcpConfig);
    const skillCount = countSkills(claudeDir);

    agents.push({
      id: "claude_code",
      name: "Claude Code",
      agentType: "claude_code",
      source: "workspace",
      workspacePath,
      configPath: claudeDir,
      mcpConfigPath: mcpConfig,
      mcpServerCount: mcpCount,
      skillCount,
    });
  }

  // 4. Check for Cursor config
  const cursorDir = join(workspacePath, ".cursor");
  if (existsSync(cursorDir)) {
    const mcpConfig = join(cursorDir, "mcp.json");
    const mcpCount = existsSync(mcpConfig) ? countMcpServers(mcpConfig) : 0;

    agents.push({
      id: "cursor",
      name: "Cursor",
      agentType: "cursor",
      source: "workspace",
      workspacePath,
      configPath: cursorDir,
      mcpConfigPath: existsSync(mcpConfig) ? mcpConfig : undefined,
      mcpServerCount: mcpCount,
      skillCount: 0,
    });
  }

  // 5. Check for VS Code config
  const vscodeDir = join(workspacePath, ".vscode");
  if (existsSync(vscodeDir)) {
    const mcpConfig = join(vscodeDir, "mcp.json");
    const mcpCount = existsSync(mcpConfig) ? countMcpServers(mcpConfig) : 0;

    agents.push({
      id: "vscode",
      name: "VS Code",
      agentType: "vscode",
      source: "workspace",
      workspacePath,
      configPath: vscodeDir,
      mcpConfigPath: existsSync(mcpConfig) ? mcpConfig : undefined,
      mcpServerCount: mcpCount,
      skillCount: 0,
    });
  }

  // 6. Check for Continue.dev config
  const continueDir = join(workspacePath, ".continue");
  if (existsSync(continueDir)) {
    agents.push({
      id: "continue",
      name: "Continue.dev",
      agentType: "continue",
      source: "workspace",
      workspacePath,
      configPath: continueDir,
      mcpServerCount: 0,
      skillCount: 0,
    });
  }

  // 7. Check for Windsurf config
  const windsurfDir = join(workspacePath, ".windsurf");
  const codeiumWindsurfDir = join(workspacePath, ".codeium", "windsurf");
  const windsurfPathFound = existsSync(windsurfDir)
    ? windsurfDir
    : existsSync(codeiumWindsurfDir)
      ? codeiumWindsurfDir
      : undefined;

  if (windsurfPathFound) {
    agents.push({
      id: "windsurf",
      name: "Windsurf",
      agentType: "windsurf",
      source: "workspace",
      workspacePath,
      configPath: windsurfPathFound,
      mcpServerCount: 0,
      skillCount: 0,
    });
  }

  // 8. Check for Zed config
  const zedDir = join(workspacePath, ".zed");
  if (existsSync(zedDir)) {
    agents.push({
      id: "zed",
      name: "Zed",
      agentType: "zed",
      source: "workspace",
      workspacePath,
      configPath: zedDir,
      mcpServerCount: 0,
      skillCount: 0,
    });
  }

  return {
    workspacePath,
    agents,
    total: agents.length,
  };
}

/**
 * List models available for a workspace
 * GET /api/workspaces/models?workspacePath=...&includeGlobal=true
 */
async function listWorkspaceModels(
  request: FastifyRequest<{ Querystring: WorkspaceQuery }>,
  reply: FastifyReply
): Promise<WorkspaceModelsResponse> {
  const workspacePath = request.query.workspacePath || getDefaultWorkspacePath();

  const validation = validateWorkspacePath(workspacePath);
  if (!validation.valid) {
    reply.code(400);
    throw new Error(validation.error);
  }

  // Check for workspace-specific model config
  const workspaceModelsConfig = join(workspacePath, ".viben", "models.yaml");
  const hasWorkspaceConfig = existsSync(workspaceModelsConfig);

  const models: WorkspaceModel[] = [];

  // Get models from ModelManager
  try {
    const knownModels = await modelManager.listModels();
    for (const model of knownModels) {
      models.push({
        id: model.id,
        name: model.name,
        providerId: model.provider,
        providerName: model.provider,
        contextWindow: model.contextLength,
        isAvailable: true,
        hasWorkspaceOverride: hasWorkspaceConfig,
      });
    }
  } catch {
    // Model loading error
  }

  return {
    workspacePath,
    models,
    total: models.length,
  };
}

/**
 * List all chat items (group chats, executors, agents)
 * GET /api/workspaces/chat-items?workspacePath=...
 */
async function listChatItems(
  request: FastifyRequest<{ Querystring: WorkspaceQuery }>,
  reply: FastifyReply
): Promise<ChatListResponse> {
  const workspacePath = request.query.workspacePath || getDefaultWorkspacePath();
  const includeGlobal = request.query.includeGlobal !== false;

  const validation = validateWorkspacePath(workspacePath);
  if (!validation.valid) {
    reply.code(400);
    throw new Error(validation.error);
  }

  const globalWorkspacePath = getDefaultWorkspacePath();
  const items: ChatListItem[] = [];

  // 1. Load Executors (only those with workspace config)
  for (const [id, name, configFolders] of EXECUTOR_CONFIGS) {
    let hasWorkspaceConfig = false;
    let executorSource = "global";
    let executorWorkspacePath = globalWorkspacePath;

    // Check workspace config
    for (const folder of configFolders) {
      const configDir = join(workspacePath, folder);
      if (existsSync(configDir)) {
        hasWorkspaceConfig = true;
        executorSource = "workspace";
        executorWorkspacePath = workspacePath;
        break;
      }
    }

    // Check global config if not found in workspace
    if (!hasWorkspaceConfig && includeGlobal) {
      for (const folder of configFolders) {
        const configDir = join(globalWorkspacePath, folder);
        if (existsSync(configDir)) {
          hasWorkspaceConfig = true;
          break;
        }
      }
    }

    // Only include executors that have config
    if (hasWorkspaceConfig) {
      const availability = getExecutorAvailability(id);
      const isInstalled = availability.status === "installed" || availability.status === "login_detected";

      items.push({
        id,
        name,
        itemType: "executor",
        source: executorSource,
        workspacePath: executorWorkspacePath,
        iconType: id.toLowerCase(),
        metadata: {
          isInstalled,
          executorType: id,
        },
      });
    }
  }

  // 2. Load Viben Agents
  // Workspace agents
  const vibenAgentsDir = join(workspacePath, ".viben", "agents");
  if (existsSync(vibenAgentsDir)) {
    try {
      const entries = readdirSync(vibenAgentsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const agentId = entry.name;
          items.push({
            id: `viben:${agentId}`,
            name: agentId,
            itemType: "agent",
            source: "workspace",
            workspacePath,
            iconType: "viben",
            metadata: {
              agentType: "viben",
            },
          });
        }
      }
    } catch {
      // Directory read error
    }
  }

  // Global agents
  if (includeGlobal) {
    const globalAgentsDir = join(globalWorkspacePath, ".viben", "agents");
    if (existsSync(globalAgentsDir)) {
      try {
        const entries = readdirSync(globalAgentsDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const agentId = entry.name;
            const fullId = `viben:${agentId}`;

            // Skip if already exists from workspace
            if (!items.some((i) => i.id === fullId)) {
              items.push({
                id: fullId,
                name: agentId,
                itemType: "agent",
                source: "global",
                workspacePath: globalWorkspacePath,
                iconType: "viben",
                metadata: {
                  agentType: "viben",
                },
              });
            }
          }
        }
      } catch {
        // Directory read error
      }
    }
  }

  // Calculate counts
  const groupChatsCount = items.filter((i) => i.itemType === "group_chat").length;
  const executorsCount = items.filter((i) => i.itemType === "executor").length;
  const agentsCount = items.filter((i) => i.itemType === "agent").length;

  return {
    workspacePath,
    items,
    total: items.length,
    counts: {
      groupChats: groupChatsCount,
      executors: executorsCount,
      agents: agentsCount,
    },
  };
}

// ============================================================================
// Route Registration
// ============================================================================

/**
 * Register workspace routes
 */
export function registerWorkspaceRoutes(fastify: FastifyInstance): void {
  // List executors available in workspace
  fastify.get(
    "/api/workspaces/executors",
    async (
      request: FastifyRequest<{ Querystring: WorkspaceQuery }>,
      reply: FastifyReply
    ) => {
      try {
        return await listWorkspaceExecutors(request, reply);
      } catch (e) {
        if (reply.statusCode === 200) {
          reply.code(500);
        }
        return { error: e instanceof Error ? e.message : "Failed to list workspace executors" };
      }
    }
  );

  // List agents available in workspace
  fastify.get(
    "/api/workspaces/agents",
    async (
      request: FastifyRequest<{ Querystring: WorkspaceQuery }>,
      reply: FastifyReply
    ) => {
      try {
        return await listWorkspaceAgents(request, reply);
      } catch (e) {
        if (reply.statusCode === 200) {
          reply.code(500);
        }
        return { error: e instanceof Error ? e.message : "Failed to list workspace agents" };
      }
    }
  );

  // List models available in workspace
  fastify.get(
    "/api/workspaces/models",
    async (
      request: FastifyRequest<{ Querystring: WorkspaceQuery }>,
      reply: FastifyReply
    ) => {
      try {
        return await listWorkspaceModels(request, reply);
      } catch (e) {
        if (reply.statusCode === 200) {
          reply.code(500);
        }
        return { error: e instanceof Error ? e.message : "Failed to list workspace models" };
      }
    }
  );

  // List all chat items (agents, models, group chats)
  fastify.get(
    "/api/workspaces/chat-items",
    async (
      request: FastifyRequest<{ Querystring: WorkspaceQuery }>,
      reply: FastifyReply
    ) => {
      try {
        return await listChatItems(request, reply);
      } catch (e) {
        if (reply.statusCode === 200) {
          reply.code(500);
        }
        return { error: e instanceof Error ? e.message : "Failed to list chat items" };
      }
    }
  );
}
