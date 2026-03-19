/**
 * Task status operations
 *
 * Status monitoring, log viewing, and registry management
 */

import chalk from "chalk";
import {
  existsSync,
  readFileSync,
  statSync,
  openSync,
  readSync,
  closeSync,
} from "node:fs";
import { join, isAbsolute } from "node:path";

import type { OutputContext } from "../../cli/types";
import {
  getTasksDir,
  getActiveTasks,
  readTaskJson as readTaskJsonFromWorkspace,
  runGitCommand,
  getPhaseInfo,
  getRegistryFile,
  registrySearchAgent,
  registryListAgents,
  isProcessRunning,
  calcElapsed,
  getTaskStats,
  formatTaskStats,
  createCLIAdapter,
  FILE_TASK_JSON,
} from "../../cli/lib/viben-workspace";
import { getSessionId } from "../../cli/lib/swarm";

import type {
  StatusSummaryOptions,
  RunningTaskInfo,
  StoppedTaskInfo,
  RegularTaskInfo,
} from "./types";
import { formatStatus, getPriorityColor } from "./display";

// =============================================================================
// Log Parsing Helpers
// =============================================================================

/**
 * Get last tool call from agent log
 */
export function getLastTool(logFile: string, platform: string = "claude"): string | null {
  if (!existsSync(logFile)) {
    return null;
  }

  try {
    const content = readFileSync(logFile, "utf-8");
    const lines = content.split("\n").slice(-100);

    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      if (!line.trim()) continue;

      try {
        const data = JSON.parse(line);

        if (platform === "opencode") {
          if (data.type === "tool_use") {
            return data.tool;
          }
        } else {
          if (data.type === "assistant") {
            const content = data.message?.content || [];
            for (const item of content) {
              if (item.type === "tool_use") {
                return item.name;
              }
            }
          }
        }
      } catch {
        continue;
      }
    }
  } catch {
    // Ignore errors
  }

  return null;
}

/**
 * Get last assistant message from agent log
 */
export function getLastMessage(logFile: string, maxLen: number = 100, platform: string = "claude"): string | null {
  if (!existsSync(logFile)) {
    return null;
  }

  try {
    const content = readFileSync(logFile, "utf-8");
    const lines = content.split("\n").slice(-100);

    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      if (!line.trim()) continue;

      try {
        const data = JSON.parse(line);

        if (platform === "opencode") {
          if (data.type === "text" && data.text) {
            return data.text.slice(0, maxLen);
          }
        } else {
          if (data.type === "assistant") {
            const content = data.message?.content || [];
            for (const item of content) {
              if (item.type === "text" && item.text) {
                return item.text.slice(0, maxLen);
              }
            }
          }
        }
      } catch {
        continue;
      }
    }
  } catch {
    // Ignore errors
  }

  return null;
}

/**
 * Count modified files in a directory
 */
export function countModifiedFiles(worktree: string): number {
  if (!existsSync(worktree)) {
    return 0;
  }

  try {
    const { stdout } = runGitCommand(["status", "--short"], worktree);
    return stdout.split("\n").filter((line) => line.trim()).length;
  } catch {
    return 0;
  }
}

// =============================================================================
// Tail Follow Implementation
// =============================================================================

/**
 * Cross-platform tail follow implementation
 */
export function tailFollow(filePath: string): void {
  // Get initial file size
  let position = 0;
  try {
    const stats = statSync(filePath);
    position = stats.size;
  } catch {
    // Start from beginning if file doesn't exist
  }

  // Poll for changes
  const pollInterval = setInterval(() => {
    try {
      const stats = statSync(filePath);
      if (stats.size > position) {
        // Read new content
        const fd = openSync(filePath, "r");
        const buffer = Buffer.alloc(stats.size - position);
        readSync(fd, buffer, 0, buffer.length, position);
        closeSync(fd);

        process.stdout.write(buffer.toString("utf-8"));
        position = stats.size;
      } else if (stats.size < position) {
        // File was truncated, start from beginning
        position = 0;
      }
    } catch {
      // File might have been deleted, continue polling
    }
  }, 100);

  // Handle cleanup
  process.on("SIGINT", () => {
    clearInterval(pollInterval);
    console.log();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    clearInterval(pollInterval);
    process.exit(0);
  });
}

// =============================================================================
// Status Sub-commands
// =============================================================================

/**
 * Show summary of all tasks
 */
