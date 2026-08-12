"use client";

import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
  type FocusEventHandler,
  type KeyboardEventHandler,
  type ReactNode,
} from "react";
import { Square } from "lucide-react";
import type { FileSuggestion } from "@/app/api/sessions/[sessionId]/files/route";
import type { SkillSuggestion } from "@/app/api/sessions/[sessionId]/skills/route";
import { AssistantPromptComposer } from "@/components/assistant/assistant-prompt-composer";
import { Button } from "@/components/ui/button";
import { useAudioRecording } from "@/hooks/assistant/use-audio-recording";
import { useImageAttachments } from "@/hooks/assistant/use-image-attachments";
import { useTextAttachments } from "@/hooks/assistant/use-text-attachments";
import type { ImageAttachment } from "@/lib/image-utils";
import type { ModelOption } from "@/lib/model-options";
import type { TextAttachment } from "@/lib/text-attachment-utils";
import { cn } from "@/lib/utils";

export type ChatComposerMode = "work" | "page";

export type ChatComposerSubmit = {
  text: string;
  images: Array<{ mediaType: string; url: string; filename?: string }>;
  textAttachments: Array<{ filename: string; content: string }>;
  modelId: string;
};

export type ChatComposerProps = {
  mode: ChatComposerMode;
  density: "full" | "compact";
  modelId: string;
  modelOptions: ModelOption[];
  contextUsage: ReactNode;
  status: "submitted" | "streaming" | "ready" | "error";
  disabled?: boolean;
  initialDraft?: string;
  draft?: string;
  onDraftChange?: (draft: string) => void;
  onModelChange: (modelId: string) => Promise<void>;
  onSubmit: (draft: ChatComposerSubmit) => Promise<void>;
  onStop: () => void;
  workExtensions?: {
    fileSuggestions: FileSuggestion[];
    skillSuggestions: SkillSuggestion[];
    todo: ReactNode;
    overlay: ReactNode;
  };
  placeholder?: string;
  inputOverlay?: ReactNode;
  questionHeader?: ReactNode;
  footer?: ReactNode;
  submitControl?: ReactNode;
  modelDisabled?: boolean;
  onModelCloseAutoFocus?: () => void;
  onTextareaFocus?: FocusEventHandler<HTMLTextAreaElement>;
  onTextareaKeyDown?: KeyboardEventHandler<HTMLTextAreaElement>;
  onCursorPositionChange?: (position: number) => void;
  blurOnSubmitTouch?: boolean;
  className?: string;
};

export type ChatComposerHandle = {
  focus: () => void;
  setSelectionRange: (start: number, end: number) => void;
  addTextAttachment: (text: string, filename?: string) => void;
  addTextAttachments: (attachments: TextAttachment[]) => void;
  addImageAttachments: (attachments: ImageAttachment[]) => void;
};

function toSubmitImages(
  images: ImageAttachment[],
): ChatComposerSubmit["images"] {
  return images.map((image) => ({
    mediaType: image.mediaType,
    url: image.dataUrl,
    ...(image.filename ? { filename: image.filename } : {}),
  }));
}

function toSubmitTextAttachments(
  textAttachments: TextAttachment[],
): ChatComposerSubmit["textAttachments"] {
  return textAttachments.map((attachment) => ({
    filename: attachment.filename,
    content: attachment.content,
  }));
}

function getPlaceholder(mode: ChatComposerMode, placeholder?: string): string {
  if (placeholder) return placeholder;
  return mode === "page" ? "Ask about this page" : "Ask Viben";
}

function getSubmitErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export const ChatComposer = forwardRef<ChatComposerHandle, ChatComposerProps>(
  function ChatComposer(
    {
      mode,
      density,
      modelId,
      modelOptions,
      contextUsage,
      status,
      disabled = false,
      initialDraft = "",
      draft: controlledDraft,
      onDraftChange,
      onModelChange,
      onSubmit,
      onStop,
      workExtensions,
      placeholder,
      inputOverlay,
      questionHeader,
      footer,
      submitControl,
      modelDisabled = false,
      onModelCloseAutoFocus,
      onTextareaFocus,
      onTextareaKeyDown,
      onCursorPositionChange,
      blurOnSubmitTouch = false,
      className,
    },
    ref,
  ) {
  const [uncontrolledDraft, setUncontrolledDraft] = useState(initialDraft);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const {
    images,
    addImage,
    addImages,
    removeImage,
    clearImages,
    fileInputRef,
    openFilePicker,
    addImageAttachments,
  } = useImageAttachments();
  const {
    textAttachments,
    addTextAttachment,
    removeTextAttachment,
    clearTextAttachments,
    addTextAttachments,
  } = useTextAttachments();
  const {
    state: recordingState,
    error: recordingError,
    clearError: clearRecordingError,
    toggleRecording,
  } = useAudioRecording();
  const draft = controlledDraft ?? uncontrolledDraft;
  const setDraft = useCallback(
    (nextDraft: string | ((currentDraft: string) => string)) => {
      const resolvedDraft =
        typeof nextDraft === "function" ? nextDraft(draft) : nextDraft;
      if (controlledDraft === undefined) {
        setUncontrolledDraft(resolvedDraft);
      }
      onDraftChange?.(resolvedDraft);
    },
    [controlledDraft, draft, onDraftChange],
  );

  useImperativeHandle(
    ref,
    () => ({
      focus: () => {
        inputRef.current?.focus();
      },
      setSelectionRange: (start, end) => {
        inputRef.current?.setSelectionRange(start, end);
      },
      addTextAttachment: (text, filename) => {
        addTextAttachment(text, filename);
      },
      addTextAttachments,
      addImageAttachments,
    }),
    [addImageAttachments, addTextAttachment, addTextAttachments],
  );

  const inFlight = status === "submitted" || status === "streaming";
  const controlsDisabled = disabled || inFlight;
  const canSubmit =
    !controlsDisabled &&
    (draft.trim().length > 0 ||
      images.length > 0 ||
      textAttachments.length > 0);

  const handleMicClick = useCallback(async () => {
    clearRecordingError();
    const transcribedText = await toggleRecording();
    if (transcribedText) {
      setDraft((current) =>
        current ? `${current} ${transcribedText}` : transcribedText,
      );
      inputRef.current?.focus();
    }
  }, [clearRecordingError, toggleRecording]);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!canSubmit) return;

      const submittedDraft = draft;
      const submittedImages = images;
      const submittedTextAttachments = textAttachments;
      const payload: ChatComposerSubmit = {
        text: submittedDraft,
        images: toSubmitImages(submittedImages),
        textAttachments: toSubmitTextAttachments(submittedTextAttachments),
        modelId,
      };

      setSubmitError(null);
      setDraft("");
      clearImages();
      clearTextAttachments();

      try {
        await onSubmit(payload);
      } catch (error) {
        setDraft(submittedDraft);
        addImageAttachments(submittedImages);
        addTextAttachments(submittedTextAttachments);
        setSubmitError(getSubmitErrorMessage(error));
      }
    },
    [
      addImageAttachments,
      addTextAttachments,
      canSubmit,
      clearImages,
      clearTextAttachments,
      draft,
      images,
      modelId,
      onSubmit,
      textAttachments,
    ],
  );

  const defaultSubmitControl = inFlight ? (
    <Button
      type="button"
      size="icon"
      aria-label="Stop generating"
      onClick={onStop}
      className="h-8 w-8 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
      style={{ touchAction: "manipulation" }}
    >
      <Square className="h-3 w-3 fill-current" />
    </Button>
  ) : undefined;

  return (
    <div
      className={cn(
        "shrink-0",
        density === "compact" ? "px-2 pb-2" : "px-3 pb-3",
        className,
      )}
    >
      <div className="relative">
        {mode === "work" ? workExtensions?.overlay : null}
        {mode === "work" ? workExtensions?.todo : null}
        <AssistantPromptComposer
          inputRef={inputRef}
          fileInputRef={fileInputRef}
          value={draft}
          onValueChange={(value) => {
            setDraft(value);
            setSubmitError(null);
          }}
          onSubmit={handleSubmit}
          placeholder={getPlaceholder(mode, placeholder)}
          images={images}
          textAttachments={textAttachments}
          onRemoveImage={removeImage}
          onRemoveTextAttachment={removeTextAttachment}
          onAddImage={addImage}
          onAddImages={addImages}
          onAddLargeText={(text) => {
            addTextAttachment(text);
            setSubmitError(null);
          }}
          onOpenFilePicker={openFilePicker}
          modelId={modelId}
          modelOptions={modelOptions}
          onModelChange={(nextModelId) => {
            void onModelChange(nextModelId);
          }}
          onModelCloseAutoFocus={onModelCloseAutoFocus}
          modelDisabled={modelDisabled || inFlight}
          recordingState={recordingState}
          onMicClick={() => {
            void handleMicClick();
          }}
          disabled={disabled}
          submitting={false}
          canSubmit={canSubmit}
          labels={{
            attachFiles: "Attach files",
            voiceInput: "Voice input",
            sendMessage: "Send message",
          }}
          leadingToolbarContent={contextUsage}
          inputOverlay={inputOverlay}
          questionHeader={questionHeader}
          footer={footer}
          submitControl={submitControl ?? defaultSubmitControl}
          onTextareaFocus={onTextareaFocus}
          onTextareaKeyDown={onTextareaKeyDown}
          onCursorPositionChange={onCursorPositionChange}
          blurOnSubmitTouch={blurOnSubmitTouch}
        />
        {(submitError || recordingError) && (
          <p className="mt-2 text-sm text-destructive">
            {submitError ?? recordingError}
          </p>
        )}
      </div>
    </div>
  );
});
