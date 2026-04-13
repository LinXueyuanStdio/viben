/**
 * Loading screen with bouncing animation and rotating tips
 *
 * Qclaw reference: /Users/lxy/Documents/GitHub/others/Qclaw/src/components/LoadingScreen.tsx
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { UI_RUNTIME_DEFAULTS } from "@/lib/onboarding/runtime-policies";

// ============================================================================
// Loading Tips
// ============================================================================

const LOADING_TIPS = [
  "正在检查系统环境...",
  "Viben 支持 Claude Code、Cursor、Codex 等多种 AI 客户端",
  "所有配置和数据仅保存在您的电脑上",
  "Gateway 是 Viben 的本地后端服务",
  "安装过程可能需要网络连接",
  "请确保网络连接正常",
];

// ============================================================================
// Props
// ============================================================================

interface LoadingScreenProps {
  /** 当前进度 (0-100) */
  progress?: number;
  /** 状态文字 */
  status?: string;
  /** 是否显示进度条 */
  showProgress?: boolean;
  /** 是否显示旋转提示 */
  showTips?: boolean;
  /** 自定义提示列表 */
  tips?: string[];
  /** Logo 组件 */
  logo?: React.ReactNode;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function LoadingScreen({
  progress,
  status,
  showProgress = true,
  showTips = true,
  tips = LOADING_TIPS,
  logo,
  className,
}: LoadingScreenProps) {
  const [currentTipIndex, setCurrentTipIndex] = React.useState(0);

  // 旋转提示
  React.useEffect(() => {
    if (!showTips || tips.length === 0) return;

    const interval = setInterval(() => {
      setCurrentTipIndex((prev) => (prev + 1) % tips.length);
    }, UI_RUNTIME_DEFAULTS.envCheck.loadingTipRotateMs);

    return () => clearInterval(interval);
  }, [showTips, tips]);

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center min-h-[300px] space-y-8",
        className
      )}
    >
      {/* Logo with bounce animation */}
      <div className="animate-bounce-gentle">
        {logo ?? <DefaultLogo />}
      </div>

      {/* Status */}
      {status && (
        <p className="text-lg font-medium text-foreground">{status}</p>
      )}

      {/* Progress bar */}
      {showProgress && progress !== undefined && (
        <div className="w-full max-w-xs space-y-2">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-center text-muted-foreground">
            {Math.round(progress)}%
          </p>
        </div>
      )}

      {/* Rotating tips */}
      {showTips && tips.length > 0 && (
        <div className="h-6 overflow-hidden">
          <p
            key={currentTipIndex}
            className="text-sm text-muted-foreground text-center animate-fade-in"
          >
            {tips[currentTipIndex]}
          </p>
        </div>
      )}

      {/* CSS for animations */}
      <style>{`
        @keyframes bounce-gentle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        .animate-bounce-gentle {
          animation: bounce-gentle 2s ease-in-out infinite;
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}

// ============================================================================
// Default Logo
// ============================================================================

function DefaultLogo() {
  return (
    <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10">
      <span className="text-3xl">🚀</span>
    </div>
  );
}
