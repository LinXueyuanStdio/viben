import Link from 'next/link';
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Github,
  GitBranch,
  Layers,
  LayoutGrid,
  Monitor,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';

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

const CHALLENGES = [
  {
    title: '代码能生成，但产品难落地',
    desc: '纯代码生成很快，但经常缺流程、缺审查、缺可追踪协作。',
  },
  {
    title: '多智能体协作难以控盘',
    desc: '任务拆解、上下文同步、执行状态与结果复盘往往分散在多个工具里。',
  },
  {
    title: '上线后维护成本持续攀升',
    desc: '缺少可复用工作流与记忆体系，团队每次都在重复搭建同样流程。',
  },
] as const;

const LIFECYCLE = [
  { title: '定义目标', desc: '从需求到任务树，建立可执行的多智能体计划。', icon: Sparkles },
  { title: '并行执行', desc: '看板 + 时间线 + 日历视图，统一调度执行进度。', icon: LayoutGrid },
  { title: '审查发布', desc: '关键节点支持人工确认，保障可控与可追踪。', icon: ShieldCheck },
  { title: '持续迭代', desc: '沉淀上下文与流程模板，后续任务持续复用提效。', icon: GitBranch },
] as const;

const FEATURES = [
  { icon: LayoutGrid, title: '看板视图', desc: '拖拽管理任务优先级与状态。' },
  { icon: CalendarDays, title: '日历规划', desc: '用时间轴安排自动化节点与截止日期。' },
  { icon: Layers, title: 'MCP 集成', desc: '兼容 Claude、Cursor、Cline 等 MCP 生态。' },
  { icon: Users, title: '多智能体协作', desc: '支持多角色智能体并行执行与协同审查。' },
  { icon: Monitor, title: '桌面工作台', desc: '统一管理工作区、配置与执行监控。' },
  { icon: CheckCircle2, title: '可控发布流', desc: '从计划到发布形成闭环，降低上线风险。' },
] as const;

const SUPPORTED_AGENTS = ['Claude Desktop', 'Claude Code', 'Cursor', 'Windsurf', 'Cline', 'Gemini CLI'] as const;

const FAQS = [
  {
    q: 'Viben 和传统 AI 编码助手有什么不同？',
    a: 'Viben 聚焦“多智能体工作流编排”，不只生成代码，还覆盖任务管理、审查节点与持续迭代。',
  },
  {
    q: '是否必须使用特定模型？',
    a: '不需要。Viben 基于 MCP 生态，可接入多种模型与客户端，按团队习惯自由组合。',
  },
  {
    q: '适合个人开发者还是团队？',
    a: '两者都适合。个人可用它构建稳定自动化流程，团队可统一协作规范并提升交付效率。',
  },
] as const;

