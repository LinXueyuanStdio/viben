import type { ReactElement } from 'react';
import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useVoiceStore } from '@/stores/voice-store';
import { cn } from '@/lib/utils';

const POPUP_CONFIG = {
  maxWidth: 500,
  maxHeight: 400,
  topMargin: 140, // 字幕下方
  // 打字机效果配置
  charsPerFrame: 3, // 每帧显示的字符数
  catchUpCharsPerFrame: 8, // 追赶时每帧显示的字符数
  lagThreshold: 20, // 超过这个字符数开始加速追赶
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
 * 使用 DOM 实现，支持流式 Markdown 渲染
 * 通过 React Portal 渲染到 body，保持在 Overlay Canvas 之上
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

  // 跟踪上一次的 responseId 来检测新回复
  const lastResponseIdRef = useRef<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const isActive = connectionState === 'speaking' || connectionState === 'processing';
  // 只要 agent 开始说话就显示弹窗（不再等待字符阈值）
  const shouldShow = agentResponse.showPopup && isActive;

  // 检测新回复，进入 loading 状态
  useEffect(() => {
    const currentId = agentResponse.responseId;

    if (currentId && currentId !== lastResponseIdRef.current) {
      // 新的回复开始
      lastResponseIdRef.current = currentId;

      // 清空之前的内容，进入 loading 状态
      displayedTextRef.current = '';
      targetTextRef.current = '';
      setDisplayedText('');
      setIsLoading(true);
    }

    // 当有文本内容时，退出 loading 状态
    if (agentResponse.text && agentResponse.text.length > 0) {
      setIsLoading(false);
    }
  }, [agentResponse.responseId, agentResponse.text]);

  // 打字机动画帧循环
  const animationLoop = useCallback(() => {
    const target = targetTextRef.current;
    let displayed = displayedTextRef.current;

    // 如果目标文本变化且当前显示的文本不是目标的前缀，重置
    if (!target.startsWith(displayed) && displayed.length > 0) {
      displayed = '';
      displayedTextRef.current = '';
    }

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
    if (isAnimatingRef.current) {
      rafIdRef.current = requestAnimationFrame(animationLoop);
    }
  }, []);

  // 启动/停止打字机动画
  useEffect(() => {
    if (shouldShow && agentResponse.text && !isLoading) {
      targetTextRef.current = agentResponse.text;

      // 如果新目标不是当前显示文本的扩展，重置
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
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [shouldShow, agentResponse.text, isLoading, animationLoop]);

  // 当不再 active 时，重置状态
  useEffect(() => {
    if (!isActive) {
      lastResponseIdRef.current = null;
      setIsLoading(false);
      displayedTextRef.current = '';
      targetTextRef.current = '';
      setDisplayedText('');
    }
  }, [isActive]);

  // 点击外部关闭
  useEffect(() => {
    if (!shouldShow) return;

    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        actions.hidePopup();
      }
    };

    // 延迟添加监听器，避免立即触发
    const timer = setTimeout(() => {
      document.addEventListener('click', handleClick);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClick);
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
        // 入场动画
        'animate-in fade-in slide-in-from-top-2',
      )}
      style={{
        top: POPUP_CONFIG.topMargin,
        maxWidth: POPUP_CONFIG.maxWidth,
        width: '90vw',
        opacity: agentResponse.popupOpacity,
      }}
    >
      {/* 内容区域 */}
      <div
        ref={scrollRef}
        className="overflow-y-auto overflow-x-hidden p-5"
        style={{ maxHeight: POPUP_CONFIG.maxHeight, minHeight: 60 }}
      >
        {isLoading ? (
          // Loading 状态
          <div className="flex items-center justify-center">
            <LoadingDots />
          </div>
        ) : (
          <div className="prose prose-invert prose-sm max-w-none">
            {/* 使用打字机效果显示文本 */}
            <div className="text-white/90 leading-relaxed whitespace-pre-wrap">
              {displayedText}
              {/* 流式输出时的闪烁光标 */}
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
