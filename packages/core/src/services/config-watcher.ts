/**
 * Config Watcher Service
 *
 * Monitors configuration files for changes and broadcasts events.
 * Uses fs.watch with debouncing to avoid frequent triggers.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { EventService, McpConfigChangedData } from "./events";

/** Configuration for the config watcher */
export interface ConfigWatcherConfig {
  /** Debounce time in milliseconds (default: 500ms) */
  debounceMs?: number;
}

/**
 * Config Watcher Service
 *
 * Monitors specified configuration files and broadcasts events on changes.
 */
export class ConfigWatcherService {
  private events: EventService;
  private debounceMs: number;
  private watchers: Map<string, fs.FSWatcher> = new Map();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private isRunning = false;

  constructor(events: EventService, config: ConfigWatcherConfig = {}) {
    this.events = events;
    this.debounceMs = config.debounceMs ?? 500;
  }

  /**
   * Start watching a configuration file
   *
   * @param filePath - Absolute path to the config file
   */
  watch(filePath: string): void {
    if (this.watchers.has(filePath)) {
      console.log(`[ConfigWatcher] Already watching: ${filePath}`);
      return;
    }

    // Check if file or directory exists
    const exists = fs.existsSync(filePath);
    const dir = path.dirname(filePath);

    if (!exists && !fs.existsSync(dir)) {
      console.log(`[ConfigWatcher] Neither file nor directory exists: ${filePath}`);
      return;
    }

    try {
      // Watch the directory if file doesn't exist yet (to catch creation)
      const watchPath = exists ? filePath : dir;

      const watcher = fs.watch(watchPath, (eventType, filename) => {
        // If watching directory, check if it's our file
        if (!exists && filename !== path.basename(filePath)) {
          return;
        }

        this.handleChange(filePath, eventType);
      });

      watcher.on("error", (err) => {
        console.error(`[ConfigWatcher] Error watching ${filePath}:`, err);
        this.unwatch(filePath);
      });

      this.watchers.set(filePath, watcher);
      console.log(`[ConfigWatcher] Started watching: ${filePath}`);
    } catch (err) {
      console.error(`[ConfigWatcher] Failed to watch ${filePath}:`, err);
    }
  }

  /**
   * Stop watching a configuration file
   */
  unwatch(filePath: string): void {
    const watcher = this.watchers.get(filePath);
    if (watcher) {
      watcher.close();
      this.watchers.delete(filePath);
      console.log(`[ConfigWatcher] Stopped watching: ${filePath}`);
    }

    // Clear any pending debounce timer
    const timer = this.debounceTimers.get(filePath);
    if (timer) {
      clearTimeout(timer);
      this.debounceTimers.delete(filePath);
    }
  }

  /**
   * Handle file change event with debouncing
   */
  private handleChange(filePath: string, eventType: string): void {
    // Clear existing debounce timer
    const existingTimer = this.debounceTimers.get(filePath);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new debounce timer
    const timer = setTimeout(() => {
      this.debounceTimers.delete(filePath);
      this.emitChange(filePath, eventType);
    }, this.debounceMs);

    this.debounceTimers.set(filePath, timer);
  }

  /**
   * Emit the config change event
   */
  private emitChange(filePath: string, eventType: string): void {
    const exists = fs.existsSync(filePath);
    let changeType: McpConfigChangedData["change_type"];

    if (eventType === "rename") {
      // rename can mean created or deleted
      changeType = exists ? "created" : "deleted";
    } else {
      // change event
      changeType = "modified";
    }

    console.log(`[ConfigWatcher] File ${changeType}: ${filePath}`);

    this.events.mcpConfigChanged({
      config_path: filePath,
      change_type: changeType,
      timestamp: Date.now(),
    });
  }

  /**
   * Start the watcher service
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log("[ConfigWatcher] Started");
  }

  /**
   * Stop the watcher service and close all watchers
   */
  stop(): void {
    if (!this.isRunning) return;

    // Close all watchers
    const filePaths = Array.from(this.watchers.keys());
    for (const filePath of filePaths) {
      this.unwatch(filePath);
    }

    this.isRunning = false;
    console.log("[ConfigWatcher] Stopped");
  }

  /**
   * Get all watched file paths
   */
  getWatchedFiles(): string[] {
    return Array.from(this.watchers.keys());
  }

  /**
   * Whether the watcher is currently running
   */
  get running(): boolean {
    return this.isRunning;
  }
}

/**
 * Get the default MCP servers config file path
 */
export function getMcpServersConfigPath(): string {
  const homedir = process.env.HOME || process.env.USERPROFILE || "";
  return path.join(homedir, ".viben", "mcp-servers.json");
}
