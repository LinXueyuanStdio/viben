"use client";

import * as React from "react";
import { cn } from "@viben/ui";
import { Check } from "lucide-react";

export interface SelectableCardProps {
  id: string;
  isSelected: boolean;
  isSelecting: boolean;
  onToggle: (id: string) => void;
  children: React.ReactNode;
  className?: string;
}

export function SelectableCard({
  id,
  isSelected,
  isSelecting,
  onToggle,
  children,
  className,
}: SelectableCardProps) {
  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggle(id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      onToggle(id);
    }
  };

  return (
    <div
      className={cn(
        "group relative transition-all duration-200",
        isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-background rounded-lg",
        className
      )}
    >
      {/* Checkbox */}
      <div
        className={cn(
          "absolute left-2 top-2 z-10",
          "transition-all duration-200",
          isSelecting || isSelected
            ? "opacity-100 scale-100"
            : "opacity-0 scale-75 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto"
        )}
      >
        <button
          type="button"
          role="checkbox"
          aria-checked={isSelected}
          onClick={handleCheckboxClick}
          onKeyDown={handleKeyDown}
          className={cn(
            "flex h-5 w-5 items-center justify-center rounded border-2 transition-all duration-150",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            isSelected
              ? "border-primary bg-primary text-primary-foreground"
              : "border-muted-foreground/50 bg-background hover:border-primary/70"
          )}
        >
          {isSelected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
        </button>
      </div>

      {/* Card Content */}
      <div>{children}</div>
    </div>
  );
}

SelectableCard.displayName = "SelectableCard";
