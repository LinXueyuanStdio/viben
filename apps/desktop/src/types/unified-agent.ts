/**
 * Unified Agent Types
 *
 * 统一的智能体类型定义，支持：
 * - 主智能体 (Primary Agent) - 来自工作空间配置文件
 * - 子智能体 (Sub Agent) - 来自 ~/.viben/agents/
 */

import type { WorkspaceAgent, WorkspaceAgentType } from "./index";
import type { Agent } from "@/hooks/use-viben-agents";

// ============================================================================
// Agent Source Types
// ============================================================================

/**
 * 智能体来源类型
 */
export type AgentSource = "workspace" | "global";

/**
 * 智能体角色类型
 * - primary: 主智能体，来自工作空间配置
 * - sub: 子智能体，来自全局存储
 */
export type AgentRole = "primary" | "sub";

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
  /** 智能体类型 (仅工作空间智能体) */
  agentType?: WorkspaceAgentType;
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
  /** 原始数据 - 工作空间智能体 */
  rawWorkspaceAgent?: WorkspaceAgent;
  /** 原始数据 - 全局智能体 */
  rawVibenAgent?: Agent;
}

// ============================================================================
// Conversion Functions
// ============================================================================

/**
 * 将工作空间智能体转换为统一智能体
 */
export function workspaceAgentToUnified(
  agent: WorkspaceAgent,
  workspacePath?: string
): UnifiedAgent {
  return {
    id: agent.id,
    name: agent.name,
    description: undefined,
    source: "workspace",
    role: "primary",
    workspaceId: agent.workspace_id,
    workspacePath,
    agentType: agent.type,
    configPath: agent.config_path,
    mcpConfigFile: agent.mcp_config_file,
    skillsConfigFile: agent.skills_config_file,
    rawWorkspaceAgent: agent,
  };
}

/**
 * 将全局智能体转换为统一智能体
 */
export function vibenAgentToUnified(agent: Agent): UnifiedAgent {
  return {
    id: agent.id,
    name: agent.name,
    description: agent.description,
    source: "global",
    role: "sub",
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
 * 检查是否为主智能体
 */
export function isPrimaryAgent(agent: UnifiedAgent): boolean {
  return agent.role === "primary";
}

/**
 * 检查是否为子智能体
 */
export function isSubAgent(agent: UnifiedAgent): boolean {
  return agent.role === "sub";
}

/**
 * 检查是否为工作空间智能体
 */
export function isWorkspaceAgent(agent: UnifiedAgent): boolean {
  return agent.source === "workspace";
}

/**
 * 检查是否为全局智能体
 */
export function isGlobalAgent(agent: UnifiedAgent): boolean {
  return agent.source === "global";
}

// ============================================================================
// Agent Display Helpers
// ============================================================================

/**
 * 获取智能体来源标签
 */
export function getAgentSourceLabel(agent: UnifiedAgent): string {
  return agent.source === "workspace" ? "工作空间" : "全局";
}

/**
 * 获取智能体角色标签
 */
export function getAgentRoleLabel(agent: UnifiedAgent): string {
  return agent.role === "primary" ? "主智能体" : "子智能体";
}

/**
 * 获取智能体显示的简短名称
 */
export function getAgentDisplayName(agent: UnifiedAgent): string {
  return agent.name || "未命名智能体";
}

/**
 * 获取智能体图标颜色类
 */
export function getAgentColorClass(agent: UnifiedAgent): string {
  if (agent.role === "primary") {
    return "bg-primary/20 text-primary";
  }
  return "bg-muted text-muted-foreground";
}
