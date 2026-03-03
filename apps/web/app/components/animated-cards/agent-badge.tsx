'use client';

import { useRef } from 'react';
import Claude from '@lobehub/icons/es/Claude';
import Cursor from '@lobehub/icons/es/Cursor';
import Windsurf from '@lobehub/icons/es/Windsurf';
import Cline from '@lobehub/icons/es/Cline';
import Gemini from '@lobehub/icons/es/Gemini';
import { useInView } from './use-in-view';

type AgentName = 'Claude Desktop' | 'Claude Code' | 'Cursor' | 'Windsurf' | 'Cline' | 'Gemini CLI';

interface AgentBadgeProps {
  name: AgentName;
  index: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type IconComponent = React.ComponentType<any>;

const agentConfig: Record<AgentName, {
  icon: IconComponent;
  color: string;
  glowColor: string;
}> = {
  'Claude Desktop': {
    icon: Claude.Color,
    color: '#D97757',
    glowColor: 'rgba(217, 119, 87, 0.4)',
  },
  'Claude Code': {
    icon: Claude.Color,
    color: '#D97757',
    glowColor: 'rgba(217, 119, 87, 0.4)',
  },
  Cursor: {
    icon: Cursor,
    color: '#000000',
    glowColor: 'rgba(255, 255, 255, 0.3)',
  },
  Windsurf: {
    icon: Windsurf,
    color: '#00D1FF',
    glowColor: 'rgba(0, 209, 255, 0.4)',
  },
  Cline: {
    icon: Cline,
    color: '#EC6547',
    glowColor: 'rgba(236, 101, 71, 0.4)',
  },
  'Gemini CLI': {
    icon: Gemini.Color,
    color: '#8B5CF6',
    glowColor: 'rgba(139, 92, 246, 0.4)',
  },
};

export function AgentBadge({ name, index }: AgentBadgeProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref);
  const config = agentConfig[name];
  const Icon = config.icon;

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
          <Icon size={18} className="transition-all duration-300" />
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
