/**
 * Hook for CLI installation with npm mirror fallback
 *
 * Qclaw 参考: /Users/lxy/Documents/GitHub/others/Qclaw/electron/main/cli.ts
 */

import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
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

/**
 * CLI 检查结果类型
 */
export interface CliCheckResult {
  installed: boolean;
  version: string | null;
  path: string | null;
  error?: string;
}

// Re-export BundledCliResult from bundled-cli module for backwards compatibility
export type { BundledCliResult } from "@/lib/onboarding/bundled-cli";

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
  /** 检查 CLI，返回检查结果
   * @param nodePath - Optional path to Node.js executable. If provided, viben will be looked up in the same directory.
   */
  checkCli: (nodePath?: string | null) => Promise<CliCheckResult>;
  /** 获取 npm 路径
   * @param nodePath - Optional path to Node.js executable. If provided, npm will be looked up in the same directory.
   * @returns npm 路径，如果找不到则返回错误信息
   */
  resolveNpmPath: (nodePath?: string | null) => Promise<{ path: string } | { error: string }>;
  /** 安装 CLI
   * @param nodePath - Optional path to Node.js executable. If provided, npm will be looked up in the same directory.
   */
  installCli: (nodePath?: string | null) => Promise<void>;
  /** 升级 CLI
   * @param nodePath - Optional path to Node.js executable. If provided, npm will be looked up in the same directory.
   */
  upgradeCli: (nodePath?: string | null) => Promise<void>;
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
  const { t } = useTranslation();
  const [state, setState] = useState<CliInstallState>("idle");
  const [progress, setProgress] = useState<CliInstallProgress | null>(null);
  const [versionCheck, setVersionCheck] = useState<VersionCheckResult | null>(null);
  const [issue, setIssue] = useState<CliInstallerIssue | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);

  /**
   * CLI 检查结果类型
   */
  interface CliCheckResult {
    installed: boolean;
    version: string | null;
    path: string | null;
    error?: string;
  }

  /**
   * 检查 CLI 是否已安装及版本
   * 返回检查结果，同时更新 hook 状态
   * @param nodePath - Optional path to Node.js executable. If provided, viben will be looked up in the same directory.
   */
  const checkCli = useCallback(async (nodePath?: string | null): Promise<CliCheckResult> => {
    log("checkCli started", nodePath ? `with nodePath: ${nodePath}` : "without nodePath");
    setState("checking");
    setIssue(null);

    try {
      // 调用 Tauri 命令检查 CLI
      log("Invoking check_viben_cli with node_path:", nodePath);
      const result = await invoke<{
        installed: boolean;
        version: string | null;
        path: string | null;
        source: string | null;
      }>("check_viben_cli", { node_path: nodePath ?? null });
      log("check_viben_cli result:", result);

      setIsInstalled(result.installed);
      setCurrentVersion(result.version);

      if (!result.installed) {
        log("CLI not installed, setting missing-cli issue");
        const issue = createCliInstallerIssue("missing-cli");
        setIssue(issue);
        setState("error");
        return { installed: false, version: null, path: null, error: issue.message };
      }

      // 检查版本
      log("Checking version:", result.version);
      const versionResult = checkVersion(result.version);
      log("Version check result:", versionResult);
      setVersionCheck(versionResult);

      if (versionResult.actionRequired) {
        let issue: CliInstallerIssue;
        if (versionResult.enforcement === "required_upgrade") {
          log("Version too low, upgrade required");
          issue = createCliInstallerIssue("version-too-low", result.version ?? undefined);
        } else if (versionResult.enforcement === "auto_downgrade") {
          log("Version too high, downgrade required");
          issue = createCliInstallerIssue("version-too-high", result.version ?? undefined);
        } else {
          issue = createCliInstallerIssue("unknown-error", versionResult.message);
        }
        setIssue(issue);
        setState("error");
        return { installed: true, version: result.version, path: result.path, error: issue.message };
      }

      log("CLI check successful, version:", result.version);
      setState("success");
      return { installed: true, version: result.version, path: result.path };
    } catch (error) {
      const errorStr = error instanceof Error ? error.message : String(error);
      log("Check failed with exception:", errorStr);
      const issueKind = classifyInstallerError(errorStr);
      const issue = createCliInstallerIssue(issueKind, errorStr);
      setIssue(issue);
      setState("error");
      return { installed: false, version: null, path: null, error: issue.message };
    }
  }, []);

  /**
   * 获取 npm 路径
   * @param nodePath - Optional path to Node.js executable. If provided, npm will be looked up in the same directory.
   * @returns npm 路径，如果找不到则返回错误信息
   */
  const resolveNpmPath = useCallback(async (nodePath?: string | null): Promise<{ path: string } | { error: string }> => {
    log("resolveNpmPath started", nodePath ? `with nodePath: ${nodePath}` : "without nodePath");
    try {
      const npmPath = await invoke<string>("resolve_npm_path", { node_path: nodePath ?? null });
      log("resolveNpmPath result:", npmPath);
      return { path: npmPath };
    } catch (error) {
      const errorStr = error instanceof Error ? error.message : String(error);
      log("resolveNpmPath error:", errorStr);
      return { error: errorStr };
    }
  }, []);

  /**
   * 安装 CLI (带镜像回退)
   * @param nodePath - Optional path to Node.js executable. If provided, npm will be looked up in the same directory.
   * @throws Error 如果所有镜像都失败
   */
  const installCli = useCallback(async (nodePath?: string | null) => {
    log("installCli started", nodePath ? `with nodePath: ${nodePath}` : "without nodePath");
    setState("installing");
    setIssue(null);
    setProgress({ stage: "download", percent: 0, message: t("onboarding.cliInstaller.preparingInstall", "准备安装...") });

    let lastError: string | null = null;

    // 尝试每个镜像源
    for (let i = 0; i < NPM_MIRRORS.length; i++) {
      const mirror = NPM_MIRRORS[i];
      log(`Trying mirror ${i + 1}/${NPM_MIRRORS.length}: ${mirror.name} (${mirror.url})`);

      try {
        setProgress({
          stage: "download",
          percent: 10 + (i * 20),
          message: t("onboarding.cliInstaller.downloadingFrom", { defaultValue: "正在从 {{mirror}} 下载...", mirror: mirror.name }),
        });

        // 调用 Tauri 命令安装
        log("Invoking install_viben_cli with version:", PINNED_VERSION, "registry:", mirror.url, "node_path:", nodePath);
        await invoke("install_viben_cli", {
          version: PINNED_VERSION,
          registry: mirror.url,
          node_path: nodePath ?? null,
        });
        log("install_viben_cli completed successfully");

        setProgress({ stage: "verify", percent: 90, message: t("onboarding.cliInstaller.verifyingInstall", "验证安装...") });

        // 验证安装
        log("Verifying installation...");
        const verifyResult = await checkCli();
        log("Verification completed:", verifyResult);

        if (verifyResult.installed && !verifyResult.error) {
          setProgress({ stage: "verify", percent: 100, message: t("onboarding.cliInstaller.installComplete", "安装完成") });
          return; // 安装成功
        } else {
          // 安装后验证失败
          lastError = verifyResult.error || "Installation verification failed";
          log("Verification failed:", lastError);
          continue; // 尝试下一个镜像
        }
      } catch (error) {
        const errorStr = error instanceof Error ? error.message : String(error);
        log(`Mirror ${mirror.name} failed:`, errorStr);
        lastError = errorStr;

        // 如果不是最后一个镜像，继续尝试
        if (i < NPM_MIRRORS.length - 1) {
          log("Trying next mirror...");
          continue;
        }
      }
    }

    // 所有镜像都失败了
    log("All mirrors failed, last error:", lastError);
    const issueKind = classifyInstallerError(lastError || "Installation failed");
    const issue = createCliInstallerIssue(issueKind, lastError || "Installation failed");
    setIssue(issue);
    setState("error");
    // 抛出异常让调用方知道安装失败
    throw new Error(lastError || "CLI installation failed after trying all mirrors");
  }, [checkCli]);

  /**
   * 升级 CLI
   * @param nodePath - Optional path to Node.js executable. If provided, npm will be looked up in the same directory.
   */
  const upgradeCli = useCallback(async (nodePath?: string | null) => {
    log("upgradeCli started", nodePath ? `with nodePath: ${nodePath}` : "without nodePath");
    setState("upgrading");
    setIssue(null);
    setProgress({ stage: "download", percent: 0, message: t("onboarding.cliInstaller.preparingUpgrade", "准备升级...") });

    try {
      // 使用 installCli 逻辑，但状态不同
      log("Invoking install_viben_cli for upgrade, version:", PINNED_VERSION, "node_path:", nodePath);
      await invoke("install_viben_cli", {
        version: PINNED_VERSION,
        registry: NPM_MIRRORS[0].url,
        node_path: nodePath ?? null,
      });
      log("Upgrade install completed");

      setProgress({ stage: "verify", percent: 90, message: t("onboarding.cliInstaller.verifyingUpgrade", "验证升级...") });
      log("Verifying upgrade...");
      await checkCli();
      setProgress({ stage: "verify", percent: 100, message: t("onboarding.cliInstaller.upgradeComplete", "升级完成") });
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
  const reset = useCallback(() => {
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
    resolveNpmPath,
    installCli,
    upgradeCli,
    reset,
  };
}
