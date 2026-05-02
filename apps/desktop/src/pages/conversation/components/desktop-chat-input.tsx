/**
 * Desktop Chat Input Component
 *
 * A wrapper around @viben/chat's ChatInput that provides Tauri-specific
 * implementations for platform features:
 * - Screenshot capture via Tauri invoke
 * - File dialog via @tauri-apps/plugin-dialog
 * - Paste handling (uses default browser handling)
 * - Global config mode (via useChatConfig hook)
 *
 * Usage:
 * ```tsx
 * import { DesktopChatInput } from "@/components/chat";
 *
 * <DesktopChatInput
 *   onSend={handleSend}
 *   showConfigBar
 *   // ... other props from ChatInput
 * />
 *
 * // With global config mode (auto-loads agents/models from store)
 * <DesktopChatInput
 *   onSend={handleSend}
 *   showConfigBar
 *   useGlobalConfig
 * />
 * ```
 */

import React, { useCallback, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ChatInput, type ChatInputProps, type MessageAttachment, type ExecutorOption } from "@viben/chat";
import { openAndReadFiles } from "@/lib/tauri-file-attach";
import { saveScreenshotToTempFile } from "@/hooks/use-screenshot";
import { useChatConfig } from "@/hooks";
import { SandboxToggle } from "./sandbox-toggle";
import { SteeringToggle } from "./steering-toggle";
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
 * Extends ChatInputProps with desktop-specific features:
 * - useGlobalConfig: Automatically loads agents/models from global store
 * - showSandboxToggle: Shows sandbox toggle in config bar
 * Omits platform-specific callbacks as they are implemented internally
 */
export interface DesktopChatInputProps extends Omit<
  ChatInputProps,
  "onScreenshot" | "onOpenFile" | "onPaste"
> {
  /**
   * Use global config mode.
   * When true, agents/models are automatically loaded from the global store
   * via useChatConfig hook. Props can still override the global values.
   */
  useGlobalConfig?: boolean;
  /**
   * Show sandbox toggle in the config bar.
   * When true, displays a toggle for sandbox mode with provider selection.
   */
  showSandboxToggle?: boolean;
  /**
   * Show steering toggle in the config bar.
   * When true, displays a button for editing persistent steering instructions.
   */
  showSteeringToggle?: boolean;
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
  showSteeringToggle = false,
  // Agent/Model props that can be overridden
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
  configBarLeftExtra: propConfigBarLeftExtra,
  ...props
}: DesktopChatInputProps) {
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
        : false;
  const hideModelSelector =
    propHideModelSelector !== undefined
      ? propHideModelSelector
      : useGlobalConfig && !propModels
        ? !chatConfig.visibility.showModelSelector
        : false;

  /**
   * Take a screenshot using Tauri backend
   *
   * @param hideWindow - If true, hides the window before capturing
   * @returns MessageAttachment containing the screenshot, or null on error
   */
  const handleScreenshot = useCallback(
    async (hideWindow?: boolean): Promise<MessageAttachment | null> => {
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

  // Build config bar extra content
  const configBarLeftExtra = useMemo(() => {
    // If custom content provided, use that
    if (propConfigBarLeftExtra) {
      return propConfigBarLeftExtra;
    }
    // Otherwise show built-in toggles
    const extras: React.ReactNode[] = [];
    if (showSandboxToggle) {
      extras.push(<SandboxToggle key="sandbox" />);
    }
    if (showSteeringToggle) {
      extras.push(<SteeringToggle key="steering" />);
    }
    if (extras.length > 0) {
      return <>{extras}</>;
    }
    return undefined;
  }, [propConfigBarLeftExtra, showSandboxToggle, showSteeringToggle]);

  return (
    <ChatInput
      {...props}
      agents={agents}
      selectedAgentId={selectedAgentId}
      onAgentChange={onAgentChange}
      models={models}
      selectedModelId={selectedModelId}
      onModelChange={onModelChange}
      executors={executors}
      selectedExecutor={selectedExecutor}
      onExecutorChange={onExecutorChange}
      hideAgentSelector={hideAgentSelector}
      hideModelSelector={hideModelSelector}
      hideExecutorSelector={propHideExecutorSelector}
      onScreenshot={handleScreenshot}
      onOpenFile={handleOpenFile}
      configBarLeftExtra={configBarLeftExtra}
    />
  );
}

// ============================================================================
// Helpers
// ============================================================================
