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
    setState("checking");
    setIssue(null);

    try {
      // 调用 Tauri 命令检查 CLI
      const result = await invoke<{
        installed: boolean;
        version: string | null;
        path: string | null;
        source: string | null;
      }>("check_viben_cli");

      setIsInstalled(result.installed);
      setCurrentVersion(result.version);

      if (!result.installed) {
        setIssue(createCliInstallerIssue("missing-cli"));
        setState("error");
        return;
      }

      // 检查版本
      const versionResult = checkVersion(result.version);
      setVersionCheck(versionResult);

      if (versionResult.actionRequired) {
        if (versionResult.enforcement === "required_upgrade") {
          setIssue(createCliInstallerIssue("version-too-low", result.version ?? undefined));
        } else if (versionResult.enforcement === "auto_downgrade") {
          setIssue(createCliInstallerIssue("version-too-high", result.version ?? undefined));
        }
        setState("error");
        return;
      }

      setState("success");
    } catch (error) {
      const errorStr = error instanceof Error ? error.message : String(error);
      const issueKind = classifyInstallerError(errorStr);
      setIssue(createCliInstallerIssue(issueKind, errorStr));
      setState("error");
    }
  }, []);

  /**
   * 安装 CLI (带镜像回退)
   */
  const installCli = React.useCallback(async () => {
    setState("installing");
    setIssue(null);
    setProgress({ stage: "download", percent: 0, message: "准备安装..." });

    // 尝试每个镜像源
    for (let i = 0; i < NPM_MIRRORS.length; i++) {
      const mirror = NPM_MIRRORS[i];

      try {
        setProgress({
          stage: "download",
          percent: 10 + (i * 20),
          message: `正在从 ${mirror.name} 下载...`,
        });

        // 调用 Tauri 命令安装
        await invoke("install_viben_cli", {
          version: PINNED_VERSION,
          registry: mirror.url,
        });

        setProgress({ stage: "verify", percent: 90, message: "验证安装..." });

        // 验证安装
        await checkCli();

        if (isInstalled) {
          setProgress({ stage: "verify", percent: 100, message: "安装完成" });
          setState("success");
          return;
        }
      } catch (error) {
        // 如果不是最后一个镜像，继续尝试
        if (i < NPM_MIRRORS.length - 1) {
          console.warn(`Mirror ${mirror.name} failed, trying next...`);
          continue;
        }

        // 最后一个镜像也失败了
        const errorStr = error instanceof Error ? error.message : String(error);
        const issueKind = classifyInstallerError(errorStr);
        setIssue(createCliInstallerIssue(issueKind, errorStr));
        setState("error");
      }
    }
  }, [checkCli, isInstalled]);

  /**
   * 升级 CLI
   */
  const upgradeCli = React.useCallback(async () => {
    setState("upgrading");
    setIssue(null);
    setProgress({ stage: "download", percent: 0, message: "准备升级..." });

    try {
      // 使用 installCli 逻辑，但状态不同
      await invoke("install_viben_cli", {
        version: PINNED_VERSION,
        registry: NPM_MIRRORS[0].url,
      });

      setProgress({ stage: "verify", percent: 90, message: "验证升级..." });
      await checkCli();
      setProgress({ stage: "verify", percent: 100, message: "升级完成" });
      setState("success");
    } catch (error) {
      const errorStr = error instanceof Error ? error.message : String(error);
      const issueKind = classifyInstallerError(errorStr);
      setIssue(createCliInstallerIssue(issueKind, errorStr));
      setState("error");
    }
  }, [checkCli]);

  /**
   * 重置状态
   */
  const reset = React.useCallback(() => {
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
