/**
 * Node.js Installer Hook
 *
 * Provides Node.js version checking and installation functionality
 */

import * as React from "react";
import { invoke } from "@tauri-apps/api/core";
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

type NodeInstallerState = "idle" | "checking" | "installing" | "done" | "error";

interface NodeCheckResult {
  installed: boolean;
  version?: string;
  path?: string;
}

interface UseNodeInstallerReturn {
  state: NodeInstallerState;
  issue: NodeInstallerIssue | null;
  currentVersion: string | null;
  currentPath: string | null;
  checkNode: () => Promise<NodeCheckResult>;
  installNode: () => Promise<void>;
  reset: () => void;
}

// ============================================================================
// Tauri Command Types
// ============================================================================

interface TauriNodeCheckResult {
  found: boolean;
  version?: string;
  path?: string;
  error?: string;
}

interface TauriNodeInstallResult {
  success: boolean;
  version?: string;
  path?: string;
  error?: string;
  error_code?: string;
}

// ============================================================================
// Hook
// ============================================================================

export function useNodeInstaller(): UseNodeInstallerReturn {
  const [state, setState] = React.useState<NodeInstallerState>("idle");
  const [issue, setIssue] = React.useState<NodeInstallerIssue | null>(null);
  const [currentVersion, setCurrentVersion] = React.useState<string | null>(null);
  const [currentPath, setCurrentPath] = React.useState<string | null>(null);

  const checkNode = React.useCallback(async (): Promise<NodeCheckResult> => {
    log("checkNode started");
    setState("checking");
    setIssue(null);

    try {
      log("Invoking check_node_installation...");
      const result = await invoke<TauriNodeCheckResult>("check_node_installation");
      log("check_node_installation result:", result);

      if (result.found && result.version) {
        log("Node.js found, version:", result.version, "path:", result.path);
        setCurrentVersion(result.version);
        setCurrentPath(result.path || null);
        setState("done");
        return {
          installed: true,
          version: result.version,
          path: result.path,
        };
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
      return { installed: false };
    }
  }, []);

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

  const reset = React.useCallback(() => {
    log("reset called");
    setState("idle");
    setIssue(null);
    setCurrentVersion(null);
    setCurrentPath(null);
  }, []);

  return {
    state,
    issue,
    currentVersion,
    currentPath,
    checkNode,
    installNode,
    reset,
  };
}
