/**
 * DraggableExpandedHeader - 支持拖拽的展开式 Header
 *
 * 包装 ExpandedHeader 组件，添加拖拽支持
 * 拖拽区域是整个 header 的 center 部分（空白区域）
 */

import type { ReactNode } from "react";
import { ExpandedHeader } from "@viben/chat";
import { useChatDragContext } from "@/contexts/chat-drag-context";

interface DraggableExpandedHeaderProps {
  leftContent: ReactNode;
  centerContent: ReactNode;
  rightContent: ReactNode;
}

export function DraggableExpandedHeader({
  leftContent,
  centerContent,
  rightContent,
}: DraggableExpandedHeaderProps) {
  const { dragHandlers, isDragging, enabled } = useChatDragContext();

  // 如果启用了拖拽，包装 centerContent 使其成为拖拽区域
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
