/**
 * useChatDrag - 聊天窗口拖拽 hook
 *
 * 实现类似 iOS AssistiveTouch 的拖拽和边缘吸附功能：
 * - 支持鼠标拖拽移动
 * - 释放后自动吸附到最近的屏幕边缘角落
 * - 使用 framer-motion 实现平滑动画
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { SnapPosition } from "@/stores/chat-position-store";
import { useChatPositionStore } from "@/stores/chat-position-store";

interface UseChatDragOptions {
  /** 容器元素的 ref */
  containerRef: React.RefObject<HTMLElement | null>;
  /** 边距（距离容器边缘的距离） */
  margin?: number;
  /** 拖拽元素的大小（用于计算位置） */
  elementSize?: { width: number; height: number };
}

interface UseChatDragReturn {
  /** 当前吸附位置 */
  position: SnapPosition;
  /** 是否正在拖拽 */
  isDragging: boolean;
  /** 拖拽时的实时坐标 */
  dragPosition: { x: number; y: number } | null;
  /** 根据吸附位置获取 CSS 样式 */
  getPositionStyle: () => React.CSSProperties;
  /** 拖拽事件处理器 */
  dragHandlers: {
    onMouseDown: (e: React.MouseEvent) => void;
    onTouchStart: (e: React.TouchEvent) => void;
  };
}

/**
 * 根据吸附位置计算 CSS 样式
 */
function getStyleForPosition(
  position: SnapPosition,
  margin: number
): React.CSSProperties {
  const base: React.CSSProperties = {
    position: "absolute",
    transition: "none",
  };

  switch (position) {
    case "bottom-left":
      return { ...base, bottom: margin, left: margin, top: "auto", right: "auto" };
    case "bottom-right":
      return { ...base, bottom: margin, right: margin, top: "auto", left: "auto" };
    case "top-left":
      return { ...base, top: margin, left: margin, bottom: "auto", right: "auto" };
    case "top-right":
      return { ...base, top: margin, right: margin, bottom: "auto", left: "auto" };
    default:
      return { ...base, bottom: margin, left: margin, top: "auto", right: "auto" };
  }
}

export function useChatDrag({
  containerRef,
  margin = 20,
  elementSize = { width: 80, height: 80 },
}: UseChatDragOptions): UseChatDragReturn {
  const { position, isDragging, startDrag, updateDrag, endDrag, cancelDrag } =
    useChatPositionStore();

  // 拖拽时的实时坐标（用于渲染）
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);

  // 拖拽起始点的偏移（鼠标相对于元素左上角的位置）
  const dragStartOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  // 元素的初始位置
  const elementStartPosition = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  /**
   * 开始拖拽
   */
  const handleDragStart = useCallback(
    (clientX: number, clientY: number, target: HTMLElement) => {
      const container = containerRef.current;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const elementRect = target.getBoundingClientRect();

      // 计算鼠标在元素内的偏移
      dragStartOffset.current = {
        x: clientX - elementRect.left,
        y: clientY - elementRect.top,
      };

      // 计算元素在容器内的位置
      const elementX = elementRect.left - containerRect.left;
      const elementY = elementRect.top - containerRect.top;
      elementStartPosition.current = { x: elementX, y: elementY };

      // 更新状态
      setDragPosition({ x: elementX, y: elementY });
      startDrag({ x: elementX, y: elementY });
    },
    [containerRef, startDrag]
  );

  /**
   * 拖拽移动
   */
  const handleDragMove = useCallback(
    (clientX: number, clientY: number) => {
      const container = containerRef.current;
      if (!container || !isDragging) return;

      const containerRect = container.getBoundingClientRect();

      // 计算新的元素位置
      let newX = clientX - containerRect.left - dragStartOffset.current.x;
      let newY = clientY - containerRect.top - dragStartOffset.current.y;

      // 限制在容器范围内
      newX = Math.max(0, Math.min(newX, containerRect.width - elementSize.width));
      newY = Math.max(0, Math.min(newY, containerRect.height - elementSize.height));

      setDragPosition({ x: newX, y: newY });
      updateDrag({ x: newX, y: newY });
    },
    [containerRef, isDragging, updateDrag, elementSize.width, elementSize.height]
  );

  /**
   * 结束拖拽
   */
  const handleDragEnd = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      cancelDrag();
      setDragPosition(null);
      return;
    }

    const containerRect = container.getBoundingClientRect();
    endDrag({ width: containerRect.width, height: containerRect.height });
    setDragPosition(null);
  }, [containerRef, endDrag, cancelDrag]);

  /**
   * 鼠标按下事件
   */
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // 只响应左键
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();

      const target = e.currentTarget as HTMLElement;
      handleDragStart(e.clientX, e.clientY, target);
    },
    [handleDragStart]
  );

  /**
   * 触摸开始事件
   */
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length !== 1) return;
      e.preventDefault();
      e.stopPropagation();

      const touch = e.touches[0];
      const target = e.currentTarget as HTMLElement;
      handleDragStart(touch.clientX, touch.clientY, target);
    },
    [handleDragStart]
  );

  /**
   * 全局鼠标/触摸事件监听
   */
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      handleDragMove(e.clientX, e.clientY);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      handleDragMove(touch.clientX, touch.clientY);
    };

    const handleMouseUp = () => {
      handleDragEnd();
    };

    const handleTouchEnd = () => {
      handleDragEnd();
    };

    // 添加全局事件监听
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd);

    // 禁止页面选择文本
    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  /**
   * 获取当前位置的 CSS 样式
   */
  const getPositionStyle = useCallback((): React.CSSProperties => {
    if (isDragging && dragPosition) {
      return {
        position: "absolute",
        left: dragPosition.x,
        top: dragPosition.y,
        right: "auto",
        bottom: "auto",
        transition: "none",
        cursor: "grabbing",
      };
    }
    return getStyleForPosition(position, margin);
  }, [isDragging, dragPosition, position, margin]);

  return {
    position,
    isDragging,
    dragPosition,
    getPositionStyle,
    dragHandlers: {
      onMouseDown: handleMouseDown,
      onTouchStart: handleTouchStart,
    },
  };
}
