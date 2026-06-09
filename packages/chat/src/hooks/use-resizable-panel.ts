/**
 * useResizablePanel Hook
 *
 * 支持从四边和四角拖拽调整面板尺寸的 hook
 * 用于 expanded 模式的 ChatApp 窗口 resize 功能
 */

import { useState, useCallback, useEffect, useRef } from "react";

// 拖拽方向类型
export type ResizeDirection =
  | "n"   // 上边
  | "s"   // 下边
  | "e"   // 右边
  | "w"   // 左边
  | "ne"  // 右上角
  | "nw"  // 左上角
  | "se"  // 右下角
  | "sw"; // 左下角

export interface UseResizablePanelOptions {
  /** 存储尺寸的 localStorage key */
  storageKey?: string;
  /** 默认宽度 */
  defaultWidth?: number;
  /** 默认高度 */
  defaultHeight?: number;
  /** 最小宽度 */
  minWidth?: number;
  /** 最大宽度 */
  maxWidth?: number;
  /** 最小高度 */
  minHeight?: number;
  /** 最大高度 */
  maxHeight?: number;
  /** 是否启用 resize */
  enabled?: boolean;
}

export interface UseResizablePanelReturn {
  /** 当前宽度 */
  width: number;
  /** 当前高度 */
  height: number;
  /** 是否正在拖拽 */
  isResizing: boolean;
  /** 开始拖拽的处理函数 */
  handleResizeStart: (e: React.MouseEvent, direction: ResizeDirection) => void;
  /** 重置为默认尺寸 */
  resetSize: () => void;
}

/**
 * 用于管理面板 resize 的 hook
 * 支持从四边和四角拖拽调整尺寸
 */
export function useResizablePanel(
  options: UseResizablePanelOptions = {}
): UseResizablePanelReturn {
  const {
    storageKey = "chat_panel_size",
    defaultWidth = 440,
    defaultHeight = 560,
    minWidth = 320,
    maxWidth = 800,
    minHeight = 400,
    maxHeight = 900,
    enabled = true,
  } = options;

  const [width, setWidth] = useState(defaultWidth);
  const [height, setHeight] = useState(defaultHeight);
  const [isResizing, setIsResizing] = useState(false);

  // Refs 用于在 mousemove 事件中保持最新值
  const isDraggingRef = useRef(false);
  const directionRef = useRef<ResizeDirection | null>(null);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const startWidthRef = useRef(0);
  const startHeightRef = useRef(0);
  const latestWidthRef = useRef(defaultWidth);
  const latestHeightRef = useRef(defaultHeight);

  // 从 localStorage 加载保存的尺寸
  useEffect(() => {
    if (!enabled) return;

    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (
          typeof parsed.width === "number" &&
          typeof parsed.height === "number"
        ) {
          const savedWidth = Math.min(Math.max(parsed.width, minWidth), maxWidth);
          const savedHeight = Math.min(Math.max(parsed.height, minHeight), maxHeight);
          setWidth(savedWidth);
          setHeight(savedHeight);
          latestWidthRef.current = savedWidth;
          latestHeightRef.current = savedHeight;
        }
      }
    } catch {
      // 忽略 localStorage 错误
    }
  }, [enabled, storageKey, minWidth, maxWidth, minHeight, maxHeight]);

  // 保存尺寸到 localStorage
  const saveSize = useCallback(
    (newWidth: number, newHeight: number) => {
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify({ width: newWidth, height: newHeight })
        );
      } catch {
        // 忽略 localStorage 错误
      }
    },
    [storageKey]
  );

  // 开始拖拽
  const handleResizeStart = useCallback(
    (e: React.MouseEvent, direction: ResizeDirection) => {
      if (!enabled) return;

      e.preventDefault();
      e.stopPropagation();

      isDraggingRef.current = true;
      directionRef.current = direction;
      startXRef.current = e.clientX;
      startYRef.current = e.clientY;
      startWidthRef.current = width;
      startHeightRef.current = height;
      latestWidthRef.current = width;
      latestHeightRef.current = height;

      setIsResizing(true);

      // 设置拖拽时的光标样式
      document.body.style.cursor = getCursorForDirection(direction);
      document.body.style.userSelect = "none";

      const handleMouseMove = (e: MouseEvent) => {
        if (!isDraggingRef.current || !directionRef.current) return;

        const deltaX = e.clientX - startXRef.current;
        const deltaY = e.clientY - startYRef.current;
        const dir = directionRef.current;

        let newWidth = startWidthRef.current;
        let newHeight = startHeightRef.current;

        // 根据拖拽方向计算新尺寸
        // 注意：面板在左下角，所以拖拽方向的计算需要考虑定位
        if (dir.includes("e")) {
          // 向右拖拽，增加宽度
          newWidth = startWidthRef.current + deltaX;
        }
        if (dir.includes("w")) {
          // 向左拖拽，减少宽度（因为面板从左边定位）
          newWidth = startWidthRef.current - deltaX;
        }
        if (dir.includes("n")) {
          // 向上拖拽，增加高度（因为面板从底部定位）
          newHeight = startHeightRef.current - deltaY;
        }
        if (dir.includes("s")) {
          // 向下拖拽，减少高度
          newHeight = startHeightRef.current + deltaY;
        }

        // 应用尺寸限制
        newWidth = Math.min(Math.max(newWidth, minWidth), maxWidth);
        newHeight = Math.min(Math.max(newHeight, minHeight), maxHeight);

        latestWidthRef.current = newWidth;
        latestHeightRef.current = newHeight;

        setWidth(newWidth);
        setHeight(newHeight);
      };

      const handleMouseUp = () => {
        if (isDraggingRef.current) {
          isDraggingRef.current = false;
          directionRef.current = null;
          setIsResizing(false);
          saveSize(latestWidthRef.current, latestHeightRef.current);
        }

        // 恢复光标和选择
        document.body.style.cursor = "";
        document.body.style.userSelect = "";

        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [enabled, width, height, minWidth, maxWidth, minHeight, maxHeight, saveSize]
  );

  // 重置为默认尺寸
  const resetSize = useCallback(() => {
    setWidth(defaultWidth);
    setHeight(defaultHeight);
    latestWidthRef.current = defaultWidth;
    latestHeightRef.current = defaultHeight;
    saveSize(defaultWidth, defaultHeight);
  }, [defaultWidth, defaultHeight, saveSize]);

  return {
    width,
    height,
    isResizing,
    handleResizeStart,
    resetSize,
  };
}

/**
 * 根据拖拽方向返回对应的光标样式
 */
function getCursorForDirection(direction: ResizeDirection): string {
  switch (direction) {
    case "n":
    case "s":
      return "ns-resize";
    case "e":
    case "w":
      return "ew-resize";
    case "ne":
    case "sw":
      return "nesw-resize";
    case "nw":
    case "se":
      return "nwse-resize";
    default:
      return "default";
  }
}
