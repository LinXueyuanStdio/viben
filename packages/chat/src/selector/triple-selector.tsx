/**
 * TripleSelector
 *
 * 三联级联选择器：第一级 -> 第二级 -> 第三级
 * 典型用例：Agent Type -> Provider -> Model
 */

import { useState } from "react";
import { Check, ChevronDown, ChevronRight, Circle } from "lucide-react";
import { cn, Badge, Button, Popover, PopoverContent, PopoverTrigger } from "@viben/ui";
import type { SelectorOption, TripleSelectorProps } from "./types";

function OptionItem({
  option,
  isSelected,
  onClick,
  showArrow,
}: {
  option: SelectorOption;
  isSelected: boolean;
  onClick: () => void;
  showArrow?: boolean;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        "w-full justify-start gap-2 h-9",
        option.disabled && "opacity-50",
        isSelected && "bg-primary/10"
      )}
      onClick={onClick}
      disabled={option.disabled}
    >
      {isSelected ? (
        <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
      ) : (
        <span className="h-3.5 w-3.5 shrink-0" />
      )}
      <span className="h-4 w-4 shrink-0 flex items-center justify-center">
        {option.icon || <Circle className="h-3 w-3" />}
      </span>
      <div className="flex-1 min-w-0 text-left">
        <div className="truncate text-sm">{option.label}</div>
        {option.description && (
          <div className="truncate text-[10px] text-muted-foreground">{option.description}</div>
        )}
      </div>
      {option.badge && (
        <Badge variant="secondary" className="h-4 px-1 text-[10px] shrink-0">
          {option.badge}
        </Badge>
      )}
      {showArrow && <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />}
    </Button>
  );
}

