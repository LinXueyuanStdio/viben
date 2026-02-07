# 聊天输入组件规格

本文档定义了 viben desktop 应用中统一的聊天输入组件 `ChatInput`。

## 组件概览

| 组件 | 用途 | 文件 |
|------|------|------|
| `ChatInput` | 统一聊天输入组件 | `chat-input.tsx` |

通过 Props 控制不同的布局和功能：

| 配置 | 用途 | 主要 Props |
|------|------|-----------|
| 基础模式 | 简单对话输入 | (默认) |
| 紧凑模式 | 回复消息 | `variant="compact"` |
| 工作空间模式 | 完整功能 | `showTopToolbar` `showConfigBar` `showResizeHandle` `enableWritingMode` |

## Props 接口

```typescript
export interface ChatInputProps {
  // 基础 Props
  onSend: (content: string, attachments?: MessageAttachment[]) => void;
  onCancel?: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;

  // 布局控制
  /** 变体: 'default' 标准样式, 'compact' 紧凑回复样式 */
  variant?: "default" | "compact";
  /** 显示顶部工具栏 (表情、文件、截图、展开) */
  showTopToolbar?: boolean;
  /** 显示底部配置栏 (智能体、模型、工具、技能、上下文) */
  showConfigBar?: boolean;
  /** 显示可调高度手柄 */
  showResizeHandle?: boolean;
  /** 启用全屏写作模式 */
  enableWritingMode?: boolean;

  // 全局配置模式
  /**
   * 使用 useChatConfig hook 的全局配置。
   * 启用时，智能体/模型从全局 store 加载，
   * 选择器显隐由当前路由上下文决定。
   * Props 覆盖仍可用于灵活性。
   */
  useGlobalConfig?: boolean;

  // 智能体/模型选择 (用于配置栏，props 覆盖优先于全局配置)
  agents?: Array<{ id: string; name: string }>;
  selectedAgentId?: string | null;
  onAgentChange?: (agentId: string) => void;
  models?: Array<{ id: string; name: string; provider?: string }>;
  selectedModelId?: string | null;
  onModelChange?: (modelId: string) => void;

  // 工具/技能 (用于配置栏)
  enabledToolsCount?: number;
  enabledSkillsCount?: number;
  onToolsClick?: () => void;
  onSkillsClick?: () => void;
  /** 可用工具列表 (用于工具配置弹窗) */
  tools?: ToolConfig[];
  /** 切换工具启用状态回调 */
  onToggleTool?: (toolId: string, enabled: boolean) => void;
  /** 可用技能列表 (用于技能配置弹窗) */
  skills?: SkillConfig[];
  /** 切换技能启用状态回调 */
  onToggleSkill?: (skillId: string, enabled: boolean) => void;

  // 上下文 (用于配置栏)
  contextTokens?: number;
  onContextClick?: () => void;
  /** 上下文 Token 分布详情 */
  contextBreakdown?: ContextTokenBreakdown;

  // 截图 (用于顶部工具栏)
  onScreenshot?: (hideWindow?: boolean) => void;
}
```

## 功能特性

| 特性 | 支持 | 说明 |
|------|------|------|
| 文本输入 | ✅ | 自动调整高度的 textarea |
| 图片附件 | ✅ | 支持粘贴和选择图片 |
| 文件附件 | ✅ | 支持 PDF、DOC、TXT 等 |
| IME 输入 | ✅ | 中文输入法兼容 |
| 快捷键发送 | ✅ | Enter 发送，Shift+Enter 换行 |
| 取消/停止 | ✅ | 加载时显示停止按钮 |
| 顶部工具栏 | ✅ | 表情、文件、截图、展开 (showTopToolbar) |
| 底部配置栏 | ✅ | 智能体、模型、工具等选择器 (showConfigBar) |
| 可调高度 | ✅ | 拖拽调整，保存到 localStorage (showResizeHandle) |
| 写作模式 | ✅ | 全屏展开模式 (enableWritingMode) |

## 布局结构

### 基础模式 (默认)

