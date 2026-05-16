import type { ReactElement } from 'react';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { X, Square } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SubagentSheet } from '@viben/chat';
import type { AgentMessage as ChatAgentMessage } from '@viben/chat';
import i18n from '@/i18n';
import { cn } from '@/lib/utils';
import { DesktopMessageList } from '@/pages/conversation/components/desktop-message-list';
import type { AgentMessage, AgentPhase } from '@/types';

// ============================================================================
// Constants
// ============================================================================

function getThinkingWords(): string[] {
  return [
    i18n.t('chat.capsule.thinking'),
    i18n.t('chat.capsule.vibing'),
    i18n.t('chat.capsule.schlepping'),
    i18n.t('chat.capsule.combobulating'),
    i18n.t('chat.capsule.concocting'),
    i18n.t('chat.capsule.wrangling'),
    i18n.t('chat.capsule.noodling'),
    i18n.t('chat.capsule.percolating'),
    i18n.t('chat.capsule.discombobulating'),
    i18n.t('chat.capsule.skedaddling'),
    i18n.t('chat.capsule.ruminating'),
    i18n.t('chat.capsule.kibbitzing'),
    i18n.t('chat.capsule.zapping'),
    i18n.t('chat.capsule.finagling'),
    i18n.t('chat.capsule.bamboozling'),
    i18n.t('chat.capsule.cogitating'),
    i18n.t('chat.capsule.snorkelating'),
    i18n.t('chat.capsule.recalibrating'),
    i18n.t('chat.capsule.spelunking'),
    i18n.t('chat.capsule.brouhaha'),
  ];
}

// Sliding window random: no repeats within last 5
const _recentWords: string[] = [];
function randomThinkingWord(): string {
  const words = getThinkingWords();
  const available = words.filter(w => !_recentWords.includes(w));
  const pick = available[Math.floor(Math.random() * available.length)];
  _recentWords.push(pick);
  if (_recentWords.length > 5) _recentWords.shift();
  return pick;
}

// ============================================================================
// Types
// ============================================================================

type CapsuleMode = 'idle' | 'thinking' | 'done';

