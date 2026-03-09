# Desktop Chat - Workany Integration Spec

> **Reference**: `/Users/lxy/Documents/GitHub/others/workany`
> **Platform**: Desktop only (apps/desktop)

---

## Component Reference

### From workany (to port)

| Component | Path | Lines | Description |
|-----------|------|-------|-------------|
| TaskDetail | `src/app/pages/TaskDetail.tsx` | 1933 | Main chat page |
| ChatInput | `src/components/shared/ChatInput.tsx` | 466 | Input with attachments |
| RightSidebar | `src/components/task/RightSidebar.tsx` | 1500 | 4-tab sidebar |
| ArtifactPreview | `src/components/artifacts/ArtifactPreview.tsx` | 923 | File preview |
| ToolExecutionItem | `src/components/task/ToolExecutionItem.tsx` | 461 | Tool display |
| PlanApproval | `src/components/task/PlanApproval.tsx` | 157 | Plan UI |
| QuestionInput | `src/components/task/QuestionInput.tsx` | 228 | Question form |
| VirtualComputer | `src/components/task/VirtualComputer.tsx` | 808 | Tool timeline |
| VitePreview | `src/components/task/VitePreview.tsx` | 344 | Live preview |

### Hooks

| Hook | Path | Lines | Description |
|------|------|-------|-------------|
| useAgent | `src/shared/hooks/useAgent.ts` | ~1200 | SSE streaming |
| useVitePreview | `src/shared/hooks/useVitePreview.ts` | 251 | Live preview |
| useProviders | `src/shared/hooks/useProviders.ts` | 264 | Provider switching |

### Database

| File | Path | Lines | Description |
|------|------|-------|-------------|
| database.ts | `src/shared/db/database.ts` | 806 | CRUD operations |
| types.ts | `src/shared/db/types.ts` | 115 | Type definitions |

---

## Type Definitions

### AgentMessage

```typescript
interface AgentMessage {
  id: string;
  type: 'text' | 'tool_use' | 'tool_result' | 'result' | 'error' | 'user' | 'plan';
  content?: string;
  name?: string;           // tool name
  input?: unknown;         // tool input
  output?: string;         // tool result
  toolUseId?: string;      // links result to use
  plan?: TaskPlan;
  attachments?: MessageAttachment[];
  message?: string;        // error message
  isError?: boolean;
  timestamp?: number;
}
```

### TaskPlan

```typescript
interface TaskPlan {
  goal: string;
  steps: PlanStep[];
  notes?: string;
  status?: string;
}

interface PlanStep {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
}
```

### PendingQuestion

```typescript
interface PendingQuestion {
  id: string;
  questions: AgentQuestion[];
}

interface AgentQuestion {
  header: string;
  question: string;
  options: QuestionOption[];
  multiSelect: boolean;
}

interface QuestionOption {
  label: string;
  description?: string;
}
```

### MessageAttachment

```typescript
interface MessageAttachment {
  id: string;
  type: 'image' | 'file';
  name: string;
  data: string;        // base64 or data URL
  mimeType: string;
  isLoading?: boolean;
}
```

### Artifact

```typescript
type ArtifactType =
  | 'html' | 'jsx' | 'css' | 'json' | 'text' | 'image' | 'code'
  | 'markdown' | 'csv' | 'document' | 'spreadsheet' | 'presentation'
  | 'pdf' | 'audio' | 'video' | 'font' | 'websearch';

interface Artifact {
  id: string;
  name: string;
  type: ArtifactType;
  content?: string;
  path?: string;
}
```

---

## useAgent Hook Interface

