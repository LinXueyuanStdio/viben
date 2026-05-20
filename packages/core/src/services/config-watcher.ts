/**
 * Config Watcher Service
 *
 * Monitors configuration files for changes and broadcasts events.
 * Uses fs.watch with debouncing to avoid frequent triggers.
 */

import * as fs from "node:fs";
import { homedir as nodeHomedir } from "node:os";
import * as path from "node:path";
import { EventService, McpConfigChangedData } from "./events";
import { logger as globalLogger } from "../telemetry";

// Module-level logger
const log = globalLogger.child({ module: "config-watcher" });

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
      log.debug({ filePath }, "Already watching file");
      return;
    }

    // Check if file or directory exists
    const exists = fs.existsSync(filePath);
    const dir = path.dirname(filePath);

    if (!exists && !fs.existsSync(dir)) {
      log.debug({ filePath }, "Neither file nor directory exists");
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
        log.error({ err, filePath }, "Error watching file");
        this.unwatch(filePath);
      });

      this.watchers.set(filePath, watcher);
      log.info({ filePath }, "Started watching file");
    } catch (err) {
      log.error({ err, filePath }, "Failed to watch file");
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
      log.info({ filePath }, "Stopped watching file");
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

    log.info({ filePath, changeType }, "Config file changed");

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
    log.info("Config watcher started");
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
    log.info("Config watcher stopped");
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
  return path.join(nodeHomedir(), ".viben", "mcp-servers.json");
}
