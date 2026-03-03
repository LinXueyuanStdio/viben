'use client';

import { useRef } from 'react';
import { useInView } from './use-in-view';

interface ChallengeCardProps {
  title: string;
  desc: string;
  variant: 'code-scatter' | 'agent-chaos' | 'cost-rise';
}

function CodeScatterSvg({ isInView }: { isInView: boolean }) {
  return (
    <svg viewBox="0 0 120 80" className="h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id="code-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#D6D876" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#D6D876" stopOpacity="0.3" />
        </linearGradient>
      </defs>
      {/* 代码块碎片 */}
      <g className={isInView ? 'animate-float-scatter' : 'opacity-0'} style={{ animationDelay: '0s' }}>
        <rect x="15" y="20" width="20" height="12" rx="2" fill="url(#code-gradient)" className="transition-all duration-300 group-hover:translate-x-[-5px] group-hover:translate-y-[-3px]" />
        <line x1="18" y1="24" x2="30" y2="24" stroke="#07070b" strokeWidth="1.5" />
        <line x1="18" y1="28" x2="28" y2="28" stroke="#07070b" strokeWidth="1.5" />
      </g>
      <g className={isInView ? 'animate-float-scatter' : 'opacity-0'} style={{ animationDelay: '0.1s' }}>
        <rect x="50" y="10" width="25" height="14" rx="2" fill="url(#code-gradient)" className="transition-all duration-300 group-hover:translate-x-[8px] group-hover:translate-y-[-5px]" />
        <line x1="53" y1="14" x2="68" y2="14" stroke="#07070b" strokeWidth="1.5" />
        <line x1="53" y1="18" x2="72" y2="18" stroke="#07070b" strokeWidth="1.5" />
      </g>
      <g className={isInView ? 'animate-float-scatter' : 'opacity-0'} style={{ animationDelay: '0.2s' }}>
        <rect x="85" y="25" width="18" height="10" rx="2" fill="url(#code-gradient)" className="transition-all duration-300 group-hover:translate-x-[6px] group-hover:translate-y-[4px]" />
        <line x1="88" y1="29" x2="98" y2="29" stroke="#07070b" strokeWidth="1.5" />
      </g>
      <g className={isInView ? 'animate-float-scatter' : 'opacity-0'} style={{ animationDelay: '0.3s' }}>
        <rect x="25" y="45" width="22" height="12" rx="2" fill="url(#code-gradient)" className="transition-all duration-300 group-hover:translate-x-[-4px] group-hover:translate-y-[5px]" />
        <line x1="28" y1="49" x2="42" y2="49" stroke="#07070b" strokeWidth="1.5" />
        <line x1="28" y1="53" x2="38" y2="53" stroke="#07070b" strokeWidth="1.5" />
      </g>
      <g className={isInView ? 'animate-float-scatter' : 'opacity-0'} style={{ animationDelay: '0.4s' }}>
        <rect x="60" y="50" width="24" height="14" rx="2" fill="url(#code-gradient)" className="transition-all duration-300 group-hover:translate-x-[5px] group-hover:translate-y-[6px]" />
        <line x1="63" y1="54" x2="78" y2="54" stroke="#07070b" strokeWidth="1.5" />
        <line x1="63" y1="58" x2="72" y2="58" stroke="#07070b" strokeWidth="1.5" />
      </g>
      {/* 断开的连线 */}
      <path
        d="M35 32 L45 35"
        stroke="rgba(214,216,118,0.3)"
        strokeWidth="1"
        strokeDasharray="3 3"
        className={isInView ? 'animate-pulse-glow' : 'opacity-0'}
      />
      <path
        d="M75 24 L82 27"
        stroke="rgba(214,216,118,0.3)"
        strokeWidth="1"
        strokeDasharray="3 3"
        className={isInView ? 'animate-pulse-glow' : 'opacity-0'}
        style={{ animationDelay: '0.5s' }}
      />
    </svg>
  );
}

