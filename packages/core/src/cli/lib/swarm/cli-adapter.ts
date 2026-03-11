/**
 * CLI Adapter for Multi-Platform Support
 *
 * Abstracts differences between Claude Code, OpenCode, Cursor, iFlow, Codex, Kilo, Kiro Code, Gemini CLI, and Antigravity interfaces.
 *
 * Supported platforms:
 * - claude: Claude Code (default)
 * - opencode: OpenCode
 * - cursor: Cursor IDE
 * - iflow: iFlow CLI
 * - codex: Codex CLI (skills-based)
 * - kilo: Kilo CLI
 * - kiro: Kiro Code (skills-based)
 * - gemini: Gemini CLI
 * - antigravity: Antigravity (workflow-based)
 *
 * Usage:
 *   import { createCLIAdapter, detectPlatform } from './cli-adapter';
 *
 *   const adapter = createCLIAdapter('opencode');
 *   const cmd = adapter.buildRunCommand({
 *     agent: 'dispatch',
 *     sessionId: 'abc123',
 *     prompt: 'Start the pipeline'
 *   });
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

// =============================================================================
// Types
// =============================================================================

/**
 * Supported platform types
 */
export type Platform =
  | "claude"
  | "opencode"
  | "cursor"
  | "iflow"
  | "codex"
  | "kilo"
  | "kiro"
  | "gemini"
  | "antigravity";

/**
 * Options for building a run command
 */
export interface RunCommandOptions {
  /** Agent name (will be mapped if needed) */
  agent: string;
  /** Prompt to send to the agent */
  prompt: string;
  /** Optional session ID (Claude Code only for creation) */
  sessionId?: string;
  /** Whether to skip permission prompts (default: true) */
  skipPermissions?: boolean;
  /** Whether to enable verbose output (default: true) */
  verbose?: boolean;
  /** Whether to use JSON output format (default: true) */
  jsonOutput?: boolean;
}

/**
 * CLI Adapter interface
 */
export interface ICLIAdapter {
  /** Platform identifier */
  readonly platform: Platform;
  /** CLI executable name */
  readonly cliName: string;
  /** Config directory name */
  readonly configDirName: string;
  /** Whether platform supports specifying session ID on creation */
  readonly supportsSessionIdOnCreate: boolean;
  /** Whether platform supports running agents via CLI */
  readonly supportsCLIAgents: boolean;

  /** Get platform-specific agent name */
  getAgentName(agent: string): string;
  /** Get path to agent config file (.md) */
  getAgentConfigPath(agent: string, projectRoot: string): string;
  /** Get path to config directory */
  getConfigDir(projectRoot: string): string;
  /** Get path to commands directory or specific command file */
  getCommandsPath(projectRoot: string, ...parts: string[]): string;
  /** Get relative path to a viben command file */
  getVibenCommandPath(name: string): string;
  /** Get environment variables for non-interactive mode */
  getNonInteractiveEnv(): Record<string, string>;
  /** Build CLI command for running an agent */
  buildRunCommand(options: RunCommandOptions): string[];
  /** Build CLI command for resuming a session */
  buildResumeCommand(sessionId: string): string[];
  /** Get human-readable resume command string */
  getResumeCommandStr(sessionId: string, cwd?: string): string;
  /** Extract session ID from log output (OpenCode only) */
  extractSessionIdFromLog(logContent: string): string | null;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Agent name mapping for platforms with built-in agents
 *
 * OpenCode has built-in agents that cannot be overridden
 * See: https://github.com/sst/opencode/issues/4271
 */
const AGENT_NAME_MAP: Record<Platform, Record<string, string>> = {
  claude: {},
  opencode: {
    plan: "viben-plan", // 'plan' is built-in in OpenCode
  },
  cursor: {},
  iflow: {},
  codex: {},
  kilo: {},
  kiro: {},
  gemini: {},
  antigravity: {},
};

/**
 * Config directory names for each platform
 */
const CONFIG_DIR_NAMES: Record<Platform, string> = {
  claude: ".claude",
  opencode: ".opencode",
  cursor: ".cursor",
  iflow: ".iflow",
  codex: ".agents",
  kilo: ".kilocode",
  kiro: ".kiro",
  gemini: ".gemini",
  antigravity: ".agent",
};

/**
 * CLI executable names for each platform
 */
const CLI_NAMES: Record<Platform, string> = {
  claude: "claude",
  opencode: "opencode",
  cursor: "cursor", // Note: Cursor is IDE-only, no CLI
  iflow: "iflow",
  codex: "codex",
  kilo: "kilo",
  kiro: "kiro",
  gemini: "gemini",
  antigravity: "agy",
};

/**
 * Platforms that support CLI agent execution
 */
const CLI_AGENT_PLATFORMS: Platform[] = ["claude", "opencode"];

// =============================================================================
// CLIAdapter Implementation
// =============================================================================

/**
 * CLI Adapter for multi-platform support
 */
export class CLIAdapter implements ICLIAdapter {
  constructor(public readonly platform: Platform) {}

