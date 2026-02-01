import { Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Sidebar } from "./sidebar";

// Check if user prefers reduced motion
const prefersReducedMotion =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const pageTransitionVariants = {
  initial: {
    opacity: 0,
    x: prefersReducedMotion ? 0 : 20,
  },
  enter: {
    opacity: 1,
    x: 0,
    transition: {
      duration: prefersReducedMotion ? 0 : 0.3,
      ease: [0.16, 1, 0.3, 1] as const, // ease-out-expo
    },
  },
  exit: {
    opacity: 0,
    x: prefersReducedMotion ? 0 : -20,
    transition: {
      duration: prefersReducedMotion ? 0 : 0.2,
    },
  },
};

export function AppLayout() {
  const location = useLocation();

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-background theme-transition">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            variants={pageTransitionVariants}
            initial="initial"
            animate="enter"
            exit="exit"
            className="h-full"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
