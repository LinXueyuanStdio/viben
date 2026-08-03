"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, AlertTriangle, Info, FileText, Plus, Key, Terminal, BookOpen } from "lucide-react";

const MCP_ENDPOINT = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/mcp/v1`;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// ═══════════════════════════════════════════════════════════
// Syntax highlighting
// ═══════════════════════════════════════════════════════════
function highlightJson(code: string) {
  const regex = /("(?:\\.|[^"\\])*")\s*:|("(?:\\.|[^"\\])*")|(-?\b\d+\.?\d*\b(?:[eE][+-]?\d+)?)(?=\s*[,}\]\n\r])|(\b(?:true|false|null)\b)/g;
  const parts: React.ReactNode[] = [];
  let last = 0, m: RegExpExecArray | null;
  while ((m = regex.exec(code)) !== null) {
    if (m.index > last) parts.push(<span key={last} className="text-zinc-300">{code.slice(last, m.index)}</span>);
    if (m[1]) parts.push(<span key={m.index} className="text-[#0550ae] dark:text-sky-400">{m[1]}</span>, <span key={m.index + "c"} className="text-foreground/60">:</span>);
    else if (m[2]) parts.push(<span key={m.index} className="text-[#0a3069] dark:text-emerald-400">{m[2]}</span>);
    else if (m[3]) parts.push(<span key={m.index} className="text-[#953800] dark:text-amber-400">{m[3]}</span>);
    else if (m[4]) parts.push(<span key={m.index} className="text-[#8250df] dark:text-purple-400">{m[4]}</span>);
    last = m.index + m[0].length;
  }
  if (last < code.length) parts.push(<span key={last} className="text-foreground">{code.slice(last)}</span>);
  return parts;
}

function highlightBash(code: string) {
  return code.split("\n").flatMap((line, li) => {
    const commentIdx = line.indexOf("#");
    const parts: React.ReactNode[] = [];
    if (commentIdx >= 0) {
      parts.push(<span key={`${li}c`} className="text-foreground">{line.slice(0, commentIdx)}</span>);
      parts.push(<span key={`${li}cm`} className="text-muted-foreground">{line.slice(commentIdx)}</span>);
    } else {
      const segs = line.split(/(--?[a-zA-Z][\w-]*)/g);
      parts.push(...segs.map((s, pi) => /^--?[a-zA-Z]/.test(s)
        ? <span key={`${li}${pi}`} className="text-[#953800] dark:text-amber-400">{s}</span>
        : <span key={`${li}${pi}`} className="text-foreground">{s}</span>));
    }
    if (li < code.split("\n").length - 1) parts.push("\n");
    return parts;
  });
}

function highlightCode(code: string, lang?: string) {
  switch (lang) {
    case "json": return highlightJson(code);
    case "bash": return highlightBash(code);
    default: return <span className="text-foreground">{code}</span>;
  }
}

// ═══════════════════════════════════════════════════════════
// Code Block
// ═══════════════════════════════════════════════════════════
function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="group relative overflow-hidden rounded-lg border bg-muted/30">
      <div className="flex items-center justify-between border-b px-3 py-1.5">
        <span className="font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground select-none">{lang || "text"}</span>
        <button
          onClick={async () => { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {copied ? <Check size={11} /> : <Copy size={11} />}
          {copied ? "已复制" : "复制"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4">
        <code className="font-mono text-[13px] leading-relaxed text-foreground">{highlightCode(code, lang)}</code>
      </pre>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Inline Code
// ═══════════════════════════════════════════════════════════
function InlineCode({ children }: { children: string }) {
  return <code className="relative rounded-sm bg-surface px-[0.3rem] py-[0.2rem] font-mono text-[13px] text-text">{children}</code>;
}

// ═══════════════════════════════════════════════════════════
// Endpoint Copy
// ═══════════════════════════════════════════════════════════
function EndpointCopy({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="inline-flex items-center gap-2">
      <code className="rounded bg-surface px-2 py-1 font-mono text-sm break-all">{url}</code>
      <button
        onClick={async () => { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
        className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </span>
  );
}

// ═══════════════════════════════════════════════════════════
// Parameter Table
// ═══════════════════════════════════════════════════════════
interface Param { name: string; type: string; required: string; desc: string; }

function ParamTable({ params }: { params: Param[] }) {
  return (
    <div>
      <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Parameters</h4>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-3 py-2 text-left text-xs font-semibold">参数</th>
              <th className="px-3 py-2 text-left text-xs font-semibold">类型</th>
              <th className="px-3 py-2 text-left text-xs font-semibold">必填</th>
              <th className="px-3 py-2 text-left text-xs font-semibold">说明</th>
            </tr>
          </thead>
          <tbody>
            {params.map((p) => (
              <tr key={p.name} className="border-b border-border last:border-0">
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs font-medium text-foreground">{p.name}</td>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-muted-foreground">{p.type}</td>
                <td className="whitespace-nowrap px-3 py-2 text-xs">
                  {p.required === "是"
                    ? <span className="inline-flex items-center rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-600 dark:text-red-400">required</span>
                    : <span className="text-muted-foreground">optional</span>}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground leading-relaxed">{p.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Tool Section
// ═══════════════════════════════════════════════════════════
function ToolSection({
  name, badge, description, params, returns, notes, examples,
}: {
  name: string; badge?: string; description: string;
  params: Param[]; returns: string; notes?: string;
  examples: { label: string; params: Record<string, unknown> }[];
}) {
  return (
    <div className="space-y-5">
      {/* tool name — monospace, like alphaXiv */}
      <h3 className="font-mono text-base font-semibold break-all text-foreground">{name}</h3>

      {/* description */}
      <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>

      {/* parameters — stacked, not table */}
      <ParamTable params={params} />

      {/* returns */}
      <div>
        <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Returns</h4>
        <p className="text-sm leading-relaxed text-muted-foreground">{returns}</p>
      </div>

      {/* notes */}
      {notes && (
        <div className="flex gap-2.5 rounded-lg border border-blue-200 bg-blue-50/50 p-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950/20 dark:text-blue-300">
          <Info size={15} className="mt-0.5 shrink-0 text-blue-600 dark:text-blue-400" />
          <div>{notes}</div>
        </div>
      )}

      {/* examples — collapsible with <details> */}
      <details className="group rounded-lg border border-border">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-xs font-medium text-muted-foreground select-none hover:bg-muted/30 transition-colors">
          <span className="transition-transform group-open:rotate-90">▸</span>
          Examples ({examples.length})
        </summary>
        <div className="border-t border-border px-4 py-4 space-y-4">
          {examples.map((ex, i) => (
            <div key={i}>
              <p className="mb-2 text-sm font-medium text-foreground">{ex.label}</p>
              <CodeBlock code={JSON.stringify(ex.params, null, 2)} lang="json" />
            </div>
          ))}
        </div>
      </details>

      {/* badge marker */}
      {badge && (
        <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-400">
          <AlertTriangle size={12} />{badge}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Client Tabs
// ═══════════════════════════════════════════════════════════
const CLIENT_TABS = [
  {
    name: "Claude Code",
    content: (
      <div className="space-y-4 text-sm">
        <CodeBlock
          code={`# 使用 API Key 认证（推荐）
