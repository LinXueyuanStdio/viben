import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ContextUsageIndicatorProps {
  used: number;
  total: number;
  className?: string;
}

/**
 * SVG donut ring showing context window usage percentage.
 * Color thresholds: < 70% primary, >= 70% warning (amber), >= 90% danger (red)
 */
export function ContextUsageIndicator({
  used,
  total,
  className,
}: ContextUsageIndicatorProps) {
  const percentage = useMemo(
    () => Math.min(100, Math.round((used / total) * 100)),
    [used, total]
  );

  const color = useMemo(() => {
    if (percentage >= 90) return "var(--destructive)";
    if (percentage >= 70) return "oklch(0.75 0.15 85)"; // amber/warning
    return "var(--primary)";
  }, [percentage]);

  // SVG donut parameters
  const size = 24;
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  const formatTokens = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(0)}k`;
    return String(n);
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn("inline-flex items-center cursor-default", className)}>
            <svg
              width={size}
              height={size}
              viewBox={`0 0 ${size} ${size}`}
              className="rotate-[-90deg]"
            >
              {/* Background ring */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth={strokeWidth}
                className="text-muted-foreground/20"
              />
              {/* Progress ring */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
              />
            </svg>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <span className="tabular-nums">{percentage}%</span>
          {" · "}
          <span className="tabular-nums">{formatTokens(used)}</span>
          {" / "}
          <span className="tabular-nums">{formatTokens(total)}</span>
          {" context used"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
