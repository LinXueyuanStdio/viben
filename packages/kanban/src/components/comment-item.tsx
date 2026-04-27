"use client";

import * as React from "react";
import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { MoreHorizontal, Pencil, Trash2, Smile } from "lucide-react";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
  Button,
  Textarea,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  cn,
} from "@viben/ui";
import type { Comment, CommentReaction } from "./comment-types";
import { formatRelativeTime, REACTION_EMOJIS } from "./comment-types";

export interface CommentItemProps {
  comment: Comment;
  currentUserId: string;
  onEdit?: (commentId: string, content: string) => void;
  onDelete?: (commentId: string) => void;
  onToggleReaction?: (commentId: string, emoji: string) => void;
  className?: string;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export const CommentItem = React.forwardRef<HTMLDivElement, CommentItemProps>(
  (
    {
      comment,
      currentUserId,
      onEdit,
      onDelete,
      onToggleReaction,
      className,
    },
    ref
  ) => {
    const { t } = useTranslation();
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(comment.content);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const emojiPickerRef = useRef<HTMLDivElement>(null);

    const isOwner = comment.author.id === currentUserId;

    const handleSaveEdit = () => {
      const trimmedValue = editValue.trim();
      if (trimmedValue && trimmedValue !== comment.content) {
        onEdit?.(comment.id, trimmedValue);
      } else {
        setEditValue(comment.content);
      }
      setIsEditing(false);
    };

    const handleCancelEdit = () => {
      setEditValue(comment.content);
      setIsEditing(false);
    };

    const handleEditKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSaveEdit();
      } else if (e.key === "Escape") {
        handleCancelEdit();
      }
    };

    const handleReactionClick = (emoji: string) => {
      onToggleReaction?.(comment.id, emoji);
      setShowEmojiPicker(false);
    };

    // Check if current user has reacted with a specific emoji
    const hasUserReacted = (reaction: CommentReaction): boolean => {
      return reaction.users.some((user) => user.id === currentUserId);
    };

    // Close emoji picker when clicking outside
    useEffect(() => {
      if (!showEmojiPicker) return;

      const handleClickOutside = (e: MouseEvent) => {
        if (
          emojiPickerRef.current &&
          !emojiPickerRef.current.contains(e.target as Node)
        ) {
          setShowEmojiPicker(false);
        }
      };

      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [showEmojiPicker]);

    // Focus textarea when editing
    useEffect(() => {
      if (isEditing && textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.selectionStart = textareaRef.current.value.length;
      }
    }, [isEditing]);

    return (
      <div
        ref={ref}
        className={cn(
          "group flex gap-3 py-3",
          "transition-all duration-200",
          className
        )}
      >
        {/* Author Avatar */}
        <Avatar className="h-8 w-8 flex-shrink-0">
          {comment.author.avatar && (
            <AvatarImage src={comment.author.avatar} alt={comment.author.name} />
          )}
          <AvatarFallback className="bg-primary/10 text-primary text-xs">
            {getInitials(comment.author.name)}
          </AvatarFallback>
        </Avatar>

        {/* Comment Content */}
        <div className="flex-1 min-w-0">
          {/* Header: Author name + Time + Actions */}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium">{comment.author.name}</span>
            <span className="text-xs text-muted-foreground">
              {formatRelativeTime(comment.createdAt, t)}
            </span>
            {comment.updatedAt && comment.updatedAt !== comment.createdAt && (
              <span className="text-xs text-muted-foreground">{t("kanban.comment.edited")}</span>
            )}

            {/* Actions Menu - Only visible for owner */}
            {isOwner && (onEdit || onDelete) && (
              <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {onEdit && (
                      <DropdownMenuItem
                        onClick={() => setIsEditing(true)}
                        className="gap-2"
                      >
                        <Pencil className="h-4 w-4" />
                        {t("kanban.comment.edit")}
                      </DropdownMenuItem>
                    )}
                    {onEdit && onDelete && <DropdownMenuSeparator />}
                    {onDelete && (
                      <DropdownMenuItem
                        onClick={() => onDelete(comment.id)}
                        className="gap-2 text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                        {t("kanban.comment.delete")}
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>

          {/* Content or Edit Mode */}
          {isEditing ? (
            <div className="space-y-2">
              <Textarea
                ref={textareaRef}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={handleEditKeyDown}
                rows={3}
                className="resize-none text-sm"
              />
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={handleSaveEdit} className="h-7">
                  {t("kanban.common.save")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelEdit}
                  className="h-7"
                >
                  {t("kanban.common.cancel")}
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-foreground whitespace-pre-wrap break-words">
              {comment.content}
            </p>
          )}

          {/* Reactions */}
          {!isEditing && (
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {/* Existing reactions */}
              {comment.reactions.map((reaction) => (
                <button
                  key={reaction.emoji}
                  type="button"
                  onClick={() => onToggleReaction?.(comment.id, reaction.emoji)}
                  className={cn(
                    "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs",
                    "border transition-all duration-200",
                    hasUserReacted(reaction)
                      ? "bg-primary/10 border-primary/30 text-primary"
                      : "bg-muted/50 border-transparent hover:border-border"
                  )}
                  title={reaction.users.map((u) => u.name).join(", ")}
                >
                  <span>{reaction.emoji}</span>
                  <span>{reaction.count}</span>
                </button>
              ))}

              {/* Add reaction button */}
              {onToggleReaction && (
                <div className="relative" ref={emojiPickerRef}>
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className={cn(
                      "inline-flex items-center justify-center h-6 w-6 rounded-full",
                      "text-muted-foreground hover:text-foreground",
                      "hover:bg-muted/50 transition-all duration-200",
                      "opacity-0 group-hover:opacity-100",
                      showEmojiPicker && "opacity-100"
                    )}
                    title={t("kanban.comment.addReaction")}
                  >
                    <Smile className="h-3.5 w-3.5" />
                  </button>

                  {/* Emoji Picker Dropdown */}
                  {showEmojiPicker && (
                    <div
                      className={cn(
                        "absolute z-50 bottom-full mb-1 left-0",
                        "bg-popover border rounded-lg shadow-lg p-2",
                        "animate-in fade-in-0 zoom-in-95"
                      )}
                    >
                      <div className="flex gap-1">
                        {REACTION_EMOJIS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => handleReactionClick(emoji)}
                            className={cn(
                              "h-7 w-7 flex items-center justify-center rounded",
                              "hover:bg-muted transition-colors duration-150"
                            )}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
);

CommentItem.displayName = "CommentItem";
