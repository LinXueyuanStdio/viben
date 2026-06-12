/**
 * Desktop Chat Input Component
 *
 * A wrapper around @viben/chat's ChatInput that provides Tauri-specific
 * implementations for platform features:
 * - Screenshot capture via Tauri invoke
 * - File dialog via @tauri-apps/plugin-dialog
 * - Global config mode (via useChatConfig hook)
 *
 * Usage:
 * ```tsx
 * import { DesktopChatInput } from "@/components/chat";
 *
 * <DesktopChatInput
 *   onSend={handleSend}
 *   showTopToolbar
 *   showBottomToolbar
 *   useGlobalConfig
 *   // ... other props from ChatInput
 * />
 * ```
 */

import type { ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import {
  ChatInput,
  ChatInputTopToolbar,
  ChatInputBottomToolbar,
  SingleSelector,
  useChatInput,
  EmojiPicker,
  type ChatInputProps,
  type MessageAttachment,
  type AgentOption,
  type ModelOption,
  type ExecutorOption,
  type SelectorOption,
} from "@viben/chat";
import { openAndReadFiles } from "@/lib/tauri-file-attach";
import { saveScreenshotToTempFile } from "@/hooks/use-screenshot";
import { useChatConfig } from "../hooks/use-chat-config";
import { SandboxToggle } from "./sandbox-toggle";
import type { ExecutorType } from "@viben/core/shared";

// ============================================================================
// Types
// ============================================================================

/**
 * Screenshot result from Tauri backend
 */
interface ScreenshotResult {
  /** Base64 encoded PNG image data (as data URL) */
  data: string;
  /** Width of the captured screenshot */
  width: number;
  /** Height of the captured screenshot */
  height: number;
}

/**
 * Props for DesktopChatInput
 * Extends ChatInputProps with desktop-specific features.
 * Omits platform-specific callbacks as they are implemented internally.
 */
export interface DesktopChatInputProps extends Omit<
  ChatInputProps,
  "onOpenFile" | "onPaste" | "topToolbar" | "bottomToolbar"
> {
  /**
   * Use global config mode.
   * When true, agents/models are automatically loaded from the global store
   * via useChatConfig hook. Props can still override the global values.
   */
  useGlobalConfig?: boolean;

  /**
   * Show sandbox toggle in the bottom toolbar.
   * When true, displays a toggle for sandbox mode with provider selection.
   */
  showSandboxToggle?: boolean;

  // === Agent/Model/Executor Config ===
  /** Available agents for selection */
  agents?: AgentOption[];
  /** Currently selected agent ID */
  selectedAgentId?: string | null;
  /** Callback when agent selection changes */
  onAgentChange?: (agentId: string) => void;
  /** Available models for selection */
  models?: ModelOption[];
  /** Currently selected model ID */
  selectedModelId?: string | null;
  /** Callback when model selection changes */
  onModelChange?: (modelId: string) => void;
  /** Available executors for selection */
  executors?: ExecutorOption[];
  /** Currently selected executor ID */
  selectedExecutor?: string;
  /** Callback when executor selection changes */
  onExecutorChange?: (executorId: string) => void;

  // === Visibility ===
  /** Hide the agent selector */
  hideAgentSelector?: boolean;
  /** Hide the model selector */
  hideModelSelector?: boolean;
  /** Hide the executor selector */
  hideExecutorSelector?: boolean;

  // === Custom Content ===
  /** Extra content to render in the bottom toolbar's left side (after selectors) */
  bottomToolbarLeftExtra?: ReactNode;
  /** Extra actions to render in the top toolbar */
  topToolbarExtraActions?: ReactNode;

  // === Toolbar Customization (override the generated toolbars) ===
  /** Custom top toolbar. If provided, replaces the generated top toolbar. */
  topToolbar?: ReactNode;
  /** Custom bottom toolbar. If provided, replaces the generated bottom toolbar. */
  bottomToolbar?: ReactNode;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Desktop-specific ChatInput wrapper
 *
 * Provides Tauri implementations for:
 * - Screenshot capture (via invoke("take_screenshot"))
 * - File dialog (via @tauri-apps/plugin-dialog)
 * - Global config mode (via useChatConfig hook)
 */
export function DesktopChatInput({
  useGlobalConfig = false,
  showSandboxToggle = false,
  // Agent/Model/Executor props
  agents: propAgents,
  selectedAgentId: propSelectedAgentId,
  onAgentChange: propOnAgentChange,
  models: propModels,
  selectedModelId: propSelectedModelId,
  onModelChange: propOnModelChange,
  executors: propExecutors,
  selectedExecutor: propSelectedExecutor,
  onExecutorChange: propOnExecutorChange,
  // Visibility overrides
  hideAgentSelector: propHideAgentSelector,
  hideModelSelector: propHideModelSelector,
  hideExecutorSelector: propHideExecutorSelector,
  // Custom content
  bottomToolbarLeftExtra,
  topToolbarExtraActions,
  // Toolbar overrides
  topToolbar: customTopToolbar,
  bottomToolbar: customBottomToolbar,
  // ChatInput props
  onSend,
  onCancel,
  isLoading,
  allowSendWhileLoading,
  disabled,
  showTopToolbar = true,
  showBottomToolbar = true,
  ...props
}: DesktopChatInputProps) {
  const { t } = useTranslation();

  // Screenshot capturing state
  const [isScreenshotCapturing, setIsScreenshotCapturing] = useState(false);

  // Get global config if enabled
  const chatConfig = useChatConfig();

  // Merge props with global config (props take precedence)
  const agents = propAgents ?? (useGlobalConfig ? chatConfig.agents : []);
  const models = propModels ?? (useGlobalConfig ? chatConfig.models : []);
  // Convert ExecutorInfo[] to ExecutorOption[] for ChatInput
  const executors: ExecutorOption[] = propExecutors ?? (useGlobalConfig ? chatConfig.executors.map((e) => ({
    id: e.type,
    name: e.name,
    description: e.description,
  })) : []);
  const selectedAgentId = propSelectedAgentId ?? (useGlobalConfig ? chatConfig.selectedAgentId : null);
  const selectedModelId = propSelectedModelId ?? (useGlobalConfig ? chatConfig.selectedModelId : null);
  const selectedExecutor = propSelectedExecutor ?? (useGlobalConfig ? chatConfig.selectedExecutor : "CLAUDE_CODE");
  const onAgentChange = propOnAgentChange ?? (useGlobalConfig ? chatConfig.setSelectedAgentId : undefined);
  const onModelChange = propOnModelChange ?? (useGlobalConfig ? chatConfig.setSelectedModelId : undefined);
  // Wrap the executor change handler to convert string to ExecutorType
  const onExecutorChange = propOnExecutorChange ?? (useGlobalConfig
    ? (executorId: string) => chatConfig.setSelectedExecutor(executorId as ExecutorType)
    : undefined);

  // Determine selector visibility (props override global config visibility)
  // Only apply visibility rules when useGlobalConfig is true and no prop override
  const hideAgentSelector =
    propHideAgentSelector !== undefined
      ? propHideAgentSelector
      : useGlobalConfig && !propAgents
        ? !chatConfig.visibility.showAgentSelector
        : true; // Hide by default when not using global config
  const hideModelSelector =
    propHideModelSelector !== undefined
      ? propHideModelSelector
      : useGlobalConfig && !propModels
        ? !chatConfig.visibility.showModelSelector
        : true; // Hide by default when not using global config
  const hideExecutorSelector =
    propHideExecutorSelector !== undefined
      ? propHideExecutorSelector
      : true; // Hide by default

  /**
   * Take a screenshot using Tauri backend
   *
   * @param hideWindow - If true, hides the window before capturing
   * @returns MessageAttachment containing the screenshot, or null on error
   */
  const handleScreenshot = useCallback(
    async (hideWindow?: boolean): Promise<MessageAttachment | null> => {
      setIsScreenshotCapturing(true);
      try {
        const result = await invoke<ScreenshotResult>("take_screenshot", {
          hideWindow: hideWindow ?? false,
        });

        const fileName = `screenshot-${new Date().toISOString().replace(/[:.]/g, "-")}.png`;

        let filePath: string | undefined;
        try {
          filePath = await saveScreenshotToTempFile(result.data, fileName);
        } catch (err) {
          console.warn("[DesktopChatInput] Failed to save screenshot to temp file:", err);
        }

        const attachment: MessageAttachment = {
          id: `screenshot-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          type: "image",
          name: fileName,
          data: result.data,
          path: filePath,
          mimeType: "image/png",
          isLoading: false,
        };

        return attachment;
      } catch (err) {
        console.error("[DesktopChatInput] Screenshot failed:", err);
        return null;
      } finally {
        setIsScreenshotCapturing(false);
      }
    },
    []
  );

  /**
   * Open file dialog using Tauri plugin
   *
   * @returns Array of MessageAttachment, or null if cancelled/error
   */
  const handleOpenFile = useCallback(async (): Promise<
    MessageAttachment[] | null
  > => {
    return openAndReadFiles();
  }, []);

  // Convert AgentOption[] to SelectorOption[] for SingleSelector
  const agentSelectorOptions: SelectorOption[] = useMemo(
    () =>
      agents.map((agent) => ({
        id: agent.id,
        label: agent.name,
        description: agent.description,
        icon: "icon" in agent ? agent.icon : undefined,
      })),
    [agents]
  );

  // Convert ModelOption[] to SelectorOption[] for SingleSelector
  const modelSelectorOptions: SelectorOption[] = useMemo(
    () =>
      models.map((model) => ({
        id: model.id,
        label: model.name,
        description: model.provider,
        icon: "icon" in model ? model.icon : undefined,
      })),
    [models]
  );

  // Convert ExecutorOption[] to SelectorOption[] for SingleSelector
  const executorSelectorOptions: SelectorOption[] = useMemo(
    () =>
      executors.map((executor) => ({
        id: executor.id,
        label: executor.name,
        description: executor.description,
        icon: executor.icon,
      })),
    [executors]
  );

  // Build bottom toolbar left content with selectors
  const bottomToolbarLeftContent = useMemo(() => {
    return (
      <div className="flex items-center gap-1">
        {/* Agent Selector */}
        {!hideAgentSelector && agentSelectorOptions.length > 0 && (
          <SingleSelector
            options={agentSelectorOptions}
            value={selectedAgentId}
            onChange={onAgentChange}
            placeholder={t("chat.selectAgent")}
            disabled={isLoading || disabled}
          />
        )}

        {/* Model Selector */}
        {!hideModelSelector && modelSelectorOptions.length > 0 && (
          <SingleSelector
            options={modelSelectorOptions}
            value={selectedModelId}
            onChange={onModelChange}
            placeholder={t("chat.selectModel")}
            disabled={isLoading || disabled}
          />
        )}

        {/* Executor Selector */}
        {!hideExecutorSelector && executorSelectorOptions.length > 0 && (
          <SingleSelector
            options={executorSelectorOptions}
            value={selectedExecutor ?? null}
            onChange={onExecutorChange}
            placeholder={t("chat.selectExecutor")}
            disabled={isLoading || disabled}
          />
        )}

        {/* Sandbox Toggle */}
        {showSandboxToggle && <SandboxToggle />}

        {/* Extra content */}
        {bottomToolbarLeftExtra}
      </div>
    );
  }, [
    hideAgentSelector,
    agentSelectorOptions,
    selectedAgentId,
    onAgentChange,
    hideModelSelector,
    modelSelectorOptions,
    selectedModelId,
    onModelChange,
    hideExecutorSelector,
    executorSelectorOptions,
    selectedExecutor,
    onExecutorChange,
    showSandboxToggle,
    bottomToolbarLeftExtra,
    isLoading,
    disabled,
  ]);

  // Build top toolbar - requires ChatInput context for insertAtCursor
  // We need to wrap this in a component that can access the context
  const topToolbar = useMemo(() => {
    if (customTopToolbar !== undefined) {
      return customTopToolbar;
    }
    // Return a component that will be rendered inside ChatInput context
    return (
      <DesktopChatInputTopToolbar
        onScreenshot={handleScreenshot}
        onOpenFile={handleOpenFile}
        isLoading={isLoading}
        disabled={disabled}
        isScreenshotCapturing={isScreenshotCapturing}
        extraActions={topToolbarExtraActions}
      />
    );
  }, [
    customTopToolbar,
    handleScreenshot,
    handleOpenFile,
    isLoading,
    disabled,
    isScreenshotCapturing,
    topToolbarExtraActions,
  ]);

  // Build bottom toolbar
  const bottomToolbar = useMemo(() => {
    if (customBottomToolbar !== undefined) {
      return customBottomToolbar;
    }
    return (
      <DesktopChatInputBottomToolbar
        leftContent={bottomToolbarLeftContent}
        onCancel={onCancel}
        isLoading={isLoading}
        allowSendWhileLoading={allowSendWhileLoading}
      />
    );
  }, [
    customBottomToolbar,
    bottomToolbarLeftContent,
    onCancel,
    isLoading,
    allowSendWhileLoading,
  ]);

  return (
    <ChatInput
      {...props}
      onSend={onSend}
      onCancel={onCancel}
      isLoading={isLoading}
      allowSendWhileLoading={allowSendWhileLoading}
      disabled={disabled}
      onOpenFile={handleOpenFile}
      showTopToolbar={showTopToolbar}
      showBottomToolbar={showBottomToolbar}
      topToolbar={topToolbar}
      bottomToolbar={bottomToolbar}
    />
  );
}

// ============================================================================
// Internal Sub-components
// ============================================================================

interface DesktopChatInputTopToolbarProps {
  onScreenshot: (hideWindow?: boolean) => Promise<MessageAttachment | null>;
  onOpenFile: () => Promise<MessageAttachment[] | null>;
  isLoading?: boolean;
  disabled?: boolean;
  isScreenshotCapturing?: boolean;
  extraActions?: ReactNode;
}

/**
 * Internal top toolbar component that uses ChatInput context
 */
function DesktopChatInputTopToolbar({
  onScreenshot,
  onOpenFile,
  isLoading,
  disabled,
  isScreenshotCapturing,
  extraActions,
}: DesktopChatInputTopToolbarProps) {
  const { insertAtCursor, addAttachment, handleFileClick } = useChatInput();

  const handleEmojiSelect = useCallback(
    (emoji: string) => {
      insertAtCursor(emoji);
    },
    [insertAtCursor]
  );

  const handleFileClickWithFallback = useCallback(async () => {
    // Use the platform-specific file open if provided
    const attachments = await onOpenFile();
    if (attachments && attachments.length > 0) {
      attachments.forEach((a) => addAttachment(a));
    } else if (handleFileClick) {
      // Fallback to context's handleFileClick (native file input)
      handleFileClick();
    }
  }, [onOpenFile, addAttachment, handleFileClick]);

  const handleScreenshotWithAttachment = useCallback(
    async (hideWindow?: boolean) => {
      const attachment = await onScreenshot(hideWindow);
      if (attachment) {
        addAttachment(attachment);
      }
    },
    [onScreenshot, addAttachment]
  );

  const renderEmojiPicker = useCallback(
    ({ onSelect }: { onSelect: (emoji: string) => void }) => (
      <EmojiPicker onSelect={onSelect} />
    ),
    []
  );

  return (
    <ChatInputTopToolbar
      onEmojiSelect={handleEmojiSelect}
      renderEmojiPicker={renderEmojiPicker}
      onFileClick={handleFileClickWithFallback}
      onScreenshot={handleScreenshotWithAttachment}
      isLoading={isLoading}
      disabled={disabled}
      isScreenshotCapturing={isScreenshotCapturing}
      extraActions={extraActions}
    />
  );
}

interface DesktopChatInputBottomToolbarProps {
  leftContent: ReactNode;
  onCancel?: () => void;
  isLoading?: boolean;
  allowSendWhileLoading?: boolean;
}

/**
 * Internal bottom toolbar component that uses ChatInput context
 */
function DesktopChatInputBottomToolbar({
  leftContent,
  onCancel,
  isLoading,
  allowSendWhileLoading,
}: DesktopChatInputBottomToolbarProps) {
  const { canSubmit, handleSend } = useChatInput();

  return (
    <ChatInputBottomToolbar
      leftContent={leftContent}
      onSend={handleSend}
      onCancel={onCancel}
      isLoading={isLoading}
      canSubmit={canSubmit}
      allowSendWhileLoading={allowSendWhileLoading}
    />
  );
}
