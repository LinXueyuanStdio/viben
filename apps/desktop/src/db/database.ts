/**
 * Database operations for chat persistence
 * Desktop-only (SQLite via Tauri SQL plugin)
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
  UpdateTaskInput,
} from "./types";

const SQLITE_DB_NAME = "sqlite:viben.db";

// ============ Database Connection ============

/**
 * Database interface matching @tauri-apps/plugin-sql
 * We define this locally to avoid import errors when the package isn't installed
 */
interface Database {
  execute(query: string, bindValues?: unknown[]): Promise<{ rowsAffected: number; lastInsertId: number }>;
  select<T>(query: string, bindValues?: unknown[]): Promise<T>;
  close(): Promise<void>;
}

let db: Database | null = null;
let initPromise: Promise<Database> | null = null;

/**
 * Check if running in Tauri environment
 */
function isTauri(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return "__TAURI_INTERNALS__" in window || "__TAURI__" in window;
}

/**
 * Get or initialize the database connection
 */
async function getDatabase(): Promise<Database> {
  if (db) return db;

  // Prevent multiple simultaneous initializations
  if (initPromise) return initPromise;

  initPromise = (async () => {
    if (!isTauri()) {
      throw new Error("Database is only available in Tauri environment");
    }

    try {
      // Dynamic import to avoid build errors when package isn't installed
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SqlPlugin = await import("@tauri-apps/plugin-sql") as any;
      const DatabaseClass = SqlPlugin.default;
      db = await DatabaseClass.load(SQLITE_DB_NAME) as Database;
      console.log("[SQLite] Database connected successfully");

      // Initialize schema
      await initializeSchema(db);

      return db;
    } catch (error) {
      console.error("[SQLite] Failed to connect:", error);
      initPromise = null;
      throw error;
    }
  })();

  return initPromise;
}

/**
 * Initialize database schema
 */
