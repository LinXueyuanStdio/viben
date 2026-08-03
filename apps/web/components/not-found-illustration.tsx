'use client';

import { useId } from 'react';
import { cn } from '@/lib/utils';

interface NotFoundIllustrationProps {
  className?: string;
}

export function NotFoundIllustration({ className }: NotFoundIllustrationProps) {
  const id = useId();
  const glowId = `nf-glow-${id}`;
  const amberId = `nf-amber-${id}`;
  const tealId = `nf-teal-${id}`;

  return (
    <svg
      viewBox="0 0 400 240"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('w-full max-w-[400px]', className)}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={glowId} cx="50%" cy="45%" r="50%">
          <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.06" />
          <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={amberId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FDB813" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>
        <linearGradient id={tealId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38B2AC" />
          <stop offset="100%" stopColor="#2C9A92" />
        </linearGradient>
      </defs>

      {/* 背景光晕 */}
      <ellipse cx="200" cy="100" rx="170" ry="100" fill={`url(#${glowId})`} />

      {/* === 中心：准星/指南针 === */}
      <g transform="translate(170, 115)">
        {/* 外圈 */}
        <circle cx="0" cy="0" r="42" fill="var(--color-card)" stroke="var(--color-border)" strokeWidth="2" />
        {/* 内圈虚线 */}
        <circle
          cx="0" cy="0" r="26"
          fill="none" stroke="var(--color-border)" strokeWidth="1.5"
          strokeDasharray="3 4" opacity="0.7"
        />
        {/* 中心点 */}
        <circle cx="0" cy="0" r="8" fill={`url(#${amberId})`} opacity="0.85" />
        <circle cx="0" cy="0" r="3" fill="var(--color-card)" />

        {/* 十字准线 */}
        <line x1="0" y1="-42" x2="0" y2="-16" stroke={`url(#${amberId})`} strokeWidth="2" strokeLinecap="round" opacity="0.45" />
        <line x1="0" y1="16" x2="0" y2="42" stroke={`url(#${amberId})`} strokeWidth="2" strokeLinecap="round" opacity="0.45" />
        <line x1="-42" y1="0" x2="-16" y2="0" stroke={`url(#${amberId})`} strokeWidth="2" strokeLinecap="round" opacity="0.45" />
        <line x1="16" y1="0" x2="42" y2="0" stroke={`url(#${amberId})`} strokeWidth="2" strokeLinecap="round" opacity="0.45" />
      </g>

      {/* === 漂浮几何图形 === */}

      {/* 右上：大圆角方块（teal） */}
      <g className="animate-float-slow">
        <rect x="270" y="58" width="44" height="44" rx="13" fill={`url(#${tealId})`} opacity="0.55" />
      </g>

      {/* 右下：胶囊形（amber） */}
      <g className="animate-float-slower">
        <rect x="290" y="160" width="56" height="18" rx="9" fill={`url(#${amberId})`} opacity="0.4" />
      </g>

      {/* 左上：小圆（teal） */}
      <g className="animate-float">
        <circle cx="105" cy="65" r="14" fill={`url(#${tealId})`} opacity="0.45" />
      </g>

      {/* 左中：菱形（amber） */}
      <g className="animate-float-slower">
        <rect x="88" y="138" width="18" height="18" rx="4" fill={`url(#${amberId})`} opacity="0.35" transform="rotate(45 97 147)" />
      </g>

      {/* 左上角小点 */}
      <g className="animate-float-slow">
        <circle cx="145" cy="45" r="4" fill={`url(#${amberId})`} opacity="0.4" />
      </g>

      {/* 右下额外小方块 */}
      <g className="animate-float">
        <rect x="355" y="130" width="12" height="12" rx="4" fill={`url(#${tealId})`} opacity="0.35" />
      </g>
    </svg>
  );
}
