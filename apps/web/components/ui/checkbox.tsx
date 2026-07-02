'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

function Checkbox({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      className={cn(
        'h-4 w-4 rounded border-border text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2 accent-primary',
        className
      )}
      {...props}
    />
  );
}

export { Checkbox };
