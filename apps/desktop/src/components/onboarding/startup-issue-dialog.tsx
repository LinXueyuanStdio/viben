/**
 * Startup issue dialog for system-level problems
 *
 * Qclaw 参考: /Users/lxy/Documents/GitHub/others/Qclaw/src/pages/EnvCheck.tsx (StartupIssueDialog)
 */

import { AlertTriangle, RefreshCw, ExternalLink, Terminal } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { CliInstallerIssueKind } from "@/lib/onboarding/installer-issues";

// ============================================================================
// Props
// ============================================================================

interface StartupIssueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issueKind: CliInstallerIssueKind;
  onRetry: () => void;
  isRetrying?: boolean;
}

// ============================================================================
// Issue Content
// ============================================================================

interface IssueContent {
  title: string;
  description: string;
  steps: string[];
  showTerminalHint?: boolean;
  externalLink?: { url: string; label: string };
}

function getIssueContent(kind: CliInstallerIssueKind): IssueContent {
  switch (kind) {
    case "xcode-clt-pending":
      return {
        title: "等待 Xcode Command Line Tools 安装",
        description:
          "已触发 Xcode 命令行工具安装。这是 macOS 开发所需的基础工具。",
        steps: [
          "在弹出的系统对话框中点击「安装」",
          "等待安装完成（可能需要几分钟）",
          "如果没有看到弹窗，请点击屏幕右上角的安装图标",
          "安装完成后，点击下方「重试检测」按钮",
        ],
        showTerminalHint: true,
      };

    case "missing-node":
      return {
        title: "需要安装 Node.js",
        description: "Viben CLI 需要 Node.js 运行环境才能工作。",
        steps: [
          "访问 nodejs.org 下载 Node.js",
          "推荐下载 LTS (长期支持) 版本",
          "运行安装程序并完成安装",
          "安装完成后，点击下方「重试检测」按钮",
        ],
        externalLink: {
          url: "https://nodejs.org/",
          label: "下载 Node.js",
        },
      };

    case "permission-denied":
      return {
        title: "权限不足",
        description: "安装操作需要更高的系统权限。",
        steps: [
          "macOS/Linux: 尝试在终端中使用 sudo 运行命令",
          "Windows: 右键点击终端，选择「以管理员身份运行」",
          "或者使用 nvm 管理 Node.js 以避免权限问题",
        ],
        showTerminalHint: true,
        externalLink: {
          url: "https://github.com/nvm-sh/nvm",
          label: "了解 nvm",
        },
      };

    case "network-error":
    case "npm-registry-error":
      return {
        title: "网络连接问题",
        description: "无法连接到 npm 仓库，可能是网络问题。",
        steps: [
          "检查网络连接是否正常",
          "如果使用代理，请检查代理设置",
          "尝试切换网络环境",
          "稍后重试",
        ],
      };

    default:
      return {
        title: "遇到问题",
        description: "安装过程中遇到了问题。",
        steps: [
          "查看详细错误信息",
          "尝试手动安装",
          "如果问题持续，请联系支持",
        ],
        externalLink: {
          url: "https://github.com/LinXueyuanStdio/viben/issues",
          label: "报告问题",
        },
      };
  }
}

// ============================================================================
// Component
// ============================================================================

export function StartupIssueDialog({
  open,
  onOpenChange,
  issueKind,
  onRetry,
  isRetrying,
}: StartupIssueDialogProps) {
  const content = getIssueContent(issueKind);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-500/10">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
            </div>
            <DialogTitle>{content.title}</DialogTitle>
          </div>
          <DialogDescription className="pt-2">
            {content.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Steps */}
          <div className="space-y-2">
            <p className="text-sm font-medium">操作步骤：</p>
            <ol className="list-decimal list-inside space-y-1.5 text-sm text-muted-foreground">
              {content.steps.map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ol>
          </div>

          {/* Terminal hint */}
          {content.showTerminalHint && (
            <div className="flex items-center gap-2 rounded-md bg-muted/50 p-3 text-sm">
              <Terminal className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                也可以在终端中运行{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                  xcode-select --install
                </code>
              </span>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {content.externalLink && (
            <Button variant="outline" asChild>
              <a
                href={content.externalLink.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                {content.externalLink.label}
              </a>
            </Button>
          )}
          <Button onClick={onRetry} disabled={isRetrying}>
            <RefreshCw
              className={`mr-2 h-4 w-4 ${isRetrying ? "animate-spin" : ""}`}
            />
            {isRetrying ? "检测中..." : "重试检测"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
