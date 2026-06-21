/**
 * Chat List routes
 *
 * Provides aggregated chat list endpoint that combines:
 * - Group chats
 * - Executors (with config)
 * - Agents
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { readdir, access, constants } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { agentManager } from "../../agents";
import { GroupChatService } from "../../group-chat";

// ============================================================================
// Types
// ============================================================================

/**
 * Chat item type
 */
type ChatItemType = "group_chat" | "executor" | "agent";

/**
 * A chat list item
 */
interface ChatListItem {
  id: string;
  item_type: ChatItemType;
  name: string;
  description?: string;
  last_active?: string;
  unread_count?: number;
  workspace_path?: string;
  is_global?: boolean;
  source?: string;
  icon_type?: string;
  metadata?: Record<string, unknown>;
  // Executor-specific
  is_available?: boolean;
  supports_mcp?: boolean;
  session_count?: number;
  // Agent-specific
  model?: string;
  provider_id?: string;
}

/**
 * Chat list counts by type
 */
interface ChatListCounts {
  group_chats: number;
  executors: number;
  agents: number;
}

/**
 * Chat list response
 */
interface ChatListResponse {
  workspace_path: string;
  items: ChatListItem[];
  total: number;
  counts: ChatListCounts;
}

/**
 * Query parameters
 */
