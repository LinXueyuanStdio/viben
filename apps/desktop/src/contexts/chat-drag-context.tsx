/**
 * ChatDragContext - 聊天窗口拖拽上下文
 *
 * 通过 Context 传递拖拽处理器，让子组件可以选择性地绑定拖拽事件
 * 只有在需要拖拽的区域（如 ExpandedHeader）才绑定事件处理器
 */

import { createContext, useContext } from "react";

interface ChatDragHandlers {
  onMouseDown: (e: React.MouseEvent) => void;
  onTouchStart: (e: React.TouchEvent) => void;
}

interface ChatDragContextValue {
  /** 拖拽事件处理器，在需要拖拽的区域绑定 */
  dragHandlers: ChatDragHandlers | null;
  /** 是否正在拖拽 */
  isDragging: boolean;
  /** 是否启用拖拽 */
  enabled: boolean;
}

const ChatDragContext = createContext<ChatDragContextValue>({
  dragHandlers: null,
  isDragging: false,
  enabled: false,
});

export const ChatDragProvider = ChatDragContext.Provider;

/**
 * 获取拖拽上下文
 * 在需要添加拖拽功能的组件中使用（如 ExpandedHeader）
 */
export function useChatDragContext(): ChatDragContextValue {
  return useContext(ChatDragContext);
}

/**
 * 获取拖拽区域的 props
 * 返回可以直接展开到元素上的 props
 */
export function useDragHandleProps(): {
  onMouseDown?: (e: React.MouseEvent) => void;
  onTouchStart?: (e: React.TouchEvent) => void;
  style?: React.CSSProperties;
  "data-drag-handle"?: boolean;
} {
  const { dragHandlers, enabled, isDragging } = useChatDragContext();

  if (!enabled || !dragHandlers) {
    return {};
  }

  return {
    onMouseDown: dragHandlers.onMouseDown,
    onTouchStart: dragHandlers.onTouchStart,
    style: { cursor: isDragging ? "grabbing" : "grab" },
    "data-drag-handle": true,
  };
}
