/**
 * Hook for CLI installation with npm mirror fallback
 *
 * Qclaw 参考: /Users/lxy/Documents/GitHub/others/Qclaw/electron/main/cli.ts
 */

import * as React from "react";
import { invoke } from "@tauri-apps/api/core";
import type { CliInstallerIssue } from "@/lib/onboarding/installer-issues";
import { createCliInstallerIssue, classifyInstallerError } from "@/lib/onboarding/installer-issues";
import type { VersionCheckResult } from "@/lib/onboarding/version-policy";
import { checkVersion, PINNED_VERSION } from "@/lib/onboarding/version-policy";

// Debug logging helper
const log = (message: string, ...args: unknown[]) => {
  console.log(`[useCliInstaller] ${message}`, ...args);
};

// ============================================================================
// Types
// ============================================================================

export type CliInstallState =
  | "idle"
  | "checking"
  | "installing"
  | "upgrading"
  | "success"
  | "error";

export interface CliInstallProgress {
  stage: "download" | "install" | "verify";
  percent: number;
  message: string;
}

export interface UseCliInstallerReturn {
  /** 当前状态 */
  state: CliInstallState;
  /** 安装进度 */
  progress: CliInstallProgress | null;
  /** 版本检查结果 */
  versionCheck: VersionCheckResult | null;
  /** 当前问题 */
  issue: CliInstallerIssue | null;
  /** 是否已安装 */
  isInstalled: boolean;
  /** 当前版本 */
  currentVersion: string | null;
  /** 检查 CLI */
  checkCli: () => Promise<void>;
  /** 安装 CLI */
  installCli: () => Promise<void>;
  /** 升级 CLI */
  upgradeCli: () => Promise<void>;
  /** 重置状态 */
  reset: () => void;
}

// ============================================================================
// npm 镜像源
// ============================================================================

const NPM_MIRRORS = [
  { name: "npm", url: "https://registry.npmjs.org" },
  { name: "taobao", url: "https://registry.npmmirror.com" },
  { name: "tencent", url: "https://mirrors.cloud.tencent.com/npm/" },
];

// ============================================================================
// Hook Implementation
// ============================================================================

