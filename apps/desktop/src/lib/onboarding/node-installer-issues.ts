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
      title: i18next.t("onboarding.nodeInstaller.missingInstaller.title", "Node 安装包不存在"),
      message: i18next.t("onboarding.nodeInstaller.missingInstaller.message", "已下载的 Node.js 安装包没有找到，安装无法继续。请点击「继续安装」再次尝试。"),
    },
    "corrupted-installer": {
      title: i18next.t("onboarding.nodeInstaller.corruptedInstaller.title", "Node 安装包无效或已损坏"),
      message: i18next.t("onboarding.nodeInstaller.corruptedInstaller.message", "下载到的 Node.js 安装包未通过签名/完整性检查，可能已损坏或被代理替换。请检查网络环境后重试。"),
    },
    "missing-system-command": {
      title: i18next.t("onboarding.nodeInstaller.missingSystemCommand.title", "系统缺少安装预检命令"),
      message: i18next.t("onboarding.nodeInstaller.missingSystemCommand.message", "当前系统缺少 Node.js 自动安装所需的系统命令，无法继续自动预检。请联系管理员修复系统工具，或改为手动安装 Node.js。"),
    },
    "xcode-clt-pending": {
      title: i18next.t("onboarding.nodeInstaller.xcodeCltPending.title", "等待 Xcode Command Line Tools 安装完成"),
      message: i18next.t("onboarding.nodeInstaller.xcodeCltPending.message", "已尝试触发 Xcode 命令行工具系统安装弹窗。如果没有弹窗，请点击屏幕右下角的安装图标继续安装；安装完成后，点击「重试检测」刷新状态。"),
    },
    "git-unavailable": {
      title: i18next.t("onboarding.nodeInstaller.gitUnavailable.title", "Git 命令不可用"),
      message: i18next.t("onboarding.nodeInstaller.gitUnavailable.message", "当前系统无法使用 Git，无法继续环境准备。请先修复 Git 或安装 Xcode Command Line Tools 后重试。"),
    },
    "developer-tools-prepare-failed": {
      title: i18next.t("onboarding.nodeInstaller.devToolsFailed.title", "macOS 开发者工具预检失败"),
      message: i18next.t("onboarding.nodeInstaller.devToolsFailed.message", "在准备 Git / Xcode Command Line Tools 时遇到问题。请稍后重试；如果仍失败，请手动检查系统开发者工具状态。"),
    },
    "not-admin-user": {
      title: i18next.t("onboarding.nodeInstaller.notAdminUser.title", "当前账户没有管理员权限"),
      message: i18next.t("onboarding.nodeInstaller.notAdminUser.message", "自动安装 Node.js 需要 macOS 管理员权限。请使用管理员账户登录，或联系设备管理员处理。"),
    },
    "blocked-by-policy": {
      title: i18next.t("onboarding.nodeInstaller.blockedByPolicy.title", "系统策略阻止了安装"),
      message: i18next.t("onboarding.nodeInstaller.blockedByPolicy.message", "这台电脑的安全策略阻止了 Node.js 安装。请联系管理员处理，或改为手动安装 Node.js。"),
    },
    "unsupported-macos": {
      title: i18next.t("onboarding.nodeInstaller.unsupportedMacos.title", "当前 macOS 版本不支持该 Node 安装包"),
      message: i18next.t("onboarding.nodeInstaller.unsupportedMacos.message", "当前系统版本与目标 Node.js 安装包不兼容，无法继续自动安装。请先升级系统，或手动安装兼容的 Node.js 版本。"),
    },
    "user-cancelled": {
      title: i18next.t("onboarding.nodeInstaller.userCancelled.title", "已取消 Node 安装"),
      message: i18next.t("onboarding.nodeInstaller.userCancelled.message", "你已取消管理员授权或安装流程，因此 Node.js 未安装。"),
    },
    "permission-denied": {
      title: i18next.t("onboarding.nodeInstaller.permissionDenied.title", "没有足够权限安装 Node.js"),
      message: i18next.t("onboarding.nodeInstaller.permissionDenied.message", "安装 Node.js 时权限不足。请确认当前账号具备管理员权限，并允许系统弹出的安装授权。"),
    },
    "installer-failed": {
      title: i18next.t("onboarding.nodeInstaller.installerFailed.title", "Node 安装器执行失败"),
      message: i18next.t("onboarding.nodeInstaller.installerFailed.message", "Node.js 安装器执行时报错。请稍后重试；如果仍然失败，建议去 Node.js 官网手动安装。"),
    },
    "download-failed": {
      title: i18next.t("onboarding.nodeInstaller.downloadFailed.title", "Node 安装包下载失败"),
      message: i18next.t("onboarding.nodeInstaller.downloadFailed.message", "自动下载 Node.js 安装包失败。请检查网络、代理或证书设置；如果仍然失败，可前往 Node.js 官网手动下载。"),
    },
    "version-too-low": {
      title: i18next.t("onboarding.nodeInstaller.versionTooLow.title", "Node.js 版本过低"),
      message: i18next.t("onboarding.nodeInstaller.versionTooLow.message", "当前 Node.js 版本低于最低要求 (v22.16.0)。请升级到最新 LTS 版本后重试。"),
    },
    "version-too-high": {
      title: i18next.t("onboarding.nodeInstaller.versionTooHigh.title", "Node.js 版本过高"),
      message: i18next.t("onboarding.nodeInstaller.versionTooHigh.message", "当前 Node.js 版本高于推荐版本。部分功能可能不兼容，建议使用 LTS 版本。"),
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
