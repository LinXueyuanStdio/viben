/**
 * SingleSelector
 *
 * 通用单级选择器组件
 */

import { Check, ChevronDown, Circle } from "lucide-react";
import { cn, Button, Popover, PopoverContent, PopoverTrigger } from "@viben/ui";
import type { SelectorOption, SingleSelectorProps } from "./types";

function OptionItem({
  option,
  isSelected,
  onClick,
}: {
  option: SelectorOption;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn("w-full justify-start gap-2 h-8", option.disabled && "opacity-50")}
      onClick={onClick}
      disabled={option.disabled}
    >
      {isSelected && <Check className="h-3.5 w-3.5 shrink-0" />}
      <span
        className={cn(
          "h-4 w-4 shrink-0 flex items-center justify-center",
          !isSelected && "ml-5"
        )}
      >
        {option.icon || <Circle className="h-3 w-3" />}
      </span>
      <span className="truncate flex-1 text-left">{option.label}</span>
    </Button>
  );
}

/** 按 badge 分组选项，无 badge 的放在最前面 */
function groupOptionsByBadge(options: SelectorOption[]): Map<string, SelectorOption[]> {
  const groups = new Map<string, SelectorOption[]>();
  const noBadgeKey = "";

  for (const option of options) {
    const key = option.badge || noBadgeKey;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(option);
  }

  const result = new Map<string, SelectorOption[]>();
  if (groups.has(noBadgeKey)) {
    result.set(noBadgeKey, groups.get(noBadgeKey)!);
    groups.delete(noBadgeKey);
  }
  for (const [key, value] of groups) {
    result.set(key, value);
  }

  return result;
}

function OptionList({
  options,
  selectedId,
  onSelect,
}: {
  options: SelectorOption[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const groups = groupOptionsByBadge(options);
  const hasMultipleGroups = groups.size > 1 || (groups.size === 1 && !groups.has(""));

  if (!hasMultipleGroups) {
    return (
      <>
        {options.map((option) => (
          <OptionItem
            key={option.id}
            option={option}
            isSelected={option.id === selectedId}
            onClick={() => onSelect(option.id)}
          />
        ))}
      </>
    );
  }

  return (
    <>
      {Array.from(groups.entries()).map(([badge, groupOptions], groupIndex) => (
        <div key={badge || "__no_badge__"}>
          {badge && (
            <div className={cn(
              "px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wide",
              groupIndex > 0 && "mt-1 border-t border-border/50 pt-1.5"
            )}>
              {badge}
            </div>
          )}
          {groupOptions.map((option) => (
            <OptionItem
              key={option.id}
              option={option}
              isSelected={option.id === selectedId}
              onClick={() => onSelect(option.id)}
            />
          ))}
        </div>
      ))}
    </>
  );
}

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
          <OptionList
            options={options}
            selectedId={value}
            onSelect={(id) => onChange?.(id)}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}
