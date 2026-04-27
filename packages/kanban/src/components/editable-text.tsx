"use client";

import * as React from "react";
import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Input, Textarea, cn } from "@viben/ui";

export interface EditableTextProps {
  value: string;
  onChange: (value: string) => void;
  /** Whether to use a multiline textarea instead of input */
  multiline?: boolean;
  /** Placeholder text when empty */
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
  /** Maximum length for the input */
  maxLength?: number;
  /** Whether the field is required (cannot be empty) */
  required?: boolean;
}

export function EditableText({
  value,
  onChange,
  multiline = false,
  placeholder,
  className,
  inputClassName,
  disabled,
  maxLength,
  required = true,
}: EditableTextProps) {
  const { t } = useTranslation();
  const resolvedPlaceholder = placeholder ?? t("kanban.editable.clickToEdit");
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  useEffect(() => {
    if (isEditing) {
      if (multiline) {
        textareaRef.current?.focus();
        textareaRef.current?.select();
      } else {
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
  }, [isEditing, multiline]);

  const handleSave = () => {
    const trimmed = editValue.trim();
    if (required && !trimmed) {
      // If required and empty, restore original value
      setEditValue(value);
    } else if (trimmed !== value) {
      onChange(trimmed);
    } else {
      setEditValue(value);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    if (e.key === "Enter" && !multiline) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === "Enter" && multiline && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (!disabled) {
      e.stopPropagation();
      setIsEditing(true);
    }
  };

  if (isEditing && !disabled) {
    const commonProps = {
      value: editValue,
      onChange: (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
      ) => setEditValue(e.target.value),
      onBlur: handleSave,
      onKeyDown: handleKeyDown,
      onClick: (e: React.MouseEvent) => e.stopPropagation(),
      maxLength,
      placeholder: resolvedPlaceholder,
    };

    if (multiline) {
      return (
        <Textarea
          ref={textareaRef}
          {...commonProps}
          className={cn(
            "min-h-[60px] py-1 px-2 text-sm",
            "bg-transparent border-primary",
            "resize-none",
            inputClassName
          )}
        />
      );
    }

    return (
      <Input
        ref={inputRef}
        {...commonProps}
        className={cn(
          "h-auto py-0.5 px-1 text-sm",
          "bg-transparent border-primary",
          inputClassName
        )}
      />
    );
  }

  const displayValue = value || resolvedPlaceholder;
  const isEmpty = !value;

  return (
    <span
      className={cn(
        "cursor-text",
        multiline ? "whitespace-pre-wrap break-words" : "truncate",
        "hover:bg-muted/50 rounded px-1 -mx-1",
        "transition-colors duration-150",
        isEmpty && "text-muted-foreground italic",
        disabled && "cursor-default hover:bg-transparent",
        className
      )}
      onDoubleClick={handleDoubleClick}
      title={multiline ? t("kanban.editable.doubleClickMultiline") : t("kanban.editable.doubleClickToEdit")}
    >
      {displayValue}
    </span>
  );
}

EditableText.displayName = "EditableText";