  // ===========================================================================
  // Properties
  // ===========================================================================

  /**
   * Get CLI executable name
   */
  get cliName(): string {
    return CLI_NAMES[this.platform];
  }

  /**
   * Get platform-specific config directory name
   */
  get configDirName(): string {
    return CONFIG_DIR_NAMES[this.platform];
  }

  /**
   * Check if platform supports specifying session ID on creation
   *
   * Claude Code: Yes (--session-id)
   * OpenCode: No (auto-generated, extract from logs)
   */
  get supportsSessionIdOnCreate(): boolean {
    return this.platform === "claude";
  }

  /**
   * Check if platform supports running agents via CLI
   *
   * Claude Code and OpenCode support CLI agent execution.
   * Cursor is IDE-only and doesn't support CLI agents.
   */
  get supportsCLIAgents(): boolean {
    return CLI_AGENT_PLATFORMS.includes(this.platform);
  }

  // ===========================================================================
  // Platform Detection Helpers
  // ===========================================================================

  /**
   * Check if platform is OpenCode
   */
  get isOpencode(): boolean {
    return this.platform === "opencode";
  }

  /**
   * Check if platform is Claude Code
   */
  get isClaude(): boolean {
    return this.platform === "claude";
  }

  /**
   * Check if platform is Cursor
   */
  get isCursor(): boolean {
    return this.platform === "cursor";
  }

  // ===========================================================================
  // Agent Name Mapping
  // ===========================================================================

  /**
   * Get platform-specific agent name
   *
   * @param agent - Original agent name (e.g., 'plan', 'dispatch')
   * @returns Platform-specific agent name (e.g., 'viben-plan' for OpenCode)
   */
  getAgentName(agent: string): string {
    const mapping = AGENT_NAME_MAP[this.platform] || {};
    return mapping[agent] || agent;
  }

  // ===========================================================================
  // Path Operations
  // ===========================================================================

  /**
   * Get path to config directory
   *
   * @param projectRoot - Project root directory
   * @returns Path to config directory
   */
  getConfigDir(projectRoot: string): string {
    return join(projectRoot, this.configDirName);
  }

  /**
   * Get path to agent config file (.md)
   *
   * @param agent - Agent name (original, before mapping)
   * @param projectRoot - Project root directory
   * @returns Path to agent config file (.md)
   */
  getAgentConfigPath(agent: string, projectRoot: string): string {
    const mappedName = this.getAgentName(agent);
    return join(this.getConfigDir(projectRoot), "agents", `${mappedName}.md`);
  }

