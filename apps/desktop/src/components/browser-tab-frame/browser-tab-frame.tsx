import { X } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { HTMLAttributes, MouseEvent, ReactNode } from "react";

export interface BrowserTabFrameProps {
  isMacOS?: boolean;
  reserveMacOSControlsSpace?: boolean;
  leadingControls?: ReactNode;
  tabsLeading?: ReactNode;
  tabs?: ReactNode;
  spacerMenu?: ReactNode;
  rightControls?: ReactNode;
  windowControls?: ReactNode;
  className?: string;
}

export function BrowserTabFrame({
  isMacOS = false,
  reserveMacOSControlsSpace = false,
  leadingControls,
  tabsLeading,
  tabs,
  spacerMenu,
  rightControls,
  windowControls,
  className,
}: BrowserTabFrameProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          "flex items-center border-b bg-muted/30",
          isMacOS ? "h-8" : "h-10",
          className,
        )}
      >
        <div
          data-browser-tab-frame-leading
          data-tauri-drag-region
          className={cn(
            "flex shrink-0 items-center gap-1 px-2",
            reserveMacOSControlsSpace && "pl-20",
          )}
        >
          {leadingControls}
        </div>

        {tabsLeading}

        {tabs && (
          <div className="flex items-center gap-1 overflow-x-auto px-1 scrollbar-none">
            {tabs}
          </div>
        )}

        <div
          data-browser-tab-frame-spacer
          data-tauri-drag-region
          className="min-w-4 flex-1 self-stretch"
        >
          {spacerMenu}
        </div>

        {rightControls && (
          <div className="flex shrink-0 items-center gap-1 px-1">
            {rightControls}
          </div>
        )}

        {windowControls && (
          <div className="flex shrink-0 items-center">{windowControls}</div>
        )}
      </div>
    </TooltipProvider>
  );
}

export interface BrowserTabFrameIconButtonProps {
  "aria-label": string;
  icon: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tooltip?: ReactNode;
  isMacOS?: boolean;
  className?: string;
}

export function BrowserTabFrameIconButton({
  "aria-label": ariaLabel,
  icon,
  onClick,
  disabled = false,
  tooltip,
  isMacOS = false,
  className,
}: BrowserTabFrameIconButtonProps) {
  const button = (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md",
        "text-muted-foreground transition-colors duration-150",
        "hover:bg-accent hover:text-accent-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:pointer-events-none disabled:opacity-45",
        isMacOS ? "h-6 w-6" : "h-7 w-7",
        className,
      )}
    >
      {icon}
    </button>
  );

  if (!tooltip) {
    return button;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

export interface BrowserTabFrameTabProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
  icon?: ReactNode;
  active?: boolean;
  closable?: boolean;
  onSelect?: () => void;
  onClose?: () => void;
}

export function BrowserTabFrameTab({
  label,
  icon,
  active = false,
  closable = false,
  onSelect,
  onClose,
  className,
  ...props
}: BrowserTabFrameTabProps) {
  const handleClose = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onClose?.();
  };

  return (
    <div
      {...props}
      className={cn(
        "group relative flex h-7 max-w-[180px] shrink-0 items-center gap-1.5",
        "rounded-md text-[13px] text-muted-foreground",
        "transition-colors duration-150",
        "hover:bg-accent hover:text-accent-foreground",
        active &&
          "bg-background text-foreground shadow-sm ring-1 ring-border/50",
        className,
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex h-full min-w-0 flex-1 items-center gap-1.5 rounded-md px-2",
          closable && "pr-0.5",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        {icon && <span className="shrink-0">{icon}</span>}
        <span className="min-w-0 truncate">{label}</span>
      </button>
      {closable && (
        <button
          type="button"
          aria-label={`Close ${label}`}
          onClick={handleClose}
          className={cn(
            "mr-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded",
            "text-muted-foreground/70 transition-colors",
            "hover:bg-muted hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          <X className="h-3 w-3" />
        </button>
      )}
      {active && (
        <span className="absolute bottom-0 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full bg-primary" />
      )}
    </div>
  );
}
