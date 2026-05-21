import type { ReactElement } from 'react';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
  Bot,
  Sparkles,
  Settings2,
  Send,
  Mic,
  MicOff,
  FolderTree,
  ListTodo,
  Square,
  Smile,
  Paperclip,
  Maximize2,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { AttachmentPreview, type MessageAttachment, type SlashCommand, SlashCommandMenu, useSlashCommands } from '@viben/chat';
import { cn } from '@/lib/utils';
import { openAndReadFiles } from '@/lib/tauri-file-attach';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { EmojiTab } from '@/components/ui/icon-picker/tabs/emoji-tab';
import { ScreenshotDropdown } from '@/components/chat/screenshot-dropdown';
import { useUiStore } from '@/stores/ui-store';
import { useWorkspaceStore } from '@/stores';
import { useAppStore } from '@/stores/app-store';
import { useChatConfigStore } from '@/stores/chat-config-store';
import { useAgentConversation, useChatConfig, useModels } from '@/hooks';
import { useSlashCommands as useSlashCommandsDefs } from '@/features/slash-commands';
import type { CommandContext } from '@/features/slash-commands';
import { filterModelsByExecutor } from '@/lib/executor-constraints';
import { useModelAutoCorrect } from '@/hooks/use-model-auto-correct';
import { useScreenshot } from '@/hooks/use-screenshot';
import { useVoiceAgent } from '@/hooks/use-voice-agent';
import { getGatewayUrl } from '@/lib/gateway';
import { startBackgroundTask } from '@/lib/gateway/modules/agent-execution';
import { ChatCapsule } from './chat-capsule';

// ============================================================================
// Helpers
// ============================================================================

// ============================================================================
// Constants
// ============================================================================

const POPUP_CONFIG = {
  triggerHeight: 50,
  triggerWidth: 540,
  maxWidth: 540,
  openDuration: 300,
  closeDuration: 250,
};

type TriggerSource = 'hover' | 'click' | null;

// ============================================================================
// ChatPopup — 底部滑出聊天输入框 (session-player 风格)
// ============================================================================

