import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarSectionProps {
  title: string;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  collapsed?: boolean; // Sidebar collapsed state
  className?: string;
  headerAction?: React.ReactNode;
}

/**
 * Collapsible section for sidebar navigation.
 * When sidebar is collapsed, only shows icons without section headers.
 */
export function SidebarSection({
  title,
  children,
  collapsible = false,
  defaultOpen = true,
  collapsed = false,
  className,
  headerAction,
}: SidebarSectionProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  // When sidebar is collapsed, don't show section headers
  if (collapsed) {
    return <div className={cn("space-y-1", className)}>{children}</div>;
  }

  // Non-collapsible section
  if (!collapsible) {
    return (
      <div className={cn("space-y-1", className)}>
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {title}
          </span>
          {headerAction}
        </div>
        {children}
      </div>
    );
  }

  // Collapsible section
  return (
    <div className={cn("space-y-1", className)}>
      <div
        className={cn(
          "flex w-full items-center justify-between px-3 py-2",
          "text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        )}
      >
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "flex items-center gap-1",
            "hover:text-foreground transition-colors duration-200",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 rounded"
          )}
        >
          <span>{title}</span>
          <ChevronDown
            className={cn(
              "h-3 w-3 transition-transform duration-200",
              isOpen ? "rotate-0" : "-rotate-90"
            )}
          />
        </button>
        {headerAction && (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {headerAction}
          </div>
        )}
      </div>
      <div
        className={cn(
          "overflow-hidden transition-all duration-200",
          isOpen ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        {children}
      </div>
    </div>
  );
}