export function TripleSelector({
  firstOptions,
  firstLabel,
  firstPlaceholder = "Select...",
  secondOptions,
  secondLabel,
  secondPlaceholder = "Select...",
  thirdOptions,
  thirdLabel,
  thirdPlaceholder = "Select...",
  value,
  onChange,
  hideFirst,
  hideSecond,
  hideThird,
  isLoading,
  disabled,
  compact,
  className,
}: TripleSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const selectedFirst = firstOptions.find((o) => o.id === value.first);
  const selectedSecond = secondOptions.find((o) => o.id === value.second);
  const selectedThird = thirdOptions.find((o) => o.id === value.third);

  const handleFirstChange = (id: string) => {
    onChange?.({ first: id, second: null, third: null });
  };

  const handleSecondChange = (id: string) => {
    onChange?.({ ...value, second: id, third: null });
  };

  const handleThirdChange = (id: string) => {
    onChange?.({ ...value, third: id });
    if (compact) {
      setIsOpen(false);
    }
  };

  // 紧凑模式：单按钮展开三级面板
  if (compact) {
    const displayLabel = [
      !hideFirst && selectedFirst?.label,
      !hideSecond && selectedSecond?.label,
      !hideThird && selectedThird?.label,
    ]
      .filter(Boolean)
      .join(" / ");

    return (
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn("h-8 max-w-[200px] shrink-0 px-2 gap-1.5 text-xs", className)}
            disabled={isLoading || disabled}
          >
            <span className="h-3.5 w-3.5 shrink-0 flex items-center justify-center">
              {selectedThird?.icon || selectedSecond?.icon || selectedFirst?.icon || (
                <Circle className="h-3 w-3" />
              )}
            </span>
            <span className="truncate">{displayLabel || "Select..."}</span>
            <ChevronDown className="h-3 w-3 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex">
            {/* 第一级 */}
            {!hideFirst && (
              <div className="w-48 border-r border-border/50">
                {firstLabel && (
                  <div className="px-3 py-2 text-xs font-medium text-muted-foreground border-b border-border/50">
                    {firstLabel}
                  </div>
                )}
                <div className="p-1 max-h-64 overflow-y-auto">
                  {firstOptions.length === 0 ? (
                    <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                      No options
                    </div>
                  ) : (
                    firstOptions.map((option) => (
                      <OptionItem
                        key={option.id}
                        option={option}
                        isSelected={option.id === value.first}
                        onClick={() => handleFirstChange(option.id)}
                        showArrow={!hideSecond}
                      />
                    ))
                  )}
                </div>
              </div>
            )}

            {/* 第二级 */}
            {!hideSecond && value.first && (
              <div className="w-48 border-r border-border/50">
                {secondLabel && (
                  <div className="px-3 py-2 text-xs font-medium text-muted-foreground border-b border-border/50">
                    {secondLabel}
                  </div>
                )}
                <div className="p-1 max-h-64 overflow-y-auto">
                  {secondOptions.length === 0 ? (
                    <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                      No options
                    </div>
                  ) : (
                    secondOptions.map((option) => (
                      <OptionItem
                        key={option.id}
                        option={option}
                        isSelected={option.id === value.second}
                        onClick={() => handleSecondChange(option.id)}
                        showArrow={!hideThird}
                      />
                    ))
                  )}
                </div>
              </div>
            )}

            {/* 第三级 */}
            {!hideThird && value.second && (
              <div className="w-56">
                {thirdLabel && (
                  <div className="px-3 py-2 text-xs font-medium text-muted-foreground border-b border-border/50">
                    {thirdLabel}
                  </div>
                )}
                <div className="p-1 max-h-64 overflow-y-auto">
                  {thirdOptions.length === 0 ? (
                    <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                      No options
                    </div>
                  ) : (
                    thirdOptions.map((option) => (
                      <OptionItem
                        key={option.id}
                        option={option}
                        isSelected={option.id === value.third}
                        onClick={() => handleThirdChange(option.id)}
                      />
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  // 非紧凑模式：三个独立的选择器并排显示
  return (
    <div className={cn("flex items-center gap-1", className)}>
      {/* 第一级选择器 */}
      {!hideFirst && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 max-w-[120px] shrink-0 px-2 gap-1.5 text-xs"
              disabled={isLoading || disabled}
            >
              <span className="h-3.5 w-3.5 shrink-0 flex items-center justify-center">
                {selectedFirst?.icon || <Circle className="h-3 w-3" />}
              </span>
              <span className="truncate">{selectedFirst?.label || firstPlaceholder}</span>
              <ChevronDown className="h-3 w-3 shrink-0" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-1" align="start">
            {firstLabel && (
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground border-b border-border/50 mb-1">
                {firstLabel}
              </div>
            )}
            {firstOptions.length === 0 ? (
              <div className="px-2 py-3 text-sm text-muted-foreground text-center">No options</div>
            ) : (
              firstOptions.map((option) => (
                <OptionItem
                  key={option.id}
                  option={option}
                  isSelected={option.id === value.first}
                  onClick={() => handleFirstChange(option.id)}
                />
              ))
            )}
          </PopoverContent>
        </Popover>
      )}

      {/* 第二级选择器 */}
      {!hideSecond && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 max-w-[120px] shrink-0 px-2 gap-1.5 text-xs"
              disabled={isLoading || disabled || !value.first}
            >
              <span className="h-3.5 w-3.5 shrink-0 flex items-center justify-center">
                {selectedSecond?.icon || <Circle className="h-3 w-3" />}
              </span>
              <span className="truncate">{selectedSecond?.label || secondPlaceholder}</span>
              <ChevronDown className="h-3 w-3 shrink-0" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-1" align="start">
            {secondLabel && (
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground border-b border-border/50 mb-1">
                {secondLabel}
              </div>
            )}
            {secondOptions.length === 0 ? (
              <div className="px-2 py-3 text-sm text-muted-foreground text-center">No options</div>
            ) : (
              secondOptions.map((option) => (
                <OptionItem
                  key={option.id}
                  option={option}
                  isSelected={option.id === value.second}
                  onClick={() => handleSecondChange(option.id)}
                />
              ))
            )}
          </PopoverContent>
        </Popover>
      )}

      {/* 第三级选择器 */}
      {!hideThird && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 max-w-[140px] shrink-0 px-2 gap-1.5 text-xs"
              disabled={isLoading || disabled || !value.second}
            >
              <span className="h-3.5 w-3.5 shrink-0 flex items-center justify-center">
                {selectedThird?.icon || <Circle className="h-3 w-3" />}
              </span>
              <span className="truncate">{selectedThird?.label || thirdPlaceholder}</span>
              <ChevronDown className="h-3 w-3 shrink-0" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-1" align="start">
            {thirdLabel && (
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground border-b border-border/50 mb-1">
                {thirdLabel}
              </div>
            )}
            {thirdOptions.length === 0 ? (
              <div className="px-2 py-3 text-sm text-muted-foreground text-center">No options</div>
            ) : (
              thirdOptions.map((option) => (
                <OptionItem
                  key={option.id}
                  option={option}
                  isSelected={option.id === value.third}
                  onClick={() => handleThirdChange(option.id)}
                />
              ))
            )}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
