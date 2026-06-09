/**
 * DraggableChatWrapper - 可拖拽的聊天窗口包装器
 *
 * 实现类似 iOS AssistiveTouch 的交互：
 * - 拖拽移动窗口（只在拖拽手柄区域触发）
 * - 释放后自动吸附到最近的屏幕边缘角落
 * - 平滑动画过渡
 *
 * 使用方式：
 * 1. 使用 DraggableChatWrapper 包裹聊天窗口
 * 2. 子组件通过 useChatDragContext() 获取 dragHandlers
 * 3. 只在需要拖拽的区域（如 ExpandedHeader）绑定 dragHandlers
 */

import { useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useChatDrag } from "@/hooks/use-chat-drag";
import { ChatDragProvider } from "@/contexts/chat-drag-context";
import type { SnapPosition } from "@/stores/chat-position-store";

interface DraggableChatWrapperProps {
  children: React.ReactNode;
  /** 是否启用拖拽（仅在浮动模式下启用） */
  enabled?: boolean;
  /** 距离边缘的边距 */
  margin?: number;
}

/**
 * 根据吸附位置获取动画的初始/目标位置
 */
function getPositionConfig(position: SnapPosition, margin: number) {
  switch (position) {
    case "bottom-left":
      return { bottom: margin, left: margin, top: "auto", right: "auto" };
    case "bottom-right":
      return { bottom: margin, right: margin, top: "auto", left: "auto" };
    case "top-left":
      return { top: margin, left: margin, bottom: "auto", right: "auto" };
    case "top-right":
      return { top: margin, right: margin, bottom: "auto", left: "auto" };
    default:
      return { bottom: margin, left: margin, top: "auto", right: "auto" };
  }
}

/**
 * 吸附动画配置
 */
const SNAP_SPRING = {
  type: "spring" as const,
  stiffness: 400,
  damping: 30,
  mass: 1,
};

export function DraggableChatWrapper({
  children,
  enabled = true,
  margin = 20,
}: DraggableChatWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    position,
    isDragging,
    dragPosition,
    dragHandlers,
  } = useChatDrag({
    containerRef,
    margin,
    // 浮动模式下的默认大小（expanded 模式的尺寸）
    elementSize: { width: 440, height: 560 },
  });

  // 通过 Context 传递拖拽处理器，让子组件选择性绑定
  const contextValue = useMemo(
    () => ({
      dragHandlers: enabled ? dragHandlers : null,
      isDragging,
      enabled,
    }),
    [enabled, dragHandlers, isDragging]
  );

  if (!enabled) {
    return (
      <ChatDragProvider value={contextValue}>
        {children}
      </ChatDragProvider>
    );
  }

  // 计算当前应该显示的位置样式
  const positionConfig = getPositionConfig(position, margin);

  return (
    <ChatDragProvider value={contextValue}>
      <div
        ref={containerRef}
        className="absolute inset-0 pointer-events-none z-20"
        data-testid="draggable-chat-container"
      >
        <AnimatePresence mode="wait">
          {isDragging && dragPosition ? (
            // 拖拽中：使用固定位置
            <motion.div
              key="dragging"
              className="pointer-events-auto"
              style={{
                position: "absolute",
                left: dragPosition.x,
                top: dragPosition.y,
              }}
              initial={false}
              data-testid="draggable-chat-dragging"
            >
              {children}
            </motion.div>
          ) : (
            // 非拖拽：使用吸附位置 + 动画
            <motion.div
              key={`snap-${position}`}
              className="pointer-events-auto"
              initial={false}
              animate={positionConfig}
              transition={SNAP_SPRING}
              style={{
                position: "absolute",
              }}
              data-testid="draggable-chat-snapped"
              data-position={position}
            >
              {children}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ChatDragProvider>
  );
}
