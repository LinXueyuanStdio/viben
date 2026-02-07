/**
 * Database operations for chat persistence
 *
 * Supports both:
 * - SQLite via @tauri-apps/plugin-sql (desktop/Tauri)
 * - IndexedDB (browser fallback)
 *
 * The implementation automatically detects the environment and uses
 * the appropriate storage backend.
 */

import type {
  CreateFileInput,
  CreateMessageInput,
  CreateSessionInput,
  CreateTaskInput,
  LibraryFile,
  Message,
  Session,
  Task,
  TaskWithFiles,
  UpdateTaskInput,
} from "./types";

// ============ Configuration ============

const SQLITE_DB_NAME = "sqlite:viben-chat.db";
const IDB_NAME = "viben-chat";
const IDB_VERSION = 1;

// ============ Environment Detection ============

/**
 * Check if running in Tauri environment synchronously
 */
function isTauriSync(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  // Check for Tauri v2 internals
  const hasTauriInternals = "__TAURI_INTERNALS__" in window;
  // Check for legacy Tauri v1
  const hasTauri = "__TAURI__" in window;

  return hasTauriInternals || hasTauri;
}

/**
 * Export utility to check environment
 */
export function isDatabaseAvailable(): boolean {
  return isTauriSync();
}

// ============ IndexedDB for Browser Mode ============

let idb: IDBDatabase | null = null;

async function getIndexedDB(): Promise<IDBDatabase> {
  if (idb) return idb;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, IDB_VERSION);

    request.onerror = () => {
      console.error("[IDB] Failed to open database:", request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      idb = request.result;
      console.log("[IDB] Database opened successfully");
      resolve(idb);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      console.log("[IDB] Upgrading database...");

      // Create sessions store
      if (!db.objectStoreNames.contains("sessions")) {
        const sessionsStore = db.createObjectStore("sessions", {
          keyPath: "id",
        });
        sessionsStore.createIndex("created_at", "created_at", {
          unique: false,
        });
        sessionsStore.createIndex("workspace_id", "workspace_id", {
          unique: false,
        });
      }

      // Create tasks store
      if (!db.objectStoreNames.contains("tasks")) {
        const tasksStore = db.createObjectStore("tasks", { keyPath: "id" });
        tasksStore.createIndex("created_at", "created_at", { unique: false });
        tasksStore.createIndex("session_id", "session_id", { unique: false });
        tasksStore.createIndex("workspace_id", "workspace_id", {
          unique: false,
        });
      }

      // Create messages store
      if (!db.objectStoreNames.contains("messages")) {
        const messagesStore = db.createObjectStore("messages", {
          keyPath: "id",
          autoIncrement: true,
        });
        messagesStore.createIndex("task_id", "task_id", { unique: false });
      }

      // Create files store
      if (!db.objectStoreNames.contains("files")) {
        const filesStore = db.createObjectStore("files", {
          keyPath: "id",
          autoIncrement: true,
        });
        filesStore.createIndex("task_id", "task_id", { unique: false });
      }

      console.log("[IDB] Database upgraded successfully");
    };
  });
}

/**
 * Helper to promisify IDB requests
 */
function idbRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ============ SQLite (Tauri) ============

/**
 * SQLite database instance type
 * Using a simplified interface to avoid import type errors when the plugin is not installed
 */
interface SQLiteDatabase {
  execute(query: string, values?: unknown[]): Promise<{ rowsAffected: number; lastInsertId: number }>;
  select<T>(query: string, values?: unknown[]): Promise<T>;
  close(): Promise<void>;
}

let sqliteDb: SQLiteDatabase | null = null;

async function getSQLiteDatabase(): Promise<SQLiteDatabase | null> {
  if (!isTauriSync()) {
    return null;
  }

  if (!sqliteDb) {
    try {
      // Dynamic import to avoid bundling errors when plugin is not available
      const Database = (await import("@tauri-apps/plugin-sql")).default;
      sqliteDb = await Database.load(SQLITE_DB_NAME) as unknown as SQLiteDatabase;
      console.log("[SQLite] Database connected successfully");

      // Initialize tables if they don't exist
      await initializeSQLiteTables();
    } catch (error) {
      console.error("[SQLite] Failed to connect:", error);
      return null;
    }
  }
  return sqliteDb;
}

/**
 * Initialize SQLite tables if they don't exist
 */
