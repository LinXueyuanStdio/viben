# Agent Detail 页面重构设计

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 重构 agent-detail 页面为双 Tab 布局，增强调试能力，新增模板功能和变量系统。

**Architecture:**
- 将三列布局改为【调试】【设置】双 Tab
- 调试 Tab 复用 chat-monitor.tsx 的 trace 组件
- 设置 Tab 使用左侧导航 + 右侧内容的 VSCode 风格布局
- 模板功能使用 `is_template` 原地标记
- 变量系统支持预定义、自定义、环境变量三种类型

**Tech Stack:** React, TypeScript, shadcn/ui, Tailwind CSS, OpenTelemetry

---

## 概述

重构 `agent-detail.tsx` 页面，从三列布局改为双 Tab 布局，增强调试能力，新增模板功能和变量系统。

## 需求总结

| 功能 | 方案 |
|------|------|
| 模板功能 | 原地标记 `isTemplate: true`，支持设置/取消 |
| 变量系统 | 预定义变量 + 用户自定义变量 + 环境变量 |
| 页面布局 | 2 Tab：【调试】【设置】 |
| 调试 Tab | 左侧对话 + 右侧 trace 面板（调用树/时序图） |
| 设置 Tab | 左侧导航菜单 + 右侧配置内容 |
| Trace 数据 | 复用 OpenTelemetry + Chat Monitor 组件 |

## 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│  Header: Agent Name / Template Badge / Save Button          │
├─────────────────────────────────────────────────────────────┤
│  [调试]  [设置]                                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Tab 内容区域                                                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Header 内容**：
- 返回按钮
- 智能体头像 + 名称编辑
- 模板 Badge（如果是模板）
- 作用域指示器（全局/工作区）
- 执行器类型 Badge
- 「设为模板」按钮 / 模板下拉菜单
- 保存按钮

---

## 调试 Tab 设计

### 布局

```
┌────────────────────────────────────────────────────────────────┐
│ [调试]  [设置]                                                  │
├──────────────────────────┬─────────────────────────────────────┤
│                          │ Trace ID: abc123  [复制]            │
│      对话区域             │ Session ID: sess_456  [复制]        │
│                          ├─────────────────────────────────────┤
│  ┌────────────────────┐  │ [调用树]  [时序图]                   │
│  │ User: ...          │  ├─────────────────────────────────────┤
│  │ Assistant: ...     │  │                                     │
│  │ ...                │  │   Trace 可视化内容                   │
│  └────────────────────┘  │   (复用 Chat Monitor 组件)           │
│                          │                                     │
│  ┌────────────────────┐  │                                     │
│  │ 输入框             │  │                                     │
│  └────────────────────┘  │                                     │
├──────────────────────────┴─────────────────────────────────────┤
│  状态栏: Token Usage / 耗时 / 模型名称                          │
└────────────────────────────────────────────────────────────────┘
```

### 左侧对话区

- 复用现有 `MessageList` + `ChatInput` 组件
- 保留 slash commands 支持
- 宽度可调整（拖拽分隔线）

### 右侧 Trace 面板

- **顶部元信息**：
  - Trace ID（可复制）
  - Session ID（可复制）

- **Tab 切换**：
  - 调用树：复用 `SpanNode` 组件（来自 chat-monitor.tsx）
  - 时序图：复用 `TimelineView` 组件（来自 chat-monitor.tsx）

- **无 Trace 时**：显示空状态提示「发送消息后将显示调用链路」

### 状态栏

- Token 用量：`Input: 1,234 / Output: 567`
- 响应时间：`耗时: 2.3s`
- 当前模型：`claude-sonnet-4-5-20250514`

---

## 设置 Tab 设计

### 布局

```
┌────────────────────────────────────────────────────────────────┐
│ [调试]  [设置]                                                  │
├────────────┬───────────────────────────────────────────────────┤
│            │                                                   │
│  导航菜单   │              配置内容区（可滚动）                   │
│            │                                                   │
│  ┌───────┐ │  ┌─────────────────────────────────────────────┐  │
│  │ 概览  │ │  │ ┌─ 提示词 ─────────────────────────────┐    │  │
│  │ 配置  │ │  │ │ 系统提示词 / 追加提示词               │    │  │
│  │       │ │  │ └──────────────────────────────────────┘    │  │
│  │       │ │  │ ┌─ 模型 ───────────────────────────────┐    │  │
│  │       │ │  │ │ 模型选择 / Temperature / 执行器      │    │  │
│  │       │ │  │ └──────────────────────────────────────┘    │  │
│  │       │ │  │ ┌─ 能力 ───────────────────────────────┐    │  │
│  │       │ │  │ │ MCP Servers / Skills                │    │  │
│  │       │ │  │ └──────────────────────────────────────┘    │  │
│  │       │ │  │ ┌─ 记忆 ───────────────────────────────┐    │  │
│  │       │ │  │ │ MEMORY.md / 日志文件                 │    │  │
│  │       │ │  │ └──────────────────────────────────────┘    │  │
│  │       │ │  │ ┌─ 变量 ───────────────────────────────┐    │  │
│  │       │ │  │ │ 预定义 / 自定义 / 环境变量           │    │  │
│  │       │ │  │ └──────────────────────────────────────┘    │  │
│  └───────┘ │  └─────────────────────────────────────────────┘  │
│            │                                                   │
└────────────┴───────────────────────────────────────────────────┘
```

