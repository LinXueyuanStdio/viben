import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium",
    "transition-all duration-200",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        default: [
          "bg-primary text-primary-foreground shadow-md",
          "hover:bg-primary/90",
          // Use rgba for Android WebView (Chrome 86) compatibility - oklch requires Chrome 111+
          "hover:shadow-[0_8px_16px_-4px_rgba(210,159,48,0.3)]",
          "active:translate-y-0 active:shadow-sm",
        ],
        destructive: [
          "bg-destructive text-destructive-foreground shadow-sm",
          "hover:bg-destructive/90",
          // Use rgba for Android WebView (Chrome 86) compatibility - oklch requires Chrome 111+
          "hover:shadow-[0_8px_16px_-4px_rgba(189,63,63,0.3)]",
          "active:translate-y-0 active:shadow-sm",
        ],
        outline: [
          // Use explicit HEX color for Android WebView (Chrome 86) - CSS variable resolution can fail
          "border-2 border-[#d97706] bg-transparent text-[#d97706]",
          "dark:border-[#f59e0b] dark:text-[#f59e0b]",
          "hover:bg-primary/10",
          "active:translate-y-0",
        ],
        secondary: [
          "bg-secondary text-secondary-foreground shadow-sm",
          "hover:bg-secondary/80",
          "active:translate-y-0 active:shadow-sm",
        ],
        ghost: [
          "hover:bg-accent hover:text-accent-foreground",
          "active:translate-y-0",
        ],
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, style, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    // For outline variant, add inline style fallback for Android WebView (Chrome 86)
    // CSS class-based colors may not resolve correctly on older browsers
    const outlineStyleFallback = variant === "outline"
      ? { borderColor: '#d97706', color: '#d97706' }
      : undefined;
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        style={{ ...outlineStyleFallback, ...style }}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
