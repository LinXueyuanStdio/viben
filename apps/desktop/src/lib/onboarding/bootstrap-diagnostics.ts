/**
 * Bootstrap failure view generation
 *
 * Qclaw 参考: /Users/lxy/Documents/GitHub/others/Qclaw/src/shared/gateway-bootstrap-diagnostics.ts
 */

import i18next from "i18next";
import type { GatewayRuntimeStateCode } from "./gateway-diagnostics";
import type { CliInstallerIssueKind } from "./installer-issues";

// ============================================================================
// Failure View Structure
// ============================================================================

export interface FailureView {
  /** 标题 - 简短描述问题 */
  title: string;
  /** 详情 - 技术解释 */
  detail: string;
  /** 提示 - 可操作的建议列表 */
  hints: string[];
  /** 严重程度 */
  severity: "warning" | "error" | "fatal";
  /** 是否可恢复 */
  recoverable: boolean;
}

// ============================================================================
// Factory Function
// ============================================================================

export function createView(
  title: string,
  detail: string,
  hints: string[],
  options: { severity?: FailureView["severity"]; recoverable?: boolean } = {}
): FailureView {
  return {
    title,
    detail,
    hints,
    severity: options.severity ?? "error",
    recoverable: options.recoverable ?? true,
  };
}

// ============================================================================
// Gateway State to Failure View
// ============================================================================