```typescript
interface UseAgentReturn {
  // State
  messages: AgentMessage[];
  phase: AgentPhase;
  isRunning: boolean;
  plan: TaskPlan | null;
  pendingQuestion: PendingQuestion | null;
  sessionFolder: string;
  filesVersion: number;
  backgroundTasks: BackgroundTask[];

  // Actions
  runAgent(prompt: string, taskId?: string, sessionInfo?: SessionInfo, attachments?: MessageAttachment[]): Promise<void>;
  continueConversation(message: string, attachments?: MessageAttachment[]): Promise<void>;
  stopAgent(): void;
  loadTask(taskId: string): Promise<Task | null>;
  loadMessages(taskId: string): Promise<void>;
  approvePlan(): void;
  rejectPlan(): void;
  respondToQuestion(answers: Record<string, string>): void;
}

type AgentPhase = 'idle' | 'planning' | 'awaiting_approval' | 'executing' | 'running';
```

---

## SSE Streaming Protocol

### Endpoints

```
POST /agent/run      # Start new task
POST /agent/continue # Continue conversation
POST /agent/stop     # Stop current task
```

### Event Types

```typescript
type SSEEventType =
  | 'text'         // Assistant text chunk
  | 'tool_use'     // Tool invocation
  | 'tool_result'  // Tool output
  | 'plan'         // Execution plan
  | 'question'     // Interactive question
  | 'result'       // Task completion
  | 'error'        // Error message
  | 'session_folder'; // Working directory
```

### Event Format

```typescript
interface SSEEvent {
  type: SSEEventType;
  data: {
    // For text
    content?: string;

    // For tool_use
    id?: string;
    name?: string;
    input?: unknown;

    // For tool_result
    toolUseId?: string;
    output?: string;
    isError?: boolean;

    // For plan
    plan?: TaskPlan;

    // For question
    questions?: AgentQuestion[];

    // For error
    message?: string;
  };
}
```

---

## Database Schema

### Sessions

```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  name TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### Tasks

```sql
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  prompt TEXT NOT NULL,
  status TEXT DEFAULT 'running',
  cost REAL DEFAULT 0,
  duration INTEGER DEFAULT 0,
  favorite INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);
