---
sidebar_position: 6
title: Chat Input Components
description: ChatInput and MessageList unified component specification
---

# Chat Input Component Specification

This document defines the unified chat input component `ChatInput` and message list component `MessageList` in the viben application.

## Architecture Overview

```
@viben/chat (packages/chat/)          # Cross-platform shared package
├── src/
│   ├── chat-input/                   # ChatInput component directory
│   │   ├── index.tsx                 # Main component
│   │   ├── types.ts                  # Type definitions
│   │   ├── hooks.ts                  # Reusable hooks
│   │   ├── toolbar.tsx               # Top toolbar
│   │   ├── config-bar.tsx            # Bottom config bar
│   │   ├── writing-mode.tsx          # Fullscreen writing mode
│   │   ├── attachment-preview.tsx    # Attachment preview
│   │   └── slash-command-menu.tsx    # Slash command menu
│   ├── message-list.tsx              # Message list
│   ├── message-item.tsx              # Message item
│   └── index.ts                      # Export entry

apps/desktop/src/components/chat/     # Desktop platform adapter
├── desktop-chat-input.tsx            # Tauri wrapper (screenshot, file dialog)
├── desktop-message-list.tsx          # Tauri wrapper (link opening)
└── index.ts                          # Export
```

## Component Overview

| Component | Package | Purpose |
|-----------|---------|---------|
| `ChatInput` | `@viben/chat` | Cross-platform chat input component |
| `MessageList` | `@viben/chat` | Cross-platform message list component |
| `MessageItem` | `@viben/chat` | Cross-platform message item component |
| `DesktopChatInput` | desktop | Tauri-specific wrapper |
| `DesktopMessageList` | desktop | Tauri-specific wrapper |

Control different layouts and features via Props:

| Configuration | Purpose | Main Props |
|---------------|---------|------------|
| Basic mode | Simple conversation input | (default) |
| Workspace mode | Full functionality | `showTopToolbar` `showConfigBar` `showResizeHandle` `enableWritingMode` |

## Props Interface

```typescript
export interface ChatInputProps {
  // Basic Props
  onSend: (content: string, attachments?: MessageAttachment[]) => void;
  onCancel?: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;

  // Layout control
  /** Show top toolbar (emoji, file, screenshot, expand) */
  showTopToolbar?: boolean;
  /** Show bottom config bar (agent, model, tools, skills, context) */
  showConfigBar?: boolean;
  /** Show resizable height handle */
  showResizeHandle?: boolean;
  /** Enable fullscreen writing mode */
  enableWritingMode?: boolean;

  // Global config mode
  /**
   * Use global config from useChatConfig hook.
   * When enabled, agent/model loaded from global store,
   * selector visibility determined by current route context.
   * Props override still available for flexibility.
   */
  useGlobalConfig?: boolean;

  // Agent/Model selection (for config bar, props override takes priority over global config)
  agents?: Array<{ id: string; name: string }>;
  selectedAgentId?: string | null;
  onAgentChange?: (agentId: string) => void;
  models?: Array<{ id: string; name: string; provider?: string }>;
  selectedModelId?: string | null;
  onModelChange?: (modelId: string) => void;

  // Tools/Skills (for config bar)
  enabledToolsCount?: number;
  enabledSkillsCount?: number;
  onToolsClick?: () => void;
  onSkillsClick?: () => void;
  /** Available tools list (for tools config popover) */
  tools?: ToolConfig[];
  /** Toggle tool enabled state callback */
  onToggleTool?: (toolId: string, enabled: boolean) => void;
  /** Available skills list (for skills config popover) */
  skills?: SkillConfig[];
  /** Toggle skill enabled state callback */
  onToggleSkill?: (skillId: string, enabled: boolean) => void;

  // Context (for config bar)
  contextTokens?: number;
  onContextClick?: () => void;
  /** Context token breakdown details */
  contextBreakdown?: ContextTokenBreakdown;

  // Screenshot (for top toolbar)
  onScreenshot?: (hideWindow?: boolean) => void;

  // Selector visibility override
  /** Force hide agent selector */
  hideAgentSelector?: boolean;
  /** Force hide model selector */
  hideModelSelector?: boolean;

  // Slash commands
  /** Available slash commands list */
  slashCommands?: SlashCommand[];
  /** Command selection callback */
  onSlashCommand?: (command: SlashCommand) => void;
}
```

## Features

