# 智能体编排设置页面 Bug 修复与重设计

## 概述

修复 desktop 智能体编排设置页面的三个问题：
1. 执行器配置中审批模式应为单选（非布尔开关），移除 plan mode
2. MCP 服务器配置弹窗完全重写，嵌入内联编辑器 + 市场页面
3. Skill 配置弹窗重写，嵌入 skill 市场页面

实现策略为渐进式重构，逐个修复，复用现有组件最大化。每步独立可验证。

---

## 1. 执行器配置修改

### 背景

当前 `agent-config-panel.tsx` 在 "Claude Code Options" 区块中有两个 Switch：
- Plan Mode（计划模式）：布尔开关
- Approvals（审批）：布尔开关

两者都有问题：
- **Plan Mode 不应存在于设置中**。Agent 在对话过程中会自己决定是否进入 plan 模式，这不是一个需要在配置中写死的选项。移除这个配置后 agent 也不会以 plan 模式运行——它会在对话中动态判断。
- **Approvals 应为三选一单选**，对应 Claude Code 的 permission mode，但不包含 plan。应采用与 `ContextSettingsPopup`（`context-settings-popup.tsx`）中一致的审批模式 segmented button UI 样式。

### 审批模式选项

在 `packages/core` 中定义 `ApprovalMode` 类型（不从 `@viben/chat` 导入类型，但 UI 样式参考 `context-settings-popup.tsx` 中的 segmented button）：

| 值 | 中文标签 | 描述 | 图标 |
|---|---|---|---|
| `bypass` | 绕过审批 | 跳过所有审批步骤 | ShieldOff |
| `rules` | 规则审批 | 根据预设规则自动审批（默认值） | ShieldCheck |
| `ai` | AI 审批 | 由 AI 评估并审批 | ShieldAlert |

### UI 变更

当前：

```
┌─ Claude Code Options ───────────────┐
│  Plan Mode            [Switch]      │
│  Approvals            [Switch]      │
└─────────────────────────────────────┘
```

改为：

```
┌─ 执行器选项 ────────────────────────┐
│  审批模式                           │
│  ┌──────────┬──────────┬─────────┐  │
│  │⛨ 绕过审批│⛨ 规则审批│⛨ AI审批│  │
│  └──────────┴──────────┴─────────┘  │
└─────────────────────────────────────┘
```

三段式 segmented button。样式参考 `context-settings-popup.tsx` 第 152-175 行的实现：一个 `h-8` 的圆角矩形 border 容器，内部三个等分按钮，选中态为 `bg-accent text-accent-foreground font-medium`，未选中态为 `text-muted-foreground hover:bg-muted`。每个按钮显示图标 + 标签。

该区块的标题从 "Claude Code Options" 改为 "执行器选项"。区块仅在 executor 类型为 CLAUDE_CODE 时显示（保持现有的 `isClaudeCode` 条件）。

### Props 接口变更

从 `AgentConfigPanelProps` 中：
- 移除 `planMode: boolean`
- 移除 `onPlanModeChange: (value: boolean) => void`
- 移除 `approvals: boolean`
- 移除 `onApprovalsChange: (value: boolean) => void`
- 新增 `approvalMode: ApprovalMode`（类型定义在 core 包中）
- 新增 `onApprovalModeChange: (mode: ApprovalMode) => void`

所有使用这些 props 的上层组件（`agent-settings-tab.tsx`、`agent-detail.tsx`）同步修改。

### 数据层变更

在 `packages/core/src/agents/types.ts` 的 `AgentConfigFile` 中：
- 删除 `planMode?: boolean` 字段
- 删除 `approvals?: boolean` 字段
- 新增 `approval_mode?: string` 字段（YAML 中存储为 `approval_mode: "rules"` / `"bypass"` / `"ai"`）

在 `packages/core/src/acp/types.ts` 的 `AgentConfigPayload` 中：
- 删除 `plan_mode?: boolean`
- 删除 `approvals?: boolean`
- 新增 `approval_mode?: string`

