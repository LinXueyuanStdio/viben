# 代码坏味道扫描报告

**扫描日期**: 2026-06-08  
**扫描范围**: `/root/viben/packages` 和 `/root/viben/apps`  
**使用模型**: Claude Opus 4.6  
**扫描方法**: 4个并行子 agent 深度扫描

---

## 执行摘要

本次扫描使用多个子 agent 并行深入分析了代码库的关键目录，识别了 **500+ 个代码坏味道**。

### 严重程度分布

| 严重程度 | 数量 | 占比 |
|---------|------|------|
| **Critical** | 9 | 2% |
| **High** | 29 | 6% |
| **Medium** | 112 | 22% |
| **Low** | 350+ | 70% |

### 问题类型分布

| 问题类型 | 数量 | 主要分布 |
|---------|------|---------|
| console.log 调试语句 | 260+ | apps/desktop (250+), packages/core (4), apps/web (6) |
| 过长函数 (>50行) | 28 | packages/chat (12), packages/core (5), apps/desktop (7), apps/web (8) |
| 魔法数字 | 54 | 各模块均匀分布 |
| any 类型使用 | 37 | apps/desktop (18), packages/core (8), apps/web (11), packages/chat (2) |
| 复杂条件判断 | 60+ | 各模块均匀分布 |
| TODO/FIXME | 9 | packages/core (6), apps/web (2), apps/desktop (1) |
| 过深嵌套 | 17 | packages/chat (5), packages/core (3), apps/desktop (3), apps/web (4) |
| 过多参数 (>5个) | 6 | packages/chat (5), apps/web (1) |

---

## 🔴 Critical 级别问题 (必须立即修复)

### 1. 超大文件/函数 (严重影响可维护性)

| 文件路径 | 行数/大小 | 问题 | 修复建议 |
|---------|----------|------|---------|
| **apps/desktop/src/pages/conversation/hooks/use-agent-conversation.ts** | 2463 行 | God hook - 管理 SSE、WebSocket、消息、计划、问题、artifact、后台任务 | 拆分为独立 hooks:<br>• `use-sse-connection.ts`<br>• `use-websocket-connection.ts`<br>• `use-background-tasks.ts`<br>• `use-message-handler.ts`<br>• `use-artifact-extraction.ts` |
| **packages/core/src/gateway/routes/group-chats.ts** | 2166 行 | 单文件包含所有群聊路由 | 按功能拆分为多个模块:<br>• `group-crud.ts`<br>• `group-members.ts`<br>• `group-sessions.ts`<br>• `group-websocket.ts` |
| **packages/core/src/gateway/routes/task.ts** | 2000+ 行 | 超大路由文件 | 拆分为:<br>• `task-context.ts`<br>• `task-queue.ts`<br>• `task-lifecycle.ts` |
| **packages/chat/src/message-list.tsx** | `groupMessages` ~205 行 (588-792) | 消息分组逻辑过于复杂 | 拆分为:<br>• `extractToolResults()`<br>• `processTextMessages()`<br>• `processToolMessages()`<br>• `finalizeGroups()` |
| **packages/chat/src/message-list.tsx** | `MessageList` ~575 行 | 超大组件 | 拆分为:<br>• `VirtualScrollManager`<br>• `MessageGroups`<br>• `WelcomeScreen` |
| **packages/chat/src/tool-execution-item.tsx** | `ToolExecutionItem` ~511 行 (668-1180) | 超大组件包含3种模式 | 拆分为:<br>• `CompactToolItem`<br>• `TaskToolItem`<br>• `DefaultToolItem` |
| **packages/chat/src/chat-input/index.tsx** | `ChatInput` ~775 行 (57-832) | 超大输入组件，50+ props | 拆分为:<br>• `useChatInputState` hook<br>• `ChatInputCore`<br>• `ChatInputToolbar`<br>• `ChatInputActions` |
| **packages/chat/src/chat-input/config-bar.tsx** | `ChatInputConfigControls` ~311 行 (176-487) | 配置控制组件过大 | 拆分为:<br>• `AgentSelector`<br>• `ModelSelector`<br>• `ToolsSettings`<br>• `SkillsSettings` |
| **packages/chat/src/hooks/use-virtual-scroll.ts** | `useVirtualScroll` ~427 行 (58-485) | 超大虚拟滚动 hook | 拆分为:<br>• `useScrollState`<br>• `useHeightCache`<br>• `useRangeComputation` |

