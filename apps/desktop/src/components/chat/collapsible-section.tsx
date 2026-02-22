/**
 * Collapsible Section Component
 *
 * A reusable collapsible section with title, icon, badge, and content.
 * Used in detail panels for organizing content into expandable sections.
 */

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

// ============================================================================
// Types
// ============================================================================

export interface CollapsibleSectionProps {
  /** Section title */
  title: string;
  /** Optional icon to display before title */
  icon?: React.ReactNode;
  /** Optional badge to display after title */
  badge?: React.ReactNode;
  /** Optional action button to display on the right */
  action?: React.ReactNode;
  /** Section content */
  children: React.ReactNode;
  /** Whether section is open by default */
  defaultOpen?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function CollapsibleSection({
  title,
  icon,
  badge,
  action,
  children,
  defaultOpen = false,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border-b last:border-b-0">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex items-center justify-between w-full py-3 px-1 hover:bg-muted/50 rounded-lg transition-colors"
        >
          <div className="flex items-center gap-2">
            {icon && <span className="text-muted-foreground">{icon}</span>}
            <span className="text-sm font-medium">{title}</span>
            {badge}
          </div>
          <div className="flex items-center gap-1">
            {action && (
              <span onClick={(e) => e.stopPropagation()}>{action}</span>
            )}
            {isOpen ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-1 pb-3">{children}</CollapsibleContent>
    </Collapsible>
  );
}
