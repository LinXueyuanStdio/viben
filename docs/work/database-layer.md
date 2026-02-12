# WorkAny 数据库层设计

## 概述

WorkAny 实现了跨平台的数据库抽象层，在 Tauri 桌面环境使用 SQLite，在浏览器环境使用 IndexedDB。

## 数据库迁移 (SQLite)

**文件**: [`workany/src-tauri/src/lib.rs`](/Users/lxy/Documents/GitHub/others/workany/src-tauri/src/lib.rs) 行 72-182

### Migration 1: 基础表

```sql
-- 任务表
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY NOT NULL,
    prompt TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'running',
    cost REAL,
    duration INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 消息表
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL,
    type TEXT NOT NULL,
    content TEXT,
    tool_name TEXT,
    tool_input TEXT,
    subtype TEXT,
    error_message TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_messages_task_id ON messages(task_id);
```

### Migration 2: 工具结果字段

```sql
ALTER TABLE messages ADD COLUMN tool_output TEXT;
ALTER TABLE messages ADD COLUMN tool_use_id TEXT;
```

### Migration 3: 文件表

```sql
CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    path TEXT NOT NULL,
    preview TEXT,
    thumbnail TEXT,
    is_favorite INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_files_task_id ON files(task_id);
```

### Migration 4: 设置表

```sql
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Migration 5: 会话支持

```sql
-- 会话表
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY NOT NULL,
    prompt TEXT NOT NULL,
    task_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 任务表新增字段
ALTER TABLE tasks ADD COLUMN session_id TEXT;
ALTER TABLE tasks ADD COLUMN task_index INTEGER DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_tasks_session_id ON tasks(session_id);
```

### Migration 6: 附件支持

```sql
ALTER TABLE messages ADD COLUMN attachments TEXT;
```

### Migration 7: 任务收藏

```sql
ALTER TABLE tasks ADD COLUMN favorite INTEGER DEFAULT 0;
```

---

## 数据库抽象层

**文件**: [`workany/src/shared/db/database.ts`](/Users/lxy/Documents/GitHub/others/workany/src/shared/db/database.ts)

### 环境检测

```typescript
// 行 18-29
function isTauriSync(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  // 检测 Tauri v2
  const hasTauriInternals = '__TAURI_INTERNALS__' in window;
  // 检测 Tauri v1
  const hasTauri = '__TAURI__' in window;

  return hasTauriInternals || hasTauri;
}
```

### IndexedDB 初始化 (浏览器)

```typescript
// 行 34-93
async function getIndexedDB(): Promise<IDBDatabase> {
  if (idb) return idb;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, IDB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // 创建 sessions store
      if (!db.objectStoreNames.contains('sessions')) {
        const sessionsStore = db.createObjectStore('sessions', { keyPath: 'id' });
        sessionsStore.createIndex('created_at', 'created_at', { unique: false });
      }

      // 创建 tasks store
      if (!db.objectStoreNames.contains('tasks')) {
        const tasksStore = db.createObjectStore('tasks', { keyPath: 'id' });
        tasksStore.createIndex('created_at', 'created_at', { unique: false });
        tasksStore.createIndex('session_id', 'session_id', { unique: false });
      }

      // 创建 messages store
      if (!db.objectStoreNames.contains('messages')) {
        const messagesStore = db.createObjectStore('messages', {
          keyPath: 'id',
          autoIncrement: true,
        });
        messagesStore.createIndex('task_id', 'task_id', { unique: false });
      }

      // 创建 files store
      if (!db.objectStoreNames.contains('files')) {
        const filesStore = db.createObjectStore('files', {
          keyPath: 'id',
          autoIncrement: true,
        });
        filesStore.createIndex('task_id', 'task_id', { unique: false });
      }
    };

    request.onsuccess = () => {
      idb = request.result;
      resolve(idb);
    };
  });
}
```

### SQLite 连接 (Tauri)

```typescript
// 行 103-124
async function getSQLiteDatabase() {
  if (!isTauriSync()) {
    return null;
  }

  if (!sqliteDb) {
    try {
      const Database = (await import('@tauri-apps/plugin-sql')).default;
      sqliteDb = await Database.load(SQLITE_DB_NAME);
      console.log('[SQLite] Database connected successfully');
    } catch (error) {
      console.error('[SQLite] Failed to connect:', error);
      return null;
    }
  }
  return sqliteDb;
}
```

---

## CRUD 操作

### Session 操作

```typescript
// 行 127-174: createSession
export async function createSession(input: CreateSessionInput): Promise<Session> {
  const database = await getSQLiteDatabase();

  if (database) {
    // SQLite (Tauri)
    await database.execute(
      'INSERT INTO sessions (id, prompt, task_count) VALUES ($1, $2, $3)',
      [input.id, input.prompt, 0]
    );
  } else {
    // IndexedDB (Browser)
    const db = await getIndexedDB();
    const tx = db.transaction('sessions', 'readwrite');
    const store = tx.objectStore('sessions');
    await idbRequest(store.put(session));
  }
  return session;
}

