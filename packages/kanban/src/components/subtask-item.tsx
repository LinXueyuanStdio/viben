"use client";

import * as React from "react";
import { useState, useRef, useEffect } from "react";
import { cn } from "@viben/ui";
import { Check, Trash2 } from "lucide-react";
import type { Subtask } from "./subtask-types";

export interface SubtaskItemProps {
  subtask: Subtask;
  onToggle?: (completed: boolean) => void;
  onDelete?: () => void;
  onUpdate?: (title: string) => void;
  disabled?: boolean;
}

export const SubtaskItem = React.forwardRef<HTMLDivElement, SubtaskItemProps>(
  ({ subtask, onToggle, onDelete, onUpdate, disabled = false }, ref) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(subtask.title);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleToggle = () => {
      if (disabled) return;
      onToggle?.(!subtask.completed);
    };

    const handleDoubleClick = () => {
      if (disabled || !onUpdate) return;
      setIsEditing(true);
      setEditValue(subtask.title);
    };

    const handleSave = () => {
      const trimmedValue = editValue.trim();
      if (trimmedValue && trimmedValue !== subtask.title) {
        onUpdate?.(trimmedValue);
      } else {
        setEditValue(subtask.title);
      }
      setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        handleSave();
      } else if (e.key === "Escape") {
        setEditValue(subtask.title);
        setIsEditing(false);
      }
    };

    useEffect(() => {
      if (isEditing && inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }, [isEditing]);

    return (
      <div
        ref={ref}
        className={cn(
          "group flex items-center gap-2 py-1.5 px-1 rounded-md",
          "transition-all duration-200",
          "hover:bg-muted/50",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        {/* Custom Checkbox */}
        <button
          type="button"
          onClick={handleToggle}
          disabled={disabled}
          className={cn(
            "flex-shrink-0 h-4 w-4 rounded border",
            "flex items-center justify-center",
            "transition-all duration-200",
            "focus:outline-none focus:ring-2 focus:ring-primary/20",
            subtask.completed
              ? "bg-primary border-primary text-primary-foreground"
              : "border-input hover:border-primary/50",
            disabled && "cursor-not-allowed"
          )}
          aria-label={subtask.completed ? "Mark as incomplete" : "Mark as complete"}
        >
          {subtask.completed && <Check className="h-3 w-3" />}
        </button>

        {/* Title */}
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className={cn(
              "flex-1 text-sm bg-transparent border-none outline-none",
              "focus:ring-0"
            )}
          />
        ) : (
          <span
            onDoubleClick={handleDoubleClick}
            className={cn(
              "flex-1 text-sm cursor-default select-none",
              "transition-all duration-200",
              subtask.completed && "line-through text-muted-foreground"
            )}
          >
            {subtask.title}
          </span>
        )}

        {/* Delete Button */}
        {onDelete && !disabled && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className={cn(
              "flex-shrink-0 h-6 w-6 rounded",
              "flex items-center justify-center",
              "text-muted-foreground hover:text-destructive",
              "hover:bg-destructive/10",
              "opacity-0 group-hover:opacity-100",
              "transition-all duration-200",
              "focus:outline-none focus:ring-2 focus:ring-destructive/20 focus:opacity-100"
            )}
            aria-label="Delete subtask"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  }
);

SubtaskItem.displayName = "SubtaskItem";
