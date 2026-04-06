/**
 * Temporary directory utilities for integration tests
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

export interface TempDirContext {
  /** Root temporary directory */
  root: string;
  /** Create a subdirectory */
  mkdir: (subpath: string) => Promise<string>;
  /** Write a file */
  writeFile: (subpath: string, content: string) => Promise<string>;
  /** Write JSON file */
  writeJson: (subpath: string, data: unknown) => Promise<string>;
  /** Read a file */
  readFile: (subpath: string) => Promise<string>;
  /** Read JSON file */
  readJson: <T = unknown>(subpath: string) => Promise<T>;
  /** Check if file exists */
  exists: (subpath: string) => Promise<boolean>;
  /** Get absolute path */
  resolve: (subpath: string) => string;
  /** List files in directory */
  listFiles: (subpath?: string) => Promise<string[]>;
  /** Cleanup - remove temp directory */
  cleanup: () => Promise<void>;
}

/**
 * Create a temporary directory context for tests
 */
export async function createTempDir(prefix = "viben-test-"): Promise<TempDirContext> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), prefix));

  const resolve = (subpath: string) => path.join(root, subpath);

  const mkdir = async (subpath: string) => {
    const fullPath = resolve(subpath);
    await fs.mkdir(fullPath, { recursive: true });
    return fullPath;
  };

  const writeFile = async (subpath: string, content: string) => {
    const fullPath = resolve(subpath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, "utf-8");
    return fullPath;
  };

  const writeJson = async (subpath: string, data: unknown) => {
    return writeFile(subpath, JSON.stringify(data, null, 2));
  };

  const readFile = async (subpath: string) => {
    return fs.readFile(resolve(subpath), "utf-8");
  };

  const readJson = async <T = unknown>(subpath: string): Promise<T> => {
    const content = await readFile(subpath);
    return JSON.parse(content) as T;
  };

  const exists = async (subpath: string) => {
    try {
      await fs.access(resolve(subpath));
      return true;
    } catch {
      return false;
    }
  };

  const listFiles = async (subpath = "") => {
    const dir = resolve(subpath);
    try {
      return await fs.readdir(dir);
    } catch {
      return [];
    }
  };

  const cleanup = async () => {
    await fs.rm(root, { recursive: true, force: true });
  };

  return {
    root,
    resolve,
    mkdir,
    writeFile,
    writeJson,
    readFile,
    readJson,
    exists,
    listFiles,
    cleanup,
  };
}

/**
 * Create a workspace-like directory structure for testing
 */
export async function createWorkspaceTempDir(): Promise<TempDirContext & {
  vibenDir: string;
  tasksDir: string;
}> {
  const ctx = await createTempDir("viben-workspace-");

  const vibenDir = await ctx.mkdir(".viben");
  const tasksDir = await ctx.mkdir(".viben/tasks");

  return {
    ...ctx,
    vibenDir,
    tasksDir,
  };
}

/**
 * Create a task directory with task.json
 */
export async function createTaskDir(
  ctx: TempDirContext,
  taskName: string,
  taskData: Record<string, unknown> = {}
): Promise<string> {
  const taskDir = await ctx.mkdir(`.viben/tasks/${taskName}`);
  const now = new Date().toISOString();

  // Derive xstate_state from status if not provided
  // This ensures the task state machine recognizes the initial state
  const status = (taskData.status as string) ?? "backlog";
  const xstate_state = taskData.xstate_state ?? deriveXStateFromStatus(status);

  // Convert legacy pausedSnapshot format to machine_context format
  // Tests may use pausedSnapshot but the state machine expects machine_context.paused_snapshot
  const processedData = { ...taskData };
  if (processedData.pausedSnapshot && !processedData.machine_context) {
    const snapshot = processedData.pausedSnapshot as {
      fromState?: unknown;
      subtaskIndex?: number;
      pausedAt?: string;
    };
    // Convert shorthand "in_progress" to XState nested format { in_progress: "implement" }
    let fromState: unknown = snapshot.fromState ?? "queue";
    if (fromState === "in_progress") {
      fromState = { in_progress: "implement" }; // Default substate
    }
    processedData.machine_context = {
      current_subtask_index: snapshot.subtaskIndex ?? 0,
      requires_plan_review: false,
      paused_snapshot: {
        from_state: fromState,
        subtask_index: snapshot.subtaskIndex ?? 0,
        paused_at: snapshot.pausedAt ?? now,
      },
    };
    delete processedData.pausedSnapshot;
  }

  await ctx.writeJson(`.viben/tasks/${taskName}/task.json`, {
    id: taskName,
    name: taskName,
    title: `Test Task: ${taskName}`,
    status: "backlog",
    priority: "medium",
    created_at: now,
    updated_at: now,
    xstate_state,
    ...processedData,
  });

  return taskDir;
}

/**
 * Derive XState state from status for test setup
 */
function deriveXStateFromStatus(status: string): string | Record<string, string> {
  switch (status) {
    case "backlog":
      return "backlog";
    case "queue":
      return "queue";
    case "in_progress":
      return { in_progress: "implement" }; // Default sub-state
    case "paused":
      return "paused";
    case "review":
      return "review";
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
    default:
      return "backlog";
  }
}
