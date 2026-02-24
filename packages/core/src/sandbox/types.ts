/**
 * Sandbox types
 *
 * Type definitions for the sandbox system that provides isolated code execution.
 * sandboxConfig is a session-level configuration, not part of Agent config.
 */

/**
 * Sandbox provider types
 */
export type SandboxProviderType = "native" | "codex" | "claude";

/**
 * Sandbox capabilities
 */
export interface SandboxCapabilities {
  /** Whether volume mounts are supported */
  supportsVolumeMounts: boolean;
  /** Whether network access is available */
  supportsNetworking: boolean;
  /** Isolation level */
  isolation: "vm" | "container" | "process" | "none";
  /** Supported runtimes */
  supportedRuntimes: string[];
  /** Whether instance pooling is supported */
  supportsPooling: boolean;
}

/**
 * Execution options
 */
export interface SandboxExecOptions {
  /** Command to execute */
  command: string;
  /** Command arguments */
  args?: string[];
  /** Working directory */
  cwd?: string;
  /** Environment variables */
  env?: Record<string, string>;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Container image (for Docker provider) */
  image?: string;
}

/**
 * Execution result
 */
export interface SandboxExecResult {
  /** Standard output */
  stdout: string;
  /** Standard error */
  stderr: string;
  /** Exit code */
  exitCode: number;
  /** Execution duration in milliseconds */
  duration: number;
  /** Provider information */
  provider?: {
    type: SandboxProviderType;
    name: string;
  };
}

/**
 * Script execution options
 */
export interface ScriptOptions {
  /** Script arguments */
  args?: string[];
  /** Environment variables */
  env?: Record<string, string>;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Packages to install before execution */
  packages?: string[];
}

/**
 * Sandbox configuration (session-level)
 */
export interface SandboxConfig {
  /** Whether sandbox mode is enabled */
  enabled: boolean;
  /** Specified sandbox provider */
  provider?: SandboxProviderType;
  /** Container image */
  image?: string;
  /** Provider-specific configuration */
  providerConfig?: Record<string, unknown>;
}

/**
 * Sandbox provider interface
 */
export interface ISandboxProvider {
  /** Provider type identifier */
  readonly type: SandboxProviderType;
  /** Human-readable name */
  readonly name: string;

  /** Check if available on current platform */
  isAvailable(): Promise<boolean>;

  /** Initialize provider */
  init(config?: Record<string, unknown>): Promise<void>;

  /** Execute command */
  exec(options: SandboxExecOptions): Promise<SandboxExecResult>;

  /** Run script file */
  runScript(
    filePath: string,
    workDir: string,
    options?: ScriptOptions
  ): Promise<SandboxExecResult>;

  /** Stop current execution */
  stop(): Promise<void>;

  /** Shutdown provider */
  shutdown(): Promise<void>;

  /** Get capabilities */
  getCapabilities(): SandboxCapabilities;
}