### 导航菜单（约 160px 宽）

| 菜单项 | 行为 |
|--------|------|
| **概览** | 显示概览页面 |
| **配置** | 显示配置页面，点击后右侧滚动到顶部 |

点击「配置」菜单项时，可展开显示子项（提示词、模型、能力、记忆、变量），点击子项滚动到对应 section。

### 概览页面

```
┌─ 基本信息 ─────────────────────────────────────────────┐
│                                                       │
│  名称                                                 │
│  ┌─────────────────────────────────────────────────┐  │
│  │ Code Reviewer                                   │  │
│  └─────────────────────────────────────────────────┘  │
│                                                       │
│  描述                                                 │
│  ┌─────────────────────────────────────────────────┐  │
│  │ 用于代码审查的智能体                              │  │
│  └─────────────────────────────────────────────────┘  │
│                                                       │
└───────────────────────────────────────────────────────┘

┌─ 模板设置 ─────────────────────────────────────────────┐
│                                                       │
│  [✓] 设为模板                                         │
│                                                       │
│  模板说明                                             │
│  ┌─────────────────────────────────────────────────┐  │
│  │ 用于代码审查的智能体模板，支持多种语言           │  │
│  └─────────────────────────────────────────────────┘  │
│                                                       │
│  标签                                                 │
│  [code-review] [best-practices] [+ 添加]              │
│                                                       │
└───────────────────────────────────────────────────────┘

┌─ 存储位置 ─────────────────────────────────────────────┐
│                                                       │
│  作用域        [全局] / [工作区]                       │
│                                                       │
│  Agent 目录                                           │
│  ~/.viben/agents/code-reviewer/          [打开] [复制] │
│                                                       │
│  配置文件                                             │
│  ~/.viben/agents/code-reviewer/AGENTS.md [打开] [复制] │
│                                                       │
└───────────────────────────────────────────────────────┘
```

### 配置页面 Sections

#### 提示词 Section

```
┌─ 提示词 ───────────────────────────────────────────────┐
│                                                       │
│  系统提示词                              字数: 1,234   │
│  ┌─────────────────────────────────────────────────┐  │
│  │ You are a code reviewer...                      │  │
│  │ 支持 {{variable}} 语法                          │  │
│  │                                                 │  │
│  └─────────────────────────────────────────────────┘  │
│                                                       │
│  追加提示词                              字数: 56     │
│  ┌─────────────────────────────────────────────────┐  │
│  │ Always respond in Chinese.                      │  │
│  └─────────────────────────────────────────────────┘  │
│  提示：追加提示词会附加到每次对话的末尾                │
│                                                       │
└───────────────────────────────────────────────────────┘
```

#### 模型 Section

```
┌─ 模型 ─────────────────────────────────────────────────┐
│                                                       │
│  模型选择                                             │
│  ┌─────────────────────────────────────────────────┐  │
│  │ claude-sonnet-4-5-20250514                 ▾    │  │
│  └─────────────────────────────────────────────────┘  │
│                                                       │
│  Temperature                                    0.70  │
│  ──────────────●────────────────────────────────────  │
│                                                       │
│  执行器                                               │
│  ┌─────────────────────────────────────────────────┐  │
│  │ Claude Code                                ▾    │  │
│  └─────────────────────────────────────────────────┘  │
│  [检查可用性]  ✓ 已登录                               │
│                                                       │
│  ┌─ Claude Code 选项 ─────────────────────────────┐   │
│  │ [ ] Plan Mode    [ ] Approvals                │   │
│  └────────────────────────────────────────────────┘   │
│                                                       │
└───────────────────────────────────────────────────────┘
```

#### 能力 Section

