'use client';

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ChevronRight, Globe } from 'lucide-react';
import { GithubIcon as Github } from '@/components/ui/icons';
import { useTranslation } from 'react-i18next';
import {
  LANGUAGES, DEFAULT_LANGUAGE, getLanguageByCode, changeLanguage,
} from '@/lib/i18n';
import { DownloadButton } from './download';
import { ChallengeCard } from './animated-cards/challenge-card';
import { LifecycleCard } from './animated-cards/lifecycle-card';
import { FeatureCard } from './animated-cards/feature-card';

// ============================================
// Lazy-loaded heavy sections (below fold)
// ============================================

const DemoTabs = dynamic(() => import('./demo-tabs').then(m => ({ default: m.DemoTabs })), {
  ssr: false,
  loading: () => (
    <section className="py-8">
      <div className="mx-auto max-w-5xl px-6">
        <div className="h-[480px] animate-pulse rounded-xl bg-white/[0.03]" />
      </div>
    </section>
  ),
});

const DownloadSection = dynamic(() => import('./download').then(m => ({ default: m.DownloadSection })), {
  ssr: false,
  loading: () => (
    <section className="py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="h-[300px] animate-pulse rounded-xl bg-white/[0.02]" />
      </div>
    </section>
  ),
});

const AgentBadgeList = dynamic(() => import('./animated-cards/agent-badge').then(m => ({ default: m.AgentBadgeList })), {
  ssr: false,
  loading: () => <div className="h-20 animate-pulse rounded-xl bg-white/[0.03]" />,
});

// ============================================
// Constants
// ============================================

const CHALLENGE_VARIANTS = ['code-scatter', 'agent-chaos', 'cost-rise'] as const;
const LIFECYCLE_VARIANTS = ['define', 'execute', 'review', 'iterate'] as const;
const FEATURE_VARIANTS = ['kanban', 'calendar', 'mcp', 'agents', 'desktop', 'release'] as const;
const FAQ_KEYS = ['difference', 'model', 'audience'] as const;
const SUPPORTED_AGENTS = ['Claude Desktop', 'Claude Code', 'Cursor', 'Windsurf', 'Cline', 'Gemini CLI'] as const;

// ============================================
// Language Switcher
// ============================================

