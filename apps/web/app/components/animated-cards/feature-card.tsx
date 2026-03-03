'use client';

import { useRef } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  Layers,
  LayoutGrid,
  Monitor,
  Users,
} from 'lucide-react';
import { useInView } from './use-in-view';

type FeatureVariant = 'kanban' | 'calendar' | 'mcp' | 'agents' | 'desktop' | 'release';

interface FeatureCardProps {
  title: string;
  desc: string;
  variant: FeatureVariant;
}

const iconMap = {
  kanban: LayoutGrid,
  calendar: CalendarDays,
  mcp: Layers,
  agents: Users,
  desktop: Monitor,
  release: CheckCircle2,
};

function KanbanSvg({ isInView }: { isInView: boolean }) {
  return (
    <svg viewBox="0 0 120 80" className="h-full w-full" aria-hidden="true">
      {/* 三列 */}
      {[15, 45, 75].map((x, i) => (
        <rect
          key={x}
          x={x}
          y="8"
          width="28"
          height="64"
          rx="3"
          fill="rgba(255,255,255,0.02)"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="1"
          className={isInView ? 'animate-fade-in-up' : 'opacity-0'}
          style={{ animationDelay: `${i * 0.1}s` }}
        />
      ))}
      {/* 卡片 - 第一列 */}
      <rect x="18" y="16" width="22" height="12" rx="2" fill="rgba(214,216,118,0.2)" stroke="#D6D876" strokeWidth="0.5"
        className={isInView ? 'animate-scale-in' : 'opacity-0'} style={{ animationDelay: '0.2s' }} />
      <rect x="18" y="32" width="22" height="12" rx="2" fill="rgba(214,216,118,0.15)" stroke="#D6D876" strokeWidth="0.5" strokeOpacity="0.7"
        className={isInView ? 'animate-scale-in' : 'opacity-0'} style={{ animationDelay: '0.3s' }} />
      {/* 移动的卡片 */}
      <rect x="18" y="48" width="22" height="12" rx="2" fill="rgba(214,216,118,0.25)" stroke="#D6D876" strokeWidth="1"
        className={`${isInView ? 'animate-scale-in' : 'opacity-0'} transition-transform duration-700 group-hover:translate-x-[60px] group-hover:translate-y-[-32px]`}
        style={{ animationDelay: '0.4s' }} />
      {/* 卡片 - 第二列 */}
      <rect x="48" y="16" width="22" height="12" rx="2" fill="rgba(214,216,118,0.2)" stroke="#D6D876" strokeWidth="0.5"
        className={isInView ? 'animate-scale-in' : 'opacity-0'} style={{ animationDelay: '0.35s' }} />
      {/* 卡片 - 第三列 */}
      <rect x="78" y="16" width="22" height="12" rx="2" fill="rgba(214,216,118,0.3)" stroke="#D6D876" strokeWidth="0.5"
        className={isInView ? 'animate-scale-in' : 'opacity-0'} style={{ animationDelay: '0.4s' }} />
      <path d="M84 22 L87 25 L92 19" stroke="#D6D876" strokeWidth="1.5" fill="none" strokeLinecap="round"
        className={isInView ? 'animate-check-draw' : 'opacity-0'} style={{ animationDelay: '0.6s' }} />
    </svg>
  );
}

function CalendarSvg({ isInView }: { isInView: boolean }) {
  return (
    <svg viewBox="0 0 120 80" className="h-full w-full" aria-hidden="true">
      {/* 日历框架 */}
      <rect x="15" y="10" width="90" height="60" rx="4" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.1)" strokeWidth="1"
        className={isInView ? 'animate-fade-in-up' : 'opacity-0'} />
      {/* 日历头部 */}
      <rect x="15" y="10" width="90" height="12" rx="4" fill="rgba(214,216,118,0.1)"
        className={isInView ? 'animate-fade-in-up' : 'opacity-0'} style={{ animationDelay: '0.1s' }} />
      {/* 日期格子 */}
      {[0, 1, 2, 3, 4, 5, 6].map((col) =>
        [0, 1, 2, 3].map((row) => {
          const x = 20 + col * 12;
          const y = 28 + row * 10;
          const isHighlight = (col === 2 && row === 1) || (col === 4 && row === 2) || (col === 5 && row === 3);
          const delay = `${0.2 + row * 0.05 + col * 0.02}s`;
          return (
            <rect
              key={`${col}-${row}`}
              x={x}
              y={y}
              width="10"
              height="8"
              rx="1"
              fill={isHighlight ? 'rgba(214,216,118,0.4)' : 'rgba(255,255,255,0.03)'}
              stroke={isHighlight ? '#D6D876' : 'transparent'}
              strokeWidth="0.5"
              className={`${isInView ? 'animate-scale-in' : 'opacity-0'} ${isHighlight ? 'group-hover:animate-pulse-glow' : ''}`}
              style={{ animationDelay: delay }}
            />
          );
        })
      )}
      {/* 时间线指示 */}
      <line x1="32" y1="36" x2="68" y2="48" stroke="#D6D876" strokeWidth="2" strokeLinecap="round"
        strokeDasharray="50" className={isInView ? 'animate-draw-line' : 'opacity-0'} style={{ animationDelay: '0.5s' }} />
      <circle cx="32" cy="36" r="3" fill="#D6D876" className={isInView ? 'animate-scale-in' : 'opacity-0'} style={{ animationDelay: '0.6s' }} />
      <circle cx="68" cy="48" r="3" fill="#D6D876" className={isInView ? 'animate-scale-in' : 'opacity-0'} style={{ animationDelay: '0.7s' }} />
    </svg>
  );
}

