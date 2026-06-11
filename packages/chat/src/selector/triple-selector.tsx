/**
 * TripleSelector
 *
 * 三联级联选择器：第一级 -> 第二级 -> 第三级
 * 典型用例：Agent Type -> Provider -> Model
 */

import { useState } from "react";
import { Check, ChevronDown, ChevronRight } from "lucide-react";
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
        "w-full justify-start gap-1.5 h-7 px-2",
        option.disabled && "opacity-50",
        isSelected && "bg-primary/10"
      )}
      onClick={onClick}
      disabled={option.disabled}
    >
      {isSelected ? (
        <Check className="h-3 w-3 shrink-0 text-primary" />
      ) : (
        <span className="h-3 w-3 shrink-0" />
      )}
      <span className="flex-1 min-w-0 truncate text-left text-xs">{option.label}</span>
      {option.badge && (
        <Badge variant="secondary" className="h-3.5 px-1 text-[9px] shrink-0">
          {option.badge}
        </Badge>
      )}
      {showArrow && <ChevronRight className="h-2.5 w-2.5 shrink-0 text-muted-foreground" />}
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
            className={cn("h-6 max-w-[180px] shrink-0 px-1.5 gap-1 text-[11px]", className)}
            disabled={isLoading || disabled}
          >
            <span className="truncate">{displayLabel || "Select..."}</span>
            <ChevronDown className="h-2.5 w-2.5 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex">
            {/* 第一级 */}
            {!hideFirst && (
              <div className="w-36 border-r border-border/50">
                {firstLabel && (
                  <div className="px-2 py-1.5 text-[10px] font-medium text-muted-foreground border-b border-border/50">
                    {firstLabel}
                  </div>
                )}
                <div className="p-0.5 max-h-56 overflow-y-auto">
                  {firstOptions.length === 0 ? (
                    <div className="px-2 py-2 text-xs text-muted-foreground text-center">
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
              <div className="w-36 border-r border-border/50">
                {secondLabel && (
                  <div className="px-2 py-1.5 text-[10px] font-medium text-muted-foreground border-b border-border/50">
                    {secondLabel}
                  </div>
                )}
                <div className="p-0.5 max-h-56 overflow-y-auto">
                  {secondOptions.length === 0 ? (
                    <div className="px-2 py-2 text-xs text-muted-foreground text-center">
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
              <div className="w-44">
                {thirdLabel && (
                  <div className="px-2 py-1.5 text-[10px] font-medium text-muted-foreground border-b border-border/50">
                    {thirdLabel}
                  </div>
                )}
                <div className="p-0.5 max-h-56 overflow-y-auto">
                  {thirdOptions.length === 0 ? (
                    <div className="px-2 py-2 text-xs text-muted-foreground text-center">
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
    <div className={cn("flex items-center gap-0.5", className)}>
      {/* 第一级选择器 */}
      {!hideFirst && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 max-w-[100px] shrink-0 px-1.5 gap-1 text-[11px]"
              disabled={isLoading || disabled}
            >
              <span className="truncate">{selectedFirst?.label || firstPlaceholder}</span>
              <ChevronDown className="h-2.5 w-2.5 shrink-0" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-44 p-0.5" align="start">
            {firstLabel && (
              <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground border-b border-border/50 mb-0.5">
                {firstLabel}
              </div>
            )}
            {firstOptions.length === 0 ? (
              <div className="px-2 py-2 text-xs text-muted-foreground text-center">No options</div>
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
              className="h-6 max-w-[100px] shrink-0 px-1.5 gap-1 text-[11px]"
              disabled={isLoading || disabled || !value.first}
            >
              <span className="truncate">{selectedSecond?.label || secondPlaceholder}</span>
              <ChevronDown className="h-2.5 w-2.5 shrink-0" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-44 p-0.5" align="start">
            {secondLabel && (
              <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground border-b border-border/50 mb-0.5">
                {secondLabel}
              </div>
            )}
            {secondOptions.length === 0 ? (
              <div className="px-2 py-2 text-xs text-muted-foreground text-center">No options</div>
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
              className="h-6 max-w-[120px] shrink-0 px-1.5 gap-1 text-[11px]"
              disabled={isLoading || disabled || !value.second}
            >
              <span className="truncate">{selectedThird?.label || thirdPlaceholder}</span>
              <ChevronDown className="h-2.5 w-2.5 shrink-0" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-0.5" align="start">
            {thirdLabel && (
              <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground border-b border-border/50 mb-0.5">
                {thirdLabel}
              </div>
            )}
            {thirdOptions.length === 0 ? (
              <div className="px-2 py-2 text-xs text-muted-foreground text-center">No options</div>
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