在 `packages/core/src/executors/ops/types.ts` 的 `ExecutorConfig` 中：
- 删除 `planMode?: boolean`
- 删除 `approvals?: boolean`
- 新增 `approvalMode?: string`

Claude executor engine 中当前通过 `this.config.planMode || this.config.approvals` 决定是否添加 `--permission-prompt-tool` 和 `--permission-mode` 参数，需要改为根据 `approvalMode` 的值决定传递什么参数。

### 数据迁移

不做向后兼容。直接删除旧字段，使用新字段。现有 agent YAML 文件中的 `planMode` 和 `approvals` 字段会被忽略。默认值为 `"rules"`。

### 影响文件

- `apps/desktop/src/components/agent/agent-config-panel.tsx`：UI 修改
- `apps/desktop/src/components/agent/agent-settings-tab.tsx`：传递新 prop
- `apps/desktop/src/pages/agents/agent-detail.tsx`：状态管理适配
- `packages/core/src/agents/types.ts`：AgentConfigFile 字段变更
- `packages/core/src/acp/types.ts`：AgentConfigPayload 字段变更
- `packages/core/src/executors/ops/types.ts`：ExecutorConfig 字段变更
- `packages/core/src/executors/engines/claude.ts`：参数构建逻辑
- Gateway agent routes：序列化/反序列化适配

---

## 2. MCP 配置重新设计

### 背景

当前的 MCP 配置分为两部分：
- Agent 设置页中的 capabilities section 展示一个简单的 server 列表（名称 + 类型 badge + 删除按钮）
- 点击"配置"按钮打开 `AgentMcpDialog`，包含三个 tab：Registered（已注册到网关的 MCP）、Built-in（内置）、Custom（JSON/表单手动添加）

问题：
- Registered tab 引用的是 `appStore.mcpServers`（网关管理的 MCP 服务），有些接口已经废弃
- 没有直接嵌入 MCP 市场供用户一站式浏览和添加
- 缺少内联编辑器直接查看/编辑完整配置

### 新设计：Agent 设置页中的 MCP 卡片

将当前的简单列表替换为 **JSON/Rich 可切换的内嵌编辑器**：

```
┌─ MCP Servers ──────────────────── [配置] ┐
│                                           │
│  ┌─ [JSON] [Rich] ───────────────────┐   │
│  │                                    │   │
│  │  JSON 模式:                        │   │
│  │  {                                 │   │
│  │    "mcpServers": {                 │   │
│  │      "tavily": {                   │   │
│  │        "url": "https://...",       │   │
│  │        "headers": {                │   │
│  │          "Authorization": "..."    │   │
│  │        }                           │   │
│  │      },                            │   │
│  │      "filesystem": {               │   │
│  │        "command": "npx",           │   │
│  │        "args": ["-y", "@model..."] │   │
│  │      }                             │   │
│  │    }                               │   │
│  │  }                                 │   │
│  │                                    │   │
│  │  Rich 模式:                        │   │
│  │  ┌────────────────────────────┐    │   │
│  │  │ 🟢 tavily      HTTP  [×]  │    │   │
│  │  │ 🟢 filesystem  STDIO [×]  │    │   │
│  │  └────────────────────────────┘    │   │
│  │                                    │   │
│  └────────────────────────────────────┘   │
│                                           │
└───────────────────────────────────────────┘
```

**JSON 模式**：一个文本编辑器区域，展示当前 agent 的完整 MCP 配置 JSON。用户可以直接编辑。格式为标准的 MCP 配置格式（`{ "mcpServers": { "name": { ... } } }`）。

**Rich 模式**：列表展示已配置的 server，每项显示名称、传输类型 badge、状态指示器和删除按钮。类似当前的列表但更丰富。

两种模式**双向同步**：编辑 JSON 会实时更新 Rich 列表的展示；在 Rich 模式中删除某项会更新 JSON 内容。切换模式时不丢失数据。

