"use client";

import { useState, useCallback } from "react";
import type { Metadata } from "next";
import { Check, Copy, ExternalLink, AlertTriangle, Info, Zap, Search, FileText, Plus, Pen, Key, Terminal, BookOpen } from "lucide-react";

const MCP_ENDPOINT = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/mcp/v1`;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// ── Copy Button ──────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <button
      onClick={copy}
      className="absolute right-2 top-2 rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
      aria-label="复制代码"
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}

// ── Code Block ───────────────────────────────────────────
function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  return (
    <div className="group relative my-4 overflow-hidden rounded-xl border border-border bg-zinc-950">
      {lang && (
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-1.5">
          <span className="font-mono text-xs text-zinc-500">{lang}</span>
        </div>
      )}
      <CopyButton text={code} />
      <pre className="overflow-x-auto p-4">
        <code className="font-mono text-sm leading-relaxed text-zinc-100">{code}</code>
      </pre>
    </div>
  );
}

// ── Inline Code ──────────────────────────────────────────
function InlineCode({ children }: { children: string }) {
  return (
    <code className="rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
      {children}
    </code>
  );
}

// ── Section Icon ─────────────────────────────────────────
function SectionHeading({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <h2 className="mb-4 flex items-center gap-2.5 font-semibold text-2xl">
      <Icon size={22} className="text-primary/70" />
      {children}
    </h2>
  );
}

// ── Badge ────────────────────────────────────────────────
function Badge({ label, variant }: { label: string; variant: "auth" | "public" }) {
  const colors = variant === "auth"
    ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800"
    : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800";
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-xs font-medium ${colors}`}>
      {label}
    </span>
  );
}

// ── Callout ──────────────────────────────────────────────
function Callout({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="my-4 flex gap-3 rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-800 dark:bg-amber-950/20">
      <Icon size={16} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
      <div className="text-sm text-amber-800 dark:text-amber-300">{children}</div>
    </div>
  );
}

// ── Info Callout ─────────────────────────────────────────
function InfoCallout({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-4 flex gap-3 rounded-xl border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-800 dark:bg-blue-950/20">
      <Info size={16} className="mt-0.5 shrink-0 text-blue-600 dark:text-blue-400" />
      <div className="text-sm text-blue-800 dark:text-blue-300">{children}</div>
    </div>
  );
}

// ── Parameter Table ──────────────────────────────────────
interface Param {
  name: string;
  type: string;
  required: string;
  desc: string;
}