function McpIntegrationSvg({ isInView }: { isInView: boolean }) {
  return (
    <svg viewBox="0 0 120 80" className="h-full w-full" aria-hidden="true">
      <defs>
        <filter id="glow-mcp">
          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* 中心 Hub */}
      <circle cx="60" cy="40" r="12" fill="#0f0f16" stroke="#D6D876" strokeWidth="2"
        className={isInView ? 'animate-scale-in' : 'opacity-0'} filter="url(#glow-mcp)" />
      <text x="60" y="44" fontSize="8" fill="#D6D876" textAnchor="middle" fontWeight="bold"
        className={isInView ? 'animate-fade-in-up' : 'opacity-0'} style={{ animationDelay: '0.2s' }}>MCP</text>
      {/* 连接线和端点 */}
      {[
        { cx: 20, cy: 20, angle: -135 },
        { cx: 100, cy: 20, angle: -45 },
        { cx: 20, cy: 60, angle: 135 },
        { cx: 100, cy: 60, angle: 45 },
        { cx: 60, cy: 8, angle: -90 },
        { cx: 60, cy: 72, angle: 90 },
      ].map(({ cx, cy, angle }, i) => (
        <g key={i}>
          <line x1="60" y1="40" x2={cx} y2={cy} stroke="#D6D876" strokeWidth="1" strokeOpacity="0.4"
            strokeDasharray="40" className={isInView ? 'animate-draw-line' : 'opacity-0'} style={{ animationDelay: `${0.1 + i * 0.1}s` }} />
          <circle cx={cx} cy={cy} r="6" fill="#0f0f16" stroke="#D6D876" strokeWidth="1"
            className={isInView ? 'animate-scale-in' : 'opacity-0'} style={{ animationDelay: `${0.3 + i * 0.1}s` }} />
          {/* 数据流脉冲 */}
          <circle cx={cx} cy={cy} r="2" fill="#D6D876"
            className={`${isInView ? 'animate-pulse-glow' : 'opacity-0'} group-hover:animate-pulse-glow`}
            style={{ animationDelay: `${0.4 + i * 0.15}s` }} />
        </g>
      ))}
    </svg>
  );
}