```
┌─ 能力 ─────────────────────────────────────────────────┐
│                                                       │
│  MCP Servers                            [配置]        │
│  ┌─────────────────────────────────────────────────┐  │
│  │ [filesystem] [github] [sqlite]                 │  │
│  └─────────────────────────────────────────────────┘  │
│                                                       │
│  Skills                                 [配置]        │
│  ┌─────────────────────────────────────────────────┐  │
│  │ [code-review] [testing]                        │  │
│  └─────────────────────────────────────────────────┘  │
│                                                       │
└───────────────────────────────────────────────────────┘
```

#### 记忆 Section

```
┌─ 记忆 ─────────────────────────────────────────────────┐
│                                                       │
│  MEMORY.md                              [编辑]        │
│  智能体的长期记忆文件，用于存储偏好和上下文            │
│                                                       │
│  今日日志                               [查看]        │
│  暂无今日日志                                         │
│                                                       │
│  昨日日志                               [查看]        │
│  暂无昨日日志                                         │
│                                                       │
└───────────────────────────────────────────────────────┘
```

#### 变量 Section

```
┌─ 变量 ─────────────────────────────────────────────────┐
│                                                       │
│  预定义变量                         [查看全部]         │
│  ┌─────────────────────────────────────────────────┐  │
│  │ {{workspace_name}}  →  viben                   │  │
│  │ {{current_date}}    →  2026-03-09              │  │
│  └─────────────────────────────────────────────────┘  │
│                                                       │
│  自定义变量                         [+ 添加]          │
│  ┌─────────────────────────────────────────────────┐  │
│  │ {{custom.project_type}}   默认值: web    [删除] │  │
│  │ {{custom.author}}         默认值: -      [删除] │  │
│  └─────────────────────────────────────────────────┘  │
│                                                       │
│  环境变量引用                       [+ 添加]          │
│  ┌─────────────────────────────────────────────────┐  │
│  │ {{env.OPENAI_API_KEY}}   状态: ✓ 已设置        │  │
│  │ {{env.GITHUB_TOKEN}}     状态: ✗ 未设置        │  │
│  └─────────────────────────────────────────────────┘  │
│                                                       │
└───────────────────────────────────────────────────────┘
```

---

## 变量系统设计

### 变量语法

统一使用 `{{variable_name}}` 格式，在系统提示词和追加提示词中使用。

### 三种变量类型

| 类型 | 格式 | 示例 | 解析时机 |
|------|------|------|----------|
| 预定义变量 | `{{name}}` | `{{workspace_name}}`, `{{current_date}}` | 运行时自动替换 |
| 环境变量 | `{{env.NAME}}` | `{{env.API_KEY}}`, `{{env.USER}}` | 运行时从环境读取 |
| 自定义变量 | `{{custom.name}}` | `{{custom.project_type}}` | 运行时弹窗输入 |

### 预定义变量列表

| 变量名 | 说明 |
|--------|------|
| `{{workspace_name}}` | 当前工作区名称 |
| `{{workspace_path}}` | 当前工作区路径 |
| `{{agent_name}}` | 智能体名称 |
| `{{current_date}}` | 当前日期 (YYYY-MM-DD) |
| `{{current_time}}` | 当前时间 (HH:mm:ss) |
| `{{current_datetime}}` | 当前日期时间 (ISO 8601) |
| `{{os_platform}}` | 操作系统 (darwin/linux/win32) |
| `{{user_home}}` | 用户主目录 |

### 数据结构

在 `AGENTS.md` frontmatter 中存储自定义变量：

```yaml
---
name: Code Reviewer
custom_variables:
  - name: project_type
    default_value: web
    description: 项目类型
  - name: author
    default_value: ""
    description: 作者名称
env_variables:
  - OPENAI_API_KEY
  - GITHUB_TOKEN
# ... 其他字段
---
```

### 变量解析流程

1. 用户发送消息
2. 从 `AGENTS.md` 读取 system_prompt 和 append_prompt
3. 扫描 `{{...}}` 模式
4. 替换预定义变量（自动）
5. 替换环境变量（从 process.env 或 .env 读取）
6. 如有自定义变量且无默认值或需要确认，弹窗让用户输入
7. 替换自定义变量
8. 发送给 LLM

---

## 模板功能设计

### 数据结构

在 `AGENTS.md` frontmatter 中新增字段：

```yaml
---
name: Code Reviewer
is_template: true
template_description: "用于代码审查的智能体模板，支持多种语言"
template_tags: ["code-review", "best-practices"]
# ... 其他现有字段
---
```

### UI 交互

#### Header 区域

