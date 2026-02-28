import Link from 'next/link';
import {
  ArrowRight,
  LayoutGrid,
  CalendarDays,
  GitBranch,
  Layers,
  Monitor,
  Users,
  Github,
  BarChart3,
  ChevronRight,
} from 'lucide-react';

/* ─── Logo SVG ─────────────────────────────────────────────────────────────── */
function VibenLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#d97706" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
      <rect x="15" y="20" width="50" height="65" rx="3" fill="url(#logo-grad)" />
      <rect x="20" y="25" width="40" height="55" rx="2" fill="white" />
      <rect x="25" y="32" width="30" height="3" rx="1" fill="#fcd34d" />
      <rect x="25" y="40" width="25" height="3" rx="1" fill="#fcd34d" />
      <rect x="25" y="48" width="28" height="3" rx="1" fill="#fcd34d" />
      <rect x="25" y="56" width="22" height="3" rx="1" fill="#fcd34d" />
      <circle cx="65" cy="55" r="20" fill="none" stroke="url(#logo-grad)" strokeWidth="6" />
      <line x1="78" y1="68" x2="92" y2="82" stroke="url(#logo-grad)" strokeWidth="6" strokeLinecap="round" />
      <circle cx="65" cy="55" r="12" fill="#fef3c7" opacity="0.5" />
    </svg>
  );
}

/* ─── Nav ───────────────────────────────────────────────────────────────────── */
function Nav() {
  return (
    <nav className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold text-foreground">
          <VibenLogo size={28} />
          <span className="text-lg font-bold">Viben</span>
        </Link>
        <div className="flex items-center gap-1 text-sm">
          <Link href="/mcp" className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            MCP 市场
          </Link>
          <Link href="/skills" className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            技能库
          </Link>
          <Link href="/code-stats.html" className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <BarChart3 className="h-3.5 w-3.5" />
            代码统计
          </Link>
          <a
            href="https://github.com/LinXueyuanStdio/viben"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-1 flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
          >
            <Github className="h-3.5 w-3.5" />
            GitHub
          </a>
        </div>
      </div>
    </nav>
  );
}

/* ─── Feature cards data ────────────────────────────────────────────────────── */
const FEATURES = [
  {
    icon: LayoutGrid,
    title: '看板视图',
    desc: '拖拽式看板管理 Agent 任务。跨工作流追踪进度，直观可视化。',
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
  },
  {
    icon: CalendarDays,
    title: '日历规划',
    desc: '以日历形式规划 Agent 任务和截止日期，轻松安排自动化工作流。',
    color: 'text-violet-500',
    bg: 'bg-violet-500/10',
  },
  {
    icon: GitBranch,
    title: '时间线',
    desc: '追踪 Agent 执行历史与依赖关系，可视化工作流里程碑。',
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
  },
  {
    icon: Layers,
    title: 'MCP 集成',
    desc: '基于 Model Context Protocol，兼容 Claude、ChatGPT 等主流 AI 助手。',
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
  },
  {
    icon: Monitor,
    title: '桌面应用',
    desc: '精美的原生桌面应用，集工作区管理、Agent 配置与可视化分析于一体。',
    color: 'text-rose-500',
    bg: 'bg-rose-500/10',
  },
  {
    icon: Users,
    title: '多 Agent 协作',
    desc: '协调多个 AI Agent 协同工作，跨项目管理 Agent 集群。',
    color: 'text-cyan-500',
    bg: 'bg-cyan-500/10',
  },
] as const;

/* ─── Agents ────────────────────────────────────────────────────────────────── */
const AGENTS = [
  { name: 'Claude Desktop', available: true },
  { name: 'Claude Code', available: true },
  { name: 'Cursor', available: true },
  { name: 'Windsurf', available: true },
  { name: 'Cline', available: true },
  { name: 'ChatGPT', available: false },
];

