/**
 * Unified Chat Input Component
 *
 * A flexible chat input that supports multiple configurations via props.
 * All scenarios use the same base input with feature props controlling extras.
 *
 * Base functionality (always present):
 * - Auto-resizing textarea (40-200px)
 * - Attachment preview area
 * - Bottom action bar with add button and send button
 * - IME composition handling
 * - Paste image support
 *
 * Features controlled by props:
 * - showTopToolbar: Emoji, File, Screenshot, Expand buttons above textarea
 * - showConfigBar: Agent, Model, Tools, Skills, Context selectors (replaces basic bottom bar)
 * - showResizeHandle: Draggable height adjustment
 * - enableWritingMode: Fullscreen writing mode
 */

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
  Smile,
  Camera,
  Maximize2,
  Bot,
  Cpu,
  Wrench,
  Sparkles,
  ChevronDown,
  Check,
  EyeOff,
  Terminal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { EmojiPicker } from "./emoji-picker";
import {
  ToolsConfigPopover,
  type ToolConfig,
} from "./tools-config-popover";
import {
  SkillsConfigPopover,
  type SkillConfig,
} from "./skills-config-popover";
import {
  ContextDetailsPopover,
  type ContextTokenBreakdown,
} from "./context-details-popover";
import { useScreenshot } from "@/hooks/use-screenshot";
import { useChatConfig } from "@/hooks/use-chat-config";
import type { MessageAttachment, BaseCodingAgent, AgentTypeInfo } from "@/types";

// ============================================================================
// Types
// ============================================================================

// Slash command type
export interface SlashCommand {
  id: string;
  name: string;
  description: string;
  icon?: React.ReactNode;
}

export interface ChatInputProps {
  // Basic Props
  onSend: (content: string, attachments?: MessageAttachment[]) => void;
  onCancel?: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;

  // Layout Control
  /** Show top toolbar (emoji, file, screenshot, expand) */
  showTopToolbar?: boolean;
  /** Show bottom config bar (agent, model, tools, skills, context) */
  showConfigBar?: boolean;
  /** Show resize handle for adjustable height */
  showResizeHandle?: boolean;
  /** Enable fullscreen writing mode */
  enableWritingMode?: boolean;

  // Global Config Mode
  /**
   * Use global chat config from useChatConfig hook.
   * When true, agents/models are loaded from global store and
   * visibility is determined by current route context.
   * Props override can still be used for flexibility.
   */
  useGlobalConfig?: boolean;

  // Selector Visibility Override
  /** Force hide agent selector even if showConfigBar is true */
  hideAgentSelector?: boolean;
  /** Force hide model selector even if showConfigBar is true */
  hideModelSelector?: boolean;

  // Agent/Model Selection (for config bar)
  /** Override agents list (takes precedence over global config) */
  agents?: Array<{ id: string; name: string }>;
  selectedAgentId?: string | null;
  onAgentChange?: (agentId: string) => void;
  /** Override models list (takes precedence over global config) */
  models?: Array<{ id: string; name: string; provider?: string }>;
  selectedModelId?: string | null;
  onModelChange?: (modelId: string) => void;
  /** Executor selection (CLAUDE_CODE, CODEX, etc.) */
  executors?: AgentTypeInfo[];
  selectedExecutor?: BaseCodingAgent;
  onExecutorChange?: (executor: BaseCodingAgent) => void;

  // Tools/Skills (for config bar)
  enabledToolsCount?: number;
  enabledSkillsCount?: number;
  onToolsClick?: () => void;
  onSkillsClick?: () => void;
  /** Available tools for tools popover */
  tools?: ToolConfig[];
  /** Callback when tool is toggled */
  onToggleTool?: (toolId: string, enabled: boolean) => void;
  /** Available skills for skills popover */
  skills?: SkillConfig[];
  /** Callback when skill is toggled */
  onToggleSkill?: (skillId: string, enabled: boolean) => void;

  // Context (for config bar)
  contextTokens?: number;
  onContextClick?: () => void;
  /** Context token breakdown for details popover */
  contextBreakdown?: ContextTokenBreakdown;

  // Screenshot (for top toolbar)
  onScreenshot?: (hideWindow?: boolean) => void;