```
非模板状态：
┌─────────────────────────────────────────────────────────────┐
│  [←]  🤖 Code Reviewer  [Workspace]  [Claude Code]          │
│                                            [设为模板] [保存] │
└─────────────────────────────────────────────────────────────┘

模板状态：
┌─────────────────────────────────────────────────────────────┐
│  [←]  🤖 Code Reviewer  [模板]  [Workspace]  [Claude Code]  │
│                                         [模板 ▾]    [保存]  │
└─────────────────────────────────────────────────────────────┘
```

模板下拉菜单选项：
- 编辑模板信息
- 取消模板

#### 概览页面模板区域

见上方「概览页面」设计。

### 从模板创建智能体

在 `workspace-agents.tsx` 智能体列表页面：

1. 点击「创建智能体」按钮
2. 显示创建对话框，包含选项：
   - 空白创建
   - 从模板创建（列出所有 `is_template: true` 的智能体）
3. 选择模板后：
   - 复制模板的整个 agentDir 目录
   - 生成新的 agentDir（基于新智能体名称或随机 ID）
   - 清除 `is_template` 标记
   - 跳转到新智能体的详情页

**注意**：Agent 没有独立的 ID 概念，agentDir 的目录名即为智能体标识。

---

## 组件复用

### 来自 Chat Monitor 的组件

路径：`apps/desktop/src/pages/chat-monitor.tsx`

- `SpanNode` - 调用树节点组件
- `TimelineView` - 时序图组件
- `SpanDetailPanel` - Span 详情面板

### 需要新建的组件

```
apps/desktop/src/components/agent/
├── agent-debug-tab.tsx        # 调试 Tab 容器
├── agent-settings-tab.tsx     # 设置 Tab 容器
├── agent-overview-panel.tsx   # 概览面板
├── agent-config-panel.tsx     # 配置面板（滚动定位）
├── agent-variables-section.tsx # 变量 Section
├── agent-template-section.tsx  # 模板设置 Section
└── variable-input-dialog.tsx   # 自定义变量输入弹窗
```

### 需要修改的文件

- `apps/desktop/src/pages/agent-detail.tsx` - 主页面重构
- `packages/core/src/agents/types.ts` - 添加模板和变量字段
- `packages/core/src/agents/agent-manager.ts` - 添加模板相关方法
- `packages/core/src/agents/variable-resolver.ts` - 新建变量解析器

---

## 实现步骤

### Phase 1: 布局重构
1. 将三列布局改为 Tab 布局
2. 实现【调试】Tab 基础结构
3. 实现【设置】Tab 基础结构（左侧导航 + 右侧内容）

### Phase 2: 设置 Tab 完善
1. 实现概览页面
2. 实现配置页面（滚动定位）
3. 迁移现有配置项到新结构

### Phase 3: 调试 Tab 完善
1. 集成 Chat Monitor 的 trace 组件
2. 实现 Trace ID / Session ID 显示
3. 实现状态栏

### Phase 4: 模板功能
1. 添加数据结构字段
2. 实现模板设置 UI
3. 实现从模板创建功能

### Phase 5: 变量系统
1. 实现变量解析器
2. 实现变量 Section UI
3. 实现运行时变量输入弹窗

---

## 注意事项

1. **向后兼容**：现有的 `AGENTS.md` 文件应能正常加载，新字段使用默认值
2. **性能**：Trace 数据量可能较大，考虑虚拟滚动
3. **响应式**：Tab 内容区域需要适配不同窗口大小
4. **国际化**：所有新增文本需要添加 i18n key

---

## 详细实现计划

### Task 1: 提取 Trace 可视化组件

从 `chat-monitor.tsx` 提取可复用的 trace 组件到独立文件。

**Files:**
- Create: `apps/desktop/src/components/observability/index.ts`
- Create: `apps/desktop/src/components/observability/types.ts`
- Create: `apps/desktop/src/components/observability/span-node.tsx`
- Create: `apps/desktop/src/components/observability/timeline-view.tsx`
- Create: `apps/desktop/src/components/observability/span-detail-panel.tsx`
- Create: `apps/desktop/src/components/observability/utils.ts`
- Modify: `apps/desktop/src/pages/chat-monitor.tsx` - 改为从新位置导入

**Step 1: 创建类型定义文件**

创建 `apps/desktop/src/components/observability/types.ts`，包含：
- `TraceSpan` interface
- `TraceSpanNode` interface
- `TraceTree` interface
- `TraceEvent` interface

**Step 2: 创建工具函数文件**

创建 `apps/desktop/src/components/observability/utils.ts`，包含：
- `getSpanKindIcon()` - span 类型图标
- `hasDetailData()` - 检查是否有详情数据
- `formatDuration()` - 格式化耗时
- `buildTraceTree()` - 构建 trace 树