卡片顶部有一个 `[配置]` 按钮用于打开弹窗，从市场或内置列表中添加新的 MCP server。

### 新设计：配置弹窗

完全重写 `agent-mcp-dialog.tsx`。新弹窗包含两个 tab：

```
┌─ 配置 MCP 服务器 ──────────────────────────────┐
│                                                  │
│  ┌───────────┬────────────┐                     │
│  │  Built-in │   Market   │                     │
│  └───────────┴────────────┘                     │
│                                                  │
│  [Built-in tab 内容]:                           │
│  ┌──────────────────────────────────────────┐   │
│  │ browse-mcp (网关代理)          [+ 添加]  │   │
│  │ 描述: Viben Gateway MCP 代理服务         │   │
│  ├──────────────────────────────────────────┤   │
│  │ client-side-mcp                [+ 添加]  │   │
│  │ 描述: 客户端本地 MCP 服务               │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  [Market tab 内容]:                             │
│  ┌──────────────────────────────────────────┐   │
│  │ [🔍 搜索 MCP servers...]                │   │
│  │ [分类: All | Search | DB | Dev | ...]    │   │
│  │                                           │   │
│  │ ┌──────────┐ ┌──────────┐ ┌──────────┐  │   │
│  │ │ Tavily   │ │ Exa      │ │ Brave    │  │   │
│  │ │ Search.. │ │ Search.. │ │ Search.. │  │   │
│  │ │ [+ 添加] │ │ [+ 添加] │ │ [+ 添加] │  │   │
│  │ └──────────┘ └──────────┘ └──────────┘  │   │
│  │                                           │   │
│  │ ┌──────────┐ ┌──────────┐ ┌──────────┐  │   │
│  │ │ Postgres │ │ Supabase │ │ GitHub   │  │   │
│  │ │ DB tools │ │ Backend  │ │ Issues.. │  │   │
│  │ │ [+ 添加] │ │ [+ 添加] │ │ [+ 添加] │  │   │
│  │ └──────────┘ └──────────┘ └──────────┘  │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│                            [取消]  [完成]        │
└──────────────────────────────────────────────────┘
```

#### Tab 1: Built-in（内置）

展示平台内置的 MCP server：
- **browse-mcp**（网关代理）：Viben Gateway 提供的统一 MCP 代理服务
- **client-side MCP**：客户端本地运行的 MCP 服务

每项有 `[添加]` 按钮，点击后直接将该 MCP server 配置添加到 agent 的 MCP 列表中（内置服务不需要额外配置，因为连接参数是固定的）。

#### Tab 2: Market（MCP 市场）

嵌入 MCP 市场页面（现有 `/mcp-services/mcp-marketplace` 路由）的核心列表组件。需要从现有页面中提取列表/搜索/分类逻辑为可复用组件。

市场页面展示：
- 搜索框
- 分类筛选
- MCP server 卡片网格

每张卡片展示 MCP server 的名称、描述、类别等信息，并有一个 `[添加]` 按钮。

#### 点击添加后的配置子弹窗

用户在 Market tab 中点击某个 MCP server 的 `[添加]` 按钮后，弹出一个**配置子弹窗**（`McpServerConfigDialog`），用于配置连接参数：

```
┌─ 配置 Tavily Search ────────────────────────┐
│                                               │
│  传输类型:  [▾ Streamable HTTP (默认)]       │
│                                               │
│  URL:       [https://mcp.tavily.com/mcp   ]  │
│             (从 marketplace 数据预填)         │
│                                               │
│  Headers:                                     │
│  ┌─────────────────┬──────────────────────┐  │
│  │ Authorization   │ Bearer sk-...        │  │
│  └─────────────────┴──────────────────────┘  │
│  [+ 添加 Header]                              │
│                                               │
│  ─── 或直接编辑 JSON ───                     │
│  ┌───────────────────────────────────────┐   │
│  │ {                                      │   │
│  │   "url": "https://mcp.tavily.com/mcp", │   │
│  │   "headers": {                         │   │
│  │     "Authorization": "Bearer sk-..."   │   │
│  │   }                                    │   │
│  │ }                                      │   │
│  └───────────────────────────────────────┘   │
│                                               │
│                        [取消]  [确认添加]     │
└───────────────────────────────────────────────┘
```

