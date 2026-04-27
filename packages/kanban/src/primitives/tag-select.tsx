"use client";

import * as React from "react";
import { useState, useRef, useEffect, useContext } from "react";
import { Button, cn } from "@viben/ui";
import { Check, ChevronDown, Plus, Tag as TagIcon } from "lucide-react";
import type { Tag } from "./tag-config";
import { TAG_COLORS } from "./tag-config";
import { TagBadge } from "./tag-badge";

export interface TagSelectProps {
  availableTags: Tag[];
  selectedTagIds: string[];
  onChange: (tagIds: string[]) => void;
  onCreateTag?: (name: string, color: string) => void;
  disabled?: boolean;
}

interface PopoverContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const PopoverContext = React.createContext<PopoverContextValue | null>(null);

function usePopoverContext() {
  const context = useContext(PopoverContext);
  if (!context) {
    throw new Error("Popover components must be used within a Popover provider");
  }
  return context;
}

function Popover({
  children,
  open: controlledOpen,
  onOpenChange,
}: {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);

  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;

  return (
    <PopoverContext.Provider value={{ open, setOpen }}>
      <div className="relative inline-block">{children}</div>
    </PopoverContext.Provider>
  );
}

const PopoverTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }
>(({ className, children, asChild, onClick, ...props }, ref) => {
  const { open, setOpen } = usePopoverContext();

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setOpen(!open);
    onClick?.(e);
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
      ref,
      onClick: handleClick,
      "aria-expanded": open,
      ...props,
    });
  }

  return (
    <button
      ref={ref}
      type="button"
      className={className}
      onClick={handleClick}
      aria-expanded={open}
      {...props}
    >
      {children}
    </button>
  );
});
PopoverTrigger.displayName = "PopoverTrigger";

const PopoverContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { align?: "start" | "center" | "end" }
>(({ className, align = "start", children, ...props }, ref) => {
  const { open, setOpen } = usePopoverContext();
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (contentRef.current && !contentRef.current.contains(e.target as Node)) {
        const trigger = contentRef.current.parentElement?.querySelector(
          '[aria-expanded]'
        );
        if (trigger && trigger.contains(e.target as Node)) return;
        setOpen(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <div
      ref={(node) => {
        (contentRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      }}
      className={cn(
        "absolute z-50 min-w-[200px] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
        "animate-in fade-in-0 zoom-in-95",
        align === "start" && "left-0",
        align === "center" && "left-1/2 -translate-x-1/2",
        align === "end" && "right-0",
        "top-full mt-1",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});
PopoverContent.displayName = "PopoverContent";

export const TagSelect = ({
  availableTags,
  selectedTagIds,
  onChange,
  onCreateTag,
  disabled = false,
}: TagSelectProps) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [selectedColor, setSelectedColor] = useState<string>(TAG_COLORS[5].value);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedTags = availableTags.filter((tag) =>
    selectedTagIds.includes(tag.id)
  );

  const toggleTag = (tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      onChange(selectedTagIds.filter((id) => id !== tagId));
    } else {
      onChange([...selectedTagIds, tagId]);
    }
  };

  const handleCreateTag = () => {
    if (newTagName.trim() && onCreateTag) {
      onCreateTag(newTagName.trim(), selectedColor);
      setNewTagName("");
      setIsCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCreateTag();
    } else if (e.key === "Escape") {
      setIsCreating(false);
      setNewTagName("");
    }
  };

  useEffect(() => {
    if (isCreating && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isCreating]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className={cn(
            "h-8 justify-start text-left font-normal",
            selectedTags.length === 0 && "text-muted-foreground"
          )}
        >
          <TagIcon className="mr-2 h-4 w-4" />
          {selectedTags.length > 0 ? (
            <span>{selectedTags.length} tag{selectedTags.length > 1 ? "s" : ""}</span>
          ) : (
            <span>Add tags</span>
          )}
          <ChevronDown className="ml-auto h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[240px] p-2" align="start">
        {/* Selected Tags */}
        {selectedTags.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1 pb-2 border-b">
            {selectedTags.map((tag) => (
              <TagBadge
                key={tag.id}
                tag={tag}
                size="sm"
                onRemove={() => toggleTag(tag.id)}
              />
            ))}
          </div>
        )}

        {/* Available Tags */}
        <div className="space-y-1 max-h-[200px] overflow-y-auto">
          {availableTags.map((tag) => {
            const isSelected = selectedTagIds.includes(tag.id);
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleTag(tag.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm",
                  "transition-colors duration-150",
                  "hover:bg-accent hover:text-accent-foreground",
                  "focus:outline-none focus:bg-accent"
                )}
              >
                <span
                  className="h-3 w-3 rounded-full shrink-0"
                  style={{ backgroundColor: tag.color }}
                />
                <span className="flex-1 truncate text-left">{tag.name}</span>
                {isSelected && <Check className="h-4 w-4 shrink-0" />}
              </button>
            );
          })}
        </div>

        {/* Create New Tag */}
        {onCreateTag && (
          <div className="mt-2 pt-2 border-t">
            {isCreating ? (
              <div className="space-y-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Tag name"
                  className={cn(
                    "w-full rounded-md border bg-transparent px-2 py-1.5 text-sm",
                    "focus:outline-none focus:ring-1 focus:ring-ring"
                  )}
                />
                <div className="flex flex-wrap gap-1">
                  {TAG_COLORS.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setSelectedColor(color.value)}
                      className={cn(
                        "h-5 w-5 rounded-full transition-transform duration-150",
                        "hover:scale-110",
                        "focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-ring",
                        selectedColor === color.value && "ring-2 ring-offset-1 ring-foreground"
                      )}
                      style={{ backgroundColor: color.value }}
                      aria-label={color.name}
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="flex-1 h-7"
                    onClick={() => {
                      setIsCreating(false);
                      setNewTagName("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 h-7"
                    onClick={handleCreateTag}
                    disabled={!newTagName.trim()}
                  >
                    Create
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsCreating(true)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm",
                  "text-muted-foreground",
                  "transition-colors duration-150",
                  "hover:bg-accent hover:text-accent-foreground",
                  "focus:outline-none focus:bg-accent"
                )}
              >
                <Plus className="h-4 w-4" />
                <span>Create new tag</span>
              </button>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

TagSelect.displayName = "TagSelect";
