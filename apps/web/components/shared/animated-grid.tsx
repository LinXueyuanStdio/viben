'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Children, isValidElement, useEffect, useState, ReactNode } from 'react';
import { cn } from '@/lib/utils/index';

// Easing curves
const easeOutExpo = [0.16, 1, 0.3, 1] as const;

interface AnimatedGridProps {
  children: ReactNode;
  className?: string;
}

/**
 * AnimatedGrid wraps children with staggered fade-in animation
 * Works with React Server Components by accepting children as props
 */
export function AnimatedGrid({ children, className }: AnimatedGridProps) {
  const [mounted, setMounted] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    setMounted(true);
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: prefersReducedMotion ? 0 : 0.06,
        delayChildren: prefersReducedMotion ? 0 : 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: {
      opacity: 0,
      y: prefersReducedMotion ? 0 : 12,
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: prefersReducedMotion ? 0 : 0.4,
        ease: easeOutExpo,
      },
    },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate={mounted ? 'visible' : 'hidden'}
      className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-3', className)}
    >
      {Children.map(children, (child) => {
        if (!isValidElement(child)) return child;
        return (
          <motion.div key={child.key} variants={itemVariants}>
            {child}
          </motion.div>
        );
      })}
    </motion.div>
  );
}
