'use client';

import { useRef } from 'react';
import { useInView } from './use-in-view';

type AgentName = 'Claude Desktop' | 'Claude Code' | 'Cursor' | 'Windsurf' | 'Cline' | 'Gemini CLI';

interface AgentBadgeProps {
  name: AgentName;
  index: number;
}

const agentConfig: Record<AgentName, {
  iconSrc: string;
  color: string;
  glowColor: string;
}> = {
  'Claude Desktop': {
    iconSrc: '/icons/agents/claude.svg',
    color: '#D97757',
    glowColor: 'rgba(217, 119, 87, 0.4)',
  },
  'Claude Code': {
    iconSrc: '/icons/agents/claude.svg',
    color: '#D97757',
    glowColor: 'rgba(217, 119, 87, 0.4)',
  },
  Cursor: {
    iconSrc: '/icons/agents/cursor.svg',
    color: '#000000',
    glowColor: 'rgba(255, 255, 255, 0.3)',
  },
  Windsurf: {
    iconSrc: '/icons/agents/windsurf.svg',
    color: '#00D1FF',
    glowColor: 'rgba(0, 209, 255, 0.4)',
  },
  Cline: {
    iconSrc: '/icons/agents/cline.svg',
    color: '#EC6547',
    glowColor: 'rgba(236, 101, 71, 0.4)',
  },
  'Gemini CLI': {
    iconSrc: '/icons/agents/gemini-cli.svg',
    color: '#8B5CF6',
    glowColor: 'rgba(139, 92, 246, 0.4)',
  },
};

export function AgentBadge({ name, index }: AgentBadgeProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref);
  const config = agentConfig[name];

  return (
    <div
      ref={ref}
      className={`group relative rounded-full border border-white/15 bg-white/[0.03] px-5 py-2 text-sm font-medium transition-all duration-300 hover:border-white/30 hover:bg-white/[0.06] ${
        isInView ? 'animate-bounce-in' : 'opacity-0'
      }`}
      style={{ animationDelay: `${index * 0.1}s` }}
    >
      {/* 背景光晕 SVG */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id={`glow-${name.replace(/\s/g, '-')}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={config.glowColor} />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
        </defs>
        {/* 呼吸光环 */}
        <ellipse
          cx="50%"
          cy="50%"
          rx="60%"
          ry="80%"
          fill={`url(#glow-${name.replace(/\s/g, '-')})`}
          className="animate-pulse-glow opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        />
      </svg>

      {/* 图标和文字 */}
      <div className="relative flex items-center gap-2">
        <span className="transition-transform duration-300 group-hover:scale-110">
          <img
            src={config.iconSrc}
            alt=""
            width={18}
            height={18}
            className="transition-all duration-300"
          />
        </span>
        <span>{name}</span>
      </div>
    </div>
  );
}

export function AgentBadgeList({ agents }: { agents: readonly AgentName[] }) {
  return (
    <div className="flex flex-wrap justify-center gap-3">
      {agents.map((name, index) => (
        <AgentBadge key={name} name={name} index={index} />
      ))}
    </div>
  );
}