async function initializeSQLiteTables() {
  if (!sqliteDb) return;

  // Sessions table
  await sqliteDb.execute(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY NOT NULL,
      prompt TEXT NOT NULL,
      workspace_id TEXT NOT NULL,
      task_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Tasks table
  await sqliteDb.execute(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY NOT NULL,
      session_id TEXT NOT NULL,
      workspace_id TEXT NOT NULL,
      task_index INTEGER NOT NULL,
      prompt TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'running',
      cost REAL,
      duration INTEGER,
      favorite INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    )
  `);

  // Messages table
  await sqliteDb.execute(`
    CREATE TABLE IF NOT EXISTS messages (
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
      plan TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (task_id) REFERENCES tasks(id)
    )
  `);

  // Files table
  await sqliteDb.execute(`
    CREATE TABLE IF NOT EXISTS files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      path TEXT NOT NULL,
      preview TEXT,
      thumbnail TEXT,
      is_favorite INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (task_id) REFERENCES tasks(id)
    )
  `);

  // Create indexes for better query performance
  await sqliteDb.execute(
    "CREATE INDEX IF NOT EXISTS idx_sessions_workspace ON sessions(workspace_id)"
  );
  await sqliteDb.execute(
    "CREATE INDEX IF NOT EXISTS idx_tasks_session ON tasks(session_id)"
  );
  await sqliteDb.execute(
    "CREATE INDEX IF NOT EXISTS idx_tasks_workspace ON tasks(workspace_id)"
  );
  await sqliteDb.execute(
    "CREATE INDEX IF NOT EXISTS idx_messages_task ON messages(task_id)"
  );
  await sqliteDb.execute(
    "CREATE INDEX IF NOT EXISTS idx_files_task ON files(task_id)"
  );

  console.log("[SQLite] Tables initialized successfully");
}

// ============ Session Operations ============

/**
 * Create a new session
 */
export async function createSession(
  input: CreateSessionInput
): Promise<Session> {
  const now = new Date().toISOString();
  const session: Session = {
    id: input.id,
    prompt: input.prompt,
    workspace_id: input.workspace_id,
    task_count: 0,
    created_at: now,
    updated_at: now,
  };

  const database = await getSQLiteDatabase();

  if (database) {
    await database.execute(
      "INSERT INTO sessions (id, prompt, workspace_id, task_count) VALUES ($1, $2, $3, $4)",
      [input.id, input.prompt, input.workspace_id, 0]
    );
    console.log("[SQLite] Created session:", input.id);
    return session;
  } else {
    const db = await getIndexedDB();
    const tx = db.transaction("sessions", "readwrite");
    const store = tx.objectStore("sessions");
    await idbRequest(store.put(session));
    console.log("[IDB] Created session:", input.id);
    return session;
  }
}

/**
 * Get a session by ID
 */
export async function getSession(id: string): Promise<Session | null> {
  const database = await getSQLiteDatabase();

  if (database) {
    const result = await database.select<Session[]>(
      "SELECT * FROM sessions WHERE id = $1",
      [id]
    );
    return result[0] || null;
  } else {
    const db = await getIndexedDB();
    const tx = db.transaction("sessions", "readonly");
    const store = tx.objectStore("sessions");
    const result = await idbRequest(store.get(id));
    return result || null;
  }
}

/**
 * Get all sessions for a workspace
 */
export async function getSessionsByWorkspace(
  workspaceId: string
): Promise<Session[]> {
  const database = await getSQLiteDatabase();

  if (database) {
    const sessions = await database.select<Session[]>(
      "SELECT * FROM sessions WHERE workspace_id = $1 ORDER BY created_at DESC",
      [workspaceId]
    );
    return sessions;
  } else {
    const db = await getIndexedDB();
    const tx = db.transaction("sessions", "readonly");
    const store = tx.objectStore("sessions");
    const index = store.index("workspace_id");
    const sessions = await idbRequest(index.getAll(workspaceId));
    return sessions.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }
}

/**
 * Get all sessions
 */
export async function getAllSessions(): Promise<Session[]> {
  const database = await getSQLiteDatabase();

  if (database) {
    const sessions = await database.select<Session[]>(
      "SELECT * FROM sessions ORDER BY created_at DESC"
    );
    return sessions;
  } else {
    const db = await getIndexedDB();
    const tx = db.transaction("sessions", "readonly");
    const store = tx.objectStore("sessions");
    const sessions = await idbRequest(store.getAll());
    return sessions.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }
}

/**
 * Update session task count
 */
export async function updateSessionTaskCount(
  sessionId: string,
  taskCount: number
): Promise<void> {
  const database = await getSQLiteDatabase();

  if (database) {
    await database.execute(
      "UPDATE sessions SET task_count = $1, updated_at = datetime('now') WHERE id = $2",
      [taskCount, sessionId]
    );
  } else {
    const db = await getIndexedDB();
    const session = await getSession(sessionId);
    if (session) {
      const updatedSession = {
        ...session,
        task_count: taskCount,
        updated_at: new Date().toISOString(),
      };
      const tx = db.transaction("sessions", "readwrite");
      const store = tx.objectStore("sessions");
      await idbRequest(store.put(updatedSession));
    }
  }
}

/**
 * Delete a session and all its tasks/messages
 */
export async function deleteSession(sessionId: string): Promise<boolean> {
  const database = await getSQLiteDatabase();

  if (database) {
    // Delete messages for all tasks in this session
    await database.execute(
      `DELETE FROM messages WHERE task_id IN (
        SELECT id FROM tasks WHERE session_id = $1
      )`,
      [sessionId]
    );
    // Delete files for all tasks in this session
    await database.execute(
      `DELETE FROM files WHERE task_id IN (
        SELECT id FROM tasks WHERE session_id = $1
      )`,
      [sessionId]
    );
    // Delete tasks
    await database.execute("DELETE FROM tasks WHERE session_id = $1", [
      sessionId,
    ]);
    // Delete session
    const result = await database.execute(
      "DELETE FROM sessions WHERE id = $1",
      [sessionId]
    );
    return result.rowsAffected > 0;
  } else {
    const db = await getIndexedDB();
    // Get all tasks for this session
    const tasks = await getTasksBySessionId(sessionId);

    // Delete messages and files for each task
    for (const task of tasks) {
      await deleteMessagesByTaskId(task.id);
      await deleteFilesByTaskId(task.id);
    }

    // Delete tasks
    const tasksTx = db.transaction("tasks", "readwrite");
    const tasksStore = tasksTx.objectStore("tasks");
    for (const task of tasks) {
      await idbRequest(tasksStore.delete(task.id));
    }

    // Delete session
    const sessionsTx = db.transaction("sessions", "readwrite");
    const sessionsStore = sessionsTx.objectStore("sessions");
    await idbRequest(sessionsStore.delete(sessionId));

    return true;
  }
}

// ============ Task Operations ============

/**
 * Create a new task
 */
export async function createTask(input: CreateTaskInput): Promise<Task> {
  const now = new Date().toISOString();
  const task: Task = {
    id: input.id,
    session_id: input.session_id,
    workspace_id: input.workspace_id,
    task_index: input.task_index,
    prompt: input.prompt,
    status: "running",
    cost: null,
    duration: null,
    created_at: now,
    updated_at: now,
  };

  const database = await getSQLiteDatabase();

  if (database) {
    await database.execute(
      "INSERT INTO tasks (id, session_id, workspace_id, task_index, prompt) VALUES ($1, $2, $3, $4, $5)",
      [
        input.id,
        input.session_id,
        input.workspace_id,
        input.task_index,
        input.prompt,
      ]
    );
    console.log("[SQLite] Created task:", input.id);

    // Update session task count
    await updateSessionTaskCount(input.session_id, input.task_index);

    const result = await getTask(input.id);
    if (!result) throw new Error("Failed to create task");
    return result;
  } else {
    const db = await getIndexedDB();
    const tx = db.transaction("tasks", "readwrite");
    const store = tx.objectStore("tasks");
    await idbRequest(store.put(task));
    console.log("[IDB] Created task:", input.id);

    // Update session task count
    await updateSessionTaskCount(input.session_id, input.task_index);

    return task;
  }
}

/**
 * Get a task by ID
 */
export async function getTask(id: string): Promise<Task | null> {
  const database = await getSQLiteDatabase();

  if (database) {
    const result = await database.select<Task[]>(
      "SELECT * FROM tasks WHERE id = $1",
      [id]
    );
    const task = result[0] || null;
    if (task && task.favorite !== undefined) {
      task.favorite = Boolean(task.favorite);
    }
    return task;
  } else {
    const db = await getIndexedDB();
    const tx = db.transaction("tasks", "readonly");
    const store = tx.objectStore("tasks");
    const result = await idbRequest(store.get(id));
    return result || null;
  }
}

/**
 * Get all tasks for a session
 */
export async function getTasksBySessionId(sessionId: string): Promise<Task[]> {
  const database = await getSQLiteDatabase();

  if (database) {
    const tasks = await database.select<Task[]>(
      "SELECT * FROM tasks WHERE session_id = $1 ORDER BY task_index ASC",
      [sessionId]
    );
    return tasks.map((task: Task) => ({
      ...task,
      favorite: task.favorite !== undefined ? Boolean(task.favorite) : false,
    }));
  } else {
    const db = await getIndexedDB();
    const tx = db.transaction("tasks", "readonly");
    const store = tx.objectStore("tasks");
    const index = store.index("session_id");
    const tasks = await idbRequest(index.getAll(sessionId)) as Task[];
    return tasks.sort((a, b) => (a.task_index || 0) - (b.task_index || 0));
  }
}

/**
 * Get all tasks for a workspace
 */
export async function getTasksByWorkspace(workspaceId: string): Promise<Task[]> {
  const database = await getSQLiteDatabase();

  if (database) {
    const tasks = await database.select<Task[]>(
      "SELECT * FROM tasks WHERE workspace_id = $1 ORDER BY created_at DESC",
      [workspaceId]
    );
    return tasks.map((task: Task) => ({
      ...task,
      favorite: task.favorite !== undefined ? Boolean(task.favorite) : false,
    }));
  } else {
    const db = await getIndexedDB();
    const tx = db.transaction("tasks", "readonly");
    const store = tx.objectStore("tasks");
    const index = store.index("workspace_id");
    const tasks = await idbRequest(index.getAll(workspaceId)) as Task[];
    return tasks.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }
}

/**
 * Get all tasks
 */
export async function getAllTasks(): Promise<Task[]> {
  const database = await getSQLiteDatabase();

  if (database) {
    const tasks = await database.select<Task[]>(
      "SELECT * FROM tasks ORDER BY created_at DESC"
    );
    return tasks.map((task: Task) => ({
      ...task,
      favorite: task.favorite !== undefined ? Boolean(task.favorite) : false,
    }));
  } else {
    const db = await getIndexedDB();
    const tx = db.transaction("tasks", "readonly");
    const store = tx.objectStore("tasks");
    const tasks = await idbRequest(store.getAll()) as Task[];
    return tasks.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }
}

/**
 * Update a task
 */
export async function updateTask(
  id: string,
  input: UpdateTaskInput
): Promise<Task | null> {
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
    if (input.duration !== undefined) {
      updates.push(`duration = $${paramIndex++}`);
      values.push(input.duration);
    }
    if (input.prompt !== undefined) {
      updates.push(`prompt = $${paramIndex++}`);
      values.push(input.prompt);
    }
    if (input.favorite !== undefined) {
      updates.push(`favorite = $${paramIndex++}`);
      values.push(input.favorite ? 1 : 0);
    }

    if (updates.length > 0) {
      updates.push(`updated_at = datetime('now')`);
      values.push(id);
      await database.execute(
        `UPDATE tasks SET ${updates.join(", ")} WHERE id = $${paramIndex}`,
        values
      );
    }

    return getTask(id);
  } else {
    const db = await getIndexedDB();
    const task = await getTask(id);
    if (task) {
      const updatedTask = {
        ...task,
        ...input,
        updated_at: new Date().toISOString(),
      };
      const tx = db.transaction("tasks", "readwrite");
      const store = tx.objectStore("tasks");
      await idbRequest(store.put(updatedTask));
      return updatedTask;
    }
    return null;
  }
}

/**
 * Delete a task and its messages/files
 */
export async function deleteTask(id: string): Promise<boolean> {
  const database = await getSQLiteDatabase();

  if (database) {
    // Delete messages
    await database.execute("DELETE FROM messages WHERE task_id = $1", [id]);
    // Delete files
    await database.execute("DELETE FROM files WHERE task_id = $1", [id]);
    // Delete task
    const result = await database.execute("DELETE FROM tasks WHERE id = $1", [
      id,
    ]);
    return result.rowsAffected > 0;
  } else {
    const db = await getIndexedDB();
    const tx = db.transaction("tasks", "readwrite");
    const store = tx.objectStore("tasks");
    await idbRequest(store.delete(id));
    // Also delete related messages and files
    await deleteMessagesByTaskId(id);
    await deleteFilesByTaskId(id);
    return true;
  }
}

// ============ Message Operations ============

/**
 * Create a new message
 */
export async function createMessage(
  input: CreateMessageInput
): Promise<Message> {
  const now = new Date().toISOString();
  const database = await getSQLiteDatabase();

  if (database) {
    const result = await database.execute(
      `INSERT INTO messages (task_id, type, content, tool_name, tool_input, tool_output, tool_use_id, subtype, error_message, attachments, plan)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
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
        input.plan || null,
      ]
    );

    const messages = await database.select<Message[]>(
      "SELECT * FROM messages WHERE id = $1",
      [result.lastInsertId]
    );
    return messages[0];
  } else {
    const db = await getIndexedDB();
    const message: Omit<Message, "id"> & { id?: number } = {
      task_id: input.task_id,
      type: input.type,
      content: input.content || null,
      tool_name: input.tool_name || null,
      tool_input: input.tool_input || null,
      tool_output: input.tool_output || null,
      tool_use_id: input.tool_use_id || null,
      subtype: input.subtype || null,
      error_message: input.error_message || null,
      attachments: input.attachments || null,
      plan: input.plan || null,
      created_at: now,
    };

    const tx = db.transaction("messages", "readwrite");
    const store = tx.objectStore("messages");
    const id = await idbRequest(store.add(message));
    return { ...message, id: id as number } as Message;
  }
}

