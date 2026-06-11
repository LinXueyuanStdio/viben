# ACP Chat 缺失交互功能补全设计

## Context

`apps/desktop/src/components/acp-chat/acp-chat.tsx` 是桌面端的 ACP Chat 组件，`packages/core/examples/acp-client/src/App.tsx` 是功能完整的 ACP 调试客户端参考实现。

对比后发现桌面端缺失以下交互功能：

1. **Tool Call Inspect 弹窗** — 点击 MessageList 中的 tool call item 应弹出详情面板（显示 input/output/状态）
2. **Artifact 点击弹窗** — 点击 artifact 卡片应弹出内容详情
3. **SubagentSheet loadSubagentDetails** — 动态加载 subagent 详情（用于懒加载 subagent 消息）
4. **Context Approval 按钮 + Popup** — 在 bottom toolbar 显示上下文用量按钮，hover/click 出详情弹窗

### 目标

补全上述 4 项交互能力，使桌面端 ACP Chat 具备与参考实现一致的 UI 交互。

## 设计方案

### 1. Tool Call Inspect 弹窗

**功能**：点击 MessageList 中 tool_use 类型的消息 item 时，弹出 Sheet/Dialog 展示 tool call 的详细信息。

**实现路径**：

- 在 `use-acp-session.ts` 中新增 `handleInspectTool` callback 和 `toolInspectState` 状态
- `handleInspectTool` 接收 `AgentMessage`，从 `messages` 中查找对应 `tool_result`，设置 state
- 在 `acp-chat.tsx` 中渲染 `ToolInspectSheet`（使用 `@viben/ui` 的 Sheet 组件）
- 将 `onInspectTool` 传入 `chatAppProps` 和 `ChatAppFullscreenMessagePanel`

**Sheet 内容**：
```
┌─────────────────────────────────────────┐
│ Sheet: Tool Call Details                │
│ subtitle: {toolName} / {toolUseId}      │
├─────────────────────────────────────────┤
│  Status:  [completed] [error?]          │
│  Tool:    {name}                        │
│  ID:      {toolUseId}                   │
│  Subagent: {subagentId}  (if exists)    │
├─────────────────────────────────────────┤
│  ┌─── Input ──────────────────────────┐ │
│  │ JSON tree / formatted view         │ │
│  └────────────────────────────────────┘ │
│  ┌─── Output ─────────────────────────┐ │
│  │ JSON tree / text view              │ │
│  └────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

**参考实现**：App.tsx L1051-1056 (`handleInspectTool`) 和 L2612-2667 (`ToolInspectModal`)

### 2. Artifact 点击弹窗

**功能**：点击 MessageList 中的 artifact 引用时，弹出 Sheet 展示 artifact 详情和来源消息。

**实现路径**：

- 在 `use-acp-session.ts` 中新增 `handleArtifactClick` callback 和 `artifactDialogState` 状态
- `handleArtifactClick(artifactId)` 从 `artifacts` 和 `messages` 查找相关数据
- 在 `acp-chat.tsx` 中渲染 `ArtifactSheet`
- 将 `onArtifactClick` 传入 `chatAppProps` 和 `ChatAppFullscreenMessagePanel`

**Sheet 内容**：
```
┌─────────────────────────────────────────┐
│ Sheet: Artifact                         │
│ subtitle: {artifact.name}               │
├─────────────────────────────────────────┤
│  Details:                               │
│    ID:   {artifact.id}                  │
│    Type: {artifact.type}                │
│    Tool: {artifact.toolName}            │
│    Source: {artifact.sourceMessageId}   │
├─────────────────────────────────────────┤
│  Source Message:                        │
│  ┌────────────────────────────────────┐ │
│  │ JSON tree / content view           │ │
│  └────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

**参考实现**：App.tsx L1058-1063 (`handleArtifactClick`) 和 L2398-2449 (`ArtifactModal`)

### 3. SubagentSheet loadSubagentDetails

**功能**：SubagentSheet 组件支持懒加载 subagent 详情，在打开 subagent 详情时异步获取完整消息列表。

**实现路径**：

- 在 `use-acp-session.ts` 中新增 `handleLoadSubagentDetails` callback
- 实现逻辑：从 `sessionsById` 的 `messageUpdates` 中通过 `resolveLiveSubagentMessages` 查找活跃消息，从 `uiMessages` 中查找父消息提取 title/subagentType
- 在 `subagentSheet` prop 中传入 `loadSubagentDetails`
- 在 `chatAppProps` 中传入 `loadSubagentDetails`

**参考实现**：App.tsx L1012-1049 (`handleLoadSubagentDetails`)

