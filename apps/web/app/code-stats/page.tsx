import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Github } from 'lucide-react';
import {
  StatsHeader,
  LangChart,
  ModuleChart,
  CategoryChart,
  AppsChart,
  DesktopChart,
  DensityChart,
  ModuleList,
  TopFilesTable,
} from '../components/code-stats';
import type { CodeStatsData } from '../components/code-stats';

async function getCodeStats(): Promise<CodeStatsData | null> {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const filePath = path.join(process.cwd(), 'public', 'data', 'code-stats.json');
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-amber-400/10 bg-[#0b0b10]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-zinc-400 transition-colors hover:text-zinc-200"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">返回首页</span>
          </Link>
          <div className="h-4 w-px bg-white/10" />
          <Link href="/" className="flex items-center gap-2.5 text-zinc-100 transition-opacity hover:opacity-90">
            <Image src="/viben.svg" alt="Viben Logo" width={24} height={24} className="rounded-md" priority />
            <span className="text-lg font-bold tracking-tight">Viben</span>
          </Link>
        </div>
        <a
          href="https://github.com/LinXueyuanStdio/viben"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 px-3 py-1.5 text-sm text-amber-300 transition-colors hover:bg-amber-300/10 hover:text-amber-200"
        >
          <Github className="h-3.5 w-3.5" />
          GitHub
        </a>
      </div>
    </header>
  );
}

export default async function CodeStatsPage() {
  const stats = await getCodeStats();

  if (!stats) {
    return (
      <main className="min-h-screen bg-[#07070b] text-zinc-100">
        <Nav />
        <div className="mx-auto max-w-6xl px-6 py-20 text-center">
          <h1 className="text-2xl font-bold">统计数据加载失败</h1>
          <p className="mt-4 text-zinc-400">
            请运行 <code className="rounded bg-white/10 px-2 py-1 font-mono text-sm">pnpm code-stats</code> 生成统计数据
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#07070b] text-zinc-100">
      <div
        className="pointer-events-none fixed inset-0 opacity-60"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(214,216,118,0.08) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />
      <Nav />

      <section className="relative py-12">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(214,216,118,0.12),transparent_50%)]" />
        <div className="relative mx-auto max-w-6xl px-6">
          <StatsHeader summary={stats.summary} generatedAt={stats.generatedAt} />

          {/* Row 1: Language & Module */}
          <div className="grid gap-6 md:grid-cols-2 mb-6">
            <LangChart languages={stats.languages} />
            <ModuleChart modules={stats.modules} />
          </div>

          {/* Row 2: Category & Apps */}
          <div className="grid gap-6 md:grid-cols-2 mb-6">
            <CategoryChart categories={stats.categories} />
            <AppsChart apps={stats.apps} />
          </div>

          {/* Row 3: Desktop Dirs (full width) */}
          {stats.desktopDirs && stats.desktopDirs.length > 0 && (
            <div className="mb-6">
              <DesktopChart desktopDirs={stats.desktopDirs} />
            </div>
          )}

          {/* Row 4: Density & Module List */}
          <div className="grid gap-6 md:grid-cols-2 mb-6">
            <DensityChart density={stats.density} />
            <ModuleList modules={stats.modules} />
          </div>

          {/* Row 5: Top Files (full width) */}
          <TopFilesTable files={stats.topFiles} />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8">
        <div className="mx-auto max-w-6xl px-6 text-center text-sm text-zinc-500">
          <p>
            统计由{' '}
            <a
              href="https://github.com/roskakori/pygount"
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-300/80 hover:text-amber-300"
            >
              pygount
            </a>{' '}
            生成 · 运行{' '}
            <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs">pnpm code-stats</code>{' '}
            更新数据
          </p>
        </div>
      </footer>
    </main>
  );
}