interface ChatListQuery {
  workspace_path?: string;
  include_global?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Known executor configs
 */
const EXECUTOR_CONFIGS: Array<{
  id: string;
  name: string;
  folders: string[];
  supportsMcp: boolean;
}> = [
  { id: "CLAUDE_CODE", name: "Claude Code", folders: [".claude"], supportsMcp: true },
  { id: "CURSOR_AGENT", name: "Cursor", folders: [".cursor"], supportsMcp: true },
  { id: "AMP", name: "Amp", folders: [".amp"], supportsMcp: true },
  { id: "GEMINI", name: "Gemini CLI", folders: [".gemini"], supportsMcp: false },
  { id: "CODEX", name: "Codex CLI", folders: [".codex"], supportsMcp: false },
  { id: "OPENCODE", name: "OpenCode", folders: [".opencode"], supportsMcp: false },
  { id: "QWEN_CODE", name: "Qwen Coder", folders: [".qwen"], supportsMcp: false },
  { id: "COPILOT", name: "GitHub Copilot", folders: [".copilot"], supportsMcp: false },
  { id: "DROID", name: "Droid", folders: [".droid"], supportsMcp: false },
];

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get default workspace path
 */
function getDefaultWorkspacePath(): string {
  return homedir();
}

/**
 * Check if a path exists (async)
 */
async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if an executor has config in the workspace
 */
async function hasExecutorConfig(workspacePath: string, folders: string[]): Promise<boolean> {
  for (const folder of folders) {
    if (await pathExists(join(workspacePath, folder))) {
      return true;
    }
  }
  return false;
}

/**
 * Count sessions for Claude Code in a workspace
 */
async function countClaudeCodeSessions(workspacePath: string): Promise<number> {
  const encodedPath = workspacePath.replace(/\//g, "-");
  const sessionsDir = join(homedir(), ".claude", "projects", encodedPath);

  try {
    const entries = await readdir(sessionsDir);
    return entries.filter((e) => e.endsWith(".jsonl")).length;
  } catch {
    return 0;
  }
}

// ============================================================================
// Route Registration
// ============================================================================

/**
 * Register chat list routes
 */
export function registerChatListRoutes(fastify: FastifyInstance): void {
  /**
   * Get aggregated chat list
   * GET /api/chat-list
   */
  fastify.get(
    "/api/chat-list",
    async (
      request: FastifyRequest<{ Querystring: ChatListQuery }>,
      _reply: FastifyReply
    ): Promise<ChatListResponse> => {
      const workspacePath = request.query.workspace_path || getDefaultWorkspacePath();
      const includeGlobal = request.query.include_global !== false;
      const globalPath = getDefaultWorkspacePath();

      const items: ChatListItem[] = [];

      // 1. Load group chats from file-based storage
      // Global group chats (from ~/.viben/group-chats)
      if (includeGlobal) {
        const globalVibenPath = join(globalPath, ".viben", "group-chats");
        if (await pathExists(globalVibenPath)) {
          try {
            const globalService = new GroupChatService(globalVibenPath);
            const globalChats = await globalService.listGroupChats();
            for (const gc of globalChats) {
              items.push({
                id: gc.id,
                item_type: "group_chat",
                name: gc.name,
                description: gc.description,
                source: "global",
                workspace_path: globalPath,
                icon_type: "group",
                is_global: true,
                last_active: gc.updated_at,
                metadata: {
                  created_by: gc.createdBy,
                  created_at: gc.created_at,
                  settings: gc.settings,
                },
              });
            }
          } catch {
            // Global group chat loading failed, skip
          }
        }
      }

      // Workspace group chats (from <workspace>/.viben/group-chats)
      if (workspacePath !== globalPath) {
        const workspaceVibenPath = join(workspacePath, ".viben", "group-chats");
        if (await pathExists(workspaceVibenPath)) {
          try {
            const workspaceService = new GroupChatService(workspaceVibenPath);
            const workspaceChats = await workspaceService.listGroupChats();
            for (const gc of workspaceChats) {
              // Skip if already exists from global
              if (!items.some((i) => i.id === gc.id)) {
                items.push({
                  id: gc.id,
                  item_type: "group_chat",
                  name: gc.name,
                  description: gc.description,
                  source: "workspace",
                  workspace_path: workspacePath,
                  icon_type: "group",
                  is_global: false,
                  last_active: gc.updated_at,
                  metadata: {
                    created_by: gc.createdBy,
                    created_at: gc.created_at,
                    settings: gc.settings,
                  },
                });
              }
            }
          } catch {
            // Workspace group chat loading failed, skip
          }
        }
      }

      // 2. Load executors with workspace config
      for (const executor of EXECUTOR_CONFIGS) {
        const hasWorkspaceConfig = await hasExecutorConfig(workspacePath, executor.folders);
        const hasGlobalConfig = includeGlobal && await hasExecutorConfig(globalPath, executor.folders);

        if (hasWorkspaceConfig || hasGlobalConfig) {
          const sessionCount =
            executor.id === "CLAUDE_CODE" ? await countClaudeCodeSessions(workspacePath) : 0;

          items.push({
            id: executor.id,
            item_type: "executor",
            name: executor.name,
            description: `${executor.name} CLI`,
            source: hasWorkspaceConfig ? "workspace" : "global",
            workspace_path: hasWorkspaceConfig ? workspacePath : globalPath,
            icon_type: executor.id.toLowerCase(),
            is_available: true, // Would need to check actual availability
            supports_mcp: executor.supportsMcp,
            session_count: sessionCount,
            last_active: undefined, // Would need to check session files
            metadata: {
              executor_type: executor.id,
              is_installed: true,
            },
          });
        }
      }

      // 3. Load Viben agents
      try {
        const agents = await agentManager.listAgents();
        for (const agent of agents) {
          items.push({
            id: agent.id,
            item_type: "agent",
            name: agent.name || agent.id,
            description: agent.systemPrompt?.substring(0, 100),
            source: "global",
            workspace_path: globalPath,
            icon_type: "viben",
            model: agent.model,
            provider_id: agent.provider_id,
            is_global: true,
            session_count: 0, // Would need to check session store
            metadata: {
              agent_type: "viben",
            },
          });
        }
      } catch {
        // Agent loading failed, skip
      }

      // 4. Load workspace agents (.viben/agents)
      const vibenAgentsDir = join(workspacePath, ".viben", "agents");
      try {
        const entries = await readdir(vibenAgentsDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const agentId = entry.name;
            // Skip if already in global agents
            if (!items.some((i) => i.id === agentId)) {
              items.push({
                id: agentId,
                item_type: "agent",
                name: entry.name,
                source: "workspace",
                workspace_path: workspacePath,
                icon_type: "viben",
                is_global: false,
                metadata: {
                  agent_type: "viben",
                },
              });
            }
          }
        }
      } catch {
        // Directory read failed or does not exist
      }

      // Sort by last_active (newest first), with items without last_active at the end
      items.sort((a, b) => {
        if (!a.last_active && !b.last_active) return 0;
        if (!a.last_active) return 1;
        if (!b.last_active) return -1;
        return new Date(b.last_active).getTime() - new Date(a.last_active).getTime();
      });

      // Calculate counts
      const counts: ChatListCounts = {
        group_chats: items.filter((i) => i.item_type === "group_chat").length,
        executors: items.filter((i) => i.item_type === "executor").length,
        agents: items.filter((i) => i.item_type === "agent").length,
      };

      return {
        workspace_path: workspacePath,
        items,
        total: items.length,
        counts,
      };
    }
  );
}
