# 队列管理系统 UI 设计

日期: 2026-03-04

## 概述

在看板 UI 中集成队列管理功能，让用户可视化地了解和控制任务队列。

### 范围内

- Queue 列头显示当前并行数（如 "2/3"）
- In Progress 列头显示当前运行数（如 "2/3"）
- 配置弹窗：调整 max_concurrency (1-10)
- "Queue All" 按钮：将所有 Backlog 任务批量入队

### 范围外

- 卡住任务检测（后续迭代）
- 实时 SSE 推送（后续迭代）
- 拖拽自动重定向（后续迭代）

### 依赖

- 后端 `TaskQueueManager` 已实现 `tryDequeue()` 自动提升
- Gateway API `/api/queue/*` 已可用
- 全局配置文件 `~/.viben/config.yaml`

## 架构决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 配置层级 | 全局配置 | 简单，符合 file-native 范式 |
| 自动提升触发 | 后端 Gateway | 职责清晰，前端只负责展示 |
| 状态同步方式 | 操作后刷新 | 简单，无额外基础设施 |
| 实现方案 | 扩展现有 store | 改动最小，复用现有架构 |

## 数据流

```
┌─────────────────────────────────────────────────────────┐
│  Desktop App (前端)                                      │
│  ┌─────────────────┐    ┌─────────────────────────────┐ │
│  │ KanbanHeader    │◄───│ kanban-queue-store          │ │
│  │ - "2/3" 显示    │    │ - queueStatus               │ │
│  │ - Queue All 按钮│    │ - maxConcurrency            │ │
│  │ - 配置按钮      │    │ - fetchQueueStatus()        │ │
│  └─────────────────┘    │ - queueAllTasks()           │ │
│                         │ - updateMaxConcurrency()    │ │
│                         └──────────┬──────────────────┘ │
└────────────────────────────────────┼────────────────────┘
                                     │ HTTP
                                     ▼
┌─────────────────────────────────────────────────────────┐
│  Gateway (后端)                                          │
│  ┌─────────────────┐    ┌─────────────────────────────┐ │
│  │ /api/queue/*    │◄───│ TaskQueueManager            │ │
│  │ - GET /status   │    │ - queue[]                   │ │
│  │ - POST /enqueue │    │ - running Map               │ │
│  │ - PUT /config   │    │ - tryDequeue() 自动提升     │ │
│  └─────────────────┘    └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### 刷新时机

1. 看板页面加载时
2. 用户点击 "Queue All" 后
3. 用户修改配置后
4. 用户手动拖拽任务状态变化后

## 配置文件格式

位置: `~/.viben/config.yaml`

```yaml
# 队列管理配置
queue:
  max_concurrency: 3    # 最大并行任务数 (1-10)
```

- 默认值: 3
- 验证规则: 1-10 之间的整数，无效值回退到默认值

## API 端点

### 已有端点（直接复用）

| 端点 | 用途 |
|------|------|
| `GET /api/queue/status` | 获取 pending_count, running_count, max_concurrency |
| `GET /api/queue/config` | 获取配置 |
| `PUT /api/queue/config` | 更新 max_concurrency 等配置 |
| `POST /api/queue/enqueue` | 入队单个任务 |

### 需新增端点

```
POST /api/queue/enqueue-batch
Body: { task_ids: string[] }
Response: { success: boolean, queued: number, failed: string[] }
说明: 批量入队，用于 "Queue All" 功能
```

## UI 组件设计

### 文件结构

```
apps/desktop/src/components/
├── kanban/
│   ├── kanban-column-header.tsx  # 修改：添加计数显示和按钮
│   └── queue-settings-modal.tsx  # 新增：配置弹窗
```

### Backlog 列头

```tsx
// 添加 "Queue All" 按钮
<Button variant="ghost" size="icon" onClick={handleQueueAll}>
  <ListPlus className="h-4 w-4" />
</Button>
```

### In Progress 列头

```tsx
// 显示并行数 "2/3"
<Badge variant="secondary">
  {runningCount}/{maxConcurrency}
</Badge>
// 添加设置按钮
<Button variant="ghost" size="icon" onClick={openSettingsModal}>
  <Settings className="h-4 w-4" />
</Button>
```

### 配置弹窗

```tsx
<Dialog>
  <DialogHeader>队列设置</DialogHeader>
  <DialogContent>
    <Label>最大并行任务数</Label>
    <Input type="number" min={1} max={10} value={maxConcurrency} />
  </DialogContent>
  <DialogFooter>
    <Button onClick={handleSave}>保存</Button>
  </DialogFooter>
</Dialog>
```

## Store 设计

文件: `apps/desktop/src/stores/kanban-queue-store.ts`

```typescript
interface KanbanQueueStore {
  // 状态
  queueStatus: {
    pending_count: number;
    running_count: number;
    max_concurrency: number;
  } | null;
  isLoading: boolean;

  // 方法
  fetchQueueStatus: () => Promise<void>;
  updateMaxConcurrency: (value: number) => Promise<void>;
  queueAllBacklogTasks: (taskIds: string[]) => Promise<{ queued: number }>;
}

export const useKanbanQueueStore = create<KanbanQueueStore>((set, get) => ({
  queueStatus: null,
  isLoading: false,

  fetchQueueStatus: async () => {
    set({ isLoading: true });
    const res = await fetch(`${GATEWAY_URL}/api/queue/status`);
    const data = await res.json();
    set({ queueStatus: data, isLoading: false });
  },

  updateMaxConcurrency: async (value: number) => {
    await fetch(`${GATEWAY_URL}/api/queue/config`, {
      method: 'PUT',
      body: JSON.stringify({ max_concurrency: value }),
    });
    await get().fetchQueueStatus();
  },

  queueAllBacklogTasks: async (taskIds: string[]) => {
    const res = await fetch(`${GATEWAY_URL}/api/queue/enqueue-batch`, {
      method: 'POST',
      body: JSON.stringify({ task_ids: taskIds }),
    });
    const data = await res.json();
    await get().fetchQueueStatus();
    return data;
  },
}));
```

## 实现步骤

### Step 1: 后端 - 新增批量入队端点

- 文件: `packages/core/src/gateway/routes/queue.ts`
- 添加 `POST /api/queue/enqueue-batch`
- 复用现有 `taskQueue.enqueue()` 逻辑

### Step 2: 前端 Store - 扩展 kanban-queue-store

- 文件: `apps/desktop/src/stores/kanban-queue-store.ts`
- 添加 `queueStatus` 状态
- 添加 `fetchQueueStatus`, `updateMaxConcurrency`, `queueAllBacklogTasks` 方法

### Step 3: 前端 UI - 配置弹窗

- 新建: `apps/desktop/src/components/kanban/queue-settings-modal.tsx`
- 使用 shadcn Dialog + Input 组件

### Step 4: 前端 UI - 修改列头

- 文件: 看板列头组件
- Backlog 列: 添加 "Queue All" 按钮
- In Progress 列: 添加 "2/3" 计数 + 设置按钮

### Step 5: 集成和刷新

- 看板加载时调用 `fetchQueueStatus()`
- 操作后自动刷新状态

## 参考

- Auto-Claude 队列管理实现: `/Users/lxy/Documents/GitHub/others/Auto-Claude`
- 现有 Queue API: `packages/core/src/gateway/routes/queue.ts`
- 现有 Store: `apps/desktop/src/stores/kanban-queue-store.ts`
