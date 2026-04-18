/**
 * Node.js Installer Hook
 *
 * Provides Node.js version checking and installation functionality.
 * Enhanced with auto-install support (参考 Qclaw).
 */

import * as React from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { NodeInstallerIssue } from "@/lib/onboarding/node-installer-issues";
import {
  createNodeInstallerIssue,
  classifyMacNodeInstallerFailure,
  classifyMacGitToolsIssue,
} from "@/lib/onboarding/node-installer-issues";

// Debug logging helper
const log = (message: string, ...args: unknown[]) => {
  console.log(`[useNodeInstaller] ${message}`, ...args);
};

// ============================================================================
// Types
// ============================================================================

export type NodeInstallerState =
  | "idle"
  | "checking"
  | "downloading"
  | "verifying"
  | "installing"
  | "done"
  | "error";

export interface NodeCheckResult {
  installed: boolean;
  version?: string;
  path?: string;
  needsUpgrade?: boolean;
  error?: string;
}

export interface NodeInstallProgress {
  stage: "planning" | "downloading" | "verifying" | "installing" | "finalizing";
  percent: number;
  message: string;
}

export interface UseNodeInstallerReturn {
  state: NodeInstallerState;
  issue: NodeInstallerIssue | null;
  currentVersion: string | null;
  currentPath: string | null;
  progress: NodeInstallProgress | null;
  /** "nvm" | "installer" */
  installStrategy: string;

  /** Check Node.js installation status */
  checkNode: () => Promise<NodeCheckResult>;

  /** Prepare macOS Git tools (Xcode CLT) */
  prepareMacGitTools: () => Promise<MacGitToolsPrepareResult>;

  /** Get Node.js install plan */
  getInstallPlan: () => Promise<NodeInstallPlan>;

  /** Download Node.js installer */
  downloadInstaller: (plan: NodeInstallPlan) => Promise<string>;

  /** Inspect installer (macOS signature check) */
  inspectInstaller: (path: string) => Promise<InstallerInspectResult>;

  /** Execute Node.js installation */
  installEnv: (options: InstallEnvOptions) => Promise<InstallEnvResult>;

  /** Refresh environment variables */
  refreshEnvironment: () => Promise<void>;

  /** Legacy: install Node.js (placeholder) */
  installNode: () => Promise<void>;

  /** Reset state */
  reset: () => void;
}

// ============================================================================
// Tauri Command Types (must match Rust structs)
// ============================================================================

interface TauriNodeInstallResult {
  success: boolean;
  version?: string;
  path?: string;
  error?: string;
  error_code?: string;
}

/** macOS Git 工具准备结果 */
export interface MacGitToolsPrepareResult {
  ok: boolean;
  /** "xcode_clt_pending" | "git_unavailable" | "prepare_failed" */
  error_code?: "xcode_clt_pending" | "git_unavailable" | "prepare_failed";
  stderr?: string;
}

/** Node.js 安装计划 */
export interface NodeInstallPlan {
  version: string;
  required_version: string;
  requirement_source: string;
  source: string;
  platform: string;
  detected_arch: string;
  installer_arch: string;
  dist_base_url: string;
  url: string;
  filename: string;
}

/** 增强版 Node.js 检查结果 */
interface TauriNodeCheckResult {
  installed: boolean;
  version?: string;
  path?: string;
  needs_upgrade: boolean;
  required_version: string;
  target_version?: string;
  install_strategy: string;
  error?: string;
}

/** 安装器检查结果 */
export interface InstallerInspectResult {
  ok: boolean;
  issue_kind?: string;
  message?: string;
  details?: string;
}

/** 安装选项 */
export interface InstallEnvOptions {
  need_node: boolean;
  node_installer_path?: string;
}

/** 安装结果 */
export interface InstallEnvResult {
  ok: boolean;
  stdout?: string;
  stderr?: string;
  stage?: string;
}

/** 下载进度事件 (from Tauri) */
interface DownloadProgressEvent {
  bytes_downloaded: number;
  total_bytes?: number;
  percent?: number;
  stage: string;
  message: string;
}

// ============================================================================
// Hook
// ============================================================================