function MultiAgentsSvg({ isInView }: { isInView: boolean }) {
  return (
    <svg viewBox="0 0 120 80" className="h-full w-full" aria-hidden="true">
      {/* 中心任务 */}
      <rect x="45" y="30" width="30" height="20" rx="3" fill="rgba(214,216,118,0.2)" stroke="#D6D876" strokeWidth="1"
        className={isInView ? 'animate-scale-in' : 'opacity-0'} />
      <line x1="50" y1="37" x2="70" y2="37" stroke="#D6D876" strokeWidth="1" strokeOpacity="0.5" />
      <line x1="50" y1="43" x2="65" y2="43" stroke="#D6D876" strokeWidth="1" strokeOpacity="0.3" />
      {/* 智能体头像 */}
      {[
        { cx: 25, cy: 25, delay: '0.2s' },
        { cx: 95, cy: 25, delay: '0.3s' },
        { cx: 25, cy: 55, delay: '0.4s' },
        { cx: 95, cy: 55, delay: '0.5s' },
      ].map(({ cx, cy, delay }, i) => (
        <g key={i}>
          {/* 连接线 */}
          <line x1={cx} y1={cy} x2="60" y2="40" stroke="#D6D876" strokeWidth="1" strokeOpacity="0.3"
            strokeDasharray="30" className={isInView ? 'animate-draw-line' : 'opacity-0'} style={{ animationDelay: delay }} />
          {/* 头像 */}
          <circle cx={cx} cy={cy} r="10" fill="#0f0f16" stroke="#D6D876" strokeWidth="1.5"
            className={isInView ? 'animate-scale-in' : 'opacity-0'} style={{ animationDelay: delay }} />
          {/* 眼睛 */}
          <circle cx={cx - 3} cy={cy - 2} r="1.5" fill="#D6D876"
            className={isInView ? 'animate-scale-in' : 'opacity-0'} style={{ animationDelay: `${parseFloat(delay) + 0.1}s` }} />
          <circle cx={cx + 3} cy={cy - 2} r="1.5" fill="#D6D876"
            className={isInView ? 'animate-scale-in' : 'opacity-0'} style={{ animationDelay: `${parseFloat(delay) + 0.1}s` }} />
          {/* 嘴巴 */}
          <path d={`M${cx - 3} ${cy + 3} Q${cx} ${cy + 5} ${cx + 3} ${cy + 3}`} stroke="#D6D876" strokeWidth="1" fill="none"
            className={isInView ? 'animate-fade-in-up' : 'opacity-0'} style={{ animationDelay: `${parseFloat(delay) + 0.15}s` }} />
        </g>
      ))}
      {/* 对话气泡（悬停） */}
      <g className="opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        <ellipse cx="38" cy="18" rx="8" ry="5" fill="rgba(214,216,118,0.3)" />
        <ellipse cx="82" cy="18" rx="8" ry="5" fill="rgba(214,216,118,0.3)" />
        <text x="38" y="20" fontSize="6" fill="#D6D876" textAnchor="middle">...</text>
        <text x="82" y="20" fontSize="6" fill="#D6D876" textAnchor="middle">...</text>
      </g>
    </svg>
  );
}

function DesktopWorkspaceSvg({ isInView }: { isInView: boolean }) {
  return (
    <svg viewBox="0 0 120 80" className="h-full w-full" aria-hidden="true">
      {/* 显示器外框 */}
      <rect x="15" y="8" width="90" height="55" rx="4" fill="#0a0a0f" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5"
        className={isInView ? 'animate-fade-in-up' : 'opacity-0'} />
      {/* 屏幕内容 */}
      <rect x="20" y="13" width="80" height="45" rx="2" fill="rgba(214,216,118,0.05)"
        className={isInView ? 'animate-scale-in' : 'opacity-0'} style={{ animationDelay: '0.2s' }} />
      {/* 侧边栏 */}
      <rect x="22" y="15" width="18" height="41" rx="2" fill="rgba(255,255,255,0.05)"
        className={isInView ? 'animate-slide-in-left' : 'opacity-0'} style={{ animationDelay: '0.3s' }} />
      {[20, 28, 36, 44].map((y, i) => (
        <rect key={y} x="24" y={y} width="14" height="5" rx="1" fill="rgba(214,216,118,0.2)"
          className={isInView ? 'animate-fade-in-up' : 'opacity-0'} style={{ animationDelay: `${0.4 + i * 0.1}s` }} />
      ))}
      {/* 仪表盘 */}
      <rect x="43" y="15" width="55" height="20" rx="2" fill="rgba(255,255,255,0.03)"
        className={isInView ? 'animate-fade-in-up' : 'opacity-0'} style={{ animationDelay: '0.5s' }} />
      {/* 图表 */}
      <path d="M48 30 L55 25 L62 28 L69 20 L76 24 L83 18 L90 22" stroke="#D6D876" strokeWidth="1.5" fill="none"
        strokeDasharray="50" className={isInView ? 'animate-draw-line' : 'opacity-0'} style={{ animationDelay: '0.6s' }} />
      {/* 指标卡 */}
      {[45, 65, 85].map((x, i) => (
        <g key={x}>
          <rect x={x} y="38" width="18" height="16" rx="2" fill="rgba(255,255,255,0.03)" stroke="rgba(214,216,118,0.3)" strokeWidth="0.5"
            className={isInView ? 'animate-scale-in' : 'opacity-0'} style={{ animationDelay: `${0.7 + i * 0.1}s` }} />
          <text x={x + 9} y="49" fontSize="7" fill="#D6D876" textAnchor="middle" fontWeight="bold"
            className={`${isInView ? 'animate-fade-in-up' : 'opacity-0'} group-hover:animate-pulse-glow`}
            style={{ animationDelay: `${0.8 + i * 0.1}s` }}>{['24', '98', '12'][i]}</text>
        </g>
      ))}
      {/* 底座 */}
      <rect x="50" y="65" width="20" height="4" rx="1" fill="rgba(255,255,255,0.1)"
        className={isInView ? 'animate-fade-in-up' : 'opacity-0'} style={{ animationDelay: '0.3s' }} />
      <rect x="55" y="69" width="10" height="6" rx="1" fill="rgba(255,255,255,0.08)"
        className={isInView ? 'animate-fade-in-up' : 'opacity-0'} style={{ animationDelay: '0.35s' }} />
    </svg>
  );
}

