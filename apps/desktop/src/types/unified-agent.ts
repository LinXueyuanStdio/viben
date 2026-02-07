/**
 * Unified Agent Types
 *
 * 统一的智能体类型定义，支持：
 * - 执行器 (Executor) - 来自工作空间自动发现（.claude/, CLAUDE.md 等），是运行后端
 * - 智能体 (Agent) - 来自 ~/.viben/agents/，Viben Agent 会使用某个执行器作为运行后端
 */

import type { Executor, ExecutorType } from "./index";
import type { Agent } from "@/hooks/use-viben-agents";

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
  /** 提供商 */
  provider?: string;
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
  /** 是否计划模式 */
  planMode?: boolean;
  /** 是否需要审批 */
  approvals?: boolean;
  /** 创建时间 */
  createdAt?: string;
  /** 更新时间 */
  updatedAt?: string;
  /** 原始数据 - 执行器 */
  rawExecutor?: Executor;
  /** 原始数据 - 全局智能体 */
  rawVibenAgent?: Agent;
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

/** @deprecated Use executorToUnified instead */
export const workspaceAgentToExecutor = executorToUnified;

/**
 * 将 Viben Agent 转换为统一智能体
 */
export function vibenAgentToUnified(agent: Agent): UnifiedAgent {
  return {
    id: agent.id,
    name: agent.name,
    description: agent.description,
    source: "global",
    role: "agent",
    model: agent.model,
    provider: agent.provider,
    systemPrompt: agent.system_prompt,
    appendPrompt: agent.append_prompt,
    temperature: agent.temperature,
    maxTokens: agent.max_tokens,
    mcpServers: agent.mcp_servers,
    skills: agent.skills,
    planMode: agent.plan_mode,
    approvals: agent.approvals,
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
 * 获取来源标签
 */
export function getAgentSourceLabel(agent: UnifiedAgent): string {
  return agent.source === "workspace" ? "工作空间" : "全局";
}

/**
 * 获取角色标签
 */
export function getAgentRoleLabel(agent: UnifiedAgent): string {
  return agent.role === "executor" ? "执行器" : "智能体";
}

/**
 * 获取显示的简短名称
 */
export function getAgentDisplayName(agent: UnifiedAgent): string {
  return agent.name || (agent.role === "executor" ? "未命名执行器" : "未命名智能体");
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
