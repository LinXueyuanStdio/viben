/**
 * useConversation Hook - 中栏对话状态管理
 *
 * 组合 useAgentDetail 和 useAgentConversation 来管理对话状态：
 * - 从 Gateway API 按需获取选中 agent 的配置路径
 * - 使用 useAgentConversation 执行 SSE 流式对话（传 agentPath 让后端读取配置）
 * - 提供统一的对话操作接口
 */

import { useMemo, useCallback } from "react";
import { useAgentConversation } from "./use-agent-conversation";
import { useAgentDetail } from "./use-workspace-resources";
import type {
  AgentMessage,
  AgentPhase,
  MessageAttachment,
  TaskPlan,
  PendingQuestion,
  Artifact,
  ToolUsage,
} from "@/types";

export interface UseConversationOptions {
  /** Selected agent ID (可带或不带 "viben:" 前缀) */
  selectedAgentId?: string | null;
  /** Enable mock mode (for testing) */
  mockMode?: boolean;
}

export interface UseConversationReturn {
  // Agent Detail State
  /** Current agent's full configuration */
  currentAgent: {
    id: string;
    name: string;
    model?: string;
    provider?: string;
    system_prompt?: string;
    append_prompt?: string;
    temperature?: number;
    max_tokens?: number;
    executor_type?: string;
    mcp_servers?: string[];
    skills?: string[];
    plan_mode?: boolean;
    approvals?: boolean;
  } | null;
  /** Loading agent details */
  agentLoading: boolean;
  /** Agent not found */
  agentNotFound: boolean;

  // Conversation State (from useAgent)
  messages: AgentMessage[];
  phase: AgentPhase;
  isStreaming: boolean;
  pendingPlan: TaskPlan | null;
  pendingQuestions: PendingQuestion | null;
  artifacts: Artifact[];
  toolUsages: ToolUsage[];
  error: string | null;
  sessionId: string | null;
  gatewayConnected: boolean | null;

  // Actions
  sendMessage: (content: string, attachments?: MessageAttachment[]) => Promise<void>;
  approvePlan: () => Promise<void>;
  rejectPlan: () => Promise<void>;
  answerQuestions: (answers: Record<string, string[]>) => Promise<void>;
  cancel: () => Promise<void>;
  clearMessages: () => void;
  loadMessages: (savedMessages: AgentMessage[]) => void;
  checkGatewayConnection: () => Promise<boolean>;
  refreshAgent: () => Promise<void>;
}

/**
 * Hook for managing conversation state in the middle column
 *
 * @param workspacePath - Workspace path used as working directory
 * @param options - Configuration options
 */
export function useConversation(
  workspacePath: string,
  options?: UseConversationOptions
): UseConversationReturn {
  const { selectedAgentId, mockMode = false } = options || {};

  // Fetch agent details on-demand when selectedAgentId changes
  const {
    agent: agentDetail,
    loading: agentLoading,
    notFound: agentNotFound,
    refresh: refreshAgent,
  } = useAgentDetail(selectedAgentId || null, workspacePath);

  // Get agent config path for backend to read
  const agentPath = agentDetail?.config_path;

  // Use agent conversation hook for SSE streaming execution
  // Pass agentPath so backend reads config from disk (more reliable than inline config)
  const {
    messages,
    phase,
    isStreaming,
    pendingPlan,
    pendingQuestions,
    artifacts,
    toolUsages,
    error,
    sessionId,
    gatewayConnected,
    sendMessage,
    approvePlan,
    rejectPlan,
    answerQuestions,
    cancel,
    clearMessages,
    loadMessages,
    checkGatewayConnection,
  } = useAgentConversation(workspacePath, { agentPath, mockMode });

  // Normalize current agent for consumers
  const currentAgent = useMemo(() => {
    if (!agentDetail) return null;
    return {
      id: agentDetail.id,
      name: agentDetail.name,
      model: agentDetail.model,
      provider: agentDetail.provider,
      system_prompt: agentDetail.system_prompt,
      append_prompt: agentDetail.append_prompt,
      temperature: agentDetail.temperature,
      max_tokens: agentDetail.max_tokens,
      executor_type: agentDetail.executor_type,
      mcp_servers: agentDetail.mcp_servers,
      skills: agentDetail.skills,
      plan_mode: agentDetail.plan_mode,
      approvals: agentDetail.approvals,
    };
  }, [agentDetail]);

  // Wrap refreshAgent to match expected type
  const handleRefreshAgent = useCallback(async () => {
    await refreshAgent();
  }, [refreshAgent]);

  return {
    // Agent Detail State
    currentAgent,
    agentLoading,
    agentNotFound,

    // Conversation State
    messages,
    phase,
    isStreaming,
    pendingPlan,
    pendingQuestions,
    artifacts,
    toolUsages,
    error,
    sessionId,
    gatewayConnected,

    // Actions
    sendMessage,
    approvePlan,
    rejectPlan,
    answerQuestions,
    cancel,
    clearMessages,
    loadMessages,
    checkGatewayConnection,
    refreshAgent: handleRefreshAgent,
  };
}