// 行 176-196: getSession
export async function getSession(id: string): Promise<Session | null> {
  const database = await getSQLiteDatabase();

  if (database) {
    const result = await database.select<Session[]>(
      'SELECT * FROM sessions WHERE id = $1',
      [id]
    );
    return result[0] || null;
  } else {
    const db = await getIndexedDB();
    const tx = db.transaction('sessions', 'readonly');
    const store = tx.objectStore('sessions');
    return await idbRequest(store.get(id)) || null;
  }
}
```

### Task 操作

```typescript
// 行 287-337: createTask
export async function createTask(input: CreateTaskInput): Promise<Task> {
  const database = await getSQLiteDatabase();

  if (database) {
    // SQLite - 尝试新 schema，回退到旧 schema
    try {
      await database.execute(
        'INSERT INTO tasks (id, session_id, task_index, prompt) VALUES ($1, $2, $3, $4)',
        [input.id, input.session_id, input.task_index, input.prompt]
      );
    } catch {
      // 旧 schema 回退
      await database.execute('INSERT INTO tasks (id, prompt) VALUES ($1, $2)', [
        input.id,
        input.prompt,
      ]);
    }
  } else {
    // IndexedDB
    const db = await getIndexedDB();
    const tx = db.transaction('tasks', 'readwrite');
    const store = tx.objectStore('tasks');
    await idbRequest(store.put(task));
  }

  // 更新会话任务计数
  await updateSessionTaskCount(input.session_id, input.task_index);
  return result;
}

