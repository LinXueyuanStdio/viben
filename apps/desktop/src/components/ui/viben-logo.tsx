import { cn } from "@/lib/utils";

interface VibenLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  showText?: boolean;
}

const sizeClasses = {
  sm: "h-6 w-6",
  md: "h-8 w-8",
  lg: "h-14 w-14",
  xl: "h-16 w-16",
};

const strokeWidths = {
  sm: 10,
  md: 9,
  lg: 8,
  xl: 7,
};

export function VibenLogo({ size = "md", className, showText = false }: VibenLogoProps) {
  const strokeWidth = strokeWidths[size];

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <svg
        viewBox="0 0 100 100"
        className={cn(sizeClasses[size], "flex-shrink-0")}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="viben-bg-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FDB813" />
            <stop offset="100%" stopColor="#38B2AC" />
          </linearGradient>
        </defs>
        {/* 圆角方形背景 */}
        <rect x="0" y="0" width="100" height="100" rx="22" fill="url(#viben-bg-grad)" />
        {/* < 左尖括号 */}
        <path
          d="M28 30 L15 50 L28 70"
          fill="none"
          stroke="#fff"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* V 中间字母 */}
        <path
          d="M38 32 L50 68 L62 32"
          fill="none"
          stroke="#fff"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* > 右尖括号 */}
        <path
          d="M72 30 L85 50 L72 70"
          fill="none"
          stroke="#fff"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {showText && (
        <span className="font-serif font-semibold tracking-tight">Viben</span>
      )}
    </div>
  );
}
