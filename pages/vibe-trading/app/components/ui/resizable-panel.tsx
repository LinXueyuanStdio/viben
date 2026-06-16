"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface ResizablePanelProps {
  children: (props: { collapsed: boolean; toggleCollapse: () => void }) => React.ReactNode;
  defaultHeight?: number;
  minHeight?: number;
  maxHeight?: number;
}

export function ResizablePanel({
  children,
  defaultHeight = 280,
  minHeight = 100,
  maxHeight = 600,
}: ResizablePanelProps) {
  const [height, setHeight] = useState(defaultHeight);
  const [collapsed, setCollapsed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);

  const toggleCollapse = useCallback(() => {
    setCollapsed((c) => !c);
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      startYRef.current = e.clientY;
      startHeightRef.current = height;
    },
    [height]
  );

  useEffect(() => {
    if (!isDragging) return;

    function handleMouseMove(e: MouseEvent) {
      const delta = startYRef.current - e.clientY;
      const newHeight = Math.max(
        minHeight,
        Math.min(maxHeight, startHeightRef.current + delta)
      );
      setHeight(newHeight);
    }

    function handleMouseUp() {
      setIsDragging(false);
    }

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, minHeight, maxHeight]);

  return (
    <div
      ref={panelRef}
      className="flex flex-col border-t border-border bg-card relative"
      style={{ height: collapsed ? "auto" : height }}
    >
      {/* Drag handle */}
      {!collapsed && (
        <div
          onMouseDown={handleMouseDown}
          className={`absolute top-0 left-0 right-0 h-1.5 cursor-row-resize z-20 group flex items-center justify-center ${
            isDragging ? "bg-primary/20" : "hover:bg-muted"
          }`}
        >
          <div
            className={`w-8 h-0.5 rounded-full transition-colors ${
              isDragging ? "bg-primary" : "bg-border group-hover:bg-muted-foreground"
            }`}
          />
        </div>
      )}

      {/* Content rendered via render props */}
      {children({ collapsed, toggleCollapse })}
    </div>
  );
}