// 行 387-463: updateTask
export async function updateTask(id: string, input: UpdateTaskInput): Promise<Task | null> {
  const database = await getSQLiteDatabase();

  if (database) {
    const updates: string[] = [];
    const values: (string | number | null)[] = [];
    let paramIndex = 1;

    if (input.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(input.status);
    }
    if (input.cost !== undefined) {
      updates.push(`cost = $${paramIndex++}`);
      values.push(input.cost);
    }
    // ... 更多字段

    if (updates.length > 0) {
      updates.push(`updated_at = datetime('now')`);
      values.push(id);
      await database.execute(
        `UPDATE tasks SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
        values
      );
    }
  } else {
    // IndexedDB
    const db = await getIndexedDB();
    const task = await getTask(id);
    if (task) {
      const updatedTask = { ...task, ...input, updated_at: new Date().toISOString() };
      const tx = db.transaction('tasks', 'readwrite');
      const store = tx.objectStore('tasks');
      await idbRequest(store.put(updatedTask));
      return updatedTask;
    }
  }
  return getTask(id);
}
```

### Message 操作

```typescript
// 行 485-570: createMessage
export async function createMessage(input: CreateMessageInput): Promise<Message> {
  const database = await getSQLiteDatabase();

  if (database) {
    const result = await database.execute(
      `INSERT INTO messages (task_id, type, content, tool_name, tool_input, tool_output, tool_use_id, subtype, error_message, attachments)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        input.task_id,
        input.type,
        input.content || null,
        input.tool_name || null,
        input.tool_input || null,
        input.tool_output || null,
        input.tool_use_id || null,
        input.subtype || null,
        input.error_message || null,
        input.attachments || null,
      ]
    );

    const messages = await database.select<Message[]>(
      'SELECT * FROM messages WHERE id = $1',
      [result.lastInsertId]
    );
    return messages[0];
  } else {
    // IndexedDB
    const db = await getIndexedDB();
    const tx = db.transaction('messages', 'readwrite');
    const store = tx.objectStore('messages');
    const id = await idbRequest(store.add(message));
    return { ...message, id: id as number } as Message;
  }
}
```

### 任务状态自动更新

```typescript
// 行 617-643: updateTaskFromMessage
export async function updateTaskFromMessage(
  taskId: string,
  messageType: string,
  subtype?: string,
  cost?: number,
  duration?: number
): Promise<void> {
  if (messageType === 'result') {
    // 只有 success 才标记为完成
    if (subtype === 'success') {
      await updateTask(taskId, { status: 'completed', cost, duration });
    } else if (subtype === 'error_max_turns') {
      // 达到最大轮次 - 保持运行状态，仅更新成本/时长
      await updateTask(taskId, { cost, duration });
    } else {
      // 其他错误
      await updateTask(taskId, { status: 'error', cost, duration });
    }
  } else if (messageType === 'error') {
    await updateTask(taskId, { status: 'error' });
  }
}
```

---

## 数据模型

### Session

```typescript
interface Session {
  id: string;
  prompt: string;
  task_count: number;
  created_at: string;
  updated_at: string;
}
```

### Task

```typescript
interface Task {
  id: string;
  session_id?: string;
  task_index?: number;
  prompt: string;
  status: 'running' | 'completed' | 'error' | 'stopped';
  cost: number | null;
  duration: number | null;
  favorite?: boolean;
  created_at: string;
  updated_at: string;
}
```

### Message

```typescript
interface Message {
  id: number;
  task_id: string;
  type: string;
  content: string | null;
  tool_name: string | null;
  tool_input: string | null;
  tool_output: string | null;
  tool_use_id: string | null;
  subtype: string | null;
  error_message: string | null;
  attachments: string | null;
  created_at: string;
}
```

### LibraryFile

```typescript
interface LibraryFile {
  id: number;
  task_id: string;
  name: string;
  type: string;
  path: string;
  preview: string | null;
  thumbnail: string | null;
  is_favorite: boolean;
  created_at: string;
}
```

---

## 数据关系

```
┌──────────────┐
│   Sessions   │
│──────────────│
│ id           │
│ prompt       │
│ task_count   │
│ created_at   │
│ updated_at   │
└──────┬───────┘
       │ 1:N
       ▼
┌──────────────┐
│    Tasks     │
│──────────────│
│ id           │
│ session_id   │◄── FK
│ task_index   │
│ prompt       │
│ status       │
│ cost         │
│ duration     │
│ favorite     │
│ created_at   │
│ updated_at   │
└──────┬───────┘
       │ 1:N
       ├───────────────────┐
       ▼                   ▼
┌──────────────┐    ┌──────────────┐
│   Messages   │    │    Files     │
│──────────────│    │──────────────│
│ id           │    │ id           │
│ task_id      │◄── │ task_id      │◄── FK
│ type         │    │ name         │
│ content      │    │ type         │
│ tool_*       │    │ path         │
│ created_at   │    │ preview      │
└──────────────┘    │ is_favorite  │
                    │ created_at   │
                    └──────────────┘
```

---

## 跨平台兼容性

| 特性 | SQLite (Tauri) | IndexedDB (Browser) |
|------|----------------|---------------------|
| 连接 | `@tauri-apps/plugin-sql` | 原生 API |
| 数据库名 | `sqlite:workany.db` | `workany` |
| 版本控制 | Migration 系统 | IDB_VERSION |
| 事务 | 自动 | 手动 `transaction()` |
| 主键生成 | AUTOINCREMENT | `autoIncrement: true` |
| 外键约束 | 支持 (CASCADE) | 不支持 (应用层处理) |
| 索引 | CREATE INDEX | `createIndex()` |

## 原始文件引用

- 数据库迁移: [`workany/src-tauri/src/lib.rs`](/Users/lxy/Documents/GitHub/others/workany/src-tauri/src/lib.rs) 行 72-182
- 数据库抽象: [`workany/src/shared/db/database.ts`](/Users/lxy/Documents/GitHub/others/workany/src/shared/db/database.ts)
- 类型定义: [`workany/src/shared/db/types.ts`](/Users/lxy/Documents/GitHub/others/workany/src/shared/db/types.ts)