export interface ChatCapsuleProps {
  visible: boolean;
  messages: AgentMessage[];
  isStreaming: boolean;
  phase: AgentPhase;
  lastUserQuery: string;
  onCancel?: () => void;
  onDismiss?: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function ChatCapsule({
  visible,
  messages,
  isStreaming,
  phase,
  lastUserQuery,
  onCancel,
  onDismiss,
}: ChatCapsuleProps): ReactElement | null {
  const [expanded, setExpanded] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [sheetData, setSheetData] = useState<{
    title: string; subagentType?: string; messages: ChatAgentMessage[]
  } | null>(null);
  const msgListRef = useRef<HTMLDivElement>(null);
  const capsuleRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  // Derive capsule mode from phase
  const mode: CapsuleMode = useMemo(() => {
    if (phase === 'running') return isStreaming ? 'thinking' : 'thinking';
    if (phase === 'completed' || phase === 'error') return 'done';
    if (phase === 'awaiting_approval' || phase === 'awaiting_input') return 'thinking';
    return 'idle';
  }, [phase, isStreaming]);

  // Status text derived from messages
  const statusText = useMemo(() => {
    if (mode === 'done') return t('chat.capsule.done');
    if (phase === 'error') return t('chat.capsule.error');
    if (phase === 'awaiting_approval') return t('chat.capsule.awaitingApproval');
    if (phase === 'awaiting_input') return t('chat.capsule.awaitingInput');

    // Find the last tool_use message for tool name display
    const lastTool = [...messages].reverse().find(m => m.type === 'tool_use');
    if (lastTool?.name) return lastTool.name;

    return randomThinkingWord();
  }, [mode, phase, messages, t]);

  // Body content for collapsed view: last assistant text or tool info
  const bodyContent = useMemo(() => {
    if (expanded) return null;

    const lastMsg = [...messages].reverse().find(
      m => m.type === 'text' || m.type === 'tool_use'
    );

    if (!lastMsg) return null;

    if (lastMsg.type === 'text' && lastMsg.content) {
      return { type: 'streaming' as const, content: lastMsg.content };
    }

    if (lastMsg.type === 'tool_use') {
      const inputStr = JSON.stringify(lastMsg.input || {});
      const input = inputStr.length > 200 ? inputStr.slice(0, 200) + '\u2026' : inputStr;
      return { type: 'tool' as const, content: `${lastMsg.name}(${input})` };
    }

    return null;
  }, [messages, expanded]);

  // Auto-scroll expanded message list
  useEffect(() => {
    if (expanded && msgListRef.current) {
      msgListRef.current.scrollTop = msgListRef.current.scrollHeight;
    }
  }, [expanded, messages]);

  // Auto-collapse on done after brief delay
  useEffect(() => {
    if (mode === 'done' && expanded) {
      // Keep expanded, user can collapse manually
    }
  }, [mode, expanded]);

  const handleToggleExpand = useCallback(() => {
    setExpanded(prev => !prev);
  }, []);

  // Click outside to dismiss (but not when interacting with the bottom ChatPopup)
  useEffect(() => {
    if (!visible || !onDismiss) return;
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (capsuleRef.current && !capsuleRef.current.contains(target)) {
        // Don't dismiss when clicking inside the chat popup
        if (target.closest('[data-chat-popup]')) return;
        onDismiss();
      }
    };
    // Delay registration to avoid immediate dismissal from the triggering click
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleMouseDown);
    }, 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [visible, onDismiss]);

  if (!visible) return null;

  const isThinking = mode === 'thinking';
  const isDone = mode === 'done';

  // Top bar center content
  let centerContent: ReactElement;
  if ((isThinking || isDone) && lastUserQuery) {
    centerContent = (
      <div
        className={cn(
          'flex-1 min-w-0',
          'bg-primary/10 rounded-[10px] px-2.5 py-0.5',
          'text-[13px] leading-[1.4] text-foreground',
          'overflow-hidden break-words',
          'transition-[max-height] duration-250 ease-[cubic-bezier(0.4,0,0.2,1)]',
        )}
        style={{
          maxHeight: isHovering ? 'calc(1.4em * 3 + 4px)' : 'calc(1.4em + 4px)',
        }}
      >
        {lastUserQuery}
      </div>
    );
  } else {
    centerContent = (
      <span className="flex-1 min-w-0 text-[13px] leading-[1.4] text-muted-foreground flex items-center">
        <span className="inline-block animate-[statusFadeIn_0.3s_ease_both]" key={statusText}>
          {statusText}
        </span>
      </span>
    );
  }

  // Body area (collapsed view)
  const hasBody = !!bodyContent;
  const bodyMaxH = hasBody
    ? (bodyContent.type === 'streaming' ? '66vh' : 'calc(1.6em * 3 + 16px)')
    : '0';

  const capsule = (
    <>
    <div
      ref={capsuleRef}
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[10000] w-fit pointer-events-auto"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <div
        className={cn(
          'bg-popover border border-border',
          'rounded-[22px] shadow-[0_4px_24px_rgba(0,0,0,0.3)]',
          'overflow-hidden',
          'transition-[max-width,border-radius,box-shadow] duration-[450ms] ease-[cubic-bezier(0.4,0,0.2,1)]',
          'min-w-[200px]',
          'animate-[capsuleSlideIn_0.45s_cubic-bezier(0.4,0,0.2,1)_both]',
          expanded ? 'max-w-[520px]' : 'max-w-[380px]',
        )}
      >
        {/* Top bar - click to toggle expand */}
        <div
          className="flex items-center gap-1.5 px-3.5 py-2 min-h-[32px] cursor-pointer"
          onClick={handleToggleExpand}
        >
          {/* Spinner or Done icon */}
          {isThinking && (
            <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin shrink-0" />
          )}
          {isDone && (
            <div className="w-5 h-5 rounded-full bg-green-500 text-black text-[11px] font-bold flex items-center justify-center shrink-0 animate-[donePopIn_0.3s_cubic-bezier(0.4,0,0.2,1)_both]">
              ✓
            </div>
          )}

          {/* Center content */}
          {centerContent}

          {/* Cancel button (during streaming) */}
          {isStreaming && onCancel && (
            <button
              type="button"
              className="w-6 h-6 rounded-full bg-destructive/10 hover:bg-destructive/20 flex items-center justify-center shrink-0 transition-colors"
              onClick={(e) => { e.stopPropagation(); onCancel(); }}
            >
              <Square className="w-3 h-3 text-destructive" />
            </button>
          )}

          {/* Dismiss button */}
          {onDismiss && (
            <button
              type="button"
              className={cn(
                'w-6 h-6 rounded-full bg-muted hover:bg-accent',
                'flex items-center justify-center shrink-0',
                'transition-colors duration-200',
              )}
              onClick={(e) => { e.stopPropagation(); onDismiss(); }}
            >
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Body (collapsed view: streaming content or tool info) */}
        {!expanded && (
          <div
            className={cn(
              'overflow-hidden',
              'transition-[max-height,padding] duration-[350ms] ease-[cubic-bezier(0.4,0,0.2,1)]',
              hasBody ? 'px-3.5 pb-2.5' : 'px-3.5',
            )}
            style={{ maxHeight: bodyMaxH }}
          >
            {bodyContent?.type === 'streaming' && (
              <div className="text-[13px] leading-[1.6] text-foreground overflow-y-auto max-h-[66vh] scrollbar-thin prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {bodyContent.content}
                </ReactMarkdown>
              </div>
            )}
            {bodyContent?.type === 'tool' && (
              <div className="text-[12px] font-mono text-muted-foreground bg-muted/50 px-2 py-1 rounded-md break-all whitespace-pre-wrap">
                {bodyContent.content}
              </div>
            )}
          </div>
        )}

        {/* Message list (expanded) */}
        <div
          ref={msgListRef}
          className={cn(
            'overflow-hidden',
            'transition-[max-height,padding] duration-[450ms] ease-[cubic-bezier(0.4,0,0.2,1)]',
            expanded ? 'max-h-[60vh] overflow-y-auto px-2 pb-3' : 'max-h-0',
          )}
        >
          {expanded && (
            <DesktopMessageList
              messages={messages}
              isStreaming={isStreaming}
              simpleMode
              maxMessageWidth="100%"
              className="min-h-0"
              toolExpandedInline
              onExpandSubagent={(title, subagentType, msgs) =>
                setSheetData({ title, subagentType, messages: msgs })
              }
            />
          )}
        </div>
      </div>
    </div>
    {sheetData && (
      <SubagentSheet
        open={!!sheetData}
        onClose={() => setSheetData(null)}
        title={sheetData?.title || ""}
        subagentType={sheetData?.subagentType}
        messages={sheetData?.messages || []}
      />
    )}
    </>
  );

  return createPortal(capsule, document.body);
}
