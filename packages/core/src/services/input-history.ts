import { existsSync } from "node:fs";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { getStateDir } from "../config/paths";

export const INPUT_HISTORY_FILE_NAME = "input_history.jsonl";

export interface InputHistoryEntry {
  text: string;
  created_at: string;
  source?: string;
  session_id?: string;
}

export interface CreateInputHistoryEntryOptions {
  source?: string;
  session_id?: string;
}

export interface ListInputHistoryOptions {
  limit?: number;
}

export function createInputHistoryEntry(
  text: string,
  options: CreateInputHistoryEntryOptions = {}
): InputHistoryEntry {
  return {
    text,
    created_at: new Date().toISOString(),
    ...(options.source ? { source: options.source } : {}),
    ...(options.session_id ? { session_id: options.session_id } : {}),
  };
}

export class InputHistoryService {
  private readonly stateDir: string;

  constructor(stateDir: string = getStateDir()) {
    this.stateDir = stateDir;
  }

  private historyPath(): string {
    return join(this.stateDir, INPUT_HISTORY_FILE_NAME);
  }

  async addEntry(entry: InputHistoryEntry): Promise<void> {
    if (!entry.text.trim()) return;

    const path = this.historyPath();
    await mkdir(dirname(path), { recursive: true });
    await appendFile(path, `${JSON.stringify(entry)}\n`, "utf-8");
  }

  async listEntries(options: ListInputHistoryOptions = {}): Promise<InputHistoryEntry[]> {
    const path = this.historyPath();
    if (!existsSync(path)) return [];

    const raw = await readFile(path, "utf-8");
    const entries: InputHistoryEntry[] = [];
    for (const line of raw.split("\n")) {
      const entry = parseInputHistoryLine(line);
      if (entry) {
        entries.push(entry);
      }
    }

    const limit = normalizeLimit(options.limit);
    return limit === undefined ? entries : entries.slice(Math.max(0, entries.length - limit));
  }

  async listText(options: ListInputHistoryOptions = {}): Promise<string[]> {
    const entries = await this.listEntries(options);
    return entries.map((entry) => entry.text);
  }
}

export const inputHistoryService = new InputHistoryService();

function parseInputHistoryLine(line: string): InputHistoryEntry | null {
  if (!line.trim()) return null;

  try {
    const parsed = JSON.parse(line) as Partial<InputHistoryEntry>;
    if (typeof parsed.text !== "string" || !parsed.text.trim()) return null;
    if (typeof parsed.created_at !== "string") return null;
    return {
      text: parsed.text,
      created_at: parsed.created_at,
      ...(typeof parsed.source === "string" ? { source: parsed.source } : {}),
      ...(typeof parsed.session_id === "string" ? { session_id: parsed.session_id } : {}),
    };
  } catch {
    return null;
  }
}

function normalizeLimit(limit: number | undefined): number | undefined {
  if (limit === undefined) return undefined;
  if (!Number.isFinite(limit)) return undefined;
  return Math.max(0, Math.floor(limit));
}
