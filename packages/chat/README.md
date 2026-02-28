# @viben/chat

Viben 聊天 UI 组件库，提供可复用的对话界面组件。所有组件均为平台无关设计，通过回调 props 处理平台特定功能。

## 安装

```bash
pnpm add @viben/chat
```

## 主要组件

### ChatInput

统一的聊天输入组件，支持多种配置模式。

**基础功能（始终启用）：**
- 自动调整高度的文本框（40-200px）
- 附件预览区域
- 底部操作栏（添加按钮 + 发送按钮）
- IME 输入法处理
- 粘贴图片支持

**通过 props 控制的功能：**
- `showTopToolbar` - 显示顶部工具栏（表情、文件、截图、展开按钮）
- `showConfigBar` - 显示配置栏（智能体、模型、工具、技能选择器）
- `showResizeHandle` - 显示拖拽调整高度手柄
- `enableWritingMode` - 启用全屏写作模式

#### 基础用法（简单输入）

适用于任务面板、调试面板等简单场景：

```tsx
import { ChatInput } from "@viben/chat";

function SimpleChatPanel() {
  const handleSend = (text: string, attachments?: MessageAttachment[]) => {
    console.log("发送消息:", text, attachments);
  };

  return (
    <ChatInput
      onSend={handleSend}
      onCancel={() => {}}
      isLoading={false}
      placeholder="输入消息..."
    />
  );
}
```

#### 完整功能用法（智能体聊天）

适用于工作区主聊天界面：

```tsx
import { ChatInput } from "@viben/chat";

function AgentChatPanel() {
  return (
    <ChatInput
      onSend={handleSend}
      onCancel={handleCancel}
      isLoading={isLoading}
      // 启用完整功能
      showTopToolbar={true}
      showConfigBar={true}
      showResizeHandle={true}
      enableWritingMode={true}
      // 智能体选择
      agents={agentList}
      selectedAgentId={currentAgentId}
      onAgentChange={setCurrentAgentId}
      // 模型选择
      models={modelList}
      selectedModelId={currentModelId}
      onModelChange={setCurrentModelId}
      // 工具配置
      tools={toolList}
      onToggleTool={handleToggleTool}
      enabledToolsCount={3}
      // 平台特定功能
      onScreenshot={handleScreenshot}
      onOpenFile={handleOpenFile}
      // 斜杠命令
      slashCommands={commands}
      onSlashCommand={handleSlashCommand}
    />
  );
}
```

### MessageList / MessageItem

消息列表和消息项组件：

```tsx
import { MessageList, MessageItem } from "@viben/chat";

function ChatMessages() {
  return (
    <MessageList
      messages={messages}
      isLoading={isLoading}
      renderMessage={(message) => (
        <MessageItem
          message={message}
          onCopy={handleCopy}
          onRetry={handleRetry}
        />
      )}
    />
  );
}
```

### ToolExecutionItem

工具执行状态显示组件：

```tsx
import { ToolExecutionItem } from "@viben/chat";

<ToolExecutionItem
  toolName="read_file"
  input={{ path: "/src/index.ts" }}
  output="文件内容..."
  status="completed"
/>
```

### PlanApproval

任务计划审批组件：

```tsx
import { PlanApproval } from "@viben/chat";

<PlanApproval
  plan={taskPlan}
  onApprove={handleApprove}
  onReject={handleReject}
/>
```

### QuestionInput

智能体提问回复组件：

```tsx
import { QuestionInput } from "@viben/chat";

<QuestionInput
  questions={pendingQuestions}
  onSubmit={handleAnswer}
/>
```

## 辅助组件

| 组件 | 描述 |
|------|------|
| `EmojiPicker` | 表情选择器 |
| `ToolsConfigPopover` | 工具配置弹出层 |
| `SkillsConfigPopover` | 技能配置弹出层 |
| `ContextDetailsPopover` | 上下文详情弹出层 |
| `AttachmentPreview` | 附件预览组件 |
| `SlashCommandMenu` | 斜杠命令菜单 |
| `WritingMode` | 全屏写作模式 |

## Hooks

| Hook | 描述 |
|------|------|
| `useAttachments` | 附件管理 |
| `useSlashCommands` | 斜杠命令处理 |
| `useResizableHeight` | 可调整高度 |
| `useIMEComposition` | IME 输入法状态 |
| `useAutoFocus` | 自动聚焦 |

## 类型导出

```tsx
import type {
  ChatInputProps,
  AgentOption,
  ModelOption,
  ExecutorOption,
  MessageAttachment,
  AgentMessage,
  SlashCommand,
  ToolConfig,
  SkillConfig,
} from "@viben/chat";
```

## 依赖

### Peer Dependencies

- `react` ^19.0.0
- `@viben/ui` workspace:*

### 核心依赖

- `lucide-react` - 图标
- `react-i18next` - 国际化
- `tailwind-merge` - 样式合并