内容：
- **传输类型**：默认为 Streamable HTTP（因为市场上的 MCP server 绝大多数是远程 HTTP 服务）
- **URL**：从 marketplace 数据中预填（如果 marketplace 提供了 endpoint URL）
- **Headers**：Key-Value 编辑器，主要用于配置 Authorization header（API Key）。这是用户最常需要填写的内容。
- **JSON 直接编辑**：可以切换到 JSON 模式直接编辑完整的 server 配置对象

点击"确认添加"后：
1. 关闭子弹窗
2. 将配置好的 MCP server 添加到 agent 的 `mcp_servers` 配置中
3. Agent 设置页的 McpConfigEditor 同步更新显示

### 组件拆分

| 组件 | 类型 | 职责 |
|------|------|------|
| `McpConfigEditor` | 新建 | 内嵌 JSON/Rich 切换编辑器，展示和编辑已配置的 MCP servers |
| `AgentMcpDialog` | 重写 | 弹窗主体，Built-in + Market 两个 tab |
| `McpMarketList` | 新建（从页面提取） | 可复用的 MCP marketplace 列表组件，接收 onAdd 回调 |
| `McpServerConfigDialog` | 新建 | 单个 MCP server 的连接配置子弹窗 |

### 数据流

用户从市场添加：Market 卡片 `[添加]` → 打开 McpServerConfigDialog → 用户填写连接参数 → 确认 → 关闭弹窗 → 更新 agent config 中的 mcp_servers 数组 → McpConfigEditor 同步显示新增项。

用户直接编辑 JSON：在 McpConfigEditor 的 JSON 模式中直接编辑 → 实时解析验证 → 更新 mcp_servers 数组 → Rich 模式同步更新。

### 废弃的内容

- 现有的三 tab 结构（Registered/Built-in/Custom）全部移除
- `useGatewayInspector` 在弹窗中的 probe 逻辑移至 McpServerConfigDialog 中按需使用
- `appStore.mcpServers`（网关管理的 MCP 服务列表）不再作为弹窗的主要数据源

---

## 3. Skill 配置弹窗重新设计

### 背景

当前的 Skill 配置弹窗（`agent-skills-dialog.tsx`）包含三个 tab：
- Marketplace：列出 `useCloudSkillPackages()` 返回的已安装 skill 包
- Local Path：添加本地文件系统路径
- Built-in：占位（`BUILTIN_SKILLS` 为空数组）

问题：
- Marketplace tab 只显示已安装的 skill，不是真正的市场浏览
- Built-in tab 没有内容
- 应该直接嵌入完整的 skill 市场页面供用户浏览和选择

### 新设计：Agent 设置页中的 Skill 卡片

保持当前列表展示不变：

```
┌─ Skills ──────────────────────── [配置] ┐
│                                          │
│  ✨ superpowers                    [×]  │
│  ✨ tavily-tools                   [×]  │
│  ✨ document-skills                [×]  │
│                                          │
└──────────────────────────────────────────┘
```

已选 skill 的列表，每项显示名称和删除按钮。`[配置]` 按钮打开弹窗。Skill 不需要 JSON 编辑器，因为 skill 的配置就是一个 ID 列表，没有复杂的连接参数。

### 新设计：配置弹窗

去掉 tab 结构，改为**单页面布局**：

