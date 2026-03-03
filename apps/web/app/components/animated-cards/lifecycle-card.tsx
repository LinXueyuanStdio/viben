'use client';

import { useRef } from 'react';
import { useInView } from './use-in-view';

interface LifecycleCardProps {
  title: string;
  desc: string;
  step: number;
  variant: 'define' | 'execute' | 'review' | 'iterate';
}

function DefineGoalSvg({ isInView }: { isInView: boolean }) {
  return (
    <svg viewBox="0 0 120 80" className="h-full w-full" aria-hidden="true">
      <defs>
        <filter id="glow-define">
          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* 中心光点 */}
      <circle
        cx="20"
        cy="40"
        r="6"
        fill="#D6D876"
        filter="url(#glow-define)"
        className={isInView ? 'animate-pulse-glow' : 'opacity-0'}
      />
      {/* 任务树分支 */}
      <g className={isInView ? 'opacity-100' : 'opacity-0'} style={{ transition: 'opacity 0.3s' }}>
        {/* 主干 */}
        <line
          x1="26"
          y1="40"
          x2="45"
          y2="40"
          stroke="#D6D876"
          strokeWidth="2"
          strokeDasharray="20"
          className={isInView ? 'animate-draw-line' : ''}
        />
        {/* 第一层分支 */}
        <line
          x1="45"
          y1="40"
          x2="60"
          y2="25"
          stroke="#D6D876"
          strokeWidth="1.5"
          strokeDasharray="25"
          className={isInView ? 'animate-draw-line' : ''}
          style={{ animationDelay: '0.2s' }}
        />
        <line
          x1="45"
          y1="40"
          x2="60"
          y2="40"
          stroke="#D6D876"
          strokeWidth="1.5"
          strokeDasharray="15"
          className={isInView ? 'animate-draw-line' : ''}
          style={{ animationDelay: '0.3s' }}
        />
        <line
          x1="45"
          y1="40"
          x2="60"
          y2="55"
          stroke="#D6D876"
          strokeWidth="1.5"
          strokeDasharray="25"
          className={isInView ? 'animate-draw-line' : ''}
          style={{ animationDelay: '0.4s' }}
        />
        {/* 第二层分支 */}
        <line
          x1="60"
          y1="25"
          x2="80"
          y2="15"
          stroke="#D6D876"
          strokeWidth="1"
          strokeOpacity="0.7"
          strokeDasharray="25"
          className={isInView ? 'animate-draw-line' : ''}
          style={{ animationDelay: '0.5s' }}
        />
        <line
          x1="60"
          y1="25"
          x2="80"
          y2="30"
          stroke="#D6D876"
          strokeWidth="1"
          strokeOpacity="0.7"
          strokeDasharray="22"
          className={isInView ? 'animate-draw-line' : ''}
          style={{ animationDelay: '0.55s' }}
        />
        <line
          x1="60"
          y1="55"
          x2="80"
          y2="50"
          stroke="#D6D876"
          strokeWidth="1"
          strokeOpacity="0.7"
          strokeDasharray="22"
          className={isInView ? 'animate-draw-line' : ''}
          style={{ animationDelay: '0.6s' }}
        />
        <line
          x1="60"
          y1="55"
          x2="80"
          y2="65"
          stroke="#D6D876"
          strokeWidth="1"
          strokeOpacity="0.7"
          strokeDasharray="25"
          className={isInView ? 'animate-draw-line' : ''}
          style={{ animationDelay: '0.65s' }}
        />
      </g>
      {/* 叶子节点 */}
      {[
        { cx: 60, cy: 25, delay: '0.4s' },
        { cx: 60, cy: 40, delay: '0.5s' },
        { cx: 60, cy: 55, delay: '0.6s' },
        { cx: 80, cy: 15, delay: '0.7s' },
        { cx: 80, cy: 30, delay: '0.75s' },
        { cx: 80, cy: 50, delay: '0.8s' },
        { cx: 80, cy: 65, delay: '0.85s' },
      ].map(({ cx, cy, delay }) => (
        <circle
          key={`${cx}-${cy}`}
          cx={cx}
          cy={cy}
          r="4"
          fill="#0f0f16"
          stroke="#D6D876"
          strokeWidth="1.5"
          className={isInView ? 'animate-scale-in group-hover:animate-pulse-glow' : 'opacity-0'}
          style={{ animationDelay: delay }}
        />
      ))}
      {/* 第三层延伸线（悬停显示） */}
      <g className="opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        <line x1="80" y1="15" x2="100" y2="10" stroke="#D6D876" strokeWidth="0.5" strokeOpacity="0.5" />
        <line x1="80" y1="15" x2="100" y2="18" stroke="#D6D876" strokeWidth="0.5" strokeOpacity="0.5" />
        <line x1="80" y1="65" x2="100" y2="62" stroke="#D6D876" strokeWidth="0.5" strokeOpacity="0.5" />
        <line x1="80" y1="65" x2="100" y2="70" stroke="#D6D876" strokeWidth="0.5" strokeOpacity="0.5" />
        <circle cx="100" cy="10" r="2" fill="#D6D876" fillOpacity="0.5" />
        <circle cx="100" cy="18" r="2" fill="#D6D876" fillOpacity="0.5" />
        <circle cx="100" cy="62" r="2" fill="#D6D876" fillOpacity="0.5" />
        <circle cx="100" cy="70" r="2" fill="#D6D876" fillOpacity="0.5" />
      </g>
    </svg>
  );
}

