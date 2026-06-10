/**
 * DraggableExpandedHeader - 支持拖拽的展开式 Header
 *
 * 包装 ExpandedHeader 组件，添加拖拽支持
 * 拖拽区域是整个 header 的 center 部分（空白区域）
 *
 * 支持两种拖拽模式：
 * 1. 浮动模式：使用 ChatDragContext 进行组件内拖拽
 * 2. 窗口模式：使用 Tauri API 拖拽整个窗口
 */

import type { ReactNode } from "react";
import { useCallback } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ExpandedHeader } from "@viben/chat";
import { useChatDragContext } from "@/contexts/chat-drag-context";

interface DraggableExpandedHeaderProps {
  leftContent: ReactNode;
  centerContent: ReactNode;
  rightContent: ReactNode;
  /** When true, drags the window instead of the floating component */
  windowMode?: boolean;
}

export function DraggableExpandedHeader({
  leftContent,
  centerContent,
  rightContent,
  windowMode = false,
}: DraggableExpandedHeaderProps) {
  const { dragHandlers, isDragging, enabled } = useChatDragContext();

  // 窗口模式下的拖拽处理
  // 仅在点击空白区域时开始拖拽，避免与子元素的点击事件冲突
  const handleWindowDrag = useCallback(async (e: React.MouseEvent) => {
    // 只响应左键
    if (e.button !== 0) return;
    // 如果点击的是按钮或其他交互元素，不触发拖拽
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("[data-no-drag]")) {
      return;
    }
    e.preventDefault();
    try {
      const win = getCurrentWindow();
      await win.startDragging();
    } catch (err) {
      console.error("[DraggableExpandedHeader] startDragging failed:", err);
    }
  }, []);

  // 窗口模式：使用 Tauri 窗口拖拽
  // 即使 centerContent 为 null，也需要保持可拖拽的空白区域
  if (windowMode) {
    const windowDraggableCenterContent = (
      <div
        className="flex min-w-0 flex-1 items-center cursor-move select-none h-full"
        onMouseDown={handleWindowDrag}
        data-tauri-drag-region
      >
        {centerContent}
      </div>
    );

    return (
      <ExpandedHeader
        leftContent={leftContent}
        centerContent={windowDraggableCenterContent}
        rightContent={rightContent}
      />
    );
  }

  // 浮动模式：使用 ChatDragContext
  // 即使 centerContent 为 null，也需要保持可拖拽的空白区域
  const draggableCenterContent = enabled && dragHandlers ? (
    <div
      className="flex min-w-0 flex-1 items-center cursor-grab active:cursor-grabbing select-none h-full"
      {...dragHandlers}
      style={{ cursor: isDragging ? "grabbing" : "grab" }}
      data-drag-handle
    >
      {centerContent}
    </div>
  ) : (
    <div className="flex min-w-0 flex-1 items-center h-full">
      {centerContent}
    </div>
  );

  return (
    <ExpandedHeader
      leftContent={leftContent}
      centerContent={draggableCenterContent}
      rightContent={rightContent}
    />
  );
}