claude mcp add --transport http viben ${MCP_ENDPOINT} --header "Authorization: Bearer <key>"`}
          lang="bash"
        />
      </div>
    ),
  },
  {
    name: "Codex",
    content: (
      <div className="space-y-4 text-sm">
        <p className="text-muted-foreground leading-relaxed">
          Codex 目前推荐通过 API Key 认证。
        </p>
        <CodeBlock
          code={`# 使用 API Key 认证
export VIBEN_API_KEY="<key>"
codex mcp add viben --url ${MCP_ENDPOINT} --bearer-token-env-var VIBEN_API_KEY`}
          lang="bash"
        />
      </div>
    ),
  },
  {
    name: "Cursor",
    content: (
      <div className="space-y-4 text-sm">
        <p className="text-muted-foreground leading-relaxed">
          添加到 <InlineCode>~/.cursor/mcp.json</InlineCode>（或项目中的 <InlineCode>.cursor/mcp.json</InlineCode>）。
          不传 <code className="font-mono text-xs">headers</code> 则无需认证即可使用公开工具。
        </p>
        <CodeBlock
          code={JSON.stringify({
            mcpServers: {
              viben: {
                url: MCP_ENDPOINT,
                headers: { Authorization: "Bearer <key>" },
              },
            },
          }, null, 2)}
          lang="json"
        />
      </div>
    ),
  },
  {
    name: "VS Code",
    content: (
      <div className="space-y-4 text-sm">
        <p className="text-muted-foreground leading-relaxed">
          添加到 VS Code 的 MCP 配置文件中。
        </p>
        <CodeBlock
          code={JSON.stringify({
            servers: {
              viben: {
                type: "streamableHttp",
                url: MCP_ENDPOINT,
                headers: { Authorization: "Bearer <key>" },
              },
            },
          }, null, 2)}
          lang="json"
        />
      </div>
    ),
  },
  {
    name: "Claude Desktop",
    content: (
      <div className="space-y-4 text-sm">
        <p className="text-muted-foreground leading-relaxed">
          在 <InlineCode>claude_desktop_config.json</InlineCode> 中添加 streamableHttp 类型的服务器配置。
        </p>
        <CodeBlock
          code={JSON.stringify({
            mcpServers: {
              viben: {
                type: "streamableHttp",
                url: MCP_ENDPOINT,
                headers: { Authorization: "Bearer <key>" },
              },
            },
          }, null, 2)}
          lang="json"
        />
      </div>
    ),
  },
];

function ClientTabs() {
  const [active, setActive] = useState(0);
  return (
    <div>
      <div className="flex gap-1 border-b border-border">
        {CLIENT_TABS.map((t, i) => (
          <button
            key={t.name}
            onClick={() => setActive(i)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-[1px] ${
              i === active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.name}
          </button>
        ))}
      </div>
      <div className="pt-4">{CLIENT_TABS[active].content}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Data
// ═══════════════════════════════════════════════════════════
const READ_TOOLS = [
  {
    name: "search_pages",
    description: "搜索 viben 上已发布的公开页面。同时匹配标题、页面标识符（uid）和描述内容。结果按最近发布时间降序排列。适合内容发现和检索。",
    params: [
      { name: "query", type: "string", required: "是", desc: "搜索关键词。ILIKE 模糊匹配，支持中英文。同时匹配标题、uid 和描述。最小 1 字符。" },
      { name: "author_slug", type: "string", required: "否", desc: "按作者 slug 过滤。不传则搜索全站公开页面。" },
      { name: "limit", type: "number", required: "否", desc: "返回数量上限。默认 20，最小 1，最大 50。" },
    ] as Param[],
    returns: "pages 数组，每项含 uid、title、author_slug、description、tags、published_at。按 lastPublishedAt 降序。",
    notes: "建议先用简短关键词初步搜索。结合 author_slug 可精确查找特定作者页面。",
    examples: [
      { label: "按关键词搜索", params: { query: "前端性能优化" } },
      { label: "按作者过滤并限制数量", params: { query: "React", author_slug: "LinXueyuanStdio", limit: 10 } },
    ],
  },
  {
    name: "get_page",
    description: "获取指定页面的完整内容，包括 HTML 源码、元数据（标题、描述、标签、封面图）、可见性设置和作者信息。适合深度阅读和内容分析。",
    params: [
      { name: "author_slug", type: "string", required: "是", desc: "页面作者的 slug。从 search_pages 返回结果获取。" },
      { name: "page_uid", type: "string", required: "是", desc: "页面唯一标识符。从 search_pages 返回的 uid 字段获取。" },
    ] as Param[],
    returns: "uid、title、html、description、tags、visibility、cover_url、published_at、version，以及 author 对象（display_name、avatar_url、slug）。",
    notes: "author_slug + page_uid 唯一确定页面。html 最大约 5MB。页面不存在或不可访问时返回错误。",
    examples: [
      { label: "获取公开页面", params: { author_slug: "LinXueyuanStdio", page_uid: "react-patterns" } },
    ],
  },
];

const WRITE_TOOLS = [
  {
    name: "create_page",
    description: "在 viben 上发布新页面。uid 在同一作者下已存在时自动更新为最新内容（upsert 语义）。发布成功后自动通知订阅者。需要 API Key 认证。",
    params: [
      { name: "uid", type: "string", required: "是", desc: "页面唯一标识符。建议使用有意义的英文 slug。同一作者下必须唯一。1-200 字符。" },
      { name: "title", type: "string", required: "是", desc: "页面标题。1-500 字符，支持中英文。" },
      { name: "html", type: "string", required: "是", desc: "页面 HTML 内容。建议控制在 5MB 以内。" },
      { name: "description", type: "string", required: "否", desc: "页面描述/摘要。最长 2000 字符，用于搜索匹配和 SEO。" },
      { name: "tags", type: "string[]", required: "否", desc: "标签列表。最多 12 个，超出自动截断。" },
      { name: "visibility", type: '"public" | "unlisted" | "private"', required: "否", desc: "可见性。public 公开；unlisted 不在列表显示但可链接访问；private 仅作者可见。默认 public。" },
      { name: "cover_url", type: "string", required: "否", desc: "封面图片 URL。" },
    ] as Param[],
    returns: "success、page_uid、url、read_url。updated 标识新建（false）或更新已有页面（true）。",
    notes: "upsert 语义：uid 已存在时自动更新，版本号递增。private 或 unlisted 页面可被作者本人搜索到。",
    examples: [
      { label: "发布公开页面", params: { uid: "hello-world", title: "Hello, Viben!", html: "<h1>Hello World</h1><p>我的第一篇文章</p>", description: "一篇入门文章", tags: ["intro"], visibility: "public" } },
      { label: "创建私有笔记", params: { uid: "private-notes", title: "个人笔记", html: "<h2>待办</h2><ul><li>完成文档</li></ul>", visibility: "private" } },
    ],
  },
  {
    name: "update_page",
    description: "更新已有页面的内容或元数据。仅更新指定字段，未指定字段保持原值。比 create_page 更轻量。需要 API Key 认证，仅页面作者可操作。",
    params: [
      { name: "uid", type: "string", required: "是", desc: "页面唯一标识符。页面必须已存在且属于当前用户。" },
      { name: "title", type: "string", required: "否", desc: "新标题。1-500 字符。不传则保持原标题。" },
      { name: "html", type: "string", required: "否", desc: "新 HTML 内容。不传则保持原内容。" },
      { name: "description", type: "string", required: "否", desc: "新描述。最长 2000 字符。不传则保持原描述。" },
      { name: "tags", type: "string[]", required: "否", desc: "新标签列表。最多 12 个。不传则保持原标签。" },
      { name: "visibility", type: '"public" | "unlisted" | "private"', required: "否", desc: "新可见性。不传则保持原设置。" },
      { name: "cover_url", type: "string", required: "否", desc: "新封面 URL。不传保持原值，传空字符串清除封面。" },
    ] as Param[],
    returns: "success、page_uid、url、read_url。updated 始终为 true。页面不存在或不属于当前用户时返回错误。",
    notes: "与 create_page 不同，update_page 要求页面已存在，不存在时返回错误。每次更新递增版本号并通知订阅者。",
    examples: [
      { label: "更新标题和标签", params: { uid: "hello-world", title: "Hello, Viben! (2026 版)", tags: ["intro", "hello", "2026"] } },
      { label: "仅修改可见性", params: { uid: "draft-post", visibility: "unlisted" } },
    ],
  },
];

const WORKFLOWS = [
  {
    title: "内容发现 → 深度阅读",
    steps: [
      { tool: "search_pages", desc: "用关键词搜索页面，获得 uid 和 author_slug" },
      { tool: "get_page", desc: "获取完整 HTML 内容进行分析或摘要" },
      { desc: "基于获取的内容进行翻译、改写等二次处理" },
    ],
  },
  {
    title: "AI 生成 → 发布",
    steps: [
      { desc: "使用 AI 生成页面内容（标题、HTML、描述、标签）" },
      { tool: "create_page", desc: "发布新页面，设置合适的 uid 和 visibility" },
      { desc: "返回的 url 可直接分享给读者" },
    ],
  },
  {
    title: "批量更新元数据",
    steps: [
      { tool: "search_pages", desc: "搜索需要更新的页面列表" },
      { tool: "update_page", desc: "对每个页面仅传入需要修改的字段" },
      { desc: "无需重新发送 html，高效完成批量更新" },
    ],
  },
];

// ═══════════════════════════════════════════════════════════
// Page
// ═══════════════════════════════════════════════════════════
export default function McpDocsPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      {/* Hero */}
      <div className="mb-14">
        <h1 className="font-bold text-2xl text-foreground md:text-3xl">Viben MCP 服务</h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Viben MCP 服务基于 Model Context Protocol (MCP) v1.0.0，为 AI 应用、智能体和自动化工作流
          提供对 Viben 页面系统的程序化访问。AI 助手可以直接搜索、读取、创建和更新页面，无需离开对话上下文。
        </p>
      </div>

      {/* 连接信息 — using <dl> like alphaXiv */}
      <section className="mb-14">
        <h2 className="font-semibold text-xl text-foreground">连接信息</h2>
        <dl className="mt-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:gap-4">
            <dt className="shrink-0 text-sm font-medium text-foreground sm:w-32">端点</dt>
            <dd className="min-w-0 text-sm leading-relaxed text-muted-foreground">
              <EndpointCopy url={MCP_ENDPOINT} />
            </dd>
          </div>
          <div className="flex flex-col sm:flex-row sm:gap-4">
            <dt className="shrink-0 text-sm font-medium text-foreground sm:w-32">传输方式</dt>
            <dd className="min-w-0 text-sm leading-relaxed text-muted-foreground">Streamable HTTP</dd>
          </div>
          <div className="flex flex-col sm:flex-row sm:gap-4">
            <dt className="shrink-0 text-sm font-medium text-foreground sm:w-32">认证</dt>
            <dd className="min-w-0 text-sm leading-relaxed text-muted-foreground">
              默认使用 Bearer Token 认证（API Key，bmcp_ 前缀）。可通过{" "}
              <a href={`${APP_URL}/settings/api_keys`} className="inline-flex items-center gap-0.5 text-primary underline hover:no-underline">
                API 密钥管理 <ExternalLink size={11} />
              </a>{" "}
              页面创建。
            </dd>
          </div>
          <div className="flex flex-col sm:flex-row sm:gap-4">
            <dt className="shrink-0 text-sm font-medium text-foreground sm:w-32">协议版本</dt>
            <dd className="min-w-0 text-sm leading-relaxed text-muted-foreground">Model Context Protocol (MCP) v1.0.0</dd>
          </div>
          <div className="flex flex-col sm:flex-row sm:gap-4">
            <dt className="shrink-0 text-sm font-medium text-foreground sm:w-32">支持的客户端</dt>
            <dd className="min-w-0 text-sm leading-relaxed text-muted-foreground">
              原生 MCP 客户端 — Claude Code、Codex、Claude Desktop、VS Code、Cursor，以及{" "}
              <InlineCode>mcp-remote</InlineCode> 等 CLI 桥接工具。
            </dd>
          </div>
        </dl>
        <div className="mt-4 flex gap-2.5 rounded-lg border border-amber-200 bg-amber-50/50 p-3">
          <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="text-sm text-amber-800 dark:text-amber-300">
            浏览器中运行的 MCP 集成（如直接在 claude.ai 或 chatgpt.com 添加）因 CORS 策略<strong>无法</strong>直接连接。
            请通过 <InlineCode>{`npx mcp-remote ${MCP_ENDPOINT}`}</InlineCode> 使用本地桥接，然后将助手指向桥接地址。
          </div>
        </div>
      </section>

      {/* 快速开始 */}
      <section className="mb-14">
        <h2 className="font-semibold text-xl text-foreground">快速开始</h2>
        <div className="mt-4">
          <ClientTabs />
        </div>
      </section>

      {/* 工具参考 */}
      <section className="mb-14">
        <h2 className="font-semibold text-xl text-foreground">工具参考</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Viben MCP 服务提供 <strong>4 个工具</strong>，分为读取工具和写入工具。将它们组合使用即可构建完整的内容管理工作流。
        </p>

        <h3 className="mt-10 mb-1 flex items-center gap-2 font-semibold text-lg text-foreground">
          <FileText size={18} className="text-primary/70" /> 读取工具
        </h3>
        <p className="mb-8 mt-1.5 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          搜索和获取页面内容。无需认证即可访问公开页面；传入 API Key 后可额外访问本人的私有页面。
        </p>
        <div className="mb-12 space-y-16">
          {READ_TOOLS.map((t) => <ToolSection key={t.name} {...t} />)}
        </div>

        <h3 className="mt-10 mb-1 flex items-center gap-2 font-semibold text-lg text-foreground">
          <Plus size={18} className="text-primary/70" /> 写入工具
        </h3>
        <p className="mb-8 mt-1.5 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          创建和更新页面内容。需要 API Key 认证，操作者只能管理自己的页面。
        </p>
        <div className="space-y-16">
          {WRITE_TOOLS.map((t) => <ToolSection key={t.name} {...t} badge="需要认证" />)}
        </div>
      </section>

      {/* 常见工作流 */}
      <section className="mb-14">
        <h2 className="mb-4 flex items-center gap-2.5 font-semibold text-xl text-foreground">
          <BookOpen size={20} className="text-primary/70" /> 常见工作流
        </h2>
        <div className="space-y-4">
          {WORKFLOWS.map((wf) => (
            <div key={wf.title} className="rounded-xl border bg-card p-5">
              <h3 className="mb-4 text-sm font-medium">{wf.title}</h3>
              <div className="space-y-3">
                {wf.steps.map((step, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">{i + 1}</span>
                    <span className="pt-0.5 text-sm text-muted-foreground leading-relaxed">
                      {step.tool ? <><InlineCode>{step.tool}</InlineCode>{" "}{step.desc}</> : step.desc}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 限制 */}
      <section>
        <h2 className="font-semibold text-xl text-foreground">限制与注意事项</h2>
        <dl className="mt-4 space-y-3">
          {[
            ["请求超时", "最大 300 秒"],
            ["页面大小", "HTML 建议控制在 5MB 以内"],
            ["标签数量", "每页最多 12 个，超出自动截断"],
            ["传输协议", "仅支持 Streamable HTTP，不支持旧版 SSE"],
            ["并发限制", "与 REST API 共享频率限制策略"],
            ["可见性", "private 页面仅作者可见，不会暴露给未认证请求"],
          ].map(([label, value]) => (
            <div key={label} className="flex flex-col sm:flex-row sm:gap-4">
              <dt className="shrink-0 text-sm font-medium text-foreground sm:w-32">{label}</dt>
              <dd className="min-w-0 text-sm leading-relaxed text-muted-foreground">{value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
