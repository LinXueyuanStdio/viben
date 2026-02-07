import * as React from "react";
import { useTranslation } from "react-i18next";
import {
  Send,
  Plus,
  Paperclip,
  Image,
  FileText,
  X,
  Loader2,
  Square,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { MessageAttachment } from "@/types";

interface ChatInputProps {
  onSend: (content: string, attachments?: MessageAttachment[]) => void;
  onCancel?: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  /** Variant: 'default' for standard style, 'compact' for reply style */
  variant?: "default" | "compact";
  /** Auto focus on mount */
  autoFocus?: boolean;
}

// Check if file is an image (by MIME type or file extension)
const isImageFile = (file: File): boolean => {
  if (file.type.startsWith("image/")) {
    return true;
  }
  const ext = file.name.split(".").pop()?.toLowerCase();
  return ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "ico"].includes(ext || "");
};

export function ChatInput({
  onSend,
  onCancel,
  isLoading,
  disabled,
  placeholder,
  className,
  variant = "default",
  autoFocus = false,
}: ChatInputProps) {
  const { t } = useTranslation();
  const [content, setContent] = React.useState("");
  const [attachments, setAttachments] = React.useState<MessageAttachment[]>([]);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const imageInputRef = React.useRef<HTMLInputElement>(null);
  // Track IME composition state to prevent send on Enter during composition
  const isComposingRef = React.useRef(false);
  // Track previous isLoading state for auto-focus
  const prevIsLoadingRef = React.useRef(isLoading);

  // Auto focus on mount if autoFocus is true
  React.useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  // Auto focus when agent stops running (reply completed)
  React.useEffect(() => {
    if (prevIsLoadingRef.current && !isLoading && textareaRef.current) {
      textareaRef.current.focus();
    }
    prevIsLoadingRef.current = isLoading;
  }, [isLoading]);

  // Auto-resize textarea based on content
  React.useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = "auto";

    // Calculate the new height
    const isCompact = variant === "compact";
    const maxHeight = isCompact ? 120 : 200;
    const minHeight = isCompact ? 20 : 40;
    const newHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);

    textarea.style.height = `${newHeight}px`;

    // Enable/disable overflow based on content height
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [content, variant]);

  // Create preview for image files with error handling
  const createImagePreview = React.useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (result) {
          resolve(result);
        } else {
          reject(new Error("Failed to read file"));
        }
      };
      reader.onerror = () => reject(new Error("FileReader error"));
      reader.readAsDataURL(file);
    });
  }, []);

  // Add files to attachments
  // forceImage: when true, treat all files as images (e.g., from clipboard paste)
  const addFiles = React.useCallback(
    async (files: FileList | File[], forceImage = false) => {
      const fileArray = Array.from(files);

      for (const file of fileArray) {
        const isImage = forceImage || isImageFile(file);
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

        // Add loading attachment for images
        if (isImage) {
          setAttachments((prev) => [
            ...prev,
            {
              id,
              type: "image",
              name: file.name,
              isLoading: true,
            },
          ]);

          try {
            const preview = await createImagePreview(file);
            setAttachments((prev) =>
              prev.map((a) =>
                a.id === id
                  ? {
                      ...a,
                      data: preview,
                      mimeType: file.type || "image/png",
                      isLoading: false,
                    }
                  : a
              )
            );
          } catch (error) {
            console.error("[ChatInput] Failed to create image preview:", error);
            // Remove failed attachment
            setAttachments((prev) => prev.filter((a) => a.id !== id));
          }
        } else {
          // Non-image file - read as data URL for transmission
          setAttachments((prev) => [
            ...prev,
            {
              id,
              type: "file",
              name: file.name,
              mimeType: file.type,
              isLoading: true,
            },
          ]);

          try {
            const data = await createImagePreview(file); // Same method works for any file
            setAttachments((prev) =>
              prev.map((a) =>
                a.id === id
                  ? {
                      ...a,
                      data,
                      isLoading: false,
                    }
                  : a
              )
            );
          } catch (error) {
            console.error("[ChatInput] Failed to read file:", error);
            setAttachments((prev) => prev.filter((a) => a.id !== id));
          }
        }
      }
    },
    [createImagePreview]
  );

  // Handle paste event for image upload
  const handlePaste = React.useCallback(
    async (e: React.ClipboardEvent) => {
      const items = e.clipboardData.items;
      const imageFiles: File[] = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            imageFiles.push(file);
          }
        }
      }

      if (imageFiles.length > 0) {
        e.preventDefault();
        // Pass forceImage=true since we've already verified these are images
        await addFiles(imageFiles, true);
      }
    },
    [addFiles]
  );

  // Handle file input change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
      e.target.value = "";
    }
  };

  // Handle image input change
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files, true);
      e.target.value = "";
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const canSubmit =
    (content.trim() || attachments.length > 0) &&
    !disabled &&
    !attachments.some((a) => a.isLoading);

  const handleSend = async () => {
    if (!canSubmit || isLoading) {
      return;
    }

    const text = content.trim();
    const messageAttachments = attachments.length > 0 ? attachments : undefined;

    // Clear state first
    setContent("");
    setAttachments([]);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    // Call onSend
    onSend(text, messageAttachments);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Don't send on Enter during IME composition
    if (e.key === "Enter" && !e.shiftKey && !isComposingRef.current) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCompositionStart = () => {
    isComposingRef.current = true;
  };

  const handleCompositionEnd = () => {
    // Delay reset to handle composition end event order
    setTimeout(() => {
      isComposingRef.current = false;
    }, 10);
  };

  const isCompact = variant === "compact";

  return (
    <div
      className={cn(
        "w-full",
        isCompact
          ? "border-border/60 bg-background rounded-xl border p-3 shadow-sm"
          : "border-border/50 bg-background rounded-2xl border p-4 shadow-lg",
        className
      )}
    >
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.pdf,.doc,.docx,.txt,.md,.json,.csv,.xlsx,.xls,.pptx,.ppt"
        onChange={handleFileChange}
        className="hidden"
      />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageChange}
        multiple
      />

      {/* Attachment Preview */}
      {attachments.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="group border-border/50 bg-muted/50 relative flex items-center gap-2 rounded-lg border px-3 py-2"
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
                <div className="bg-muted flex h-10 w-10 items-center justify-center rounded">
                  <FileText className="text-muted-foreground h-5 w-5" />
                </div>
              )}
              <span className="text-foreground max-w-[120px] truncate text-sm">
                {attachment.name}
              </span>
              <button
                type="button"
                onClick={() => removeAttachment(attachment.id)}
                className="bg-foreground text-background absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        onPaste={handlePaste}
        placeholder={placeholder || t("chat.inputPlaceholder")}
        className={cn(
          "text-foreground placeholder:text-muted-foreground w-full resize-none border-0 bg-transparent focus:outline-none",
          isCompact ? "px-1 text-sm" : "text-base"
        )}
        style={{
          minHeight: isCompact ? "20px" : "40px",
          maxHeight: isCompact ? "120px" : "200px",
          overflowY: "hidden",
        }}
        rows={1}
        disabled={isLoading || disabled}
      />

      {/* Bottom Actions */}
      <div className={cn("flex items-center justify-between", isCompact ? "mt-2" : "mt-3")}>
        {/* Add Button with Dropdown */}
        <div className="flex items-center gap-1">
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger
              disabled={isLoading || disabled}
              className={cn(
                "flex items-center justify-center transition-colors focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
                isCompact
                  ? "text-muted-foreground hover:bg-accent hover:text-foreground size-7 rounded-md"
                  : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground size-8 rounded-full border"
              )}
            >
              <Plus className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" sideOffset={8} className="z-50 w-56">
              <DropdownMenuItem
                onSelect={() => imageInputRef.current?.click()}
                className="cursor-pointer gap-3 py-2.5"
              >
                <Image className="size-4" />
                <span>{t("chat.attachImage")}</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => fileInputRef.current?.click()}
                className="cursor-pointer gap-3 py-2.5"
              >
                <Paperclip className="size-4" />
                <span>{t("chat.attachFile")}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Submit/Stop Button */}
        <div className="flex items-center gap-1">
          {isLoading ? (
            <button
              type="button"
              onClick={onCancel}
              className={cn(
                "flex items-center justify-center rounded-full transition-colors",
                isCompact
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90 size-7"
                  : "size-8 bg-red-500 text-white hover:bg-red-600"
              )}
            >
              <Square className={isCompact ? "size-3" : "size-3.5"} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSend}
              disabled={!canSubmit}
              className={cn(
                "flex items-center justify-center rounded-full transition-all",
                canSubmit
                  ? "bg-foreground text-background hover:bg-foreground/90 cursor-pointer"
                  : "bg-muted text-muted-foreground cursor-not-allowed",
                isCompact ? "size-7" : "size-8"
              )}
            >
              <Send className={isCompact ? "size-3" : "size-4"} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
