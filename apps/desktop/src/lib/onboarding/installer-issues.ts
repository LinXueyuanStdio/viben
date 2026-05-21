/**
 * Installer issue types and error classification
 *
 * Qclaw reference: /Users/lxy/Documents/GitHub/others/Qclaw/src/shared/node-installer-issues.ts
 */

import i18next from "i18next";

// ============================================================================
// CLI Installer Issue Types (14 types)
// ============================================================================

export type CliInstallerIssueKind =
  | "missing-cli"              // CLI not installed
  | "version-too-low"          // Version too low
  | "version-too-high"         // Version too high (may be incompatible)
  | "missing-node"             // Node.js not installed
  | "node-version-mismatch"    // Node.js version mismatch
  | "npm-not-found"            // npm not found
  | "npm-registry-error"       // npm registry error
  | "download-failed"          // Download failed
  | "install-failed"           // Install failed
  | "permission-denied"        // Permission denied
  | "user-cancelled"           // User cancelled
  | "network-error"            // Network error
  | "xcode-clt-pending"        // macOS: Xcode CLT pending installation
  | "unknown-error";           // Unknown error

// ============================================================================
// CLI Installer Issue Structure
// ============================================================================

export interface CliInstallerIssue {
  kind: CliInstallerIssueKind;
  title: string;
  message: string;
  details?: string;
  /** Whether it blocks the flow */
  blocking: boolean;
  /** Suggested actions */
  suggestedActions: SuggestedAction[];
}

export type SuggestedAction =
  | { type: "retry" }
  | { type: "skip" }
  | { type: "manual-download"; url: string }
  | { type: "open-link"; url: string; label: string }
  | { type: "run-command"; command: string; label: string }
  | { type: "contact-support" };

// ============================================================================
// Issue Factory
// ============================================================================

export function createCliInstallerIssue(
  kind: CliInstallerIssueKind,
  details?: string
): CliInstallerIssue {
  return {
    kind,
    ...getIssueContent(kind),
    details,
    blocking: isBlockingIssue(kind),
    suggestedActions: getSuggestedActions(kind),
  };
}

function getIssueContent(kind: CliInstallerIssueKind): { title: string; message: string } {
  const t = i18next.t.bind(i18next);
  switch (kind) {
    case "missing-cli":
      return {
        title: t("onboarding.installerIssues.missingCli.title", "未找到 Viben CLI"),
        message: t("onboarding.installerIssues.missingCli.message", "需要安装 Viben CLI 才能继续。系统将尝试自动安装，请确保网络连接正常。"),
      };
    case "version-too-low":
      return {
        title: t("onboarding.installerIssues.versionTooLow.title", "Viben CLI 版本过低"),
        message: t("onboarding.installerIssues.versionTooLow.message", "已安装的 Viben CLI 版本不满足最低要求，需要升级。系统将尝试自动升级。"),
      };
    case "version-too-high":
      return {
        title: t("onboarding.installerIssues.versionTooHigh.title", "Viben CLI 版本过高"),
        message: t("onboarding.installerIssues.versionTooHigh.message", "已安装的 Viben CLI 版本可能与本应用不兼容。建议降级到推荐版本。"),
      };
    case "missing-node":
      return {
        title: t("onboarding.installerIssues.missingNode.title", "未找到 Node.js"),
        message: t("onboarding.installerIssues.missingNode.message", "Viben CLI 需要 Node.js 运行时环境。请从 https://nodejs.org 下载安装 Node.js 22 或更高版本。"),
      };
    case "node-version-mismatch":
      return {
        title: t("onboarding.installerIssues.nodeVersionMismatch.title", "Node.js 版本不匹配"),
        message: t("onboarding.installerIssues.nodeVersionMismatch.message", "当前 Node.js 版本不满足要求（需要 v22.16.0 或更高版本）。请从 https://nodejs.org 下载最新 LTS 版本。"),
      };
    case "npm-not-found":
      return {
        title: t("onboarding.installerIssues.npmNotFound.title", "未找到 npm 命令"),
        message: t("onboarding.installerIssues.npmNotFound.message", "npm 通常随 Node.js 一起安装。请重新安装 Node.js，或检查 PATH 环境变量是否正确配置。"),
      };
    case "npm-registry-error":
      return {
        title: t("onboarding.installerIssues.npmRegistryError.title", "npm 仓库连接失败"),
        message: t("onboarding.installerIssues.npmRegistryError.message", "无法连接到 npm 仓库。系统将尝试使用国内镜像源（淘宝、腾讯）自动重试。"),
      };
    case "download-failed":
      return {
        title: t("onboarding.installerIssues.downloadFailed.title", "下载失败"),
        message: t("onboarding.installerIssues.downloadFailed.message", "下载 Viben CLI 失败。请检查网络连接和代理设置，然后点击重试。"),
      };
    case "install-failed":
      return {
        title: t("onboarding.installerIssues.installFailed.title", "安装失败"),
        message: t("onboarding.installerIssues.installFailed.message", "安装 Viben CLI 失败。可尝试在终端运行：npm install -g viben@latest"),
      };
    case "permission-denied":
      return {
        title: t("onboarding.installerIssues.permissionDenied.title", "权限不足"),
        message: t("onboarding.installerIssues.permissionDenied.message", "安装需要更高权限。macOS/Linux 请使用 sudo，Windows 请以管理员身份运行。或使用 nvm 管理 Node.js 以避免权限问题。"),
      };
    case "user-cancelled":
      return {
        title: t("onboarding.installerIssues.userCancelled.title", "已取消"),
        message: t("onboarding.installerIssues.userCancelled.message", "安装已取消。如需继续，请点击重试。"),
      };
    case "network-error":
      return {
        title: t("onboarding.installerIssues.networkError.title", "网络错误"),
        message: t("onboarding.installerIssues.networkError.message", "网络连接失败。请检查网络设置、代理配置或防火墙规则，然后点击重试。"),
      };
    case "xcode-clt-pending":
      return {
        title: t("onboarding.installerIssues.xcodeCltPending.title", "等待安装 Xcode 命令行工具"),
        message: t("onboarding.installerIssues.xcodeCltPending.message", "已触发 Xcode 命令行工具安装。请在系统弹窗中点击「安装」，完成后点击重试。如未看到弹窗，请在终端运行：xcode-select --install"),
      };
    case "unknown-error":
    default:
      return {
        title: t("onboarding.installerIssues.unknownError.title", "未知错误"),
        message: t("onboarding.installerIssues.unknownError.message", "发生未知错误。请查看详细信息，或在终端手动运行：npm install -g viben@latest"),
      };
  }
}

