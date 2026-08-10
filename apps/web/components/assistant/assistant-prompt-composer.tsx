"use client";

import {
  useEffect,
  useState,
  type FocusEventHandler,
  type FormEventHandler,
  type KeyboardEventHandler,
  type ReactNode,
  type RefObject,
} from "react";
import { ArrowUp, Loader2, Mic, Paperclip } from "lucide-react";
import type { ImageAttachment } from "@/lib/image-utils";
import { ACCEPT_IMAGE_TYPES, isValidImageType } from "@/lib/image-utils";
import type { ModelOption } from "@/lib/model-options";
import type { TextAttachment } from "@/lib/text-attachment-utils";
import { isLargeText } from "@/lib/text-attachment-utils";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ImageAttachmentsPreview } from "./image-attachments-preview";
import { ModelSelectorCompact } from "./model-selector-compact";
import { TextAttachmentsPreview } from "./text-attachments-preview";

type RecordingState = "idle" | "recording" | "processing";

interface PromptComposerLabels {
  attachFiles: string;
  voiceInput: string;
  sendMessage: string;
}

export interface AssistantPromptComposerProps {
  inputRef: RefObject<HTMLTextAreaElement | null>;
  fileInputRef: RefObject<HTMLInputElement | null>;
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  placeholder: string;
  images: ImageAttachment[];
  textAttachments: TextAttachment[];
  onRemoveImage: (id: string) => void;
  onRemoveTextAttachment: (id: string) => void;
  onAddImage: (file: File) => Promise<boolean>;
  onAddImages: (files: FileList | File[]) => Promise<void>;
  onAddLargeText: (text: string) => void;
  onOpenFilePicker: () => void;
  modelId: string | null;
  modelOptions: ModelOption[];
  onModelChange: (modelId: string) => void;
  onModelCloseAutoFocus?: () => void;
  modelDisabled?: boolean;
  recordingState: RecordingState;
  onMicClick: () => void;
  disabled: boolean;
  submitting: boolean;
  canSubmit: boolean;
  labels: PromptComposerLabels;
  leadingToolbarContent?: ReactNode;
  submitControl?: ReactNode;
  inputOverlay?: ReactNode;
  questionHeader?: ReactNode;
  footer?: ReactNode;
  className?: string;
  onTextareaFocus?: FocusEventHandler<HTMLTextAreaElement>;
  onTextareaKeyDown?: KeyboardEventHandler<HTMLTextAreaElement>;
  onCursorPositionChange?: (position: number) => void;
  blurOnSubmitTouch?: boolean;
}

