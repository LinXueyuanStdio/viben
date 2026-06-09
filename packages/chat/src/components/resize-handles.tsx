/**
 * ResizeHandles Component
 *
 * 为面板提供四边和四角的 resize 拖拽手柄
 * 支持 hover/active 状态的视觉反馈
 */

import * as React from "react";
import { cn } from "@viben/ui";
import type { ResizeDirection } from "../hooks/use-resizable-panel";

export interface ResizeHandlesProps {
  /** 开始拖拽的回调 */
  onResizeStart: (e: React.MouseEvent, direction: ResizeDirection) => void;
  /** 是否正在拖拽 */
  isResizing?: boolean;
  /** 自定义 className */
  className?: string;
}

/**
 * 渲染面板的所有 resize 手柄
 * 包含四边和四角共 8 个手柄
 */
export function ResizeHandles({
  onResizeStart,
  isResizing = false,
  className,
}: ResizeHandlesProps) {
  return (
    <div className={cn("pointer-events-none absolute inset-0", className)}>
      {/* 四边手柄 */}
      <EdgeHandle direction="n" onResizeStart={onResizeStart} isResizing={isResizing} />
      <EdgeHandle direction="s" onResizeStart={onResizeStart} isResizing={isResizing} />
      <EdgeHandle direction="e" onResizeStart={onResizeStart} isResizing={isResizing} />
      <EdgeHandle direction="w" onResizeStart={onResizeStart} isResizing={isResizing} />

      {/* 四角手柄 */}
      <CornerHandle direction="ne" onResizeStart={onResizeStart} isResizing={isResizing} />
      <CornerHandle direction="nw" onResizeStart={onResizeStart} isResizing={isResizing} />
      <CornerHandle direction="se" onResizeStart={onResizeStart} isResizing={isResizing} />
      <CornerHandle direction="sw" onResizeStart={onResizeStart} isResizing={isResizing} />
    </div>
  );
}

interface HandleProps {
  direction: ResizeDirection;
  onResizeStart: (e: React.MouseEvent, direction: ResizeDirection) => void;
  isResizing?: boolean;
}

/**
 * 边缘手柄组件
 */
function EdgeHandle({ direction, onResizeStart, isResizing }: HandleProps) {
  const positionClass = getEdgePositionClass(direction);
  const cursorClass = getEdgeCursorClass(direction);

  return (
    <div
      className={cn(
        "pointer-events-auto absolute z-10 transition-colors",
        positionClass,
        cursorClass,
        // 默认透明，hover 时显示
        "bg-transparent hover:bg-primary/30",
        // active 状态
        isResizing && "bg-primary/50"
      )}
      onMouseDown={(e) => onResizeStart(e, direction)}
      data-resize-handle={direction}
    />
  );
}

/**
 * 角落手柄组件
 */
function CornerHandle({ direction, onResizeStart, isResizing }: HandleProps) {
  const positionClass = getCornerPositionClass(direction);
  const cursorClass = getCornerCursorClass(direction);

  return (
    <div
      className={cn(
        "pointer-events-auto absolute z-20 transition-colors",
        positionClass,
        cursorClass,
        // 角落手柄更大的点击区域
        "size-3",
        // 默认透明，hover 时显示
        "bg-transparent hover:bg-primary/40",
        // active 状态
        isResizing && "bg-primary/60"
      )}
      onMouseDown={(e) => onResizeStart(e, direction)}
      data-resize-handle={direction}
    />
  );
}

/**
 * 获取边缘手柄的位置 class
 */
function getEdgePositionClass(direction: ResizeDirection): string {
  switch (direction) {
    case "n":
      // 上边：顶部横条，左右留出角落空间
      return "top-0 left-3 right-3 h-1.5";
    case "s":
      // 下边：底部横条，左右留出角落空间
      return "bottom-0 left-3 right-3 h-1.5";
    case "e":
      // 右边：右侧竖条，上下留出角落空间
      return "right-0 top-3 bottom-3 w-1.5";
    case "w":
      // 左边：左侧竖条，上下留出角落空间
      return "left-0 top-3 bottom-3 w-1.5";
    default:
      return "";
  }
}

/**
 * 获取边缘手柄的光标 class
 */
function getEdgeCursorClass(direction: ResizeDirection): string {
  switch (direction) {
    case "n":
    case "s":
      return "cursor-ns-resize";
    case "e":
    case "w":
      return "cursor-ew-resize";
    default:
      return "";
  }
}

/**
 * 获取角落手柄的位置 class
 */
function getCornerPositionClass(direction: ResizeDirection): string {
  switch (direction) {
    case "ne":
      // 右上角
      return "top-0 right-0";
    case "nw":
      // 左上角
      return "top-0 left-0";
    case "se":
      // 右下角
      return "bottom-0 right-0";
    case "sw":
      // 左下角
      return "bottom-0 left-0";
    default:
      return "";
  }
}

/**
 * 获取角落手柄的光标 class
 */
function getCornerCursorClass(direction: ResizeDirection): string {
  switch (direction) {
    case "ne":
    case "sw":
      return "cursor-nesw-resize";
    case "nw":
    case "se":
      return "cursor-nwse-resize";
    default:
      return "";
  }
}
