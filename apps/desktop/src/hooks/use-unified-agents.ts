/**
 * Hook for Unified Agent Management
 *
 * 合并执行器和智能体，提供统一的接口。
 * - 执行器 (Executor): 来自工作空间自动发现（.claude/, CLAUDE.md 等），是运行后端
 * - 智能体 (Agent): 来自 ~/.viben/agents/，Viben Agent 使用执行器作为运行后端
 */
import { useCallback, useMemo } from "react";
import { useVibenAgents, type Agent, type AgentUpdate, type CreateAgentOptions } from "./use-viben-agents";
import { useWorkspaceAgents, useLocalWorkspaces } from "./use-workspaces";
import {
  type UnifiedAgent,
  executorToUnified,
  vibenAgentToUnified,
  isExecutor,
  isAgent,
} from "@/types/unified-agent";

// ============================================================================
// Types
// ============================================================================

export interface UseUnifiedAgentsOptions {
  /** 工作空间 ID (可选，用于加载执行器) */
  workspaceId?: string | null;
  /** 是否包含智能体（全局存储） */
  includeAgents?: boolean;
  /** 是否包含执行器（工作空间自动发现） */
  includeExecutors?: boolean;
}

export interface UseUnifiedAgentsReturn {
  // Data
  /** 所有项目（执行器 + 智能体） */
  all: UnifiedAgent[];
  /** 执行器 (来自工作空间自动发现) */
  executors: UnifiedAgent[];
  /** 智能体 (来自全局存储) */
  agents: UnifiedAgent[];
  /** 默认智能体 ID */
  defaultAgentId: string | null;

  // Loading states
  loading: boolean;
  error: string | null;

  // Agent CRUD
  /** 刷新所有 */
  refresh: () => Promise<void>;
  /** 获取单个项目 */
  getItem: (id: string) => UnifiedAgent | undefined;
  /** 创建智能体 (全局) */
  createAgent: (options: CreateAgentOptions) => Promise<Agent>;
  /** 更新智能体 */
  updateAgent: (id: string, updates: AgentUpdate) => Promise<Agent>;
  /** 删除智能体 */
  removeAgent: (id: string) => Promise<void>;
  /** 设置默认智能体 */
  setDefaultAgent: (id: string) => Promise<void>;

  // Helpers
  /** 检查是否为执行器 */
  isExecutor: (agent: UnifiedAgent) => boolean;
  /** 检查是否为智能体 */
  isAgent: (agent: UnifiedAgent) => boolean;
}

// ============================================================================
// Hook
// ============================================================================

export function useUnifiedAgents(options: UseUnifiedAgentsOptions = {}): UseUnifiedAgentsReturn {
  const {
    workspaceId = null,
    includeAgents = true,
    includeExecutors = true,
  } = options;

  // Get workspace info
  const { getWorkspace } = useLocalWorkspaces();
  const workspace = workspaceId ? getWorkspace(workspaceId) : undefined;

  // Viben agents (global storage)
  const {
    agents: vibenAgents,
    defaultAgentId,
    loading: vibenLoading,
    error: vibenError,
    refresh: refreshVibenAgents,
    getAgent: _getVibenAgent,
    createAgent,
    updateAgent,
    removeAgent: removeVibenAgent,
    setDefaultAgent,
  } = useVibenAgents();

  // Workspace executors (auto-discovered)
  const {
    agents: workspaceExecutors,
    loading: workspaceLoading,
    error: workspaceError,
    loadAgents: loadWorkspaceExecutors,
  } = useWorkspaceAgents(includeExecutors ? workspaceId : null);

  // Combined loading and error states
  const loading = vibenLoading || workspaceLoading;
  const error = vibenError || workspaceError;

  // Convert and merge
  const { all, executors, agents } = useMemo(() => {
    const execList: UnifiedAgent[] = includeExecutors
      ? workspaceExecutors.map((a) => executorToUnified(a, workspace?.path))
      : [];

    const agentList: UnifiedAgent[] = includeAgents
      ? vibenAgents.map(vibenAgentToUnified)
      : [];

    return {
      all: [...execList, ...agentList],
      executors: execList,
      agents: agentList,
    };
  }, [workspaceExecutors, vibenAgents, workspace?.path, includeExecutors, includeAgents]);

  // Refresh all
  const refresh = useCallback(async () => {
    const promises: Promise<void>[] = [];
    if (includeAgents) {
      promises.push(refreshVibenAgents());
    }
    if (includeExecutors && workspaceId) {
      promises.push(loadWorkspaceExecutors());
    }
    await Promise.all(promises);
  }, [refreshVibenAgents, loadWorkspaceExecutors, includeAgents, includeExecutors, workspaceId]);

  // Get item by ID
  const getItem = useCallback(
    (id: string): UnifiedAgent | undefined => {
      return all.find((a) => a.id === id);
    },
    [all]
  );

  // Remove agent (only global agents can be removed via this hook)
  const removeAgent = useCallback(
    async (id: string): Promise<void> => {
      const item = getItem(id);
      if (!item) {
        throw new Error(`Agent ${id} not found`);
      }
      if (isExecutor(item)) {
        throw new Error("Cannot remove executor via this hook. Please delete the config file directly.");
      }
      await removeVibenAgent(id);
    },
    [getItem, removeVibenAgent]
  );

  return {
    // Data
    all,
    executors,
    agents,
    defaultAgentId,

    // Loading states
    loading,
    error,

    // Agent CRUD
    refresh,
    getItem,
    createAgent,
    updateAgent,
    removeAgent,
    setDefaultAgent,

    // Helpers
    isExecutor,
    isAgent,
  };
}

// ============================================================================
// Convenience Hooks
// ============================================================================

/**
 * Hook for getting all Viben agents (global storage)
 */
export function useVibenAgentsOnly() {
  return useUnifiedAgents({
    includeAgents: true,
    includeExecutors: false,
  });
}

/**
 * Hook for getting workspace executors only (auto-discovered)
 */
export function useWorkspaceExecutors(workspaceId: string | null) {
  return useUnifiedAgents({
    workspaceId,
    includeAgents: false,
    includeExecutors: true,
  });
}