export function createGatewayFailureView(
  stateCode: GatewayRuntimeStateCode,
  context?: { port?: number; version?: string; error?: string }
): FailureView {
  switch (stateCode) {
    case "port_conflict_same":
      return createView(
        i18next.t("onboarding.diagnostics.portConflictSame.title", "检测到另一个 Gateway 实例"),
        i18next.t("onboarding.diagnostics.portConflictSame.detail", { defaultValue: "端口 {{port}} 已被另一个 Viben Gateway 占用。", port: context?.port ?? 18790 }),
        [
          i18next.t("onboarding.diagnostics.portConflictSame.hint1", '点击"重试"将尝试接管现有实例'),
          i18next.t("onboarding.diagnostics.portConflictSame.hint2", "或在设置中更改 Gateway 端口"),
        ],
        { severity: "warning" }
      );

    case "port_conflict_foreign":
      return createView(
        i18next.t("onboarding.diagnostics.portConflictForeign.title", "端口被其他程序占用"),
        i18next.t("onboarding.diagnostics.portConflictForeign.detail", { defaultValue: "端口 {{port}} 被其他程序占用，无法启动 Gateway。", port: context?.port ?? 18790 }),
        [
          i18next.t("onboarding.diagnostics.portConflictForeign.hint1", { defaultValue: "查找并关闭占用端口 {{port}} 的程序", port: context?.port ?? 18790 }),
          i18next.t("onboarding.diagnostics.portConflictForeign.hint2", "或在设置中更改 Gateway 端口"),
          i18next.t("onboarding.diagnostics.portConflictForeign.hint3", { defaultValue: "可以运行 'lsof -i :{{port}}' (macOS/Linux) 查看占用进程", port: context?.port ?? 18790 }),
        ],
        { severity: "error" }
      );

    case "token_mismatch":
    case "auth_missing":
      return createView(
        i18next.t("onboarding.diagnostics.authRefresh.title", "认证信息需要刷新"),
        i18next.t("onboarding.diagnostics.authRefresh.detail", "Gateway 的认证 Token 已过期或不匹配。"),
        [
          i18next.t("onboarding.diagnostics.authRefresh.hint1", '点击"重试"将重新加载认证信息'),
          i18next.t("onboarding.diagnostics.authRefresh.hint2", "如果问题持续，尝试重新启动 Gateway"),
        ],
        { severity: "warning" }
      );

    case "config_invalid":
      return createView(
        i18next.t("onboarding.diagnostics.configInvalid.title", "配置文件无效"),
        i18next.t("onboarding.diagnostics.configInvalid.detail", "Gateway 配置文件存在问题，无法启动服务。"),
        [
          i18next.t("onboarding.diagnostics.configInvalid.hint1", "检查 ~/.viben/config.yaml 配置文件"),
          i18next.t("onboarding.diagnostics.configInvalid.hint2", "尝试删除配置文件后重新设置"),
          i18next.t("onboarding.diagnostics.configInvalid.hint3", "查看日志获取详细错误信息"),
        ],
        { severity: "error", recoverable: false }
      );

    case "cli_not_found":
      return createView(
        i18next.t("onboarding.diagnostics.cliNotFound.title", "Viben CLI 未安装"),
        i18next.t("onboarding.diagnostics.cliNotFound.detail", "无法找到 Viben CLI，需要先安装才能启动 Gateway。"),
        [
          i18next.t("onboarding.diagnostics.cliNotFound.hint1", '点击"安装 Viben CLI"自动安装'),
          i18next.t("onboarding.diagnostics.cliNotFound.hint2", "或手动运行: npm install -g viben"),
          i18next.t("onboarding.diagnostics.cliNotFound.hint3", "访问 https://github.com/LinXueyuanStdio/viben 获取更多安装方式"),
        ],
        { severity: "fatal", recoverable: false }
      );

    case "version_mismatch":
      return createView(
        i18next.t("onboarding.diagnostics.versionMismatch.title", "版本不兼容"),
        i18next.t("onboarding.diagnostics.versionMismatch.detail", { defaultValue: "当前 Viben CLI 版本 {{version}} 与应用不兼容。", version: context?.version ?? i18next.t("common.unknown", "未知") }),
        [
          i18next.t("onboarding.diagnostics.versionMismatch.hint1", '点击"升级"将自动更新到兼容版本'),
          i18next.t("onboarding.diagnostics.versionMismatch.hint2", "或手动运行: npm update -g viben"),
        ],
        { severity: "warning" }
      );

    case "connection_refused":
      return createView(
        i18next.t("onboarding.diagnostics.connectionRefused.title", "无法连接到 Gateway"),
        i18next.t("onboarding.diagnostics.connectionRefused.detail", "Gateway 服务可能未正常启动或已崩溃。"),
        [
          i18next.t("onboarding.diagnostics.connectionRefused.hint1", '点击"重试"将尝试重新启动 Gateway'),
          i18next.t("onboarding.diagnostics.connectionRefused.hint2", "检查系统日志是否有错误信息"),
        ],
        { severity: "error" }
      );

    case "connection_timeout":
      return createView(
        i18next.t("onboarding.diagnostics.connectionTimeout.title", "连接超时"),
        i18next.t("onboarding.diagnostics.connectionTimeout.detail", "连接 Gateway 超时，服务响应过慢。"),
        [
          i18next.t("onboarding.diagnostics.connectionTimeout.hint1", "检查系统资源是否充足"),
          i18next.t("onboarding.diagnostics.connectionTimeout.hint2", '点击"重试"再次尝试连接'),
        ],
        { severity: "warning" }
      );

    case "network_blocked":
      return createView(
        i18next.t("onboarding.diagnostics.networkBlocked.title", "网络连接被阻断"),
        i18next.t("onboarding.diagnostics.networkBlocked.detail", "本地网络连接被防火墙或安全软件阻断。"),
        [
          i18next.t("onboarding.diagnostics.networkBlocked.hint1", "检查防火墙设置，允许 localhost 连接"),
          i18next.t("onboarding.diagnostics.networkBlocked.hint2", "如果使用 VPN 或代理，尝试暂时禁用"),
          i18next.t("onboarding.diagnostics.networkBlocked.hint3", "检查是否有安全软件阻止本地服务"),
        ],
        { severity: "error", recoverable: false }
      );

    case "service_stale":
      return createView(
        i18next.t("onboarding.diagnostics.serviceStale.title", "服务状态过期"),
        i18next.t("onboarding.diagnostics.serviceStale.detail", "Gateway 服务状态异常，需要重新启动。"),
        [
          i18next.t("onboarding.diagnostics.serviceStale.hint1", '点击"重试"将重新启动 Gateway'),
        ],
        { severity: "warning" }
      );

    case "unknown_error":
    default:
      return createView(
        i18next.t("onboarding.diagnostics.unknownError.title", "启动 Gateway 时出错"),
        context?.error ?? i18next.t("onboarding.diagnostics.unknownError.detailFallback", "发生了未知错误。"),
        [
          i18next.t("onboarding.diagnostics.unknownError.hint1", '点击"重试"再次尝试'),
          i18next.t("onboarding.diagnostics.unknownError.hint2", "查看应用日志获取详细信息"),
          i18next.t("onboarding.diagnostics.unknownError.hint3", "如果问题持续，请联系支持"),
        ],
        { severity: "error" }
      );
  }
}

