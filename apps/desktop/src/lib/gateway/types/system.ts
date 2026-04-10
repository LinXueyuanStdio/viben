/**
 * System Info Types
 * 系统信息类型定义
 */

// ============================================================================
// System Info Types
// ============================================================================

/** System information */
export interface SystemInfo {
  home_dir: string;
  platform: string;
  arch: string;
  hostname: string;
  release: string;
  type: string;
  viben_dir: string;
}

// ============================================================================
// Python Detection Types
// ============================================================================

/** Python interpreter information */
export interface PythonInfo {
  path: string;
  version: string | null;
  is_valid: boolean;
}

/** Python package information */
export interface PythonPackageInfo {
  name: string;
  version: string | null;
  installed: boolean;
}

// ============================================================================
// CLI Tools Types
// ============================================================================

/** A single detected CLI tool path */
export interface CliToolPath {
  path: string;
  version?: string;
  source: "user-config" | "homebrew" | "nvm" | "pyenv" | "pip" | "npm" | "cargo" | "system-path" | "fallback";
}

/** CLI tool detection result */
export interface CliToolInfo {
  found: boolean;
  path?: string;
  version?: string;
  source: "user-config" | "homebrew" | "nvm" | "pyenv" | "pip" | "npm" | "cargo" | "system-path" | "fallback";
  message?: string;
  /** All discovered paths for this tool */
  alternatives?: CliToolPath[];
  /** User's selected path from config file */
  selectedPath?: string;
}

/** Supported CLI tool names */
export type CliToolName =
  | "python"
  | "git"
  | "gh"
  | "claude"
  | "codex"
  | "aider"
  | "goose"
  | "cline"
  | "continue"
  | "cursor"
  | "viben";

/** All CLI tools detection result */
export interface CliToolsInfo {
  python: CliToolInfo;
  git: CliToolInfo;
  gh: CliToolInfo;
  claude: CliToolInfo;
  codex: CliToolInfo;
  aider: CliToolInfo;
  goose: CliToolInfo;
  cline: CliToolInfo;
  continue: CliToolInfo;
  cursor: CliToolInfo;
  viben: CliToolInfo;
}

/** CLI tools selected paths stored in config file */
export interface CliToolsConfig {
  python?: string;
  git?: string;
  gh?: string;
  claude?: string;
  codex?: string;
  aider?: string;
  goose?: string;
  cline?: string;
  continue?: string;
  cursor?: string;
  viben?: string;
}