function isBlockingIssue(kind: CliInstallerIssueKind): boolean {
  // These errors do not block the flow, can be skipped
  const nonBlockingIssues: CliInstallerIssueKind[] = [
    "version-too-high",
    "user-cancelled",
  ];
  return !nonBlockingIssues.includes(kind);
}

function getSuggestedActions(kind: CliInstallerIssueKind): SuggestedAction[] {
  switch (kind) {
    case "missing-cli":
    case "version-too-low":
      return [{ type: "retry" }];
    case "version-too-high":
      return [{ type: "skip" }, { type: "retry" }];
    case "missing-node":
      return [
        { type: "open-link", url: "https://nodejs.org/", label: i18next.t("onboarding.installerIssues.downloadNodejs", "Download Node.js") },
        { type: "retry" },
      ];
    case "npm-registry-error":
    case "network-error":
    case "download-failed":
      return [{ type: "retry" }];
    case "install-failed":
    case "permission-denied":
      return [
        { type: "manual-download", url: "https://github.com/LinXueyuanStdio/viben" },
        { type: "retry" },
      ];
    case "user-cancelled":
      return [{ type: "retry" }, { type: "skip" }];
    case "xcode-clt-pending":
      return [{ type: "retry" }];
    case "unknown-error":
    default:
      return [{ type: "retry" }, { type: "contact-support" }];
  }
}

// ============================================================================
// Error Classification from Raw Error
// ============================================================================

/**
 * Classify error type from raw error message
 *
 * Qclaw reference: classifyMacNodeInstallerFailure in node-installer-issues.ts:176-230
 */
export function classifyInstallerError(rawError: string): CliInstallerIssueKind {
  const normalized = rawError.toLowerCase();

  // User cancelled
  if (normalized.includes("user canceled") || normalized.includes("(-128)") || normalized.includes("cancelled")) {
    return "user-cancelled";
  }

  // Permission issues
  if (normalized.includes("permission denied") || normalized.includes("eacces") || normalized.includes("eperm")) {
    return "permission-denied";
  }

  // Network issues
  if (
    normalized.includes("network") ||
    normalized.includes("enotfound") ||
    normalized.includes("etimedout") ||
    normalized.includes("econnrefused") ||
    normalized.includes("econnreset")
  ) {
    return "network-error";
  }

  // npm registry issues
  if (normalized.includes("npm err") || normalized.includes("registry")) {
    return "npm-registry-error";
  }

  // Xcode CLT (macOS)
  if (
    normalized.includes("xcode-select") ||
    normalized.includes("command line tools") ||
    normalized.includes("developer tools")
  ) {
    return "xcode-clt-pending";
  }

  // Download failed
  if (normalized.includes("download") || normalized.includes("fetch")) {
    return "download-failed";
  }

  return "unknown-error";
}