```
┌─────────────────────────────────────┐
│ [附件预览区]                         │
├─────────────────────────────────────┤
│                                     │
│ [文本输入区]                         │
│                                     │
├─────────────────────────────────────┤
│ [+添加] ←──────────────────→ [发送] │
└─────────────────────────────────────┘
```

### 紧凑模式 (variant="compact")

```
┌─────────────────────────────────────┐
│ [附件预览区]                         │
├─────────────────────────────────────┤
│ [文本输入区] (更小的尺寸)             │
├─────────────────────────────────────┤
│ [+添加] ←──────────────────→ [发送] │
└─────────────────────────────────────┘
```

### 工作空间模式 (带工具栏和配置栏)

```
┌─────────────────────────────────────────────────────┐
│ [拖拽调整手柄]                       (showResizeHandle) │
├─────────────────────────────────────────────────────┤
│ [表情] [文件] [截图 ▼] ←───────────→ [展开]        │ ← showTopToolbar
├─────────────────────────────────────────────────────┤
│ [附件预览区]                                         │
├─────────────────────────────────────────────────────┤
│                                                     │
│ [文本输入区] (可调高度: 80px - 400px)                │
│                                                     │
├─────────────────────────────────────────────────────┤
│ [智能体▼] [模型▼] [工具] [技能] [2.5k] [发送]      │ ← showConfigBar
└─────────────────────────────────────────────────────┘
```

**配置栏按钮样式**:
- **智能体/模型按钮**: 显示 icon + 名称 + 下拉箭头
- **工具/技能按钮**: 仅显示 icon + 角标数字（启用数量 > 0 时）
- **上下文按钮**: 仅显示 icon + token 数量（如 "2.5k"，无 "tokens" 文字）

**无卡片样式**: 当启用 `showTopToolbar` 或 `showConfigBar` 时，组件不显示圆角边框和阴影，填满父容器

## 变体差异

| 属性 | default | compact | workspace模式 |
|------|---------|---------|---------------|
| 边框圆角 | rounded-2xl | rounded-xl | 无 |
| 边框阴影 | 有 | 有 | 无 |
| 内边距 | p-4 | p-3 | - |
| 最小高度 | 40px | 20px | - |
| 最大高度 | 200px | 120px | 可调 (80-400px) |

**注**: workspace模式指启用 `showTopToolbar` 或 `showConfigBar` 的情况
| 按钮大小 | size-8 | size-7 |

## 高度调整 (showResizeHandle)

| 属性 | 值 |
|------|-----|
| 最小高度 | 80px |
| 最大高度 | 400px |
| 默认高度 | 80px |
| 存储键 | `chat_input_height` |

## 写作模式 (enableWritingMode)

当点击展开按钮时：
- 组件变为全屏固定定位 (`fixed inset-4 z-50`)
- 输入区高度自动计算 (`calc(100% - 140px)`)
- ESC 键可退出写作模式

---

## 使用指南

### 场景与配置

| 场景 | Props 配置 |
|------|-----------|
| 简单消息回复 | `variant="compact"` |
| 基础对话框 | (默认) |
| 工作空间对话 | `showTopToolbar showConfigBar showResizeHandle enableWritingMode` |
| 带配置的对话 | `showConfigBar` + agent/model props |

### 示例代码

#### 基础用法

```tsx
<ChatInput
  onSend={handleSend}
  placeholder="输入消息..."
  autoFocus
/>
```

#### 紧凑回复框

```tsx
<ChatInput
  variant="compact"
  onSend={handleReply}
  onCancel={handleCancel}
  isLoading={isSending}
/>
```

#### 完整工作空间模式

```tsx
<ChatInput
  onSend={handleSend}
  onCancel={handleCancel}
  isLoading={isStreaming}
  showTopToolbar
  showConfigBar
  showResizeHandle
  enableWritingMode
  agents={workspaceAgents}
  selectedAgentId={currentAgentId}
  onAgentChange={setCurrentAgentId}
  models={availableModels}
  selectedModelId={currentModelId}
  onModelChange={setCurrentModelId}
  enabledToolsCount={5}
  onToolsClick={openToolsConfig}
  enabledSkillsCount={3}
  onSkillsClick={openSkillsConfig}
  contextTokens={2500}
  onContextClick={showContextDetails}
  onScreenshot={handleScreenshot}
/>
```