function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-amber-400/10 bg-[#0b0b10]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5 text-zinc-100 transition-opacity hover:opacity-90">
          <VibenLogo size={28} />
          <span className="text-lg font-bold tracking-tight">Viben</span>
        </Link>
        <div className="flex items-center gap-1 text-sm">
          <Link href="/mcp" className="rounded-md px-3 py-1.5 text-zinc-300 transition-colors hover:bg-white/5 hover:text-white">
            MCP 市场
          </Link>
          <Link href="/skills" className="rounded-md px-3 py-1.5 text-zinc-300 transition-colors hover:bg-white/5 hover:text-white">
            技能库
          </Link>
          <a
            href="https://github.com/LinXueyuanStdio/viben"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-2 inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 px-3 py-1.5 text-amber-300 transition-colors hover:bg-amber-300/10 hover:text-amber-200"
          >
            <Github className="h-3.5 w-3.5" />
            GitHub
          </a>
        </div>
      </div>
    </header>
  );
}

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#07070b] text-zinc-100">
      <div className="pointer-events-none fixed inset-0 opacity-60" style={{ backgroundImage: 'radial-gradient(circle, rgba(214,216,118,0.08) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
      <Nav />

      <section className="relative overflow-hidden border-b border-white/10 pb-20 pt-24 md:pt-28">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(214,216,118,0.18),transparent_45%)]" />
        <div className="relative mx-auto max-w-5xl px-6 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/10 px-4 py-1.5 text-xs font-semibold tracking-[0.15em] text-amber-300">
            MULTI-AGENT WORKSPACE
          </div>
          <h1 className="mx-auto max-w-4xl text-balance text-4xl font-bold leading-tight text-white sm:text-6xl">从想法到上线，再到迭代维护。让多智能体协作真正可控。</h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-zinc-300 sm:text-lg">
            Viben 不是“只会写代码”的助手，而是完整的协作系统。统一管理计划、执行、审查与复盘，让 AI 生产力稳定落地。
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link href="/mcp" className="inline-flex items-center gap-2 rounded-lg bg-amber-300 px-6 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-amber-200">
              立即开始
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/code-stats.html"
              className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-zinc-100 transition hover:bg-white/10"
            >
              查看代码统计
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-12 text-center">
            <p className="mb-4 inline-flex rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-amber-300">Why Viben</p>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">AI 能写代码，但代码不等于产品</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {CHALLENGES.map(({ title, desc }) => (
              <article key={title} className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-zinc-300">{desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-white/[0.02] py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">完整生命周期，你始终在控制中</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {LIFECYCLE.map(({ title, desc, icon: Icon }, idx) => (
              <article key={title} className="rounded-xl border border-white/10 bg-[#0f0f16] p-5">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-amber-300/10 text-amber-300">
                  <Icon className="h-5 w-5" />
                </div>
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Step {idx + 1}</p>
                <h3 className="mt-2 font-semibold text-white">{title}</h3>
                <p className="mt-2 text-sm text-zinc-300">{desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-12 flex items-end justify-between gap-4">
            <div>
              <p className="mb-4 inline-flex rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-amber-300">Capabilities</p>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">不止代码生成，是真正可交付的工作流</h2>
            </div>
            <Link href="/skills" className="hidden items-center gap-1 text-sm font-medium text-amber-300 transition hover:text-amber-200 md:inline-flex">
              探索技能库
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <article key={title} className="rounded-xl border border-white/10 bg-white/[0.03] p-6 transition-colors hover:border-amber-300/30">
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-amber-300/10 text-amber-300">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-zinc-300">{desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-[#0f0f16] py-20">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">开发者与团队正在用 Viben 提升交付效率</h2>
          <p className="mx-auto mt-4 max-w-2xl text-zinc-300">兼容主流智能体客户端，保留你已有的模型与工具链。</p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            {SUPPORTED_AGENTS.map((name) => (
              <div key={name} className="rounded-full border border-white/15 bg-white/[0.03] px-5 py-2 text-sm font-medium">
                {name}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 md:grid-cols-2">
          <div>
            <p className="mb-4 inline-flex rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-amber-300">Pricing</p>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">定价即将发布</h2>
            <p className="mt-4 text-zinc-300">先体验核心能力，后续将提供适配个人与团队的灵活方案。</p>
            <a
              href="https://github.com/LinXueyuanStdio/viben"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 inline-flex items-center gap-2 rounded-lg bg-amber-300 px-5 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-amber-200"
            >
              获取最新进展
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
          <div className="space-y-4">
            <h3 className="text-xl font-semibold">常见问题</h3>
            {FAQS.map(({ q, a }) => (
              <article key={q} className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
                <h4 className="font-medium text-white">{q}</h4>
                <p className="mt-2 text-sm leading-relaxed text-zinc-300">{a}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 bg-[radial-gradient(circle_at_top,rgba(214,216,118,0.16),transparent_60%)] py-16">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-6 text-center md:flex-row md:text-left">
          <div>
            <h2 className="text-2xl font-bold sm:text-3xl">准备好构建真正可交付的 AI 工作流了吗？</h2>
            <p className="mt-2 text-zinc-300">从今天开始，把多智能体协作变成团队稳定产能。</p>
          </div>
          <div className="flex gap-3">
            <Link href="/mcp" className="inline-flex items-center gap-2 rounded-lg bg-amber-300 px-5 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-amber-200">
              进入 MCP 市场
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="https://github.com/LinXueyuanStdio/viben/tree/main/apps/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-semibold transition hover:bg-white/10"
            >
              阅读文档
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