function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const handleLanguageSelect = useCallback((langCode: string) => {
    changeLanguage(langCode);
    setIsOpen(false);
  }, []);

  const currentLang = i18n.language || DEFAULT_LANGUAGE;
  const currentLanguage = getLanguageByCode(currentLang);

  if (!mounted) {
    return (
      <button className="rounded-md p-2 text-zinc-300 transition-colors hover:bg-white/5 hover:text-white">
        <Globe className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="rounded-md p-2 text-zinc-300 transition-colors hover:bg-white/5 hover:text-white"
        title={currentLanguage?.name}
      >
        <Globe className="h-4 w-4" />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 max-h-80 w-48 overflow-y-auto rounded-lg border border-white/10 bg-[#0b0b10]/95 py-1 shadow-xl backdrop-blur-xl">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleLanguageSelect(lang.code)}
                className={`flex w-full items-center justify-between px-3 py-2 text-sm transition-colors hover:bg-white/5 ${
                  lang.code === currentLang ? 'bg-amber-300/10 text-amber-300' : 'text-zinc-300 hover:text-white'
                }`}
              >
                <span>{lang.nativeName}</span>
                <span className="text-xs text-zinc-500">{lang.code}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ============================================
// Nav
// ============================================

function Nav() {
  const { t } = useTranslation();
  return (
    <header className="sticky top-0 z-50 border-b border-amber-400/10 bg-[#0b0b10]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5 text-zinc-100 transition-opacity hover:opacity-90">
          <Image src="/viben.svg" alt="Viben Logo" width={28} height={28} className="rounded-md" priority />
          <span className="text-lg font-bold tracking-tight">Viben</span>
        </Link>
        <div className="flex items-center gap-1 text-sm">
          <LanguageSwitcher />
          <a href="https://github.com/LinXueyuanStdio/viben" target="_blank" rel="noopener noreferrer"
            className="rounded-md p-2 text-zinc-300 transition-colors hover:bg-white/5 hover:text-white">
            <Github className="h-4 w-4" />
          </a>
          <Link href="/login" className="rounded-md px-3 py-1.5 text-zinc-300 transition-colors hover:bg-white/5 hover:text-white">
            {t('auth.signIn')}
          </Link>
          <Link href="/register" className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 px-3 py-1.5 text-amber-300 transition-colors hover:bg-amber-300/10 hover:text-amber-200">
            {t('auth.signUp')}
          </Link>
        </div>
      </div>
    </header>
  );
}

// ============================================
// HomePage
// ============================================

export function HomePage() {
  const { t } = useTranslation();

  const challenges = CHALLENGE_VARIANTS.map((v) => ({
    title: t(`homepage.challenges.items.${v === 'code-scatter' ? 'codeScatter' : v === 'agent-chaos' ? 'agentChaos' : 'costRise'}.title`),
    desc: t(`homepage.challenges.items.${v === 'code-scatter' ? 'codeScatter' : v === 'agent-chaos' ? 'agentChaos' : 'costRise'}.desc`),
    variant: v,
  }));

  const lifecycle = LIFECYCLE_VARIANTS.map((v, i) => ({
    title: t(`homepage.lifecycle.items.${v}.title`),
    desc: t(`homepage.lifecycle.items.${v}.desc`),
    variant: v, step: i + 1,
  }));

  const features = FEATURE_VARIANTS.map((v) => ({
    title: t(`homepage.features.items.${v}.title`),
    desc: t(`homepage.features.items.${v}.desc`),
    variant: v,
  }));

  const faqs = FAQ_KEYS.map((k) => ({
    q: t(`homepage.faq.items.${k}.q`),
    a: t(`homepage.faq.items.${k}.a`),
  }));

  return (
    <main className="min-h-screen bg-[#07070b] text-zinc-100">
      <div className="pointer-events-none fixed inset-0 opacity-60"
        style={{ backgroundImage: 'radial-gradient(circle, rgba(214,216,118,0.08) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
      <Nav />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-white/10 pb-20 pt-24 md:pt-28">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(214,216,118,0.18),transparent_45%)]" />
        <div className="relative mx-auto max-w-5xl px-6 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/10 px-4 py-1.5 text-xs font-semibold tracking-[0.15em] text-amber-300">
            {t('homepage.hero.badge')}
          </div>
          <h1 className="mx-auto max-w-4xl text-balance text-4xl font-bold leading-tight text-white sm:text-6xl">{t('homepage.hero.title')}</h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-zinc-300 sm:text-lg">{t('homepage.hero.description')}</p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link href="/" className="inline-flex items-center gap-2 rounded-lg bg-amber-300 px-6 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-amber-200">
              {t('homepage.hero.cta.getStarted')}<ArrowRight className="h-4 w-4" />
            </Link>
            <DownloadButton />
          </div>
        </div>
      </section>

      {/* Demo Tabs — lazy (29 KB) */}
      <DemoTabs />

      {/* Challenges */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-12 text-center">
            <p className="mb-4 inline-flex rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-amber-300">{t('homepage.challenges.badge')}</p>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('homepage.challenges.title')}</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {challenges.map((c) => <ChallengeCard key={c.variant} title={c.title} desc={c.desc} variant={c.variant} />)}
          </div>
        </div>
      </section>

      {/* Lifecycle */}
      <section className="border-y border-white/10 bg-white/[0.02] py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('homepage.lifecycle.title')}</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {lifecycle.map((l) => <LifecycleCard key={l.variant} title={l.title} desc={l.desc} step={l.step} variant={l.variant} />)}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-12 flex items-end justify-between gap-4">
            <div>
              <p className="mb-4 inline-flex rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-amber-300">{t('homepage.features.badge')}</p>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('homepage.features.title')}</h2>
            </div>
            <Link href="/skill-market" className="hidden items-center gap-1 text-sm font-medium text-amber-300 transition hover:text-amber-200 md:inline-flex">
              {t('homepage.features.exploreSkills')}<ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => <FeatureCard key={f.variant} title={f.title} desc={f.desc} variant={f.variant} />)}
          </div>
        </div>
      </section>

      {/* Download — lazy (16 KB) */}
      <DownloadSection />

      {/* Supported Agents — lazy (92 KB via @lobehub/icons) */}
      <section className="border-y border-white/10 bg-[#0f0f16] py-20">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('homepage.agents.title')}</h2>
          <p className="mx-auto mt-4 max-w-2xl text-zinc-300">{t('homepage.agents.description')}</p>
          <div className="mt-10"><AgentBadgeList agents={SUPPORTED_AGENTS} /></div>
        </div>
      </section>

      {/* FAQ & Pricing */}
      <section className="py-20">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 md:grid-cols-2">
          <div>
            <p className="mb-4 inline-flex rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-amber-300">{t('homepage.pricing.badge')}</p>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('homepage.pricing.title')}</h2>
            <p className="mt-4 text-zinc-300">{t('homepage.pricing.description')}</p>
            <a href="https://github.com/LinXueyuanStdio/viben" target="_blank" rel="noopener noreferrer"
              className="mt-8 inline-flex items-center gap-2 rounded-lg bg-amber-300 px-5 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-amber-200">
              {t('homepage.pricing.getUpdates')}<ArrowRight className="h-4 w-4" />
            </a>
          </div>
          <div className="space-y-4">
            <h3 className="text-xl font-semibold">{t('homepage.faq.title')}</h3>
            {faqs.map(({ q, a }) => (
              <article key={q} className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
                <h4 className="font-medium text-white">{q}</h4>
                <p className="mt-2 text-sm leading-relaxed text-zinc-300">{a}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-white/10 bg-[radial-gradient(circle_at_top,rgba(214,216,118,0.16),transparent_60%)] py-16">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-6 text-center md:flex-row md:text-left">
          <div>
            <h2 className="text-2xl font-bold sm:text-3xl">{t('homepage.cta.title')}</h2>
            <p className="mt-2 text-zinc-300">{t('homepage.cta.description')}</p>
          </div>
          <div className="flex gap-3">
            <Link href="/" className="inline-flex items-center gap-2 rounded-lg bg-amber-300 px-5 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-amber-200">
              {t('homepage.hero.cta.getStarted')}<ArrowRight className="h-4 w-4" />
            </Link>
            <a href="https://github.com/LinXueyuanStdio/viben/tree/main/apps/docs" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-semibold transition hover:bg-white/10">
              {t('homepage.cta.readDocs')}
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-[#0b0b10]">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="grid gap-8 sm:grid-cols-3">
            {/* 产品 */}
            <div>
              <h3 className="mb-3 text-sm font-semibold text-white">Viben</h3>
              <p className="text-sm leading-relaxed text-zinc-400">
                {t('homepage.hero.badge')}
              </p>
            </div>
            {/* 链接 */}
            <div>
              <h3 className="mb-3 text-sm font-semibold text-white">{t('homepage.footer.links')}</h3>
              <ul className="space-y-2 text-sm text-zinc-400">
                <li><Link href="/code-stats" className="transition hover:text-zinc-200">{t('homepage.hero.cta.viewStats')}</Link></li>
                <li><a href="https://github.com/LinXueyuanStdio/viben" target="_blank" rel="noopener noreferrer" className="transition hover:text-zinc-200">GitHub</a></li>
                <li><Link href="/mcp-market" className="transition hover:text-zinc-200">{t('homepage.nav.mcpMarket')}</Link></li>
                <li><Link href="/skill-market" className="transition hover:text-zinc-200">{t('homepage.nav.skills')}</Link></li>
              </ul>
            </div>
            {/* 社区 */}
            <div>
              <h3 className="mb-3 text-sm font-semibold text-white">{t('homepage.footer.community')}</h3>
              <ul className="space-y-2 text-sm text-zinc-400">
                <li><a href="https://github.com/LinXueyuanStdio/viben/issues" target="_blank" rel="noopener noreferrer" className="transition hover:text-zinc-200">{t('homepage.footer.issues')}</a></li>
                <li><a href="https://github.com/LinXueyuanStdio/viben/discussions" target="_blank" rel="noopener noreferrer" className="transition hover:text-zinc-200">{t('homepage.footer.discussions')}</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-10 border-t border-white/5 pt-6 text-center text-xs text-zinc-500">
            {t('homepage.footer.copyright', { year: new Date().getFullYear() })}
          </div>
        </div>
      </footer>
    </main>
  );
}