function ParallelExecuteSvg({ isInView }: { isInView: boolean }) {
  return (
    <svg viewBox="0 0 120 80" className="h-full w-full" aria-hidden="true">
      {/* 三列看板 */}
      <g className={isInView ? 'animate-fade-in-up' : 'opacity-0'}>
        <rect x="10" y="10" width="30" height="60" rx="3" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
        <text x="25" y="22" fontSize="6" fill="rgba(255,255,255,0.4)" textAnchor="middle">TODO</text>
      </g>
      <g className={isInView ? 'animate-fade-in-up' : 'opacity-0'} style={{ animationDelay: '0.1s' }}>
        <rect x="45" y="10" width="30" height="60" rx="3" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
        <text x="60" y="22" fontSize="6" fill="rgba(255,255,255,0.4)" textAnchor="middle">DOING</text>
      </g>
      <g className={isInView ? 'animate-fade-in-up' : 'opacity-0'} style={{ animationDelay: '0.2s' }}>
        <rect x="80" y="10" width="30" height="60" rx="3" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
        <text x="95" y="22" fontSize="6" fill="rgba(255,255,255,0.4)" textAnchor="middle">DONE</text>
      </g>
      {/* 卡片 */}
      <g className={isInView ? 'animate-slide-in-left' : 'opacity-0'} style={{ animationDelay: '0.3s' }}>
        <rect x="13" y="28" width="24" height="14" rx="2" fill="#D6D876" fillOpacity="0.2" stroke="#D6D876" strokeWidth="1" />
      </g>
      <g className={isInView ? 'animate-slide-in-left' : 'opacity-0'} style={{ animationDelay: '0.4s' }}>
        <rect x="13" y="46" width="24" height="14" rx="2" fill="#D6D876" fillOpacity="0.15" stroke="#D6D876" strokeWidth="1" strokeOpacity="0.7" />
      </g>
      {/* 移动中的卡片 */}
      <g className={isInView ? 'animate-slide-in-left group-hover:translate-x-[35px] transition-transform duration-700' : 'opacity-0'} style={{ animationDelay: '0.5s' }}>
        <rect x="48" y="28" width="24" height="14" rx="2" fill="#D6D876" fillOpacity="0.3" stroke="#D6D876" strokeWidth="1" />
      </g>
      {/* 完成的卡片 */}
      <g className={isInView ? 'animate-slide-in-left' : 'opacity-0'} style={{ animationDelay: '0.6s' }}>
        <rect x="83" y="28" width="24" height="14" rx="2" fill="#D6D876" fillOpacity="0.4" stroke="#D6D876" strokeWidth="1" />
        <path d="M90 35 L94 39 L100 31" stroke="#D6D876" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g className={isInView ? 'animate-slide-in-left' : 'opacity-0'} style={{ animationDelay: '0.7s' }}>
        <rect x="83" y="46" width="24" height="14" rx="2" fill="#D6D876" fillOpacity="0.4" stroke="#D6D876" strokeWidth="1" />
        <path d="M90 53 L94 57 L100 49" stroke="#D6D876" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

function ReviewReleaseSvg({ isInView }: { isInView: boolean }) {
  return (
    <svg viewBox="0 0 120 80" className="h-full w-full" aria-hidden="true">
      {/* 检查清单 */}
      <g className={isInView ? 'animate-fade-in-up' : 'opacity-0'}>
        <rect x="10" y="12" width="55" height="56" rx="4" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
      </g>
      {/* 清单项 */}
      {[
        { y: 22, delay: '0.2s' },
        { y: 36, delay: '0.4s' },
        { y: 50, delay: '0.6s' },
      ].map(({ y, delay }, i) => (
        <g key={y} className={isInView ? 'animate-fade-in-up' : 'opacity-0'} style={{ animationDelay: delay }}>
          <rect x="16" y={y} width="8" height="8" rx="2" fill="none" stroke="#D6D876" strokeWidth="1" />
          <path
            d={`M${18} ${y + 4} L${20} ${y + 6} L${24} ${y + 2}`}
            stroke="#D6D876"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={isInView ? 'animate-check-draw' : 'opacity-0'}
            style={{ animationDelay: `${parseFloat(delay) + 0.2}s` }}
          />
          <rect x="28" y={y + 1} width="32" height="3" rx="1" fill="rgba(255,255,255,0.2)" />
          <rect x="28" y={y + 5} width="20" height="2" rx="1" fill="rgba(255,255,255,0.1)" />
        </g>
      ))}
      {/* 盾牌图标 */}
      <g className={isInView ? 'animate-scale-in' : 'opacity-0'} style={{ animationDelay: '0.8s' }}>
        <path
          d="M90 20 L90 45 Q90 55 80 60 Q70 55 70 45 L70 20 L80 15 L90 20 Z"
          fill="rgba(214,216,118,0.2)"
          stroke="#D6D876"
          strokeWidth="1.5"
          className="group-hover:animate-pulse-glow"
        />
        <path
          d="M76 38 L79 42 L86 32"
          stroke="#D6D876"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={isInView ? 'animate-check-draw' : 'opacity-0'}
          style={{ animationDelay: '1s' }}
        />
      </g>
      {/* 保护光环（悬停） */}
      <circle
        cx="80"
        cy="40"
        r="25"
        fill="none"
        stroke="#D6D876"
        strokeWidth="1"
        strokeOpacity="0"
        className="transition-all duration-500 group-hover:stroke-opacity-30"
        strokeDasharray="4 4"
      />
      <circle
        cx="80"
        cy="40"
        r="30"
        fill="none"
        stroke="#D6D876"
        strokeWidth="0.5"
        strokeOpacity="0"
        className="transition-all duration-500 group-hover:stroke-opacity-20"
        strokeDasharray="2 4"
      />
    </svg>
  );
}

function ContinuousIterateSvg({ isInView }: { isInView: boolean }) {
  return (
    <svg viewBox="0 0 120 80" className="h-full w-full" aria-hidden="true">
      {/* 循环箭头 */}
      <g className={isInView ? 'animate-rotate group-hover:[animation-duration:2s]' : 'opacity-0'} style={{ transformOrigin: '40px 40px' }}>
        <path
          d="M40 15 A25 25 0 1 1 15 40"
          stroke="#D6D876"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />
        <polygon points="40,10 45,18 35,18" fill="#D6D876" />
        <path
          d="M40 65 A25 25 0 1 1 65 40"
          stroke="#D6D876"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeOpacity="0.6"
        />
        <polygon points="40,70 35,62 45,62" fill="#D6D876" fillOpacity="0.6" />
      </g>
      {/* 中心点 */}
      <circle
        cx="40"
        cy="40"
        r="5"
        fill="#D6D876"
        className={isInView ? 'animate-pulse-glow' : 'opacity-0'}
      />
      {/* 版本号 */}
      <g className={isInView ? 'animate-fade-in-up' : 'opacity-0'} style={{ animationDelay: '0.3s' }}>
        <rect x="75" y="15" width="35" height="14" rx="3" fill="rgba(214,216,118,0.1)" stroke="#D6D876" strokeWidth="1" strokeOpacity="0.3" />
        <text x="92" y="25" fontSize="8" fill="rgba(255,255,255,0.4)" textAnchor="middle">v1.0</text>
      </g>
      <g className={isInView ? 'animate-fade-in-up' : 'opacity-0'} style={{ animationDelay: '0.5s' }}>
        <rect x="75" y="33" width="35" height="14" rx="3" fill="rgba(214,216,118,0.15)" stroke="#D6D876" strokeWidth="1" strokeOpacity="0.5" />
        <text x="92" y="43" fontSize="8" fill="rgba(255,255,255,0.6)" textAnchor="middle">v2.0</text>
      </g>
      <g className={isInView ? 'animate-fade-in-up' : 'opacity-0'} style={{ animationDelay: '0.7s' }}>
        <rect x="75" y="51" width="35" height="14" rx="3" fill="rgba(214,216,118,0.25)" stroke="#D6D876" strokeWidth="1" />
        <text x="92" y="61" fontSize="8" fill="#D6D876" textAnchor="middle">v3.0</text>
      </g>
      {/* 连接箭头 */}
      <path
        d="M65 40 L72 40"
        stroke="#D6D876"
        strokeWidth="1"
        strokeOpacity="0.5"
        strokeDasharray="2 2"
        className={isInView ? 'animate-dash-flow' : 'opacity-0'}
      />
    </svg>
  );
}

export function LifecycleCard({ title, desc, step, variant }: LifecycleCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref);

  const SvgComponent = {
    define: DefineGoalSvg,
    execute: ParallelExecuteSvg,
    review: ReviewReleaseSvg,
    iterate: ContinuousIterateSvg,
  }[variant];

  return (
    <article
      ref={ref}
      className="group rounded-xl border border-white/10 bg-[#0f0f16] p-5 transition-all duration-300 hover:border-amber-300/30 hover:bg-[#121218]"
    >
      <div className="mb-4 h-20 w-full overflow-hidden rounded-lg bg-[#0a0a0f]">
        <SvgComponent isInView={isInView} />
      </div>
      <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Step {step}</p>
      <h3 className="mt-2 font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm text-zinc-300">{desc}</p>
    </article>
  );
}
