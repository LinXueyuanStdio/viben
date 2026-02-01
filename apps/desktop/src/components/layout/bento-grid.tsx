import * as React from "react";
import { cn } from "@/lib/utils";

/* -----------------------------------------------------------------------------
 * Bento Grid Container
 * -------------------------------------------------------------------------- */

type BentoGridGap = "sm" | "md" | "lg" | "xl";

interface BentoGridProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Gap between grid items
   * @default "lg"
   */
  gap?: BentoGridGap;
}

const gapClasses: Record<BentoGridGap, string> = {
  sm: "gap-4", // 16px
  md: "gap-5", // 20px
  lg: "gap-6", // 24px
  xl: "gap-8", // 32px
};

const BentoGrid = React.forwardRef<HTMLDivElement, BentoGridProps>(
  ({ className, gap = "lg", children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("bento-grid", gapClasses[gap], className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);
BentoGrid.displayName = "BentoGrid";

/* -----------------------------------------------------------------------------
 * Bento Card
 * -------------------------------------------------------------------------- */

type BentoCardSize = "small" | "medium" | "large" | "full";
type BentoCardHeight = "auto" | "short" | "tall" | "hero";

interface BentoCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Width size of the card (column span)
   * - small: 4 columns (1/3 width)
   * - medium: 6 columns (1/2 width)
   * - large: 8 columns (2/3 width)
   * - full: 12 columns (full width)
   * @default "medium"
   */
  size?: BentoCardSize;
  /**
   * Height of the card
   * - auto: content-based height
   * - short: min-height 200px
   * - tall: min-height 400px
   * - hero: min-height 600px
   * @default "auto"
   */
  height?: BentoCardHeight;
  /**
   * Apply card styling (border, background, padding)
   * @default true
   */
  asCard?: boolean;
}

const sizeClasses: Record<BentoCardSize, string> = {
  small: "bento-card-small",
  medium: "bento-card-medium",
  large: "bento-card-large",
  full: "bento-card-full",
};

const heightClasses: Record<BentoCardHeight, string> = {
  auto: "",
  short: "bento-card-short",
  tall: "bento-card-tall",
  hero: "bento-card-hero",
};

const BentoCard = React.forwardRef<HTMLDivElement, BentoCardProps>(
  (
    { className, size = "medium", height = "auto", asCard = true, children, ...props },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          sizeClasses[size],
          heightClasses[height],
          asCard && "rounded-lg border bg-card p-6",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
BentoCard.displayName = "BentoCard";

export { BentoGrid, BentoCard };
export type { BentoGridProps, BentoCardProps, BentoCardSize, BentoCardHeight, BentoGridGap };
