"use client";

import * as React from "react";
import { useState, useRef, useEffect } from "react";
import { Input, cn } from "@viben/ui";

export interface EditableCardTitleProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
}

export function EditableCardTitle({
  value,
  onChange,
  className,
  inputClassName,
  disabled,
}: EditableCardTitleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== value) {
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

  if (isEditing && !disabled) {
    return (
      <Input
        ref={inputRef}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleSave();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            handleCancel();
          }
        }}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "h-auto py-0.5 px-1 text-sm font-medium",
          "bg-transparent border-primary",
          inputClassName
        )}
      />
    );
  }

  return (
    <span
      className={cn(
        "cursor-text truncate",
        "hover:bg-muted/50 rounded px-1 -mx-1",
        "transition-colors duration-150",
        disabled && "cursor-default hover:bg-transparent",
        className
      )}
      onDoubleClick={(e) => {
        if (!disabled) {
          e.stopPropagation();
          setIsEditing(true);
        }
      }}
      title="Double-click to edit"
    >
      {value}
    </span>
  );
}

EditableCardTitle.displayName = "EditableCardTitle";
