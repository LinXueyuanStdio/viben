"use client";

import * as React from "react";
import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Plus, X } from "lucide-react";
import { Button, Input, cn } from "@viben/ui";

export interface QuickTaskInputProps {
  onSubmit: (title: string) => void;
  placeholder?: string;
  className?: string;
  buttonLabel?: string;
  autoFocus?: boolean;
}

export function QuickTaskInput({
  onSubmit,
  placeholder,
  className,
  buttonLabel,
  autoFocus = true,
}: QuickTaskInputProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const resolvedPlaceholder = placeholder ?? t("kanban.quickTask.placeholder");
  const resolvedButtonLabel = buttonLabel ?? t("kanban.quickTask.addTask");

  useEffect(() => {
    if (isOpen && autoFocus) {
      inputRef.current?.focus();
    }
  }, [isOpen, autoFocus]);

  const handleSubmit = () => {
    if (value.trim()) {
      onSubmit(value.trim());
      setValue("");
      // Keep open for continuous adding
    }
  };

  const handleCancel = () => {
    setValue("");
    setIsOpen(false);
  };

  if (!isOpen) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "w-full justify-start text-muted-foreground hover:text-foreground",
          "transition-all duration-200",
          className
        )}
        onClick={() => setIsOpen(true)}
      >
        <Plus className="h-4 w-4 mr-2" />
        {resolvedButtonLabel}
      </Button>
    );
  }

  return (
    <div className={cn("p-2 space-y-2", className)}>
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={resolvedPlaceholder}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
          }
          if (e.key === "Escape") {
            handleCancel();
          }
        }}
        className="h-9"
      />
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!value.trim()}
          className="h-7"
        >
          {t("kanban.quickTask.add")}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCancel}
          className="h-7"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
