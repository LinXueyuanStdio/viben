'use client';

import { useMemo, useState } from 'react';

const DEMO_TABS = [
  {
    id: 'board',
    label: 'Board',
    title: 'Kanban 工作流编排',
    subtitle: '从待办到发布，任务状态清晰可追踪',
    lines: ['需求拆分为可执行卡片', '多智能体并行推进', '审核节点前置，降低返工'],
  },
  {
    id: 'terminal',
    label: 'Terminal',
    title: 'Code 执行与命令编排',
    subtitle: '统一管理运行步骤与日志输出',
    lines: ['按步骤串联构建/测试/发布', '关键命令失败即时反馈', '执行链路全程可回溯'],
  },
  {
    id: 'code',
    label: 'Code',
    title: 'Code 评审协作视图',
    subtitle: '集中查看变更、评审意见与处理状态',
    lines: ['聚焦关键改动上下文', '评论反馈快速闭环', '协作过程沉淀为可复用经验'],
  },
  {
    id: 'tests',
    label: 'Tests',
    title: 'Test 结果与质量门禁',
    subtitle: '在发布前统一检查质量信号',
    lines: ['测试状态实时展示', '失败点自动聚合定位', '通过后再进入发布阶段'],
  },
] as const;

export function DemoTabs() {
  const [active, setActive] = useState<(typeof DEMO_TABS)[number]['id']>('board');
  const current = useMemo(() => DEMO_TABS.find((item) => item.id === active) ?? DEMO_TABS[0], [active]);

  return (
    <section className="border-b border-white/10 bg-[#0a0a10]/80 py-14">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-6 text-center">
          <p className="text-sm font-medium text-zinc-400">任务编排 Demo</p>
        </div>
        <div role="tablist" aria-label="Viben demo tabs" className="mx-auto flex w-fit flex-wrap justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-2">
          {DEMO_TABS.map((item) => (
            <button
              key={item.id}
              role="tab"
              aria-selected={active === item.id}
              aria-controls={`demo-panel-${item.id}`}
              id={`demo-tab-${item.id}`}
              onClick={() => setActive(item.id)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                active === item.id ? 'bg-amber-300 text-zinc-950' : 'text-zinc-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div
          id={`demo-panel-${current.id}`}
          role="tabpanel"
          aria-labelledby={`demo-tab-${current.id}`}
          className="mx-auto mt-6 max-w-4xl overflow-hidden rounded-2xl border border-white/10 bg-[#101019] p-6"
        >
          <div className="mb-4 flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </div>
          <h3 className="text-xl font-semibold text-white">{current.title}</h3>
          <p className="mt-2 text-sm text-zinc-300">{current.subtitle}</p>
          <div className="mt-4 space-y-2">
            {current.lines.map((line) => (
              <div key={line} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-200">
                {line}
              </div>
            ))}
          </div>
          <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              key={current.id}
              role="progressbar"
              aria-label={`${current.label} demo progress`}
              className="h-full w-1/3 animate-[pulse_1.8s_ease-in-out_infinite] rounded-full bg-amber-300/90"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