export function useCliInstaller(): UseCliInstallerReturn {
  const [state, setState] = React.useState<CliInstallState>("idle");
  const [progress, setProgress] = React.useState<CliInstallProgress | null>(null);
  const [versionCheck, setVersionCheck] = React.useState<VersionCheckResult | null>(null);
  const [issue, setIssue] = React.useState<CliInstallerIssue | null>(null);
  const [isInstalled, setIsInstalled] = React.useState(false);
  const [currentVersion, setCurrentVersion] = React.useState<string | null>(null);

  /**
   * 检查 CLI 是否已安装及版本
   */
  const checkCli = React.useCallback(async () => {
    log("checkCli started");
    setState("checking");
    setIssue(null);

    try {
      // 调用 Tauri 命令检查 CLI
      log("Invoking check_viben_cli...");
      const result = await invoke<{
        installed: boolean;
        version: string | null;
        path: string | null;
        source: string | null;
      }>("check_viben_cli");
      log("check_viben_cli result:", result);

      setIsInstalled(result.installed);
      setCurrentVersion(result.version);

      if (!result.installed) {
        log("CLI not installed, setting missing-cli issue");
        setIssue(createCliInstallerIssue("missing-cli"));
        setState("error");
        return;
      }

      // 检查版本
      log("Checking version:", result.version);
      const versionResult = checkVersion(result.version);
      log("Version check result:", versionResult);
      setVersionCheck(versionResult);

      if (versionResult.actionRequired) {
        if (versionResult.enforcement === "required_upgrade") {
          log("Version too low, upgrade required");
          setIssue(createCliInstallerIssue("version-too-low", result.version ?? undefined));
        } else if (versionResult.enforcement === "auto_downgrade") {
          log("Version too high, downgrade required");
          setIssue(createCliInstallerIssue("version-too-high", result.version ?? undefined));
        }
        setState("error");
        return;
      }

      log("CLI check successful, version:", result.version);
      setState("success");
    } catch (error) {
      const errorStr = error instanceof Error ? error.message : String(error);
      log("Check failed with exception:", errorStr);
      const issueKind = classifyInstallerError(errorStr);
      setIssue(createCliInstallerIssue(issueKind, errorStr));
      setState("error");
    }
  }, []);

  /**
   * 安装 CLI (带镜像回退)
   */
  const installCli = React.useCallback(async () => {
    log("installCli started");
    setState("installing");
    setIssue(null);
    setProgress({ stage: "download", percent: 0, message: "准备安装..." });

    // 尝试每个镜像源
    for (let i = 0; i < NPM_MIRRORS.length; i++) {
      const mirror = NPM_MIRRORS[i];
      log(`Trying mirror ${i + 1}/${NPM_MIRRORS.length}: ${mirror.name} (${mirror.url})`);

      try {
        setProgress({
          stage: "download",
          percent: 10 + (i * 20),
          message: `正在从 ${mirror.name} 下载...`,
        });

        // 调用 Tauri 命令安装
        log("Invoking install_viben_cli with version:", PINNED_VERSION, "registry:", mirror.url);
        await invoke("install_viben_cli", {
          version: PINNED_VERSION,
          registry: mirror.url,
        });
        log("install_viben_cli completed successfully");

        setProgress({ stage: "verify", percent: 90, message: "验证安装..." });

        // 验证安装
        log("Verifying installation...");
        await checkCli();
        log("Verification completed, isInstalled will be updated by state");

        // Note: isInstalled is a stale closure here, we rely on checkCli to set state
        // The success state will be set by checkCli if installation was successful
        setProgress({ stage: "verify", percent: 100, message: "安装完成" });
        return;
      } catch (error) {
        const errorStr = error instanceof Error ? error.message : String(error);
        log(`Mirror ${mirror.name} failed:`, errorStr);

        // 如果不是最后一个镜像，继续尝试
        if (i < NPM_MIRRORS.length - 1) {
          log("Trying next mirror...");
          continue;
        }

        // 最后一个镜像也失败了
        log("All mirrors failed");
        const issueKind = classifyInstallerError(errorStr);
        setIssue(createCliInstallerIssue(issueKind, errorStr));
        setState("error");
      }
    }
  }, [checkCli]);

  /**
   * 升级 CLI
   */
  const upgradeCli = React.useCallback(async () => {
    log("upgradeCli started");
    setState("upgrading");
    setIssue(null);
    setProgress({ stage: "download", percent: 0, message: "准备升级..." });

    try {
      // 使用 installCli 逻辑，但状态不同
      log("Invoking install_viben_cli for upgrade, version:", PINNED_VERSION);
      await invoke("install_viben_cli", {
        version: PINNED_VERSION,
        registry: NPM_MIRRORS[0].url,
      });
      log("Upgrade install completed");

      setProgress({ stage: "verify", percent: 90, message: "验证升级..." });
      log("Verifying upgrade...");
      await checkCli();
      setProgress({ stage: "verify", percent: 100, message: "升级完成" });
      log("Upgrade successful");
      setState("success");
    } catch (error) {
      const errorStr = error instanceof Error ? error.message : String(error);
      log("Upgrade failed:", errorStr);
      const issueKind = classifyInstallerError(errorStr);
      setIssue(createCliInstallerIssue(issueKind, errorStr));
      setState("error");
    }
  }, [checkCli]);

  /**
   * 重置状态
   */
  const reset = React.useCallback(() => {
    log("reset called");
    setState("idle");
    setProgress(null);
    setIssue(null);
  }, []);

  return {
    state,
    progress,
    versionCheck,
    issue,
    isInstalled,
    currentVersion,
    checkCli,
    installCli,
    upgradeCli,
    reset,
  };
}
