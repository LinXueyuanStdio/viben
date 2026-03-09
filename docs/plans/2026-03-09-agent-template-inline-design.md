# Agent 模板内联标记设计

> 日期: 2026-03-09
> 状态: 已完成
> 完成日期: 2026-03-10

**注意**: 本设计文档描述的功能已实现完成。保留此文档作为历史参考。

## 概述

将 agent 模板管理从独立的 `~/.viben/agent-templates/` 目录迁移到 AGENTS.md 内联标记方式。agent 通过 `isTemplate: true` 字段标记为模板，具有双重身份——既可正常运行，也可作为模板创建新 agent。

## 设计决策

| 决策点 | 选择 |
|-------|------|
| 模板 agent 能否运行 | 双重身份，既能运行也能作为模板 |
| 与旧系统关系 | 完全替代，移除 `agent-templates/` |
| 从模板创建时的配置处理 | 完整复制，新 agent 与模板无关联 |
| 工作区 agent 能否作为模板 | 可以，且支持提升为全局模板 |
| UI 展示方式 | 混合显示 + 徽章标记 |

## 数据模型变更

### AgentConfigFile 新增字段

```typescript
interface AgentConfigFile {
  // ... 现有字段
  isTemplate?: boolean;           // 是否为模板，默认 false
  templateDescription?: string;   // 模板描述，用于选择界面
}
```

### AGENTS.md 示例

```yaml
---
name: 代码审查助手
isTemplate: true
templateDescription: "用于代码审查的专业助手"
executorType: CLAUDE_CODE
model: claude-sonnet-4-5-20250514
temperature: 0.7
maxTokens: 4096
tools: []
mcpServers: []
skills: []
planMode: false
approvals: false
createdAt: 2026-03-09T00:00:00.000Z
updatedAt: 2026-03-09T00:00:00.000Z
---

你是一个专业的代码审查助手...
```

## AgentManager 变更

### 新增方法

```typescript
class AgentManager {
  // 列出所有模板（合并全局 + 当前工作区）
  async listTemplates(workspacePath?: string): Promise<Agent[]> {
    const globalAgents = await this.listGlobalAgents();
    const workspaceAgents = workspacePath
      ? await this.listWorkspaceAgents(workspacePath)
      : [];

    return [...globalAgents, ...workspaceAgents]
      .filter(agent => agent.config.isTemplate === true);
  }

  // 从模板创建新 agent（完整复制配置）
  async createFromTemplate(
    templateId: string,
    newAgentId: string,
    options: {
      name: string;
      basePath?: string;  // 全局或工作区
    }
  ): Promise<Agent>

  // 将工作区模板提升为全局模板
  async promoteToGlobal(
    workspacePath: string,
    agentId: string,
    newGlobalId?: string
  ): Promise<Agent>
}
```

### 查询规则

- 全局模板：对所有工作区可见
- 工作区模板：仅在该工作区内可见
- 列表按 `createdAt` 倒序排列

## 文件变更清单

### 删除

| 文件 | 说明 |
|-----|------|
| `packages/core/src/agents/templates.ts` | TemplateManager 类 |
| `packages/core/src/agents/templates.test.ts` | 对应测试 |

### 修改

| 文件 | 变更内容 |
|-----|---------|
| `packages/core/src/agents/index.ts` | 移除 templateManager 引用，新增模板方法 |
| `packages/core/src/agents/types.ts` | 新增 isTemplate、templateDescription 字段 |
| `packages/core/src/config/paths.ts` | 移除 getTemplatesDir 等函数 |
| `packages/core/src/gateway/routes/agents.ts` | 重写模板 API 路由 |
| `packages/core/src/cli/commands/agent.ts` | 重写 template 子命令 |
| `apps/desktop/src/lib/gateway/modules/agents-crud.ts` | 更新 client |
| `apps/desktop/src/pages/workspace-agents.tsx` | 更新 UI |

## Gateway API 变更

### 新 API

```typescript
// 列出模板（从现有 agent 中筛选 isTemplate=true）
GET /api/agent/templates?workspace_path=xxx
// 返回: { templates: Agent[], total: number }

// 从模板创建 agent
POST /api/agent
// Body: {
//   name: string,
//   agent_id: string,
//   from_template: string,    // 模板 agent 的 ID
//   base_path?: string        // 可选，指定工作区
// }

// 将工作区模板提升为全局
POST /api/agent/:id/promote
// Body: { new_id?: string }   // 可选，新的全局 ID

// 切换模板状态
PATCH /api/agent/:id
// Body: { is_template: boolean, template_description?: string }
```

### 移除的 API

| 旧 API | 替代方案 |
|-------|---------|
| `GET /api/agent/templates/:id` | `GET /api/agent/:id` |
| `POST /api/agent/templates` | `PATCH /api/agent/:id` |
| `POST /api/agent/templates/:id/instantiate` | `POST /api/agent` with `from_template` |

## CLI 命令变更

### 新命令

```bash
# 列出模板
viben agent list --templates
viben agent list --templates --workspace .  # 包含当前工作区模板

# 将现有 agent 标记为模板
viben agent update <agent-id> --is-template true
viben agent update <agent-id> --is-template true --template-desc "描述"

# 取消模板标记
viben agent update <agent-id> --is-template false

# 从模板创建新 agent
viben agent create <name> --from-template <template-agent-id>
viben agent create <name> --from-template <template-agent-id> --workspace .

# 提升工作区模板为全局
viben agent promote <agent-id> [--new-id <new-global-id>]
```

### 移除的命令

| 旧命令 | 替代方案 |
|-------|---------|
| `viben agent template list` | `viben agent list --templates` |
| `viben agent template create` | `viben agent update --is-template true` |
| `viben agent template show` | `viben agent show` |
| `viben agent template remove` | `viben agent update --is-template false` |

## 前端 UI 变更

### Agent 列表页

- 模板 agent 显示徽章标记（如 "模板" 标签）
- agent 卡片/行增加"设为模板"/"取消模板"的操作菜单项
- 工作区模板显示"提升为全局"操作

### 创建 Agent 对话框

```
┌─────────────────────────────────────────┐
│ 创建新智能体                              │
├─────────────────────────────────────────┤
│ 名称: [________________]                 │
│ 描述: [________________]                 │
│                                         │
│ ☐ 从模板创建                             │
│   ┌─────────────────────────────────┐   │
│   │ 🏷️ 代码审查助手 (全局)            │   │
│   │    用于代码审查的专业助手          │   │
│   │ 🏷️ 项目规划器 (工作区)            │   │
│   │    项目任务分解和规划             │   │
│   └─────────────────────────────────┘   │
│                                         │
│ 位置: ○ 全局  ● 当前工作区               │
│                                         │
│           [取消]  [创建]                 │
└─────────────────────────────────────────┘
```

### Agent 详情/编辑页

- 新增"模板设置"区域
- 可切换 `isTemplate` 开关
- 可编辑 `templateDescription`

## 数据迁移

- 不自动迁移 `~/.viben/agent-templates/` 中的旧模板
- 首次运行时提示用户手动将重要模板转换为 agent 并标记 `isTemplate: true`
- 保留旧目录一段时间，不主动删除

## 实现顺序

1. **类型定义** - 更新 `types.ts` 新增字段
2. **AgentManager** - 实现 `listTemplates`、`createFromTemplate`、`promoteToGlobal`
3. **移除旧代码** - 删除 `templates.ts` 及相关引用
4. **Gateway API** - 更新路由
5. **CLI 命令** - 更新 agent 命令
6. **前端 UI** - 更新列表页和创建对话框
7. **测试** - 更新相关测试用例
