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
  Camera,
  Maximize2,
  X,
  Loader2,
  EyeOff,
  ChevronDown,
  Crosshair,
  AppWindow,
} from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import type { MessageAttachment } from '@viben/chat';
import { cn } from '@/lib/utils';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useUiStore } from '@/stores/ui-store';
import { useWorkspaceStore } from '@/stores';
import { useChatConfigStore } from '@/stores/chat-config-store';
import { useAgentConversation, useChatConfig, useModels } from '@/hooks';
import { filterModelsByExecutor } from '@/lib/executor-constraints';
import { useScreenshot } from '@/hooks/use-screenshot';
import { useVoiceAgent } from '@/hooks/use-voice-agent';
import { getGatewayUrl } from '@/lib/gateway';
import { startBackgroundTask } from '@/lib/gateway/modules/agent-execution';
import { ChatCapsule } from './chat-capsule';

// ============================================================================
// Helpers
// ============================================================================

function getMimeType(ext: string): string {
  const mimeTypes: Record<string, string> = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
    webp: 'image/webp', bmp: 'image/bmp', svg: 'image/svg+xml',
    pdf: 'application/pdf', doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    txt: 'text/plain', md: 'text/markdown', json: 'application/json', csv: 'text/csv',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    xls: 'application/vnd.ms-excel',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ppt: 'application/vnd.ms-powerpoint',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

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
  onCancel,
  onSendBackground,
  workspacePath,
  workspaceName,
  contextProgress,
}: {
  isStreaming: boolean;
  onSend: (content: string, attachments?: MessageAttachment[]) => void;
  onCancel: () => void;
  onSendBackground: (content: string) => void;
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
  // Screenshot hook
  const {
    takeScreenshot,
    startRegionScreenshot,
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

  const canSend = (content.trim().length > 0 || attachments.length > 0) && !isStreaming;

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
    } else {
      onSend(text, currentAttachments);
    }
    setTimeout(() => {
      setIsSendAnimating(false);
      handleClose();
    }, 300);
  }, [content, attachments, backgroundTask, handleClose, onSend, onSendBackground]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey && !isComposingRef.current) {
      e.preventDefault();
      if (canSend) handleSubmit();
    }
  }, [handleClose, handleSubmit, canSend]);

  // Auto-resize textarea
  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, []);

  // ---- Context progress ----
  // contextProgress is now passed as a prop from ChatPopupLayer,
  // estimated from conversation message content length and the selected model's context_window.

  // ---- Toolbar actions (placeholders) ----

  // Simple emoji quick-insert (common emojis inline; full picker can be added later)
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const quickEmojis = ['👍', '❤️', '😊', '🎉', '🔥', '👀', '✅', '💡', '🚀', '🤔', '😂', '🙏'];
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
    try {
      const selected = await open({
        multiple: true,
        filters: [
          { name: t('chat.fileFilter.images'), extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'] },
          { name: t('chat.fileFilter.documents'), extensions: ['pdf', 'doc', 'docx', 'txt', 'md', 'json', 'csv'] },
          { name: t('chat.fileFilter.spreadsheets'), extensions: ['xlsx', 'xls'] },
          { name: t('chat.fileFilter.presentations'), extensions: ['pptx', 'ppt'] },
          { name: t('chat.fileFilter.allFiles'), extensions: ['*'] },
        ],
      });
      if (!selected) return;
      const paths = Array.isArray(selected) ? selected : [selected];

      for (const path of paths) {
        try {
          const { readFile } = await import('@tauri-apps/plugin-fs');
          const fileData = await readFile(path);
          const base64 = btoa(
            new Uint8Array(fileData).reduce((data, byte) => data + String.fromCharCode(byte), ''),
          );
          const ext = path.split('.').pop()?.toLowerCase() || '';
          const mimeType = getMimeType(ext);
          const isImage = mimeType.startsWith('image/');
          const fileName = path.split(/[\\/]/).pop() || 'file';

          const attachment: MessageAttachment = {
            id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            type: isImage ? 'image' : 'file',
            name: fileName,
            data: `data:${mimeType};base64,${base64}`,
            mimeType,
            isLoading: false,
          };
          setAttachments((prev) => [...prev, attachment]);
        } catch (readErr) {
          console.error(`[ChatPopup] Failed to read file ${path}:`, readErr);
        }
      }
    } catch (err) {
      console.error('[ChatPopup] File dialog failed:', err);
    }
  }, [t]);

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
          <PopoverContent className="w-auto p-2 z-[10001]" side="top" align="start">
            <div className="grid grid-cols-6 gap-1">
              {quickEmojis.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleEmojiInsert(emoji)}
                  className="h-8 w-8 flex items-center justify-center rounded hover:bg-muted/80 text-base transition-colors"
                >
                  {emoji}
                </button>
              ))}
            </div>
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
        <DropdownMenu onOpenChange={handleSelectOpenChange}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              disabled={isScreenshotCapturing}
              className={cn(
                'h-7 flex items-center gap-0.5 rounded-full px-1.5',
                'hover:bg-muted/80 transition-colors',
                'text-muted-foreground hover:text-foreground',
                isScreenshotCapturing && 'opacity-50 cursor-not-allowed',
              )}
              title={t('chat.screenshot')}
            >
              {isScreenshotCapturing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Camera className="h-3.5 w-3.5" />
              )}
              <ChevronDown className="h-2.5 w-2.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="z-[10001]">
            <DropdownMenuItem onClick={() => takeScreenshot(false)}>
              <Camera className="h-4 w-4 mr-2" />
              {t('chat.screenshotDirect')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => takeScreenshot(true)}>
              <EyeOff className="h-4 w-4 mr-2" />
              {t('chat.screenshotHideWindow')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => startRegionScreenshot()}>
              <Crosshair className="h-4 w-4 mr-2" />
              {t('chat.screenshotRegion', '区域截图')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={async () => {
              const windows = await listWindows();
              if (windows.length > 0) {
                await takeWindowScreenshot(windows[0].id);
              }
            }}>
              <AppWindow className="h-4 w-4 mr-2" />
              {t('chat.screenshotWindow', '窗口截图')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

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
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 px-3 pt-1 pb-1">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="relative group flex items-center gap-1.5 bg-muted/60 border border-border/40 rounded-lg px-2 py-1 text-xs"
            >
              {att.type === 'image' ? (
                <img
                  src={att.data}
                  alt={att.name}
                  className="h-8 w-8 rounded object-cover"
                />
              ) : (
                <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              )}
              <span className="truncate max-w-[100px] text-muted-foreground">{att.name}</span>
              <button
                type="button"
                onClick={() => handleRemoveAttachment(att.id)}
                className="h-4 w-4 flex items-center justify-center rounded-full bg-muted hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
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
          disabled={chatConfig.agents.length === 0}
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
          disabled={filteredModels.length === 0}
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

        {/* Send / Stop button */}
        {isStreaming ? (
          <button
            type="button"
            onClick={onCancel}
            className={cn(
              'h-8 w-8 flex items-center justify-center rounded-full',
              'bg-destructive text-destructive-foreground',
              'hover:bg-destructive/90 transition-all',
            )}
            title={t('chat.stop')}
          >
            <Square className="h-3.5 w-3.5 fill-current" />
          </button>
        ) : (
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
            title={t('chat.send')}
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        )}
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

export function ChatPopupLayer(): ReactElement {
  const activeWorkspace = useWorkspaceStore((s) => s.getActiveWorkspace());
  const workspacePath = activeWorkspace?.path || '';

  const [lastUserQuery, setLastUserQuery] = useState('');
  const [capsuleVisible, setCapsuleVisible] = useState(false);

  const {
    messages,
    sendMessage,
    isStreaming,
    phase,
    cancel,
  } = useAgentConversation(workspacePath);

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

  const handleCancel = useCallback(() => {
    cancel();
  }, [cancel]);

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
    if (messages.length > 0 && !capsuleVisible) {
      setCapsuleVisible(true);
    }
  }, [messages.length, capsuleVisible]);

  useEffect(() => {
    if (messages.length === 0) {
      setCapsuleVisible(false);
      setLastUserQuery('');
    }
  }, [messages.length]);

  return (
    <>
      <ChatCapsule
        visible={capsuleVisible}
        messages={messages}
        isStreaming={isStreaming}
        phase={phase}
        lastUserQuery={lastUserQuery}
        onCancel={handleCancel}
      />
      <ChatPopup
        isStreaming={isStreaming}
        onSend={handleSend}
        onCancel={handleCancel}
        onSendBackground={handleSendBackground}
        workspacePath={workspacePath}
        workspaceName={activeWorkspace?.name}
        contextProgress={contextProgress}
      />
    </>
  );
}
