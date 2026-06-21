/**
 * Unified Agent Types
 *
 * 统一的智能体类型定义，支持：
 * - 执行器 (Executor) - 来自工作空间自动发现（.claude/, CLAUDE.md 等），是运行后端
 * - 智能体 (Agent) - 来自 ~/.viben/agents/，Viben Agent 会使用某个执行器作为运行后端
 */

import type { Executor, ExecutorType } from "./index";
import type { AgentInfo, ExecutorInfo } from "@/lib/gateway";

// Legacy Agent type for backwards compatibility
export type Agent = AgentInfo;

// ============================================================================
// Agent Source Types
// ============================================================================

/**
 * 来源类型
 * - workspace: 工作空间自动发现（执行器）
 * - global: 全局存储（智能体）
 */
export type AgentSource = "workspace" | "global";

/**
 * 角色类型
 * - executor: 执行器，来自工作空间自动发现配置，是运行后端
 * - agent: 智能体，来自全局存储，使用执行器作为运行后端
 */
export type AgentRole = "executor" | "agent";

// ============================================================================
// Unified Agent Interface
// ============================================================================

/**
 * 统一的智能体接口
 * 合并工作空间智能体和全局智能体的属性
 */
export interface UnifiedAgent {
  /** 唯一标识符 */
  id: string;
  /** 显示名称 */
  name: string;
  /** 描述 */
  description?: string;
  /** 来源 */
  source: AgentSource;
  /** 角色 */
  role: AgentRole;
  /** 工作空间 ID (仅工作空间智能体) */
  workspaceId?: string;
  /** 工作空间路径 (仅工作空间智能体) */
  workspacePath?: string;
  /** 执行器类型 (仅执行器) */
  executorType?: ExecutorType;
  /** 配置路径 */
  configPath?: string;
  /** MCP 配置文件路径 */
  mcpConfigFile?: string | null;
  /** 技能配置文件路径 */
  skillsConfigFile?: string | null;
  /** 模型 */
  model?: string;
  /** Provider instance ID */
  provider_id?: string;
  /** 系统提示词 */
  systemPrompt?: string;
  /** 追加提示词 */
  appendPrompt?: string;
  /** 温度参数 */
  temperature?: number;
  /** 最大令牌数 */
  maxTokens?: number;
  /** MCP 服务器列表 */
  mcpServers?: string[];
  /** 技能列表 */
  skills?: string[];
  /** 审批模式 */
  approvalMode?: "bypass" | "rules" | "ai";
  /** 创建时间 */
  createdAt?: string;
  /** 更新时间 */
  updatedAt?: string;
  /** 原始数据 - 执行器 */
  rawExecutor?: Executor;
  /** 原始数据 - 全局智能体 */
  rawVibenAgent?: AgentInfo;
}

// ============================================================================
// Conversion Functions
// ============================================================================

/**
 * 将工作空间自动发现的配置转换为执行器
 */
export function executorToUnified(
  executor: Executor,
  workspacePath?: string
): UnifiedAgent {
  return {
    id: executor.id,
    name: executor.name,
    description: undefined,
    source: "workspace",
    role: "executor",
    workspaceId: executor.workspace_id,
    workspacePath,
    executorType: executor.type,
    configPath: executor.config_path,
    mcpConfigFile: executor.mcp_config_file,
    skillsConfigFile: executor.skills_config_file,
    rawExecutor: executor,
  };
}

/** @deprecated Use executorInfoToUnified instead */
export const workspaceAgentToExecutor = executorToUnified;

/**
 * 将 ExecutorInfo (from Gateway API) 转换为统一执行器
 * 这是新的推荐方式，使用 Gateway API 返回的 ExecutorInfo 类型
 */
export function executorInfoToUnified(executor: ExecutorInfo): UnifiedAgent {
  return {
    id: executor.type, // Use type as ID for consistency with routing
    name: executor.name,
    description: undefined,
    source: executor.has_workspace_config ? "workspace" : "global",
    role: "executor",
    workspacePath: executor.workspace_path,
    executorType: executor.type as ExecutorType,
    configPath: executor.workspace_config_path || executor.global_config_path,
  };
}

/**
 * 将 Viben Agent (AgentInfo from Gateway API) 转换为统一智能体
 */
export function vibenAgentToUnified(agent: AgentInfo): UnifiedAgent {
  return {
    id: agent.id,
    name: agent.name,
    description: agent.description,
    source: agent.source === "workspace" ? "workspace" : "global",
    role: "agent",
    workspacePath: agent.workspace_path,
    configPath: agent.config_path,
    model: agent.model,
    provider_id: agent.provider_id,
    systemPrompt: agent.system_prompt,
    appendPrompt: agent.append_prompt,
    temperature: agent.temperature,
    maxTokens: agent.max_tokens,
    mcpServers: agent.mcp_servers,
    skills: agent.skills,
    approvalMode: agent.approval_mode,
    createdAt: agent.created_at,
    updatedAt: agent.updated_at,
    rawVibenAgent: agent,
  };
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * 检查是否为执行器
 */
export function isExecutor(agent: UnifiedAgent): boolean {
  return agent.role === "executor";
}

/**
 * 检查是否为智能体
 */
export function isAgent(agent: UnifiedAgent): boolean {
  return agent.role === "agent";
}

/**
 * 检查是否来自工作空间（执行器）
 */
export function isWorkspaceExecutor(agent: UnifiedAgent): boolean {
  return agent.source === "workspace";
}

/**
 * 检查是否来自全局存储（智能体）
 */
export function isGlobalAgent(agent: UnifiedAgent): boolean {
  return agent.source === "global";
}

// ============================================================================
// Display Helpers
// ============================================================================

/**
 * 获取来源标签的 i18n key
 */
export function getAgentSourceLabelKey(agent: UnifiedAgent): string {
  return agent.source === "workspace" ? "agent.sourceWorkspace" : "agent.sourceGlobal";
}

/**
 * 获取角色标签的 i18n key
 */
export function getAgentRoleLabelKey(agent: UnifiedAgent): string {
  return agent.role === "executor" ? "agent.roleExecutor" : "agent.roleAgent";
}

/**
 * 获取显示名称的 i18n key (如果名称为空)
 */
export function getAgentDisplayNameKey(agent: UnifiedAgent): string | null {
  if (agent.name) return null; // 有名称时返回 null，调用者直接使用 agent.name
  return agent.role === "executor" ? "agent.unnamedExecutor" : "agent.unnamedAgent";
}

/**
 * 获取图标颜色类
 */
export function getAgentColorClass(agent: UnifiedAgent): string {
  if (agent.role === "executor") {
    return "bg-orange-500/20 text-orange-600";
  }
  return "bg-primary/20 text-primary";
}