export function useNodeInstaller(): UseNodeInstallerReturn {
  const [state, setState] = React.useState<NodeInstallerState>("idle");
  const [issue, setIssue] = React.useState<NodeInstallerIssue | null>(null);
  const [currentVersion, setCurrentVersion] = React.useState<string | null>(
    null
  );
  const [currentPath, setCurrentPath] = React.useState<string | null>(null);
  const [progress, setProgress] = React.useState<NodeInstallProgress | null>(
    null
  );
  const [installStrategy, setInstallStrategy] =
    React.useState<string>("installer");

  // Listen to progress events from Tauri
  React.useEffect(() => {
    const unlistenPromise = listen<DownloadProgressEvent>(
      "node-install-progress",
      (event) => {
        log("Progress event:", event.payload);
        const { stage, percent, message } = event.payload;

        // Map Tauri stage to our stage type
        const mappedStage =
          stage === "downloading"
            ? "downloading"
            : stage === "verifying"
              ? "verifying"
              : stage === "installing"
                ? "installing"
                : "planning";

        setProgress({
          stage: mappedStage,
          percent: percent ?? 0,
          message,
        });
      }
    );

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  // ============================================================================
  // Check Node.js (enhanced)
  // ============================================================================

  const checkNode = React.useCallback(async (): Promise<NodeCheckResult> => {
    log("checkNode started");
    setState("checking");
    setIssue(null);

    try {
      log("Invoking check_node_cli...");
      const result =
        await invoke<TauriNodeCheckResult>("check_node_cli");
      log("check_node_cli result:", result);

      setInstallStrategy(result.install_strategy);

      if (result.installed && result.version) {
        log("Node.js found, version:", result.version, "path:", result.path);
        setCurrentVersion(result.version);
        setCurrentPath(result.path || null);

        if (result.needs_upgrade) {
          log("Node.js version too low, needs upgrade");
          setIssue(createNodeInstallerIssue("version-too-low", result.version));
          setState("error");
          return {
            installed: true,
            version: result.version,
            path: result.path,
            needsUpgrade: true,
          };
        }

        setState("done");
        return {
          installed: true,
          version: result.version,
          path: result.path,
          needsUpgrade: false,
        };
      }

      // Check for xcode_clt_pending error
      if (result.error === "xcode_clt_pending") {
        log("Detected xcode_clt_pending error");
        const nodeIssue = classifyMacGitToolsIssue({
          errorCode: "xcode_clt_pending",
          stderr: result.error,
        });
        setIssue(nodeIssue);
        setState("error");
        return { installed: false, error: result.error };
      }

      log("Node.js not found");
      setState("idle");
      return { installed: false };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      log("Check failed:", errorMsg);

      // Check for specific error types
      if (errorMsg.includes("xcode") || errorMsg.includes("clt")) {
        log("Detected xcode/clt issue");
        const nodeIssue = classifyMacGitToolsIssue({
          errorCode: "xcode_clt_pending",
          stderr: errorMsg,
        });
        setIssue(nodeIssue);
      }

      setState("error");
      return { installed: false, error: errorMsg };
    }
  }, []);

  // ============================================================================
  // Prepare macOS Git tools (Xcode CLT)
  // ============================================================================

  const prepareMacGitTools =
    React.useCallback(async (): Promise<MacGitToolsPrepareResult> => {
      log("prepareMacGitTools started");
      setState("checking");
      setIssue(null);
      setProgress({
        stage: "planning",
        percent: 0,
        message: "正在检查 Git 与 Xcode Command Line Tools...",
      });

      try {
        log("Invoking prepare_mac_git_tools...");
        const result = await invoke<MacGitToolsPrepareResult>(
          "prepare_mac_git_tools"
        );
        log("prepare_mac_git_tools result:", result);

        if (!result.ok && result.error_code) {
          const nodeIssue = classifyMacGitToolsIssue({
            errorCode: result.error_code,
            stderr: result.stderr,
          });
          setIssue(nodeIssue);

          // Only set error state if it's not xcode_clt_pending (user can retry)
          if (result.error_code !== "xcode_clt_pending") {
            setState("error");
          }
        } else {
          setState("done");
        }

        return result;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        log("prepareMacGitTools failed:", errorMsg);

        const nodeIssue = createNodeInstallerIssue(
          "developer-tools-prepare-failed",
          errorMsg
        );
        setIssue(nodeIssue);
        setState("error");

        return {
          ok: false,
          error_code: "prepare_failed" as const,
          stderr: errorMsg,
        };
      }
    }, []);

  // ============================================================================
  // Get Node.js install plan
  // ============================================================================

  const getInstallPlan =
    React.useCallback(async (): Promise<NodeInstallPlan> => {
      log("getInstallPlan started");

      const result = await invoke<NodeInstallPlan>("get_node_install_plan");
      log("get_node_install_plan result:", result);

      return result;
    }, []);

  // ============================================================================
  // Download Node.js installer
  // ============================================================================

  const downloadInstaller = React.useCallback(
    async (plan: NodeInstallPlan): Promise<string> => {
      log("downloadInstaller started, plan:", plan);
      setState("downloading");
      setProgress({
        stage: "downloading",
        percent: 0,
        message: `正在下载 Node.js ${plan.version}...`,
      });

      try {
        const installerPath = await invoke<string>("download_node_installer", {
          plan,
        });
        log("download_node_installer result:", installerPath);
        return installerPath;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        log("downloadInstaller failed:", errorMsg);

        const nodeIssue = createNodeInstallerIssue("download-failed", errorMsg);
        setIssue(nodeIssue);
        setState("error");

        throw err;
      }
    },
    []
  );

  // ============================================================================
  // Inspect installer (macOS)
  // ============================================================================

  const inspectInstaller = React.useCallback(
    async (path: string): Promise<InstallerInspectResult> => {
      log("inspectInstaller started, path:", path);
      setState("verifying");
      setProgress({
        stage: "verifying",
        percent: 0,
        message: "正在校验安装包...",
      });

      try {
        const result = await invoke<InstallerInspectResult>(
          "inspect_node_installer",
          { path }
        );
        log("inspect_node_installer result:", result);

        if (!result.ok && result.issue_kind) {
          const nodeIssue = createNodeInstallerIssue(
            result.issue_kind as Parameters<typeof createNodeInstallerIssue>[0],
            result.message
          );
          setIssue(nodeIssue);
          setState("error");
        }

        return result;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        log("inspectInstaller failed:", errorMsg);

        const nodeIssue = createNodeInstallerIssue(
          "corrupted-installer",
          errorMsg
        );
        setIssue(nodeIssue);
        setState("error");

        return {
          ok: false,
          issue_kind: "corrupted-installer",
          message: errorMsg,
        };
      }
    },
    []
  );

  // ============================================================================
  // Install environment (execute installer)
  // ============================================================================

  const installEnv = React.useCallback(
    async (options: InstallEnvOptions): Promise<InstallEnvResult> => {
      log("installEnv started, options:", options);
      setState("installing");
      setProgress({
        stage: "installing",
        percent: 0,
        message: "正在安装 Node.js...",
      });

      try {
        const result = await invoke<InstallEnvResult>("install_env", {
          options,
        });
        log("install_env result:", result);

        if (!result.ok && result.stage) {
          const nodeIssue = classifyMacNodeInstallerFailure(
            result.stderr || result.stage
          );
          setIssue(nodeIssue);
          setState("error");
        } else if (result.ok) {
          setProgress({
            stage: "finalizing",
            percent: 100,
            message: "安装完成",
          });
        }

        return result;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        log("installEnv failed:", errorMsg);

        const nodeIssue = classifyMacNodeInstallerFailure(errorMsg);
        setIssue(nodeIssue);
        setState("error");

        return {
          ok: false,
          stderr: errorMsg,
          stage: "installer-failed",
        };
      }
    },
    []
  );

  // ============================================================================
  // Refresh environment variables
  // ============================================================================

  const refreshEnvironment = React.useCallback(async (): Promise<void> => {
    log("refreshEnvironment started");
    setProgress({
      stage: "finalizing",
      percent: 90,
      message: "正在刷新环境变量...",
    });

    try {
      await invoke("refresh_environment");
      log("refresh_environment completed");
    } catch (err) {
      log("refreshEnvironment failed:", err);
      // Non-fatal error, continue
    }
  }, []);

  // ============================================================================
  // Legacy: install Node.js (placeholder, for backwards compatibility)
  // ============================================================================

  const installNode = React.useCallback(async (): Promise<void> => {
    log("installNode started");
    setState("installing");
    setIssue(null);

    try {
      log("Invoking install_node...");
      const result = await invoke<TauriNodeInstallResult>("install_node");
      log("install_node result:", result);

      if (result.success && result.version) {
        log("Node.js installed successfully, version:", result.version);
        setCurrentVersion(result.version);
        setCurrentPath(result.path || null);
        setState("done");
        return;
      }

      // Installation failed
      log("Installation failed:", result.error);
      const nodeIssue = result.error
        ? classifyMacNodeInstallerFailure(result.error)
        : createNodeInstallerIssue("installer-failed");

      setIssue(nodeIssue);
      setState("error");
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      log("Install failed with exception:", errorMsg);

      const nodeIssue = classifyMacNodeInstallerFailure(errorMsg);
      setIssue(nodeIssue);
      setState("error");
    }
  }, []);

  // ============================================================================
  // Reset
  // ============================================================================

  const reset = React.useCallback(() => {
    log("reset called");
    setState("idle");
    setIssue(null);
    setCurrentVersion(null);
    setCurrentPath(null);
    setProgress(null);
  }, []);

  return {
    state,
    issue,
    currentVersion,
    currentPath,
    progress,
    installStrategy,
    checkNode,
    prepareMacGitTools,
    getInstallPlan,
    downloadInstaller,
    inspectInstaller,
    installEnv,
    refreshEnvironment,
    installNode,
    reset,
  };
}