**Step 3: 提取 SpanNode 组件**

创建 `apps/desktop/src/components/observability/span-node.tsx`

**Step 4: 提取 TimelineView 组件**

创建 `apps/desktop/src/components/observability/timeline-view.tsx`

**Step 5: 提取 SpanDetailPanel 组件**

创建 `apps/desktop/src/components/observability/span-detail-panel.tsx`

**Step 6: 创建导出文件**

创建 `apps/desktop/src/components/observability/index.ts`

**Step 7: 更新 chat-monitor.tsx**

修改 `apps/desktop/src/pages/chat-monitor.tsx` 改为从 `@/components/observability` 导入

**Step 8: 验证**

运行 `pnpm --filter @viben/desktop typecheck` 确保无类型错误

**Step 9: Commit**

```bash
git add apps/desktop/src/components/observability/ apps/desktop/src/pages/chat-monitor.tsx
git commit -m "refactor: extract trace visualization components from chat-monitor"
```

---

### Task 2: 更新 Agent 类型定义

添加模板标签和变量系统相关字段。

**Files:**
- Modify: `packages/core/src/types/index.ts:147-200` - 添加新字段到 Agent interface
- Modify: `packages/core/src/agents/types.ts` - 添加新字段到 AgentConfigFile interface

**Step 1: 更新 Agent interface**

在 `packages/core/src/types/index.ts` 的 `Agent` interface 中添加：

```typescript
/** Template tags for categorization */
templateTags?: string[];
/** Custom variables with default values */
customVariables?: CustomVariable[];
/** Environment variable references */
envVariables?: string[];
```

**Step 2: 添加 CustomVariable 类型**

```typescript
export interface CustomVariable {
  name: string;
  defaultValue?: string;
  description?: string;
}
```

**Step 3: 更新 AgentConfig interface**

同样添加新字段到 `AgentConfig` interface

**Step 4: 更新 AgentConfigFile**

在 `packages/core/src/agents/types.ts` 添加对应字段

**Step 5: 验证**

运行 `pnpm --filter @viben/core typecheck`

**Step 6: Commit**

```bash
git add packages/core/src/types/index.ts packages/core/src/agents/types.ts
git commit -m "feat(core): add template_tags, custom_variables, env_variables to Agent type"
```

---

### Task 3: 实现变量解析器

创建变量解析器处理三种变量类型。

**Files:**
- Create: `packages/core/src/agents/variable-resolver.ts`
- Create: `packages/core/src/agents/variable-resolver.test.ts`

**Step 1: 编写测试**

创建 `packages/core/src/agents/variable-resolver.test.ts`：

```typescript
import { describe, it, expect } from 'vitest';
import { resolveVariables, extractVariables } from './variable-resolver';

describe('extractVariables', () => {
  it('should extract predefined variables', () => {
    const result = extractVariables('Hello {{workspace_name}}');
    expect(result.predefined).toContain('workspace_name');
  });

  it('should extract env variables', () => {
    const result = extractVariables('Key: {{env.API_KEY}}');
    expect(result.env).toContain('API_KEY');
  });

  it('should extract custom variables', () => {
    const result = extractVariables('Type: {{custom.project_type}}');
    expect(result.custom).toContain('project_type');
  });
});

describe('resolveVariables', () => {
  it('should resolve predefined variables', () => {
    const result = resolveVariables('Date: {{current_date}}', {
      workspace: { name: 'test', path: '/test' },
    });
    expect(result.resolved).toMatch(/Date: \d{4}-\d{2}-\d{2}/);
  });
});
```

**Step 2: 运行测试验证失败**

```bash
pnpm --filter @viben/core test variable-resolver
```
Expected: FAIL

**Step 3: 实现变量解析器**

创建 `packages/core/src/agents/variable-resolver.ts`：

