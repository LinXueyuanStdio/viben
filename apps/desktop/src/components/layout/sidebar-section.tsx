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

  // When sidebar is collapsed, don't show section headers, just pass through children
  // The children (nav) will handle their own centering
  if (collapsed) {
    return <>{children}</>;
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
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex w-full items-center gap-1 px-3 py-1.5",
          "text-[11px] font-medium text-muted-foreground/70",
          "hover:text-muted-foreground transition-colors duration-200",
          "focus:outline-none"
        )}
      >
        <span>{title}</span>
        <ChevronDown
          className={cn(
            "h-3 w-3 transition-transform duration-200",
            isOpen ? "rotate-0" : "-rotate-90"
          )}
        />
        {headerAction && (
          <div className="ml-auto flex items-center" onClick={(e) => e.stopPropagation()}>
            {headerAction}
          </div>
        )}
      </button>
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