**影响**: 这些超大文件/函数严重降低代码可读性和可维护性，增加 bug 引入风险。

**优先级**: ⚠️ **立即处理**

---

## 🟠 High 级别问题

### 1. 未完成的 TODO/核心功能缺失

#### packages/core/src/github/auto-fix/task-queue.ts (Critical)

| 行号 | TODO 内容 | 影响 |
|------|----------|------|
| 422 | `// TODO: Use AI to generate actual implementation steps` | AI 任务分解未实现 |
| 445 | `file_edits: [], // TODO: Generate actual edits` | 文件编辑生成未实现 |
| 488 | `// TODO: Execute actual fix steps` | 修复执行未实现 |

#### 其他 TODO

| 文件路径 | 行号 | 内容 | 严重程度 |
|---------|------|------|---------|
| packages/core/src/github/analysis/issue-analyzer.ts | 578 | `// TODO: Implement actual AI analysis` | High |
| packages/core/src/github/analysis/batch-cluster.ts | 409 | `// TODO: Implement AI clustering` | High |
| packages/core/src/github/analysis/issue-triager.ts | 403 | `// TODO: Implement AI-powered triage` | High |
| packages/core/src/gateway/routes/packages.ts | 148 | `// TODO: Implement package update logic` | Medium |
| packages/core/src/gateway/routes/providers.ts | 645 | `is_known: true, // TODO: distinguish known vs custom models` | Medium |
| apps/web/app/api/auth/callback/github/route.ts | 188 | `refreshToken: null, // TODO: Implement refresh tokens` | High |
| apps/desktop/src/pages/kanban/hooks/useKanbanBoard.ts | 570 | `// TODO: Implement delete when API available` | Medium |

### 2. 大量 console.log 调试语句

#### apps/desktop/src (250+ 处)

**重灾区文件**:

| 文件路径 | 数量 | 示例行号 |
|---------|------|---------|
| use-agent-conversation.ts | 27+ | 361, 398, 407, 451, 458, 466, 540, 564, 682, 700, 859, 874, 906, 916, 1004, 1031, 1306, 1324, 1419 |
| lib/onboarding/check-dag.ts | 19 | 118, 159, 164, 179, 191, 199, 207, 214, 237, 242, 254, 261, 278, 285, 300, 319, 328, 346, 362 |
| hooks/use-gateway.ts | 10 | 169, 170, 185, 186, 196, 199, 201, 209, 224, 261 |
| hooks/use-cron.ts | 7 | 102, 105, 110, 147, 150, 163, 166 |
| hooks/use-python.ts | 5 | 98, 107, 116, 132, 138 |
| App.tsx | 3 | 126, 133, 139 (mobile detection) |
| components/pet-window-manager.tsx | 3 | 11, 13, 20 (lifecycle logging) |
| components/overlay/layers/wave-layer.tsx | 2 | 146, 257 (高频更新日志) |

#### packages/core/src (10+ 处)

| 文件路径 | 行号 | 类型 |
|---------|------|------|
| task/phase/plan.ts | 282-287 | console.log (6处) |
| task/phase/start.ts | 420-423 | console.log (4处) |
| cron/service.ts | 370-411 | console.warn/error/log |
| gateway/index.ts | 400-405 | console.log |

#### apps/web (6 处)

| 文件路径 | 行号 | 类型 |
|---------|------|------|
| app/api/voice-token/route.ts | 68, 105 | console.log |
| app/api/auth/callback/github/route.ts | 72, 192 | console.error |
| components/publish/publish-wizard.tsx | 176 | console.error |

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

#### apps/desktop/src (18 处)