```typescript
export interface VariableContext {
  workspace?: { name: string; path: string };
  agent?: { name: string };
  customValues?: Record<string, string>;
}

export interface ExtractedVariables {
  predefined: string[];
  env: string[];
  custom: string[];
}

const VARIABLE_REGEX = /\{\{([^}]+)\}\}/g;

const PREDEFINED_VARIABLES = [
  'workspace_name', 'workspace_path', 'agent_name',
  'current_date', 'current_time', 'current_datetime',
  'os_platform', 'user_home'
];

export function extractVariables(text: string): ExtractedVariables {
  const predefined: string[] = [];
  const env: string[] = [];
  const custom: string[] = [];

  let match;
  while ((match = VARIABLE_REGEX.exec(text)) !== null) {
    const varName = match[1].trim();
    if (varName.startsWith('env.')) {
      env.push(varName.slice(4));
    } else if (varName.startsWith('custom.')) {
      custom.push(varName.slice(7));
    } else if (PREDEFINED_VARIABLES.includes(varName)) {
      predefined.push(varName);
    }
  }

  return { predefined, env, custom };
}

export function resolveVariables(
  text: string,
  context: VariableContext
): { resolved: string; unresolvedCustom: string[] } {
  const unresolvedCustom: string[] = [];

  const resolved = text.replace(VARIABLE_REGEX, (match, varName) => {
    const name = varName.trim();

    // Predefined variables
    if (name === 'workspace_name') return context.workspace?.name || '';
    if (name === 'workspace_path') return context.workspace?.path || '';
    if (name === 'agent_name') return context.agent?.name || '';
    if (name === 'current_date') return new Date().toISOString().split('T')[0];
    if (name === 'current_time') return new Date().toTimeString().split(' ')[0];
    if (name === 'current_datetime') return new Date().toISOString();
    if (name === 'os_platform') return process.platform;
    if (name === 'user_home') return process.env.HOME || process.env.USERPROFILE || '';

    // Environment variables
    if (name.startsWith('env.')) {
      const envName = name.slice(4);
      return process.env[envName] || '';
    }

    // Custom variables
    if (name.startsWith('custom.')) {
      const customName = name.slice(7);
      if (context.customValues?.[customName] !== undefined) {
        return context.customValues[customName];
      }
      unresolvedCustom.push(customName);
      return match; // Keep original if unresolved
    }

    return match;
  });

  return { resolved, unresolvedCustom };
}
```

**Step 4: 运行测试验证通过**

```bash
pnpm --filter @viben/core test variable-resolver
```
Expected: PASS

**Step 5: 导出变量解析器**

在 `packages/core/src/agents/index.ts` 中添加导出

**Step 6: Commit**

```bash
git add packages/core/src/agents/variable-resolver.ts packages/core/src/agents/variable-resolver.test.ts packages/core/src/agents/index.ts
git commit -m "feat(core): add variable resolver for template variables"
```

---

### Task 4: 创建设置 Tab 组件 - 概览面板

**Files:**
- Create: `apps/desktop/src/components/agent/agent-overview-panel.tsx`

**Step 1: 创建概览面板组件**

```typescript
// apps/desktop/src/components/agent/agent-overview-panel.tsx
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Check, ExternalLink, X, Plus } from "lucide-react";

interface AgentOverviewPanelProps {
  name: string;
  description: string;
  isTemplate: boolean;
  templateDescription: string;
  templateTags: string[];
  agentDir: string;
  configPath: string;
  isWorkspaceScoped: boolean;
  onNameChange: (name: string) => void;
  onDescriptionChange: (description: string) => void;
  onIsTemplateChange: (isTemplate: boolean) => void;
  onTemplateDescriptionChange: (description: string) => void;
  onTemplateTagsChange: (tags: string[]) => void;
  onOpenFolder: () => void;
  onCopyPath: (path: string) => void;
}

export function AgentOverviewPanel({
  name,
  description,
  isTemplate,
  templateDescription,
  templateTags,
  agentDir,
  configPath,
  isWorkspaceScoped,
  onNameChange,
  onDescriptionChange,
  onIsTemplateChange,
  onTemplateDescriptionChange,
  onTemplateTagsChange,
  onOpenFolder,
  onCopyPath,
}: AgentOverviewPanelProps) {
  const { t } = useTranslation();
  const [copiedPath, setCopiedPath] = React.useState<string | null>(null);
  const [newTag, setNewTag] = React.useState("");

  const handleCopyPath = (path: string) => {
    onCopyPath(path);
    setCopiedPath(path);
    setTimeout(() => setCopiedPath(null), 2000);
  };

  const handleAddTag = () => {
    if (newTag.trim() && !templateTags.includes(newTag.trim())) {
      onTemplateTagsChange([...templateTags, newTag.trim()]);
      setNewTag("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    onTemplateTagsChange(templateTags.filter(t => t !== tag));
  };

  return (
    <div className="space-y-6 p-4">
      {/* Basic Info Section */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold">{t("agentDetail.basicInfo")}</h3>

        <div className="space-y-2">
          <Label>{t("agentDetail.name")}</Label>
          <Input
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder={t("agentDetail.namePlaceholder")}
          />
        </div>

        <div className="space-y-2">
          <Label>{t("agentDetail.description")}</Label>
          <Textarea
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder={t("agentDetail.descriptionPlaceholder")}
            rows={3}
          />
        </div>
      </section>

      {/* Template Section */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold">{t("agentDetail.templateSettings")}</h3>

        <div className="flex items-center justify-between">
          <Label>{t("agentDetail.setAsTemplate")}</Label>
          <Switch checked={isTemplate} onCheckedChange={onIsTemplateChange} />
        </div>

        {isTemplate && (
          <>
            <div className="space-y-2">
              <Label>{t("agentDetail.templateDescription")}</Label>
              <Textarea
                value={templateDescription}
                onChange={(e) => onTemplateDescriptionChange(e.target.value)}
                placeholder={t("agentDetail.templateDescriptionPlaceholder")}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>{t("agentDetail.templateTags")}</Label>
              <div className="flex flex-wrap gap-2">
                {templateTags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    {tag}
                    <button onClick={() => handleRemoveTag(tag)}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                <div className="flex items-center gap-1">
                  <Input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddTag()}
                    placeholder={t("agentDetail.addTag")}
                    className="h-6 w-24 text-xs"
                  />
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleAddTag}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Storage Section */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold">{t("agentDetail.storageLocation")}</h3>

        <div className="space-y-2">
          <Label>{t("agentDetail.scope")}</Label>
          <Badge variant={isWorkspaceScoped ? "default" : "secondary"}>
            {isWorkspaceScoped ? t("agentDetail.workspaceScoped") : t("agentDetail.globalScoped")}
          </Badge>
        </div>

        <div className="space-y-2">
          <Label>{t("agentDetail.agentDir")}</Label>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-muted px-2 py-1.5 rounded truncate">
              {agentDir}
            </code>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onOpenFolder}>
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleCopyPath(agentDir)}>
              {copiedPath === agentDir ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label>{t("agentDetail.configFile")}</Label>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-muted px-2 py-1.5 rounded truncate">
              {configPath}
            </code>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleCopyPath(configPath)}>
              {copiedPath === configPath ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
```