/* ─── Page ───────────────────────────────────────────────────────────────────── */
export default function HomePage() {
  return (
    <>
      <Nav />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden border-b border-border/40 bg-gradient-to-b from-background via-background to-muted/20 py-24 md:py-32">
        {/* decorative grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              'linear-gradient(hsl(var(--border)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        <div className="relative mx-auto max-w-4xl px-6 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            多 Agent 工作区管理平台
          </div>

          <h1 className="font-serif text-5xl font-bold tracking-tight text-foreground sm:text-7xl">
            Viben
          </h1>
          <p className="mt-4 text-xl font-medium text-amber-600 dark:text-amber-400 sm:text-2xl">
            Orchestrate AI Agent Clusters in Your Local Workspace
          </p>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground">
            用看板、日历、时间线和任务列表管理多 Agent 协作。自动化工作流，跨项目协调 AI Agent 集群。
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/mcp"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-md transition hover:bg-primary/90 hover:shadow-lg"
            >
              探索 MCP 市场
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="https://github.com/LinXueyuanStdio/viben"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-6 py-3 text-sm font-semibold transition hover:bg-muted"
            >
              <Github className="h-4 w-4" />
              View on GitHub
            </a>
            <Link
              href="/code-stats.html"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-6 py-3 text-sm font-semibold transition hover:bg-muted"
            >
              <BarChart3 className="h-4 w-4 text-blue-500" />
              代码统计报告
            </Link>
          </div>

          {/* install snippet */}
          <div className="mx-auto mt-12 max-w-xl overflow-hidden rounded-xl border border-border bg-card/80 shadow-lg backdrop-blur">
            <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
              <span className="h-3 w-3 rounded-full bg-rose-400" />
              <span className="h-3 w-3 rounded-full bg-amber-400" />
              <span className="h-3 w-3 rounded-full bg-emerald-400" />
              <span className="ml-2 text-xs text-muted-foreground">Quick Install</span>
            </div>
            <pre className="overflow-x-auto p-4 text-left text-xs leading-relaxed text-foreground/90">
              <code>
                <span className="text-muted-foreground"># macOS / Linux</span>{'\n'}
                {'curl -fsSL https://github.com/LinXueyuanStdio/viben/releases/latest/download/install.sh | bash'}{'\n\n'}
                <span className="text-muted-foreground"># Node.js</span>{'\n'}
                {'npx viben'}{'\n\n'}
                <span className="text-muted-foreground"># Python</span>{'\n'}
                {'pip install browse-mcp'}
              </code>
            </pre>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-14 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">强大功能</h2>
            <p className="mt-3 text-muted-foreground">管理 AI Agent 工作流所需的一切工具</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, desc, color, bg }) => (
              <div
                key={title}
                className="group rounded-xl border border-border bg-card p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-border/80 hover:shadow-md"
              >
                <div className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg ${bg}`}>
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <h3 className="mb-2 font-semibold">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Quick Start ── */}
      <section className="border-y border-border/40 bg-muted/30 py-20 md:py-28">
        <div className="mx-auto max-w-4xl px-6">
          <div className="mb-14 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">快速开始</h2>
            <p className="mt-3 text-muted-foreground">几分钟内即可上手</p>
          </div>
          <ol className="space-y-8">
            {[
              {
                n: '1',
                title: '安装',
                body: (
                  <div className="mt-2 overflow-hidden rounded-lg border border-border bg-card">
                    <pre className="overflow-x-auto p-4 text-xs leading-relaxed">
                      <code>{'curl -fsSL https://github.com/LinXueyuanStdio/viben/releases/latest/download/install.sh | bash'}</code>
                    </pre>
                    <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
                      或使用 <code className="font-mono">npx viben</code> · <code className="font-mono">pip install browse-mcp</code>
                    </p>
                  </div>
                ),
              },
              {
                n: '2',
                title: '配置 Claude Desktop',
                body: (
                  <div className="mt-2 overflow-hidden rounded-lg border border-border bg-card">
                    <pre className="overflow-x-auto p-4 text-xs leading-relaxed">
                      <code>{`{\n  "mcpServers": {\n    "browse-mcp": {\n      "command": "browse-mcp"\n    }\n  }\n}`}</code>
                    </pre>
                  </div>
                ),
              },
              {
                n: '3',
                title: '管理 Agent',
                body: (
                  <p className="mt-2 text-sm text-muted-foreground">
                    使用桌面应用配置工作区、管理 AI Agent，协调自动化工作流。
                  </p>
                ),
              },
            ].map(({ n, title, body }) => (
              <li key={n} className="flex gap-5">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {n}
                </div>
                <div className="flex-1 pt-1">
                  <h3 className="font-semibold">{title}</h3>
                  {body}
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-12 text-center">
            <a
              href="https://github.com/LinXueyuanStdio/viben/tree/main/apps/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow transition hover:bg-primary/90"
            >
              查看完整文档
              <ChevronRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      {/* ── Supported Agents ── */}
      <section className="py-20">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">支持的 AI Agent</h2>
          <p className="mt-3 text-muted-foreground">适配主流 AI 助手和 MCP 客户端</p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            {AGENTS.map(({ name, available }) => (
              <div
                key={name}
                className={`flex items-center gap-2 rounded-full border px-5 py-2 text-sm font-medium transition ${
                  available
                    ? 'border-border bg-card hover:border-amber-500/50 hover:bg-amber-500/5'
                    : 'border-dashed border-border bg-muted/40 text-muted-foreground'
                }`}
              >
                {name}
                {!available && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs">即将支持</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Code Stats Banner ── */}
      <section className="border-t border-border/40 bg-gradient-to-r from-blue-950/30 via-violet-950/30 to-blue-950/30 py-14">
        <div className="mx-auto max-w-4xl px-6">
          <div className="flex flex-col items-center gap-6 text-center md:flex-row md:text-left">
            <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl bg-blue-500/10 ring-1 ring-blue-500/30">
              <BarChart3 className="h-8 w-8 text-blue-400" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold">代码库统计报告</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                501,021 行代码 · 1,340 个文件 · 14 个模块 · TypeScript 占比 50%+。
                交互式图表，全面展示代码规模与语言分布。
              </p>
            </div>
            <Link
              href="/code-stats.html"
              className="flex-shrink-0 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-blue-500"
            >
              查看统计
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border/40 bg-muted/20 py-12">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col gap-8 md:flex-row md:justify-between">
            <div className="flex items-center gap-3">
              <VibenLogo size={36} />
              <div>
                <p className="font-bold">Viben</p>
                <p className="text-xs text-muted-foreground">Multi-Agent Workspace Manager</p>
              </div>
            </div>
            <div className="flex gap-12 text-sm">
              <div className="space-y-2">
                <p className="font-semibold">资源</p>
                <a href="https://github.com/LinXueyuanStdio/viben/tree/main/apps/docs" target="_blank" rel="noopener noreferrer" className="block text-muted-foreground hover:text-foreground">文档</a>
                <a href="https://github.com/LinXueyuanStdio/viben" target="_blank" rel="noopener noreferrer" className="block text-muted-foreground hover:text-foreground">GitHub</a>
                <Link href="/code-stats.html" className="block text-muted-foreground hover:text-foreground">代码统计</Link>
              </div>
              <div className="space-y-2">
                <p className="font-semibold">社区</p>
                <a href="https://github.com/LinXueyuanStdio/viben/issues" target="_blank" rel="noopener noreferrer" className="block text-muted-foreground hover:text-foreground">反馈问题</a>
                <a href="https://github.com/LinXueyuanStdio/viben/discussions" target="_blank" rel="noopener noreferrer" className="block text-muted-foreground hover:text-foreground">讨论</a>
              </div>
            </div>
          </div>
          <div className="mt-8 border-t border-border/40 pt-6 text-center text-xs text-muted-foreground">
            Copyright &copy; {new Date().getFullYear()} Viben Project. MIT License.
          </div>
        </div>
      </footer>
    </>
  );
}