| Feature | Supported | Description |
|---------|-----------|-------------|
| Text input | ✅ | Auto-resizing textarea |
| Image attachments | ✅ | Support paste and select images |
| File attachments | ✅ | Support PDF, DOC, TXT, etc. |
| IME input | ✅ | Chinese input method compatible |
| Keyboard shortcut send | ✅ | Enter to send, Shift+Enter for newline |
| Cancel/Stop | ✅ | Show stop button when loading |
| Top toolbar | ✅ | Emoji, file, screenshot, expand (showTopToolbar) |
| Bottom config bar | ✅ | Agent, model, tools selectors (showConfigBar) |
| Resizable height | ✅ | Drag to resize, saved to localStorage (showResizeHandle) |
| Writing mode | ✅ | Fullscreen expand mode (enableWritingMode) |
| Slash commands | ✅ | Show command menu on "/" input (slashCommands) |
| Selector hiding | ✅ | Force hide agent/model selectors (hideAgentSelector, hideModelSelector) |

## Layout Structure

### Basic Mode (Default)

All scenarios use unified basic input style:
- Auto-resizing textarea (40-200px)
- Attachment preview area
- Bottom action bar: Add button + Send button
- No rounded borders or shadows (fills parent container)

```
┌─────────────────────────────────────┐
│ [Attachment Preview Area]           │
├─────────────────────────────────────┤
│                                     │
│ [Text Input Area] (auto-resize)     │
│                                     │
├─────────────────────────────────────┤
│ [+Add] ←────────────────────→ [Send]│
└─────────────────────────────────────┘
```

### Workspace Mode (with Toolbar and Config Bar)

```
┌─────────────────────────────────────────────────────┐
│ [Drag Resize Handle]                 (showResizeHandle) │
├─────────────────────────────────────────────────────┤
│ [Emoji] [File] [Screenshot ▼] ←─────────→ [Expand]  │ ← showTopToolbar
├─────────────────────────────────────────────────────┤
│ [Attachment Preview Area]                           │
├─────────────────────────────────────────────────────┤
│                                                     │
│ [Text Input Area] (resizable: 80px - 400px)         │
│                                                     │
├─────────────────────────────────────────────────────┤
│ [Agent▼] [Model▼] [Tools] [Skills] [2.5k] [Send]    │ ← showConfigBar
└─────────────────────────────────────────────────────┘
```

**Config bar button styles**:
- **Agent/Model buttons**: Show icon + name + dropdown arrow
- **Tools/Skills buttons**: Show only icon + badge number (when enabled count > 0)
- **Context button**: Show only icon + token count (e.g., "2.5k", no "tokens" text)

**No card style**: When `showTopToolbar` or `showConfigBar` is enabled, component shows no rounded borders or shadows, fills parent container

## Style Notes

| Property | Value |
|----------|-------|
| Border radius | None (provided by parent container) |
| Box shadow | None (provided by parent container) |
| Min height | 40px (basic mode) / 80px (with toolbar mode) |
| Max height | 200px (basic mode) / 400px (with toolbar mode) |
| Button size | size-8 |

**Important**: ChatInput component does **not** provide card styles (border, radius, shadow). Parent component is responsible for providing required container styles.

Basic mode usage example:
```tsx
{/* Parent container provides card style */}
<div className="rounded-2xl border border-border/50 shadow-lg overflow-hidden">
  <ChatInput onSend={handleSend} />
</div>
```

With toolbar mode usage example:
```tsx
{/* Parent container only provides border separator */}
<div className="border-t border-border">
  <ChatInput showTopToolbar showConfigBar onSend={handleSend} />
</div>
```

## Height Adjustment (showResizeHandle)

| Property | Value |
|----------|-------|
| Min height | 80px |
| Max height | 400px |
| Default height | 80px |
| Storage key | `chat_input_height` |

## Writing Mode (enableWritingMode)

When expand button is clicked:
- Component becomes fullscreen fixed position (`fixed inset-4 z-50`)
- Input area height auto-calculated (`calc(100% - 140px)`)
- ESC key exits writing mode

---

## Usage Guide

### Desktop App Usage

**Must use Desktop* wrapper components**, they automatically inject Tauri-specific features:

```tsx
import { DesktopChatInput, DesktopMessageList } from "@/components/chat";

function WorkspaceChat() {
  return (
    <div className="flex flex-col h-full">
      <DesktopMessageList
        messages={messages}
        isStreaming={isStreaming}
      />
      <DesktopChatInput
        onSend={handleSend}
        showTopToolbar
        showConfigBar
        useGlobalConfig
      />
    </div>
  );
}
```

### Web App Usage

Use `@viben/chat` package directly, pass callbacks for platform features:

```tsx
import { ChatInput, MessageList } from "@viben/chat";

function WebChat() {
  return (
    <div className="flex flex-col h-full">
      <MessageList
        messages={messages}
        onLinkClick={(url) => window.open(url, "_blank")}
      />
      <ChatInput
        onSend={handleSend}
        showConfigBar
        // Don't pass onScreenshot, button auto-hides
      />
    </div>
  );
}
```

