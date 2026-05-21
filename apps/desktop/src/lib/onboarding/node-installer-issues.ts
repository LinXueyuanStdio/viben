/**
 * Node.js installer issue types and classification
 *
 * Qclaw 参考: /Users/lxy/Documents/GitHub/others/Qclaw/src/shared/node-installer-issues.ts
 */

import i18next from "i18next";

// ============================================================================
// Types
// ============================================================================

/**
 * Node.js 安装问题类型
 * 参考 Qclaw: 13 种问题类型
 */
export type NodeInstallerIssueKind =
  | "missing-installer"           // 安装包不存在
  | "corrupted-installer"         // 安装包损坏
  | "missing-system-command"      // 缺少系统命令
  | "xcode-clt-pending"           // 等待 Xcode CLT 安装
  | "git-unavailable"             // Git 不可用
  | "developer-tools-prepare-failed" // 开发者工具准备失败
  | "not-admin-user"              // 非管理员用户
  | "blocked-by-policy"           // 被安全策略阻止
  | "unsupported-macos"           // macOS 版本不支持
  | "user-cancelled"              // 用户取消
  | "permission-denied"           // 权限不足
  | "installer-failed"            // 安装器执行失败
  | "download-failed"             // 下载失败
  | "version-too-low"             // 版本过低，需要升级
  | "version-too-high";           // 版本过高，需要降级

/**
 * Node.js 安装问题
 */
export interface NodeInstallerIssue {
  kind: NodeInstallerIssueKind;
  title: string;
  message: string;
  details?: string;
}

/**
 * Node.js 安装就绪结果
 */
export interface NodeInstallerReadinessResult {
  ok: boolean;
  issue?: NodeInstallerIssue;
}

// ============================================================================
// Issue Factory
// ============================================================================

function normalizeDetails(details: string): string | undefined {
  const normalized = String(details || "").trim();
  return normalized || undefined;
}

/**
 * 创建 Node.js 安装问题
 */
export function createNodeInstallerIssue(
  kind: NodeInstallerIssueKind,
  details = ""
): NodeInstallerIssue {
  const normalizedDetails = normalizeDetails(details);

  const issueMap: Record<NodeInstallerIssueKind, { title: string; message: string }> = {
    "missing-installer": {
      title: i18next.t("onboarding.nodeInstaller.missingInstaller.title", "Node.js 安装包不存在"),
      message: i18next.t("onboarding.nodeInstaller.missingInstaller.message", "已下载的 Node.js 安装包未找到，安装无法继续。请点击「重试」再次下载。"),
    },
    "corrupted-installer": {
      title: i18next.t("onboarding.nodeInstaller.corruptedInstaller.title", "Node.js 安装包无效或已损坏"),
      message: i18next.t("onboarding.nodeInstaller.corruptedInstaller.message", "下载的 Node.js 安装包未通过签名/完整性检查，可能已损坏或被代理替换。请检查网络环境（关闭代理）后重试。"),
    },
    "missing-system-command": {
      title: i18next.t("onboarding.nodeInstaller.missingSystemCommand.title", "系统缺少必要命令"),
      message: i18next.t("onboarding.nodeInstaller.missingSystemCommand.message", "当前系统缺少自动安装所需的系统命令。请在终端运行 xcode-select --install 安装命令行工具，或从 https://nodejs.org 手动安装 Node.js。"),
    },
    "xcode-clt-pending": {
      title: i18next.t("onboarding.nodeInstaller.xcodeCltPending.title", "等待安装 Xcode 命令行工具"),
      message: i18next.t("onboarding.nodeInstaller.xcodeCltPending.message", "已触发 Xcode 命令行工具安装弹窗。请在弹窗中点击「安装」。如未看到弹窗，请在终端运行：xcode-select --install。安装完成后点击「重试」。"),
    },
    "git-unavailable": {
      title: i18next.t("onboarding.nodeInstaller.gitUnavailable.title", "Git 命令不可用"),
      message: i18next.t("onboarding.nodeInstaller.gitUnavailable.message", "无法使用 Git 命令。请在终端运行 xcode-select --install 安装 Xcode 命令行工具（包含 Git），安装完成后点击「重试」。"),
    },
    "developer-tools-prepare-failed": {
      title: i18next.t("onboarding.nodeInstaller.devToolsFailed.title", "开发者工具准备失败"),
      message: i18next.t("onboarding.nodeInstaller.devToolsFailed.message", "准备 Git / Xcode 命令行工具时遇到问题。请在终端运行：xcode-select --install，或从 https://nodejs.org 手动安装 Node.js。"),
    },
    "not-admin-user": {
      title: i18next.t("onboarding.nodeInstaller.notAdminUser.title", "需要管理员权限"),
      message: i18next.t("onboarding.nodeInstaller.notAdminUser.message", "自动安装 Node.js 需要管理员权限。请使用管理员账户重试，或从 https://nodejs.org 下载安装包手动安装。"),
    },
    "blocked-by-policy": {
      title: i18next.t("onboarding.nodeInstaller.blockedByPolicy.title", "安装被系统策略阻止"),
      message: i18next.t("onboarding.nodeInstaller.blockedByPolicy.message", "系统安全策略阻止了 Node.js 安装。请联系 IT 管理员，或使用 nvm (https://github.com/nvm-sh/nvm) 在用户目录安装 Node.js。"),
    },
    "unsupported-macos": {
      title: i18next.t("onboarding.nodeInstaller.unsupportedMacos.title", "macOS 版本不兼容"),
      message: i18next.t("onboarding.nodeInstaller.unsupportedMacos.message", "当前 macOS 版本与 Node.js 安装包不兼容。请升级系统，或从 https://nodejs.org/download/release/ 下载兼容版本。"),
    },
    "user-cancelled": {
      title: i18next.t("onboarding.nodeInstaller.userCancelled.title", "安装已取消"),
      message: i18next.t("onboarding.nodeInstaller.userCancelled.message", "已取消管理员授权或安装流程。如需继续，请点击「重试」。"),
    },
    "permission-denied": {
      title: i18next.t("onboarding.nodeInstaller.permissionDenied.title", "权限不足"),
      message: i18next.t("onboarding.nodeInstaller.permissionDenied.message", "安装 Node.js 时权限不足。请在系统弹窗中输入管理员密码授权，或使用 nvm (https://github.com/nvm-sh/nvm) 安装。"),
    },
    "installer-failed": {
      title: i18next.t("onboarding.nodeInstaller.installerFailed.title", "Node.js 安装失败"),
      message: i18next.t("onboarding.nodeInstaller.installerFailed.message", "Node.js 安装器执行失败。请点击「重试」，或从 https://nodejs.org 下载 LTS 版本手动安装。"),
    },
    "download-failed": {
      title: i18next.t("onboarding.nodeInstaller.downloadFailed.title", "下载失败"),
      message: i18next.t("onboarding.nodeInstaller.downloadFailed.message", "下载 Node.js 安装包失败。请检查网络连接和代理设置，或从 https://nodejs.org 手动下载安装。"),
    },
    "version-too-low": {
      title: i18next.t("onboarding.nodeInstaller.versionTooLow.title", "Node.js 版本过低"),
      message: i18next.t("onboarding.nodeInstaller.versionTooLow.message", "当前 Node.js 版本低于最低要求（需要 v22.16.0 或更高）。请从 https://nodejs.org 下载最新 LTS 版本，或使用下方列表选择其他已安装版本。"),
    },
    "version-too-high": {
      title: i18next.t("onboarding.nodeInstaller.versionTooHigh.title", "Node.js 版本过高"),
      message: i18next.t("onboarding.nodeInstaller.versionTooHigh.message", "当前 Node.js 版本高于推荐版本，部分功能可能不兼容。建议使用 LTS 版本（从 https://nodejs.org 下载）。"),
    },
  };

  const { title, message } = issueMap[kind] || issueMap["installer-failed"];

  return {
    kind,
    title,
    message,
    details: normalizedDetails,
  };
}

