import { Toaster as Sonner, type ToasterProps } from "sonner";
import { useTheme } from "@/hooks";

// ============================================================================
// Types
// ============================================================================

export type ToastPosition =
  | "top-right"
  | "top-left"
  | "bottom-right"
  | "bottom-left"
  | "top-center"
  | "bottom-center";

export interface CustomToasterProps extends Omit<ToasterProps, "theme"> {
  /**
   * Position of the toasts on screen
   * @default "bottom-right"
   */
  position?: ToastPosition;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Toaster - Global toast container component
 *
 * Uses sonner library with custom styling to match the Viben design system.
 * Features warm amber theme colors and smooth animations.
 *
 * @example
 * // In your root component (main.tsx or App.tsx):
 * import { Toaster } from "@/components/ui/toaster";
 *
 * function App() {
 *   return (
 *     <>
 *       <YourApp />
 *       <Toaster />
 *     </>
 *   );
 * }
 */
export function Toaster({ position = "bottom-right", ...props }: CustomToasterProps) {
  const { theme } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position={position}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:rounded-xl",
          title: "group-[.toast]:text-foreground group-[.toast]:font-medium",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-md group-[.toast]:px-3 group-[.toast]:py-1.5 group-[.toast]:text-sm group-[.toast]:font-medium group-[.toast]:transition-colors group-[.toast]:hover:bg-primary-hover",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:rounded-md group-[.toast]:px-3 group-[.toast]:py-1.5 group-[.toast]:text-sm group-[.toast]:font-medium",
          closeButton:
            "group-[.toast]:text-foreground/50 group-[.toast]:hover:text-foreground group-[.toast]:transition-colors",
          // Type-specific styles
          success:
            "group-[.toaster]:border-l-4 group-[.toaster]:border-l-[var(--color-success)]",
          error:
            "group-[.toaster]:border-l-4 group-[.toaster]:border-l-[var(--color-error)]",
          warning:
            "group-[.toaster]:border-l-4 group-[.toaster]:border-l-[var(--color-warning)]",
          info:
            "group-[.toaster]:border-l-4 group-[.toaster]:border-l-[var(--color-info)]",
          loading:
            "group-[.toaster]:border-l-4 group-[.toaster]:border-l-primary",
        },
      }}
      // Limit visible toasts to 3 for better UX
      visibleToasts={3}
      // Close button for manual dismissal
      closeButton
      // Rich colors for type indicators
      richColors
      // Custom gap between toasts
      gap={8}
      // Animation duration matching design system
      duration={4000}
      {...props}
    />
  );
}

export { Toaster as default };
