/**
 * Chat Position Store
 *
 * 管理 AcpChat 浮动窗口的位置状态
 * - 支持四个角落的吸附位置：左下、右下、左上、右上
 * - 使用 zustand persist 持久化位置
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * 吸附位置类型
 * - bottom-left: 左下角（默认）
 * - bottom-right: 右下角
 * - top-left: 左上角
 * - top-right: 右上角
 */
export type SnapPosition = "bottom-left" | "bottom-right" | "top-left" | "top-right";

interface ChatPositionState {
  /** 当前吸附位置 */
  position: SnapPosition;
  /** 是否正在拖拽中 */
  isDragging: boolean;
  /** 拖拽时的临时坐标（相对于容器） */
  dragOffset: { x: number; y: number } | null;
  /** 设置吸附位置 */
  setPosition: (position: SnapPosition) => void;
  /** 开始拖拽 */
  startDrag: (offset: { x: number; y: number }) => void;
  /** 更新拖拽位置 */
  updateDrag: (offset: { x: number; y: number }) => void;
  /** 结束拖拽，计算最近的吸附位置 */
  endDrag: (containerRect: { width: number; height: number }) => void;
  /** 取消拖拽 */
  cancelDrag: () => void;
}

/**
 * 根据当前位置计算最近的吸附角落
 */
function calculateSnapPosition(
  x: number,
  y: number,
  containerWidth: number,
  containerHeight: number
): SnapPosition {
  const centerX = containerWidth / 2;
  const centerY = containerHeight / 2;

  const isLeft = x < centerX;
  const isTop = y < centerY;

  if (isLeft && isTop) return "top-left";
  if (!isLeft && isTop) return "top-right";
  if (isLeft && !isTop) return "bottom-left";
  return "bottom-right";
}

export const useChatPositionStore = create<ChatPositionState>()(
  persist(
    (set, get) => ({
      position: "bottom-left",
      isDragging: false,
      dragOffset: null,

      setPosition: (position) => set({ position }),

      startDrag: (offset) =>
        set({
          isDragging: true,
          dragOffset: offset,
        }),

      updateDrag: (offset) =>
        set({
          dragOffset: offset,
        }),

      endDrag: (containerRect) => {
        const { dragOffset } = get();
        if (!dragOffset) {
          set({ isDragging: false, dragOffset: null });
          return;
        }

        const newPosition = calculateSnapPosition(
          dragOffset.x,
          dragOffset.y,
          containerRect.width,
          containerRect.height
        );

        set({
          isDragging: false,
          dragOffset: null,
          position: newPosition,
        });
      },

      cancelDrag: () =>
        set({
          isDragging: false,
          dragOffset: null,
        }),
    }),
    {
      name: "viben-chat-position",
      // 只持久化 position，不持久化拖拽状态
      partialize: (state) => ({ position: state.position }),
    }
  )
);
