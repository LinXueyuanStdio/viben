/**
 * Bootstrap failure view generation
 *
 * Qclaw 参考: /Users/lxy/Documents/GitHub/others/Qclaw/src/shared/gateway-bootstrap-diagnostics.ts
 */

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
        "检测到另一个 Gateway 实例",
        `端口 ${context?.port ?? 18790} 已被另一个 Viben Gateway 占用。`,
        [
          '点击"重试"将尝试接管现有实例',
          "或在设置中更改 Gateway 端口",
        ],
        { severity: "warning" }
      );

    case "port_conflict_foreign":
      return createView(
        "端口被其他程序占用",
        `端口 ${context?.port ?? 18790} 被其他程序占用，无法启动 Gateway。`,
        [
          `查找并关闭占用端口 ${context?.port ?? 18790} 的程序`,
          "或在设置中更改 Gateway 端口",
          `可以运行 'lsof -i :${context?.port ?? 18790}' (macOS/Linux) 查看占用进程`,
        ],
        { severity: "error" }
      );

    case "token_mismatch":
    case "auth_missing":
      return createView(
        "认证信息需要刷新",
        "Gateway 的认证 Token 已过期或不匹配。",
        [
          '点击"重试"将重新加载认证信息',
          "如果问题持续，尝试重新启动 Gateway",
        ],
        { severity: "warning" }
      );

    case "config_invalid":
      return createView(
        "配置文件无效",
        "Gateway 配置文件存在问题，无法启动服务。",
        [
          "检查 ~/.viben/config.yaml 配置文件",
          "尝试删除配置文件后重新设置",
          "查看日志获取详细错误信息",
        ],
        { severity: "error", recoverable: false }
      );

    case "cli_not_found":
      return createView(
        "Viben CLI 未安装",
        "无法找到 Viben CLI，需要先安装才能启动 Gateway。",
        [
          '点击"安装 Viben CLI"自动安装',
          "或手动运行: npm install -g viben",
          "访问 https://github.com/LinXueyuanStdio/viben 获取更多安装方式",
        ],
        { severity: "fatal", recoverable: false }
      );

    case "version_mismatch":
      return createView(
        "版本不兼容",
        `当前 Viben CLI 版本 ${context?.version ?? "未知"} 与应用不兼容。`,
        [
          '点击"升级"将自动更新到兼容版本',
          "或手动运行: npm update -g viben",
        ],
        { severity: "warning" }
      );

    case "connection_refused":
      return createView(
        "无法连接到 Gateway",
        "Gateway 服务可能未正常启动或已崩溃。",
        [
          '点击"重试"将尝试重新启动 Gateway',
          "检查系统日志是否有错误信息",
        ],
        { severity: "error" }
      );

    case "connection_timeout":
      return createView(
        "连接超时",
        "连接 Gateway 超时，服务响应过慢。",
        [
          "检查系统资源是否充足",
          '点击"重试"再次尝试连接',
        ],
        { severity: "warning" }
      );

    case "network_blocked":
      return createView(
        "网络连接被阻断",
        "本地网络连接被防火墙或安全软件阻断。",
        [
          "检查防火墙设置，允许 localhost 连接",
          "如果使用 VPN 或代理，尝试暂时禁用",
          "检查是否有安全软件阻止本地服务",
        ],
        { severity: "error", recoverable: false }
      );

    case "service_stale":
      return createView(
        "服务状态过期",
        "Gateway 服务状态异常，需要重新启动。",
        [
          '点击"重试"将重新启动 Gateway',
        ],
        { severity: "warning" }
      );

    case "unknown_error":
    default:
      return createView(
        "启动 Gateway 时出错",
        context?.error ?? "发生了未知错误。",
        [
          '点击"重试"再次尝试',
          "查看应用日志获取详细信息",
          "如果问题持续，请联系支持",
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
        "需要安装 Viben CLI",
        "系统中未检测到 Viben CLI，需要安装后才能继续。",
        [
          '点击"自动安装"将通过 npm 安装',
          "或手动运行: npm install -g viben",
        ],
        { severity: "warning" }
      );

    case "version-too-low":
      return createView(
        "Viben CLI 版本过低",
        `当前版本 ${context?.version ?? "未知"} 不满足最低要求。`,
        [
          '点击"升级"自动更新到最新版本',
          "或手动运行: npm update -g viben",
        ],
        { severity: "warning" }
      );

    case "version-too-high":
      return createView(
        "Viben CLI 版本可能不兼容",
        `当前版本 ${context?.version ?? "未知"} 高于测试版本，可能存在兼容性问题。`,
        [
          "可以继续使用，但某些功能可能异常",
          "如遇问题，可降级到推荐版本",
        ],
        { severity: "warning" }
      );

    case "missing-node":
      return createView(
        "需要安装 Node.js",
        "Viben CLI 需要 Node.js 运行环境，但系统中未检测到。",
        [
          "访问 https://nodejs.org 下载安装 Node.js",
          "推荐使用 Node.js 18 LTS 或更高版本",
          "如果已安装，请确保 node 命令在 PATH 中",
        ],
        { severity: "fatal", recoverable: false }
      );

    case "npm-registry-error":
      return createView(
        "npm 仓库连接失败",
        "无法连接到 npm 仓库，将尝试使用镜像源。",
        [
          "检查网络连接",
          '点击"重试"将使用备用镜像源',
        ],
        { severity: "warning" }
      );

    case "download-failed":
      return createView(
        "下载失败",
        context?.error ?? "下载过程中出错。",
        [
          "检查网络连接后重试",
          "如果问题持续，尝试手动安装",
        ],
        { severity: "error" }
      );

    case "install-failed":
      return createView(
        "安装失败",
        context?.error ?? "安装过程中出错。",
        [
          "查看详细错误信息",
          "尝试手动运行安装命令",
          "检查是否有权限问题",
        ],
        { severity: "error" }
      );

    case "permission-denied":
      return createView(
        "权限不足",
        "安装操作需要更高权限。",
        [
          "macOS/Linux: 尝试使用 sudo 运行",
          "Windows: 以管理员身份运行",
          "或使用 nvm 安装 Node.js 避免权限问题",
        ],
        { severity: "error" }
      );

    case "xcode-clt-pending":
      return createView(
        "等待 Xcode Command Line Tools 安装",
        "已触发 Xcode 命令行工具安装，请在系统弹窗中完成安装。",
        [
          "在弹出的系统对话框中点击\"安装\"",
          "如果没有弹窗，点击屏幕右上角的安装图标",
          "安装完成后，点击\"重试\"继续",
        ],
        { severity: "warning" }
      );

    case "user-cancelled":
      return createView(
        "安装已取消",
        "您取消了安装操作。",
        [
          "点击\"重试\"重新开始安装",
          "或点击\"跳过\"继续（部分功能可能不可用）",
        ],
        { severity: "warning" }
      );

    case "network-error":
      return createView(
        "网络连接失败",
        "无法建立网络连接。",
        [
          "检查网络连接",
          "如果使用代理，请检查代理设置",
          "点击\"重试\"再次尝试",
        ],
        { severity: "error" }
      );

    case "unknown-error":
    default:
      return createView(
        "安装时出错",
        context?.error ?? "发生了未知错误。",
        [
          "查看详细错误信息",
          "点击\"重试\"再次尝试",
          "如果问题持续，请联系支持",
        ],
        { severity: "error" }
      );
  }
}