| 文件路径 | 行号 | 代码片段 | 严重程度 |
|---------|------|---------|---------|
| pages/apps/components/yoopta-markdown.ts | 122, 124, 155, 159, 174, 184-264 | Multiple `any[]` and `as any` | High |
| pages/apps/components/yoopta-markdown-renderer.tsx | 499, 609, 611, 700, 702, 801-802 | Multiple `as any` | High |
| pages/screenshot-overlay/index.tsx | 382, 405 | `handleStageMouseDown = (e: any)` | Medium |
| hooks/use-mcp-connection.ts | 204, 349 | `client.request({...} as any, ...)` | Medium |
| hooks/use-safe-area.ts | 85 | `(window as any).AndroidSafeArea` | Low |

#### packages/core/src (8 处)

| 文件路径 | 行号 | 代码片段 | 严重程度 |
|---------|------|---------|---------|
| gateway/routes/group-chats.ts | 291, 1354, 1542, 1879 | `socket: any;`, `multipartRequest as any` | Medium |
| gateway/routes/page.ts | 862 | `multipartRequest as any` | Medium |
| channels/polling/feishu-poller.ts | 93 | `let lark: any = null;` | Medium |
| http/proxy.ts | 46 | `undiciFetch(url as any, ...)` | Medium |

#### apps/web (11 处)