**Step 2: 验证类型**

```bash
pnpm --filter @viben/desktop typecheck
```

**Step 3: Commit**

```bash
git add apps/desktop/src/components/agent/agent-overview-panel.tsx
git commit -m "feat(desktop): add AgentOverviewPanel component for settings tab"
```

---

### Task 5: 创建设置 Tab 组件 - 配置面板

**Files:**
- Create: `apps/desktop/src/components/agent/agent-config-panel.tsx`

**Step 1: 创建配置面板组件**

包含 5 个 section：提示词、模型、能力、记忆、变量。
支持滚动定位功能。

（详细代码见实现）

**Step 2: 验证类型**

```bash
pnpm --filter @viben/desktop typecheck
```

**Step 3: Commit**

```bash
git add apps/desktop/src/components/agent/agent-config-panel.tsx
git commit -m "feat(desktop): add AgentConfigPanel component with scroll-to-section"
```

---

### Task 6: 创建变量 Section 组件

**Files:**
- Create: `apps/desktop/src/components/agent/agent-variables-section.tsx`

**Step 1: 创建变量 Section 组件**

显示预定义变量、自定义变量、环境变量引用。

**Step 2: 验证类型**

```bash
pnpm --filter @viben/desktop typecheck
```

**Step 3: Commit**

```bash
git add apps/desktop/src/components/agent/agent-variables-section.tsx
git commit -m "feat(desktop): add AgentVariablesSection component"
```

---

### Task 7: 创建调试 Tab 组件

**Files:**
- Create: `apps/desktop/src/components/agent/agent-debug-tab.tsx`

**Step 1: 创建调试 Tab 组件**

左侧对话区域 + 右侧 trace 面板。
复用 MessageList、ChatInput、SpanNode、TimelineView 组件。

**Step 2: 验证类型**

```bash
pnpm --filter @viben/desktop typecheck
```

**Step 3: Commit**

```bash
git add apps/desktop/src/components/agent/agent-debug-tab.tsx
git commit -m "feat(desktop): add AgentDebugTab component with trace visualization"
```

---

### Task 8: 创建设置 Tab 组件

**Files:**
- Create: `apps/desktop/src/components/agent/agent-settings-tab.tsx`

**Step 1: 创建设置 Tab 组件**

左侧导航菜单 + 右侧内容（概览/配置）。
支持点击导航滚动定位。

**Step 2: 验证类型**

```bash
pnpm --filter @viben/desktop typecheck
```

**Step 3: Commit**

```bash
git add apps/desktop/src/components/agent/agent-settings-tab.tsx
git commit -m "feat(desktop): add AgentSettingsTab component with nav menu"
```

---