---

## 共享模式

### 附件类型定义

```typescript
interface MessageAttachment {
  id: string;
  type: "image" | "file";
  name: string;
  data?: string;        // base64 data URL
  mimeType?: string;
  isLoading?: boolean;
}
```

### 图片文件检测

```typescript
const isImageFile = (file: File): boolean => {
  if (file.type.startsWith("image/")) return true;
  const ext = file.name.split(".").pop()?.toLowerCase();
  return ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "ico"].includes(ext || "");
};
```

### IME 输入处理

```typescript
const isComposingRef = React.useRef(false);

const handleKeyDown = (e: React.KeyboardEvent) => {
  if (e.key === "Enter" && !e.shiftKey && !isComposingRef.current) {
    e.preventDefault();
    handleSend();
  }
};

// onCompositionStart={() => isComposingRef.current = true}
// onCompositionEnd={() => setTimeout(() => isComposingRef.current = false, 10)}
```

### 文件读取

```typescript
const createFilePreview = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (result) resolve(result);
      else reject(new Error("Failed to read file"));
    };
    reader.onerror = () => reject(new Error("FileReader error"));
    reader.readAsDataURL(file);
  });
};
```

### 粘贴图片处理

```typescript
const handlePaste = async (e: React.ClipboardEvent) => {
  const items = e.clipboardData.items;
  const imageFiles: File[] = [];

  for (let i = 0; i < items.length; i++) {
    if (items[i].type.startsWith("image/")) {
      const file = items[i].getAsFile();
      if (file) imageFiles.push(file);
    }
  }

  if (imageFiles.length > 0) {
    e.preventDefault();
    await addFiles(imageFiles, true);
  }
};
```

---

## 国际化键

| 键 | 说明 |
|----|------|
| `chat.inputPlaceholder` | 输入框占位符 |
| `chat.attachImage` | 附加图片 |
| `chat.attachFile` | 附加文件 |
| `chat.emoji` | 表情 |
| `chat.screenshot` | 截图 |
| `chat.screenshotDirect` | 直接截图 |
| `chat.screenshotHideWindow` | 隐藏窗口截图 |
| `chat.expand` | 展开 |
| `chat.collapse` | 收起 |
| `chat.selectAgent` | 智能体 |
| `chat.selectModel` | 模型 |
| `chat.tools` | 工具 |
| `chat.skills` | 技能 |
| `chat.noAgents` | 暂无智能体 |
| `chat.noModels` | 暂无模型 |
| `chat.configureTools` | 配置工具 |
| `chat.configureSkills` | 配置技能 |
| `chat.contextDetails` | 上下文明细 |

---

## 迁移指南

从旧组件迁移到统一 `ChatInput`:

### AgentChatInput 迁移

旧代码:
```tsx
<AgentChatInput onSend={...} models={...} />
```

新代码:
```tsx
<ChatInput onSend={...} />
```

注意：AgentChatInput 的高级功能（模型参数调节、Token 统计弹窗等）已简化为基础的 showConfigBar 配置栏。如需完整功能，可在 showConfigBar 基础上扩展。

### WorkspaceChatInput 迁移

旧代码:
```tsx
<WorkspaceChatInput
  onSend={...}
  agents={...}
  selectedAgentId={...}
  onScreenshot={...}
/>
```

新代码:
```tsx
<ChatInput
  onSend={...}
  showTopToolbar
  showConfigBar
  showResizeHandle
  enableWritingMode
  agents={...}
  selectedAgentId={...}
  onScreenshot={...}
/>
```

---

## 辅助组件

### EmojiPicker

表情选择器组件，显示常用表情分类网格。

```tsx
interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  className?: string;
}
```

**分类**:
- Smileys (笑脸)
- Gestures (手势)
- Objects (物品)
- Nature (自然)
- Food (食物)
- Symbols (符号)