```

### Messages

```sql
CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL,
  type TEXT NOT NULL,
  content TEXT,
  tool_name TEXT,
  tool_input TEXT,
  tool_output TEXT,
  tool_use_id TEXT,
  subtype TEXT,
  error_message TEXT,
  attachments TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(id)
);
```

### Library Files

```sql
CREATE TABLE library_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  path TEXT,
  preview TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(id)
);
```

---

## Right Sidebar Structure

### 4 Collapsible Sections

1. **Workspace**
   - Output folder file tree
   - External folders accessed
   - Uses `readDirViaApi()` for directory listing

2. **Artifacts**
   - Generated files list
   - Click to preview
   - "Show more" pagination

3. **Tools (MCP)**
   - MCP tools used (`mcp__*` prefix)
   - Click for input/output modal

4. **Skills**
   - Skills invoked (`Skill` tool)
   - Skill folders display

### File Icon Mapping

```typescript
function getFileIconByExt(ext: string): LucideIcon {
  const iconMap: Record<string, LucideIcon> = {
    // Documents
    pdf: FileText,
    doc: FileText, docx: FileText,

    // Spreadsheets
    xls: Table, xlsx: Table, csv: Table,

    // Presentations
    ppt: Presentation, pptx: Presentation,

    // Images
    png: Image, jpg: Image, jpeg: Image, gif: Image, svg: Image,

    // Audio
    mp3: Music, wav: Music, ogg: Music,

    // Video
    mp4: Video, webm: Video, mov: Video,

    // Code
    js: Code, ts: Code, jsx: Code, tsx: Code,
    py: Code, rb: Code, go: Code, rs: Code,

    // Default
    default: File,
  };
  return iconMap[ext.toLowerCase()] || iconMap.default;
}
```

---

## Artifact Preview Types

| Type | Extensions | Preview Component |
|------|------------|-------------------|
| html | html, htm | iframe with inlined assets |
| jsx | jsx, tsx | Code syntax highlight |
| css | css, scss, less | Code syntax highlight |
| json | json | Code + JSON tree |
| markdown | md, markdown | Rendered markdown |
| csv | csv | Table view |
| image | png, jpg, gif, svg, webp | `<img>` tag |
| pdf | pdf | PDF.js viewer |
| document | doc, docx | mammoth.js converter |
| spreadsheet | xls, xlsx | xlsx parser + table |
| presentation | ppt, pptx | Slide carousel |
| audio | mp3, wav, ogg, m4a | `<audio>` player |
| video | mp4, webm, mov | `<video>` player |
| font | ttf, otf, woff | Font preview text |
| websearch | - | Search results list |
| code | js, ts, py, etc. | Syntax highlight |
| text | txt, log | Plain text |

---

## i18n Keys

### English (en.json)

```json
{
  "workspace": {
    "chat": "Chat",
    "chatPlaceholder": "Ask anything...",
    "replyPlaceholder": "Continue the conversation...",
    "stopAgent": "Stop",
    "sendMessage": "Send"
  },
  "chat": {
    "title": "Chat",
    "newChat": "New Chat",
    "clearMessages": "Clear",
    "hideSteps": "Hide steps",
    "showSteps": "Show {count} steps",
    "planTitle": "Execution Plan",
    "approvePlan": "Approve",
    "rejectPlan": "Reject",
    "addFilesOrPhotos": "Add files or photos",
    "noMessages": "Start a conversation",
    "running": "Running...",
    "waitingForApproval": "Waiting for plan approval...",
    "waitingForInput": "Waiting for your input...",
    "sidebar": {
      "workspace": "Workspace",
      "artifacts": "Artifacts",
      "tools": "Tools",
      "skills": "Skills",
      "outputFolder": "Output Folder",
      "externalFolders": "External Folders"
    }
  }
}
```

### Chinese (zh-CN.json)

```json
{
  "workspace": {
    "chat": "对话",
    "chatPlaceholder": "问我任何问题...",
    "replyPlaceholder": "继续对话...",
    "stopAgent": "停止",
    "sendMessage": "发送"
  },
  "chat": {
    "title": "对话",
    "newChat": "新对话",
    "clearMessages": "清空",
    "hideSteps": "隐藏步骤",
    "showSteps": "显示 {count} 个步骤",
    "planTitle": "执行计划",
    "approvePlan": "批准",
    "rejectPlan": "拒绝",
    "addFilesOrPhotos": "添加文件或图片",
    "noMessages": "开始对话",
    "running": "运行中...",
    "waitingForApproval": "等待计划批准...",
    "waitingForInput": "等待您的输入...",
    "sidebar": {
      "workspace": "工作区",
      "artifacts": "产物",
      "tools": "工具",
      "skills": "技能",
      "outputFolder": "输出文件夹",
      "externalFolders": "外部文件夹"
    }
  }
}
```

---

## Implementation Checklist

### Phase 1: Core Chat
- [ ] ChatInput with file attachments
- [ ] Real useAgent with SSE
- [ ] Message grouping (task groups)
- [ ] Markdown rendering

### Phase 2: Plan & Question
- [ ] PlanApproval with step progress
- [ ] QuestionInput with multi-select
- [ ] Approve/reject flow

### Phase 3: Artifacts
- [ ] Create artifacts/ directory
- [ ] Implement all preview components
- [ ] Preview/code toggle

### Phase 4: Right Sidebar
- [ ] Workspace file tree
- [ ] Artifacts list
- [ ] Tools tab with MCP
- [ ] Skills tab

### Phase 5: Database
- [ ] SQLite schema
- [ ] CRUD operations
- [ ] Message persistence

### Phase 6: Live Preview
- [ ] VitePreview component
- [ ] useVitePreview hook
- [ ] Start/stop server

---

## Design Adaptations

### Color Mapping (workany → viben)

| workany | viben |
|---------|-------|
| Neutral grays | Warm amber (--brand-amber-*) |
| Blue accent | Orange accent (--color-primary) |
| Single font | Crimson Pro + Inter |

### Component Styling

Follow `design-system.md`:
- Use CSS variables for all colors
- Apply `transition-colors duration-200` for hover states
- Use `rounded-xl` for cards
- Apply staggered animations on mount
