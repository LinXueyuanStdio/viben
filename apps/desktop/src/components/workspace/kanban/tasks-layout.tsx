"use client";

import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Group,
  Panel,
  Separator,
  type PanelSize,
} from "react-resizable-panels";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@viben/ui";

export type LayoutMode = "preview" | "diffs" | null;

interface TasksLayoutProps {
  kanban: ReactNode;
  taskPanel: ReactNode;
  auxPanel?: ReactNode;
  isPanelOpen: boolean;
  mode?: LayoutMode;
  isMobile?: boolean;
  rightHeader?: ReactNode;
}

const MIN_PANEL_SIZE = 20; // percentage (0-100)
const COLLAPSED_SIZE = 0; // percentage (0-100)

/**
 * AuxRouter - Handles nested AnimatePresence for preview/diffs transitions.
 */
function AuxRouter({ mode, aux }: { mode: LayoutMode; aux: ReactNode }) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <AnimatePresence initial={false} mode="popLayout">
      {mode && (
        <motion.div
          key={mode}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{
            duration: prefersReducedMotion ? 0 : 0.2,
            ease: [0.2, 0, 0, 1]
          }}
          className="h-full min-h-0"
        >
          {aux}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * SeparatorHandle - Visual grip handle for panel resizing (vibe-kanban style)
 * The handle is centered vertically/horizontally within the separator
 */
function SeparatorHandle({ isCollapsed: _isCollapsed }: { isCollapsed?: boolean }) {
  return (
    <>
      {/* Center line */}
      <div className="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-border" />
      {/* Grip indicator - vertically centered */}
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 bg-muted/90 border border-border rounded-full px-1.5 py-3 opacity-70 group-hover:opacity-100 group-focus:opacity-100 transition-opacity shadow-sm">
        <span className="w-1 h-1 rounded-full bg-muted-foreground" />
        <span className="w-1 h-1 rounded-full bg-muted-foreground" />
        <span className="w-1 h-1 rounded-full bg-muted-foreground" />
      </div>
    </>
  );
}

/**
 * RightWorkArea - Contains header and TaskPanel/Aux content.
 * Shows just TaskPanel when mode === null, or TaskPanel | Aux split when mode !== null.
 */
function RightWorkArea({
  taskPanel,
  auxPanel,
  mode,
  rightHeader,
}: {
  taskPanel: ReactNode;
  auxPanel?: ReactNode;
  mode: LayoutMode;
  rightHeader?: ReactNode;
}) {
  const { t } = useTranslation();
  const [isTaskPanelCollapsed, setIsTaskPanelCollapsed] = useState(false);

  const handleTaskPanelResize = (panelSize: PanelSize) => {
    setIsTaskPanelCollapsed(panelSize.asPercentage === COLLAPSED_SIZE);
  };

  return (
    <div className="h-full min-h-0 flex flex-col">
      {rightHeader && (
        <div className="shrink-0 sticky top-0 z-20 bg-background border-b">
          {rightHeader}
        </div>
      )}
      <div className="flex-1 min-h-0">
        {mode === null || !auxPanel ? (
          taskPanel
        ) : (
          <Group
            orientation="horizontal"
            className="h-full min-h-0"
          >
            <Panel
              id="task-panel"
              defaultSize={34}
              minSize={MIN_PANEL_SIZE}
              collapsible
              collapsedSize={COLLAPSED_SIZE}
              onResize={handleTaskPanelResize}
              className="min-w-0 min-h-0 overflow-hidden"
            >
              {taskPanel}
            </Panel>

            <Separator
              id="handle-task-aux"
              className={cn(
                "relative z-30 bg-border cursor-col-resize group touch-none",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                "focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                "transition-all",
                isTaskPanelCollapsed ? "w-6" : "w-1"
              )}
              aria-label={t("common.resizePanels")}
            >
              <SeparatorHandle isCollapsed={isTaskPanelCollapsed} />
            </Separator>

            <Panel
              id="aux"
              defaultSize={66}
              minSize={MIN_PANEL_SIZE}
              className="min-w-0 min-h-0 overflow-hidden"
            >
              <AuxRouter mode={mode} aux={auxPanel} />
            </Panel>
          </Group>
        )}
      </div>
    </div>
  );
}

/**
 * DesktopLayout - Conditionally renders layout based on mode.
 * When mode === null: Shows Kanban | TaskPanel
 * When mode !== null: Hides Kanban, shows only RightWorkArea with TaskPanel | Aux
 */
function DesktopLayout({
  kanban,
  taskPanel,
  auxPanel,
  mode,
  rightHeader,
}: {
  kanban: ReactNode;
  taskPanel: ReactNode;
  auxPanel?: ReactNode;
  mode: LayoutMode;
  rightHeader?: ReactNode;
}) {
  const { t } = useTranslation();
  const [isKanbanCollapsed, setIsKanbanCollapsed] = useState(false);

  const handleKanbanResize = (panelSize: PanelSize) => {
    setIsKanbanCollapsed(panelSize.asPercentage === COLLAPSED_SIZE);
  };

  // When preview/diffs is open, hide Kanban entirely and render only RightWorkArea
  if (mode !== null && auxPanel) {
    return (
      <RightWorkArea
        taskPanel={taskPanel}
        auxPanel={auxPanel}
        mode={mode}
        rightHeader={rightHeader}
      />
    );
  }

  // When only viewing task panel, show Kanban | TaskPanel (no aux)
  return (
    <Group
      orientation="horizontal"
      className="h-full min-h-0"
    >
      <Panel
        id="kanban"
        defaultSize={66}
        minSize={MIN_PANEL_SIZE}
        collapsible
        collapsedSize={COLLAPSED_SIZE}
        onResize={handleKanbanResize}
        className="min-w-0 min-h-0 overflow-hidden"
      >
        {kanban}
      </Panel>

      <Separator
        id="handle-kanban-right"
        className={cn(
          "relative z-30 bg-border cursor-col-resize group touch-none",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
          "focus-visible:ring-offset-1 focus-visible:ring-offset-background",
          "transition-all",
          isKanbanCollapsed ? "w-6" : "w-1"
        )}
        aria-label={t("common.resizePanels")}
      >
        <SeparatorHandle isCollapsed={isKanbanCollapsed} />
      </Separator>

      <Panel
        id="right"
        defaultSize={34}
        minSize={MIN_PANEL_SIZE}
        className="min-w-0 min-h-0 overflow-hidden"
      >
        <RightWorkArea
          taskPanel={taskPanel}
          auxPanel={auxPanel}
          mode={mode}
          rightHeader={rightHeader}
        />
      </Panel>
    </Group>
  );
}

/**
 * TasksLayout - Three-column responsive layout for kanban page
 *
 * Layout modes:
 * - isPanelOpen=false: Full-width kanban board
 * - isPanelOpen=true, mode=null: Kanban | TaskPanel
 * - isPanelOpen=true, mode='preview'|'diffs': TaskPanel | AuxPanel (kanban hidden)
 *
 * Mobile:
 * - One panel at a time, controlled by isPanelOpen and mode
 */
export function TasksLayout({
  kanban,
  taskPanel,
  auxPanel,
  isPanelOpen,
  mode = null,
  isMobile = false,
  rightHeader,
}: TasksLayoutProps) {
  const { t } = useTranslation();
  const prefersReducedMotion = useReducedMotion();
  const desktopKey = isPanelOpen ? "desktop-with-panel" : "kanban-only";

  if (isMobile) {
    // When panel is open and mode is set, show aux content (preview/diffs)
    // Otherwise show task panel content
    const showAux = isPanelOpen && mode !== null && auxPanel;

    return (
      <div className="h-full min-h-0 flex flex-col">
        {/* Header is visible when panel is open */}
        {isPanelOpen && rightHeader && (
          <div className="shrink-0 sticky top-0 z-20 bg-background border-b">
            {rightHeader}
          </div>
        )}

        <div className="flex-1 min-h-0">
          {!isPanelOpen ? (
            kanban
          ) : showAux ? (
            <AuxRouter mode={mode} aux={auxPanel} />
          ) : (
            taskPanel
          )}
        </div>
      </div>
    );
  }

  let desktopNode: ReactNode;

  if (!isPanelOpen) {
    desktopNode = (
      <div
        className="h-full min-h-0 min-w-0"
        role="region"
        aria-label={t("common.kanbanBoard")}
      >
        {kanban}
      </div>
    );
  } else {
    desktopNode = (
      <DesktopLayout
        kanban={kanban}
        taskPanel={taskPanel}
        auxPanel={auxPanel}
        mode={mode}
        rightHeader={rightHeader}
      />
    );
  }

  return (
    <AnimatePresence initial={false} mode="popLayout">
      <motion.div
        key={desktopKey}
        className="h-full min-h-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{
          duration: prefersReducedMotion ? 0 : 0.3,
          ease: [0.2, 0, 0, 1]
        }}
      >
        {desktopNode}
      </motion.div>
    </AnimatePresence>
  );
}