### ToolsConfigPopover

工具配置弹窗，显示可用工具列表，支持启用/禁用切换。

```tsx
interface ToolConfig {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
}

interface ToolsConfigPopoverProps {
  tools: ToolConfig[];
  onToggleTool: (toolId: string, enabled: boolean) => void;
  className?: string;
}
```

### SkillsConfigPopover

技能配置弹窗，与工具配置类似。

```tsx
interface SkillConfig {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
}

interface SkillsConfigPopoverProps {
  skills: SkillConfig[];
  onToggleSkill: (skillId: string, enabled: boolean) => void;
  className?: string;
}
```

### ContextDetailsPopover

上下文详情弹窗，显示 Token 使用分布。

```tsx
interface ContextTokenBreakdown {
  assistantProfile: number;    // 助理档案
  skillSettings: number;       // 技能设定
  historySummary: number;      // 历史总结
  conversationMessages: number; // 会话消息
  totalContext: number;        // 总上下文窗口
}

interface ContextDetailsPopoverProps {
  breakdown: ContextTokenBreakdown;
  className?: string;
}
```

---

## 全局配置模式

### useChatConfig Hook

当 `useGlobalConfig` prop 为 true 时，ChatInput 使用 `useChatConfig` hook 来获取智能体/模型列表和控制选择器显隐。

**Hook 特性**:
- 从全局 store 加载智能体和模型列表
- 根据当前路由上下文决定选择器显隐
- Props 覆盖优先于全局配置

**路由上下文检测**:

| 路由模式 | 上下文类型 | 智能体选择器 | 模型选择器 |
|---------|----------|------------|----------|
| `/agents/:id` | agent-debug | 隐藏 | 隐藏 |
| `/workspace/:id/chat` | workspace | 显示 | 显示 |
| 其他路由 | default | 显示 | 显示 |

**使用示例**:

```tsx
// 使用全局配置（自动加载智能体/模型，自动检测路由上下文）
<ChatInput
  onSend={handleSend}
  showConfigBar
  useGlobalConfig
/>

// Props 覆盖（即使启用全局配置，props 优先）
<ChatInput
  onSend={handleSend}
  showConfigBar
  useGlobalConfig
  agents={customAgents}  // 覆盖全局智能体列表
/>
```

### 相关文件

| 文件 | 说明 |
|------|------|
| `types/chat-config.ts` | 类型定义 |
| `stores/chat-config-store.ts` | Zustand store |
| `hooks/use-chat-config.ts` | 配置 hook |

---

## 更新日志

- **2026-02-08**: 优化按钮样式和容器样式
  - 移除 workspace 模式下的卡片样式（无圆角、边框、阴影）
  - Tools/Skills 按钮改为仅显示 icon + 角标数字
  - Context 按钮改为仅显示 icon + token 数量（无 "tokens" 文字）
  - Agent/Model 按钮保持 icon + 名称 + 下拉箭头

- **2026-02-08**: 实现动态智能体/模型选择 (Phase 3)
  - 新增 useChatConfig hook 和 chat-config store
  - 支持路由上下文检测，智能体调试页隐藏选择器
  - ChatInput 新增 useGlobalConfig prop
  - Props 覆盖优先于全局配置

- **2026-02-08**: 实现按钮功能组件 (Phase 2)
  - 新增 EmojiPicker 表情选择器
  - 新增 ToolsConfigPopover 工具配置弹窗
  - 新增 SkillsConfigPopover 技能配置弹窗
  - 新增 ContextDetailsPopover 上下文详情弹窗
  - ChatInput 集成所有弹窗组件

- **2026-02-08**: 合并 ChatInput, AgentChatInput, WorkspaceChatInput 为统一组件
  - 使用 Props 控制功能显隐
  - 删除 agent-chat-input.tsx 和 workspace-chat-input.tsx
  - 保留 variant="compact" 紧凑模式
  - 添加 showTopToolbar, showConfigBar, showResizeHandle, enableWritingMode props