function ParamTable({ params }: { params: Param[] }) {
  return (
    <div className="my-3 overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-semibold">参数</th>
            <th className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-semibold">类型</th>
            <th className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-semibold">必填</th>
            <th className="px-4 py-2.5 text-left text-xs font-semibold">说明</th>
          </tr>
        </thead>
        <tbody>
          {params.map((p) => (
            <tr key={p.name} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
              <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs font-medium">{p.name}</td>
              <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-muted-foreground">{p.type}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-xs">
                {p.required === "是" ? (
                  <span className="font-semibold text-amber-600 dark:text-amber-400">必需</span>
                ) : (
                  <span className="text-muted-foreground">可选</span>
                )}
              </td>
              <td className="px-4 py-2.5 text-xs text-muted-foreground leading-relaxed">{p.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Tool Card ────────────────────────────────────────────
function ToolCard({
  name,
  description,
  badge,
  children,
  examples,
}: {
  name: string;
  description: string;
  badge: React.ReactNode;
  children: React.ReactNode;
  examples?: { label: string; call: string; result?: string }[];
}) {
  return (
    <div className="rounded-xl border bg-card">
      {/* Header */}
      <div className="border-b border-border px-6 py-4">
        <div className="mb-2 flex items-center gap-3">
          <code className="rounded-lg bg-zinc-950 px-3 py-1 font-mono text-sm font-semibold text-zinc-50">
            {name}
          </code>
          {badge}
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
      </div>

      {/* Body */}
      <div className="px-6 py-4 space-y-4">
        {children}
      </div>

      {/* Examples */}
      {examples && examples.length > 0 && (
        <div className="border-t border-border px-6 py-4">
          <h5 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Zap size={12} />
            使用示例
          </h5>
          <div className="space-y-4">
            {examples.map((ex, i) => (
              <div key={i} className="rounded-lg border border-border bg-background overflow-hidden">
                <div className="border-b border-border bg-muted/30 px-3 py-1.5">
                  <span className="text-xs font-medium">{ex.label}</span>
                </div>
                <CodeBlock code={ex.call} lang="json" />
                {ex.result && (
                  <>
                    <div className="border-b border-border bg-muted/30 px-3 py-1.5">
                      <span className="text-xs text-muted-foreground">返回</span>
                    </div>
                    <CodeBlock code={ex.result} lang="json" />
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Client Card ──────────────────────────────────────────
function ClientCard({ name, command, config }: { name: string; command?: string; config?: string }) {
  return (
    <div className="rounded-lg border bg-background overflow-hidden">
      <div className="border-b border-border bg-muted/30 px-4 py-2">
        <span className="text-sm font-medium">{name}</span>
      </div>
      {command && <CodeBlock code={command} lang="bash" />}
      {config && <CodeBlock code={config} lang="json" />}
    </div>
  );
}

// ── Workflow Step ────────────────────────────────────────
function WorkflowCard({ title, steps }: { title: string; steps: { tool?: string; desc: string }[] }) {
  return (
    <div className="rounded-xl border bg-card p-6">
      <h3 className="mb-5 flex items-center gap-2 font-medium text-sm">
        <BookOpen size={16} className="text-primary/70" />
        {title}
      </h3>
      <div className="space-y-4">
        {steps.map((step, i) => (
          <div key={i} className="flex items-start gap-4">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              {i + 1}
            </span>
            <div className="pt-0.5">
              {step.tool && <InlineCode>{step.tool}</InlineCode>}
              <span className="ml-1.5 text-sm text-muted-foreground">{step.desc}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Info Row ─────────────────────────────────────────────
function InfoRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <tr className="border-b border-border last:border-0">
      <td className="w-36 px-4 py-3 text-xs font-medium">{label}</td>
      <td className={`px-4 py-3 text-xs text-muted-foreground ${mono ? "font-mono break-all" : ""}`}>{value}</td>
    </tr>
  );
}

// ── Tool Data ────────────────────────────────────────────

interface ToolExample {
  label: string;
  call: string;
  result?: string;
}

interface ToolData {
  name: string;
  description: string;
  badge: "auth" | "public";
  parameters: Param[];
  returns: string;
  notes?: string;
  examples: ToolExample[];
}

const READ_TOOLS: ToolData[] = [
  {
    name: "search_pages",
    description: "搜索 viben 上已发布的公开页面。同时匹配标题、页面标识符（uid）和描述内容。结果按最近发布时间降序排列。适合内容发现、文献检索和浏览公开页面。",
    badge: "public",
    parameters: [
      { name: "query", type: "string", required: "是", desc: "搜索关键词。使用 ILIKE 模糊匹配，支持中英文。同时匹配页面标题、uid 和描述。" },
      { name: "author_slug", type: "string", required: "否", desc: "按作者 slug 过滤。不传则搜索全站公开页面。可通过 get_page 或 search_pages 返回结果获取。" },
      { name: "limit", type: "number", required: "否", desc: "返回数量上限。默认 20，最小 1，最大 50。" },
    ],
    returns: "pages 数组，每项含 uid、title、author_slug、description、tags、published_at。按 lastPublishedAt 降序。",
    notes: "建议先用简短关键词进行初步搜索，再根据返回结果调整查询。如需查找特定作者的页面，结合 author_slug 参数精确过滤。",
    examples: [
      {
        label: "按关键词搜索",
        call: `{
  "name": "search_pages",
  "arguments": {
    "query": "前端性能优化"
  }
}`,
      },
      {
        label: "按作者过滤",
        call: `{
  "name": "search_pages",
  "arguments": {
    "query": "React",
    "author_slug": "LinXueyuanStdio",
    "limit": 10
  }
}`,
        result: `{
  "pages": [
    {
      "uid": "react-patterns",
      "title": "React 设计模式实践",
      "author_slug": "LinXueyuanStdio",
      "description": "常见 React 设计模式总结",
      "tags": ["react", "patterns"],
      "published_at": "2026-06-24T02:37:48.890Z"
    }
  ]
}`,
      },
    ],
  },
  {
    name: "get_page",
    description: "获取指定页面的完整内容，包括 HTML 源码、元数据（标题、描述、标签、封面图）、可见性设置和作者信息。适合深度阅读、内容分析和数据提取。",
    badge: "public",
    parameters: [
      { name: "author_slug", type: "string", required: "是", desc: "页面作者的 slug。从 search_pages 返回结果中获取。" },
      { name: "page_uid", type: "string", required: "是", desc: "页面唯一标识符。从 search_pages 返回的 uid 字段获取。" },
    ],
    returns: "uid、title、html（完整 HTML 源码）、description、tags、visibility（public/unlisted/private）、cover_url、published_at、version、author 对象（display_name、avatar_url、slug）。",
    notes: "author_slug 和 page_uid 组合唯一确定一个页面。html 字段可能较大（最大约 5MB），大页面可能影响响应时间。如果页面不存在或不可访问（如 private 页面且未认证），返回错误。",
    examples: [
      {
        label: "获取公开页面内容",
        call: `{
  "name": "get_page",
  "arguments": {
    "author_slug": "LinXueyuanStdio",
    "page_uid": "react-patterns"
  }
}`,
        result: `{
  "uid": "react-patterns",
  "title": "React 设计模式实践",
  "html": "<h1>React 设计模式</h1>...",
  "description": "常见 React 设计模式总结",
  "tags": ["react", "patterns"],
  "visibility": "public",
  "cover_url": null,
  "published_at": "2026-06-24T02:37:48.890Z",
  "version": 3,
  "author": {
    "display_name": "LinXueyuan",
    "avatar_url": null,
    "slug": "LinXueyuanStdio"
  }
}`,
      },
    ],
  },
];

const WRITE_TOOLS: ToolData[] = [
  {
    name: "create_page",
    description: "在 viben 上发布新页面。如果同一作者下的 uid 已存在，则自动更新为最新内容（upsert 语义）。支持设置可见性、标签和封面图。需要 API Key 认证。发布成功后自动通知订阅者。",
    badge: "auth",
    parameters: [
      { name: "uid", type: "string", required: "是", desc: "页面唯一标识符。建议使用有意义的英文 slug（如 my-notes）。同一作者下必须唯一。1-200 字符。" },
      { name: "title", type: "string", required: "是", desc: "页面标题。1-500 字符，支持中英文。" },
      { name: "html", type: "string", required: "是", desc: "页面 HTML 内容。完整 HTML 文档或片段，建议控制在 5MB 以内。" },
      { name: "description", type: "string", required: "否", desc: "页面描述/摘要。最长 2000 字符，用于搜索匹配和 SEO。" },
      { name: "tags", type: "string[]", required: "否", desc: "标签列表。字符串数组，最多 12 个。超出部分自动截断。" },
      { name: "visibility", type: '"public" | "unlisted" | "private"', required: "否", desc: "可见性。public 公开可见；unlisted 不在列表显示但可通过链接访问；private 仅作者可见。默认 public。" },
      { name: "cover_url", type: "string", required: "否", desc: "封面图片 URL。用于页面卡片展示。不传则无封面。" },
    ],
    returns: "success、page_uid、url（页面访问链接）、read_url（阅读模式链接）。updated 字段标识本次是新建（false）还是更新已有页面（true）。",
    notes: "create_page 使用 upsert 语义：uid 已存在时自动更新，版本号递增。private 或 unlisted 页面仍可通过 search_pages 被作者本人搜索到。",
    examples: [
      {
        label: "发布一个公开页面",
        call: `{
  "name": "create_page",
  "arguments": {
    "uid": "hello-world",
    "title": "Hello, Viben!",
    "html": "<h1>Hello World</h1><p>这是我的第一篇文章。</p>",
    "description": "一篇入门文章",
    "tags": ["intro", "hello"],
    "visibility": "public"
  }
}`,
        result: `{
  "success": true,
  "page_uid": "hello-world",
  "url": "/page/LinXueyuanStdio/hello-world",
  "read_url": "/LinXueyuanStdio/hello-world?tab=read",
  "updated": false
}`,
      },
      {
        label: "创建私有笔记",
        call: `{
  "name": "create_page",
  "arguments": {
    "uid": "private-notes",
    "title": "个人笔记",
    "html": "<h2>待办事项</h2><ul><li>完成项目文档</li></ul>",
    "visibility": "private"
  }
}`,
      },
    ],
  },
  {
    name: "update_page",
    description: "更新已有页面的内容或元数据。仅更新指定的字段，未指定的字段保持原值。需要 API Key 认证，且仅页面作者可操作。比 create_page 更轻量——如果只需要修改标题或标签，不需要重新发送完整的 HTML。",
    badge: "auth",
    parameters: [
      { name: "uid", type: "string", required: "是", desc: "要更新的页面唯一标识符。页面必须已存在且属于当前用户。" },
      { name: "title", type: "string", required: "否", desc: "新标题。1-500 字符。不传则保持原标题。" },
      { name: "html", type: "string", required: "否", desc: "新 HTML 内容。不传则保持原内容。" },
      { name: "description", type: "string", required: "否", desc: "新描述。最长 2000 字符。不传则保持原描述。" },
      { name: "tags", type: "string[]", required: "否", desc: "新标签列表。不传则保持原标签。最多 12 个。" },
      { name: "visibility", type: '"public" | "unlisted" | "private"', required: "否", desc: "新可见性。不传则保持原设置。" },
      { name: "cover_url", type: "string", required: "否", desc: "新封面 URL。不传则保持原封面。传空字符串可清除封面。" },
    ],
    returns: "success、page_uid、url、read_url。updated 始终为 true。如果页面不存在或不属于当前用户，返回错误。",
    notes: "与 create_page 不同，update_page 要求页面已存在且属于当前用户，不存在时返回错误而非自动创建。每次更新都会递增版本号并通知订阅者。",
    examples: [
      {
        label: "更新页面标题和标签",
        call: `{
  "name": "update_page",
  "arguments": {
    "uid": "hello-world",
    "title": "Hello, Viben! (2026 版)",
    "tags": ["intro", "hello", "2026"]
  }
}`,
        result: `{
  "success": true,
  "page_uid": "hello-world",
  "url": "/page/LinXueyuanStdio/hello-world",
  "read_url": "/LinXueyuanStdio/hello-world?tab=read",
  "updated": true
}`,
      },
      {
        label: "仅修改可见性（改为未上架）",
        call: `{
  "name": "update_page",
  "arguments": {
    "uid": "draft-post",
    "visibility": "unlisted"
  }
}`,
      },
    ],
  },
];

// ── Clients ──────────────────────────────────────────────
const CLIENTS = [
  {
    name: "Claude Code",
    command: `claude mcp add viben ${MCP_ENDPOINT}`,
  },
  {
    name: "Claude Desktop",
    config: JSON.stringify({
      mcpServers: {
        viben: {
          type: "streamableHttp",
          url: MCP_ENDPOINT,
          headers: { Authorization: "Bearer bmcp_YOUR_API_KEY" },
        },
      },
    }, null, 2),
  },
  {
    name: "VS Code / Cursor",
    config: JSON.stringify({
      servers: {
        viben: {
          type: "streamableHttp",
          url: MCP_ENDPOINT,
          headers: { Authorization: "Bearer bmcp_YOUR_API_KEY" },
        },
      },
    }, null, 2),
  },
];

// ── Workflows ────────────────────────────────────────────
const WORKFLOWS = [
  {
    title: "内容发现 → 深度阅读",
    steps: [
      { tool: "search_pages", desc: "用关键词搜索感兴趣的页面，获得 uid 和 author_slug" },
      { tool: "get_page", desc: "对感兴趣的页面调用 get_page，获取完整 HTML 内容进行分析或摘要" },
      { desc: "基于获取的内容进行翻译、改写或其他二次处理" },
    ],
  },
  {
    title: "AI 生成 → 发布",
    steps: [
      { desc: "使用 AI 生成页面内容（标题、HTML、描述、标签）" },
      { tool: "create_page", desc: "调用 create_page 发布新页面，设置合适的 uid 和 visibility" },
      { desc: "返回的 url 可直接分享给读者" },
    ],
  },
  {
    title: "批量更新元数据",
    steps: [
      { tool: "search_pages", desc: "搜索需要更新的页面列表，获取 uid 列表" },
      { tool: "update_page", desc: "对每个页面调用 update_page，仅传入需要修改的字段（如 tags 或 description）" },
      { desc: "不需要重新发送 html 内容，高效完成批量元数据更新" },
    ],
  },
];

// ── Page ─────────────────────────────────────────────────
export default function McpDocsPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      {/* Hero */}
      <div className="mb-14">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Terminal size={20} className="text-primary" />
          </div>
          <h1 className="font-bold text-3xl tracking-tight">Viben MCP 服务</h1>
        </div>
        <p className="max-w-2xl text-base text-muted-foreground leading-relaxed">
          Viben MCP 服务基于 Model Context Protocol (MCP) v1.0.0，为 AI 应用、智能体和自动化工作流
          提供对 Viben 页面系统的程序化访问。AI 助手可以直接搜索、读取、创建和更新页面，
          无需离开对话上下文。
        </p>
      </div>

      {/* 连接信息 */}
      <section className="mb-14">
        <SectionHeading icon={Terminal}>连接信息</SectionHeading>
        <div className="overflow-hidden rounded-xl border bg-card">
          <table className="w-full">
            <tbody>
              <InfoRow label="端点" value={<code className="font-mono text-xs break-all">{MCP_ENDPOINT}</code>} />
              <InfoRow label="传输方式" value="Streamable HTTP — POST 发送请求，GET 用于服务端→客户端 SSE 流，DELETE 终止会话" />
              <InfoRow label="认证" value="Bearer Token（API Key，bmcp_ 前缀）" />
              <InfoRow label="协议版本" value="Model Context Protocol (MCP) v1.0.0" />
            </tbody>
          </table>
        </div>
      </section>

      {/* 支持的客户端 */}
      <section className="mb-14">
        <SectionHeading icon={Zap}>支持的客户端</SectionHeading>
        <div className="space-y-4">
          {CLIENTS.map((c) => (
            <ClientCard key={c.name} {...c} />
          ))}
        </div>
        <Callout icon={AlertTriangle}>
          <strong>浏览器限制：</strong>浏览器中运行的 MCP 集成（如直接在 claude.ai 或 chatgpt.com 添加）
          因 CORS 策略无法直接连接。请在本地运行桥接工具：
          <InlineCode>{`npx mcp-remote ${MCP_ENDPOINT}`}</InlineCode>
          ，然后将助手指向桥接地址。
        </Callout>
      </section>

      {/* 认证 */}
      <section className="mb-14">
        <SectionHeading icon={Key}>认证</SectionHeading>
        <div className="rounded-xl border bg-card p-6 space-y-5">
          <p className="text-sm text-muted-foreground leading-relaxed">
            读取操作（搜索、获取页面）为<strong>可选认证</strong>——不传 Token 时只能访问公开页面；
            传入 Token 后可额外访问本人的 private 和 unlisted 页面。
            写入操作（创建、更新页面）<strong>需要强制认证</strong>。
          </p>

          <div>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Key size={14} className="text-primary/70" />
              API Key 认证（推荐）
            </h3>
            <p className="mb-3 text-sm text-muted-foreground">
              在{" "}
              <a href={`${APP_URL}/settings/api_keys`} className="inline-flex items-center gap-1 text-primary underline hover:no-underline">
                API 密钥管理 <ExternalLink size={12} />
              </a>{" "}
              页面创建 API Key（bmcp_ 前缀），然后在每个请求的 HTTP Header 中传递：
            </p>
            <CodeBlock code="Authorization: Bearer bmcp_XXXXXXXX_YYYYYYYYYYYY" lang="http" />
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold">Session Token</h3>
            <p className="text-sm text-muted-foreground">
              浏览器登录 Viben 后，Session Cookie 中的 JWE Token 也可作为 Bearer Token 使用。
              此方式主要用于桌面客户端和浏览器扩展集成。
            </p>
          </div>
        </div>
      </section>

      {/* 工具参考 */}
      <section className="mb-14">
        <SectionHeading icon={Search}>工具参考</SectionHeading>
        <p className="mb-8 text-sm text-muted-foreground leading-relaxed">
          Viben MCP 服务提供 <strong>4 个工具</strong>，分为两组：
          读取工具用于搜索和获取页面内容，写入工具用于创建和更新页面。
        </p>

        {/* 读取工具 */}
        <h3 className="mb-4 flex items-center gap-2 font-medium text-lg">
          <FileText size={18} className="text-primary/70" />
          读取工具
        </h3>
        <p className="mb-6 text-sm text-muted-foreground">
          用于搜索和获取页面内容。无需认证即可访问公开页面。
        </p>
        <div className="mb-10 space-y-8">
          {READ_TOOLS.map((tool) => (
            <ToolCard
              key={tool.name}
              name={tool.name}
              description={tool.description}
              badge={<Badge label="公开" variant="public" />}
              examples={tool.examples}
            >
              <ParamTable params={tool.parameters} />
              <InfoCallout>
                <strong>返回值：</strong>{tool.returns}
              </InfoCallout>
              {tool.notes && (
                <InfoCallout>
                  {tool.notes}
                </InfoCallout>
              )}
            </ToolCard>
          ))}
        </div>

        {/* 写入工具 */}
        <h3 className="mb-4 flex items-center gap-2 font-medium text-lg">
          <Plus size={18} className="text-primary/70" />
          写入工具
        </h3>
        <p className="mb-6 text-sm text-muted-foreground">
          用于创建和更新页面。需要 API Key 认证，仅操作者本人的页面。
        </p>
        <div className="space-y-8">
          {WRITE_TOOLS.map((tool) => (
            <ToolCard
              key={tool.name}
              name={tool.name}
              description={tool.description}
              badge={<Badge label="需认证" variant="auth" />}
              examples={tool.examples}
            >
              <ParamTable params={tool.parameters} />
              <InfoCallout>
                <strong>返回值：</strong>{tool.returns}
              </InfoCallout>
              {tool.notes && (
                <InfoCallout>
                  {tool.notes}
                </InfoCallout>
              )}
            </ToolCard>
          ))}
        </div>
      </section>

      {/* 常见工作流 */}
      <section className="mb-14">
        <SectionHeading icon={BookOpen}>常见工作流</SectionHeading>
        <div className="space-y-4">
          {WORKFLOWS.map((wf) => (
            <WorkflowCard key={wf.title} title={wf.title} steps={wf.steps} />
          ))}
        </div>
      </section>

      {/* 限制与注意事项 */}
      <section>
        <SectionHeading icon={AlertTriangle}>限制与注意事项</SectionHeading>
        <div className="overflow-hidden rounded-xl border bg-card">
          <table className="w-full">
            <tbody>
              <InfoRow label="请求超时" value="最大 300 秒（服务端函数执行上限）" />
              <InfoRow label="页面大小" value="HTML 内容建议控制在 5MB 以内。超大页面可能导致请求超时或内存不足" />
              <InfoRow label="标签数量" value="每页最多 12 个标签，超出部分自动截断" />
              <InfoRow label="传输协议" value="仅支持 Streamable HTTP。不支持旧版 SSE transport" />
              <InfoRow label="并发限制" value="与 Viben REST API 共享频率限制策略。高频写入可能触发限流" />
              <InfoRow label="可见性" value="private 页面仅作者本人可见，MCP 服务不会暴露私有内容给未认证请求" />
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
