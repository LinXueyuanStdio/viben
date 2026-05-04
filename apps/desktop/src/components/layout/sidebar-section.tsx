import type { ReactNode } from "react";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarSectionProps {
  title: string;
  children: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  collapsed?: boolean; // Sidebar collapsed state
  className?: string;
  headerAction?: ReactNode;
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
  const [isOpen, setIsOpen] = useState(defaultOpen);

  // When sidebar is collapsed, don't show section headers, just pass through children
  // The children (nav) will handle their own centering
  if (collapsed) {
    return <>{children}</>;
  }

  // Non-collapsible section
  if (!collapsible) {
    return (
      <div className={cn("space-y-1", className)}>
        <div className="flex h-7 items-center justify-between px-2">
          <span className="text-[11px] font-medium text-muted-foreground/70">
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
          "group flex h-7 w-full items-center gap-1 px-2",
          "rounded-md cursor-pointer",
          "hover:bg-accent/50 transition-colors duration-200"
        )}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
      >
        <div
          className={cn(
            "flex items-center gap-1",
            "text-[11px] font-medium text-muted-foreground/70",
            "group-hover:text-muted-foreground transition-colors duration-200"
          )}
        >
          <span>{title}</span>
          <ChevronDown
            className={cn(
              "h-3 w-3 transition-transform duration-200",
              isOpen ? "rotate-0" : "-rotate-90"
            )}
          />
        </div>
        {headerAction && (
          <div
            className="ml-auto flex items-center"
            onClick={(e) => e.stopPropagation()}
          >
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