function ReleaseFlowSvg({ isInView }: { isInView: boolean }) {
  return (
    <svg viewBox="0 0 120 80" className="h-full w-full" aria-hidden="true">
      {/* 流程管道背景 */}
      <path d="M15 40 L105 40" stroke="rgba(255,255,255,0.1)" strokeWidth="8" strokeLinecap="round" />
      {/* 激活的管道 */}
      <path d="M15 40 L105 40" stroke="#D6D876" strokeWidth="8" strokeLinecap="round" strokeOpacity="0.3"
        strokeDasharray="90" className={isInView ? 'animate-draw-line group-hover:animate-pulse-glow' : 'opacity-0'} />
      {/* 节点 */}
      {[
        { x: 20, label: '计划', delay: '0.2s' },
        { x: 45, label: '开发', delay: '0.4s' },
        { x: 70, label: '测试', delay: '0.6s' },
        { x: 95, label: '发布', delay: '0.8s' },
      ].map(({ x, label, delay }, i) => (
        <g key={x}>
          <circle cx={x} cy="40" r="10" fill="#0f0f16" stroke="#D6D876" strokeWidth="2"
            className={isInView ? 'animate-scale-in' : 'opacity-0'} style={{ animationDelay: delay }} />
          <circle cx={x} cy="40" r="5" fill="#D6D876"
            className={isInView ? 'animate-scale-in' : 'opacity-0'} style={{ animationDelay: `${parseFloat(delay) + 0.1}s` }} />
          <text x={x} y="58" fontSize="7" fill="rgba(255,255,255,0.6)" textAnchor="middle"
            className={isInView ? 'animate-fade-in-up' : 'opacity-0'} style={{ animationDelay: `${parseFloat(delay) + 0.15}s` }}>{label}</text>
        </g>
      ))}
      {/* 最终勾选 */}
      <g className={isInView ? 'animate-scale-in' : 'opacity-0'} style={{ animationDelay: '1s' }}>
        <circle cx="95" cy="40" r="14" fill="none" stroke="#D6D876" strokeWidth="2" strokeOpacity="0.5"
          className="group-hover:animate-pulse-glow" />
        <path d="M89 40 L93 44 L102 35" stroke="#D6D876" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"
          className={isInView ? 'animate-check-draw' : 'opacity-0'} style={{ animationDelay: '1.1s' }} />
      </g>
      {/* 连接箭头 */}
      {[32, 57, 82].map((x, i) => (
        <polygon key={x} points={`${x},40 ${x - 4},36 ${x - 4},44`} fill="#D6D876" fillOpacity="0.6"
          className={isInView ? 'animate-fade-in-up' : 'opacity-0'} style={{ animationDelay: `${0.3 + i * 0.2}s` }} />
      ))}
    </svg>
  );
}

const svgComponents = {
  kanban: KanbanSvg,
  calendar: CalendarSvg,
  mcp: McpIntegrationSvg,
  agents: MultiAgentsSvg,
  desktop: DesktopWorkspaceSvg,
  release: ReleaseFlowSvg,
};

export function FeatureCard({ title, desc, variant }: FeatureCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref);
  const SvgComponent = svgComponents[variant];
  const Icon = iconMap[variant];

  return (
    <article
      ref={ref}
      className="group rounded-xl border border-white/10 bg-white/[0.03] p-6 transition-all duration-300 hover:border-amber-300/30 hover:bg-white/[0.05]"
    >
      <div className="mb-4 h-20 w-full overflow-hidden rounded-lg bg-[#0a0a0f]">
        <SvgComponent isInView={isInView} />
      </div>
      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-amber-300/10 text-amber-300">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-zinc-300">{desc}</p>
    </article>
  );
}