function ChatPopup({
  isStreaming,
  onSend,
  onSteer,
  onCancel,
  onSendBackground,
  onSlashCommand,
  slashCommands = [],
  workspacePath,
  workspaceName,
  contextProgress,
}: {
  isStreaming: boolean;
  onSend: (content: string, attachments?: MessageAttachment[]) => void;
  onSteer: (message: string) => void;
  onCancel: () => void;
  onSendBackground: (content: string) => void;
  onSlashCommand?: (command: SlashCommand) => void;
  slashCommands?: SlashCommand[];
  workspacePath?: string;
  workspaceName?: string;
  /** Context token usage percentage (0-100), estimated from message content */
  contextProgress: number;
}): ReactElement {
  const { t } = useTranslation();
  const { isChatPopupOpen, closeChatPopup } = useUiStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sendBtnRef = useRef<HTMLButtonElement>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settingsCloseGuardRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isComposingRef = useRef(false);
  const selectOpenRef = useRef(false);
  const textareaFocusedRef = useRef(false);

  const [isOpen, setIsOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [triggerSource, setTriggerSource] = useState<TriggerSource>(null);
  const [content, setContent] = useState('');
  const [worktree, setWorktree] = useState(false);
  const [backgroundTask, setBackgroundTask] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isSendAnimating, setIsSendAnimating] = useState(false);
  const [attachments, setAttachments] = useState<MessageAttachment[]>([]);
  const [steeringQueue, setSteeringQueue] = useState<Array<{ id: string; content: string; attachments?: MessageAttachment[] }>>([]);
  const [steeringExpanded, setSteeringExpanded] = useState(false);
  // Screenshot hook
  const {
    takeScreenshot,
    startRegionScreenshot,
    listMonitors,
    listWindows,
    takeWindowScreenshot,
    isCapturing: isScreenshotCapturing,
  } = useScreenshot({
    onSuccess: (attachment) => {
      setAttachments((prev) => [...prev, attachment]);
    },
    onError: (error) => {
      console.error('[ChatPopup] Screenshot failed:', error);
    },
  });


  // Sandbox config from store
  const { sandboxConfig, setSandboxEnabled } = useChatConfigStore();

  // Workspace-aware agent/model config
  const chatConfig = useChatConfig({ workspacePath, workspaceName });

  // Voice agent
  const voice = useVoiceAgent();

  // Filter models based on selected agent's executor_type
  const selectedAgent = chatConfig.agents.find(
    (a) => a.id === chatConfig.selectedAgentId,
  );
  const filteredModels = useMemo(
    () => filterModelsByExecutor(chatConfig.models, selectedAgent?.executor_type),
    [chatConfig.models, selectedAgent?.executor_type],
  );

  // Auto-correct model selection when agent changes cause filtered list to exclude current model
  useModelAutoCorrect(filteredModels, chatConfig.selectedModelId, chatConfig.setSelectedModelId);

  // Slash command menu (reuses @viben/chat hook)
  const {
    isOpen: slashMenuOpen,
    filteredCommands,
    selectedIndex: slashSelectedIndex,
    handleKeyDown: slashHandleKeyDown,
    handleContentChange: slashHandleContentChange,
    handleSelect: slashHandleSelect,
    query: slashQuery,
  } = useSlashCommands({
    commands: slashCommands,
    onSelect: (cmd) => onSlashCommand?.(cmd),
    enabled: slashCommands.length > 0 && !!onSlashCommand,
  });

  // ---- Lifecycle / open-close ----

  useEffect(() => {
    if (isChatPopupOpen && !isOpen) {
      setIsOpen(true);
      setTriggerSource('click');
      // Double rAF: first frame lets browser paint translate-y-full, second triggers transition
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsVisible(true));
      });
    }
  }, [isChatPopupOpen, isOpen]);

  useEffect(() => {
    if (isVisible && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isVisible]);

  // Clear steering queue when streaming ends
  useEffect(() => {
    if (!isStreaming) {
      setSteeringQueue([]);
      setSteeringExpanded(false);
    }
  }, [isStreaming]);

  const clearCloseTimeout = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }, []);

  const handleClose = useCallback(() => {
    if (selectOpenRef.current || settingsOpen) return;
    clearCloseTimeout();
    if (settingsCloseGuardRef.current) {
      clearTimeout(settingsCloseGuardRef.current);
      settingsCloseGuardRef.current = null;
    }
    setIsVisible(false);
    setTimeout(() => {
      setIsOpen(false);
      setTriggerSource(null);
      closeChatPopup();
    }, POPUP_CONFIG.closeDuration + 50);
  }, [closeChatPopup, clearCloseTimeout, settingsOpen]);

  const scheduleClose = useCallback(() => {
    if (selectOpenRef.current || settingsOpen) return;
    // P0-2: Don't close during settings close protection window
    if (settingsCloseGuardRef.current) return;
    // P0-1: If textarea has content, promote to click behavior (keep open)
    if (content.trim().length > 0) {
      setTriggerSource('click');
      return;
    }
    clearCloseTimeout();
    closeTimeoutRef.current = setTimeout(handleClose, 200);
  }, [handleClose, clearCloseTimeout, settingsOpen, content]);

  const handleTriggerMouseEnter = useCallback(() => {
    clearCloseTimeout();
    if (!isOpen) {
      setIsOpen(true);
      setTriggerSource('hover');
      // Double rAF: first frame lets browser paint translate-y-full, second triggers transition
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsVisible(true));
      });
    }
  }, [isOpen, clearCloseTimeout]);

  const handleTriggerMouseLeave = useCallback(() => {
    if (triggerSource === 'hover') scheduleClose();
  }, [triggerSource, scheduleClose]);

  const handleContentMouseEnter = useCallback(() => {
    clearCloseTimeout();
  }, [clearCloseTimeout]);

  const handleContentMouseLeave = useCallback(() => {
    if (triggerSource === 'hover') {
      scheduleClose();
    }
  }, [triggerSource, scheduleClose]);

  // Click outside close
  useEffect(() => {
    if (!isOpen || triggerSource !== 'click') return;
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.closest('[data-radix-select-viewport]') ||
        target.closest('[data-radix-select-content]') ||
        target.closest('[data-radix-popper-content-wrapper]') ||
        target.closest('[data-radix-menu-content]') ||
        target.closest('[role="listbox"]') ||
        target.closest('[role="option"]') ||
        target.closest('[role="menu"]') ||
        target.closest('[role="menuitem"]') ||
        target.hasAttribute('data-radix-focus-guard')
      ) return;
      if (containerRef.current && !containerRef.current.contains(target)) {
        handleClose();
      }
    };
    const timer = setTimeout(() => document.addEventListener('mousedown', handleMouseDown), 50);
    return () => { clearTimeout(timer); document.removeEventListener('mousedown', handleMouseDown); };
  }, [isOpen, triggerSource, handleClose]);

  const handleSelectOpenChange = useCallback((open: boolean) => {
    selectOpenRef.current = open;
    if (open) clearCloseTimeout();
  }, [clearCloseTimeout]);

  // ---- Input / Send ----

  // Allow sending when there's content — streaming doesn't block input (steering)
  const canSend = content.trim().length > 0 || attachments.length > 0;

  const handleSubmit = useCallback(() => {
    const text = content.trim();
    if (!text && attachments.length === 0) return;
    const currentAttachments = attachments.length > 0 ? [...attachments] : undefined;
    setContent('');
    setAttachments([]);
    // P0-3: Reset textarea height after clearing content
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    // P1-3: Trigger send pulse animation, then close after it finishes
    setIsSendAnimating(true);
    if (backgroundTask) {
      onSendBackground(text);
    } else if (isStreaming) {
      // Steering: inject message while agent is running + add to queue display
      onSteer(text);
      setSteeringQueue((prev) => [
        ...prev,
        { id: `steer-${Date.now()}`, content: text, attachments: currentAttachments },
      ]);
    } else {
      onSend(text, currentAttachments);
    }
    setTimeout(() => {
      setIsSendAnimating(false);
      if (!isStreaming) handleClose();
    }, 300);
  }, [content, attachments, backgroundTask, isStreaming, handleClose, onSend, onSteer, onSendBackground]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Slash command menu handles arrow keys / Enter when open
    if (slashMenuOpen) {
      const handled = slashHandleKeyDown(e);
      if (handled) return;
    }
    if (e.key === 'Escape') {
      handleClose();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey && !isComposingRef.current) {
      e.preventDefault();
      if (canSend) handleSubmit();
    }
  }, [handleClose, handleSubmit, canSend, slashMenuOpen, slashHandleKeyDown]);

  // Auto-resize textarea
  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setContent(value);
    slashHandleContentChange(value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [slashHandleContentChange]);

  // ---- Context progress ----
  // contextProgress is now passed as a prop from ChatPopupLayer,
  // estimated from conversation message content length and the selected model's context_window.

  // ---- Toolbar actions (placeholders) ----

  // Emoji picker (using emoji-mart via EmojiTab)
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const handleEmojiInsert = useCallback((emoji: string) => {
    const ta = textareaRef.current;
    if (ta) {
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const newContent = content.slice(0, start) + emoji + content.slice(end);
      setContent(newContent);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + emoji.length;
        ta.focus();
      });
    } else {
      setContent((prev) => prev + emoji);
    }
    setEmojiPickerOpen(false);
  }, [content]);

  const handleAttachFile = useCallback(async () => {
    const result = await openAndReadFiles();
    if (result) {
      setAttachments((prev) => [...prev, ...result]);
    }
  }, []);

  const handleRemoveAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // Navigate to full conversation page (overlay is outside BrowserRouter, use window.location)
  const activeWorkspaceForNav = useWorkspaceStore((s) => s.getActiveWorkspace());
  const handleNavigateToChat = useCallback(() => {
    const wsId = activeWorkspaceForNav?.id || 'global';
    window.location.pathname = `/workspace/${wsId}/chat`;
    handleClose();
  }, [activeWorkspaceForNav?.id, handleClose]);

  // ---- Render ----

  const trigger = (
    <div
      ref={triggerRef}
      onMouseEnter={handleTriggerMouseEnter}
      onMouseLeave={handleTriggerMouseLeave}
      className="fixed bottom-0 left-1/2 -translate-x-1/2 z-[9998]"
      style={{ width: POPUP_CONFIG.triggerWidth, height: POPUP_CONFIG.triggerHeight }}
    />
  );

  const popup = isOpen ? (
    <div
      ref={containerRef}
      data-chat-popup
      onMouseEnter={handleContentMouseEnter}
      onMouseLeave={handleContentMouseLeave}
      className={cn(
        'fixed z-[10000] bottom-0 left-1/2 -translate-x-1/2',
        'w-[90vw]',
        'bg-popover rounded-t-[18px] rounded-b-none',
        'shadow-[0_-4px_24px_rgba(0,0,0,0.4)]',
        'border border-b-0 border-border/50',
        isVisible ? 'translate-y-0' : 'translate-y-full',
      )}
      style={{
        maxWidth: POPUP_CONFIG.maxWidth,
        transitionProperty: 'translate',
        transitionDuration: isVisible
          ? `${POPUP_CONFIG.openDuration}ms`
          : `${POPUP_CONFIG.closeDuration}ms`,
        transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* Steering queue (shown only when there are queued messages) */}
      {steeringQueue.length > 0 && (
        <div className="px-3 pt-2.5 pb-0">
          <div className="rounded-lg bg-primary/5 border border-primary/20 overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5">
              <Loader2 className="h-3 w-3 animate-spin text-primary shrink-0" />
              <span className="text-xs text-primary font-medium flex-1">
                {t('chat.steeringQueued', '{{count}} queued', { count: steeringQueue.length })}
              </span>
              {steeringQueue.length > 3 && (
                <button
                  type="button"
                  onClick={() => setSteeringExpanded((v) => !v)}
                  className="h-4 w-4 flex items-center justify-center rounded text-primary/70 hover:text-primary transition-colors"
                >
                  {steeringExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
              )}
            </div>
            {/* Messages list */}
            <div className={cn('px-2.5 pb-1.5 space-y-1', !steeringExpanded && 'max-h-[4.5rem] overflow-hidden')}>
              {(steeringExpanded ? steeringQueue : steeringQueue.slice(-3)).map((item) => (
                <div key={item.id} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <span className="shrink-0 text-primary/50 mt-0.5">›</span>
                  <span className="truncate flex-1">{item.content}</span>
                  {item.attachments && item.attachments.length > 0 && (
                    <span className="shrink-0 text-primary/40">[{item.attachments.length}]</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Toolbar (first row) */}
      <div className="flex items-center gap-1 px-3 pt-3 pb-1">
        {/* Emoji quick-picker */}
        <Popover open={emojiPickerOpen} onOpenChange={(open) => {
          setEmojiPickerOpen(open);
          if (open) clearCloseTimeout();
        }}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                'h-7 w-7 flex items-center justify-center rounded-full',
                'hover:bg-muted/80 transition-colors',
                'text-muted-foreground hover:text-foreground',
              )}
              title={t('chat.emoji')}
            >
              <Smile className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 z-[10001]" side="top" align="start">
            <EmojiTab onSelect={handleEmojiInsert} />
          </PopoverContent>
        </Popover>

        {/* Attach file */}
        <button
          type="button"
          onClick={handleAttachFile}
          className={cn(
            'h-7 w-7 flex items-center justify-center rounded-full',
            'hover:bg-muted/80 transition-colors',
            'text-muted-foreground hover:text-foreground',
          )}
          title={t('chat.attachFile')}
        >
          <Paperclip className="h-3.5 w-3.5" />
        </button>

        {/* Screenshot with dropdown */}
        <ScreenshotDropdown
          takeScreenshot={takeScreenshot}
          startRegionScreenshot={startRegionScreenshot}
          listMonitors={listMonitors}
          listWindows={listWindows}
          takeWindowScreenshot={takeWindowScreenshot}
          isCapturing={isScreenshotCapturing}
          onOpenChange={handleSelectOpenChange}
          contentClassName="z-[10001]"
        />

        {/* Spacer */}
        <div className="flex-1" />

        {/* Navigate to conversation page */}
        <button
          type="button"
          onClick={handleNavigateToChat}
          className={cn(
            'h-7 w-7 flex items-center justify-center rounded-full',
            'hover:bg-muted/80 transition-colors',
            'text-muted-foreground hover:text-foreground',
          )}
          title={t('chat.openFullChat')}
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Attachment preview */}
      <AttachmentPreview
        attachments={attachments}
        onRemove={handleRemoveAttachment}
        className="px-3 pt-1 pb-1 border-0"
      />

      {/* Slash command menu */}
      {slashMenuOpen && filteredCommands.length > 0 && (
        <div className="px-4 pb-1">
          <SlashCommandMenu
            commands={filteredCommands}
            selectedIndex={slashSelectedIndex}
            onSelect={slashHandleSelect}
            onHover={() => {}}
            isOpen={slashMenuOpen}
            query={slashQuery}
            className="relative z-[10001]"
          />
        </div>
      )}

      {/* Textarea */}
      <div className="px-4 pt-1 pb-2">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => { isComposingRef.current = true; }}
          onCompositionEnd={() => { setTimeout(() => { isComposingRef.current = false; }, 0); }}
          onFocus={() => { textareaFocusedRef.current = true; }}
          onBlur={() => { textareaFocusedRef.current = false; }}
          placeholder={t('chat.placeholder')}
          rows={1}
          className={cn(
            'w-full resize-none bg-muted/40',
            'border border-border/40 rounded-xl',
            'px-3.5 py-2.5 text-sm leading-relaxed',
            'outline-none transition-colors',
            'focus:border-primary/50',
            'placeholder:text-muted-foreground/40',
            'scrollbar-thin',
          )}
          style={{ maxHeight: 160 }}
        />
        {/* P1-1: Context progress line below textarea (hidden when 0) */}
        {contextProgress > 0 && (
          <div className="mt-1 mx-1">
            <div className="h-0.5 w-full bg-muted/40 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary/60 to-primary/30 transition-all duration-300"
                style={{ width: `${Math.min(contextProgress, 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="flex items-center gap-1.5 px-3 pb-3">
        {/* Agent selector chip (grouped by global / workspace) */}
        <Select
          value={chatConfig.selectedAgentId || ''}
          onValueChange={chatConfig.setSelectedAgentId}
          disabled={chatConfig.agents.length === 0 || isStreaming}
          onOpenChange={handleSelectOpenChange}
        >
          <SelectTrigger className="h-7 w-auto max-w-[120px] bg-muted/50 border-border/30 rounded-full px-2.5 gap-1 text-xs hover:bg-muted/80 transition-colors [&>svg]:h-3 [&>svg]:w-3">
            <Bot className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="truncate">
              {chatConfig.selectedAgent?.name || t('chat.agent')}
            </span>
          </SelectTrigger>
          <SelectContent className="z-[10001]">
            {chatConfig.workspaceAgentGroup.length > 0 && (
              <SelectGroup>
                <SelectLabel className="text-xs text-muted-foreground">
                  {chatConfig.workspaceName || t('chat.workspace')}
                </SelectLabel>
                {chatConfig.workspaceAgentGroup.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    <span className="text-sm">{agent.name}</span>
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
            {chatConfig.globalAgentGroup.length > 0 && (
              <SelectGroup>
                <SelectLabel className="text-xs text-muted-foreground">
                  {t('chat.global')}
                </SelectLabel>
                {chatConfig.globalAgentGroup.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    <span className="text-sm">{agent.name}</span>
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
          </SelectContent>
        </Select>

        {/* Model selector chip (filtered by agent executor_type) */}
        <Select
          value={chatConfig.selectedModelId || ''}
          onValueChange={chatConfig.setSelectedModelId}
          disabled={filteredModels.length === 0 || isStreaming}
          onOpenChange={handleSelectOpenChange}
        >
          <SelectTrigger className="h-7 w-auto max-w-[120px] bg-muted/50 border-border/30 rounded-full px-2.5 gap-1 text-xs hover:bg-muted/80 transition-colors [&>svg]:h-3 [&>svg]:w-3">
            <Sparkles className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="truncate">
              {chatConfig.selectedModel?.name || t('chat.model')}
            </span>
          </SelectTrigger>
          <SelectContent className="z-[10001]">
            {filteredModels.map((model) => (
              <SelectItem key={model.id} value={model.id}>
                <span className="text-sm">{model.name}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Settings popover (sandbox + worktree) */}
        <Popover open={settingsOpen} onOpenChange={(open) => {
          setSettingsOpen(open);
          if (open) {
            clearCloseTimeout();
          } else {
            // P0-2: Guard delay after settings close to prevent immediate popup close
            clearCloseTimeout();
            settingsCloseGuardRef.current = setTimeout(() => {
              settingsCloseGuardRef.current = null;
            }, 300);
          }
        }}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                'h-7 w-7 flex items-center justify-center rounded-full',
                'bg-muted/50 hover:bg-muted/80 transition-colors',
                'text-muted-foreground hover:text-foreground',
              )}
            >
              <Settings2 className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[240px] p-3 z-[10001]"
            side="top"
            align="center"
          >
            <div className="space-y-3">
              {/* Sandbox toggle */}
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="popup-sandbox"
                  className={cn(
                    'text-xs font-medium cursor-pointer transition-colors',
                    sandboxConfig.enabled ? 'text-amber-500' : 'text-muted-foreground',
                  )}
                >
                  {t('chat.sandbox')}
                </Label>
                <Switch
                  id="popup-sandbox"
                  checked={sandboxConfig.enabled}
                  onCheckedChange={setSandboxEnabled}
                  className="data-[state=checked]:bg-amber-500"
                />
              </div>
              {/* Worktree toggle */}
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="popup-worktree"
                  className={cn(
                    'text-xs font-medium cursor-pointer flex items-center gap-1.5 transition-colors',
                    worktree ? 'text-blue-500' : 'text-muted-foreground',
                  )}
                >
                  <FolderTree className="h-3.5 w-3.5" />
                  {t('chat.worktree')}
                </Label>
                <Switch
                  id="popup-worktree"
                  checked={worktree}
                  onCheckedChange={setWorktree}
                  className="data-[state=checked]:bg-blue-500"
                />
              </div>
              {/* Background task toggle */}
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="popup-background-task"
                  className={cn(
                    'text-xs font-medium cursor-pointer flex items-center gap-1.5 transition-colors',
                    backgroundTask ? 'text-green-500' : 'text-muted-foreground',
                  )}
                >
                  <ListTodo className="h-3.5 w-3.5" />
                  {t('chat.backgroundTask.title')}
                </Label>
                <Switch
                  id="popup-background-task"
                  checked={backgroundTask}
                  onCheckedChange={setBackgroundTask}
                  className="data-[state=checked]:bg-green-500"
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Voice input */}
        <button
          type="button"
          onClick={async () => {
            if (voice.isConnected) {
              await voice.disconnect();
            } else {
              await voice.connect();
            }
          }}
          className={cn(
            'h-7 w-7 flex items-center justify-center rounded-full',
            'transition-colors',
            voice.isListening
              ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30 animate-pulse'
              : voice.state === 'connecting'
                ? 'bg-amber-500/20 text-amber-500'
                : 'hover:bg-muted/80 text-muted-foreground hover:text-foreground',
          )}
          title={
            voice.isListening
              ? t('chat.voiceListening')
              : voice.state === 'connecting'
                ? t('chat.voiceConnecting')
                : t('chat.voiceInput')
          }
        >
          {voice.state === 'connecting' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : voice.isConnected ? (
            <MicOff className="h-3.5 w-3.5" />
          ) : (
            <Mic className="h-3.5 w-3.5" />
          )}
        </button>

        {/* Send / Stop buttons */}
        {isStreaming && (
          <button
            type="button"
            onClick={onCancel}
            className={cn(
              'h-7 w-7 flex items-center justify-center rounded-full',
              'bg-destructive text-destructive-foreground',
              'hover:bg-destructive/90 transition-all',
            )}
            title={t('chat.stop')}
          >
            <Square className="h-3 w-3 fill-current" />
          </button>
        )}
        <button
          ref={sendBtnRef}
          type="button"
          onClick={handleSubmit}
          disabled={!canSend}
          className={cn(
            'h-8 w-8 flex items-center justify-center rounded-full',
            'transition-all duration-150',
            canSend
              ? 'bg-primary text-primary-foreground hover:bg-primary/80'
              : 'bg-muted text-muted-foreground cursor-not-allowed',
            isSendAnimating && 'animate-send-pulse',
          )}
          title={isStreaming ? t('chat.steer', 'Steer') : t('chat.send')}
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  ) : null;

  return (
    <>
      {trigger}
      {popup && createPortal(popup, document.body)}
    </>
  );
}

// ============================================================================
// ChatPopupLayer — 编排层，管理共享聊天状态
// ============================================================================

export function ChatPopupLayer(): ReactElement | null {
  const activeWorkspace = useWorkspaceStore((s) => s.getActiveWorkspace());
  const workspacePath = activeWorkspace?.path || '';

  // Hide chat capsule/popup during onboarding
  const onboardingCompleted = useAppStore((s) => s.onboardingCompleted);
  if (!onboardingCompleted) return null;

  const [lastUserQuery, setLastUserQuery] = useState('');
  const [capsuleVisible, setCapsuleVisible] = useState(false);

  const {
    messages,
    sendMessage,
    steerMessage,
    isStreaming,
    phase,
    cancel,
  } = useAgentConversation(workspacePath, {
    agentConfig: { mcp_servers: ["presentation"] },
    useWebSocket: true,
  });

  // Slash commands
  const {
    commands: slashCommands,
    execute: executeSlashCommand,
  } = useSlashCommandsDefs({ workspacePath });

  // Estimate context token usage from message content.
  // The SSE stream does not provide real-time token counts, so we approximate
  // by dividing total character length by 4 (rough chars-per-token heuristic).
  // context_window comes from the Gateway model metadata.
  const { models: vibenModels } = useModels();
  const selectedModelId = useChatConfigStore((s) => s.selectedModelId);

  const contextProgress = useMemo(() => {
    const selectedModel = vibenModels.find((m) => m.id === selectedModelId);
    const contextWindow = selectedModel?.context_window;
    if (!contextWindow || contextWindow <= 0) return 0;

    let totalContentLength = 0;
    for (const msg of messages) {
      if (msg.content) totalContentLength += msg.content.length;
      if (msg.output) totalContentLength += msg.output.length;
    }
    const estimatedTokens = Math.round(totalContentLength / 4);
    return Math.min((estimatedTokens / contextWindow) * 100, 100);
  }, [messages, vibenModels, selectedModelId]);

  const handleSend = useCallback(async (content: string, attachments?: MessageAttachment[]) => {
    setLastUserQuery(content);
    setCapsuleVisible(true);
    await sendMessage(content, attachments);
  }, [sendMessage]);

  const handleSteer = useCallback((message: string) => {
    steerMessage(message);
  }, [steerMessage]);

  const handleSlashCommand = useCallback(async (command: SlashCommand) => {
    const context: CommandContext = {
      messages: messages.map((m) => ({
        role: m.type === "user" ? "user" : "assistant",
        content: typeof m.content === "string" ? m.content : "",
      })),
      clearMessages: () => {},
      sendMessage: (msg: string) => handleSend(msg),
      workspacePath,
      openDialog: () => {},
      showToast: () => {},
      navigate: () => {},
      t: (key: string) => key,
    };
    const result = await executeSlashCommand(command, context);
    if (result?.type === "prompt" && result.prompt) {
      handleSend(result.prompt);
    }
  }, [messages, executeSlashCommand, workspacePath, handleSend]);

  const handleCancel = useCallback(() => {
    cancel();
  }, [cancel]);

  const handleDismissCapsule = useCallback(() => {
    setCapsuleVisible(false);
  }, []);

  const handleSendBackground = useCallback(async (content: string) => {
    try {
      const baseUrl = await getGatewayUrl();
      await startBackgroundTask(baseUrl, {
        prompt: content,
        cwd: workspacePath || undefined,
      });
    } catch (err) {
      console.error('[ChatPopupLayer] Background task failed:', err);
    }
  }, [workspacePath]);

  useEffect(() => {
    if (messages.length === 0) {
      setCapsuleVisible(false);
      setLastUserQuery('');
    }
  }, [messages.length]);

  // Show top trigger zone when capsule is dismissed but messages exist
  const showCapsuleTrigger = !capsuleVisible && messages.length > 0;

  const handleCapsuleTriggerEnter = useCallback(() => {
    setCapsuleVisible(true);
  }, []);

  return (
    <>
      {/* Top-center hover detection zone to bring back dismissed capsule */}
      {showCapsuleTrigger && createPortal(
        <div
          onMouseEnter={handleCapsuleTriggerEnter}
          className="fixed top-0 left-1/2 -translate-x-1/2 z-[9998]"
          style={{ width: 380, height: 40 }}
        />,
        document.body,
      )}
      <ChatCapsule
        visible={capsuleVisible}
        messages={messages}
        isStreaming={isStreaming}
        phase={phase}
        lastUserQuery={lastUserQuery}
        onCancel={handleCancel}
        onDismiss={handleDismissCapsule}
      />
      <ChatPopup
        isStreaming={isStreaming}
        onSend={handleSend}
        onSteer={handleSteer}
        onCancel={handleCancel}
        onSendBackground={handleSendBackground}
        onSlashCommand={handleSlashCommand}
        slashCommands={slashCommands}
        workspacePath={workspacePath}
        workspaceName={activeWorkspace?.name}
        contextProgress={contextProgress}
      />
    </>
  );
}
