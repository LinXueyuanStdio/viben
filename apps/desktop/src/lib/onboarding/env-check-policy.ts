/**
 * Environment check policy configuration
 *
 * Qclaw 参考: /Users/lxy/Documents/GitHub/others/Qclaw/src/shared/env-check-policy.ts
 */

import type { NodeInstallerIssueKind } from "./node-installer-issues";

// ============================================================================
// Types
// ============================================================================

export interface EnvCheckSupportAction {
  kind: "external-link";
  label: string;
  href: string;
}

// ============================================================================
// Constants
// ============================================================================

const NODE_DOWNLOAD_ACTION: EnvCheckSupportAction = Object.freeze({
  kind: "external-link",
  label: "打开 Node 官网",
  href: "https://nodejs.org/",
});

const VIBEN_ISSUES_ACTION: EnvCheckSupportAction = Object.freeze({
  kind: "external-link",
  label: "报告问题",
  href: "https://github.com/LinXueyuanStdio/viben/issues",
});

/**
 * 需要显示手动下载 Node.js 链接的问题类型
 */
const NODE_MANUAL_DOWNLOAD_ISSUE_KINDS = new Set<NodeInstallerIssueKind>([
  "blocked-by-policy",
  "corrupted-installer",
  "download-failed",
  "installer-failed",
  "missing-system-command",
  "unsupported-macos",
]);

/**
 * 环境检查 UI 策略
 */
export const ENV_CHECK_UI_POLICY = Object.freeze({
  /** 加载提示文案 */
  loadingTips: Object.freeze([
    "正在检查系统环境...",
    "Viben 支持 Claude Code、Codex 等多种智能体执行器",
    "所有配置和数据仅保存在您的电脑上",
    "安装和配置速度会受到网络和电脑性能影响",
    "安装、配置过程可能会输入电脑密码",
    "请确保网络连接正常",
  ]),
  /** Node.js 下载链接 */
  nodeDownloadAction: NODE_DOWNLOAD_ACTION,
  /** 报告问题链接 */
  issuesAction: VIBEN_ISSUES_ACTION,
});

/**
 * 环境检查步骤提示
 */
export const ENV_CHECK_STEP_TOOLTIPS: Record<string, string> = {
  node: "Node.js 是运行 Viben CLI 所需的 JavaScript 运行时环境",
  viben: "Viben CLI 是核心命令行工具，提供 Gateway 服务和 AI 交互功能",
  gateway: "Gateway 是 Viben 的本地后端服务，负责与智能体执行器通信",
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 根据问题类型获取支持操作
 */
export function getEnvCheckSupportActionsForIssueKind(
  issueKind?: NodeInstallerIssueKind | string | null
): EnvCheckSupportAction[] {
  if (!issueKind || !NODE_MANUAL_DOWNLOAD_ISSUE_KINDS.has(issueKind as NodeInstallerIssueKind)) {
    return [];
  }

  return [ENV_CHECK_UI_POLICY.nodeDownloadAction];
}

/**
 * 判断是否应该内联显示启动问题
 * Xcode CLT 等待安装时应内联显示而非弹窗
 */
export function shouldRenderStartupIssueInline(
  issue: { kind: NodeInstallerIssueKind } | null | undefined
): boolean {
  return issue?.kind === "xcode-clt-pending";
}