function AgentChaosSvg({ isInView }: { isInView: boolean }) {
  return (
    <svg viewBox="0 0 120 80" className="h-full w-full" aria-hidden="true">
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* 混乱的连线 */}
      <g className={isInView ? 'opacity-100' : 'opacity-0'} style={{ transition: 'opacity 0.5s' }}>
        <path
          d="M25 25 Q50 10 75 30 Q90 45 60 55 Q30 60 40 35"
          stroke="rgba(214,216,118,0.3)"
          strokeWidth="1"
          fill="none"
          strokeDasharray="4 4"
          className={isInView ? 'animate-dash-flow group-hover:animate-shake' : ''}
        />
        <path
          d="M30 50 Q55 35 80 50 Q100 30 70 20"
          stroke="rgba(214,216,118,0.2)"
          strokeWidth="1"
          fill="none"
          strokeDasharray="4 4"
          className={isInView ? 'animate-dash-flow' : ''}
          style={{ animationDelay: '0.3s' }}
        />
        <path
          d="M45 15 Q20 40 50 60 Q80 70 95 45"
          stroke="rgba(214,216,118,0.25)"
          strokeWidth="1"
          fill="none"
          strokeDasharray="4 4"
          className={isInView ? 'animate-dash-flow' : ''}
          style={{ animationDelay: '0.6s' }}
        />
      </g>
      {/* 智能体节点 */}
      <g className={isInView ? 'animate-scale-in' : 'opacity-0'}>
        <circle cx="25" cy="25" r="8" fill="#0f0f16" stroke="#D6D876" strokeWidth="1.5" className="transition-all duration-300 group-hover:animate-shake" />
        <circle cx="25" cy="25" r="3" fill="#D6D876" className="animate-pulse-glow" />
      </g>
      <g className={isInView ? 'animate-scale-in' : 'opacity-0'} style={{ animationDelay: '0.1s' }}>
        <circle cx="75" cy="20" r="8" fill="#0f0f16" stroke="#D6D876" strokeWidth="1.5" className="transition-all duration-300 group-hover:animate-shake" style={{ animationDelay: '0.1s' }} />
        <circle cx="75" cy="20" r="3" fill="#D6D876" className="animate-pulse-glow" style={{ animationDelay: '0.2s' }} />
      </g>
      <g className={isInView ? 'animate-scale-in' : 'opacity-0'} style={{ animationDelay: '0.2s' }}>
        <circle cx="95" cy="45" r="8" fill="#0f0f16" stroke="#D6D876" strokeWidth="1.5" className="transition-all duration-300 group-hover:animate-shake" style={{ animationDelay: '0.2s' }} />
        <circle cx="95" cy="45" r="3" fill="#D6D876" className="animate-pulse-glow" style={{ animationDelay: '0.4s' }} />
      </g>
      <g className={isInView ? 'animate-scale-in' : 'opacity-0'} style={{ animationDelay: '0.3s' }}>
        <circle cx="60" cy="55" r="8" fill="#0f0f16" stroke="#D6D876" strokeWidth="1.5" className="transition-all duration-300 group-hover:animate-shake" style={{ animationDelay: '0.3s' }} />
        <circle cx="60" cy="55" r="3" fill="#D6D876" className="animate-pulse-glow" style={{ animationDelay: '0.6s' }} />
      </g>
      <g className={isInView ? 'animate-scale-in' : 'opacity-0'} style={{ animationDelay: '0.4s' }}>
        <circle cx="30" cy="55" r="8" fill="#0f0f16" stroke="#D6D876" strokeWidth="1.5" className="transition-all duration-300 group-hover:animate-shake" style={{ animationDelay: '0.4s' }} />
        <circle cx="30" cy="55" r="3" fill="#D6D876" className="animate-pulse-glow" style={{ animationDelay: '0.8s' }} />
      </g>
    </svg>
  );
}

function CostRiseSvg({ isInView }: { isInView: boolean }) {
  return (
    <svg viewBox="0 0 120 80" className="h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id="cost-gradient" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#D6D876" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#D6D876" stopOpacity="0.8" />
        </linearGradient>
      </defs>
      {/* 堆叠的方块 */}
      <g className={isInView ? 'animate-fade-in-up' : 'opacity-0'}>
        <rect x="15" y="55" width="16" height="12" rx="2" fill="url(#cost-gradient)" stroke="#D6D876" strokeWidth="0.5" />
      </g>
      <g className={isInView ? 'animate-fade-in-up' : 'opacity-0'} style={{ animationDelay: '0.1s' }}>
        <rect x="15" y="41" width="16" height="12" rx="2" fill="url(#cost-gradient)" stroke="#D6D876" strokeWidth="0.5" />
      </g>
      <g className={isInView ? 'animate-fade-in-up' : 'opacity-0'} style={{ animationDelay: '0.2s' }}>
        <rect x="15" y="27" width="16" height="12" rx="2" fill="url(#cost-gradient)" stroke="#D6D876" strokeWidth="0.5" />
      </g>
      <g className={isInView ? 'animate-fade-in-up group-hover:animate-cost-rise' : 'opacity-0'} style={{ animationDelay: '0.3s' }}>
        <rect x="15" y="13" width="16" height="12" rx="2" fill="url(#cost-gradient)" stroke="#D6D876" strokeWidth="0.5" />
      </g>
      {/* 上升曲线 */}
      <path
        d="M45 65 Q55 60 65 50 Q75 38 85 28 Q95 18 105 10"
        stroke="#D6D876"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeDasharray="100"
        className={isInView ? 'animate-draw-line' : 'opacity-0'}
        style={{ animationDelay: '0.4s' }}
      />
      {/* 曲线下方填充 */}
      <path
        d="M45 65 Q55 60 65 50 Q75 38 85 28 Q95 18 105 10 L105 65 Z"
        fill="rgba(214,216,118,0.1)"
        className={isInView ? 'animate-fade-in-up' : 'opacity-0'}
        style={{ animationDelay: '0.6s' }}
      />
      {/* 警告箭头 */}
      <g className={isInView ? 'animate-float' : 'opacity-0'} style={{ animationDelay: '0.8s' }}>
        <path d="M100 15 L105 8 L110 15" stroke="#D6D876" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="105" y1="8" x2="105" y2="3" stroke="#D6D876" strokeWidth="2" strokeLinecap="round" />
      </g>
      {/* 基线 */}
      <line x1="10" y1="68" x2="115" y2="68" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
    </svg>
  );
}

export function ChallengeCard({ title, desc, variant }: ChallengeCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref);

  const SvgComponent = {
    'code-scatter': CodeScatterSvg,
    'agent-chaos': AgentChaosSvg,
    'cost-rise': CostRiseSvg,
  }[variant];

  return (
    <article
      ref={ref}
      className="group rounded-xl border border-white/10 bg-white/[0.03] p-6 transition-all duration-300 hover:border-amber-300/30 hover:bg-white/[0.05]"
    >
      <div className="mb-4 h-20 w-full overflow-hidden rounded-lg bg-[#0a0a0f]">
        <SvgComponent isInView={isInView} />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-zinc-300">{desc}</p>
    </article>
  );
}
