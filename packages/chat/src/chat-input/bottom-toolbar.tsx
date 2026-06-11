/**
 * ChatInput Bottom Toolbar Component
 *
 * Bottom toolbar with left content slot and submit control.
 */

import * as React from "react";
import { Send, Square } from "lucide-react";
import { cn, Button } from "@viben/ui";

// ============================================================================
// Bottom Toolbar (simplified with leftContent slot)
// ============================================================================

export interface ChatInputBottomToolbarProps {
  /** Left content slot for config controls */
  leftContent?: React.ReactNode;
  /** Popup content rendered above the toolbar */
  popupContent?: React.ReactNode;
  /** Submit control (send/stop buttons) */
  onSend: () => void;
  onCancel?: () => void;
  isLoading?: boolean;
  canSubmit: boolean;
  allowSendWhileLoading?: boolean;
  /** Additional CSS class */
  className?: string;
}

export function ChatInputBottomToolbar({
  leftContent,
  popupContent,
  onSend,
  onCancel,
  isLoading,
  canSubmit,
  allowSendWhileLoading,
  className,
}: ChatInputBottomToolbarProps) {
  return (
    <div
      className={cn(
        "relative h-10 flex items-center justify-between px-3 py-1 border-t border-border/30 bg-muted/30",
        className
      )}
    >
      {/* Popup content - positioned above toolbar */}
      {popupContent}

      <div data-testid="chat-input-config-controls" className="flex min-w-0 items-center gap-1">
        {leftContent}
      </div>
      <ChatInputSubmitControl
        onSend={onSend}
        onCancel={onCancel}
        isLoading={isLoading}
        canSubmit={canSubmit}
        allowSendWhileLoading={allowSendWhileLoading}
      />
    </div>
  );
}

// ============================================================================
// Submit Control
// ============================================================================

export interface ChatInputSubmitControlProps {
  onSend: () => void;
  onCancel?: () => void;
  isLoading?: boolean;
  canSubmit: boolean;
  allowSendWhileLoading?: boolean;
}

export function ChatInputSubmitControl({
  onSend,
  onCancel,
  isLoading,
  canSubmit,
  allowSendWhileLoading,
}: ChatInputSubmitControlProps) {
  return (
    <div data-testid="chat-input-submit-control" className="flex items-center gap-1">
      {isLoading && (
        <Button
          size="sm"
          variant="destructive"
          className="h-8 w-8 p-0"
          onClick={onCancel}
        >
          <Square className="h-3.5 w-3.5" />
        </Button>
      )}
      {(!isLoading || allowSendWhileLoading) && (
        <Button
          size="sm"
          className="h-8 w-8 p-0"
          disabled={!canSubmit}
          onClick={onSend}
        >
          <Send className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