/**
 * Get all messages for a task
 */
export async function getMessagesByTaskId(taskId: string): Promise<Message[]> {
  const database = await getSQLiteDatabase();

  if (database) {
    return database.select<Message[]>(
      "SELECT * FROM messages WHERE task_id = $1 ORDER BY created_at ASC",
      [taskId]
    );
  } else {
    const db = await getIndexedDB();
    const tx = db.transaction("messages", "readonly");
    const store = tx.objectStore("messages");
    const index = store.index("task_id");
    const messages = await idbRequest(index.getAll(taskId));
    return messages.sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }
}

/**
 * Delete all messages for a task
 */
export async function deleteMessagesByTaskId(taskId: string): Promise<number> {
  const database = await getSQLiteDatabase();

  if (database) {
    const result = await database.execute(
      "DELETE FROM messages WHERE task_id = $1",
      [taskId]
    );
    return result.rowsAffected;
  } else {
    const db = await getIndexedDB();
    const tx = db.transaction("messages", "readwrite");
    const store = tx.objectStore("messages");
    const index = store.index("task_id");
    const messages = await idbRequest(index.getAll(taskId));

    for (const message of messages) {
      await idbRequest(store.delete(message.id));
    }
    return messages.length;
  }
}

/**
 * Helper to update task status based on message type
 */