  /**
   * Get path to commands directory or specific command file
   *
   * @param projectRoot - Project root directory
   * @param parts - Additional path parts (e.g., 'viben', 'finish-work.md')
   * @returns Path to commands directory or file
   *
   * @remarks
   * Cursor uses prefix naming: .cursor/commands/viben-<name>.md
   * Antigravity uses workflow directory: .agent/workflows/<name>.md
   * Claude/OpenCode use subdirectory: .claude/commands/viben/<name>.md
   */
  getCommandsPath(projectRoot: string, ...parts: string[]): string {
    if (this.platform === "antigravity") {
      const workflowDir = join(this.getConfigDir(projectRoot), "workflows");
      if (parts.length === 0) {
        return workflowDir;
      }
      if (parts.length >= 2 && parts[0] === "viben") {
        const filename = parts[parts.length - 1];
        return join(workflowDir, filename);
      }
      return join(workflowDir, ...parts);
    }

    if (parts.length === 0) {
      return join(this.getConfigDir(projectRoot), "commands");
    }

    // Cursor uses prefix naming instead of subdirectory
    if (this.platform === "cursor" && parts.length >= 2 && parts[0] === "viben") {
      // Convert viben/<name>.md to viben-<name>.md
      const filename = parts[parts.length - 1];
      return join(this.getConfigDir(projectRoot), "commands", `viben-${filename}`);
    }

    return join(this.getConfigDir(projectRoot), "commands", ...parts);
  }

  /**
   * Get relative path to a viben command file
   *
   * @param name - Command name without extension (e.g., 'finish-work', 'check-backend')
   * @returns Relative path string for use in JSONL entries
   *
   * @remarks
   * Platform-specific paths:
   * - Cursor: .cursor/commands/viben-<name>.md
   * - Codex: .agents/skills/<name>/SKILL.md
   * - Kiro: .kiro/skills/<name>/SKILL.md
   * - Gemini: .gemini/commands/viben/<name>.toml
   * - Antigravity: .agent/workflows/<name>.md
   * - Others: .{platform}/commands/viben/<name>.md
   */
  getVibenCommandPath(name: string): string {
    switch (this.platform) {
      case "cursor":
        return `.cursor/commands/viben-${name}.md`;
      case "codex":
        return `.agents/skills/${name}/SKILL.md`;
      case "kiro":
        return `.kiro/skills/${name}/SKILL.md`;
      case "gemini":
        return `.gemini/commands/viben/${name}.toml`;
      case "antigravity":
        return `.agent/workflows/${name}.md`;
      default:
        return `${this.configDirName}/commands/viben/${name}.md`;
    }
  }

  // ===========================================================================
  // Environment Variables
  // ===========================================================================

  /**
   * Get environment variables for non-interactive mode
   *
   * @returns Dict of environment variables to set
   */
  getNonInteractiveEnv(): Record<string, string> {
    switch (this.platform) {
      case "opencode":
        return { OPENCODE_NON_INTERACTIVE: "1" };
      case "codex":
        return { CODEX_NON_INTERACTIVE: "1" };
      case "kiro":
        return { KIRO_NON_INTERACTIVE: "1" };
      case "gemini":
      case "antigravity":
        return {}; // No non-interactive env var
      default:
        return { CLAUDE_NON_INTERACTIVE: "1" };
    }
  }

  // ===========================================================================
  // CLI Command Building
  // ===========================================================================

