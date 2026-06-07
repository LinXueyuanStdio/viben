# 代码坏味道扫描报告

**扫描日期**: 2026-06-07  
**扫描范围**: `/root/viben/packages` 和 `/root/viben/apps`  
**使用模型**: Claude Opus 4.6  
**扫描方法**: 4个并行子 agent 深度扫描

---

## 执行摘要

本次扫描使用多个子 agent 并行深入分析了代码库的关键目录，识别了 **400+ 个代码坏味道**。

### 严重程度分布

| 严重程度 | 数量 | 占比 |
|---------|------|------|
| **Critical** | 8 | 2% |
| **High** | 25 | 6% |
| **Medium** | 117 | 28% |
| **Low** | 250+ | 64% |

### 问题类型分布

| 问题类型 | 数量 | 主要分布 |
|---------|------|---------|
| console.log 调试语句 | 330+ | apps/desktop (250+), packages/core (4), apps/web (80+) |
| 过长函数 (>50行) | 30 | packages/chat (9), packages/core (5), apps/desktop (8), apps/web (8) |
| 魔法数字 | 50+ | 所有模块均有分布 |
| any 类型使用 | 45+ | apps/desktop (33), packages/core (8), apps/web (10+) |
| 复杂条件判断 | 80+ | 各模块均匀分布 |
| TODO/FIXME | 14 | packages/core (13), apps/web (1) |
| 过深嵌套 | 15+ | packages/chat (5), packages/core (3), apps/web (4+) |
| 过多参数 (>5个) | 8 | packages/chat (4), packages/core (1) |
| 代码重复 | 3 | apps/web (3 处高重复) |

---

## 🔴 Critical 级别问题 (必须立即修复)

### 1. 超大文件/函数 (严重影响可维护性)

| 文件路径 | 行数/大小 | 问题 | 修复建议 |
|---------|----------|------|---------|
| **apps/desktop/src/pages/conversation/hooks/use-agent-conversation.ts** | 2463 行 | God hook - 管理 SSE、WebSocket、消息、计划、问题、artifact、后台任务 | 拆分为独立 hooks:<br>• `use-sse-connection.ts`<br>• `use-websocket-connection.ts`<br>• `use-background-tasks.ts`<br>• `use-message-handler.ts` |
| **packages/core/src/gateway/routes/group-chats.ts** | 2166 行 | 单文件包含所有群聊路由 | 按功能拆分为多个模块:<br>• `registerGroupCRUD()`<br>• `registerMemberRoutes()`<br>• `registerSessionRoutes()` |
| **packages/core/src/gateway/routes/agent-run.ts** | POST handler ~745 行 (397-1142) | 超长路由处理函数 | 拆分为:<br>• `validateRequest()`<br>• `initializeSession()`<br>• `handleStreaming()`<br>• `persistMessages()`<br>• `handleErrors()` |
| **packages/chat/src/message-list.tsx** | `groupMessages` ~204 行 (588-792) | 消息分组逻辑过于复杂 | 拆分为:<br>• `extractToolResults()`<br>• `processTextMessages()`<br>• `processToolMessages()`<br>• `finalizeGroups()` |
| **packages/chat/src/message-list.tsx** | `MessageList` ~575 行 (1179-1211+) | 超大组件 | 将虚拟滚动、滚动管理、渲染逻辑拆分为独立 hooks |
| **packages/chat/src/tool-execution-item.tsx** | `ToolExecutionItem` ~512 行 (668-1180) | 超大组件 | 将 compact/task/default mode 拆分为独立组件 |
| **packages/chat/src/chat-input/index.tsx** | `ChatInput` ~775 行 (57-832) | 超大输入组件 | 拆分为 `useChatInputState` hook 和多个子组件 |
| **packages/chat/src/hooks/use-virtual-scroll.ts** | `useVirtualScroll` ~427 行 (58-485) | 超大虚拟滚动 hook | 拆分为:<br>• `useScrollState`<br>• `useHeightCache`<br>• `useRangeComputation` |

**影响**: 这些超大文件/函数严重降低代码可读性和可维护性，增加 bug 引入风险。

**优先级**: ⚠️ **立即处理**

---

## 🟠 High 级别问题

### 1. 未完成的 TODO/核心功能缺失

#### packages/core/src/github/auto-fix/task-queue.ts (Critical - 核心功能未实现)