export function cmdStatusSummary(
  repoRoot: string,
  options: StatusSummaryOptions = {},
  _ctx?: OutputContext
): void {
  const { filterAssignee, filterStatus, onlyRunning } = options;
  const tasksDir = getTasksDir(repoRoot);
  if (!existsSync(tasksDir)) {
    console.log("No tasks directory found");
    return;
  }

  // Count running agents
  const agents = registryListAgents(repoRoot);
  let runningCount = 0;
  for (const agent of agents) {
    if (isProcessRunning(agent.pid)) {
      runningCount++;
    }
  }

  // Task queue stats
  const taskStats = getTaskStats(repoRoot);

  console.log(chalk.blue("=== Multi-Agent Status ==="));
  console.log(`  Agents:  ${chalk.green(String(runningCount))} running / ${agents.length} registered`);
  console.log(`  Tasks:   ${formatTaskStats(taskStats)}`);
  console.log();

  // Process tasks
  const runningTasks: RunningTaskInfo[] = [];
  const stoppedTasks: StoppedTaskInfo[] = [];
  const regularTasks: RegularTaskInfo[] = [];

  const tasks = getActiveTasks(repoRoot);

  for (const t of tasks) {
    const name = t.dir;
    const status = t.status;
    const assignee = t.assignee;
    const priority = t.priority;

    // Filter by assignee
    if (filterAssignee && assignee !== filterAssignee) {
      continue;
    }

    // Filter by status
    if (filterStatus && status !== filterStatus) {
      continue;
    }

    // Check agent status
    const agent = registrySearchAgent(name, repoRoot);

    // If --running flag is set, skip tasks without running agents
    if (onlyRunning && (!agent || !isProcessRunning(agent.pid))) {
      continue;
    }

    if (agent) {
      const pid = agent.pid;
      const worktree = agent.worktree_path;
      const started = agent.started_at;
      const agentPlatform = agent.platform || "claude";

      if (isProcessRunning(pid)) {
        // Running agent
        const taskJsonPath = join(tasksDir, name, FILE_TASK_JSON);
        const phaseInfoStr = getPhaseInfo(taskJsonPath);
        const elapsed = calcElapsed(started);
        const modified = countModifiedFiles(worktree);

        const taskData = readTaskJsonFromWorkspace(join(tasksDir, name));
        const branch = (taskData?.branch as string) || "N/A";

        const logFile = join(worktree, "agent.log.jsonl");
        const lastTool = getLastTool(logFile, agentPlatform);

        runningTasks.push({
          name,
          priority,
          assignee,
          phaseInfo: phaseInfoStr,
          elapsed,
          branch,
          modified,
          lastTool,
          pid,
        });
      } else {
        // Stopped agent
        const logFile = join(worktree, "agent.log.jsonl");
        const taskDirPath = join(tasksDir, name);

        stoppedTasks.push({
          name,
          worktree,
          status,
          taskDir: taskDirPath,
          logFile,
          platform: agentPlatform,
        });
      }
    } else {
      // Regular task
      regularTasks.push({ name, status, priority, assignee });
    }
  }

  // Output running agents
  if (runningTasks.length > 0) {
    console.log(chalk.cyan("Running Agents:"));
    for (const t of runningTasks) {
      const priorityColor = getPriorityColor(t.priority);
      console.log(
        `${chalk.green("▶")} ${chalk.cyan(t.name)} ${chalk.green("[running]")} ${priorityColor(`[${t.priority}]`)} @${t.assignee}`
      );
      console.log(`  Phase:    ${t.phaseInfo}`);
      console.log(`  Elapsed:  ${t.elapsed}`);
      console.log(`  Branch:   ${chalk.gray(t.branch)}`);
      console.log(`  Modified: ${t.modified} file(s)`);
      if (t.lastTool) {
        console.log(`  Activity: ${chalk.yellow(t.lastTool)}`);
      }
      console.log(`  PID:      ${chalk.gray(String(t.pid))}`);
      console.log();
    }
  }

  // Output stopped agents
  if (stoppedTasks.length > 0) {
    console.log(chalk.red("Stopped Agents:"));
    for (const t of stoppedTasks) {
      // Check for completed states
      if (t.status === "completed") {
        console.log(`${chalk.green("✓")} ${t.name} ${chalk.green(`[${t.status}]`)}`);
      } else {
        const sessionId = getSessionId(t.taskDir);
        if (sessionId) {
          const lastMsg = getLastMessage(t.logFile, 150, t.platform);
          console.log(`${chalk.red("○")} ${t.name} ${chalk.red("[stopped]")}`);
          if (lastMsg) {
            console.log(`${chalk.gray(`"${lastMsg}"`)}`);
          }
          const adapter = createCLIAdapter(t.platform);
          const resumeCmd = adapter.getResumeCommandStr(sessionId, t.worktree);
          console.log(chalk.yellow(resumeCmd));
        } else {
          console.log(`${chalk.red("○")} ${t.name} ${chalk.red("[stopped]")} ${chalk.gray("(no session-id)")}`);
        }
      }
      console.log();
    }
  }

  // Separator
  if ((runningTasks.length > 0 || stoppedTasks.length > 0) && regularTasks.length > 0) {
    console.log(chalk.gray("───────────────────────────────────────"));
    console.log();
  }

  // Output regular tasks grouped by assignee
  if (regularTasks.length > 0) {
    // Sort by assignee, priority, status
    regularTasks.sort((a, b) => {
      const assigneeCompare = a.assignee.localeCompare(b.assignee);
      if (assigneeCompare !== 0) return assigneeCompare;

      const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };
      const priorityCompare = (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2);
      if (priorityCompare !== 0) return priorityCompare;

      const statusOrder: Record<string, number> = { in_progress: 0, queue: 1, backlog: 2, review: 3, completed: 4 };
      return (statusOrder[a.status] || 2) - (statusOrder[b.status] || 2);
    });

    let currentAssignee: string | null = null;
    for (const t of regularTasks) {
      if (t.assignee !== currentAssignee) {
        if (currentAssignee !== null) {
          console.log();
        }
        console.log(chalk.cyan(`@${t.assignee}:`));
        currentAssignee = t.assignee;
      }

      const priorityColor = getPriorityColor(t.priority);
      console.log(`  ${formatStatus(t.status).slice(0, 1)} ${t.name} (${t.status}) ${priorityColor(`[${t.priority}]`)}`);
    }
  }

  if (runningTasks.length > 0) {
    console.log();
    console.log(chalk.gray("─────────────────────────────────────"));
    console.log(chalk.gray("Use --detail <name> for more info"));
  }

  console.log();
}