// ============================================================================
// Issue Classification
// ============================================================================

/**
 * 分类 macOS Git 工具问题
 */
export function classifyMacGitToolsIssue(result: {
  errorCode?: "xcode_clt_pending" | "git_unavailable" | "prepare_failed";
  stderr?: string;
  stdout?: string;
}): NodeInstallerIssue {
  const details = [String(result.stderr || "").trim(), String(result.stdout || "").trim()]
    .filter(Boolean)
    .join("\n");

  if (result.errorCode === "xcode_clt_pending") {
    return createNodeInstallerIssue("xcode-clt-pending", details);
  }

  if (result.errorCode === "git_unavailable") {
    return createNodeInstallerIssue("git-unavailable", details);
  }

  return createNodeInstallerIssue("developer-tools-prepare-failed", details);
}

/**
 * 分类 macOS Node.js 安装失败
 */
export function classifyMacNodeInstallerFailure(rawError: string): NodeInstallerIssue {
  const raw = String(rawError || "").trim();
  const normalized = raw.toLowerCase();

  if (!raw) {
    return createNodeInstallerIssue("installer-failed");
  }

  // 用户取消
  if (
    normalized.includes("user canceled") ||
    normalized.includes("user cancelled") ||
    normalized.includes("(-128)")
  ) {
    return createNodeInstallerIssue("user-cancelled", raw);
  }

  // macOS 版本不支持
  if (
    normalized.includes("requires macos") ||
    normalized.includes("requires os x") ||
    normalized.includes("incompatible with this version of macos") ||
    normalized.includes("can't be installed on this disk") ||
    normalized.includes("this package is incompatible")
  ) {
    return createNodeInstallerIssue("unsupported-macos", raw);
  }

  // 权限不足
  if (
    normalized.includes("administrator privileges") ||
    normalized.includes("not authorized") ||
    normalized.includes("authorization") ||
    normalized.includes("permission denied")
  ) {
    return createNodeInstallerIssue("permission-denied", raw);
  }

  // 被安全策略阻止
  if (
    normalized.includes("assessment denied") ||
    normalized.includes("rejected") ||
    normalized.includes("untrusted") ||
    normalized.includes("notar") ||
    normalized.includes("cannot be opened because") ||
    normalized.includes("source=no usable signature")
  ) {
    return createNodeInstallerIssue("blocked-by-policy", raw);
  }

  // 安装包不存在
  if (
    normalized.includes("no such file or directory") ||
    normalized.includes("does not exist")
  ) {
    return createNodeInstallerIssue("missing-installer", raw);
  }

  return createNodeInstallerIssue("installer-failed", raw);
}

/**
 * 分类 Node.js 下载失败
 */
export function classifyNodeInstallerDownloadFailure(rawError: string): NodeInstallerIssue {
  return createNodeInstallerIssue("download-failed", rawError);
}
