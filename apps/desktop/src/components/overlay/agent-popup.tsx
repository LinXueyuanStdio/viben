import type { ReactElement } from 'react';
import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useVoiceStore } from '@/stores/voice-store';
import { cn } from '@/lib/utils';

const POPUP_CONFIG = {
  maxWidth: 500,
  maxHeight: 400,
  topMargin: 140,
  charsPerFrame: 3,
  catchUpCharsPerFrame: 8,
  lagThreshold: 20,
};

/**
 * Loading 动画组件 - 三个跳动的点
 */
function LoadingDots(): ReactElement {
  return (
    <div className="flex items-center gap-1 py-2">
      <span className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
      <span className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
      <span className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
    </div>
  );
}

/**
 * Agent 弹窗组件
 */
export function AgentPopup(): ReactElement | null {
  const connectionState = useVoiceStore((s) => s.connectionState);
  const agentResponse = useVoiceStore((s) => s.agentResponse);
  const actions = useVoiceStore((s) => s.actions);

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 打字机效果状态
  const [displayedText, setDisplayedText] = useState('');
  const displayedTextRef = useRef('');
  const targetTextRef = useRef('');
  const rafIdRef = useRef<number | null>(null);
  const isAnimatingRef = useRef(false);

  // Loading 状态
  const [isLoading, setIsLoading] = useState(false);
  const lastResponseIdRef = useRef<string | null>(null);

  const isActive = connectionState === 'speaking' || connectionState === 'processing';
  const shouldShow = agentResponse.showPopup && isActive;

  // 检测新回复，管理 loading 状态
  useEffect(() => {
    const currentId = agentResponse.responseId;
    const hasText = agentResponse.text && agentResponse.text.length > 0;

    if (currentId && currentId !== lastResponseIdRef.current) {
      // 新的回复开始
      lastResponseIdRef.current = currentId;

      // 清空之前的内容
      displayedTextRef.current = '';
      targetTextRef.current = '';
      setDisplayedText('');

      // 只有在没有文本时才显示 loading
      setIsLoading(!hasText);
    } else if (hasText && isLoading) {
      // 有文本到达，退出 loading
      setIsLoading(false);
    }
  }, [agentResponse.responseId, agentResponse.text, isLoading]);

  // 打字机动画帧循环 - 只负责前进，不负责重置
  const animationLoop = useCallback(() => {
    if (!isAnimatingRef.current) return;

    const target = targetTextRef.current;
    const displayed = displayedTextRef.current;

    // 还有字符要显示
    if (displayed.length < target.length) {
      const lag = target.length - displayed.length;
      const charsToAdd =
        lag > POPUP_CONFIG.lagThreshold
          ? POPUP_CONFIG.catchUpCharsPerFrame
          : POPUP_CONFIG.charsPerFrame;

      const endIndex = Math.min(displayed.length + charsToAdd, target.length);
      const newDisplayed = target.slice(0, endIndex);
      displayedTextRef.current = newDisplayed;
      setDisplayedText(newDisplayed);
    }

    // 继续动画循环
    rafIdRef.current = requestAnimationFrame(animationLoop);
  }, []);

  // 管理打字机动画的启动和停止
  useEffect(() => {
    if (shouldShow && agentResponse.text && !isLoading) {
      // 更新目标文本
      targetTextRef.current = agentResponse.text;

      // 检查是否需要重置（新回复，而非追加）
      if (!agentResponse.text.startsWith(displayedTextRef.current)) {
        displayedTextRef.current = '';
        setDisplayedText('');
      }

      // 启动动画
      if (!isAnimatingRef.current) {
        isAnimatingRef.current = true;
        rafIdRef.current = requestAnimationFrame(animationLoop);
      }
    } else if (!shouldShow) {
      // 弹窗关闭时停止动画
      isAnimatingRef.current = false;
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    }

    return () => {
      // 清理：确保动画状态一致
      isAnimatingRef.current = false;
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [shouldShow, agentResponse.text, isLoading, animationLoop]);

  // 当不再 active 时，重置状态（但保留 lastResponseIdRef 以便下次比较）
  useEffect(() => {
    if (!isActive) {
      setIsLoading(false);
      displayedTextRef.current = '';
      targetTextRef.current = '';
      setDisplayedText('');
      isAnimatingRef.current = false;
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    }
  }, [isActive]);

  // 点击外部关闭
  useEffect(() => {
    if (!shouldShow) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        actions.hidePopup();
      }
    };

    // 使用 mousedown 而非 click，避免时序问题
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleMouseDown);
    }, 50);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [shouldShow, actions]);

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current && agentResponse.isStreaming) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [displayedText, agentResponse.isStreaming]);

  if (!shouldShow) {
    return null;
  }

  const popup = (
    <div
      ref={containerRef}
      className={cn(
        'fixed z-[9999] left-1/2 -translate-x-1/2',
        'bg-[#1a1a1a]/95 backdrop-blur-sm',
        'rounded-xl shadow-2xl border border-white/10',
        'transition-all duration-300 ease-out',
        'animate-in fade-in slide-in-from-top-2',
      )}
      style={{
        top: POPUP_CONFIG.topMargin,
        maxWidth: POPUP_CONFIG.maxWidth,
        width: '90vw',
        opacity: agentResponse.popupOpacity,
      }}
    >
      <div
        ref={scrollRef}
        className="overflow-y-auto overflow-x-hidden p-5"
        style={{ maxHeight: POPUP_CONFIG.maxHeight, minHeight: 60 }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center">
            <LoadingDots />
          </div>
        ) : (
          <div className="prose prose-invert prose-sm max-w-none">
            <div className="text-white/90 leading-relaxed whitespace-pre-wrap">
              {displayedText}
              {agentResponse.isStreaming && (
                <span className="inline-block w-0.5 h-4 bg-white/80 ml-0.5 animate-pulse align-middle" />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(popup, document.body);
}
