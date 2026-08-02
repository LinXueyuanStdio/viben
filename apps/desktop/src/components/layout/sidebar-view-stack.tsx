import { Children, isValidElement, type ReactNode } from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";

// ─── Animation Variants ──────────────────────────────────────────────────────

/**
 * Main panel: fades in/out without horizontal movement.
 * Sub panels: slide in from right + fade.
 */
const MAIN_VARIANTS: Variants = {
  enter: { opacity: 0 },
  center: { opacity: 1 },
  exit: { opacity: 0 },
};

const SUB_VARIANTS: Variants = {
  enter: { x: "70%", opacity: 0 },
  center: { x: 0, opacity: 1 },
  exit: { x: "70%", opacity: 0 },
};

const TRANSITION = { duration: 0.15, ease: "easeOut" as const };

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SidebarPanelProps {
  /** Unique panel ID. "main" is the default panel with fade-only animation. */
  id: string;
  children: ReactNode;
}

interface SidebarViewStackProps {
  /** ID of the currently active panel */
  activePanelId: string;
  children: ReactNode;
}

// ─── Panel (collector) ───────────────────────────────────────────────────────

function SidebarPanel(_props: SidebarPanelProps) {
  // This component is only used as a collector; it doesn't render anything itself.
  // SidebarViewStack extracts its children and renders the active panel.
  return null;
}

// ─── View Stack ──────────────────────────────────────────────────────────────

export function SidebarViewStack({ activePanelId, children }: SidebarViewStackProps) {
  const panels = Children.toArray(children).filter(isValidElement<SidebarPanelProps>);
  const activePanel = panels.find((p) => p.props.id === activePanelId);

  if (!activePanel) {
    // Render nothing if the active panel doesn't exist
    return null;
  }

  const variants = activePanelId === "main" ? MAIN_VARIANTS : SUB_VARIANTS;

  return (
    <div className="relative flex-1 min-h-0">
      <AnimatePresence mode="sync">
        <motion.div
          key={activePanelId}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={TRANSITION}
          className="absolute inset-0 flex flex-col"
        >
          {activePanel.props.children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

SidebarViewStack.Panel = SidebarPanel;
