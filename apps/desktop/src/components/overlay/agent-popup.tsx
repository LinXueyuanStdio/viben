import type { ReactElement } from 'react';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useVoiceStore } from '@/stores/voice-store';
import { cn } from '@/lib/utils';

const POPUP_CONFIG = {
  maxWidth: 500,
  maxHeight: 400,
  topMargin: 140, // 字幕下方
  charThreshold: 400, // ≥400 字符时显示弹窗
};

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

  const isActive = connectionState === 'speaking' || connectionState === 'processing';
  const shouldShow = agentResponse.showPopup && agentResponse.charCount >= POPUP_CONFIG.charThreshold;

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
  }, [agentResponse.text, agentResponse.isStreaming]);

  if (!isActive || !shouldShow) {
    return null;
  }

  const popup = (
    <div
      ref={containerRef}
      className={cn(
        'fixed z-[9999] left-1/2 -translate-x-1/2',
        'bg-[#1a1a1a]/95 backdrop-blur-sm',
        'rounded-xl shadow-2xl border border-white/10',
        'transition-opacity duration-200',
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
        style={{ maxHeight: POPUP_CONFIG.maxHeight }}
      >
        <div className="prose prose-invert prose-sm max-w-none">
          {/* Simple markdown-like rendering - streamdown can be added later */}
          <div className="text-white/90 leading-relaxed whitespace-pre-wrap">
            {agentResponse.text}
          </div>
        </div>

        {/* 流式输出时的闪烁光标 */}
        {agentResponse.isStreaming && (
          <span className="inline-block w-0.5 h-4 bg-white/80 ml-1 animate-pulse" />
        )}
      </div>
    </div>
  );

  return createPortal(popup, document.body);
}
