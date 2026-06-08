/**
 * SingleSelector
 *
 * 通用单级选择器组件
 */

import { Check, ChevronDown, Circle } from "lucide-react";
import { cn, Badge, Button, Popover, PopoverContent, PopoverTrigger } from "@viben/ui";
import type { SingleSelectorProps } from "./types";

export function SingleSelector({
  options,
  value,
  onChange,
  label,
  placeholder = "Select...",
  icon,
  isLoading,
  disabled,
  className,
}: SingleSelectorProps) {
  const selected = options.find((o) => o.id === value);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn("h-8 max-w-[140px] shrink-0 px-2 gap-1.5 text-xs", className)}
          disabled={isLoading || disabled}
        >
          <span className="h-3.5 w-3.5 shrink-0 flex items-center justify-center">
            {selected?.icon || icon || <Circle className="h-3 w-3" />}
          </span>
          <span className="truncate">{selected?.label || placeholder}</span>
          <ChevronDown className="h-3 w-3 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1" align="start">
        {label && (
          <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground border-b border-border/50 mb-1">
            {label}
          </div>
        )}
        {options.length === 0 ? (
          <div className="px-2 py-3 text-sm text-muted-foreground text-center">No options</div>
        ) : (
          options.map((option) => (
            <Button
              key={option.id}
              variant="ghost"
              size="sm"
              className={cn("w-full justify-start gap-2 h-8", option.disabled && "opacity-50")}
              onClick={() => onChange?.(option.id)}
              disabled={option.disabled}
            >
              {option.id === value && <Check className="h-3.5 w-3.5 shrink-0" />}
              <span
                className={cn(
                  "h-4 w-4 shrink-0 flex items-center justify-center",
                  option.id !== value && "ml-5"
                )}
              >
                {option.icon || <Circle className="h-3 w-3" />}
              </span>
              <span className="truncate flex-1 text-left">{option.label}</span>
              {option.badge && (
                <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                  {option.badge}
                </Badge>
              )}
            </Button>
          ))
        )}
      </PopoverContent>
    </Popover>
  );
}
