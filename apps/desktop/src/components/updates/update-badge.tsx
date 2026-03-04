import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { ArrowUpCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ============================================================================
// Variants
// ============================================================================

const updateBadgeVariants = cva(
  [
    "inline-flex items-center justify-center gap-1",
    "rounded-full text-xs font-semibold",
    "transition-all duration-200",
    "cursor-pointer",
  ],
  {
    variants: {
      variant: {
        default: [
          "bg-primary/10 text-primary",
          "hover:bg-primary/20",
        ],
        pill: [
          "bg-amber-500/10 text-amber-600 dark:text-amber-400",
          "hover:bg-amber-500/20",
          "border border-amber-500/20",
        ],
        dot: [
          "bg-amber-500 text-white",
          "shadow-lg shadow-amber-500/30",
        ],
      },
      size: {
        sm: "h-5 min-w-5 px-1.5 text-[10px]",
        default: "h-6 min-w-6 px-2 text-xs",
        lg: "h-7 min-w-7 px-2.5 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

// ============================================================================
// Types
// ============================================================================

export interface UpdateBadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof updateBadgeVariants> {
  /** Number of available updates */
  count: number;
  /** Show icon with the count */
  showIcon?: boolean;
  /** Tooltip text (defaults to "X updates available") */
  tooltipText?: string;
  /** Hide badge when count is 0 */
  hideWhenZero?: boolean;
  /** Show as a simple dot indicator instead of count */
  showAsDot?: boolean;
  /** Pulse animation when updates available */
  pulse?: boolean;
}

// ============================================================================
// Component
// ============================================================================

/**
 * UpdateBadge - Shows the number of available package updates
 *
 * Displays a badge with the update count that can be clicked to view details.
 * Supports different variants for different UI contexts.
 */
const UpdateBadge = React.forwardRef<HTMLDivElement, UpdateBadgeProps>(
  (
    {
      className,
      variant,
      size,
      count,
      showIcon = false,
      tooltipText,
      hideWhenZero = true,
      showAsDot = false,
      pulse = false,
      onClick,
      ...props
    },
    ref
  ) => {
    const { t } = useTranslation();

    // Don't render if count is 0 and hideWhenZero is true
    if (count === 0 && hideWhenZero) {
      return null;
    }

    const defaultTooltip = t("updates.available", { count });

    const badgeContent = (
      <div
        ref={ref}
        className={cn(
          updateBadgeVariants({
            variant: showAsDot ? "dot" : variant,
            size: showAsDot ? "sm" : size,
            className,
          }),
          pulse && count > 0 && "animate-pulse"
        )}
        onClick={onClick}
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={
          onClick
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onClick(e as unknown as React.MouseEvent<HTMLDivElement>);
                }
              }
            : undefined
        }
        {...props}
      >
        {showIcon && !showAsDot && (
          <ArrowUpCircle className="h-3 w-3" />
        )}
        {showAsDot ? null : count}
      </div>
    );

    // Wrap with tooltip if there's content to show
    if (count > 0 || !hideWhenZero) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>{badgeContent}</TooltipTrigger>
            <TooltipContent>
              <p>{tooltipText || defaultTooltip}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return badgeContent;
  }
);
UpdateBadge.displayName = "UpdateBadge";

// ============================================================================
// Compound Components
// ============================================================================

/**
 * UpdateIndicator - A simple dot indicator for updates
 *
 * Shows as a small colored dot when updates are available.
 * Useful for nav items or icons.
 */
interface UpdateIndicatorProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Whether updates are available */
  hasUpdates: boolean;
  /** Position relative to parent */
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
}

const UpdateIndicator = React.forwardRef<HTMLSpanElement, UpdateIndicatorProps>(
  ({ className, hasUpdates, position = "top-right", ...props }, ref) => {
    if (!hasUpdates) return null;

    const positionClasses = {
      "top-right": "-top-1 -right-1",
      "top-left": "-top-1 -left-1",
      "bottom-right": "-bottom-1 -right-1",
      "bottom-left": "-bottom-1 -left-1",
    };

    return (
      <span
        ref={ref}
        className={cn(
          "absolute h-2 w-2 rounded-full",
          "bg-amber-500 shadow-lg shadow-amber-500/50",
          "animate-pulse",
          positionClasses[position],
          className
        )}
        {...props}
      />
    );
  }
);
UpdateIndicator.displayName = "UpdateIndicator";

export { UpdateBadge, UpdateIndicator, updateBadgeVariants };
