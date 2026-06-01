import { useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

/**
 * Props for the CollapsibleSection component
 */
export interface CollapsibleSectionProps {
  /** Section title */
  title: string;
  /** Optional icon to display before title */
  icon?: React.ReactNode;
  /** Optional badge to display after title */
  badge?: React.ReactNode;
  /** Optional action button to display on the right */
  action?: React.ReactNode;
  /** Whether section is open by default */
  defaultOpen?: boolean;
  /** Section content */
  children: React.ReactNode;
  /** Additional CSS class names for the container */
  className?: string;
  /** Whether to show border at the bottom (default: true) */
  bordered?: boolean;
}

/**
 * A reusable collapsible section with title, icon, badge, and content.
 * Used in detail panels for organizing content into expandable sections.
 *
 * @example
 * ```tsx
 * <CollapsibleSection
 *   title="Settings"
 *   icon={<Settings className="h-4 w-4" />}
 *   badge={<Badge>3</Badge>}
 *   defaultOpen
 * >
 *   <SettingsContent />
 * </CollapsibleSection>
 * ```
 */
export function CollapsibleSection({
  title,
  icon,
  badge,
  action,
  defaultOpen = false,
  children,
  className,
  bordered = true,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className={cn(bordered && "border-b last:border-b-0", className)}
    >
      {/* Header row with trigger and action separated to avoid nested buttons */}
      <div className="flex items-center justify-between w-full py-3 px-1 hover:bg-muted/50 rounded-lg transition-colors">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex items-center gap-2 flex-1 text-left",
              isOpen && "text-foreground",
              !isOpen && "text-muted-foreground"
            )}
          >
            {isOpen ? (
              <ChevronDown className="h-4 w-4 shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0" />
            )}
            {icon && <span className="shrink-0">{icon}</span>}
            <span className="text-sm font-medium">{title}</span>
            {badge && <span className="ml-auto mr-2">{badge}</span>}
          </button>
        </CollapsibleTrigger>
        {action && (
          <div
            className="flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            {action}
          </div>
        )}
      </div>
      <CollapsibleContent className="pl-6 pr-1 pb-3">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

export default CollapsibleSection;
