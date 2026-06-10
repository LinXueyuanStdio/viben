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
  const handleWindowDrag = useCallback(async (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const win = getCurrentWindow();
    await win.startDragging();
  }, []);

  // 窗口模式：使用 Tauri 窗口拖拽
  if (windowMode) {
    const windowDraggableCenterContent = (
      <div
        className="flex min-w-0 flex-1 items-center cursor-move select-none"
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
  const draggableCenterContent = enabled && dragHandlers ? (
    <div
      className="flex min-w-0 flex-1 items-center cursor-grab active:cursor-grabbing select-none"
      {...dragHandlers}
      style={{ cursor: isDragging ? "grabbing" : "grab" }}
      data-drag-handle
    >
      {centerContent}
    </div>
  ) : (
    centerContent
  );

  return (
    <ExpandedHeader
      leftContent={leftContent}
      centerContent={draggableCenterContent}
      rightContent={rightContent}
    />
  );
}