### Scenarios and Configuration

| Scenario | Props Configuration |
|----------|---------------------|
| Simple message reply | (default, no extra props) |
| Basic dialog | (default) |
| Workspace conversation | `showTopToolbar showConfigBar showResizeHandle enableWritingMode` |
| Conversation with config | `showConfigBar` + agent/model props |

### Example Code

#### Basic Usage

```tsx
<ChatInput
  onSend={handleSend}
  placeholder="Type a message..."
  autoFocus
/>
```

#### Simple Reply Box

```tsx
<ChatInput
  onSend={handleReply}
  onCancel={handleCancel}
  isLoading={isSending}
  autoFocus={false}
/>
```

#### Full Workspace Mode

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

## Shared Patterns

### Attachment Type Definition

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

### Image File Detection

```typescript
const isImageFile = (file: File): boolean => {
  if (file.type.startsWith("image/")) return true;
  const ext = file.name.split(".").pop()?.toLowerCase();
  return ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "ico"].includes(ext || "");
};
```

### IME Input Handling

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

### File Reading

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

### Paste Image Handling

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

## Internationalization Keys

| Key | Description |
|-----|-------------|
| `chat.inputPlaceholder` | Input placeholder |
| `chat.attachImage` | Attach image |
| `chat.attachFile` | Attach file |
| `chat.emoji` | Emoji |
| `chat.screenshot` | Screenshot |
| `chat.screenshotDirect` | Direct screenshot |
| `chat.screenshotHideWindow` | Screenshot with hidden window |
| `chat.expand` | Expand |
| `chat.collapse` | Collapse |
| `chat.selectAgent` | Agent |
| `chat.selectModel` | Model |
| `chat.tools` | Tools |
| `chat.skills` | Skills |
| `chat.noAgents` | No agents available |
| `chat.noModels` | No models available |
| `chat.configureTools` | Configure tools |
| `chat.configureSkills` | Configure skills |
| `chat.contextDetails` | Context details |
| `chat.noCommandsFound` | No commands found |
| `chat.slashCommands.clear` | Clear |
| `chat.slashCommands.clearDesc` | Clear conversation history |
| `chat.slashCommands.help` | Help |
| `chat.slashCommands.helpDesc` | Show available commands |
| `chat.slashCommands.stop` | Stop |
| `chat.slashCommands.stopDesc` | Stop current execution |

---

## Migration Guide

Migrate from old components to unified `ChatInput`:

### AgentChatInput Migration

Old code:
```tsx
<AgentChatInput onSend={...} models={...} />
```

New code:
```tsx
<ChatInput onSend={...} />
```

Note: Advanced features of AgentChatInput (model parameter adjustment, token statistics popover, etc.) have been simplified to basic showConfigBar config bar. For full functionality, extend based on showConfigBar.

### WorkspaceChatInput Migration

Old code:
```tsx
<WorkspaceChatInput
  onSend={...}
  agents={...}
  selectedAgentId={...}
  onScreenshot={...}
/>
```

New code:
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

## Helper Components

### EmojiPicker

Emoji picker component, displays common emoji category grid.

```tsx
interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  className?: string;
}
```

**Categories**:
- Smileys
- Gestures
- Objects
- Nature
- Food
- Symbols

### ToolsConfigPopover

Tools configuration popover, displays available tools list with enable/disable toggle.

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

Skills configuration popover, similar to tools configuration.

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

Context details popover, displays token usage breakdown.

```tsx
interface ContextTokenBreakdown {
  assistantProfile: number;    // Assistant profile
  skillSettings: number;       // Skill settings
  historySummary: number;      // History summary
  conversationMessages: number; // Conversation messages
  totalContext: number;        // Total context window
}

interface ContextDetailsPopoverProps {
  breakdown: ContextTokenBreakdown;
  className?: string;
}
```

---

## Global Config Mode

### useChatConfig Hook

When `useGlobalConfig` prop is true, ChatInput uses `useChatConfig` hook to get agent/model lists and control selector visibility.

**Hook Features**:
- Load agent and model lists from global store
- Determine selector visibility based on current route context
- Props override takes priority over global config

**Route Context Detection**:

| Route Pattern | Context Type | Agent Selector | Model Selector |
|---------------|--------------|----------------|----------------|
| `/agents/:id` | agent-debug | Hidden | Hidden |
| `/workspace/:id/chat` | workspace | Visible | Visible |
| Other routes | default | Visible | Visible |

**Usage Example**:

```tsx
// Use global config (auto-load agents/models, auto-detect route context)
<ChatInput
  onSend={handleSend}
  showConfigBar
  useGlobalConfig
/>

// Props override (even with global config enabled, props take priority)
<ChatInput
  onSend={handleSend}
  showConfigBar
  useGlobalConfig
  agents={customAgents}  // Override global agent list
/>
```

### Related Files

| File | Description |
|------|-------------|
| `types/chat-config.ts` | Type definitions |
| `stores/chat-config-store.ts` | Zustand store |
| `hooks/use-chat-config.ts` | Config hook |

---

## Slash Commands

### SlashCommand Type

```typescript
interface SlashCommand {
  id: string;
  name: string;           // e.g., "clear"
  description: string;    // e.g., "Clear conversation"
  icon?: React.ReactNode; // Optional icon
}
```

### Behavior

- Command menu appears above input when user types "/"
- Continue typing to filter command list (e.g., "/cl" matches "clear")
- Arrow keys to navigate, Enter/Tab to select, Escape to close
- On selection, calls `onSlashCommand` callback and clears slash input
- Shows "No commands found" when no matches

### Usage Example

```tsx
const slashCommands: SlashCommand[] = [
  {
    id: "clear",
    name: "clear",
    description: "Clear conversation history",
    icon: <Trash2 className="h-4 w-4" />,
  },
  {
    id: "help",
    name: "help",
    description: "Show available commands",
    icon: <HelpCircle className="h-4 w-4" />,
  },
];

<ChatInput
  onSend={handleSend}
  slashCommands={slashCommands}
  onSlashCommand={(cmd) => {
    if (cmd.id === "clear") clearMessages();
  }}
/>
```

---

## Selector Hiding

When in specific contexts (e.g., agent debug page), you may not need to show agent/model selectors. Use these props to force hide:

```tsx
<ChatInput
  showConfigBar
  hideAgentSelector  // Hide agent selector
  hideModelSelector  // Hide model selector
  // ... other props
/>
```

These props take priority over `useGlobalConfig` auto-detection.

---

## Changelog

- **2026-02-08**: Remove ChatInput card styles, parent container responsible for styling
  - ChatInput no longer provides any card styles (border, radius, shadow)
  - Parent component responsible for providing required container styles
  - Slash command menu z-index raised to z-[100] for visibility
  - workspace-chat.tsx basic mode adds card container wrapper

- **2026-02-08**: Add slash commands and selector hiding features
  - Added `slashCommands` and `onSlashCommand` props
  - Added `hideAgentSelector` and `hideModelSelector` props
  - Simplified writing mode layout (standalone rendering)
  - Unified all usage scenario configurations

- **2026-02-08**: Remove variant prop, unify base styles
  - Removed `variant="compact"` option
  - All scenarios use unified base styles
  - Features fully controlled by props (showTopToolbar, showConfigBar, etc.)
  - Updated all usages: task-detail-panel, debug-chat-panel, agent-detail, workspace-chat

- **2026-02-08**: Optimize button styles and container styles
  - Remove card styles in workspace mode (no radius, border, shadow)
  - Tools/Skills buttons changed to show only icon + badge number
  - Context button changed to show only icon + token count (no "tokens" text)
  - Agent/Model buttons keep icon + name + dropdown arrow

- **2026-02-08**: Implement dynamic agent/model selection (Phase 3)
  - Added useChatConfig hook and chat-config store
  - Support route context detection, hide selectors on agent debug page
  - ChatInput added useGlobalConfig prop
  - Props override takes priority over global config

- **2026-02-08**: Implement button feature components (Phase 2)
  - Added EmojiPicker emoji selector
  - Added ToolsConfigPopover tools config popover
  - Added SkillsConfigPopover skills config popover
  - Added ContextDetailsPopover context details popover
  - ChatInput integrated all popover components

- **2026-02-08**: Migrate to @viben/chat package, enable cross-platform reuse
  - ChatInput migrated to `packages/chat/src/chat-input/`, split into modular subcomponents
  - MessageList/MessageItem unified in package, using callback props for platform-specific features
  - Created Desktop adapter layer: `DesktopChatInput` and `DesktopMessageList`
  - Platform-specific features injected via callbacks: `onScreenshot`, `onOpenFile`, `onLinkClick`
  - All consumers migrated to use Desktop* components

- **2026-02-08**: Merge ChatInput, AgentChatInput, WorkspaceChatInput into unified component
  - Use Props to control feature visibility
  - Deleted agent-chat-input.tsx and workspace-chat-input.tsx
  - Added showTopToolbar, showConfigBar, showResizeHandle, enableWritingMode props
