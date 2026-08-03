"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Check, Copy, ExternalLink, AlertTriangle, Info, FileText, Plus, Key, Terminal, BookOpen, List, ArrowRightLeft, Globe, Clock, Tags, Shield, Wifi, Server, TableProperties, Languages } from "lucide-react";

const MCP_ENDPOINT = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/mcp/v1`;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// ═══════════════════════════════════════════════════════════
// i18n
// ═══════════════════════════════════════════════════════════
type Lang = "zh" | "en";

const t = {
  zh: {
    title: "Viben MCP 服务",
    subtitle: "Viben MCP 服务基于 Model Context Protocol (MCP) v1.0.0，为 AI 应用、智能体和自动化工作流提供对 Viben 页面系统的程序化访问。AI 助手可以直接搜索、读取、创建和更新页面，无需离开对话上下文。",
    connection: "连接信息",
    endpoint: "端点",
    transport: "传输方式",
    transportVal: "Streamable HTTP",
    auth: "认证",
    authVal: "Bearer Token 认证（API Key，bmcp_ 前缀）。可通过 API 密钥管理页面创建。",
    protocol: "协议版本",
    protocolVal: "Model Context Protocol (MCP) v1.0.0",
    clients: "支持的客户端",
    clientsVal: "原生 MCP 客户端 — Claude Code、Codex、Claude Desktop、VS Code、Cursor，以及 mcp-remote 等 CLI 桥接工具。",
    corsWarning: "浏览器中运行的 MCP 集成（如直接在 claude.ai 或 chatgpt.com 添加）因 CORS 策略无法直接连接。请通过本地桥接使用，然后将助手指向桥接地址。",
    quickStart: "快速开始",
    tools: "工具参考",
    toolsDesc: "Viben MCP 服务提供 4 个工具，分为读取工具和写入工具。将它们组合使用即可构建完整的内容管理工作流。",
    readTools: "读取工具",
    readToolsDesc: "搜索和获取页面内容。无需认证即可访问公开页面；传入 API Key 后可额外访问本人的私有页面。",
    writeTools: "写入工具",
    writeToolsDesc: "创建和更新页面内容。需要 API Key 认证，操作者只能管理自己的页面。",
    authRequired: "需要认证",
    workflows: "常见工作流",
    limits: "限制与注意事项",
    parameters: "参数",
    type: "类型",
    required: "必填",
    desc: "说明",
    required_label: "required",
    optional: "optional",
    returns: "Returns",
    examples: "示例",
    apiKeyInfo: "API Key 可在 API 密钥管理页面创建。写入操作需要认证，搜索和读取操作可选。",
    apiKeyManage: "API 密钥管理",
    copy: "复制",
    copied: "已复制",
    codexNote: "Codex 目前推荐通过 API Key 认证。",
    cursorNote: "添加到 ~/.cursor/mcp.json（或项目中的 .cursor/mcp.json）。不传 headers 则无需认证即可使用公开工具。",
    vscodeNote: "添加到 VS Code 的 MCP 配置文件中。",
    desktopNote: "在 claude_desktop_config.json 中添加 streamableHttp 类型的服务器配置。",
    searchPages: "搜索 viben 上已发布的公开页面。同时匹配标题、页面标识符（uid）和描述内容。结果按最近发布时间降序排列。适合内容发现和检索。",
    searchPagesReturns: "pages 数组，每项含 uid、title、author_slug、description、tags、published_at。按 lastPublishedAt 降序。",
    searchPagesNote: "建议先用简短关键词初步搜索。结合 author_slug 可精确查找特定作者页面。",
    searchPagesEx1: "按关键词搜索",
    searchPagesEx2: "按作者过滤并限制数量",
    getPage: "获取指定页面的完整内容，包括 HTML 源码、元数据（标题、描述、标签、封面图）、可见性设置和作者信息。适合深度阅读和内容分析。",
    getPageReturns: "uid、title、html、description、tags、visibility、cover_url、published_at、version，以及 author 对象（display_name、avatar_url、slug）。",
    getPageNote: "author_slug + page_uid 唯一确定页面。html 最大约 5MB。页面不存在或不可访问时返回错误。",
    getPageEx1: "获取公开页面",
    createPage: "在 viben 上发布新页面。uid 在同一作者下已存在时自动更新为最新内容（upsert 语义）。发布成功后自动通知订阅者。需要 API Key 认证。",
    createPageReturns: "success、page_uid、url、read_url。updated 标识新建（false）或更新已有页面（true）。",
    createPageNote: "upsert 语义：uid 已存在时自动更新，版本号递增。private 或 unlisted 页面可被作者本人搜索到。",
    createPageEx1: "发布公开页面",
    createPageEx2: "创建私有笔记",
    updatePage: "更新已有页面的内容或元数据。仅更新指定字段，未指定字段保持原值。比 create_page 更轻量。需要 API Key 认证，仅页面作者可操作。",
    updatePageReturns: "success、page_uid、url、read_url。updated 始终为 true。页面不存在或不属于当前用户时返回错误。",
    updatePageNote: "与 create_page 不同，update_page 要求页面已存在，不存在时返回错误。每次更新递增版本号并通知订阅者。",
    updatePageEx1: "更新标题和标签",
    updatePageEx2: "仅修改可见性",
    wf1Title: "内容发现 → 深度阅读",
    wf1s1: "用关键词搜索页面，获得 uid 和 author_slug",
    wf1s2: "获取完整 HTML 内容进行分析或摘要",
    wf1s3: "基于获取的内容进行翻译、改写等二次处理",
    wf2Title: "AI 生成 → 发布",
    wf2s1: "使用 AI 生成页面内容（标题、HTML、描述、标签）",
    wf2s2: "发布新页面，设置合适的 uid 和 visibility",
    wf2s3: "返回的 url 可直接分享给读者",
    wf3Title: "批量更新元数据",
    wf3s1: "搜索需要更新的页面列表",
    wf3s2: "对每个页面仅传入需要修改的字段",
    wf3s3: "无需重新发送 html，高效完成批量更新",
    limitTimeout: "请求超时",
    limitTimeoutV: "最大 300 秒",
    limitSize: "页面大小",
    limitSizeV: "HTML 建议控制在 5MB 以内",
    limitTags: "标签数量",
    limitTagsV: "每页最多 12 个，超出自动截断",
    limitProtocol: "传输协议",
    limitProtocolV: "仅支持 Streamable HTTP，不支持旧版 SSE",
    limitRate: "并发限制",
    limitRateV: "与 REST API 共享频率限制策略",
    limitVisibility: "可见性",
    limitVisibilityV: "private 页面仅作者可见，不会暴露给未认证请求",
  },
  en: {
    title: "Viben MCP Service",
    subtitle: "The Viben MCP service, based on Model Context Protocol (MCP) v1.0.0, provides AI applications, agents, and workflows with programmatic access to Viben's page system. AI assistants can search, read, create, and update pages directly without leaving the conversation context.",
    connection: "Connection",
    endpoint: "Endpoint",
    transport: "Transport",
    transportVal: "Streamable HTTP",
    auth: "Authentication",
    authVal: "Bearer Token (API Key, bmcp_ prefix). Create one via the API Keys management page.",
    protocol: "Protocol",
    protocolVal: "Model Context Protocol (MCP) v1.0.0",
    clients: "Supported Clients",
    clientsVal: "Native MCP clients — Claude Code, Codex, Claude Desktop, VS Code, Cursor, and CLI bridges like mcp-remote.",
    corsWarning: "Browser-hosted MCP integrations (e.g. adding directly inside claude.ai or chatgpt.com) are not supported due to CORS restrictions. Use a local bridge and point the assistant to it.",
    quickStart: "Quick Start",
    tools: "Tools",
    toolsDesc: "Viben MCP provides 4 tools across two groups. Combine them to build complete content management workflows.",
    readTools: "Read Tools",
    readToolsDesc: "Search and retrieve page content. No auth required for public pages; pass an API Key to also access your private pages.",
    writeTools: "Write Tools",
    writeToolsDesc: "Create and update pages. Requires API Key authentication. You can only manage your own pages.",
    authRequired: "Auth Required",
    workflows: "Common Workflows",
    limits: "Limitations",
    parameters: "Parameters",
    type: "Type",
    required: "Required",
    desc: "Description",
    required_label: "required",
    optional: "optional",
    returns: "Returns",
    examples: "Examples",
    apiKeyInfo: "API Keys can be created on the API Keys page. Write operations require auth; search and read are optional.",
    apiKeyManage: "API Keys",
    copy: "Copy",
    copied: "Copied",
    codexNote: "Codex currently recommends API Key authentication.",
    cursorNote: "Add to ~/.cursor/mcp.json (or .cursor/mcp.json per project). Omit headers for public access without auth.",
    vscodeNote: "Add to your VS Code MCP configuration file.",
    desktopNote: "Add a streamableHttp server config in claude_desktop_config.json.",
    searchPages: "Search published pages on Viben. Matches against title, page identifier (uid), and description. Results are ordered by most recently published. Ideal for content discovery and retrieval.",
    searchPagesReturns: "pages array, each containing uid, title, author_slug, description, tags, published_at. Ordered by lastPublishedAt descending.",
    searchPagesNote: "Start with short keywords for initial search, then refine. Combine with author_slug to find pages by specific authors.",
    searchPagesEx1: "Search by keyword",
    searchPagesEx2: "Filter by author with limit",
    getPage: "Retrieve the full content of a page, including HTML source, metadata (title, description, tags, cover image), visibility settings, and author info. Ideal for deep reading and content analysis.",
    getPageReturns: "uid, title, html, description, tags, visibility, cover_url, published_at, version, and author object (display_name, avatar_url, slug).",
    getPageNote: "author_slug + page_uid uniquely identifies a page. HTML can be up to ~5MB. Returns an error if the page doesn't exist or is inaccessible.",
    getPageEx1: "Get a public page",
    createPage: "Publish a new page on Viben. If the uid already exists for the same author, it auto-updates (upsert semantics). Subscribers are notified on publish. Requires API Key auth.",
    createPageReturns: "success, page_uid, url, read_url. updated indicates creation (false) or update of existing page (true).",
    createPageNote: "Upsert semantics: auto-updates on existing uid, version increments. Private or unlisted pages remain searchable by the author.",
    createPageEx1: "Publish a public page",
    createPageEx2: "Create a private note",
    updatePage: "Update an existing page's content or metadata. Only specified fields are updated; unspecified fields keep their values. Lighter than create_page. Requires API Key auth; author only.",
    updatePageReturns: "success, page_uid, url, read_url. updated is always true. Returns error if page doesn't exist or doesn't belong to you.",
    updatePageNote: "Unlike create_page, update_page requires the page to exist. Returns error (not auto-create) if not found. Version increments and subscribers are notified on each update.",
    updatePageEx1: "Update title and tags",
    updatePageEx2: "Change visibility only",
    wf1Title: "Discover → Deep Read",
    wf1s1: "Search pages by keyword to get uid and author_slug",
    wf1s2: "Retrieve full HTML content for analysis or summarization",
    wf1s3: "Perform translation, rewriting, or other processing on the content",
    wf2Title: "AI Generate → Publish",
    wf2s1: "Use AI to generate page content (title, HTML, description, tags)",
    wf2s2: "Publish the new page with appropriate uid and visibility",
    wf2s3: "Share the returned url directly with readers",
    wf3Title: "Batch Metadata Update",
    wf3s1: "Search for pages to update",
    wf3s2: "Call update_page for each page with only the fields to change",
    wf3s3: "No need to resend HTML — efficient batch metadata updates",
    limitTimeout: "Timeout",
    limitTimeoutV: "Max 300 seconds",
    limitSize: "Page Size",
    limitSizeV: "HTML should stay under 5MB",
    limitTags: "Tags",
    limitTagsV: "Max 12 per page, excess truncated",
    limitProtocol: "Protocol",
    limitProtocolV: "Streamable HTTP only. Legacy SSE not supported",
    limitRate: "Rate Limit",
    limitRateV: "Shared rate limit with REST API",
    limitVisibility: "Visibility",
    limitVisibilityV: "Private pages are author-only and never exposed to unauthenticated requests",
  },
};

// ═══════════════════════════════════════════════════════════
// Syntax highlighting
// ═══════════════════════════════════════════════════════════
function highlightJson(code: string) {
  const regex = /("(?:\\.|[^"\\])*")\s*:|("(?:\\.|[^"\\])*")|(-?\b\d+\.?\d*\b(?:[eE][+-]?\d+)?)(?=\s*[,}\]\n\r])|(\b(?:true|false|null)\b)/g;
  const parts: React.ReactNode[] = [];
  let last = 0, m: RegExpExecArray | null;
  while ((m = regex.exec(code)) !== null) {
    if (m.index > last) parts.push(<span key={last} className="text-foreground">{code.slice(last, m.index)}</span>);
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

function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const l = useCurrentLang();
  return (
    <div className="group relative overflow-hidden rounded-lg border bg-muted/30">
      <div className="flex items-center justify-between border-b px-3 py-1.5">
        <span className="font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground select-none">{lang || "text"}</span>
        <button
          onClick={async () => { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {copied ? <Check size={11} /> : <Copy size={11} />}
          {copied ? t[l].copied : t[l].copy}
        </button>
      </div>
      <pre className="overflow-x-auto p-4">
        <code className="font-mono text-[13px] leading-relaxed">{highlightCode(code, lang)}</code>
      </pre>
    </div>
  );
}

function InlineCode({ children }: { children: string }) {
  return <code className="relative rounded-sm bg-surface px-[0.3rem] py-[0.2rem] font-mono text-[13px] text-text">{children}</code>;
}

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

function useCurrentLang(): Lang {
  const { i18n } = useTranslation();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return "zh";
  return (i18n.language?.startsWith("en") ? "en" : "zh") as Lang;
}

function TableIcon({ Icon }: { Icon: React.ElementType }) {
  return <Icon size={13} className="mr-2 inline text-muted-foreground" />;
}

// Fix Icon typing — use React.ComponentType
type IconComponent = React.ComponentType<{ size?: number; className?: string }>;

// ═══════════════════════════════════════════════════════════
// Parameter Table
// ═══════════════════════════════════════════════════════════
interface Param { name: string; type: string; required: string; descKey: string; }

function ParamTable({ params }: { params: Param[] }) {
  const l = useCurrentLang();
  return (
    <div>
      <h4 className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"><TableProperties size={12} />{t[l].parameters}</h4>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-3 py-2 text-left text-xs font-semibold">{t[l].parameters}</th>
              <th className="px-3 py-2 text-left text-xs font-semibold">{t[l].type}</th>
              <th className="px-3 py-2 text-left text-xs font-semibold">{t[l].required}</th>
              <th className="px-3 py-2 text-left text-xs font-semibold">{t[l].desc}</th>
            </tr>
          </thead>
          <tbody>
            {params.map((p) => (
              <tr key={p.name} className="border-b border-border last:border-0">
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs font-medium text-foreground">{p.name}</td>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-muted-foreground">{p.type}</td>
                <td className="whitespace-nowrap px-3 py-2 text-xs">
                  {p.required === "是"
                    ? <span className="inline-flex items-center rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-600 dark:text-red-400">{t[l].required_label}</span>
                    : <span className="text-muted-foreground">{t[l].optional}</span>}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground leading-relaxed">{(tParams as any)[p.descKey]?.[l]}</td>
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
  name, badge, descKey, params, returnsKey, notesKey, examples,
}: {
  name: string; badge?: boolean; descKey: string;
  params: Param[]; returnsKey: string; notesKey?: string;
  examples: { labelKey: string; params: Record<string, unknown> }[];
}) {
  const l = useCurrentLang();
  return (
    <div className="space-y-5">
      <h3 className="flex items-center gap-3 font-mono text-base font-semibold break-all text-foreground">
        {name}
        {badge && (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-700 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-400">
            <Key size={10} />{t[l].authRequired}
          </span>
        )}
      </h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{(t[l] as any)[descKey]}</p>
      <ParamTable params={params} />
      <div>
        <h4 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"><ArrowRightLeft size={12} />{t[l].returns}</h4>
        <p className="text-sm leading-relaxed text-muted-foreground">{(t[l] as any)[returnsKey]}</p>
      </div>
      {notesKey && (
        <div className="flex gap-2.5 rounded-lg border border-blue-200 bg-blue-50/50 p-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950/20 dark:text-blue-300">
          <Info size={15} className="mt-0.5 shrink-0 text-blue-600 dark:text-blue-400" />
          <div>{(t[l] as any)[notesKey]}</div>
        </div>
      )}
      <details className="group rounded-lg border border-border">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-xs font-medium text-muted-foreground select-none hover:bg-muted/30 transition-colors">
          <span className="transition-transform group-open:rotate-90">▸</span><List size={13} />{t[l].examples} ({examples.length})
        </summary>
        <div className="border-t border-border px-4 py-4 space-y-4">
          {examples.map((ex, i) => (
            <div key={i}>
              <p className="mb-2 text-sm font-medium text-foreground">{(t[l] as any)[ex.labelKey]}</p>
              <CodeBlock code={JSON.stringify(ex.params, null, 2)} lang="json" />
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Client Tabs
// ═══════════════════════════════════════════════════════════
function ClientTabs() {
  const [active, setActive] = useState(0);
  const l = useCurrentLang();
  const tabs = [
    {
      name: "Claude Code",
      content: <CodeBlock code={`# ${l === "en" ? "Use API Key auth (recommended)" : "使用 API Key 认证（推荐）"}\nclaude mcp add --transport http viben ${MCP_ENDPOINT} --header "Authorization: Bearer <key>"`} lang="bash" />,
    },
    {
      name: "Codex",
      content: (
        <div className="space-y-4 text-sm">
          <p className="text-muted-foreground leading-relaxed">{t[l].codexNote}</p>
          <CodeBlock code={`# ${l === "en" ? "Use API Key auth" : "使用 API Key 认证"}\nexport VIBEN_API_KEY="<key>"\ncodex mcp add viben --url ${MCP_ENDPOINT} --bearer-token-env-var VIBEN_API_KEY`} lang="bash" />
        </div>
      ),
    },
    {
      name: "Cursor",
      content: (
        <div className="space-y-4 text-sm">
          <p className="text-muted-foreground leading-relaxed">{t[l].cursorNote}</p>
          <CodeBlock code={JSON.stringify({ mcpServers: { viben: { url: MCP_ENDPOINT, headers: { Authorization: "Bearer <key>" } } } }, null, 2)} lang="json" />
        </div>
      ),
    },
    {
      name: "VS Code",
      content: (
        <div className="space-y-4 text-sm">
          <p className="text-muted-foreground leading-relaxed">{t[l].vscodeNote}</p>
          <CodeBlock code={JSON.stringify({ servers: { viben: { type: "streamableHttp", url: MCP_ENDPOINT, headers: { Authorization: "Bearer <key>" } } } }, null, 2)} lang="json" />
        </div>
      ),
    },
    {
      name: "Claude Desktop",
      content: (
        <div className="space-y-4 text-sm">
          <p className="text-muted-foreground leading-relaxed">{t[l].desktopNote}</p>
          <CodeBlock code={JSON.stringify({ mcpServers: { viben: { type: "streamableHttp", url: MCP_ENDPOINT, headers: { Authorization: "Bearer <key>" } } } }, null, 2)} lang="json" />
        </div>
      ),
    },
  ];
  return (
    <div>
      <div className="flex gap-1 border-b border-border">
        {tabs.map((tab, i) => (
          <button key={tab.name} onClick={() => setActive(i)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-[1px] ${i === active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {tab.name}
          </button>
        ))}
      </div>
      <div className="pt-4">{tabs[active].content}</div>
    </div>
  );
}

const tParams: Record<string, { zh: string; en: string }> = {};

function p(name: string, zh: string, en: string, required: string, type: string): Param {
  (tParams as any)[name] = { zh, en };
  return { name, type, required, descKey: name };
}

const READ_TOOLS = [
  {
    name: "search_pages",
    descKey: "searchPages",
    returnsKey: "searchPagesReturns",
    notesKey: "searchPagesNote",
    params: [
      p("query", "搜索关键词。ILIKE 模糊匹配，支持中英文。同时匹配标题、uid 和描述。最小 1 字符。", "Search keyword. ILIKE fuzzy matching. Matches title, uid, and description. Min 1 char.", "是", "string"),
      p("author_slug", "按作者 slug 过滤。不传则搜索全站公开页面。", "Filter by author slug. Omit to search all public pages.", "否", "string"),
      p("limit", "返回数量上限。默认 20，最小 1，最大 50。", "Max results. Default 20, min 1, max 50.", "否", "number"),
    ],
    examples: [
      { labelKey: "searchPagesEx1", params: { query: "前端性能优化" } },
      { labelKey: "searchPagesEx2", params: { query: "React", author_slug: "LinXueyuanStdio", limit: 10 } },
    ],
  },
  {
    name: "get_page",
    descKey: "getPage",
    returnsKey: "getPageReturns",
    notesKey: "getPageNote",
    params: [
      p("author_slug", "页面作者的 slug。从 search_pages 返回结果获取。", "Author slug. Obtain from search_pages results.", "是", "string"),
      p("page_uid", "页面唯一标识符。从 search_pages 返回的 uid 字段获取。", "Page unique identifier from search_pages uid field.", "是", "string"),
    ],
    examples: [
      { labelKey: "getPageEx1", params: { author_slug: "LinXueyuanStdio", page_uid: "react-patterns" } },
    ],
  },
];

const WRITE_TOOLS = [
  {
    name: "create_page",
    badge: true,
    descKey: "createPage",
    returnsKey: "createPageReturns",
    notesKey: "createPageNote",
    params: [
      p("uid", "页面唯一标识符。建议使用有意义的英文 slug。同一作者下必须唯一。1-200 字符。", "Page UID. Use meaningful slug. Must be unique per author. 1-200 chars.", "是", "string"),
      p("title", "页面标题。1-500 字符，支持中英文。", "Page title. 1-500 chars.", "是", "string"),
      p("html", "页面 HTML 内容。建议控制在 5MB 以内。", "Page HTML content. Keep under 5MB.", "是", "string"),
      p("description", "页面描述/摘要。最长 2000 字符，用于搜索匹配和 SEO。", "Page description. Max 2000 chars. Used for search and SEO.", "否", "string"),
      p("tags", "标签列表。最多 12 个，超出自动截断。", "Tag list. Max 12, excess truncated.", "否", "string[]"),
      p("visibility", "可见性。public 公开；unlisted 不在列表显示但可链接访问；private 仅作者可见。默认 public。", "Visibility: public, unlisted (link-only), private (author-only). Default public.", "否", '"public"|"unlisted"|"private"'),
      p("cover_url", "封面图片 URL。", "Cover image URL.", "否", "string"),
    ],
    examples: [
      { labelKey: "createPageEx1", params: { uid: "hello-world", title: "Hello, Viben!", html: "<h1>Hello World</h1><p>My first article</p>", description: "An intro article", tags: ["intro"], visibility: "public" } },
      { labelKey: "createPageEx2", params: { uid: "private-notes", title: "个人笔记", html: "<h2>待办</h2><ul><li>完成文档</li></ul>", visibility: "private" } },
    ],
  },
  {
    name: "update_page",
    badge: true,
    descKey: "updatePage",
    returnsKey: "updatePageReturns",
    notesKey: "updatePageNote",
    params: [
      p("uid", "页面唯一标识符。页面必须已存在且属于当前用户。", "Page UID. Must exist and belong to you.", "是", "string"),
      p("title", "新标题。1-500 字符。不传则保持原标题。", "New title. 1-500 chars. Keep original if omitted.", "否", "string"),
      p("html", "新 HTML 内容。不传则保持原内容。", "New HTML content. Keep original if omitted.", "否", "string"),
      p("description", "新描述。最长 2000 字符。不传则保持原描述。", "New description. Max 2000 chars. Keep original if omitted.", "否", "string"),
      p("tags", "新标签列表。最多 12 个。不传则保持原标签。", "New tag list. Max 12. Keep original if omitted.", "否", "string[]"),
      p("visibility", "新可见性。不传则保持原设置。", "New visibility. Keep original if omitted.", "否", '"public"|"unlisted"|"private"'),
      p("cover_url", "新封面 URL。不传保持原值，传空字符串清除封面。", "New cover URL. Keep original if omitted. Empty string clears.", "否", "string"),
    ],
    examples: [
      { labelKey: "updatePageEx1", params: { uid: "hello-world", title: "Hello, Viben! (2026 ed.)", tags: ["intro", "hello", "2026"] } },
      { labelKey: "updatePageEx2", params: { uid: "draft-post", visibility: "unlisted" } },
    ],
  },
];

function WorkflowCard({ titleKey, steps }: { titleKey: string; steps: { tool?: string; descKey: string }[] }) {
  const l = useCurrentLang();
  return (
    <div className="rounded-xl border bg-card p-5">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-medium"><BookOpen size={16} className="text-primary/70" />{(t[l] as any)[titleKey]}</h3>
      <div className="space-y-3">
        {steps.map((step, i) => (
          <div key={i} className="flex items-start gap-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">{i + 1}</span>
            <span className="pt-0.5 text-sm text-muted-foreground leading-relaxed">
              {step.tool && <><InlineCode>{step.tool}</InlineCode>{" "}</>}{(t[l] as any)[step.descKey]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Language Switcher
// ═══════════════════════════════════════════════════════════
function LangSwitch() {
  const { i18n } = useTranslation();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const isEn = mounted && i18n.language?.startsWith("en");
  return (
    <button
      onClick={() => i18n.changeLanguage(isEn ? "zh-CN" : "en")}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <Languages size={14} />
      {mounted ? (isEn ? "中文" : "English") : "中文"}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════
// Page
// ═══════════════════════════════════════════════════════════
export default function McpDocsPage() {
  const l = useCurrentLang();
  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      {/* Header with lang switch */}
      <div className="mb-14">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Terminal size={20} className="text-primary" />
            </div>
            <h1 className="font-bold text-2xl text-foreground md:text-3xl">{t[l].title}</h1>
          </div>
          <LangSwitch />
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">{t[l].subtitle}</p>
      </div>

      {/* Connection */}
      <section className="mb-14">
        <h2 className="flex items-center gap-2.5 font-semibold text-xl text-foreground"><Globe size={20} className="text-primary/70" />{t[l].connection}</h2>
        <div className="mt-4 overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-border"><td className="w-40 px-4 py-2.5 text-xs font-medium"><Globe size={13} className="mr-2 inline text-muted-foreground" />{t[l].endpoint}</td><td className="px-4 py-2.5 text-xs"><EndpointCopy url={MCP_ENDPOINT} /></td></tr>
              <tr className="border-b border-border"><td className="px-4 py-2.5 text-xs font-medium"><Wifi size={13} className="mr-2 inline text-muted-foreground" />{t[l].transport}</td><td className="px-4 py-2.5 text-xs text-muted-foreground">{t[l].transportVal}</td></tr>
              <tr className="border-b border-border"><td className="px-4 py-2.5 text-xs font-medium"><Key size={13} className="mr-2 inline text-muted-foreground" />{t[l].auth}</td><td className="px-4 py-2.5 text-xs text-muted-foreground">{t[l].authVal}{" "}<a href={`${APP_URL}/settings/api_keys`} className="inline-flex items-center gap-0.5 text-primary underline hover:no-underline">{t[l].apiKeyManage} <ExternalLink size={11} /></a></td></tr>
              <tr className="border-b border-border"><td className="px-4 py-2.5 text-xs font-medium"><Server size={13} className="mr-2 inline text-muted-foreground" />{t[l].protocol}</td><td className="px-4 py-2.5 text-xs text-muted-foreground">{t[l].protocolVal}</td></tr>
              <tr><td className="px-4 py-2.5 text-xs font-medium"><Terminal size={13} className="mr-2 inline text-muted-foreground" />{t[l].clients}</td><td className="px-4 py-2.5 text-xs text-muted-foreground">{t[l].clientsVal}</td></tr>
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex gap-2.5 rounded-lg border border-amber-200 bg-amber-50/50 p-3">
          <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="text-sm text-amber-800 dark:text-amber-300">{t[l].corsWarning} <InlineCode>{`npx mcp-remote ${MCP_ENDPOINT}`}</InlineCode></div>
        </div>
      </section>

      {/* Quick Start */}
      <section className="mb-14">
        <h2 className="flex items-center gap-2.5 font-semibold text-xl text-foreground"><Terminal size={20} className="text-primary/70" />{t[l].quickStart}</h2>
        <div className="mt-4"><ClientTabs /></div>
        <div className="mt-4 flex gap-2.5 rounded-lg border border-blue-200 bg-blue-50/50 p-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950/20 dark:text-blue-300">
          <Info size={15} className="mt-0.5 shrink-0 text-blue-600 dark:text-blue-400" />
          <div>{t[l].apiKeyInfo} <a href={`${APP_URL}/settings/api_keys`} className="inline-flex items-center gap-0.5 font-medium underline hover:no-underline">{t[l].apiKeyManage} <ExternalLink size={11} /></a></div>
        </div>
      </section>

      {/* Tools */}
      <section className="mb-14">
        <h2 className="flex items-center gap-2.5 font-semibold text-xl text-foreground"><FileText size={20} className="text-primary/70" />{t[l].tools}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">{t[l].toolsDesc}</p>

        <h3 className="mt-10 mb-1 flex items-center gap-2 font-semibold text-lg text-foreground"><FileText size={18} className="text-primary/70" />{t[l].readTools}</h3>
        <p className="mb-8 mt-1.5 max-w-3xl text-sm leading-relaxed text-muted-foreground">{t[l].readToolsDesc}</p>
        <div className="mb-12 space-y-16">
          {READ_TOOLS.map((tool) => <ToolSection key={tool.name} {...tool} />)}
        </div>

        <h3 className="mt-10 mb-1 flex items-center gap-2 font-semibold text-lg text-foreground"><Plus size={18} className="text-primary/70" />{t[l].writeTools}</h3>
        <p className="mb-8 mt-1.5 max-w-3xl text-sm leading-relaxed text-muted-foreground">{t[l].writeToolsDesc}</p>
        <div className="space-y-16">
          {WRITE_TOOLS.map((tool) => <ToolSection key={tool.name} {...tool} />)}
        </div>
      </section>

      {/* Workflows */}
      <section className="mb-14">
        <h2 className="mb-4 flex items-center gap-2.5 font-semibold text-xl text-foreground"><BookOpen size={20} className="text-primary/70" />{t[l].workflows}</h2>
        <div className="space-y-4">
          <WorkflowCard titleKey="wf1Title" steps={[{ tool: "search_pages", descKey: "wf1s1" }, { tool: "get_page", descKey: "wf1s2" }, { descKey: "wf1s3" }]} />
          <WorkflowCard titleKey="wf2Title" steps={[{ descKey: "wf2s1" }, { tool: "create_page", descKey: "wf2s2" }, { descKey: "wf2s3" }]} />
          <WorkflowCard titleKey="wf3Title" steps={[{ tool: "search_pages", descKey: "wf3s1" }, { tool: "update_page", descKey: "wf3s2" }, { descKey: "wf3s3" }]} />
        </div>
      </section>

      {/* Limits */}
      <section>
        <h2 className="flex items-center gap-2.5 font-semibold text-xl text-foreground"><AlertTriangle size={20} className="text-primary/70" />{t[l].limits}</h2>
        <div className="mt-4 overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-border"><td className="w-36 px-4 py-2.5 text-xs font-medium"><Clock size={13} className="mr-2 inline text-muted-foreground" />{t[l].limitTimeout}</td><td className="px-4 py-2.5 text-xs text-muted-foreground">{t[l].limitTimeoutV}</td></tr>
              <tr className="border-b border-border"><td className="px-4 py-2.5 text-xs font-medium"><FileText size={13} className="mr-2 inline text-muted-foreground" />{t[l].limitSize}</td><td className="px-4 py-2.5 text-xs text-muted-foreground">{t[l].limitSizeV}</td></tr>
              <tr className="border-b border-border"><td className="px-4 py-2.5 text-xs font-medium"><Tags size={13} className="mr-2 inline text-muted-foreground" />{t[l].limitTags}</td><td className="px-4 py-2.5 text-xs text-muted-foreground">{t[l].limitTagsV}</td></tr>
              <tr className="border-b border-border"><td className="px-4 py-2.5 text-xs font-medium"><Wifi size={13} className="mr-2 inline text-muted-foreground" />{t[l].limitProtocol}</td><td className="px-4 py-2.5 text-xs text-muted-foreground">{t[l].limitProtocolV}</td></tr>
              <tr className="border-b border-border"><td className="px-4 py-2.5 text-xs font-medium"><Shield size={13} className="mr-2 inline text-muted-foreground" />{t[l].limitRate}</td><td className="px-4 py-2.5 text-xs text-muted-foreground">{t[l].limitRateV}</td></tr>
              <tr><td className="px-4 py-2.5 text-xs font-medium"><Key size={13} className="mr-2 inline text-muted-foreground" />{t[l].limitVisibility}</td><td className="px-4 py-2.5 text-xs text-muted-foreground">{t[l].limitVisibilityV}</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
