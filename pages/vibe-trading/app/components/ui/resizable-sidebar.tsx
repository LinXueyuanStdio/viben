"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface ResizableSidebarProps {
  children: React.ReactNode;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
}

export function ResizableSidebar({
  children,
  defaultWidth = 380,
  minWidth = 260,
  maxWidth = 600,
}: ResizableSidebarProps) {
  const [width, setWidth] = useState(defaultWidth);
  const [collapsed, setCollapsed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (collapsed) return;
      e.preventDefault();
      setIsDragging(true);
      startXRef.current = e.clientX;
      startWidthRef.current = width;
    },
    [width, collapsed]
  );

  useEffect(() => {
    if (!isDragging) return;

    function handleMouseMove(e: MouseEvent) {
      const delta = startXRef.current - e.clientX;
      const newWidth = Math.max(
        minWidth,
        Math.min(maxWidth, startWidthRef.current + delta)
      );
      setWidth(newWidth);
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
  }, [isDragging, minWidth, maxWidth]);

  return (
    <aside
      className="flex flex-col overflow-hidden relative border-l border-border transition-[width] duration-200 ease-in-out"
      style={{ width: collapsed ? 36 : width }}
    >
      {collapsed ? (
        // Collapsed state: thin strip with expand button
        <button
          onClick={() => setCollapsed(false)}
          className="flex flex-col items-center justify-center h-full w-full hover:bg-muted transition-colors group"
          title="展开面板"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground group-hover:text-foreground transition-colors">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span className="mt-2 text-xs text-muted-foreground group-hover:text-foreground [writing-mode:vertical-lr]">决策面板</span>
        </button>
      ) : (
        <>
          {/* Left-edge drag handle */}
          <div
            onMouseDown={handleMouseDown}
            className={`absolute top-0 left-0 bottom-0 w-1.5 cursor-col-resize z-20 group flex items-center justify-center ${
              isDragging ? "bg-cyan-600/20" : "hover:bg-muted"
            }`}
          >
            <div
              className={`h-8 w-0.5 rounded-full transition-colors ${
                isDragging ? "bg-cyan-600" : "bg-border group-hover:bg-muted-foreground"
              }`}
            />
          </div>

          {/* Collapse button (top right) */}
          <button
            onClick={() => setCollapsed(true)}
            className="absolute top-2 right-2 z-20 p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="收起面板"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>

          {/* Content */}
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {children}
          </div>
        </>
      )}
    </aside>
  );
}