/**
 * List worktrees and agents
 */
export function cmdStatusList(repoRoot: string, _ctx?: OutputContext): void {
  console.log(chalk.blue("=== Git Worktrees ==="));
  console.log();

  // Run git worktree list
  try {
    const { stdout } = runGitCommand(["worktree", "list"], repoRoot);
    if (stdout.trim()) {
      console.log(stdout);
    } else {
      console.log("  (no worktrees)");
    }
  } catch {
    console.log("  (failed to list worktrees)");
  }
  console.log();

  console.log(chalk.blue("=== Registered Agents ==="));
  console.log();

  const agents = registryListAgents(repoRoot);
  if (agents.length === 0) {
    console.log("  (no agents registered)");
    return;
  }

  for (const agent of agents) {
    const agentId = agent.id;
    const pid = agent.pid;
    const worktree = agent.worktree_path;
    const started = agent.started_at;

    const statusIcon = isProcessRunning(pid)
      ? chalk.green("●")
      : chalk.red("○");

    console.log(`  ${statusIcon} ${agentId} (PID: ${pid})`);
    console.log(`    ${chalk.gray(`Worktree: ${worktree}`)}`);
    console.log(`    ${chalk.gray(`Started:  ${started}`)}`);
    console.log();
  }
}

/**
 * Show detailed task status
 */
export function cmdStatusDetail(target: string, repoRoot: string, _ctx?: OutputContext): void {
  const agent = registrySearchAgent(target, repoRoot);
  if (!agent) {
    console.log(`Agent not found: ${target}`);
    return;
  }

  const agentId = agent.id;
  const pid = agent.pid;
  const worktree = agent.worktree_path;
  const taskDir = agent.task_dir;
  const started = agent.started_at;
  const platform = agent.platform || "claude";

  // Get session-id from task.json
  const taskDirAbs = isAbsolute(taskDir) ? taskDir : join(repoRoot, taskDir);
  const sessionId = getSessionId(taskDirAbs) || "";

  console.log(chalk.blue(`=== Agent Detail: ${agentId} ===`));
  console.log();
  console.log(`  ID:        ${agentId}`);
  console.log(`  PID:       ${pid}`);
  console.log(`  Session:   ${sessionId || "N/A"}`);
  console.log(`  Worktree:  ${worktree}`);
  console.log(`  Task Dir:  ${taskDir}`);
  console.log(`  Started:   ${started}`);
  console.log();

  // Status
  if (isProcessRunning(pid)) {
    console.log(`  Status:    ${chalk.green("Running")}`);
  } else {
    console.log(`  Status:    ${chalk.red("Stopped")}`);
    if (sessionId) {
      console.log();
      const adapter = createCLIAdapter(platform);
      const resumeCmd = adapter.getResumeCommandStr(sessionId, worktree);
      console.log(`  ${chalk.yellow("Resume:")} ${resumeCmd}`);
    }
  }

  // Task info
  const taskJsonPath = join(repoRoot, taskDir, FILE_TASK_JSON);
  if (existsSync(taskJsonPath)) {
    console.log();
    console.log(chalk.blue("=== Task Info ==="));
    console.log();
    const data = readTaskJsonFromWorkspace(join(repoRoot, taskDir));
    if (data) {
      console.log(`  Status:      ${data.status || "unknown"}`);
      console.log(`  Branch:      ${data.branch || "N/A"}`);
      console.log(`  Base Branch: ${data.base_branch || "N/A"}`);
    }
  }

  // Git changes
  if (existsSync(worktree)) {
    console.log();
    console.log(chalk.blue("=== Git Changes ==="));
    console.log();

    const { stdout: changes } = runGitCommand(["status", "--short"], worktree);
    if (changes.trim()) {
      const lines = changes.split("\n").filter((l) => l.trim());
      for (const line of lines.slice(0, 10)) {
        console.log(`  ${line}`);
      }
      if (lines.length > 10) {
        console.log(`  ... and ${lines.length - 10} more`);
      }
    } else {
      console.log("  (no changes)");
    }
  }

  console.log();
}

