import { motion, useReducedMotion } from "framer-motion";
import { ReactNode } from "react";

// Easing curves
const easeOutExpo = [0.16, 1, 0.3, 1] as const;

interface PageWrapperProps {
  children: ReactNode;
  className?: string;
}

// Apple-style page transition variants
// - Subtle vertical movement (8px downward)
// - Spring physics with damping for natural feel
// - 0.5s duration for smooth, deliberate transitions
// Note: This is typically not needed as AppLayout handles page transitions.
// Use this only for sub-page content that needs independent animation.
export function PageWrapper({ children, className }: PageWrapperProps) {
  const prefersReducedMotion = useReducedMotion();

  const pageVariants = {
    initial: {
      opacity: 0,
      y: prefersReducedMotion ? 0 : 8, // Subtle downward start
    },
    enter: {
      opacity: 1,
      y: 0,
      transition: prefersReducedMotion
        ? { duration: 0 }
        : {
            type: "spring" as const,
            stiffness: 300,
            damping: 30,
            mass: 1,
          },
    },
    exit: {
      opacity: 0,
      transition: {
        duration: prefersReducedMotion ? 0 : 0.3,
        ease: easeOutExpo,
      },
    },
  };

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="enter"
      exit="exit"
      className={className}
    >
      {children}
    </motion.div>
  );
}

interface StaggerContainerProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

// Stagger container for animating children sequentially
// Use for content within pages (not for page-level transitions)
export function StaggerContainer({ children, className, delay = 0 }: StaggerContainerProps) {
  const prefersReducedMotion = useReducedMotion();

  const staggerContainerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: prefersReducedMotion ? 0 : 0.08, // Slightly faster stagger
        delayChildren: prefersReducedMotion ? 0 : 0.1, // Wait for page transition
      },
    },
  };

  return (
    <motion.div
      variants={staggerContainerVariants}
      initial="hidden"
      animate="show"
      className={className}
      transition={{ delayChildren: delay }}
    >
      {children}
    </motion.div>
  );
}

interface StaggerItemProps {
  children: ReactNode;
  className?: string;
}

export function StaggerItem({ children, className }: StaggerItemProps) {
  const prefersReducedMotion = useReducedMotion();

  const staggerItemVariants = {
    hidden: {
      opacity: 0,
      y: prefersReducedMotion ? 0 : 8, // Subtle vertical movement
    },
    show: {
      opacity: 1,
      y: 0,
      transition: prefersReducedMotion
        ? { duration: 0 }
        : {
            type: "spring" as const,
            stiffness: 300,
            damping: 30,
          },
    },
  };

  return (
    <motion.div variants={staggerItemVariants} className={className}>
      {children}
    </motion.div>
  );
}

interface AnimatedCardProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

// Card entrance animation with scale and fade
// Uses spring physics for natural feel
export function AnimatedCard({ children, className, delay = 0 }: AnimatedCardProps) {
  const prefersReducedMotion = useReducedMotion();

  const cardVariants = {
    hidden: {
      opacity: 0,
      scale: prefersReducedMotion ? 1 : 0.98, // More subtle scale
      y: prefersReducedMotion ? 0 : 8,
    },
    show: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: prefersReducedMotion
        ? { duration: 0 }
        : {
            type: "spring" as const,
            stiffness: 300,
            damping: 30,
          },
    },
  };

  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="show"
      transition={{ delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Export variant factories for custom use
// These are factory functions that accept prefersReducedMotion flag
export const createPageVariants = (prefersReducedMotion: boolean) => ({
  initial: {
    opacity: 0,
    y: prefersReducedMotion ? 0 : 8,
  },
  enter: {
    opacity: 1,
    y: 0,
    transition: prefersReducedMotion
      ? { duration: 0 }
      : {
          type: "spring" as const,
          stiffness: 300,
          damping: 30,
          mass: 1,
        },
  },
  exit: {
    opacity: 0,
    transition: {
      duration: prefersReducedMotion ? 0 : 0.3,
      ease: easeOutExpo,
    },
  },
});

export const createStaggerContainerVariants = (prefersReducedMotion: boolean) => ({
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: prefersReducedMotion ? 0 : 0.08,
      delayChildren: prefersReducedMotion ? 0 : 0.1,
    },
  },
});

export const createStaggerItemVariants = (prefersReducedMotion: boolean) => ({
  hidden: {
    opacity: 0,
    y: prefersReducedMotion ? 0 : 8,
  },
  show: {
    opacity: 1,
    y: 0,
    transition: prefersReducedMotion
      ? { duration: 0 }
      : {
          type: "spring" as const,
          stiffness: 300,
          damping: 30,
        },
  },
});

export const createCardVariants = (prefersReducedMotion: boolean) => ({
  hidden: {
    opacity: 0,
    scale: prefersReducedMotion ? 1 : 0.98,
    y: prefersReducedMotion ? 0 : 8,
  },
  show: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: prefersReducedMotion
      ? { duration: 0 }
      : {
          type: "spring" as const,
          stiffness: 300,
          damping: 30,
        },
  },
});