### Task 9: 重构 agent-detail.tsx 主页面

**Files:**
- Modify: `apps/desktop/src/pages/agent-detail.tsx`

**Step 1: 重构为双 Tab 布局**

- 保留 Header 区域
- 添加 Tab 切换（调试/设置）
- 集成 AgentDebugTab 和 AgentSettingsTab

**Step 2: 添加模板按钮到 Header**

根据 `is_template` 状态显示「设为模板」按钮或模板下拉菜单。

**Step 3: 验证类型**

```bash
pnpm --filter @viben/desktop typecheck
```

**Step 4: 测试**

启动 desktop app，验证：
1. Tab 切换正常
2. 设置 Tab 导航和滚动定位正常
3. 调试 Tab 对话和 trace 显示正常

**Step 5: Commit**

```bash
git add apps/desktop/src/pages/agent-detail.tsx
git commit -m "refactor(desktop): restructure agent-detail page with debug/settings tabs"
```

---

### Task 10: 更新组件导出

**Files:**
- Modify: `apps/desktop/src/components/agent/index.ts`

**Step 1: 导出新组件**

```typescript
export * from "./agent-overview-panel";
export * from "./agent-config-panel";
export * from "./agent-variables-section";
export * from "./agent-debug-tab";
export * from "./agent-settings-tab";
```

**Step 2: Commit**

```bash
git add apps/desktop/src/components/agent/index.ts
git commit -m "feat(desktop): export new agent detail components"
```

---

### Task 11: 添加 i18n 翻译

**Files:**
- Modify: `apps/desktop/src/i18n/locales/en.json`
- Modify: `apps/desktop/src/i18n/locales/zh-CN.json`

**Step 1: 添加英文翻译**

```json
{
  "agentDetail": {
    "debugTab": "Debug",
    "settingsTab": "Settings",
    "overview": "Overview",
    "configuration": "Configuration",
    "basicInfo": "Basic Information",
    "templateSettings": "Template Settings",
    "storageLocation": "Storage Location",
    "setAsTemplate": "Set as Template",
    "templateDescription": "Template Description",
    "templateTags": "Tags",
    "agentDir": "Agent Directory",
    "configFile": "Configuration File",
    "scope": "Scope",
    "variables": "Variables",
    "predefinedVariables": "Predefined Variables",
    "customVariables": "Custom Variables",
    "envVariables": "Environment Variables",
    "traceId": "Trace ID",
    "sessionId": "Session ID",
    "callTree": "Call Tree",
    "timeline": "Timeline",
    "noTraceYet": "Send a message to see the call trace"
  }
}
```

**Step 2: 添加中文翻译**

```json
{
  "agentDetail": {
    "debugTab": "调试",
    "settingsTab": "设置",
    "overview": "概览",
    "configuration": "配置",
    "basicInfo": "基本信息",
    "templateSettings": "模板设置",
    "storageLocation": "存储位置",
    "setAsTemplate": "设为模板",
    "templateDescription": "模板说明",
    "templateTags": "标签",
    "agentDir": "Agent 目录",
    "configFile": "配置文件",
    "scope": "作用域",
    "variables": "变量",
    "predefinedVariables": "预定义变量",
    "customVariables": "自定义变量",
    "envVariables": "环境变量引用",
    "traceId": "Trace ID",
    "sessionId": "Session ID",
    "callTree": "调用树",
    "timeline": "时序图",
    "noTraceYet": "发送消息后将显示调用链路"
  }
}
```

**Step 3: Commit**

```bash
git add apps/desktop/src/i18n/locales/
git commit -m "feat(desktop): add i18n translations for agent detail redesign"
```

---

### Task 12: 全量测试和修复

**Step 1: 构建检查**

```bash
pnpm build
```

**Step 2: 类型检查**

```bash
pnpm typecheck
```

**Step 3: 启动 Desktop App 测试**

```bash
pnpm desktop:restart
```

**Step 4: 功能测试清单**

- [ ] 调试 Tab：对话功能正常
- [ ] 调试 Tab：trace 可视化显示正常
- [ ] 调试 Tab：Trace ID / Session ID 可复制
- [ ] 设置 Tab：概览页面显示正常
- [ ] 设置 Tab：配置页面滚动定位正常
- [ ] 设置 Tab：模板设置开关正常
- [ ] 设置 Tab：变量显示和编辑正常
- [ ] Header：模板 Badge 显示正常
- [ ] Header：保存按钮功能正常

**Step 5: 修复发现的问题**

**Step 6: Final Commit**

```bash
git add -A
git commit -m "fix(desktop): address issues found during agent-detail testing"
```