  /**
   * Build CLI command for running an agent
   *
   * @param options - Run command options
   * @returns List of command arguments
   */
  buildRunCommand(options: RunCommandOptions): string[] {
    const {
      agent,
      prompt,
      sessionId,
      skipPermissions = true,
      verbose = true,
      jsonOutput = true,
    } = options;

    const mappedAgent = this.getAgentName(agent);

    switch (this.platform) {
      case "opencode": {
        const cmd = ["opencode", "run", "--agent", mappedAgent];

        // Note: OpenCode 'run' mode is non-interactive by default
        // No equivalent to Claude Code's --dangerously-skip-permissions
        // See: https://github.com/anomalyco/opencode/issues/9070

        if (jsonOutput) {
          cmd.push("--format", "json");
        }

        if (verbose) {
          cmd.push("--log-level", "DEBUG", "--print-logs");
        }

        // Note: OpenCode doesn't support --session-id on creation
        // Session ID must be extracted from logs after startup

        cmd.push(prompt);
        return cmd;
      }

      case "codex":
        return ["codex", "exec", prompt];

      case "kiro":
        return ["kiro", "run", prompt];

      case "gemini":
        return ["gemini", prompt];

      case "antigravity":
        throw new Error(
          "Antigravity workflows are UI slash commands; CLI agent run is not supported."
        );

      default: {
        // claude
        const cmd = ["claude", "-p", "--agent", mappedAgent];

        if (sessionId) {
          cmd.push("--session-id", sessionId);
        }

        if (skipPermissions) {
          cmd.push("--dangerously-skip-permissions");
        }

        if (jsonOutput) {
          cmd.push("--output-format", "stream-json");
        }

        if (verbose) {
          cmd.push("--verbose");
        }

        cmd.push(prompt);
        return cmd;
      }
    }
  }

  /**
   * Build CLI command for resuming a session
   *
   * @param sessionId - Session ID to resume
   * @returns List of command arguments
   */
  buildResumeCommand(sessionId: string): string[] {
    switch (this.platform) {
      case "opencode":
        return ["opencode", "run", "--session", sessionId];
      case "codex":
        return ["codex", "resume", sessionId];
      case "kiro":
        return ["kiro", "resume", sessionId];
      case "gemini":
        return ["gemini", "--resume", sessionId];
      case "antigravity":
        throw new Error(
          "Antigravity workflows are UI slash commands; CLI resume is not supported."
        );
      default:
        return ["claude", "--resume", sessionId];
    }
  }

  /**
   * Get human-readable resume command string
   *
   * @param sessionId - Session ID to resume
   * @param cwd - Optional working directory to cd into
   * @returns Command string for display
   */
  getResumeCommandStr(sessionId: string, cwd?: string): string {
    const cmd = this.buildResumeCommand(sessionId);
    const cmdStr = cmd.join(" ");

    if (cwd) {
      return `cd ${cwd} && ${cmdStr}`;
    }
    return cmdStr;
  }

  // ===========================================================================
  // Session ID Handling
  // ===========================================================================

