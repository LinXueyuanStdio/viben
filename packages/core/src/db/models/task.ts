/**
 * Task model - file-based task storage
 */
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { getStateDir } from "../../config/paths";
import { readYaml, writeYaml, ensureDir, fileExists } from "../../config/yaml";
import { NotFoundError } from "../../error";
import type { Task, TaskStatus, CreateTask, UpdateTask } from "../types";

/**
 * Tasks file structure
 */
interface TasksFile {
  tasks: Record<string, TaskEntry>;
}

interface TaskEntry {
  title: string;
  description?: string;
  status: TaskStatus;
  agentId?: string;
  created_at: string;
  updated_at: string;
}

function getTasksPath(): string {
  return join(getStateDir(), "tasks.yaml");
}

async function loadTasks(): Promise<TasksFile> {
  const path = getTasksPath();
  if (!fileExists(path)) {
    return { tasks: {} };
  }
  const data = await readYaml<TasksFile>(path);
  return data || { tasks: {} };
}

async function saveTasks(data: TasksFile): Promise<void> {
  await ensureDir(getStateDir());
  await writeYaml(getTasksPath(), data);
}

/**
 * Task model operations
 */
export const TaskModel = {
  /**
   * Find all tasks
   */
  async findAll(): Promise<Task[]> {
    const data = await loadTasks();
    return Object.entries(data.tasks)
      .map(([id, entry]) => ({
        id,
        ...entry,
      }))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  /**
   * Find a task by ID
   */
  async findById(id: string): Promise<Task | null> {
    const data = await loadTasks();
    const entry = data.tasks[id];
    if (!entry) {
      return null;
    }
    return { id, ...entry };
  },

  /**
   * Find tasks by agent ID
   */
  async findByAgentId(agentId: string): Promise<Task[]> {
    const all = await this.findAll();
    return all.filter((t) => t.agentId === agentId);
  },

  /**
   * Find tasks by status
   */
  async findByStatus(status: TaskStatus): Promise<Task[]> {
    const all = await this.findAll();
    return all.filter((t) => t.status === status);
  },

  /**
   * Create a new task
   */
  async create(input: CreateTask): Promise<Task> {
    const data = await loadTasks();
    const id = input.id || randomUUID();
    const now = new Date().toISOString();

    const entry: TaskEntry = {
      title: input.title,
      description: input.description,
      status: "backlog",
      agentId: input.agentId,
      created_at: now,
      updated_at: now,
    };

    data.tasks[id] = entry;
    await saveTasks(data);

    return { id, ...entry };
  },

  /**
   * Update a task
   */
  async update(id: string, input: UpdateTask): Promise<Task> {
    const data = await loadTasks();
    const entry = data.tasks[id];
    if (!entry) {
      throw new NotFoundError("Task", id);
    }

    const now = new Date().toISOString();
    const updated: TaskEntry = {
      title: input.title ?? entry.title,
      description: input.description ?? entry.description,
      status: input.status ?? entry.status,
      agentId: input.agentId ?? entry.agentId,
      created_at: entry.created_at,
      updated_at: now,
    };

    data.tasks[id] = updated;
    await saveTasks(data);

    return { id, ...updated };
  },

  /**
   * Update task status
   */
  async updateStatus(id: string, status: TaskStatus): Promise<void> {
    await this.update(id, { status });
  },

  /**
   * Delete a task
   */
  async delete(id: string): Promise<boolean> {
    const data = await loadTasks();
    if (!data.tasks[id]) {
      return false;
    }
    delete data.tasks[id];
    await saveTasks(data);
    return true;
  },
};
