import { useId } from 'react';
import { cn } from '@/lib/utils';

interface NotFoundIllustrationProps {
  className?: string;
}

export function NotFoundIllustration({ className }: NotFoundIllustrationProps) {
  const id = useId();
  const gradientId = `nf-grad-${id}`;
  const glowId = `nf-glow-${id}`;

  return (
    <svg
      viewBox="0 0 480 260"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('w-full max-w-[480px]', className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--primary)" />
          <stop offset="100%" stopColor="color-mix(in oklch, var(--primary) 50%, var(--destructive))" />
        </linearGradient>
        <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.08" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* 背景光晕 */}
      <ellipse cx="240" cy="130" rx="200" ry="120" fill={`url(#${glowId})`} />

      {/* === 左侧：破碎的页面 === */}
      <g transform="translate(110, 48)">
        {/* 页面主体 */}
        <rect
          x="0" y="0" width="120" height="150" rx="8"
          fill="var(--card)" stroke="var(--border)" strokeWidth="1.5"
        />
        {/* 右上角折角 */}
        <path
          d="M96 0 L120 0 L120 24 L96 0Z"
          fill="var(--muted)" stroke="var(--border)" strokeWidth="1"
        />
        {/* 页面横线（模拟文字行） */}
        <rect x="16" y="24" width="64" height="5" rx="2.5" fill="var(--muted)" />
        <rect x="16" y="38" width="80" height="5" rx="2.5" fill="var(--muted)" opacity="0.7" />
        <rect x="16" y="52" width="56" height="5" rx="2.5" fill="var(--muted)" opacity="0.5" />
        <rect x="16" y="66" width="72" height="5" rx="2.5" fill="var(--muted)" opacity="0.3" />
        <rect x="16" y="88" width="40" height="5" rx="2.5" fill="var(--muted)" opacity="0.5" />
        <rect x="16" y="102" width="60" height="5" rx="2.5" fill="var(--muted)" opacity="0.3" />

        {/* 右下角缺失块 — 表示"破碎" */}
        <path
          d="M120 130 L120 150 L70 150 L80 138 L70 130Z"
          fill="var(--background)" stroke="var(--border)" strokeWidth="1.5" strokeDasharray="4 3"
          opacity="0.6"
        />

        {/* 飘出的碎片 */}
        <rect x="128" y="132" width="14" height="10" rx="2"
          fill="var(--card)" stroke="var(--border)" strokeWidth="1"
          transform="rotate(15 135 137)"
          opacity="0.8"
        />
        <rect x="118" y="148" width="10" height="8" rx="2"
          fill="var(--card)" stroke="var(--border)" strokeWidth="1"
          transform="rotate(-20 123 152)"
          opacity="0.6"
        />
      </g>

      {/* === 右侧：问号（搜索/找不到） === */}
      <g transform="translate(340, 100)">
        <circle cx="24" cy="24" r="24" fill={`url(#${gradientId})`} opacity="0.12" />
        <circle cx="24" cy="24" r="20" fill="var(--card)" stroke={`url(#${gradientId})`} strokeWidth="2" />
        {/* ? 形状 */}
        <text
          x="24" y="31"
          textAnchor="middle"
          fontFamily="var(--font-sans)"
          fontSize="22"
          fontWeight="700"
          fill={`url(#${gradientId})`}
        >
          ?
        </text>
      </g>

      {/* === 中间：断开的连接线 === */}
      {/* 左 → 右上 */}
      <line x1="230" y1="100" x2="316" y2="100"
        stroke="var(--border)" strokeWidth="1.5" strokeDasharray="6 4"
      />
      {/* 断开点 */}
      <circle cx="273" cy="100" r="3" fill="var(--destructive)" opacity="0.6" />

      {/* === 装饰性几何元素 === */}
      {/* 左上小方块 */}
      <rect x="72" y="36" width="10" height="10" rx="2"
        fill={`url(#${gradientId})`} opacity="0.3"
        transform="rotate(45 77 41)"
      />

      {/* 右上小圆点 */}
      <circle cx="380" cy="60" r="4" fill={`url(#${gradientId})`} opacity="0.4" />

      {/* 左下小三角 */}
      <path d="M88 195 L98 212 L78 212Z"
        fill={`url(#${gradientId})`} opacity="0.2"
      />

      {/* 底部横条 */}
      <rect x="160" y="228" width="24" height="4" rx="2"
        fill={`url(#${gradientId})`} opacity="0.25"
      />
      <rect x="190" y="228" width="12" height="4" rx="2"
        fill={`url(#${gradientId})`} opacity="0.15"
      />

      {/* 右侧装饰点组 */}
      <circle cx="430" cy="170" r="2.5" fill="var(--primary)" opacity="0.3" />
      <circle cx="440" cy="180" r="1.5" fill="var(--primary)" opacity="0.2" />

      {/* 散落的小方块 */}
      <rect x="342" y="190" width="6" height="6" rx="1.5"
        fill="var(--primary)" opacity="0.2" transform="rotate(25 345 193)"
      />
    </svg>
  );
}
