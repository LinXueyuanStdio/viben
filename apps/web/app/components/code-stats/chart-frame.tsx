'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

interface ChartFrameProps {
  className: string;
  children: ReactNode;
}

export function ChartFrame({ className, children }: ChartFrameProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return <div className={className}>{isMounted ? children : null}</div>;
}
