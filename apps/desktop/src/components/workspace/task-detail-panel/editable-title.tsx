"use client";

import { useState } from "react";
import { Input, cn } from "@viben/ui";

export interface EditableTitleProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function EditableTitle({ value, onChange, className }: EditableTitleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  const handleSave = () => {
    if (editValue.trim() && editValue !== value) {
      onChange(editValue.trim());
    } else {
      setEditValue(value);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSave();
    }
    if (e.key === "Escape") {
      setEditValue(value);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <Input
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        autoFocus
        className={cn("font-semibold h-auto py-0.5", className)}
      />
    );
  }

  return (
    <h2
      className={cn(
        "font-semibold cursor-pointer hover:bg-muted/50 rounded px-1.5 py-0.5 -mx-1.5 transition-colors line-clamp-2",
        className
      )}
      onClick={() => {
        setEditValue(value);
        setIsEditing(true);
      }}
    >
      {value}
    </h2>
  );
}