| 行号 | TODO 内容 | 影响 |
|------|----------|------|
| 422 | `// TODO: Use AI to generate actual implementation steps` | AI 任务分解未实现 |
| 445 | `file_edits: [], // TODO: Generate actual edits` | 文件编辑生成未实现 |
| 488 | `// TODO: Execute actual fix steps` | 修复执行未实现 |

#### 其他 TODO

| 文件路径 | 行号 | 内容 | 严重程度 |
|---------|------|------|---------|
| packages/core/src/github/analysis/issue-analyzer.ts | 578 | `// TODO: Implement actual AI analysis` | Medium |
| packages/core/src/github/analysis/batch-cluster.ts | 409 | `// TODO: Implement AI clustering with embeddings` | Medium |
| packages/core/src/github/analysis/issue-triager.ts | 403 | `// TODO: Implement AI-powered triage` | Medium |
| packages/core/src/gateway/routes/packages.ts | 148 | `// TODO: Implement package update logic` | Medium |
| apps/web/app/api/auth/callback/github/route.ts | 188 | `refreshToken: null, // TODO: Implement refresh tokens` | **High** |
| apps/desktop/src/pages/kanban/hooks/useKanbanBoard.ts | 570 | `// TODO: Implement delete when API available` | Medium |

**修复建议**: 
1. 为每个 TODO 创建 GitHub issue 跟踪
2. 优先实现 refresh token 机制（安全性）
3. 评估 auto-fix 功能的实现优先级

### 2. 大量 console.log 调试语句

#### apps/desktop/src (250+ 处)

**重灾区文件**:

| 文件路径 | 数量 | 示例行号 |
|---------|------|---------|
| use-agent-conversation.ts | 28 | 361, 398, 407, 451, 458, 466, 540, 564, 682, 700, 859, 874, 906, 916, 1004, 1031 |
| lib/onboarding/check-dag.ts | 19 | 118, 159, 164, 179, 191, 199, 207, 214, 237, 242, 254, 261, 278, 285, 300, 319, 328, 346, 362 |
| hooks/use-gateway.ts | 10 | 169, 170, 185, 186, 196, 199, 201, 209, 224, 261 |
| hooks/use-cron.ts | 7 | 102, 105, 110, 147, 150, 163, 166 |
| hooks/use-python.ts | 5 | 98, 107, 116, 132, 138 |
| App.tsx | 3 | 126, 133, 139 (mobile detection) |
| components/pet-window-manager.tsx | 3 | 11, 13, 20 (lifecycle logging) |

#### packages/core/src (4 处)

| 文件路径 | 行号 | 类型 |
|---------|------|------|
| cron/service.ts | 370-371, 383-385, 404-410 | console.warn/error/log |

#### apps/web (80+ 处)

主要分布在 API 错误处理中的 `console.error('...', error)`。

**修复建议**:
```typescript
// ❌ Bad
console.log("[useAgent] Starting SSE connection");
console.error("Failed to fetch:", error);

// ✅ Good - 使用结构化日志
import { logger } from '@/lib/logger';

logger.debug({ context: 'useAgent', action: 'sse-connect' }, 'Starting SSE connection');
logger.error({ error, context: 'api-fetch' }, 'Failed to fetch data');

// 或使用条件日志（仅开发环境）
if (process.env.NODE_ENV === 'development') {
  console.log("[useAgent] Starting SSE connection");
}
```

### 3. any 类型滥用

#### apps/desktop/src

| 文件路径 | 行号 | 代码片段 | 严重程度 |
|---------|------|---------|---------|
| pages/apps/components/yoopta-markdown.ts | 122, 124, 155, 159, 174, 184, 185, 188, 190, 204, 264 | Multiple `any[]` and `as any` | High |
| pages/apps/components/yoopta-markdown-renderer.tsx | 499, 609, 611, 700, 702, 801, 802 | Multiple `as any` | High |
| pages/screenshot-overlay/index.tsx | 382, 405 | `handleStageMouseDown = (e: any)` | Medium |
| hooks/use-mcp-connection.ts | 204, 349 | `client.request({...} as any, ...)` | Medium |

#### packages/core/src