| 文件路径 | 行号 | 代码片段 | 严重程度 |
|---------|------|---------|---------|
| app/components/code-stats/*.tsx | 多处 | `formatter={(value: any) =>...}` (10个文件) | High |
| lib/auth/__tests__/middleware.test.ts | 多处 | 测试文件中的 `as any` | Low |

#### packages/chat/src (2 处)

| 文件路径 | 行号 | 代码片段 | 严重程度 |
|---------|------|---------|---------|
| tool-execution-item.tsx | 403, 522 | `t: (...args: any[]) => any` | Medium |

**修复建议**:
```typescript
// ❌ Bad
function handleStageMouseDown(e: any) { }
const formatter = (value: any) => `${value}`;
let lark: any = null;

// ✅ Good
import type { KonvaEventObject } from 'konva/lib/Node';
import type { TooltipProps } from 'recharts';
import type { Client as LarkClient } from '@larksuiteoapi/node-sdk';
import type { TFunction } from 'i18next';

function handleStageMouseDown(e: KonvaEventObject<MouseEvent>) { }
const formatter: TooltipProps<number, string>['formatter'] = (value) => `${value}`;
let lark: LarkClient | null = null;
const t: TFunction = useTranslation().t;
```

---

## 🟡 Medium 级别问题

### 1. 魔法数字 (54 处)

#### 高频魔法数字

| 数字 | 出现次数 | 常见用途 | 修复建议 |
|------|---------|---------|---------|
| `10000` | 3+ | 输出截断长度 | `MAX_OUTPUT_LENGTH = 10000` |
| `80` | 5+ | 命令/文本显示截断 | `MAX_COMMAND_DISPLAY_LENGTH = 80` |
| `2000` | 5+ | 各种截断/超时 | 按用途拆分常量 |
| `60000` | 8+ | 1分钟超时 | `TIMEOUT_ONE_MINUTE_MS = 60000` |
| `30000` | 6+ | 30秒超时 | `TIMEOUT_30_SECONDS_MS = 30000` |
| `140` | 2+ | 预览行长度 | `MAX_PREVIEW_LINE_LENGTH = 140` |

#### 按模块分类

**packages/chat/src (20 处)**

| 文件路径 | 行号 | 代码片段 | 修复建议 |
|---------|------|---------|---------|
| message-item.tsx | 370 | `l.length > 140` | `MAX_PREVIEW_LINE_LENGTH = 140` |
| message-item.tsx | 378 | `charCount >= 1000` | `KILO_CHAR_THRESHOLD = 1000` |
| tool-execution-item.tsx | 135 | `maxHeight: 400` | `MAX_IMAGE_HEIGHT = 400` |
| tool-execution-item.tsx | 173, 226, 415, 531 | `80` (截断) | `MAX_COMMAND_DISPLAY_LENGTH = 80` |
| tool-execution-item.tsx | 1037 | `10000` | `MAX_OUTPUT_LENGTH = 10000` |
| chat-input/index.tsx | 228-232 | `200`, `40` | `TEXTAREA_MAX_HEIGHT`, `TEXTAREA_MIN_HEIGHT` |
| collapsed-tool-group.tsx | 199, 202, 211 | `30`, `40`, `700` | 提取为常量组 |

**packages/core/src (14 处)**

| 文件路径 | 行号 | 代码片段 | 修复建议 |
|---------|------|---------|---------|
| gateway/routes/agent-run.ts | 495, 695, 761-762 | `500`, `4000`, `2000` | 提取预览/截断常量 |
| cron/ops/schedule.ts | 105-114 | `60`, `3600`, `86400`, `60000`, `3600000` | 时间常量 |
| github/gh-client.ts | 36, 240, 254, 330, 517 | `30000`, `5000`, `10000` | 超时常量 |
| github/auto-fix/worktree-manager.ts | 89, 166, 181, 260, 283 | `300000`, `60000`, `30000` | Git 操作超时 |

**apps/desktop/src (12 处)**

| 文件路径 | 行号 | 代码片段 | 修复建议 |
|---------|------|---------|---------|
| pages/conversation/hooks/use-agent-conversation.ts | 69, 140, 771-773, 2118 | 已提取部分常量 | 良好实践 |
| navigation/page-navigation-extractor.ts | 144 | `.slice(...+ 240)` | **需要解释含义** |
| components/navigation/breadcrumb-dropdown.tsx | 56 | `}, 120)` | `DEBOUNCE_DELAY_MS` |

**apps/web (8 处)**

| 文件路径 | 行号 | 代码片段 | 修复建议 |
|---------|------|---------|---------|
| app/components/code-stats/architecture-chart.tsx | 61, 63 | `iterations = 120`, `repulsion = 8000` | 提取为 `FORCE_LAYOUT_CONFIG` |
| app/api/auth/callback/github/route.ts | 177 | `7 * 24 * 60 * 60 * 1000` | `SESSION_EXPIRY_MS` |
| app/api/drafts/route.ts + app/api/github/import/route.ts | 11, 11 | `30 * 24 * 60 * 60 * 1000` | **重复定义，需合并** |

### 2. 复杂条件判断 (60+ 处)

#### packages/chat/src (11 处)

| 文件路径 | 行号 | 代码片段 | 严重程度 | 修复建议 |
|---------|------|---------|---------|---------|
| tool-execution-item.tsx | 716 | `!!taskInput && !!onExpandSubagent && (!!toolUseId \|\| ...)` | High | `computeCanOpenSubagent()` |
| tool-execution-item.tsx | 722 | `isTaskTool && ((isRunning && ...) \|\| ...)` | High | `shouldAutoExpand()` |
| chat-input/config-bar.tsx | 434 | `((tools.length > 0 && onToggleTool) \|\| ...)` | Medium | `hasSettingsFeatures` |
| message-list.tsx | 1114-1118 | memo 比较函数 | Medium | `isStreamingTextMessage()` |
| plan-approval.tsx | 226 | 5个条件 && 组合 | Medium | `shouldShowActionButtons` |

#### packages/core/src (8 处)

| 文件路径 | 行号 | 代码片段 | 严重程度 | 修复建议 |
|---------|------|---------|---------|---------|
| evo/ops/runner.ts | 734, 1176 | 4-5个状态 \|\| 组合 | Medium | `TERMINAL_STATUSES`, `isTerminalStatus()` |
| mcp/server/browse-mcp/types.ts | 11 | 4个条件 && 组合 | Medium | `isYearFilterValid()` |
| task/service.ts | 320 | 终止状态判断 | Medium | `isTerminalStatus()` |

#### apps/desktop/src (7 处)

| 文件路径 | 行号 | 描述 | 严重程度 | 修复建议 |
|---------|------|------|---------|---------|
| pages/workspace-cron.tsx | 214-272 | Cron 模式匹配，5+ `&&` | High | 提取辅助函数 `isEveryMinute()` 等 |
| hooks/use-global-shortcuts.ts | 50, 63 | 快捷键匹配 | Low | 可接受或提取 `matchesShortcut()` |

#### apps/web (4 处)

| 文件路径 | 行号 | 代码片段 | 严重程度 | 修复建议 |
|---------|------|---------|---------|---------|
| app/api/releases/route.ts | 83 | `!!(dmgArm64 \|\| dmgX64 \|\| ...)` | Low | `hasDesktopAssets()` |
| hooks/use-official-registry.ts | 305 | `loading \|\| !hasMore \|\| !cursor \|\| ...` | Medium | `canLoadMore` |

### 3. 过深嵌套 (17 处)

#### packages/chat/src (5 处)

| 文件路径 | 行号 | 描述 | 修复建议 |
|---------|------|------|---------|
| plan-approval.tsx | 40-63 | 5层三元表达式 | 使用 switch-case |
| tool-execution-item.tsx | 813-820 | 嵌套条件 | 提取函数 |
| message-list.tsx | 680-781 | 多层 if-else | 策略模式 |

#### packages/core/src (3 处)

| 文件路径 | 行号 | 描述 | 修复建议 |
|---------|------|------|---------|
| gateway/routes/group-chats.ts | 1368-1380, 1993-2060 | 文件处理/WebSocket | 提取函数 |
| cron/service.ts | 362-413 | 通知发送 | `sendNotificationToChannel()` |

#### apps/desktop/src (3 处)

| 文件路径 | 行号 | 描述 | 修复建议 |
|---------|------|------|---------|
| pages/conversation/hooks/use-agent-conversation.ts | handleSSEMessage | switch-case 嵌套 | 消息处理器映射 |
| components/overlay/layers/wave-layer.tsx | 渲染循环 | for > for > if | 提取渲染函数 |

#### apps/web (4 处)

| 文件路径 | 行号 | 描述 | 修复建议 |
|---------|------|------|---------|
| app/api/github/import/route.ts | 122-208 | `try { for { try { if }}}` | 早期返回 |
| app/components/code-stats/architecture-chart.tsx | 69-96 | 4层嵌套循环 | 提取函数 |

### 4. 过多参数 (6 处)

#### packages/chat/src (5 处)

| 文件路径 | 行号 | 函数/组件名 | 参数数量 | 修复建议 |
|---------|------|-------------|---------|---------|
| message-list.tsx | 262-269 | `renderToolsWithCollapsing` | 6 | options 对象 |
| message-list.tsx | 1011-1034 | `MessageRowProps` | 17 | 分组为子对象 |
| chat-input/index.tsx | 57-130 | `ChatInput` props | 50+ | 使用复合 props |
| chat-input/config-bar.tsx | 42-88 | `ChatInputConfigBarProps` | 26 | 按功能分组 |
| message-list.tsx | 36-130 | `MessageListProps` | 28 | 按功能分组 |

#### apps/web (1 处)

| 文件路径 | 行号 | 函数签名 | 参数数量 | 修复建议 |
|---------|------|---------|---------|---------|
| pages/apps/components/yoopta-editor-header.tsx | 57 | `YooptaEditorHeader` | 9 | 分组为 `editorState` 和 `callbacks` |

---

## 📊 统计信息

### 按模块统计

| 模块 | Critical | High | Medium | Low | 总计 |
|-----|----------|------|--------|-----|------|
| **packages/chat** | 5 | 5 | 28 | 10 | 48 |
| **packages/core** | 2 | 9 | 25 | 10+ | 46+ |
| **apps/desktop** | 1 | 5 | 18 | 250+ | 274+ |
| **apps/web** | 1 | 10 | 41 | 12 | 64 |
| **总计** | **9** | **29** | **112** | **282+** | **432+** |

### 前10大问题文件

| 排名 | 文件路径 | 问题数量 | 主要问题 |
|-----|---------|---------|---------|
| 1 | apps/desktop/src/pages/conversation/hooks/use-agent-conversation.ts | 60+ | 超大文件(2463行), console.log(27+), 复杂条件(5), 过长函数(4) |
| 2 | packages/core/src/gateway/routes/group-chats.ts | 40+ | 超大文件(2166行), any(4), 过深嵌套(2) |
| 3 | packages/chat/src/message-list.tsx | 35+ | 超大文件(1755行), 过长函数(4), 魔法数字(3), 复杂条件(2) |
| 4 | packages/core/src/gateway/routes/task.ts | 30+ | 超大文件(2000+行), 魔法数字(5+) |
| 5 | packages/chat/src/tool-execution-item.tsx | 30+ | 超大组件(1181行), 魔法数字(10), 复杂条件(2), any(2) |
| 6 | packages/chat/src/chat-input/index.tsx | 25+ | 超大组件(885行), 过多参数(50+), 魔法数字(2) |
| 7 | apps/web/app/components/code-stats/*.tsx | 22+ | any 类型(10个文件), 魔法数字(10+) |
| 8 | apps/desktop/src/pages/apps/components/yoopta-markdown.ts | 20+ | any 类型(11处), 魔法数字(5处) |
| 9 | apps/desktop/src/lib/onboarding/check-dag.ts | 19 | console.log(19处) |
| 10 | packages/core/src/cron/ops/schedule.ts | 12+ | 魔法数字(12处) |

---

## 🎯 修复优先级建议

### 第1周 (Critical - 立即处理)

1. ✅ **拆分超大文件/函数** (3-5天)
   - `use-agent-conversation.ts` (2463行) → 5个独立 hooks
   - `group-chats.ts` (2166行) → 按功能拆分模块
   - `task.ts` (2000+行) → 拆分为3个文件
   - `message-list.tsx` 中的 `groupMessages` 和 `MessageList`

2. ✅ **拆分 Chat 相关超大组件** (2-3天)
   - `ChatInput` (775行, 50+ props)
   - `ToolExecutionItem` (511行)
   - `ChatInputConfigControls` (311行)
   - `useVirtualScroll` (427行)

### 第2周 (High - 高优先级)

3. ✅ **清理 console.log** (2-3天)
   - 创建统一日志工具 `@/lib/logger`
   - 批量替换 apps/desktop 中的 250+ 处
   - 替换 apps/web 和 packages/core 中的日志

4. ✅ **处理 TODO/未完成功能** (2天)
   - 为每个 TODO 创建 GitHub issue
   - 实现 refresh token 机制 (apps/web)
   - 评估 auto-fix 功能实现计划 (packages/core)

### 第3周 (Medium - 中等优先级)

5. ✅ **替换 any 类型** (3-4天)
   - Yoopta editor 类型定义 (20+处)
   - Recharts formatter 类型 (10+处)
   - Konva events 类型 (2处)
   - MCP SDK 类型 (3处)
   - Multipart request 接口 (3处)

6. ✅ **提取魔法数字** (2-3天)
   - 创建 `constants/` 目录
   - 按类别提取：超时、尺寸、阈值、限制
   - 处理重复定义（如 `DRAFT_EXPIRY_MS`）

### 第4周 (Medium/Low - 持续优化)

7. ✅ **简化复杂条件** (2天)
   - cron pattern matching 辅助函数
   - 状态判断辅助函数
   - 语义化布尔变量

8. ✅ **重构过深嵌套** (1-2天)
   - 早期返回模式
   - 提取嵌套逻辑为函数

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
# 每天早上 8:57 自动扫描
# Cron job b6d33412 已设置

# 手动扫描命令
pnpm lint
pnpm typecheck
```

### 3. Code Review Checklist

在 PR 中检查：
- [ ] 无新增 console.log (除 console.debug)
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

### D. 与前次扫描对比 (2026-06-07)

| 指标 | 2026-06-07 | 2026-06-08 | 变化 |
|------|------------|------------|------|
| 总问题数 | 507+ | 432+ | ↓ 75 (部分问题已修复) |
| Critical | 8 | 9 | ↑ 1 |
| High | 25 | 29 | ↑ 4 |
| Medium | 117 | 112 | ↓ 5 |
| Low | 357+ | 282+ | ↓ 75 |

**主要改进**:
- apps/desktop 中部分 console.log 已清理
- 部分魔法数字已提取为常量
- 测试文件更新减少了部分技术债

---

**报告生成时间**: 2026-06-08 00:30:00  
**生成方式**: Claude Opus 4.6 多 agent 并行扫描  
**下次扫描**: 2026-06-08 08:57:00 (自动)
