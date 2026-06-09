import { useCallback, useEffect, useRef, useState } from "react";

export interface UseResizablePanelOptions {
  minWidth: number;
  maxWidth: number;
  defaultWidth: number;
  direction: "left" | "right";
}

export interface UseResizablePanelReturn {
  width: number;
  handleProps: {
    onMouseDown: (e: React.MouseEvent) => void;
  };
}

export function useResizablePanel({
  minWidth,
  maxWidth,
  defaultWidth,
  direction,
}: UseResizablePanelOptions): UseResizablePanelReturn {
  const [width, setWidth] = useState(defaultWidth);
  const isResizing = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(defaultWidth);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isResizing.current = true;
      startX.current = e.clientX;
      startWidth.current = width;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [width]
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const delta = e.clientX - startX.current;
      const adjustedDelta = direction === "right" ? delta : -delta;
      const newWidth = Math.min(
        maxWidth,
        Math.max(minWidth, startWidth.current + adjustedDelta)
      );
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (isResizing.current) {
        isResizing.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [direction, maxWidth, minWidth]);

  return {
    width,
    handleProps: {
      onMouseDown: handleMouseDown,
    },
  };
}
