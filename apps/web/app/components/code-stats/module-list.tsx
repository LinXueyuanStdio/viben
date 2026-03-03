'use client';

import { useRef } from 'react';
import { useInView } from '../animated-cards/use-in-view';
import type { ModuleStat } from './types';

interface ModuleListProps {
  modules: ModuleStat[];
}

function formatNumber(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toLocaleString();
}

export function ModuleList({ modules }: ModuleListProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref);
  const maxLines = Math.max(...modules.map((m) => m.lines));

  return (
    <div
      ref={ref}
      className={`rounded-xl border border-white/10 bg-white/[0.03] p-6 transition-all duration-300 hover:border-amber-300/30 ${
        isInView ? 'animate-fade-in-up' : 'opacity-0'
      }`}
      style={{ animationDelay: '0.6s' }}
    >
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-white">模块列表</h3>
        <p className="text-sm text-zinc-500">完整模块行数排名</p>
      </div>

      <div className="space-y-3 max-h-[280px] overflow-y-auto pr-2">
        {modules.map((module, index) => {
          const percent = (module.lines / maxLines) * 100;
          return (
            <div
              key={module.name}
              className={`${isInView ? 'animate-fade-in-up' : 'opacity-0'}`}
              style={{ animationDelay: `${0.7 + index * 0.05}s` }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-mono text-zinc-300">{module.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono font-semibold text-zinc-200">
                    {formatNumber(module.lines)}
                  </span>
                  <span className="text-xs text-zinc-500">{module.files} 文件</span>
                </div>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{
                    width: isInView ? `${percent}%` : '0%',
                    background: `linear-gradient(90deg, ${module.color}99, ${module.color})`,
                    transitionDelay: `${0.8 + index * 0.05}s`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