  // Slash Commands
  /** Available slash commands */
  slashCommands?: SlashCommand[];
  /** Callback when a command is selected */
  onSlashCommand?: (command: SlashCommand) => void;
}

// Check if file is an image (by MIME type or file extension)
const isImageFile = (file: File): boolean => {
  if (file.type.startsWith("image/")) {
    return true;
  }
  const ext = file.name.split(".").pop()?.toLowerCase();
  return ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "ico"].includes(ext || "");
};

// Format token count for display
const formatTokens = (tokens: number): string => {
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}k`;
  }
  return tokens.toString();
};

// ============================================================================
// Main Component
// ============================================================================

export function ChatInput({
  onSend,
  onCancel,
  isLoading,
  disabled,
  placeholder,
  className,
  autoFocus = false,
  showTopToolbar = false,
  showConfigBar = false,
  showResizeHandle = false,
  enableWritingMode = false,
  useGlobalConfig = false,
  hideAgentSelector = false,
  hideModelSelector = false,
  agents: propAgents,
  selectedAgentId: propSelectedAgentId,
  onAgentChange: propOnAgentChange,
  models: propModels,
  selectedModelId: propSelectedModelId,
  onModelChange: propOnModelChange,
  executors: _propExecutors,
  selectedExecutor: _propSelectedExecutor,
  onExecutorChange: _propOnExecutorChange,
  enabledToolsCount = 0,
  enabledSkillsCount = 0,
  onToolsClick,
  onSkillsClick,
  tools = [],
  onToggleTool,
  skills = [],
  onToggleSkill,
  contextTokens = 0,
  onContextClick,
  contextBreakdown,
  onScreenshot,
  slashCommands = [],
  onSlashCommand,
}: ChatInputProps) {
  const { t } = useTranslation();

  // Use global chat config hook when enabled
  const chatConfig = useChatConfig();

  // Determine effective agents/models based on props vs global config
  // Props take precedence if provided, otherwise use global config
  const agents = propAgents ?? (useGlobalConfig ? chatConfig.agents : []);
  const models = propModels ?? (useGlobalConfig ? chatConfig.models : []);
  const selectedAgentId = propSelectedAgentId ?? (useGlobalConfig ? chatConfig.selectedAgentId : null);
  const selectedModelId = propSelectedModelId ?? (useGlobalConfig ? chatConfig.selectedModelId : null);
  const onAgentChange = propOnAgentChange ?? (useGlobalConfig ? chatConfig.setSelectedAgentId : undefined);
  const onModelChange = propOnModelChange ?? (useGlobalConfig ? chatConfig.setSelectedModelId : undefined);
  // Executors are NOT auto-loaded from global config - must be passed explicitly
  // This is intentional: workspace chat should NOT show executor selector
  const executors = _propExecutors ?? [];
  const selectedExecutor = _propSelectedExecutor ?? "CLAUDE_CODE";
  const onExecutorChange = _propOnExecutorChange;

  // Determine if selectors should be shown based on global config visibility
  // Only apply visibility rules when useGlobalConfig is true and no prop override
  // Also respect explicit hideAgentSelector/hideModelSelector props
  const shouldShowAgentSelector = !hideAgentSelector && (
    useGlobalConfig && !propAgents
      ? chatConfig.visibility.showAgentSelector
      : true
  );
  const shouldShowModelSelector = !hideModelSelector && (
    useGlobalConfig && !propModels
      ? chatConfig.visibility.showModelSelector
      : true
  );
  const [content, setContent] = React.useState("");
  const [attachments, setAttachments] = React.useState<MessageAttachment[]>([]);
  const [isWritingMode, setIsWritingMode] = React.useState(false);
  const [inputHeight, setInputHeight] = React.useState(80);
  const [isEmojiOpen, setIsEmojiOpen] = React.useState(false);
  const [isToolsOpen, setIsToolsOpen] = React.useState(false);
  const [isSkillsOpen, setIsSkillsOpen] = React.useState(false);
  const [isContextOpen, setIsContextOpen] = React.useState(false);
  // Slash command state
  const [isSlashMenuOpen, setIsSlashMenuOpen] = React.useState(false);
  const [slashQuery, setSlashQuery] = React.useState("");
  const [slashSelectedIndex, setSlashSelectedIndex] = React.useState(0);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const imageInputRef = React.useRef<HTMLInputElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const slashMenuRef = React.useRef<HTMLDivElement>(null);
  // Track IME composition state to prevent send on Enter during composition
  const isComposingRef = React.useRef(false);
  // Track previous isLoading state for auto-focus
  const prevIsLoadingRef = React.useRef(isLoading);
  // Resize drag refs
  const isDraggingRef = React.useRef(false);
  const startYRef = React.useRef(0);
  const startHeightRef = React.useRef(0);

  // Determine if we have toolbar/config bar features enabled
  const hasToolbar = showTopToolbar || showConfigBar || showResizeHandle;

  // Internal screenshot handler using Tauri command
  const { takeScreenshot, isCapturing: isScreenshotCapturing } = useScreenshot({
    onSuccess: (attachment) => {
      setAttachments((prev) => [...prev, attachment]);
    },
    onError: (error) => {
      console.error("[ChatInput] Screenshot failed:", error);
    },
  });

  // Screenshot handler - uses prop if provided, otherwise uses internal handler
  const handleScreenshot = React.useCallback(
    async (hideWindow?: boolean) => {
      if (onScreenshot) {
        // Use external handler if provided
        onScreenshot(hideWindow);
      } else {
        // Use internal Tauri screenshot handler
        await takeScreenshot(hideWindow);
      }
    },
    [onScreenshot, takeScreenshot]
  );

  // Filter slash commands based on query
  const filteredSlashCommands = React.useMemo(() => {
    if (!slashQuery) return slashCommands;
    const query = slashQuery.toLowerCase();
    return slashCommands.filter(
      (cmd) =>
        cmd.name.toLowerCase().includes(query) ||
        cmd.description.toLowerCase().includes(query)
    );
  }, [slashCommands, slashQuery]);

  // Handle content change with slash command detection
  const handleContentChange = React.useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newContent = e.target.value;
      setContent(newContent);

      // Detect slash command (only at start of input)
      if (slashCommands.length > 0 && onSlashCommand) {
        if (newContent.startsWith("/")) {
          const query = newContent.slice(1).split(/\s/)[0]; // Get text after / until first space
          setSlashQuery(query);
          setIsSlashMenuOpen(true);
          setSlashSelectedIndex(0);
        } else {
          setIsSlashMenuOpen(false);
          setSlashQuery("");
        }
      }
    },
    [slashCommands.length, onSlashCommand]
  );

  // Handle slash command selection
  const handleSlashCommandSelect = React.useCallback(
    (command: SlashCommand) => {
      setContent("");
      setIsSlashMenuOpen(false);
      setSlashQuery("");
      onSlashCommand?.(command);
      textareaRef.current?.focus();
    },
    [onSlashCommand]
  );

  // Load saved height from localStorage (only when resize handle is shown)
  React.useEffect(() => {
    if (!showResizeHandle) return;
    const savedHeight = localStorage.getItem("chat_input_height");
    if (savedHeight) {
      const height = parseInt(savedHeight, 10);
      if (height >= 80 && height <= 400) {
        setInputHeight(height);
      }
    }
  }, [showResizeHandle]);

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

  // Auto-resize textarea based on content (only for non-toolbar mode)
  React.useEffect(() => {
    if (hasToolbar && !isWritingMode) return; // Fixed height in toolbar mode

    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = "auto";

    // Calculate the new height (min 40px, max 200px)
    const maxHeight = 200;
    const minHeight = 40;
    const newHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);

    textarea.style.height = `${newHeight}px`;

    // Enable/disable overflow based on content height
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [content, hasToolbar, isWritingMode]);

  // Handle resize drag
  const handleResizeStart = React.useCallback(
    (e: React.MouseEvent) => {
      if (!showResizeHandle) return;
      e.preventDefault();
      isDraggingRef.current = true;
      startYRef.current = e.clientY;
      startHeightRef.current = inputHeight;

      const handleMouseMove = (e: MouseEvent) => {
        if (!isDraggingRef.current) return;
        const delta = startYRef.current - e.clientY;
        const newHeight = Math.min(Math.max(startHeightRef.current + delta, 80), 400);
        setInputHeight(newHeight);
      };

      const handleMouseUp = () => {
        isDraggingRef.current = false;
        localStorage.setItem("chat_input_height", inputHeight.toString());
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [inputHeight, showResizeHandle]
  );

  // Create preview for files with error handling
  const createFilePreview = React.useCallback((file: File): Promise<string> => {
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

        // Add loading attachment
        setAttachments((prev) => [
          ...prev,
          {
            id,
            type: isImage ? "image" : "file",
            name: file.name,
            isLoading: true,
          },
        ]);

        try {
          const data = await createFilePreview(file);
          setAttachments((prev) =>
            prev.map((a) =>
              a.id === id
                ? {
                    ...a,
                    data,
                    mimeType: file.type || (isImage ? "image/png" : "application/octet-stream"),
                    isLoading: false,
                  }
                : a
            )
          );
        } catch (error) {
          console.error("[ChatInput] Failed to read file:", error);
          // Remove failed attachment
          setAttachments((prev) => prev.filter((a) => a.id !== id));
        }
      }
    },
    [createFilePreview]
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
    // Handle slash command navigation
    if (isSlashMenuOpen && filteredSlashCommands.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlashSelectedIndex((prev) =>
          prev < filteredSlashCommands.length - 1 ? prev + 1 : 0
        );
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredSlashCommands.length - 1
        );
        return;
      }
      if (e.key === "Enter" && !e.shiftKey && !isComposingRef.current) {
        e.preventDefault();
        handleSlashCommandSelect(filteredSlashCommands[slashSelectedIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setIsSlashMenuOpen(false);
        setSlashQuery("");
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        handleSlashCommandSelect(filteredSlashCommands[slashSelectedIndex]);
        return;
      }
    }

    // Don't send on Enter during IME composition
    if (e.key === "Enter" && !e.shiftKey && !isComposingRef.current) {
      e.preventDefault();
      handleSend();
    }
    // Exit writing mode with Escape
    if (e.key === "Escape" && isWritingMode) {
      setIsWritingMode(false);
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

  // Insert emoji at cursor position
  const insertEmoji = React.useCallback(
    (emoji: string) => {
      const textarea = textareaRef.current;
      if (!textarea) {
        setContent((prev) => prev + emoji);
        return;
      }

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newContent =
        content.substring(0, start) + emoji + content.substring(end);
      setContent(newContent);

      // Set cursor position after emoji
      requestAnimationFrame(() => {
        if (textarea) {
          const newPosition = start + emoji.length;
          textarea.setSelectionRange(newPosition, newPosition);
          textarea.focus();
        }
      });

      setIsEmojiOpen(false);
    },
    [content]
  );

  // Calculate enabled counts from tools/skills arrays if provided
  const actualToolsCount =
    tools.length > 0 ? tools.filter((t) => t.enabled).length : enabledToolsCount;
  const actualSkillsCount =
    skills.length > 0
      ? skills.filter((s) => s.enabled).length
      : enabledSkillsCount;

  // Default context breakdown if not provided
  const defaultContextBreakdown: ContextTokenBreakdown = contextBreakdown || {
    assistantProfile: 0,
    skillSettings: 0,
    historySummary: 0,
    conversationMessages: contextTokens,
    totalContext: Math.max(contextTokens * 2, 8000),
  };

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);
  const selectedModel = models.find((m) => m.id === selectedModelId);

  // Render fullscreen writing mode
  if (isWritingMode && enableWritingMode) {
    return (
      <>
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
          onClick={() => setIsWritingMode(false)}
        />
        {/* Writing mode container */}
        <div
          ref={containerRef}
          className={cn(
            "fixed inset-4 z-50 flex flex-col bg-background rounded-xl border border-border shadow-2xl",
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

          {/* Top: Toolbar + Close button */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
            <div className="flex items-center gap-1">
              {/* Emoji */}
              <Popover open={isEmojiOpen} onOpenChange={setIsEmojiOpen}>
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <PopoverTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 w-9 p-0"
                          disabled={isLoading || disabled}
                        >
                          <Smile className="h-5 w-5" />
                        </Button>
                      </PopoverTrigger>
                    </TooltipTrigger>
                    <TooltipContent>{t("chat.emoji", "Emoji")}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <PopoverContent className="w-auto p-2" align="start">
                  <EmojiPicker onSelect={insertEmoji} />
                </PopoverContent>
              </Popover>

              {/* File */}
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 w-9 p-0"
                      disabled={isLoading || disabled}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Paperclip className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("chat.attachFile", "Attach File")}</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Screenshot */}
              <DropdownMenu>
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 px-2 gap-1"
                          disabled={isLoading || disabled || isScreenshotCapturing}
                        >
                          {isScreenshotCapturing ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : (
                            <Camera className="h-5 w-5" />
                          )}
                          <ChevronDown className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent>{t("chat.screenshot", "Screenshot")}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => handleScreenshot()}>
                    <Camera className="h-4 w-4 mr-2" />
                    {t("chat.screenshotDirect", "Direct Screenshot")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleScreenshot(true)}>
                    <EyeOff className="h-4 w-4 mr-2" />
                    {t("chat.screenshotHideWindow", "Hide Window & Screenshot")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Close button */}
            <Button
              variant="ghost"
              size="sm"
              className="h-9 w-9 p-0"
              onClick={() => setIsWritingMode(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Attachment Preview */}
          {attachments.length > 0 && (
            <div className="px-4 py-3 border-b border-border/30 flex flex-wrap gap-2">
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
                    onClick={() => removeAttachment(attachment.id)}
                    className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Middle: Large textarea */}
          <div className="flex-1 p-4 min-h-0">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleContentChange}
              onKeyDown={handleKeyDown}
              onCompositionStart={handleCompositionStart}
              onCompositionEnd={handleCompositionEnd}
              onPaste={handlePaste}
              placeholder={placeholder || t("chat.inputPlaceholder")}
              className="w-full h-full resize-none border-0 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none text-lg leading-relaxed"
              disabled={isLoading || disabled}
              autoFocus
            />
          </div>

          {/* Bottom: Config bar or simple send button */}
          {showConfigBar ? (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border/50 bg-muted/30">
              <div className="flex items-center gap-2">
                {/* Agent Selector */}
                {shouldShowAgentSelector && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 px-3 gap-1.5"
                        disabled={isLoading || disabled}
                      >
                        <Bot className="h-4 w-4" />
                        <span className="max-w-[100px] truncate">
                          {selectedAgent?.name || t("chat.selectAgent", "Agent")}
                        </span>
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-48 p-1" align="start">
                      {agents.length === 0 ? (
                        <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                          {t("chat.noAgents", "No agents")}
                        </div>
                      ) : (
                        agents.map((agent) => (
                          <Button
                            key={agent.id}
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start gap-2 h-8"
                            onClick={() => onAgentChange?.(agent.id)}
                          >
                            {agent.id === selectedAgentId && <Check className="h-3.5 w-3.5" />}
                            <span className={agent.id !== selectedAgentId ? "ml-5" : ""}>
                              {agent.name}
                            </span>
                          </Button>
                        ))
                      )}
                    </PopoverContent>
                  </Popover>
                )}

                {/* Model Selector */}
                {shouldShowModelSelector && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 px-3 gap-1.5"
                        disabled={isLoading || disabled}
                      >
                        <Cpu className="h-4 w-4" />
                        <span className="max-w-[100px] truncate">
                          {selectedModel?.name || t("chat.selectModel", "Model")}
                        </span>
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-1" align="start">
                      {models.length === 0 ? (
                        <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                          {t("chat.noModels", "No models")}
                        </div>
                      ) : (
                        models.map((model) => (
                          <Button
                            key={model.id}
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start gap-2 h-8"
                            onClick={() => onModelChange?.(model.id)}
                          >
                            {model.id === selectedModelId && <Check className="h-3.5 w-3.5" />}
                            <span className={model.id !== selectedModelId ? "ml-5" : ""}>
                              {model.name}
                            </span>
                          </Button>
                        ))
                      )}
                    </PopoverContent>
                  </Popover>
                )}
              </div>

              {/* Send/Stop Button */}
              <div className="flex items-center gap-2">
                {isLoading ? (
                  <Button size="sm" variant="destructive" className="h-9 px-4" onClick={onCancel}>
                    <Square className="h-4 w-4 mr-2" />
                    {t("common.stop", "Stop")}
                  </Button>
                ) : (
                  <Button size="sm" className="h-9 px-4" disabled={!canSubmit} onClick={handleSend}>
                    <Send className="h-4 w-4 mr-2" />
                    {t("chat.send", "Send")}
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-end px-4 py-3 border-t border-border/50">
              {isLoading ? (
                <Button size="sm" variant="destructive" className="h-9 px-4" onClick={onCancel}>
                  <Square className="h-4 w-4 mr-2" />
                  {t("common.stop", "Stop")}
                </Button>
              ) : (
                <Button size="sm" className="h-9 px-4" disabled={!canSubmit} onClick={handleSend}>
                  <Send className="h-4 w-4 mr-2" />
                  {t("chat.send", "Send")}
                </Button>
              )}
            </div>
          )}
        </div>
      </>
    );
  }

  // Render unified input (with optional toolbar/config bar)
  return (
    <div
      ref={containerRef}
      className={cn(
        "w-full bg-background overflow-hidden",
        // Only use card style when NOT in workspace mode (no toolbar/configbar)
        !hasToolbar && "rounded-2xl border border-border/50 shadow-lg",
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

      {/* Resize handle */}
      {showResizeHandle && (
        <div
          className="h-1 cursor-ns-resize hover:bg-primary/20 transition-colors"
          onMouseDown={handleResizeStart}
        />
      )}

      {/* Top Toolbar */}
      {showTopToolbar && (
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/30 bg-muted/30">
          <div className="flex items-center gap-1">
            {/* Emoji */}
            <Popover open={isEmojiOpen} onOpenChange={setIsEmojiOpen}>
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        disabled={isLoading || disabled}
                      >
                        <Smile className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                  </TooltipTrigger>
                  <TooltipContent>{t("chat.emoji", "Emoji")}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <PopoverContent className="w-auto p-2" align="start">
                <EmojiPicker onSelect={insertEmoji} />
              </PopoverContent>
            </Popover>

            {/* File */}
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    disabled={isLoading || disabled}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("chat.attachFile", "Attach File")}</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Screenshot with dropdown */}
            <DropdownMenu>
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 gap-1"
                        disabled={isLoading || disabled || isScreenshotCapturing}
                      >
                        {isScreenshotCapturing ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Camera className="h-4 w-4" />
                        )}
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent>{t("chat.screenshot", "Screenshot")}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => handleScreenshot()}>
                  <Camera className="h-4 w-4 mr-2" />
                  {t("chat.screenshotDirect", "Direct Screenshot")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleScreenshot(true)}>
                  <EyeOff className="h-4 w-4 mr-2" />
                  {t("chat.screenshotHideWindow", "Hide Window & Screenshot")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Expand button */}
          {enableWritingMode && (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => setIsWritingMode(true)}
                  >
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("chat.expand", "Expand")}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      )}

      {/* Attachment Preview */}
      {attachments.length > 0 && (
        <div className="px-3 py-2 border-b border-border/30 flex flex-wrap gap-2">
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
                onClick={() => removeAttachment(attachment.id)}
                className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Textarea with Slash Command Menu */}
      <div
        className={cn("px-3 relative", !hasToolbar && "py-3")}
        style={hasToolbar ? { height: inputHeight } : undefined}
      >
        {/* Slash Command Menu */}
        {isSlashMenuOpen && filteredSlashCommands.length > 0 && (
          <div
            ref={slashMenuRef}
            className="absolute left-3 right-3 bottom-full mb-1 z-50 rounded-lg border border-border bg-popover shadow-lg overflow-hidden"
          >
            <div className="py-1 max-h-64 overflow-y-auto">
              {filteredSlashCommands.map((command, index) => (
                <button
                  key={command.id}
                  type="button"
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-colors",
                    index === slashSelectedIndex
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-muted/50"
                  )}
                  onClick={() => handleSlashCommandSelect(command)}
                  onMouseEnter={() => setSlashSelectedIndex(index)}
                >
                  {command.icon && (
                    <span className="shrink-0 text-muted-foreground">
                      {command.icon}
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">
                      /{command.name}
                      {slashQuery && (
                        <span className="text-muted-foreground font-normal">
                          {/* Highlight matching text */}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {command.description}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* No commands found message */}
        {isSlashMenuOpen && filteredSlashCommands.length === 0 && slashQuery && (
          <div className="absolute left-3 right-3 bottom-full mb-1 z-50 rounded-lg border border-border bg-popover shadow-lg p-3">
            <div className="text-sm text-muted-foreground text-center">
              {t("chat.noCommandsFound", "No commands found")}
            </div>
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleContentChange}
          onKeyDown={handleKeyDown}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          onPaste={handlePaste}
          placeholder={placeholder || t("chat.inputPlaceholder")}
          className={cn(
            "w-full resize-none border-0 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none",
            hasToolbar ? "h-full py-3 text-base" : "text-base"
          )}
          style={
            !hasToolbar
              ? {
                  minHeight: "40px",
                  maxHeight: "200px",
                  overflowY: "hidden",
                }
              : undefined
          }
          rows={1}
          disabled={isLoading || disabled}
        />
      </div>

      {/* Bottom Config Bar (when enabled) */}
      {showConfigBar && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-border/30 bg-muted/30">
          <div className="flex items-center gap-1">
            {/* Agent Selector - conditionally shown based on visibility */}
            {shouldShowAgentSelector && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 gap-1.5 text-xs"
                    disabled={isLoading || disabled}
                  >
                    <Bot className="h-3.5 w-3.5" />
                    <span className="max-w-[80px] truncate">
                      {selectedAgent?.name || t("chat.selectAgent", "Agent")}
                    </span>
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-1" align="start">
                  {agents.length === 0 ? (
                    <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                      {t("chat.noAgents", "No agents")}
                    </div>
                  ) : (
                    agents.map((agent) => (
                      <Button
                        key={agent.id}
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start gap-2 h-8"
                        onClick={() => onAgentChange?.(agent.id)}
                      >
                        {agent.id === selectedAgentId && <Check className="h-3.5 w-3.5" />}
                        <span className={agent.id !== selectedAgentId ? "ml-5" : ""}>
                          {agent.name}
                        </span>
                      </Button>
                    ))
                  )}
                </PopoverContent>
              </Popover>
            )}

            {/* Model Selector - conditionally shown based on visibility */}
            {shouldShowModelSelector && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 gap-1.5 text-xs"
                    disabled={isLoading || disabled}
                  >
                    <Cpu className="h-3.5 w-3.5" />
                    <span className="max-w-[80px] truncate">
                      {selectedModel?.name || t("chat.selectModel", "Model")}
                    </span>
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-1" align="start">
                  {models.length === 0 ? (
                    <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                      {t("chat.noModels", "No models")}
                    </div>
                  ) : (
                    models.map((model) => (
                      <Button
                        key={model.id}
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start gap-2 h-8"
                        onClick={() => onModelChange?.(model.id)}
                      >
                        {model.id === selectedModelId && <Check className="h-3.5 w-3.5" />}
                        <span className={model.id !== selectedModelId ? "ml-5" : ""}>
                          {model.name}
                          {model.provider && (
                            <span className="text-muted-foreground ml-1">({model.provider})</span>
                          )}
                        </span>
                      </Button>
                    ))
                  )}
                </PopoverContent>
              </Popover>
            )}

            {/* Executor Selector (CLAUDE_CODE, CODEX, etc.) */}
            {executors.length > 0 && onExecutorChange && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 gap-1.5 text-xs"
                    disabled={isLoading || disabled}
                  >
                    <Terminal className="h-3.5 w-3.5" />
                    <span className="max-w-[80px] truncate">
                      {executors.find((e) => e.id === selectedExecutor)?.name || t("chat.selectExecutor", "Executor")}
                    </span>
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-1" align="start">
                  {executors.map((executor) => (
                    <Button
                      key={executor.id}
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start gap-2 h-8"
                      onClick={() => onExecutorChange(executor.id)}
                    >
                      {executor.id === selectedExecutor && <Check className="h-3.5 w-3.5" />}
                      <span className={executor.id !== selectedExecutor ? "ml-5" : ""}>
                        {executor.name}
                      </span>
                    </Button>
                  ))}
                </PopoverContent>
              </Popover>
            )}

            {/* Tools - icon only with badge */}
            {tools.length > 0 && onToggleTool ? (
              <Popover open={isToolsOpen} onOpenChange={setIsToolsOpen}>
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <PopoverTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 relative"
                          disabled={isLoading || disabled}
                        >
                          <Wrench className="h-4 w-4" />
                          {actualToolsCount > 0 && (
                            <Badge
                              variant="secondary"
                              className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px]"
                            >
                              {actualToolsCount}
                            </Badge>
                          )}
                        </Button>
                      </PopoverTrigger>
                    </TooltipTrigger>
                    <TooltipContent>{t("chat.configureTools", "Configure tools")}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <PopoverContent className="w-auto p-3" align="start">
                  <ToolsConfigPopover tools={tools} onToggleTool={onToggleTool} />
                </PopoverContent>
              </Popover>
            ) : (
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 relative"
                      disabled={isLoading || disabled}
                      onClick={onToolsClick}
                    >
                      <Wrench className="h-4 w-4" />
                      {actualToolsCount > 0 && (
                        <Badge
                          variant="secondary"
                          className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px]"
                        >
                          {actualToolsCount}
                        </Badge>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("chat.configureTools", "Configure tools")}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Skills - icon only with badge */}
            {skills.length > 0 && onToggleSkill ? (
              <Popover open={isSkillsOpen} onOpenChange={setIsSkillsOpen}>
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <PopoverTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 relative"
                          disabled={isLoading || disabled}
                        >
                          <Sparkles className="h-4 w-4" />
                          {actualSkillsCount > 0 && (
                            <Badge
                              variant="secondary"
                              className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px]"
                            >
                              {actualSkillsCount}
                            </Badge>
                          )}
                        </Button>
                      </PopoverTrigger>
                    </TooltipTrigger>
                    <TooltipContent>{t("chat.configureSkills", "Configure skills")}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <PopoverContent className="w-auto p-3" align="start">
                  <SkillsConfigPopover skills={skills} onToggleSkill={onToggleSkill} />
                </PopoverContent>
              </Popover>
            ) : (
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 relative"
                      disabled={isLoading || disabled}
                      onClick={onSkillsClick}
                    >
                      <Sparkles className="h-4 w-4" />
                      {actualSkillsCount > 0 && (
                        <Badge
                          variant="secondary"
                          className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px]"
                        >
                          {actualSkillsCount}
                        </Badge>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("chat.configureSkills", "Configure skills")}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Context Tokens - icon + number only */}
            <Popover open={isContextOpen} onOpenChange={setIsContextOpen}>
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 gap-1 text-xs"
                        disabled={isLoading || disabled}
                        onClick={onContextClick ? () => onContextClick() : undefined}
                      >
                        <FileText className="h-4 w-4" />
                        <span>{formatTokens(contextTokens)}</span>
                      </Button>
                    </PopoverTrigger>
                  </TooltipTrigger>
                  <TooltipContent>{t("chat.contextDetails", "Context details")}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <PopoverContent className="w-auto p-3" align="start">
                <ContextDetailsPopover breakdown={defaultContextBreakdown} />
              </PopoverContent>
            </Popover>
          </div>

          {/* Send/Stop Button */}
          <div className="flex items-center gap-1">
            {isLoading ? (
              <Button size="sm" variant="destructive" className="h-8 w-8 p-0" onClick={onCancel}>
                <Square className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button size="sm" className="h-8 w-8 p-0" disabled={!canSubmit} onClick={handleSend}>
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Bottom Actions (when no config bar) */}
      {!showConfigBar && (
        <div className={cn("flex items-center justify-between px-4", hasToolbar ? "py-2" : "pb-3")}>
          {/* Add Button with Dropdown */}
          <div className="flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger
                disabled={isLoading || disabled}
                className={cn(
                  "flex items-center justify-center transition-colors focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
                  "border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground size-8 rounded-full border"
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
                className="flex size-8 items-center justify-center rounded-full bg-red-500 text-white transition-colors hover:bg-red-600"
              >
                <Square className="size-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSend}
                disabled={!canSubmit}
                className={cn(
                  "flex size-8 items-center justify-center rounded-full transition-all",
                  canSubmit
                    ? "bg-foreground text-background hover:bg-foreground/90 cursor-pointer"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                )}
              >
                <Send className="size-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