  /**
   * Extract session ID from log output (OpenCode only)
   *
   * OpenCode generates session IDs in format: ses_xxx
   *
   * @param logContent - Log file content
   * @returns Session ID if found, null otherwise
   */
  extractSessionIdFromLog(logContent: string): string | null {
    // OpenCode session ID pattern
    const match = logContent.match(/ses_[a-zA-Z0-9]+/);
    if (match) {
      return match[0];
    }
    return null;
  }
}

// =============================================================================
// Constants for Validation
// =============================================================================

/**
 * Valid platform names
 */
const VALID_PLATFORMS: Platform[] = [
  "claude",
  "opencode",
  "cursor",
  "iflow",
  "codex",
  "kilo",
  "kiro",
  "gemini",
  "antigravity",
];

/**
 * Check if a string is a valid platform
 */
function isValidPlatform(platform: string): platform is Platform {
  return VALID_PLATFORMS.includes(platform as Platform);
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a CLI adapter for the specified platform
 *
 * @param platform - Platform name (string or Platform type)
 * @returns CLIAdapter instance
 * @throws Error if platform is not supported
 */
export function createCLIAdapter(platform: string | Platform = "claude"): ICLIAdapter {
  if (!isValidPlatform(platform)) {
    throw new Error(
      `Unsupported platform: ${platform} (must be one of: ${VALID_PLATFORMS.join(", ")})`
    );
  }

  return new CLIAdapter(platform);
}

/**
 * Auto-detect platform based on existing config directories
 *
 * Detection order:
 * 1. VIBEN_PLATFORM environment variable (if set)
 * 2. .opencode directory exists -> opencode
 * 3. .iflow directory exists -> iflow
 * 4. .cursor directory exists (without .claude) -> cursor
 * 5. .gemini directory exists -> gemini
 * 6. .agents/skills exists and no other platform dirs -> codex
 * 7. .kilocode directory exists -> kilo
 * 8. .kiro/skills exists and no other platform dirs -> kiro
 * 9. .agent/workflows exists and no other platform dirs -> antigravity
 * 10. Default -> claude
 *
 * @param projectRoot - Project root directory
 * @returns Detected platform
 */
export function detectPlatform(projectRoot: string): Platform {
  // Check environment variable first
  const envPlatform = process.env.VIBEN_PLATFORM?.toLowerCase();
  if (
    envPlatform &&
    [
      "claude",
      "opencode",
      "cursor",
      "iflow",
      "codex",
      "kilo",
      "kiro",
      "gemini",
      "antigravity",
    ].includes(envPlatform)
  ) {
    return envPlatform as Platform;
  }

  // Check for .opencode directory (OpenCode-specific)
  if (existsSync(join(projectRoot, ".opencode"))) {
    return "opencode";
  }

  // Check for .iflow directory (iFlow-specific)
  if (existsSync(join(projectRoot, ".iflow"))) {
    return "iflow";
  }

  // Check for .cursor directory (Cursor-specific)
  // Only detect as cursor if .claude doesn't exist (to avoid confusion)
  if (
    existsSync(join(projectRoot, ".cursor")) &&
    !existsSync(join(projectRoot, ".claude"))
  ) {
    return "cursor";
  }

  // Check for .gemini directory (Gemini CLI-specific)
  if (existsSync(join(projectRoot, ".gemini"))) {
    return "gemini";
  }

  // Check for Codex skills directory only when no other platform config exists
  const otherPlatformDirsCodex = [
    ".claude",
    ".cursor",
    ".iflow",
    ".opencode",
    ".kilocode",
    ".kiro",
    ".gemini",
    ".agent",
  ];
  const hasOtherPlatformConfigCodex = otherPlatformDirsCodex.some((dir) =>
    existsSync(join(projectRoot, dir))
  );
  if (
    existsSync(join(projectRoot, ".agents", "skills")) &&
    !hasOtherPlatformConfigCodex
  ) {
    return "codex";
  }

  // Check for .kilocode directory (Kilo-specific)
  if (existsSync(join(projectRoot, ".kilocode"))) {
    return "kilo";
  }

  // Check for Kiro skills directory only when no other platform config exists
  const otherPlatformDirsKiro = [
    ".claude",
    ".cursor",
    ".iflow",
    ".opencode",
    ".agents",
    ".kilocode",
    ".gemini",
    ".agent",
  ];
  const hasOtherPlatformConfigKiro = otherPlatformDirsKiro.some((dir) =>
    existsSync(join(projectRoot, dir))
  );
  if (
    existsSync(join(projectRoot, ".kiro", "skills")) &&
    !hasOtherPlatformConfigKiro
  ) {
    return "kiro";
  }

  // Check for Antigravity workflow directory only when no other platform config exists
  const otherPlatformDirsAntigravity = [
    ".claude",
    ".cursor",
    ".iflow",
    ".opencode",
    ".agents",
    ".kilocode",
    ".kiro",
  ];
  const hasOtherPlatformConfigAntigravity = otherPlatformDirsAntigravity.some(
    (dir) => existsSync(join(projectRoot, dir))
  );
  if (
    existsSync(join(projectRoot, ".agent", "workflows")) &&
    !hasOtherPlatformConfigAntigravity
  ) {
    return "antigravity";
  }

  return "claude";
}

/**
 * Get CLI adapter with auto-detected platform
 *
 * @param projectRoot - Project root directory
 * @returns CLIAdapter instance for detected platform
 */
export function createCLIAdapterAuto(projectRoot: string): ICLIAdapter {
  const platform = detectPlatform(projectRoot);
  return new CLIAdapter(platform);
}
