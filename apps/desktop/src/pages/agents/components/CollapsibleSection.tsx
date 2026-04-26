import { useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface CollapsibleSectionProps {
  title: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function CollapsibleSection({
  title,
  icon,
  badge,
  action,
  defaultOpen = false,
  children,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button
          className={cn(
            "w-full flex items-center gap-2 py-2.5 px-1 text-sm hover:bg-muted/50 rounded-lg transition-colors",
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
          <span className="font-medium">{title}</span>
          {badge && <span className="ml-auto mr-2">{badge}</span>}
          {action && (
            <span className="ml-auto" onClick={(e) => e.stopPropagation()}>
              {action}
            </span>
          )}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-6 pr-1 pb-2">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
