"use client";

import * as React from "react";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { cn, Button } from "@viben/ui";
import { Calendar, X } from "lucide-react";

export interface DueDatePickerProps {
  value?: string; // ISO date string (YYYY-MM-DD)
  onChange: (date: string | undefined) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export const DueDatePicker = React.forwardRef<
  HTMLDivElement,
  DueDatePickerProps
>(
  (
    {
      value,
      onChange,
      disabled = false,
      placeholder,
      className,
    },
    ref
  ) => {
    const { t } = useTranslation();
    const inputRef = useRef<HTMLInputElement>(null);

    const resolvedPlaceholder = placeholder ?? t("kanban.dueDate.selectDate");

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      onChange(newValue || undefined);
    };

    const handleClear = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onChange(undefined);
    };

    const handleContainerClick = () => {
      if (!disabled) {
        inputRef.current?.showPicker();
      }
    };

    return (
      <div
        ref={ref}
        className={cn(
          "relative inline-flex items-center gap-2",
          "transition-all duration-200",
          className
        )}
      >
        <div
          className={cn(
            "relative flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2",
            "transition-all duration-200",
            "hover:border-primary/50",
            "focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary",
            disabled && "cursor-not-allowed opacity-50"
          )}
          onClick={handleContainerClick}
        >
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <input
            ref={inputRef}
            type="date"
            value={value || ""}
            onChange={handleChange}
            disabled={disabled}
            className={cn(
              "bg-transparent text-sm outline-none",
              "placeholder:text-muted-foreground",
              "[&::-webkit-calendar-picker-indicator]:opacity-0",
              "[&::-webkit-calendar-picker-indicator]:absolute",
              "[&::-webkit-calendar-picker-indicator]:inset-0",
              "[&::-webkit-calendar-picker-indicator]:w-full",
              "[&::-webkit-calendar-picker-indicator]:h-full",
              "[&::-webkit-calendar-picker-indicator]:cursor-pointer",
              !value && "text-muted-foreground"
            )}
            placeholder={resolvedPlaceholder}
          />
          {value && !disabled && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-4 w-4 p-0 hover:bg-transparent"
              onClick={handleClear}
              aria-label={t("kanban.dueDate.clearDate")}
            >
              <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
            </Button>
          )}
        </div>
      </div>
    );
  }
);
DueDatePicker.displayName = "DueDatePicker";
