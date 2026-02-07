/**
 * Attachment Preview Component
 *
 * Displays a preview of attached files/images with remove buttons.
 */

import * as React from "react";
import { Loader2, FileText, X } from "lucide-react";
import { cn } from "@viben/ui";
import type { MessageAttachment } from "../types";

export interface AttachmentPreviewProps {
  attachments: MessageAttachment[];
  onRemove: (id: string) => void;
  className?: string;
}

export function AttachmentPreview({
  attachments,
  onRemove,
  className,
}: AttachmentPreviewProps) {
  if (attachments.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "px-3 py-2 border-b border-border/30 flex flex-wrap gap-2",
        className
      )}
    >
      {attachments.map((attachment) => (
        <div
          key={attachment.id}
          className="group relative flex items-center gap-2 rounded-lg border border-border/50 bg-muted/50 px-3 py-2"
        >
          {attachment.isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : attachment.type === "image" && attachment.data ? (
            <img
              src={attachment.data}
              alt={attachment.name}
              className="h-10 w-10 rounded object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded bg-muted">
              <FileText className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
          <span className="max-w-[120px] truncate text-sm text-foreground">
            {attachment.name}
          </span>
          <button
            type="button"
            onClick={() => onRemove(attachment.id)}
            className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background opacity-0 transition-opacity group-hover:opacity-100"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
