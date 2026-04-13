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
    setState("checking");
    setIssue(null);

    try {
      const result = await invoke<TauriNodeCheckResult>("check_node_installation");

      if (result.found && result.version) {
        setCurrentVersion(result.version);
        setCurrentPath(result.path || null);
        setState("done");
        return {
          installed: true,
          version: result.version,
          path: result.path,
        };
      }

      setState("idle");
      return { installed: false };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("[useNodeInstaller] Check failed:", errorMsg);

      // Check for specific error types
      if (errorMsg.includes("xcode") || errorMsg.includes("clt")) {
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
    setState("installing");
    setIssue(null);

    try {
      const result = await invoke<TauriNodeInstallResult>("install_node");

      if (result.success && result.version) {
        setCurrentVersion(result.version);
        setCurrentPath(result.path || null);
        setState("done");
        return;
      }

      // Installation failed
      const nodeIssue = result.error
        ? classifyMacNodeInstallerFailure(result.error)
        : createNodeInstallerIssue("installer-failed");

      setIssue(nodeIssue);
      setState("error");
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("[useNodeInstaller] Install failed:", errorMsg);

      const nodeIssue = classifyMacNodeInstallerFailure(errorMsg);
      setIssue(nodeIssue);
      setState("error");
    }
  }, []);

  const reset = React.useCallback(() => {
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