async function initializeSchema(database: Database): Promise<void> {
  // Create sessions table
  await database.execute(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY NOT NULL,
      prompt TEXT NOT NULL,
      task_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Create tasks table
  await database.execute(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY NOT NULL,
      session_id TEXT NOT NULL,
      task_index INTEGER NOT NULL DEFAULT 1,
      prompt TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'running',
      cost REAL,
      duration INTEGER,
      favorite INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    )
  `);

  // Create messages table
  await database.execute(`
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
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    )
  `);

  // Create files table
  await database.execute(`
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
    )
  `);

  // Create indexes
  await database.execute(
    "CREATE INDEX IF NOT EXISTS idx_tasks_session_id ON tasks(session_id)"
  );
  await database.execute(
    "CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at)"
  );
  await database.execute(
    "CREATE INDEX IF NOT EXISTS idx_messages_task_id ON messages(task_id)"
  );
  await database.execute(
    "CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at)"
  );
  await database.execute(
    "CREATE INDEX IF NOT EXISTS idx_files_task_id ON files(task_id)"
  );
  await database.execute(
    "CREATE INDEX IF NOT EXISTS idx_files_created_at ON files(created_at)"
  );
  await database.execute(
    "CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at)"
  );

  console.log("[SQLite] Schema initialized");
}

/**
 * Check if database is available (running in Tauri)
 */
export function isDatabaseAvailable(): boolean {
  return isTauri();
}

// ============ Session Operations ============

/**
 * Create a new session
 */
export async function createSession(
  input: CreateSessionInput
): Promise<Session> {
  const database = await getDatabase();
  const now = new Date().toISOString();

  await database.execute(
    "INSERT INTO sessions (id, prompt, task_count, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)",
    [input.id, input.prompt, 0, now, now]
  );

  const session: Session = {
    id: input.id,
    prompt: input.prompt,
    task_count: 0,
    created_at: now,
    updated_at: now,
  };

  console.log("[SQLite] Created session:", input.id);
  return session;
}

/**
 * Get a session by ID
 */
export async function getSession(id: string): Promise<Session | null> {
  const database = await getDatabase();

  const result = await database.select<Session[]>(
    "SELECT * FROM sessions WHERE id = $1",
    [id]
  );

  return result[0] || null;
}

/**
 * Get all sessions ordered by creation date (newest first)
 */
export async function getAllSessions(): Promise<Session[]> {
  const database = await getDatabase();

  return database.select<Session[]>(
    "SELECT * FROM sessions ORDER BY created_at DESC"
  );
}

/**
 * Update session task count
 */
export async function updateSessionTaskCount(
  sessionId: string,
  taskCount: number
): Promise<void> {
  const database = await getDatabase();

  await database.execute(
    "UPDATE sessions SET task_count = $1, updated_at = datetime('now') WHERE id = $2",
    [taskCount, sessionId]
  );
}

/**
 * Delete a session and all related tasks/messages
 */
export async function deleteSession(id: string): Promise<boolean> {
  const database = await getDatabase();

  const result = await database.execute(
    "DELETE FROM sessions WHERE id = $1",
    [id]
  );

  return result.rowsAffected > 0;
}

// ============ Task Operations ============

/**
 * Create a new task
 */
export async function createTask(input: CreateTaskInput): Promise<Task> {
  const database = await getDatabase();
  const now = new Date().toISOString();

  await database.execute(
    "INSERT INTO tasks (id, session_id, task_index, prompt, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)",
    [input.id, input.session_id, input.task_index, input.prompt, "running", now, now]
  );

  // Update session task count
  await updateSessionTaskCount(input.session_id, input.task_index);

  const task: Task = {
    id: input.id,
    session_id: input.session_id,
    task_index: input.task_index,
    prompt: input.prompt,
    status: "running",
    cost: null,
    duration: null,
    favorite: false,
    created_at: now,
    updated_at: now,
  };

  console.log("[SQLite] Created task:", input.id);
  return task;
}

/**
 * Get a task by ID
 */
export async function getTask(id: string): Promise<Task | null> {
  const database = await getDatabase();

  const result = await database.select<Task[]>(
    "SELECT * FROM tasks WHERE id = $1",
    [id]
  );

  const task = result[0];
  if (task) {
    // Convert SQLite integer to boolean
    task.favorite = Boolean(task.favorite);
  }

  return task || null;
}

/**
 * Get all tasks ordered by creation date (newest first)
 */
export async function getAllTasks(): Promise<Task[]> {
  const database = await getDatabase();

  const tasks = await database.select<Task[]>(
    "SELECT * FROM tasks ORDER BY created_at DESC"
  );

  // Convert favorite from 0/1 to boolean
  return tasks.map((task) => ({
    ...task,
    favorite: Boolean(task.favorite),
  }));
}

/**
 * Get tasks by session ID
 */
export async function getTasksBySessionId(sessionId: string): Promise<Task[]> {
  const database = await getDatabase();

  const tasks = await database.select<Task[]>(
    "SELECT * FROM tasks WHERE session_id = $1 ORDER BY task_index ASC",
    [sessionId]
  );

  return tasks.map((task) => ({
    ...task,
    favorite: Boolean(task.favorite),
  }));
}

/**
 * Update a task
 */
export async function updateTask(
  id: string,
  input: UpdateTaskInput
): Promise<Task | null> {
  const database = await getDatabase();

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

  if (updates.length === 0) {
    return getTask(id);
  }

  updates.push("updated_at = datetime('now')");
  values.push(id);

  await database.execute(
    `UPDATE tasks SET ${updates.join(", ")} WHERE id = $${paramIndex}`,
    values
  );

  return getTask(id);
}

/**
 * Delete a task and all related messages
 */
export async function deleteTask(id: string): Promise<boolean> {
  const database = await getDatabase();

  const result = await database.execute("DELETE FROM tasks WHERE id = $1", [id]);

  return result.rowsAffected > 0;
}

/**
 * Update task status based on message type
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
      // Task hit max turns limit - keep as running, just update cost/duration
      await updateTask(taskId, { cost, duration });
      console.log(
        `[SQLite] Task ${taskId} hit max turns limit, keeping as running`
      );
    } else {
      await updateTask(taskId, { status: "error", cost, duration });
    }
  } else if (messageType === "error") {
    await updateTask(taskId, { status: "error" });
  }
}

// ============ Message Operations ============

/**
 * Create a new message
 */
export async function createMessage(
  input: CreateMessageInput
): Promise<Message> {
  const database = await getDatabase();
  const now = new Date().toISOString();

  const result = await database.execute(
    `INSERT INTO messages (task_id, type, content, tool_name, tool_input, tool_output, tool_use_id, subtype, error_message, attachments, created_at)
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
      now,
    ]
  );

  const message: Message = {
    id: result.lastInsertId as number,
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
    created_at: now,
  };

  return message;
}