### 4. Context Approval 按钮 + Popup

**功能**：在 bottom toolbar 左侧展示上下文 token 用量环形进度按钮，hover 或 click 弹出详细的 token 用量分解和审批模式切换。

**实现路径**：

- 在 `acp-chat.tsx` 中：
  - 新增 `approvalMode` state（`ApprovalMode` 类型）
  - 新增 `contextBreakdown` memoized 值（`ContextTokenBreakdown` 类型），计算逻辑参考 App.tsx 的 `buildChatContextBreakdown`
  - 使用 `useContextApprovalPopupProps` hook 获取 popup props
  - 新增 hover/click 状态管理（`isContextPopupOpen`, `isContextPopupPinned`）
  - 在 `bottomToolbarLeftContent` 中添加 `ContextApprovalButton` + `ContextApprovalPopup`
- 从 `@viben/chat` 导入 `ContextApprovalButton`、`ContextApprovalPopup`、`useContextApprovalPopupProps`

**UI 布局**（在 bottomToolbarLeftContent 中）：
```
[TripleSelector] [ContextApprovalButton] [Settings] --- [VoiceInput]
                        ↑
                 hover/click 弹出:
         ┌────────────────────────────────┐
         │ ContextApprovalPopup           │
         │  - Token 用量进度条            │
         │  - 分项: profile/skills/...    │
         │  - 审批模式切换                 │
         └────────────────────────────────┘
```

**参考实现**：App.tsx L2037-2092（`bottomToolbarLeftContent` 中的 ContextApproval 交互）

## 文件修改清单

| 文件 | 修改内容 |
|------|----------|
| `apps/desktop/src/components/acp-chat/use-acp-session.ts` | 新增 `handleInspectTool`、`handleArtifactClick`、`handleLoadSubagentDetails` 及对应 state；暴露到返回值 |
| `apps/desktop/src/components/acp-chat/acp-chat.tsx` | 1) 导入新组件和类型；2) 解构新 handler；3) 新增 ContextApproval state + contextBreakdown 计算；4) 渲染 ToolInspectSheet 和 ArtifactSheet；5) 更新 chatAppProps 传入 onInspectTool/onArtifactClick/loadSubagentDetails；6) 在 bottomToolbarLeftContent 添加 ContextApprovalButton |

## 新增组件/文件

不需要新建组件文件。所有弹窗使用 `@viben/ui` 的 `Sheet` / `SheetContent` 组件，直接在 `acp-chat.tsx` 中内联渲染（参考现有 SubagentSheet 模式）。如果 Tool Inspect 和 Artifact 弹窗逻辑较复杂，可抽取为同目录下的独立文件：

- `apps/desktop/src/components/acp-chat/tool-inspect-sheet.tsx`（可选）
- `apps/desktop/src/components/acp-chat/artifact-sheet.tsx`（可选）

## 数据流

```
use-acp-session.ts
  ├── messages, artifacts, sessionsById, messageUpdates
  ├── handleInspectTool(message) → setToolInspectState({message, result})
  ├── handleArtifactClick(artifactId) → setArtifactState({artifact, message})
  └── handleLoadSubagentDetails(context) → resolve from sessionsById

acp-chat.tsx
  ├── chatAppProps.onInspectTool = handleInspectTool
  ├── chatAppProps.onArtifactClick = handleArtifactClick
  ├── chatAppProps.loadSubagentDetails = handleLoadSubagentDetails  (new)
  ├── chatAppProps.subagentSheet.loadSubagentDetails = handleLoadSubagentDetails  (new)
  ├── fullscreenContent → onInspectTool, onArtifactClick
  ├── <ToolInspectSheet />  (conditional render)
  ├── <ArtifactSheet />  (conditional render)
  └── bottomToolbarLeftContent → <ContextApprovalButton> + <ContextApprovalPopup>
```

## 验证

1. 启动 desktop app（`pnpm desktop:restart`），连接 ACP session
2. 发送一条触发 tool call 的 prompt（如 "读取文件 package.json"）
3. 点击 MessageList 中的 tool call item → 应弹出 Sheet 显示 input/output
4. 如有 artifact 生成，点击 artifact 卡片 → 应弹出详情 Sheet
5. 如有 subagent 任务，打开 SubagentSheet → 应能懒加载 messages
6. 查看 bottom toolbar → ContextApprovalButton 应显示环形进度
7. Hover/Click ContextApprovalButton → 弹出 ContextApprovalPopup，显示 token 分解
8. 运行 `pnpm typecheck` 确保无类型错误
