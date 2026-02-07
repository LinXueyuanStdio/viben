"use client";

import * as React from "react";
import { Send } from "lucide-react";
import { Button, Textarea, cn } from "@viben/ui";

export interface CommentInputProps {
  onSubmit: (content: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export const CommentInput = React.forwardRef<HTMLDivElement, CommentInputProps>(
  (
    {
      onSubmit,
      placeholder = "添加评论...",
      disabled = false,
      className,
    },
    ref
  ) => {
    const [value, setValue] = React.useState("");
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    const handleSubmit = () => {
      const trimmedValue = value.trim();
      if (trimmedValue) {
        onSubmit(trimmedValue);
        setValue("");
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Cmd+Enter (Mac) or Ctrl+Enter (Windows) to submit
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSubmit();
      }
    };

    const isSubmitDisabled = disabled || !value.trim();

    return (
      <div ref={ref} className={cn("space-y-2", className)}>
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={3}
          className={cn(
            "resize-none text-sm",
            "transition-all duration-200"
          )}
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            按 ⌘+Enter 发送
          </span>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={isSubmitDisabled}
            className="h-8"
          >
            <Send className="h-4 w-4 mr-1.5" />
            发送
          </Button>
        </div>
      </div>
    );
  }
);

CommentInput.displayName = "CommentInput";
