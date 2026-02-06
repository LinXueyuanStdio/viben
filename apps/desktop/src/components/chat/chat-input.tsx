import * as React from "react";
import { useTranslation } from "react-i18next";
import {
  Send,
  Paperclip,
  Image,
  FileText,
  X,
  Loader2,
  StopCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
}

export function ChatInput({
  onSend,
  onCancel,
  isLoading,
  disabled,
  placeholder,
  className,
}: ChatInputProps) {
  const { t } = useTranslation();
  const [content, setContent] = React.useState("");
  const [attachments, setAttachments] = React.useState<MessageAttachment[]>([]);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const imageInputRef = React.useRef<HTMLInputElement>(null);

  // Auto-resize textarea
  React.useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [content]);

  // Handle paste for images
  React.useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            handleImageFile(file);
          }
          break;
        }
      }
    };

    const textarea = textareaRef.current;
    textarea?.addEventListener("paste", handlePaste);
    return () => textarea?.removeEventListener("paste", handlePaste);
  }, []);

  const handleImageFile = async (file: File) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    // Add loading attachment
    setAttachments((prev) => [
      ...prev,
      {
        id,
        type: "image",
        name: file.name,
        isLoading: true,
      },
    ]);

    // Read file as data URL
    const reader = new FileReader();
    reader.onload = () => {
      setAttachments((prev) =>
        prev.map((a) =>
          a.id === id
            ? {
                ...a,
                data: reader.result as string,
                mimeType: file.type,
                isLoading: false,
              }
            : a
        )
      );
    };
    reader.onerror = () => {
      setAttachments((prev) => prev.filter((a) => a.id !== id));
    };
    reader.readAsDataURL(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: "file" | "image") => {
    const files = e.target.files;
    if (!files) return;

    for (const file of files) {
      if (type === "image") {
        handleImageFile(file);
      } else {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        setAttachments((prev) => [
          ...prev,
          {
            id,
            type: "file",
            name: file.name,
            mimeType: file.type,
          },
        ]);
      }
    }

    // Reset input
    e.target.value = "";
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSend = () => {
    if ((!content.trim() && attachments.length === 0) || disabled || isLoading) {
      return;
    }

    // Check if any attachments are still loading
    if (attachments.some((a) => a.isLoading)) {
      return;
    }

    onSend(content.trim(), attachments.length > 0 ? attachments : undefined);
    setContent("");
    setAttachments([]);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/* Attachments preview */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 px-4">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="relative flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm"
            >
              {attachment.isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : attachment.type === "image" ? (
                <div className="relative h-10 w-10 overflow-hidden rounded">
                  <img
                    src={attachment.data}
                    alt={attachment.name}
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : (
                <FileText className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="max-w-[150px] truncate">{attachment.name}</span>
              <button
                type="button"
                onClick={() => removeAttachment(attachment.id)}
                className="ml-1 rounded-full p-0.5 hover:bg-background"
              >
                <X className="h-3 w-3" />
                <span className="sr-only">{t("common.remove")}</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="flex items-end gap-2 rounded-xl border border-border bg-background p-2 shadow-sm transition-all focus-within:border-primary/50 focus-within:shadow-md">
        {/* Attachment button */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              disabled={disabled || isLoading}
            >
              <Paperclip className="h-5 w-5" />
              <span className="sr-only">{t("chat.addAttachment")}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => imageInputRef.current?.click()}>
              <Image className="mr-2 h-4 w-4" />
              {t("chat.attachImage")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
              <FileText className="mr-2 h-4 w-4" />
              {t("chat.attachFile")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Hidden file inputs */}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFileSelect(e, "image")}
          multiple
        />
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => handleFileSelect(e, "file")}
          multiple
        />

        {/* Text input */}
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || t("chat.inputPlaceholder")}
          disabled={disabled || isLoading}
          className="min-h-[40px] max-h-[200px] flex-1 resize-none border-0 bg-transparent p-2 shadow-none focus-visible:ring-0"
          rows={1}
        />

        {/* Send/Cancel button */}
        {isLoading ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={onCancel}
          >
            <StopCircle className="h-5 w-5 text-destructive" />
            <span className="sr-only">{t("common.cancel")}</span>
          </Button>
        ) : (
          <Button
            type="button"
            variant="default"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={handleSend}
            disabled={
              disabled ||
              (!content.trim() && attachments.length === 0) ||
              attachments.some((a) => a.isLoading)
            }
          >
            <Send className="h-5 w-5" />
            <span className="sr-only">{t("chat.send")}</span>
          </Button>
        )}
      </div>
    </div>
  );
}