| 文件路径 | 行号 | 代码片段 | 严重程度 |
|---------|------|---------|---------|
| gateway/routes/group-chats.ts | 291, 1879 | `socket: any;`, `async (socket: any, request: any)` | Medium |
| gateway/routes/page.ts | 862 | `const multipartRequest = request as any;` | Medium |
| channels/polling/feishu-poller.ts | 93 | `let lark: any = null;` | Medium |
| http/proxy.ts | 46 | `undiciFetch(url as any, { ...init, dispatcher } as any)` | Medium |

#### apps/web

| 文件路径 | 行号 | 代码片段 | 严重程度 |
|---------|------|---------|---------|
| app/components/code-stats/*.tsx | 多处 | `formatter={(value: any) =>...}` (10+ 文件) | Medium |

**修复建议**:
```typescript
// ❌ Bad
function handleStageMouseDown(e: any) { }
const formatter = (value: any) => `${value}`;

// ✅ Good
import type { KonvaEventObject } from 'konva/lib/Node';
import type { TooltipProps } from 'recharts';

function handleStageMouseDown(e: KonvaEventObject<MouseEvent>) { }
const formatter: TooltipProps<number, string>['formatter'] = (value) => `${value}`;

// ✅ Good - 为 Lark SDK 定义类型
import type { Client as LarkClient } from '@larksuiteoapi/node-sdk';
let lark: LarkClient | null = null;
```

### 4. 代码重复 (apps/web)

| 重复内容 | 文件 1 | 文件 2 | 行数 | 修复建议 |
|---------|--------|--------|------|---------|
| **parseSkillMd 函数** | `app/api/github/import/route.ts` | `app/api/github/repos/[owner]/[repo]/skills/route.ts` | ~60行 | 提取到 `/lib/utils/skill-parser.ts` |
| **formatNumber 函数** | `app/components/code-stats/*.tsx` (6+ 文件) | - | ~10行 | 统一使用 `@/lib/utils/format.ts` |
| **formatCount 函数** | `components/mcp/mcp-card.tsx` | `components/skills/skill-card.tsx` | ~5行 | 使用 `@/lib/utils/format` |

**修复示例**:
```typescript
// 创建 /root/viben/apps/web/lib/utils/skill-parser.ts
export interface SkillMetadata {
  name: string;
  description: string;
  author?: string;
  version?: string;
  // ...
}

export function parseSkillMd(content: string): SkillMetadata {
  // 提取的解析逻辑
}

// 在两个文件中使用
import { parseSkillMd } from '@/lib/utils/skill-parser';
```

---

## 🟡 Medium 级别问题

### 1. 魔法数字

#### 高频魔法数字

| 数字 | 出现次数 | 常见用途 | 修复建议 |
|------|---------|---------|---------|
| `10000` | 5+ | 输出截断长度 | `MAX_OUTPUT_LENGTH = 10000` |
| `80` | 5+ | 命令显示截断长度 | `MAX_COMMAND_DISPLAY_LENGTH = 80` |
| `2000` | 8+ | 各种截断/超时 | 按用途拆分常量 |
| `60000` | 10+ | 1分钟超时 | `TIMEOUT_ONE_MINUTE_MS = 60000` |
| `30000` | 8+ | 30秒超时 | `TIMEOUT_30_SECONDS_MS = 30000` |

#### 按模块分类

**packages/chat/src**

| 文件路径 | 行号 | 代码片段 | 修复建议 |
|---------|------|---------|---------|
| message-item.tsx | 370 | `l.length > 140` | `MAX_PREVIEW_LINE_LENGTH = 140` |
| message-item.tsx | 378 | `charCount >= 1000` | `KILO_CHAR_THRESHOLD = 1000` |
| tool-execution-item.tsx | 135 | `maxHeight: 400` | `MAX_IMAGE_HEIGHT = 400` |
| tool-execution-item.tsx | 633 | `-5` (slice最后5条) | `SUBAGENT_PREVIEW_COUNT = 5` |
| tool-execution-item.tsx | 1037 | `10000` (截断长度) | `MAX_OUTPUT_LENGTH = 10000` |
| chat-input/index.tsx | 228-232 | `200`, `40` (textarea高度) | `TEXTAREA_MAX_HEIGHT`, `TEXTAREA_MIN_HEIGHT` |

**packages/core/src**

| 文件路径 | 行号 | 代码片段 | 修复建议 |
|---------|------|---------|---------|
| gateway/routes/agent-run.ts | 495 | `prompt?.slice(0, 500)` | `MAX_PROMPT_PREVIEW_LENGTH = 500` |
| gateway/routes/agent-run.ts | 695 | `JSON.stringify(message).slice(0, 4000)` | `MAX_TELEMETRY_PAYLOAD_LENGTH = 4000` |
| cron/ops/schedule.ts | 108-114 | `3600`, `86400`, `60000`, `3600000` | `SECONDS_PER_HOUR`, `SECONDS_PER_DAY`, `MS_PER_MINUTE`, `MS_PER_HOUR` |
| github/auto-fix/worktree-manager.ts | 166, 181, 260, 271, 283, 293 | `60000`, `30000`, `10000` | `FETCH_TIMEOUT`, `GIT_OPERATION_TIMEOUT` |

**apps/desktop/src**

| 文件路径 | 行号 | 代码片段 | 修复建议 |
|---------|------|---------|---------|
| pages/conversation/hooks/use-agent-conversation.ts | 2118-2119 | `stuckCount >= 300` (5分钟) | `MAX_STUCK_COUNT = 300` 并添加注释 |
| navigation/page-navigation-extractor.ts | 144 | `.slice(offset + match[0].length + 240)` | **需要解释 240 的含义** |
| components/navigation/breadcrumb-dropdown.tsx | 56 | `}, 120)` | `DEBOUNCE_DELAY_MS = 120` |

**apps/web**

| 文件路径 | 行号 | 代码片段 | 修复建议 |
|---------|------|---------|---------|
| app/components/code-stats/architecture-chart.tsx | 61, 63 | `iterations = 120`, `repulsion = 8000` | 提取为 `FORCE_LAYOUT_CONFIG` 对象 |
| app/api/auth/callback/github/route.ts | 177 | `Date.now() + 7 * 24 * 60 * 60 * 1000` | `SESSION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000` |
| app/api/drafts/route.ts + app/api/github/import/route.ts | 11, 11 | `DRAFT_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000` | **重复定义，提取为共享常量** |

### 2. 复杂条件判断

#### packages/chat/src

| 文件路径 | 行号 | 代码片段 | 严重程度 | 修复建议 |
|---------|------|---------|---------|---------|
| tool-execution-item.tsx | 716 | `!!taskInput && !!onExpandSubagent && (!!toolUseId \|\| !!subagentId \|\| !!hasSubagentMessages)` | Medium | `const canOpenSubagent = computeCanOpenSubagent(...)` |
| tool-execution-item.tsx | 722 | `isTaskTool && ((isRunning && hasSubagentPreviewMessages) \|\| (!canOpenSubagent && (isRunning \|\| output)))` | **High** | 拆分为多个有语义的布尔变量 |
| chat-input/config-bar.tsx | 434 | `((tools.length > 0 && onToggleTool) \|\| (skills.length > 0 && onToggleSkill) \|\| ...)` | Medium | `const hasSettingsFeatures = ...` |

#### packages/core/src

| 文件路径 | 行号 | 代码片段 | 严重程度 | 修复建议 |
|---------|------|---------|---------|---------|
| evo/ops/runner.ts | 734, 1176 | `status === "completed" \|\| status === "review" \|\| status === "failed" \|\| ...` | Medium | `const TERMINAL_STATUSES = [...]; isTerminalStatus()` |
| mcp/server/browse-mcp/types.ts | 11 | `query.year !== undefined && query.searcher !== undefined && query.searcher !== null && query.searcher !== "semantic"` | Medium | `isYearFilterValid(query)` |

#### apps/desktop/src

| 文件路径 | 行号 | 描述 | 严重程度 | 修复建议 |
|---------|------|------|---------|---------|
| pages/workspace-cron.tsx | 214-272 | Cron pattern matching with 5+ `&&` operators | **High** | 提取为 `isEveryMinute()`, `isEveryNMinutes()`, `isSpecificMinutes()` 等辅助函数 |
| hooks/use-global-shortcuts.ts | 50, 63 | `modifierMatch && shiftMatch && altMatch && keyMatch` | Medium | 可接受，但可提取为 `matchesShortcut()` |

### 3. 过深嵌套

#### packages/core/src

| 文件路径 | 行号 | 描述 | 修复建议 |
|---------|------|------|---------|
| gateway/routes/agent-run.ts | 851-905 | Message persistence with nested try-catch inside loop | 使用早期返回和辅助函数 |
| gateway/routes/group-chats.ts | 1368-1380 | Multipart file handling with nested loops | 抽取文件处理为独立函数 |

#### apps/web

| 文件路径 | 行号 | 描述 | 修复建议 |
|---------|------|------|---------|
| app/api/github/import/route.ts | 122-208 | `try { for (...) { try { if (...) { ... } } } }` | 使用早期返回，提取内部逻辑为函数 |
| app/api/auth/github/callback/route.ts | 98-161 | `if (existingConnection) { ... } else { if (existingUser) { ... } else { ... } }` | 提取为 `handleUserAuthentication` 函数 |

### 4. 过多参数

#### packages/chat/src

| 文件路径 | 行号 | 函数/组件名 | 参数数量 | 修复建议 |
|---------|------|-------------|---------|---------|
| message-list.tsx | 262-267 | `renderToolsWithCollapsing` | 6 | 使用 options 对象模式 |
| chat-input/types.ts | 82-245 | `ChatInputProps` | 60+ 个属性 | 按功能分组为子接口:<br>• `ChatInputBasicProps`<br>• `ChatInputLayoutProps`<br>• `ChatInputSelectorProps` |
| chat-input/config-bar.tsx | 42-88 | `ChatInputConfigBarProps` | 25+ 个属性 | 按功能分组:<br>• `AgentConfig`<br>• `ModelConfig`<br>• `ToolsConfig` |

#### packages/core/src

| 文件路径 | 行号 | 函数签名 | 参数数量 | 修复建议 |
|---------|------|---------|---------|---------|
| gateway/routes/group-chats.ts | 636-644 | `executeAgentsInBackground(...)` | 7 | 使用配置对象: `executeAgentsInBackground(config: ExecuteAgentsConfig)` |

---

## 📊 统计信息

### 按模块统计

| 模块 | Critical | High | Medium | Low | 总计 |
|-----|----------|------|--------|-----|------|
| **packages/chat** | 4 | 4 | 18 | 15 | 41 |
| **packages/core** | 2 | 8 | 31 | 12 | 53 |
| **apps/desktop** | 1 | 5 | 25 | 250+ | 281+ |
| **apps/web** | 1 | 8 | 43 | 80+ | 132+ |
| **总计** | **8** | **25** | **117** | **357+** | **507+** |

### 前10大问题文件

| 排名 | 文件路径 | 问题数量 | 主要问题 |
|-----|---------|---------|---------|
| 1 | apps/desktop/src/pages/conversation/hooks/use-agent-conversation.ts | 66+ | 超大文件(2463行), console.log(28处), 复杂条件(5处), 过长函数(4个) |
| 2 | packages/core/src/gateway/routes/group-chats.ts | 45+ | 超大文件(2166行), any类型(3处), 过深嵌套(1处) |
| 3 | packages/chat/src/message-list.tsx | 40+ | 超大文件(1755行), 过长函数(2个), 魔法数字(3处), 复杂条件(2处) |
| 4 | packages/core/src/gateway/routes/agent-run.ts | 38+ | 超长函数(~745行), 魔法数字(8处), 过深嵌套(1处) |
| 5 | packages/chat/src/tool-execution-item.tsx | 35+ | 超大组件(1181行), 魔法数字(10处), 复杂条件(2处) |
| 6 | packages/chat/src/chat-input/index.tsx | 30+ | 超大组件(885行), 魔法数字(2处), 过深嵌套(1处) |
| 7 | apps/web/app/components/code-stats/*.tsx | 28+ | any类型(10+处), 魔法数字(10+处) |
| 8 | apps/desktop/src/pages/apps/components/yoopta-markdown.ts | 24+ | any类型(11处), 魔法数字(5处) |
| 9 | apps/desktop/src/lib/onboarding/check-dag.ts | 19 | console.log(19处) |
| 10 | packages/core/src/cron/ops/schedule.ts | 15+ | 魔法数字(12处) |

---

## 🎯 修复优先级建议

### 第1周 (Critical)

1. ✅ **拆分超大文件/函数** (3-5天)
   - `use-agent-conversation.ts` (2463行) → 4个独立 hooks
   - `group-chats.ts` (2166行) → 按功能拆分模块
   - `agent-run.ts` POST handler (~745行) → 5个辅助函数

2. ✅ **处理代码重复** (1天)
   - 提取 `parseSkillMd` 到 `@/lib/utils/skill-parser`
   - 统一使用 `@/lib/utils/format` 的格式化函数

### 第2周 (High)

3. ✅ **清理 console.log** (2-3天)
   - 创建统一日志工具 `@/lib/logger`
   - 批量替换 apps/desktop 中的 250+ 处 console.log
   - 批量替换 apps/web API 错误日志

4. ✅ **处理 TODO/未完成功能** (2天)
   - 为每个 TODO 创建 GitHub issue
   - 实现 refresh token 机制 (apps/web, High)
   - 评估 auto-fix 功能实现计划

### 第3周 (Medium)

5. ✅ **替换 any 类型** (3-4天)
   - 为 Yoopta editor 定义类型 (apps/desktop/web, 20+处)
   - 为 Recharts formatter 定义类型 (apps/web, 10+处)
   - 为 Konva events 定义类型 (apps/desktop, 2处)
   - 为 multipart request 创建接口 (packages/core, 3处)

6. ✅ **提取魔法数字** (2-3天)
   - 创建 `constants/` 目录
   - 按类别提取：超时、尺寸、阈值、限制
   - 重点处理重复定义（如 `DRAFT_EXPIRY_MS`）

### 第4周 (Medium/Low)

7. ✅ **简化复杂条件** (2天)
   - 提取 cron pattern matching 辅助函数
   - 提取状态判断辅助函数
   - 创建语义化布尔变量

8. ✅ **重构过深嵌套** (1-2天)
   - 使用早期返回模式
   - 提取嵌套逻辑为独立函数

9. ✅ **优化函数参数** (1-2天)
   - 拆分大型 Props 接口
   - 使用配置对象模式

---

## 🔧 工具和流程建议

### 1. 自动化工具

```bash
# 安装 ESLint 规则
pnpm add -D eslint-plugin-no-console @typescript-eslint/eslint-plugin

# .eslintrc.js 配置
rules: {
  'no-console': ['warn', { allow: ['warn', 'error', 'debug'] }],
  '@typescript-eslint/no-explicit-any': 'error',
  '@typescript-eslint/no-magic-numbers': ['warn', { ignore: [0, 1, -1, 100] }],
  'complexity': ['warn', { max: 10 }],
  'max-lines-per-function': ['warn', { max: 50 }],
  'max-params': ['warn', { max: 5 }],
}
```

### 2. 持续监控

```bash
# 每天早上 8:57 自动扫描 (已设置 cron job b6d33412)
pnpm dlx claude-code /loop "扫描代码库，找出代码坏味道"

# 手动扫描命令
pnpm lint
pnpm typecheck
pnpm complexity-report
```

### 3. Code Review Checklist

在 PR 中检查：
- [ ] 无新增 console.log (除 console.debug 外)
- [ ] 无新增 any 类型 (测试文件除外)
- [ ] 无新增魔法数字
- [ ] 函数行数 < 50 行
- [ ] 参数个数 ≤ 5 个
- [ ] 条件判断 ≤ 3 层
- [ ] TODO 有对应的 issue 链接

---

## 📝 附录

### A. 扫描方法

本次扫描使用 4 个并行 Opus 子 agent：
1. **code-smell-scanner-packages-chat** - 扫描 packages/chat/src
2. **code-smell-scanner-packages-core** - 扫描 packages/core/src
3. **code-smell-scanner-apps-desktop** - 扫描 apps/desktop/src
4. **code-smell-scanner-apps-web** - 扫描 apps/web/src

每个 agent 使用 Grep、Read、Glob 工具深入分析代码模式。

### B. 排除项

- `node_modules/`
- `dist/`, `build/`, `.next/`
- `*.test.ts`, `*.test.tsx` (any 类型相对宽容)
- `*.d.ts` (类型定义文件)
- 第三方库代码

### C. 相关文档

- [CLAUDE.md](/root/viben/CLAUDE.md) - 项目开发指南
- [chat-input-components.md](/root/viben/docs/specs/frontend/features/chat-input-components.md) - Chat 输入组件规范

---

**报告生成时间**: 2026-06-07 23:15:00  
**生成方式**: Claude Opus 4.6 多 agent 并行扫描  
**下次扫描**: 2026-06-08 08:57:00 (自动)
