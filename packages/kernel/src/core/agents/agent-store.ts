/**
 * Persistent storage for installed agent definitions.
 *
 * Agents are stored in `agents.json` (typically `~/.viben/agents.json`).
 * The file is validated with Zod on load; corrupted or invalid data is
 * discarded gracefully with a warning. Writes use atomic rename to
 * prevent partial writes from corrupting the file.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { z } from "zod";
import type { InstalledAgent } from "../types.js";
import { createChildLogger } from "../utils/log.js";

const log = createChildLogger({ module: "agent-store" });

const InstalledAgentSchema = z.object({
  registryId: z.string().nullable(),
  name: z.string(),
  version: z.string(),
  distribution: z.enum(["npx", "uvx", "binary", "custom"]),
  command: z.string(),
  args: z.array(z.string()).default([]),
  env: z.record(z.string(), z.string()).default({}),
  workingDirectory: z.string().optional(),
  installedAt: z.string(),
  binaryPath: z.string().nullable().default(null),
  initTimeoutMs: z.number().positive().optional(),
});

const AgentStoreSchema = z.object({
  version: z.number().default(1),
  installed: z.record(z.string(), InstalledAgentSchema).default({}),
});

type AgentStoreData = z.infer<typeof AgentStoreSchema>;

/** JSON-backed store for installed agent definitions (`agents.json`). */
export class AgentStore {
  private data: AgentStoreData = { version: 1, installed: {} };
  readonly filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  /** Load and validate the store from disk. Starts fresh if file is missing or invalid. */
  load(): void {
    if (!fs.existsSync(this.filePath)) {
      this.data = { version: 1, installed: {} };
      return;
    }

    try {
      const raw = JSON.parse(fs.readFileSync(this.filePath, "utf-8") as string);
      const result = AgentStoreSchema.safeParse(raw);
      if (result.success) {
        this.data = result.data;
      } else {
        log.warn({ errors: result.error.issues }, "Invalid agents.json, starting fresh");
        this.data = { version: 1, installed: {} };
      }
    } catch (err) {
      log.warn({ err }, "Failed to read agents.json, starting fresh");
      this.data = { version: 1, installed: {} };
    }
  }

  exists(): boolean {
    return fs.existsSync(this.filePath);
  }

  getInstalled(): Record<string, InstalledAgent> {
    return this.data.installed;
  }

  getAgent(key: string): InstalledAgent | undefined {
    return this.data.installed[key];
  }

  addAgent(key: string, agent: InstalledAgent): void {
    this.data.installed[key] = agent;
    this.save();
  }

  removeAgent(key: string): void {
    delete this.data.installed[key];
    this.save();
  }

  hasAgent(key: string): boolean {
    return key in this.data.installed;
  }

  /**
   * Persist the store to disk using atomic write (write to .tmp, then rename).
   * File permissions are restricted to owner-only (0o600) since the store
   * may contain agent binary paths and environment variables.
   */
  private save(): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const tmpPath = this.filePath + ".tmp";
    fs.writeFileSync(tmpPath, JSON.stringify(this.data, null, 2), { mode: 0o600 });
    fs.renameSync(tmpPath, this.filePath);
  }
}
