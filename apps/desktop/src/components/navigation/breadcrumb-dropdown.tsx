import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { IconDisplay } from "@/components/ui/icon-picker";
import { cn } from "@/lib/utils";
import type { BreadcrumbDropdownItem } from "@/navigation/page-index";

interface BreadcrumbDropdownProps {
  items: BreadcrumbDropdownItem[];
  children: ReactNode;
  onSelect?: (item: BreadcrumbDropdownItem) => void;
  align?: "start" | "center" | "end";
  className?: string;
}

export function BreadcrumbDropdown({
  items,
  children,
  onSelect,
  align = "start",
  className,
}: BreadcrumbDropdownProps) {
  const [open, setOpen] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  if (items.length === 0) {
    return <>{children}</>;
  }

  const clearCloseTimer = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const handleOpen = () => {
    clearCloseTimer();
    setOpen(true);
  };

  const handleCloseSoon = () => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false);
      closeTimerRef.current = null;
    }, 120);
  };

  const handleSelect = (item: BreadcrumbDropdownItem) => {
    item.onSelect?.();
    onSelect?.(item);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <span
          className={cn("inline-flex", className)}
          onMouseEnter={handleOpen}
          onMouseLeave={handleCloseSoon}
        >
          {children}
        </span>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        side="bottom"
        sideOffset={6}
        className="w-72 p-1.5"
        onMouseEnter={handleOpen}
        onMouseLeave={handleCloseSoon}
      >
        <div className="max-h-80 overflow-y-auto">
          {items.map((item) => (
            <Button
              key={item.id}
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                "h-auto w-full items-start justify-start gap-3 rounded-lg px-2.5 py-2 text-left text-sm hover:translate-y-0",
                "bg-transparent focus-visible:bg-accent/40 data-[state=open]:bg-transparent",
                item.isActive && "bg-accent text-accent-foreground hover:bg-accent"
              )}
              onClick={() => handleSelect(item)}
            >
              <IconDisplay
                icon={item.icon}
                size="sm"
                className="mt-0.5 text-muted-foreground"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {item.label}
                </span>
                {item.description ? (
                  <span className="block truncate text-xs text-muted-foreground">
                    {item.description}
                  </span>
                ) : null}
              </span>
              {item.isActive ? (
                <Check className="mt-0.5 h-4 w-4 text-primary" />
              ) : null}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
