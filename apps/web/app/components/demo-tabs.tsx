'use client';

import { useState } from 'react';

const TABS = [
  { id: 'board', label: 'Board' },
  { id: 'terminal', label: 'Terminal' },
  { id: 'code', label: 'Code' },
  { id: 'tests', label: 'Tests' },
] as const;

type TabId = (typeof TABS)[number]['id'];

/* ── Board: Kanban columns ── */
function BoardPanel() {
  const columns = [
    {
      title: 'Working',
      dot: 'bg-[#D6D876]',
      color: '#D6D876',
      count: 3,
      cards: [
        { name: 'Auth architecture', tag: '#3', file: 'spec/auth.md', pct: 67 },
        { name: 'Dashboard + tests', tag: '#5', file: 'Dashboard.tsx', pct: 42 },
        { name: 'Fix issue #142', tag: '#1', file: 'timeout.ts', pct: 23 },
      ],
    },
    {
      title: 'In Review',
      dot: 'bg-[#FFB020]',
      color: '#FFB020',
      count: 2,
      cards: [
        { name: 'Payment tests', tag: '#7', file: 'payments.test' },
        { name: 'Roadmap: teams', tag: '#9', file: 'collab.ts' },
      ],
    },
    {
      title: 'Done',
      dot: 'bg-emerald-400',
      color: '#34D399',
      count: 3,
      cards: [
        { name: 'API + docs', tag: '#2', file: 'users.ts' },
        { name: 'CI pipeline', tag: '#4', file: 'ci.yml' },
        { name: 'Dep updates', tag: '#6', file: 'package.json' },
      ],
    },
  ];

  return (
    <div>
      <div className="grid min-h-[240px] grid-cols-3 gap-0">
        {columns.map((col, ci) => (
          <div key={col.title} className="p-3" style={{ borderRight: ci < 2 ? '1px solid #14141F' : undefined }}>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`h-1.5 w-1.5 rounded-full ${col.dot}`} />
                <span className="text-[11px] font-medium text-[#8888A0]">{col.title}</span>
              </div>
              <span className="font-mono text-[10px] text-[#555568]">{col.count}</span>
            </div>
            <div className="space-y-2">
              {col.cards.map((card, idx) => (
                <div
                  key={card.tag}
                  className="rounded-lg p-2.5 transition-colors duration-200"
                  style={{
                    background: '#161620',
                    border: '1px solid #14141F',
                    animation: col.title === 'Working' ? `demo-fade-in 0.5s ${idx * 0.12}s both` : undefined,
                  }}
                >
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[11px] font-medium text-[#EEEEF0]">{card.name}</span>
                    <div className="flex items-center gap-1">
                      {col.title === 'Working' && <div className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: col.color }} />}
                      <span className="font-mono text-[9px]" style={{ color: col.color }}>
                        {card.tag}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[9px] text-[#555568]">{card.file}</span>
                    {'pct' in card ? (
                      <div className="flex items-center gap-1.5">
                        <div className="h-1 w-16 overflow-hidden rounded-full" style={{ background: '#14141F' }}>
                          <div
                            className="h-full rounded-full"
                            style={{ background: col.color, width: `${card.pct}%`, animation: `demo-grow 1.2s ${idx * 0.2}s both` }}
                          />
                        </div>
                        <span className="font-mono text-[8px] text-[#555568]">{card.pct}%</span>
                      </div>
                    ) : col.title === 'Done' ? (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={col.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    ) : (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={col.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {/* status bar */}
      <div className="overflow-hidden px-4 py-2.5 font-mono" style={{ borderTop: '1px solid #14141F', background: '#07070B' }}>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-[#D6D876]">&gt;</span>
          <span className="text-[#555568]">Agent #3</span>
          <span className="text-[#1E1E2D]">›</span>
          <span className="text-[#8888A0]">spec/auth-module.md</span>
          <span className="inline-block text-[#555568]" style={{ animation: 'demo-typing 2.4s steps(40) infinite' }}>
            Planning OAuth2 architecture with PKCE flow...
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Terminal: command execution ── */
function TerminalPanel() {
  const steps = [
    { cmd: 'pnpm install', status: 'done', time: '3.2s', output: 'Packages: +142 added' },
    { cmd: 'pnpm build', status: 'done', time: '12.7s', output: '✓ Compiled successfully — 48 modules' },
    { cmd: 'pnpm test:run', status: 'running', time: '—', output: 'Running 24 test suites...' },
    { cmd: 'pnpm deploy --prod', status: 'pending', time: '—', output: '' },
  ];

  return (
    <div>
      <div className="min-h-[240px] p-4 font-mono text-[12px]" style={{ background: '#0C0C14' }}>
        {/* header */}
        <div className="mb-3 flex items-center gap-2 text-[10px] text-[#555568]">
          <span>~/viben-project</span>
          <span className="text-[#1E1E2D]">•</span>
          <span>main</span>
          <span className="text-[#1E1E2D]">•</span>
          <span className="text-[#D6D876]">4 steps</span>
        </div>

        {steps.map((step, i) => (
          <div
            key={step.cmd}
            className="mb-3"
            style={{ animation: `demo-fade-in 0.4s ${i * 0.3}s both` }}
          >
            <div className="flex items-center gap-2">
              {step.status === 'done' && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              )}
              {step.status === 'running' && <div className="h-3 w-3 animate-spin rounded-full border-2 border-[#D6D876] border-t-transparent" />}
              {step.status === 'pending' && <div className="h-3 w-3 rounded-full border border-[#2A2A3A]" />}

              <span className={step.status === 'pending' ? 'text-[#3A3A4A]' : 'text-[#EEEEF0]'}>
                <span className="text-[#D6D876]">$</span> {step.cmd}
              </span>
              {step.time !== '—' && <span className="text-[10px] text-[#555568]">{step.time}</span>}
            </div>

            {step.output && (
              <div className={`mt-1 pl-5 text-[11px] ${step.status === 'running' ? 'text-[#D6D876]' : 'text-[#555568]'}`}>
                {step.status === 'running' ? (
                  <span style={{ animation: 'demo-typing 2s steps(30) infinite' }}>{step.output}</span>
                ) : (
                  step.output
                )}
              </div>
            )}

            {step.status === 'done' && (
              <div className="mt-1.5 pl-5">
                <div className="h-1 w-full overflow-hidden rounded-full" style={{ background: '#14141F' }}>
                  <div className="h-full rounded-full bg-emerald-400/70" style={{ width: '100%', animation: `demo-grow 0.8s ${i * 0.3}s both` }} />
                </div>
              </div>
            )}

            {step.status === 'running' && (
              <div className="mt-1.5 pl-5">
                <div className="h-1 w-full overflow-hidden rounded-full" style={{ background: '#14141F' }}>
                  <div
                    className="h-full rounded-full"
                    style={{ background: '#D6D876', width: '62%', animation: 'demo-progress 2.4s ease-in-out infinite' }}
                  />
                </div>
              </div>
            )}
          </div>
        ))}

        {/* live output block */}
        <div className="mt-2 rounded-lg p-3" style={{ background: '#161620', border: '1px solid #14141F', animation: 'demo-fade-in 0.5s 1.2s both' }}>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-medium text-[#8888A0]">Live Output — test:run</span>
            <span className="text-[10px] text-[#D6D876]">● recording</span>
          </div>
          <div className="space-y-0.5 text-[11px] text-[#555568]">
            <div>
              <span className="text-emerald-400">PASS</span> src/auth/login.test.ts <span className="text-[#3A3A4A]">(1.2s)</span>
            </div>
            <div>
              <span className="text-emerald-400">PASS</span> src/api/users.test.ts <span className="text-[#3A3A4A]">(0.8s)</span>
            </div>
            <div style={{ animation: 'demo-typing 1.8s steps(30) infinite' }}>
              <span className="text-[#D6D876]">RUNS</span> src/payments/checkout.test.ts
            </div>
          </div>
        </div>
      </div>

      {/* status bar */}
      <div className="overflow-hidden px-4 py-2.5 font-mono" style={{ borderTop: '1px solid #14141F', background: '#07070B' }}>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-[#D6D876]">&gt;</span>
          <span className="text-[#555568]">Agent #1</span>
          <span className="text-[#1E1E2D]">›</span>
          <span className="text-[#8888A0]">test:run</span>
          <span className="text-[#555568]">18/24 suites passed · 3 running...</span>
        </div>
      </div>
    </div>
  );
}

/* ── Code: diff & review ── */
function CodePanel() {
  const diffLines: { type: string; num?: (number | null)[]; content: string }[] = [
    { type: 'header', content: 'src/auth/middleware.ts' },
    { type: 'context', num: [14, 14], content: "import { verify } from './jwt';" },
    { type: 'context', num: [15, 15], content: '' },
    { type: 'removed', num: [16, null], content: "export function auth(req: Request) {" },
    { type: 'added', num: [null, 16], content: "export async function auth(req: Request) {" },
    { type: 'context', num: [17, 17], content: "  const token = req.headers.get('Authorization');" },
    { type: 'removed', num: [18, null], content: "  if (!token) return null;" },
    { type: 'added', num: [null, 18], content: "  if (!token) throw new AuthError('TOKEN_MISSING');" },
    { type: 'added', num: [null, 19], content: '' },
    { type: 'added', num: [null, 20], content: "  const payload = await verify(token, { algorithms: ['RS256'] });" },
    { type: 'context', num: [19, 21], content: "  return { userId: payload.sub, role: payload.role };" },
    { type: 'context', num: [20, 22], content: '}' },
  ];

  const comments = [
    {
      author: 'Agent #2',
      avatar: '🤖',
      line: 18,
      text: 'AuthError 需要在 errors.ts 中导出，已自动添加。',
      resolved: true,
    },
    {
      author: 'Agent #5',
      avatar: '🔍',
      line: 20,
      text: '建议增加 token 过期时间校验，防止 replay 攻击。',
      resolved: false,
    },
  ];

  return (
    <div>
      {/* file tabs */}
      <div className="flex items-center gap-0 px-1 pt-1" style={{ borderBottom: '1px solid #14141F' }}>
        <div className="rounded-t-md px-3 py-1.5 text-[11px] font-medium text-[#EEEEF0]" style={{ background: '#161620', borderBottom: '2px solid #D6D876' }}>
          middleware.ts
        </div>
        <div className="px-3 py-1.5 text-[11px] text-[#555568]">errors.ts</div>
        <div className="px-3 py-1.5 text-[11px] text-[#555568]">jwt.ts</div>
        <div className="ml-auto flex items-center gap-2 px-3 text-[10px] text-[#555568]">
          <span className="text-emerald-400">+4</span>
          <span className="text-rose-400">−2</span>
          <span>3 files changed</span>
        </div>
      </div>

      {/* diff */}
      <div className="min-h-[200px] font-mono text-[11px]" style={{ background: '#0C0C14' }}>
        {diffLines.map((line, i) => {
          if (line.type === 'header') {
            return (
              <div key={i} className="flex items-center gap-2 px-4 py-2 text-[10px] text-[#8888A0]" style={{ background: '#0E0E18', borderBottom: '1px solid #14141F' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#555568" strokeWidth="2">
                  <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
                  <path d="M14 2v4a2 2 0 0 0 2 2h4" />
                </svg>
                {line.content}
              </div>
            );
          }
          const bg =
            line.type === 'added'
              ? 'rgba(34,197,94,0.08)'
              : line.type === 'removed'
                ? 'rgba(239,68,68,0.08)'
                : 'transparent';
          const numColor = line.type === 'added' ? '#34D399' : line.type === 'removed' ? '#EF4444' : '#3A3A4A';
          const prefix = line.type === 'added' ? '+' : line.type === 'removed' ? '−' : ' ';
          const textColor = line.type === 'added' ? '#BBFFDD' : line.type === 'removed' ? '#FFBBBB' : '#8888A0';

          return (
            <div
              key={i}
              className="flex"
              style={{ background: bg, animation: `demo-fade-in 0.3s ${i * 0.06}s both` }}
            >
              <span className="inline-block w-8 flex-shrink-0 select-none px-1.5 text-right" style={{ color: numColor }}>
                {line.num?.[0] ?? ''}
              </span>
              <span className="inline-block w-8 flex-shrink-0 select-none px-1.5 text-right" style={{ color: numColor }}>
                {line.num?.[1] ?? ''}
              </span>
              <span className="w-4 flex-shrink-0 select-none text-center" style={{ color: numColor }}>
                {prefix}
              </span>
              <span style={{ color: textColor }} className="flex-1 whitespace-pre pr-4">
                {line.content}
              </span>
            </div>
          );
        })}
      </div>

      {/* review comments */}
      <div className="space-y-2 p-3" style={{ borderTop: '1px solid #14141F', background: '#0E0E18' }}>
        <div className="mb-1 text-[10px] font-medium text-[#8888A0]">Review Comments</div>
        {comments.map((c, i) => (
          <div
            key={i}
            className="rounded-lg p-2.5"
            style={{ background: '#161620', border: '1px solid #14141F', animation: `demo-fade-in 0.4s ${0.6 + i * 0.2}s both` }}
          >
            <div className="mb-1 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-[12px]">{c.avatar}</span>
                <span className="text-[10px] font-medium text-[#EEEEF0]">{c.author}</span>
                <span className="text-[9px] text-[#555568]">line {c.line}</span>
              </div>
              {c.resolved ? (
                <span className="flex items-center gap-1 text-[9px] text-emerald-400">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                  Resolved
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[9px] text-[#FFB020]">
                  <div className="h-1.5 w-1.5 rounded-full bg-[#FFB020]" />
                  Open
                </span>
              )}
            </div>
            <p className="text-[11px] leading-relaxed text-[#8888A0]">{c.text}</p>
          </div>
        ))}
      </div>

      {/* status bar */}
      <div className="overflow-hidden px-4 py-2.5 font-mono" style={{ borderTop: '1px solid #14141F', background: '#07070B' }}>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-[#D6D876]">&gt;</span>
          <span className="text-[#555568]">Agent #2</span>
          <span className="text-[#1E1E2D]">›</span>
          <span className="text-[#8888A0]">code-review</span>
          <span className="text-[#555568]">2 comments · 1 resolved · 3 files reviewed</span>
        </div>
      </div>
    </div>
  );
}

/* ── Tests: results dashboard ── */
function TestsPanel() {
  const suites = [
    {
      name: 'src/auth/login.test.ts',
      status: 'pass',
      tests: 6,
      passed: 6,
      time: '1.2s',
      cases: [
        { name: 'should authenticate with valid credentials', status: 'pass' },
        { name: 'should reject expired tokens', status: 'pass' },
        { name: 'should handle PKCE flow', status: 'pass' },
      ],
    },
    {
      name: 'src/api/users.test.ts',
      status: 'pass',
      tests: 8,
      passed: 8,
      time: '0.8s',
      cases: [
        { name: 'GET /users returns paginated list', status: 'pass' },
        { name: 'POST /users creates new user', status: 'pass' },
      ],
    },
    {
      name: 'src/payments/checkout.test.ts',
      status: 'fail',
      tests: 5,
      passed: 3,
      time: '2.1s',
      cases: [
        { name: 'should process valid payment', status: 'pass' },
        { name: 'should handle currency conversion', status: 'fail' },
        { name: 'should validate card expiry', status: 'pass' },
      ],
    },
    {
      name: 'src/dashboard/widgets.test.ts',
      status: 'pass',
      tests: 4,
      passed: 4,
      time: '0.5s',
      cases: [
        { name: 'renders chart widget correctly', status: 'pass' },
        { name: 'handles empty data gracefully', status: 'pass' },
      ],
    },
  ];

  const totalTests = suites.reduce((a, s) => a + s.tests, 0);
  const totalPassed = suites.reduce((a, s) => a + s.passed, 0);

  return (
    <div>
      {/* summary bar */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #14141F', background: '#0E0E18' }}>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="text-[11px] font-medium text-[#EEEEF0]">{totalPassed} passed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-rose-400" />
            <span className="text-[11px] font-medium text-[#EEEEF0]">{totalTests - totalPassed} failed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-[#555568]">{totalTests} total</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-[#555568]">coverage</span>
            <span className="font-mono text-[11px] font-medium text-[#D6D876]">87%</span>
          </div>
          <div className="h-1 w-20 overflow-hidden rounded-full" style={{ background: '#14141F' }}>
            <div className="h-full rounded-full bg-[#D6D876]" style={{ width: '87%', animation: 'demo-grow 1s 0.3s both' }} />
          </div>
        </div>
      </div>

      {/* test suites */}
      <div className="min-h-[220px] space-y-0 font-mono" style={{ background: '#0C0C14' }}>
        {suites.map((suite, si) => (
          <div key={suite.name} style={{ animation: `demo-fade-in 0.4s ${si * 0.15}s both` }}>
            {/* suite header */}
            <div className="flex items-center gap-2 px-4 py-2" style={{ borderBottom: '1px solid #14141F' }}>
              {suite.status === 'pass' ? (
                <span className="text-[11px] font-bold text-emerald-400">PASS</span>
              ) : (
                <span className="text-[11px] font-bold text-rose-400">FAIL</span>
              )}
              <span className="flex-1 text-[11px] text-[#8888A0]">{suite.name}</span>
              <span className="text-[10px] text-[#555568]">
                {suite.passed}/{suite.tests}
              </span>
              <span className="text-[10px] text-[#3A3A4A]">{suite.time}</span>
            </div>
            {/* test cases */}
            <div className="pl-8">
              {suite.cases.map((tc, ti) => (
                <div
                  key={tc.name}
                  className="flex items-center gap-2 px-4 py-1"
                  style={{ animation: `demo-fade-in 0.3s ${si * 0.15 + ti * 0.08 + 0.2}s both` }}
                >
                  {tc.status === 'pass' ? (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  ) : (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 6 6 18" />
                      <path d="m6 6 12 12" />
                    </svg>
                  )}
                  <span className={`text-[10px] ${tc.status === 'pass' ? 'text-[#555568]' : 'text-rose-300'}`}>{tc.name}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* error detail */}
      <div className="p-3" style={{ borderTop: '1px solid #14141F', background: '#0E0E18' }}>
        <div className="rounded-lg p-2.5" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', animation: 'demo-fade-in 0.5s 0.8s both' }}>
          <div className="mb-1 flex items-center gap-2">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
            <span className="text-[10px] font-medium text-rose-300">checkout.test.ts:42 — should handle currency conversion</span>
          </div>
          <div className="pl-5 text-[10px] text-[#555568]">
            <div>
              Expected: <span className="text-[#EEEEF0]">149.99</span>
            </div>
            <div>
              Received: <span className="text-rose-300">150.00</span>
            </div>
            <div className="mt-1 text-[9px] text-[#3A3A4A]">Floating-point precision in EUR→USD conversion</div>
          </div>
        </div>
      </div>

      {/* status bar */}
      <div className="overflow-hidden px-4 py-2.5 font-mono" style={{ borderTop: '1px solid #14141F', background: '#07070B' }}>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-[#D6D876]">&gt;</span>
          <span className="text-[#555568]">Agent #4</span>
          <span className="text-[#1E1E2D]">›</span>
          <span className="text-[#8888A0]">test-runner</span>
          <span className="text-[#555568]">{totalPassed}/{totalTests} passed · 1 failure needs attention</span>
        </div>
      </div>
    </div>
  );
}

/* ── Styles (injected once) ── */
function DemoStyles() {
  return (
    <style>{`
      @keyframes demo-fade-in {
        from { opacity: 0; transform: translateY(6px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes demo-grow {
        from { width: 0%; }
      }
      @keyframes demo-typing {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.4; }
      }
      @keyframes demo-progress {
        0% { width: 42%; }
        50% { width: 68%; }
        100% { width: 42%; }
      }
    `}</style>
  );
}

/* ── Tab container ── */
export function DemoTabs() {
  const [active, setActive] = useState<TabId>('board');

  return (
    <section className="border-b border-white/10 bg-[#0a0a10]/80 py-14">
      <DemoStyles />
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-6 text-center">
          <p className="text-sm font-medium text-zinc-400">任务编排 Demo</p>
        </div>

        {/* tab bar */}
        <div className="mx-auto flex w-fit justify-center gap-1 rounded-full p-1" style={{ background: '#0E0E14', border: '1px solid #1E1E2D' }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={active === tab.id}
              aria-controls={`demo-panel-${tab.id}`}
              id={`demo-tab-${tab.id}`}
              onClick={() => setActive(tab.id)}
              className="relative cursor-pointer rounded-full px-4 py-1.5 text-[12px] font-medium transition-colors duration-200"
              style={{ color: active === tab.id ? '#07070B' : '#8888A0' }}
            >
              {active === tab.id && <div className="absolute inset-0 rounded-full bg-[#D6D876]" />}
              <span className="relative z-10">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* panel wrapper */}
        <div className="relative mx-auto mt-4 w-full max-w-4xl md:mt-6">
          <div className="pointer-events-none absolute -inset-8 rounded-3xl opacity-30 blur-3xl" style={{ background: 'radial-gradient(ellipse at center, rgba(214,216,118,0.05), transparent 70%)' }} />
          <div
            id={`demo-panel-${active}`}
            role="tabpanel"
            aria-labelledby={`demo-tab-${active}`}
            className="relative overflow-hidden rounded-xl"
            style={{ background: '#0E0E14', border: '1px solid #1E1E2D', boxShadow: '0 0 80px rgba(214,216,118,0.05), 0 20px 60px rgba(0,0,0,0.5)' }}
          >
            {/* title bar */}
            <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid #14141F' }}>
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
                  <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/70" />
                  <div className="h-2.5 w-2.5 rounded-full bg-green-500/70" />
                </div>
                <span className="ml-2 font-mono text-[11px] text-[#555568]">viben — multi-agent workspace</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-[11px] text-[#555568]">8 agents active</span>
                <div className="flex -space-x-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <div
                      key={n}
                      className="flex h-4 w-4 items-center justify-center rounded-full font-mono text-[7px] font-bold"
                      style={{ background: '#161620', border: '1px solid #1E1E2D', color: '#555568' }}
                    >
                      {n}
                    </div>
                  ))}
                  <div
                    className="flex h-4 w-4 items-center justify-center rounded-full font-mono text-[7px]"
                    style={{ background: '#161620', border: '1px solid #1E1E2D', color: '#555568' }}
                  >
                    +3
                  </div>
                </div>
              </div>
            </div>

            {/* tab content – keyed so animations re-trigger on switch */}
            <div key={active}>
              {active === 'board' && <BoardPanel />}
              {active === 'terminal' && <TerminalPanel />}
              {active === 'code' && <CodePanel />}
              {active === 'tests' && <TestsPanel />}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