// ============================================================================
// CLI Installer Issue to Failure View
// ============================================================================

export function createInstallerFailureView(
  issueKind: CliInstallerIssueKind,
  context?: { error?: string; version?: string }
): FailureView {
  switch (issueKind) {
    case "missing-cli":
      return createView(
        i18next.t("onboarding.diagnostics.missingCli.title", "需要安装 Viben CLI"),
        i18next.t("onboarding.diagnostics.missingCli.detail", "系统中未检测到 Viben CLI，需要安装后才能继续。"),
        [
          i18next.t("onboarding.diagnostics.missingCli.hint1", '点击"自动安装"将通过 npm 安装'),
          i18next.t("onboarding.diagnostics.missingCli.hint2", "或手动运行: npm install -g viben"),
        ],
        { severity: "warning" }
      );

    case "version-too-low":
      return createView(
        i18next.t("onboarding.diagnostics.versionTooLow.title", "Viben CLI 版本过低"),
        i18next.t("onboarding.diagnostics.versionTooLow.detail", { defaultValue: "当前版本 {{version}} 不满足最低要求。", version: context?.version ?? i18next.t("common.unknown", "未知") }),
        [
          i18next.t("onboarding.diagnostics.versionTooLow.hint1", '点击"升级"自动更新到最新版本'),
          i18next.t("onboarding.diagnostics.versionTooLow.hint2", "或手动运行: npm update -g viben"),
        ],
        { severity: "warning" }
      );

    case "version-too-high":
      return createView(
        i18next.t("onboarding.diagnostics.versionTooHigh.title", "Viben CLI 版本可能不兼容"),
        i18next.t("onboarding.diagnostics.versionTooHigh.detail", { defaultValue: "当前版本 {{version}} 高于测试版本，可能存在兼容性问题。", version: context?.version ?? i18next.t("common.unknown", "未知") }),
        [
          i18next.t("onboarding.diagnostics.versionTooHigh.hint1", "可以继续使用，但某些功能可能异常"),
          i18next.t("onboarding.diagnostics.versionTooHigh.hint2", "如遇问题，可降级到推荐版本"),
        ],
        { severity: "warning" }
      );

    case "missing-node":
      return createView(
        i18next.t("onboarding.diagnostics.missingNode.title", "需要安装 Node.js"),
        i18next.t("onboarding.diagnostics.missingNode.detail", "Viben CLI 需要 Node.js 运行环境，但系统中未检测到。"),
        [
          i18next.t("onboarding.diagnostics.missingNode.hint1", "访问 https://nodejs.org 下载安装 Node.js"),
          i18next.t("onboarding.diagnostics.missingNode.hint2", "推荐使用 Node.js 18 LTS 或更高版本"),
          i18next.t("onboarding.diagnostics.missingNode.hint3", "如果已安装，请确保 node 命令在 PATH 中"),
        ],
        { severity: "fatal", recoverable: false }
      );

    case "npm-registry-error":
      return createView(
        i18next.t("onboarding.diagnostics.npmRegistryError.title", "npm 仓库连接失败"),
        i18next.t("onboarding.diagnostics.npmRegistryError.detail", "无法连接到 npm 仓库，将尝试使用镜像源。"),
        [
          i18next.t("onboarding.diagnostics.npmRegistryError.hint1", "检查网络连接"),
          i18next.t("onboarding.diagnostics.npmRegistryError.hint2", '点击"重试"将使用备用镜像源'),
        ],
        { severity: "warning" }
      );

    case "download-failed":
      return createView(
        i18next.t("onboarding.diagnostics.downloadFailed.title", "下载失败"),
        context?.error ?? i18next.t("onboarding.diagnostics.downloadFailed.detailFallback", "下载过程中出错。"),
        [
          i18next.t("onboarding.diagnostics.downloadFailed.hint1", "检查网络连接后重试"),
          i18next.t("onboarding.diagnostics.downloadFailed.hint2", "如果问题持续，尝试手动安装"),
        ],
        { severity: "error" }
      );

    case "install-failed":
      return createView(
        i18next.t("onboarding.diagnostics.installFailed.title", "安装失败"),
        context?.error ?? i18next.t("onboarding.diagnostics.installFailed.detailFallback", "安装过程中出错。"),
        [
          i18next.t("onboarding.diagnostics.installFailed.hint1", "查看详细错误信息"),
          i18next.t("onboarding.diagnostics.installFailed.hint2", "尝试手动运行安装命令"),
          i18next.t("onboarding.diagnostics.installFailed.hint3", "检查是否有权限问题"),
        ],
        { severity: "error" }
      );

    case "permission-denied":
      return createView(
        i18next.t("onboarding.diagnostics.permissionDenied.title", "权限不足"),
        i18next.t("onboarding.diagnostics.permissionDenied.detail", "安装操作需要更高权限。"),
        [
          i18next.t("onboarding.diagnostics.permissionDenied.hint1", "macOS/Linux: 尝试使用 sudo 运行"),
          i18next.t("onboarding.diagnostics.permissionDenied.hint2", "Windows: 以管理员身份运行"),
          i18next.t("onboarding.diagnostics.permissionDenied.hint3", "或使用 nvm 安装 Node.js 避免权限问题"),
        ],
        { severity: "error" }
      );

    case "xcode-clt-pending":
      return createView(
        i18next.t("onboarding.diagnostics.xcodeCltPending.title", "等待 Xcode Command Line Tools 安装"),
        i18next.t("onboarding.diagnostics.xcodeCltPending.detail", "已触发 Xcode 命令行工具安装，请在系统弹窗中完成安装。"),
        [
          i18next.t("onboarding.diagnostics.xcodeCltPending.hint1", '在弹出的系统对话框中点击"安装"'),
          i18next.t("onboarding.diagnostics.xcodeCltPending.hint2", "如果没有弹窗，点击屏幕右上角的安装图标"),
          i18next.t("onboarding.diagnostics.xcodeCltPending.hint3", '安装完成后，点击"重试"继续'),
        ],
        { severity: "warning" }
      );

    case "user-cancelled":
      return createView(
        i18next.t("onboarding.diagnostics.userCancelled.title", "安装已取消"),
        i18next.t("onboarding.diagnostics.userCancelled.detail", "您取消了安装操作。"),
        [
          i18next.t("onboarding.diagnostics.userCancelled.hint1", '点击"重试"重新开始安装'),
          i18next.t("onboarding.diagnostics.userCancelled.hint2", '或点击"跳过"继续（部分功能可能不可用）'),
        ],
        { severity: "warning" }
      );

    case "network-error":
      return createView(
        i18next.t("onboarding.diagnostics.networkError.title", "网络连接失败"),
        i18next.t("onboarding.diagnostics.networkError.detail", "无法建立网络连接。"),
        [
          i18next.t("onboarding.diagnostics.networkError.hint1", "检查网络连接"),
          i18next.t("onboarding.diagnostics.networkError.hint2", "如果使用代理，请检查代理设置"),
          i18next.t("onboarding.diagnostics.networkError.hint3", '点击"重试"再次尝试'),
        ],
        { severity: "error" }
      );

    case "unknown-error":
    default:
      return createView(
        i18next.t("onboarding.diagnostics.installerUnknownError.title", "安装时出错"),
        context?.error ?? i18next.t("onboarding.diagnostics.installerUnknownError.detailFallback", "发生了未知错误。"),
        [
          i18next.t("onboarding.diagnostics.installerUnknownError.hint1", "查看详细错误信息"),
          i18next.t("onboarding.diagnostics.installerUnknownError.hint2", '点击"重试"再次尝试'),
          i18next.t("onboarding.diagnostics.installerUnknownError.hint3", "如果问题持续，请联系支持"),
        ],
        { severity: "error" }
      );
  }
}