/**
 * Get messages by task ID
 */
export async function getMessagesByTaskId(taskId: string): Promise<Message[]> {
  const database = await getDatabase();

  return database.select<Message[]>(
    "SELECT * FROM messages WHERE task_id = $1 ORDER BY created_at ASC",
    [taskId]
  );
}

/**
 * Delete messages by task ID
 */
export async function deleteMessagesByTaskId(taskId: string): Promise<number> {
  const database = await getDatabase();

  const result = await database.execute(
    "DELETE FROM messages WHERE task_id = $1",
    [taskId]
  );

  return result.rowsAffected;
}

// ============ File Operations ============

/**
 * Create a new file entry
 */
export async function createFile(input: CreateFileInput): Promise<LibraryFile> {
  const database = await getDatabase();
  const now = new Date().toISOString();

  const result = await database.execute(
    `INSERT INTO files (task_id, name, type, path, preview, thumbnail, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      input.task_id,
      input.name,
      input.type,
      input.path,
      input.preview || null,
      input.thumbnail || null,
      now,
    ]
  );

  const file: LibraryFile = {
    id: result.lastInsertId as number,
    task_id: input.task_id,
    name: input.name,
    type: input.type,
    path: input.path,
    preview: input.preview || null,
    thumbnail: input.thumbnail || null,
    is_favorite: false,
    created_at: now,
  };

  return file;
}

/**
 * Get files by task ID
 */
export async function getFilesByTaskId(taskId: string): Promise<LibraryFile[]> {
  const database = await getDatabase();

  const files = await database.select<LibraryFile[]>(
    "SELECT * FROM files WHERE task_id = $1 ORDER BY created_at ASC",
    [taskId]
  );

  return files.map((file) => ({
    ...file,
    is_favorite: Boolean(file.is_favorite),
  }));
}

/**
 * Get all files
 */
export async function getAllFiles(): Promise<LibraryFile[]> {
  const database = await getDatabase();

  const files = await database.select<LibraryFile[]>(
    "SELECT * FROM files ORDER BY created_at DESC"
  );

  return files.map((file) => ({
    ...file,
    is_favorite: Boolean(file.is_favorite),
  }));
}

/**
 * Toggle file favorite status
 */
export async function toggleFileFavorite(
  fileId: number
): Promise<LibraryFile | null> {
  const database = await getDatabase();

  await database.execute(
    "UPDATE files SET is_favorite = NOT is_favorite WHERE id = $1",
    [fileId]
  );

  const files = await database.select<LibraryFile[]>(
    "SELECT * FROM files WHERE id = $1",
    [fileId]
  );

  const file = files[0];
  if (file) {
    file.is_favorite = Boolean(file.is_favorite);
  }

  return file || null;
}

/**
 * Delete a file
 */
export async function deleteFile(fileId: number): Promise<boolean> {
  const database = await getDatabase();

  const result = await database.execute("DELETE FROM files WHERE id = $1", [
    fileId,
  ]);

  return result.rowsAffected > 0;
}

/**
 * Get files grouped by task with task info
 */
export async function getFilesGroupedByTask(): Promise<
  { task: Task; files: LibraryFile[] }[]
> {
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
  const result: { task: Task; files: LibraryFile[] }[] = [];
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
 * Generate a session ID from timestamp and optional slug
 */
export function generateSessionId(slug?: string): string {
  const now = new Date();
  const timestamp = now
    .toISOString()
    .replace(/[-:T.Z]/g, "")
    .slice(0, 14);

  if (slug) {
    // Sanitize slug: lowercase, replace spaces with dashes, remove special chars
    const sanitizedSlug = slug
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .slice(0, 30);
    return `${timestamp}_${sanitizedSlug}`;
  }

  return timestamp;
}

/**
 * Generate a task ID using crypto.randomUUID
 */
export function generateTaskId(): string {
  return crypto.randomUUID();
}

/**
 * Close the database connection
 */
export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.close();
    db = null;
    initPromise = null;
    console.log("[SQLite] Database connection closed");
  }
}
