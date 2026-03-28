/**
 * ExecutionProcess model - file-based execution process storage
 */
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { getStateDir } from "../../config/paths";
import { readYaml, writeYaml, ensureDir, fileExists } from "../../config/yaml";
import { NotFoundError } from "../../error";
import type {
  ExecutionProcess,
  ExecutionProcessStatus,
  CreateExecutionProcess,
  UpdateExecutionProcess,
} from "../types";

/**
 * Execution processes file structure
 */
interface ExecutionProcessesFile {
  processes: Record<string, ExecutionProcessEntry>;
}

interface ExecutionProcessEntry {
  session_id: string;
  pid?: number;
  status: ExecutionProcessStatus;
  exitCode?: number;
  started_at: string;
  ended_at?: string;
}

function getProcessesPath(): string {
  return join(getStateDir(), "execution-processes.yaml");
}

async function loadProcesses(): Promise<ExecutionProcessesFile> {
  const path = getProcessesPath();
  if (!fileExists(path)) {
    return { processes: {} };
  }
  const data = await readYaml<ExecutionProcessesFile>(path);
  return data || { processes: {} };
}

async function saveProcesses(data: ExecutionProcessesFile): Promise<void> {
  await ensureDir(getStateDir());
  await writeYaml(getProcessesPath(), data);
}

/**
 * ExecutionProcess model operations
 */
export const ExecutionProcessModel = {
  /**
   * Find all execution processes
   */
  async findAll(): Promise<ExecutionProcess[]> {
    const data = await loadProcesses();
    return Object.entries(data.processes)
      .map(([id, entry]) => ({
        id,
        ...entry,
      }))
      .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
  },

  /**
   * Find an execution process by ID
   */
  async findById(id: string): Promise<ExecutionProcess | null> {
    const data = await loadProcesses();
    const entry = data.processes[id];
    if (!entry) {
      return null;
    }
    return { id, ...entry };
  },

  /**
   * Find execution processes by session ID
   */
  async findBySessionId(sessionId: string): Promise<ExecutionProcess[]> {
    const all = await this.findAll();
    return all.filter((p) => p.session_id === sessionId);
  },

  /**
   * Find execution processes by status
   */
  async findByStatus(status: ExecutionProcessStatus): Promise<ExecutionProcess[]> {
    const all = await this.findAll();
    return all.filter((p) => p.status === status);
  },

  /**
   * Find running execution processes
   */
  async findRunning(): Promise<ExecutionProcess[]> {
    return this.findByStatus("running");
  },

  /**
   * Create a new execution process
   */
  async create(input: CreateExecutionProcess): Promise<ExecutionProcess> {
    const data = await loadProcesses();
    const id = input.id || randomUUID();
    const now = new Date().toISOString();

    const entry: ExecutionProcessEntry = {
      session_id: input.session_id,
      pid: input.pid,
      status: "running",
      started_at: now,
    };

    data.processes[id] = entry;
    await saveProcesses(data);

    return { id, ...entry };
  },

  /**
   * Update an execution process
   */
  async update(id: string, input: UpdateExecutionProcess): Promise<ExecutionProcess> {
    const data = await loadProcesses();
    const entry = data.processes[id];
    if (!entry) {
      throw new NotFoundError("ExecutionProcess", id);
    }

    const updated: ExecutionProcessEntry = {
      session_id: entry.session_id,
      pid: input.pid ?? entry.pid,
      status: input.status ?? entry.status,
      exitCode: input.exitCode ?? entry.exitCode,
      started_at: entry.started_at,
      ended_at: input.ended_at ?? entry.ended_at,
    };

    data.processes[id] = updated;
    await saveProcesses(data);

    return { id, ...updated };
  },

  /**
   * Mark process as completed
   */
  async markCompleted(id: string, exitCode: number): Promise<void> {
    await this.update(id, {
      status: "completed",
      exitCode,
      ended_at: new Date().toISOString(),
    });
  },

  /**
   * Mark process as failed
   */
  async markFailed(id: string, exitCode?: number): Promise<void> {
    await this.update(id, {
      status: "failed",
      exitCode,
      ended_at: new Date().toISOString(),
    });
  },

  /**
   * Mark process as cancelled
   */
  async markCancelled(id: string): Promise<void> {
    await this.update(id, {
      status: "cancelled",
      ended_at: new Date().toISOString(),
    });
  },

  /**
   * Delete an execution process
   */
  async delete(id: string): Promise<boolean> {
    const data = await loadProcesses();
    if (!data.processes[id]) {
      return false;
    }
    delete data.processes[id];
    await saveProcesses(data);
    return true;
  },
};
