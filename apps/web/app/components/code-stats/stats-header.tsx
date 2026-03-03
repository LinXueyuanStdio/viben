'use client';

import { useRef } from 'react';
import { Code, FileCode, Files, FolderTree } from 'lucide-react';
import { useInView } from '../animated-cards/use-in-view';
import type { CodeStatsData } from './types';

interface StatsHeaderProps {
  summary: CodeStatsData['summary'];
  generatedAt: string;
}

function formatNumber(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface KpiCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  subValue?: string;
  delay: number;
}

function KpiCard({ icon: Icon, label, value, subValue, delay }: KpiCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref);

  return (
    <div
      ref={ref}
      className={`group rounded-xl border border-white/10 bg-white/[0.03] p-6 transition-all duration-300 hover:border-amber-300/30 hover:bg-white/[0.05] ${
        isInView ? 'animate-fade-in-up' : 'opacity-0'
      }`}
      style={{ animationDelay: `${delay}s` }}
    >
      <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-amber-300/10 text-amber-300">
        <Icon className="h-5 w-5" />
      </div>
      <div className="text-3xl font-bold text-white">{value}</div>
      {subValue && <div className="mt-1 text-sm text-zinc-400">{subValue}</div>}
      <div className="mt-2 text-sm text-zinc-500">{label}</div>
    </div>
  );
}

export function StatsHeader({ summary, generatedAt }: StatsHeaderProps) {
  const codePercent = Math.round((summary.codeLines / summary.totalLines) * 100);

  return (
    <div className="mb-12">
      <div className="mb-8 text-center">
        <p className="mb-4 inline-flex rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-amber-300">
          Code Statistics
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Viben 代码库统计报告</h1>
        <p className="mx-auto mt-4 max-w-2xl text-zinc-400">
          全面统计代码库的规模、语言分布、模块组成与文件结构
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          更新时间：{formatDate(generatedAt)}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={FileCode}
          label="总行数"
          value={formatNumber(summary.totalLines)}
          subValue="含配置与文档"
          delay={0}
        />
        <KpiCard
          icon={Files}
          label="文件数量"
          value={formatNumber(summary.totalFiles)}
          delay={0.1}
        />
        <KpiCard
          icon={FolderTree}
          label="模块数量"
          value={summary.totalModules.toString()}
          delay={0.2}
        />
        <KpiCard
          icon={Code}
          label="代码占比"
          value={`${codePercent}%`}
          subValue={`${formatNumber(summary.codeLines)} 行源代码`}
          delay={0.3}
        />
      </div>
    </div>
  );
}