/**
 * Watch agent log in real-time
 */
export function cmdStatusWatch(target: string, repoRoot: string, _ctx?: OutputContext): void {
  const agent = registrySearchAgent(target, repoRoot);
  if (!agent) {
    console.log(`Agent not found: ${target}`);
    return;
  }

  const worktree = agent.worktree_path;
  const logFile = join(worktree, "agent.log.jsonl");

  if (!existsSync(logFile)) {
    console.log(`Log file not found: ${logFile}`);
    return;
  }

  console.log(chalk.blue("Watching:"), logFile);
  console.log(chalk.gray("Press Ctrl+C to stop"));
  console.log();

  // Use cross-platform tail follow
  tailFollow(logFile);
}

/**
 * Show recent log entries
 */
export function cmdStatusLog(target: string, repoRoot: string, _ctx?: OutputContext): void {
  const agent = registrySearchAgent(target, repoRoot);
  if (!agent) {
    console.log(`Agent not found: ${target}`);
    return;
  }

  const worktree = agent.worktree_path;
  const platform = agent.platform || "claude";
  const logFile = join(worktree, "agent.log.jsonl");

  if (!existsSync(logFile)) {
    console.log(`Log file not found: ${logFile}`);
    return;
  }

  console.log(chalk.blue(`=== Recent Log: ${target} ===`));
  console.log(chalk.gray(`Platform: ${platform}`));
  console.log();

  const content = readFileSync(logFile, "utf-8");
  const lines = content.split("\n").slice(-50);

  for (const line of lines) {
    if (!line.trim()) continue;

    try {
      const data = JSON.parse(line);
      const msgType = data.type || "";

      if (platform === "opencode") {
        // OpenCode format
        if (msgType === "text") {
          const text = data.text || "";
          if (text) {
            const display = text.slice(0, 300) + (text.length > 300 ? "..." : "");
            console.log(`${chalk.blue("[TEXT]")} ${display}`);
          }
        } else if (msgType === "tool_use") {
          const toolName = data.tool || "unknown";
          const status = data.state?.status || "";
          console.log(`${chalk.yellow("[TOOL]")} ${toolName} (${status})`);
        } else if (msgType === "step_start") {
          console.log(`${chalk.cyan("[STEP]")} Start`);
        } else if (msgType === "step_finish") {
          const reason = data.reason || "";
          console.log(`${chalk.cyan("[STEP]")} Finish (${reason})`);
        } else if (msgType === "error") {
          const errorMsg = data.message || "";
          console.log(`${chalk.red("[ERROR]")} ${errorMsg}`);
        }
      } else {
        // Claude Code format
        if (msgType === "system") {
          const subtype = data.subtype || "";
          console.log(`${chalk.cyan("[SYSTEM]")} ${subtype}`);
        } else if (msgType === "user") {
          const msgContent = data.message?.content || "";
          if (msgContent) {
            console.log(`${chalk.green("[USER]")} ${msgContent.slice(0, 200)}`);
          }
        } else if (msgType === "assistant") {
          const msgContent = data.message?.content || [];
          if (msgContent.length > 0) {
            const item = msgContent[0];
            const text = item.text;
            const tool = item.name;
            if (text) {
              const display = text.slice(0, 300) + (text.length > 300 ? "..." : "");
              console.log(`${chalk.blue("[ASSISTANT]")} ${display}`);
            } else if (tool) {
              console.log(`${chalk.yellow("[TOOL]")} ${tool}`);
            }
          }
        } else if (msgType === "result") {
          const toolName = data.tool || "unknown";
          console.log(`${chalk.gray("[RESULT]")} ${toolName} completed`);
        }
      }
    } catch {
      continue;
    }
  }
}

/**
 * Show agent registry
 */
export function cmdStatusRegistry(repoRoot: string, _ctx?: OutputContext): void {
  const registryFile = getRegistryFile(repoRoot);

  console.log(chalk.blue("=== Agent Registry ==="));
  console.log();
  console.log(`File: ${registryFile}`);
  console.log();

  if (registryFile && existsSync(registryFile)) {
    const content = readFileSync(registryFile, "utf-8");
    const data = JSON.parse(content);
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log("(registry not found)");
  }
}