export function AssistantPromptComposer({
  inputRef,
  fileInputRef,
  value,
  onValueChange,
  onSubmit,
  placeholder,
  images,
  textAttachments,
  onRemoveImage,
  onRemoveTextAttachment,
  onAddImage,
  onAddImages,
  onAddLargeText,
  onOpenFilePicker,
  modelId,
  modelOptions,
  onModelChange,
  onModelCloseAutoFocus,
  modelDisabled = false,
  recordingState,
  onMicClick,
  disabled,
  submitting,
  canSubmit,
  labels,
  leadingToolbarContent,
  submitControl,
  inputOverlay,
  questionHeader,
  footer,
  className,
  onTextareaFocus,
  onTextareaKeyDown,
  onCursorPositionChange,
  blurOnSubmitTouch = false,
}: AssistantPromptComposerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const controlsDisabled = disabled || submitting;

  useEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) return;

    const computedStyle = getComputedStyle(textarea);
    const lineHeight = Number.parseFloat(computedStyle.lineHeight) || 24;
    const maxHeight = lineHeight * 3;
    const currentHeight = textarea.offsetHeight;

    textarea.style.height = "0";
    const nextHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${
      Math.abs(nextHeight - currentHeight) > 1 ? nextHeight : currentHeight
    }px`;
  }, [inputRef, value]);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl bg-muted transition-colors",
        isDragging && "ring-2 ring-primary/50",
        className,
      )}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT_IMAGE_TYPES}
        multiple
        disabled={controlsDisabled}
        onChange={(event) => {
          const files = event.currentTarget.files;
          if (files?.length) void onAddImages(files);
          event.currentTarget.value = "";
        }}
        className="hidden"
      />

      <form
        onSubmit={onSubmit}
        onDragOver={(event) => {
          event.preventDefault();
          if (!controlsDisabled) setIsDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          if (!event.currentTarget.contains(event.relatedTarget as Node)) {
            setIsDragging(false);
          }
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          if (!controlsDisabled && event.dataTransfer.files.length > 0) {
            void onAddImages(event.dataTransfer.files);
          }
        }}
      >
        {inputOverlay}

        {(images.length > 0 || textAttachments.length > 0) && (
          <div className="flex min-w-0 flex-wrap items-start gap-2 px-2 pb-1 pt-2">
            <ImageAttachmentsPreview
              images={images}
              onRemove={onRemoveImage}
              className="p-0"
            />
            <TextAttachmentsPreview
              attachments={textAttachments}
              onRemove={onRemoveTextAttachment}
              className="p-0"
            />
          </div>
        )}

        {questionHeader}

        <div className="px-4 pb-2 pt-3">
          <textarea
            ref={inputRef}
            value={value}
            placeholder={placeholder}
            rows={1}
            disabled={controlsDisabled}
            onFocus={onTextareaFocus}
            onChange={(event) => {
              onValueChange(event.currentTarget.value);
              onCursorPositionChange?.(event.currentTarget.selectionStart ?? 0);
            }}
            onKeyDown={(event) => {
              if (onTextareaKeyDown) {
                onTextareaKeyDown(event);
                return;
              }
              if (event.key === "Enter" && !event.shiftKey && canSubmit) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            onKeyUp={(event) =>
              onCursorPositionChange?.(event.currentTarget.selectionStart ?? 0)
            }
            onClick={(event) =>
              onCursorPositionChange?.(event.currentTarget.selectionStart ?? 0)
            }
            onPaste={(event) => {
              const items = event.clipboardData?.items;
              if (items) {
                for (const item of items) {
                  if (!isValidImageType(item.type)) continue;
                  const file = item.getAsFile();
                  if (!file) continue;
                  event.preventDefault();
                  void onAddImage(file);
                  return;
                }
              }

              const pastedText = event.clipboardData?.getData("text/plain");
              if (pastedText && isLargeText(pastedText)) {
                event.preventDefault();
                onAddLargeText(pastedText);
              }
            }}
            className="w-full resize-none overflow-y-auto bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            style={{ minHeight: "24px" }}
          />
        </div>

        <div className="flex items-center justify-between gap-2 px-3 pb-2">
          <div className="flex min-w-0 items-center gap-2 overflow-hidden">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={labels.attachFiles}
              onClick={onOpenFilePicker}
              disabled={controlsDisabled}
              className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            {modelId && (
              <ModelSelectorCompact
                value={modelId}
                modelOptions={modelOptions}
                disabled={controlsDisabled || modelDisabled}
                onCloseAutoFocus={onModelCloseAutoFocus}
                onChange={onModelChange}
              />
            )}
            {leadingToolbarContent}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={labels.voiceInput}
              onClick={onMicClick}
              disabled={controlsDisabled || recordingState === "processing"}
              className={cn(
                "relative h-8 w-8 rounded-full",
                recordingState === "recording"
                  ? "text-red-500"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {recordingState === "recording" && (
                <span className="absolute inset-0 animate-pulse rounded-full bg-red-500/30 motion-reduce:animate-none" />
              )}
              {recordingState === "processing" ? (
                <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" />
              ) : (
                <Mic className="h-5 w-5" />
              )}
            </Button>

            {submitControl ?? (
              <Button
                type="submit"
                size="icon"
                aria-label={labels.sendMessage}
                onTouchEnd={() => {
                  if (blurOnSubmitTouch) inputRef.current?.blur();
                }}
                disabled={controlsDisabled || !canSubmit || modelDisabled}
                className="h-8 w-8 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-30"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                ) : (
                  <ArrowUp className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        </div>
      </form>

      {footer}
    </div>
  );
}
