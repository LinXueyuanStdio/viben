"use client";

import * as React from "react";
import { cn, Input } from "@viben/ui";
import { Plus } from "lucide-react";
import type { Subtask, SubtaskCallbacks } from "./subtask-types";
import { SubtaskProgress } from "./subtask-progress";
import { SubtaskItem } from "./subtask-item";

export interface SubtaskListProps {
  subtasks: Subtask[];
  callbacks?: SubtaskCallbacks;
  disabled?: boolean;
  className?: string;
}

export const SubtaskList = React.forwardRef<HTMLDivElement, SubtaskListProps>(
  ({ subtasks, callbacks, disabled = false, className }, ref) => {
    const [newSubtaskTitle, setNewSubtaskTitle] = React.useState("");
    const inputRef = React.useRef<HTMLInputElement>(null);

    const completedCount = subtasks.filter((s) => s.completed).length;
    const totalCount = subtasks.length;

    const handleCreate = () => {
      const trimmedTitle = newSubtaskTitle.trim();
      if (trimmedTitle && callbacks?.onCreate) {
        callbacks.onCreate(trimmedTitle);
        setNewSubtaskTitle("");
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        handleCreate();
      } else if (e.key === "Escape") {
        setNewSubtaskTitle("");
        inputRef.current?.blur();
      }
    };

    return (
      <div ref={ref} className={cn("space-y-2", className)}>
        {/* Progress Bar */}
        {totalCount > 0 && (
          <SubtaskProgress
            completed={completedCount}
            total={totalCount}
            className="mb-3"
          />
        )}

        {/* Subtask List */}
        {subtasks.length > 0 && (
          <div className="space-y-0.5">
            {subtasks.map((subtask) => (
              <SubtaskItem
                key={subtask.id}
                subtask={subtask}
                onToggle={
                  callbacks?.onToggle
                    ? (completed) => callbacks.onToggle?.(subtask.id, completed)
                    : undefined
                }
                onDelete={
                  callbacks?.onDelete
                    ? () => callbacks.onDelete?.(subtask.id)
                    : undefined
                }
                onUpdate={
                  callbacks?.onUpdate
                    ? (title) => callbacks.onUpdate?.(subtask.id, title)
                    : undefined
                }
                disabled={disabled}
              />
            ))}
          </div>
        )}

        {/* Add New Subtask */}
        {callbacks?.onCreate && !disabled && (
          <div className="flex items-center gap-2 pt-1">
            <Plus className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <Input
              ref={inputRef}
              type="text"
              placeholder="Add subtask..."
              value={newSubtaskTitle}
              onChange={(e) => setNewSubtaskTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={() => {
                if (newSubtaskTitle.trim()) {
                  handleCreate();
                }
              }}
              className={cn(
                "h-8 text-sm border-transparent bg-transparent",
                "hover:border-input focus:border-input",
                "placeholder:text-muted-foreground/60"
              )}
            />
          </div>
        )}
      </div>
    );
  }
);

SubtaskList.displayName = "SubtaskList";
