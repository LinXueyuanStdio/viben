"use client";

import * as React from "react";
import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
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
      placeholder,
      disabled = false,
      className,
    },
    ref
  ) => {
    const { t } = useTranslation();
    const [value, setValue] = useState("");
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const resolvedPlaceholder = placeholder ?? t("kanban.comment.addPlaceholder");

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
          placeholder={resolvedPlaceholder}
          disabled={disabled}
          rows={3}
          className={cn(
            "resize-none text-sm",
            "transition-all duration-200"
          )}
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {t("kanban.comment.submitHint")}
          </span>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={isSubmitDisabled}
            className="h-8"
          >
            <Send className="h-4 w-4 mr-1.5" />
            {t("kanban.comment.send")}
          </Button>
        </div>
      </div>
    );
  }
);

CommentInput.displayName = "CommentInput";