```
┌─ 配置 Skills ─────────────────────────────────────┐
│                                                     │
│  [🔍 搜索 skills...]                              │
│                                                     │
│  [All] [Automation] [Analysis] [Generation] [...]  │
│                                                     │
│  ┌───────────────────────────────────────────┐     │
│  │ ┌───────────────┐ ┌───────────────┐      │     │
│  │ │ superpowers   │ │ tavily-tools  │      │     │
│  │ │ AI workflow.. │ │ Web search..  │      │     │
│  │ │ ┌───────────┐ │ │ ┌───────────┐ │      │     │
│  │ │ │ ✓ 已选择  │ │ │ │  + 添加   │ │      │     │
│  │ │ └───────────┘ │ │ └───────────┘ │      │     │
│  │ └───────────────┘ └───────────────┘      │     │
│  │                                           │     │
│  │ ┌───────────────┐ ┌───────────────┐      │     │
│  │ │ document-sk.. │ │ lark-shared   │      │     │
│  │ │ Doc tools..   │ │ Lark integr.. │      │     │
│  │ │ ┌───────────┐ │ │ ┌───────────┐ │      │     │
│  │ │ │ ✓ 已选择  │ │ │ │  + 添加   │ │      │     │
│  │ │ └───────────┘ │ │ └───────────┘ │      │     │
│  │ └───────────────┘ └───────────────┘      │     │
│  └───────────────────────────────────────────┘     │
│                                                     │
│  ── Local Path ─────────────────────────────       │
│  [📁 浏览...] [路径输入框          ] [+ 添加]     │
│                                                     │
│  ./skills/my-skill                         [×]     │
│  /abs/path/to/custom-skill                 [×]     │
│                                                     │
│                              [取消]  [保存]         │
└─────────────────────────────────────────────────────┘
```

**上部：Skill 市场区域**
- 搜索框（复用现有 `SearchBar` 组件）
- 分类筛选（复用现有 `CategoryFilter` 组件）
- Skill 卡片网格/列表（复用现有 `SkillCard` 组件）
- 卡片点击即选中/取消选中（无需额外配置弹窗，skill 没有连接参数）
- 已选状态直接在卡片上体现（改变边框颜色为 primary、显示勾选图标）

**下部：Local Path 区域**
- 路径输入框 + 浏览按钮（选择本地目录）
- 已添加的本地路径列表（每项可删除）
- 提示文字：选择包含 SKILL.md 的目录

**去掉 Built-in tab**，因为 `BUILTIN_SKILLS` 为空数组，当前没有实际内容。

### 与当前实现的关键区别

1. 从三 tab 结构变为无 tab 单页面
2. 市场区域展示的是完整的 skill 市场（含搜索、分类），而非仅已安装的 skill
3. 交互方式从 checkbox 列表变为卡片网格点击
4. Local Path 区域从独立 tab 变为页面底部的折叠区域

### 组件拆分

| 组件 | 类型 | 职责 |
|------|------|------|
| `AgentSkillsDialog` | 重写 | 弹窗主体，单页面布局 |
| `SkillMarketGrid` | 新建（从 `skills-market.tsx` 提取） | 可复用的 skill 网格组件，接收 `selectedIds` 和 `onToggle` props |
| `SkillCard` | 复用现有 | 单个 skill 卡片展示 |
| `SearchBar` | 复用现有 | 搜索框 |
| `CategoryFilter` | 复用现有 | 分类筛选 |

### 数据流

用户从市场选择：SkillMarketGrid 卡片点击 → toggle selectedIds 集合 → 卡片即时反映选中状态。

用户添加本地路径：Local Path 区域输入或浏览 → 添加到 selectedIds。

用户保存：点击 `[保存]` → `onSkillsChange(selectedIds)` → 更新 agent config 中的 skills 数组。

---

## 实现顺序

1. **执行器配置修改**：影响面最小，只涉及 UI 组件和类型定义，可独立完成和验证
2. **MCP 弹窗重写**：需要先提取 marketplace 组件为共享组件，再新建编辑器和弹窗
3. **Skill 弹窗重写**：与 MCP 类似，提取 marketplace 组件后重写弹窗

每步完成后都可以独立测试验证，不影响其他步骤。
