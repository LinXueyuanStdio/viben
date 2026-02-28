import { useId } from 'react';
import { cn } from '@/lib/utils';

interface VibenLogoProps {
  className?: string;
  size?: number;
}

export function VibenLogo({ className, size = 24 }: VibenLogoProps) {
  const id = useId();
  const gradientId = `viben-bg-grad-${id}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(className)}
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: '#FDB813' }} />
          <stop offset="100%" style={{ stopColor: '#38B2AC' }} />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="100" height="100" rx="22" fill={`url(#${gradientId})`} />
      <path d="M28 30 L15 50 L28 70" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M38 32 L50 68 L62 32" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M72 30 L85 50 L72 70" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
