import * as React from "react";
import { ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Color presets for dashboard cards
export type DashboardCardColor =
  | "blue"
  | "purple"
  | "orange"
  | "emerald"
  | "cyan"
  | "rose"
  | "amber"
  | "indigo"
  | "teal"
  | "pink";

const colorConfig: Record<DashboardCardColor, {
  gradient: string;
  hoverGradient: string;
  iconBg: string;
  iconShadow: string;
  border: string;
  text: string;
}> = {
  blue: {
    gradient: "from-blue-500/10 via-blue-500/5 to-transparent",
    hoverGradient: "hover:from-blue-500/20 hover:via-blue-500/10",
    iconBg: "bg-blue-500",
    iconShadow: "shadow-blue-500/30",
    border: "border-blue-500/10",
    text: "text-blue-600 dark:text-blue-400",
  },
  purple: {
    gradient: "from-purple-500/10 via-purple-500/5 to-transparent",
    hoverGradient: "hover:from-purple-500/20 hover:via-purple-500/10",
    iconBg: "bg-purple-500",
    iconShadow: "shadow-purple-500/30",
    border: "border-purple-500/10",
    text: "text-purple-600 dark:text-purple-400",
  },
  orange: {
    gradient: "from-orange-500/10 via-orange-500/5 to-transparent",
    hoverGradient: "hover:from-orange-500/20 hover:via-orange-500/10",
    iconBg: "bg-orange-500",
    iconShadow: "shadow-orange-500/30",
    border: "border-orange-500/10",
    text: "text-orange-600 dark:text-orange-400",
  },
  emerald: {
    gradient: "from-emerald-500/10 via-emerald-500/5 to-transparent",
    hoverGradient: "hover:from-emerald-500/20 hover:via-emerald-500/10",
    iconBg: "bg-emerald-500",
    iconShadow: "shadow-emerald-500/30",
    border: "border-emerald-500/10",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  cyan: {
    gradient: "from-cyan-500/10 via-cyan-500/5 to-transparent",
    hoverGradient: "hover:from-cyan-500/20 hover:via-cyan-500/10",
    iconBg: "bg-cyan-500",
    iconShadow: "shadow-cyan-500/30",
    border: "border-cyan-500/10",
    text: "text-cyan-600 dark:text-cyan-400",
  },
  rose: {
    gradient: "from-rose-500/10 via-rose-500/5 to-transparent",
    hoverGradient: "hover:from-rose-500/20 hover:via-rose-500/10",
    iconBg: "bg-rose-500",
    iconShadow: "shadow-rose-500/30",
    border: "border-rose-500/10",
    text: "text-rose-600 dark:text-rose-400",
  },
  amber: {
    gradient: "from-amber-500/10 via-amber-500/5 to-transparent",
    hoverGradient: "hover:from-amber-500/20 hover:via-amber-500/10",
    iconBg: "bg-amber-500",
    iconShadow: "shadow-amber-500/30",
    border: "border-amber-500/10",
    text: "text-amber-600 dark:text-amber-400",
  },
  indigo: {
    gradient: "from-indigo-500/10 via-indigo-500/5 to-transparent",
    hoverGradient: "hover:from-indigo-500/20 hover:via-indigo-500/10",
    iconBg: "bg-indigo-500",
    iconShadow: "shadow-indigo-500/30",
    border: "border-indigo-500/10",
    text: "text-indigo-600 dark:text-indigo-400",
  },
  teal: {
    gradient: "from-teal-500/10 via-teal-500/5 to-transparent",
    hoverGradient: "hover:from-teal-500/20 hover:via-teal-500/10",
    iconBg: "bg-teal-500",
    iconShadow: "shadow-teal-500/30",
    border: "border-teal-500/10",
    text: "text-teal-600 dark:text-teal-400",
  },
  pink: {
    gradient: "from-pink-500/10 via-pink-500/5 to-transparent",
    hoverGradient: "hover:from-pink-500/20 hover:via-pink-500/10",
    iconBg: "bg-pink-500",
    iconShadow: "shadow-pink-500/30",
    border: "border-pink-500/10",
    text: "text-pink-600 dark:text-pink-400",
  },
};

export interface DashboardCardProps {
  /** Card color theme */
  color: DashboardCardColor;
  /** Icon component to display */
  icon: React.ElementType;
  /** Card title */
  title: string;
  /** Card description */
  description: string;
  /** Optional action label shown on hover (default: "打开") */
  actionLabel?: string;
  /** Footer content - can be a string or custom ReactNode */
  footer?: React.ReactNode;
  /** Footer icon component */
  footerIcon?: React.ElementType;
  /** Click handler */
  onClick?: () => void;
  /** Additional class names */
  className?: string;
  /** Whether the card is disabled */
  disabled?: boolean;
}

export function DashboardCard({
  color,
  icon: Icon,
  title,
  description,
  actionLabel = "打开",
  footer,
  footerIcon: FooterIcon,
  onClick,
  className,
  disabled = false,
}: DashboardCardProps) {
  const config = colorConfig[color];

  const cardContent = (
    <Card
      className={cn(
        "relative overflow-hidden border-0 bg-gradient-to-br transition-all duration-300 h-full",
        config.gradient,
        !disabled && config.hoverGradient,
        !disabled && "hover:shadow-lg cursor-pointer",
        disabled && "opacity-60 cursor-not-allowed",
        className
      )}
      style={{
        ["--tw-shadow-color" as string]: `var(--${color}-500)`,
      }}
    >
      {/* Background decorative circle */}
      <div
        className={cn(
          "absolute top-0 right-0 w-32 h-32 rounded-full -translate-y-1/2 translate-x-1/2 transition-transform duration-500",
          config.iconBg,
          "opacity-10",
          !disabled && "group-hover:scale-150"
        )}
      />

      <CardContent className="p-6 relative">
        {/* Header with icon and action */}
        <div className="flex items-start justify-between mb-4">
          <div
            className={cn(
              "h-14 w-14 rounded-2xl flex items-center justify-center shadow-lg transition-transform duration-300",
              config.iconBg,
              config.iconShadow,
              !disabled && "group-hover:scale-110"
            )}
          >
            <Icon className="h-7 w-7 text-white" />
          </div>
          {actionLabel && (
            <div
              className={cn(
                "flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity",
                config.text
              )}
            >
              <span className="text-xs font-medium">{actionLabel}</span>
              <ChevronRight className="h-4 w-4" />
            </div>
          )}
        </div>

        {/* Title and description */}
        <h3 className="font-semibold text-lg mb-1">{title}</h3>
        <p className="text-sm text-muted-foreground line-clamp-2">{description}</p>

        {/* Footer */}
        {(footer || FooterIcon) && (
          <div className={cn("mt-4 pt-4 border-t flex items-center gap-2", config.border)}>
            {FooterIcon && <FooterIcon className={cn("h-4 w-4", config.iconBg.replace("bg-", "text-"))} />}
            {typeof footer === "string" ? (
              <span className="text-xs text-muted-foreground">{footer}</span>
            ) : (
              footer
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (disabled) {
    return <div className="group h-full">{cardContent}</div>;
  }

  if (onClick) {
    return (
      <div className="group h-full cursor-pointer" onClick={onClick}>
        {cardContent}
      </div>
    );
  }

  return <div className="group h-full">{cardContent}</div>;
}

export { colorConfig as dashboardCardColors };
