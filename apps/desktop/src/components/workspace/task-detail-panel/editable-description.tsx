"use client";

import { useState } from "react";
import { Textarea } from "@viben/ui";

export interface EditableDescriptionProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function EditableDescription({
  value,
  onChange,
  placeholder,
}: EditableDescriptionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  const handleSave = () => {
    if (editValue !== value) {
      onChange(editValue);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      setEditValue(value);
      setIsEditing(false);
    }
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      handleSave();
    }
  };

  if (isEditing) {
    return (
      <Textarea
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        autoFocus
        placeholder={placeholder}
        className="min-h-[100px]"
      />
    );
  }

  return (
    <div
      className="cursor-pointer hover:bg-muted/50 rounded px-2 py-1 -mx-2 min-h-[60px] transition-colors"
      onClick={() => {
        setEditValue(value);
        setIsEditing(true);
      }}
    >
      {value ? (
        <p className="text-sm whitespace-pre-wrap">{value}</p>
      ) : (
        <p className="text-sm text-muted-foreground">{placeholder}</p>
      )}
    </div>
  );
}