export async function updateTaskFromMessage(
  taskId: string,
  messageType: string,
  subtype?: string,
  cost?: number,
  duration?: number
): Promise<void> {
  if (messageType === "result") {
    if (subtype === "success") {
      await updateTask(taskId, { status: "completed", cost, duration });
    } else if (subtype === "error_max_turns") {
      // Task hit max turns limit - keep as running
      await updateTask(taskId, { cost, duration });
      console.log(
        `[Database] Task ${taskId} hit max turns limit, keeping as running`
      );
    } else {
      await updateTask(taskId, { status: "error", cost, duration });
    }
  } else if (messageType === "error") {
    await updateTask(taskId, { status: "error" });
  }
}

// ============ Library File Operations ============

/**
 * Create a new library file
 */
export async function createFile(input: CreateFileInput): Promise<LibraryFile> {
  const now = new Date().toISOString();
  const database = await getSQLiteDatabase();

  if (database) {
    const result = await database.execute(
      `INSERT INTO files (task_id, name, type, path, preview, thumbnail)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        input.task_id,
        input.name,
        input.type,
        input.path,
        input.preview || null,
        input.thumbnail || null,
      ]
    );

    const files = await database.select<LibraryFile[]>(
      "SELECT * FROM files WHERE id = $1",
      [result.lastInsertId]
    );
    return files[0];
  } else {
    const db = await getIndexedDB();
    const file: Omit<LibraryFile, "id"> & { id?: number } = {
      task_id: input.task_id,
      name: input.name,
      type: input.type,
      path: input.path,
      preview: input.preview || null,
      thumbnail: input.thumbnail || null,
      is_favorite: false,
      created_at: now,
    };

    const tx = db.transaction("files", "readwrite");
    const store = tx.objectStore("files");
    const id = await idbRequest(store.add(file));
    return { ...file, id: id as number } as LibraryFile;
  }
}

/**
 * Get all files for a task
 */
export async function getFilesByTaskId(taskId: string): Promise<LibraryFile[]> {
  const database = await getSQLiteDatabase();

  if (database) {
    return database.select<LibraryFile[]>(
      "SELECT * FROM files WHERE task_id = $1 ORDER BY created_at ASC",
      [taskId]
    );
  } else {
    const db = await getIndexedDB();
    const tx = db.transaction("files", "readonly");
    const store = tx.objectStore("files");
    const index = store.index("task_id");
    const files = await idbRequest(index.getAll(taskId));
    return files.sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }
}

/**
 * Get all files
 */
export async function getAllFiles(): Promise<LibraryFile[]> {
  const database = await getSQLiteDatabase();

  if (database) {
    return database.select<LibraryFile[]>(
      "SELECT * FROM files ORDER BY created_at DESC"
    );
  } else {
    const db = await getIndexedDB();
    const tx = db.transaction("files", "readonly");
    const store = tx.objectStore("files");
    const files = await idbRequest(store.getAll());
    return files.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }
}

/**
 * Toggle file favorite status
 */
export async function toggleFileFavorite(
  fileId: number
): Promise<LibraryFile | null> {
  const database = await getSQLiteDatabase();

  if (database) {
    await database.execute(
      "UPDATE files SET is_favorite = NOT is_favorite WHERE id = $1",
      [fileId]
    );
    const files = await database.select<LibraryFile[]>(
      "SELECT * FROM files WHERE id = $1",
      [fileId]
    );
    return files[0] || null;
  } else {
    const db = await getIndexedDB();
    const tx = db.transaction("files", "readwrite");
    const store = tx.objectStore("files");
    const file = await idbRequest(store.get(fileId));
    if (file) {
      file.is_favorite = !file.is_favorite;
      await idbRequest(store.put(file));
      return file;
    }
    return null;
  }
}

/**
 * Delete a file
 */
export async function deleteFile(fileId: number): Promise<boolean> {
  const database = await getSQLiteDatabase();

  if (database) {
    const result = await database.execute("DELETE FROM files WHERE id = $1", [
      fileId,
    ]);
    return result.rowsAffected > 0;
  } else {
    const db = await getIndexedDB();
    const tx = db.transaction("files", "readwrite");
    const store = tx.objectStore("files");
    await idbRequest(store.delete(fileId));
    return true;
  }
}

/**
 * Delete all files for a task
 */
export async function deleteFilesByTaskId(taskId: string): Promise<number> {
  const database = await getSQLiteDatabase();

  if (database) {
    const result = await database.execute(
      "DELETE FROM files WHERE task_id = $1",
      [taskId]
    );
    return result.rowsAffected;
  } else {
    const db = await getIndexedDB();
    const tx = db.transaction("files", "readwrite");
    const store = tx.objectStore("files");
    const index = store.index("task_id");
    const files = await idbRequest(index.getAll(taskId));

    for (const file of files) {
      await idbRequest(store.delete(file.id));
    }
    return files.length;
  }
}

/**
 * Get files grouped by task with task info
 */
export async function getFilesGroupedByTask(): Promise<TaskWithFiles[]> {
  const allFiles = await getAllFiles();
  const allTasks = await getAllTasks();

  // Create a map of task_id to files
  const filesByTask = new Map<string, LibraryFile[]>();
  for (const file of allFiles) {
    const existing = filesByTask.get(file.task_id) || [];
    existing.push(file);
    filesByTask.set(file.task_id, existing);
  }

  // Build result with task info
  const result: TaskWithFiles[] = [];
  for (const task of allTasks) {
    const files = filesByTask.get(task.id);
    if (files && files.length > 0) {
      result.push({ task, files });
    }
  }

  return result;
}

// ============ Utility Functions ============

/**
 * Generate a session ID with timestamp and slug
 */
export function generateSessionId(slug: string = "chat"): string {
  const now = new Date();
  const timestamp = now
    .toISOString()
    .replace(/[-:T.Z]/g, "")
    .slice(0, 14);
  return `${timestamp}_${slug}`;
}

/**
 * Generate a task ID with UUID
 */
export function generateTaskId(): string {
  return crypto.randomUUID();
}
