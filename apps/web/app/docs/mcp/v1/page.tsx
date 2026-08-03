import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Viben MCP 服务 — 文档",
  description: "通过 Model Context Protocol 将 Viben 页面管理能力接入 AI 助手。搜索、读取、创建和更新页面。",
};

const MCP_ENDPOINT = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/mcp/v1`;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// ── 工具定义 ────────────────────────────────────────────

interface ToolParam {
  name: string;
  type: string;
  required: string;
  desc: string;
}

interface ToolDef {
  name: string;
  description: string;
  auth: "必需" | "可选";
  bestFor: string;
  returns: string;
  params: ToolParam[];
  usageNote?: string;
  example?: { input: string; output: string };
}

const READ_TOOLS: ToolDef[] = [
  {
    name: "search_pages",
    description:
      "搜索 viben 上已发布的公开页面。匹配标题、页面唯一标识符（uid）和描述内容。适合文献发现、内容检索和浏览公开页面。",
    auth: "可选",
    bestFor: "内容发现——当你需要查找特定主题的页面、浏览某位作者的作品，或探索平台上的公开内容时使用。",
    returns:
      "返回匹配页面的列表，每个页面包含 uid、title、author_slug、description、tags 和 published_at。结果按最近发布时间降序排列。",
    params: [
      { name: "query", type: "string", required: "是", desc: "搜索关键词。同时匹配页面标题、uid 和描述文本。支持部分匹配。最少 1 个字符。" },
      { name: "author_slug", type: "string", required: "否", desc: "按作者 slug 过滤结果。不传则搜索全站公开页面。" },
      { name: "limit", type: "number", required: "否", desc: "返回数量上限。默认 20，最小 1，最大 50。" },
    ],
    usageNote:
      "query 参数使用 ILIKE 模糊匹配，支持中英文。建议先用简短关键词进行初步搜索，再根据结果调整。如需精确查找某位作者的页面，结合 author_slug 参数使用。",
  },
  {
    name: "get_page",
    description:
      "获取指定页面的完整内容，包括 HTML 源码、元数据（标题、描述、标签、封面图）、可见性设置和作者信息。适合深度阅读、内容分析和页面数据提取。",
    auth: "可选",
    bestFor: "深度内容获取——当你已通过 search_pages 找到目标页面，需要获取其完整 HTML 内容进行分析、摘要或二次处理时使用。",
    returns:
      "返回页面的完整数据对象：uid、title、html（完整 HTML 源码）、description、tags、visibility、cover_url、published_at、version，以及嵌套的 author 对象（display_name、avatar_url、slug）。",
    params: [
      { name: "author_slug", type: "string", required: "是", desc: "页面作者的 slug。可通过 search_pages 返回的 author_slug 字段获取。" },
      { name: "page_uid", type: "string", required: "是", desc: "页面唯一标识符。可通过 search_pages 返回的 uid 字段获取。" },
    ],
    usageNote:
      "author_slug 和 page_uid 组合唯一确定一个页面。如果页面不存在或不可访问，返回错误信息。注意 html 字段可能较大（最大约 5MB），大页面可能影响响应时间。",
  },
];

const WRITE_TOOLS: ToolDef[] = [
  {
    name: "create_page",
    description:
      "在 viben 上发布新页面。如果指定的 uid 已存在（同作者下），则自动更新为最新内容（upsert 语义）。支持设置可见性、标签和封面图。需要 API Key 认证，仅操作者本人的页面。",
    auth: "必需",
    bestFor: "创建和发布——当你需要将 AI 生成的内容发布到 viben，或从零开始创建新页面时使用。也适合批量导入内容。",
    returns:
      "返回 success、page_uid、url（页面访问链接）和 read_url（阅读模式链接）。updated 字段标识本次是新建（false）还是更新已有页面（true）。",
    params: [
      { name: "uid", type: "string", required: "是", desc: "页面唯一标识符。建议使用有意义的英文 slug（如 my-notes），1-200 字符。" },
      { name: "title", type: "string", required: "是", desc: "页面标题。1-500 字符，支持中英文。" },
      { name: "html", type: "string", required: "是", desc: "页面 HTML 内容。完整的 HTML 文档或片段，建议控制在 5MB 以内。" },
      { name: "description", type: "string", required: "否", desc: "页面描述/摘要。最长 2000 字符，用于搜索和 SEO。" },
      { name: "tags", type: "string[]", required: "否", desc: "标签列表。字符串数组，最多 12 个标签。" },
      { name: "visibility", type: '"public" \\| "unlisted" \\| "private"', required: "否", desc: "可见性设置。public 公开可见，unlisted 不显示在列表中但可通过链接访问，private 仅作者可见。默认 public。" },
      { name: "cover_url", type: "string", required: "否", desc: "封面图片 URL。用于页面卡片展示。" },
    ],
    usageNote:
      "uid 在同一个作者下必须唯一。如果 uid 已存在，将触发内容更新（版本号自动递增）。发布成功后会自动通知订阅者。visibility 为 private 或 unlisted 的页面仍可通过 search_pages 被作者本人搜索到。",
  },
  {
    name: "update_page",
    description:
      "更新已有页面的内容或元数据。只更新你指定的字段，未指定的字段保持不变。需要 API Key 认证，仅页面作者可操作。",
    auth: "必需",
    bestFor: "增量更新——当你只需要修改页面的某个部分（如标题、描述、标签或可见性），而不想重新发送完整内容时使用。比 create_page 更轻量，无需提供完整的 html 内容。",
    returns:
      "返回 success、page_uid、url 和 read_url。updated 字段始终为 true。如果页面不存在或不属于当前用户，返回错误。",
    params: [
      { name: "uid", type: "string", required: "是", desc: "要更新的页面的唯一标识符。" },
      { name: "title", type: "string", required: "否", desc: "新标题。1-500 字符。不传则保持原标题。" },
      { name: "html", type: "string", required: "否", desc: "新 HTML 内容。不传则保持原内容。" },
      { name: "description", type: "string", required: "否", desc: "新描述。最长 2000 字符。不传则保持原描述。" },
      { name: "tags", type: "string[]", required: "否", desc: "新标签列表。不传则保持原标签。" },
      { name: "visibility", type: '"public" \\| "unlisted" \\| "private"', required: "否", desc: "新可见性设置。不传则保持原设置。" },
      { name: "cover_url", type: "string", required: "否", desc: "新封面图片 URL。不传则保持原封面。传空字符串可清除封面。" },
    ],
    usageNote:
      "与 create_page 不同，update_page 要求页面已存在且属于当前用户，不存在时返回错误而非自动创建。每次更新都会递增版本号并通知订阅者。仅传入需要修改的字段即可，未传入的字段保持原值。",
  },
];

// ── 客户端集成 ──────────────────────────────────────────

const CLIENTS = [
  {
    name: "Claude Code",
    command: `claude mcp add viben ${MCP_ENDPOINT}`,
  },
  {
    name: "Claude Desktop",
    detail: "在 claude_desktop_config.json 中添加 streamableHttp 类型的服务器配置：",
    config: JSON.stringify(
      {
        mcpServers: {
          viben: {
            type: "streamableHttp",
            url: MCP_ENDPOINT,
            headers: { Authorization: "Bearer bmcp_YOUR_API_KEY" },
          },
        },
      },
      null,
      2,
    ),
  },
  {
    name: "VS Code / Cursor",
    detail: "在 .vscode/mcp.json 或 Cursor settings 中添加：",
    config: JSON.stringify(
      {
        servers: {
          viben: {
            type: "streamableHttp",
            url: MCP_ENDPOINT,
            headers: { Authorization: "Bearer bmcp_YOUR_API_KEY" },
          },
        },
      },
      null,
      2,
    ),
  },
];

// ── 常见工作流 ──────────────────────────────────────────

const WORKFLOWS = [
  {
    title: "内容发现 → 深度阅读",
    steps: [
      { tool: "search_pages", desc: "用关键词搜索感兴趣的页面，获得 uid 和 author_slug" },
      { tool: "get_page", desc: "对感兴趣的页面调用 get_page，获取完整 HTML 内容" },
      { desc: "基于获取的内容进行分析、摘要、翻译或其他处理" },
    ],
  },
  {
    title: "AI 内容生成 → 发布",
    steps: [
      { desc: "使用 AI 生成页面内容（标题、HTML、描述、标签）" },
      { tool: "create_page", desc: "调用 create_page 发布新页面，设置合适的 uid 和 visibility" },
      { desc: "返回的 url 可直接分享给读者" },
    ],
  },
  {
    title: "批量更新页面元数据",
    steps: [
      { tool: "search_pages", desc: "搜索需要更新的页面列表" },
      { tool: "update_page", desc: "对每个页面调用 update_page，仅传入需要修改的字段（如 tags 或 description）" },
      { desc: "不需要重新发送 html 内容，高效完成批量元数据更新" },
    ],
  },
];

// ── 渲染组件 ────────────────────────────────────────────

function Badge({ label, variant }: { label: string; variant: "auth" | "public" }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        variant === "auth"
          ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400"
          : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400"
      }`}
    >
      {label}
    </span>
  );
}

function ParamTable({ params }: { params: ToolParam[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-xs">参数</th>
            <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-xs">类型</th>
            <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-xs">必填</th>
            <th className="px-4 py-3 text-left font-medium text-xs">说明</th>
          </tr>
        </thead>
        <tbody>
          {params.map((p) => (
            <tr key={p.name} className="border-b border-border last:border-0">
              <td className="whitespace-nowrap py-3 pl-4 pr-4 font-mono text-xs">{p.name}</td>
              <td className="whitespace-nowrap py-3 pl-4 pr-4 font-mono text-xs text-muted-foreground">
                {p.type}
              </td>
              <td className="whitespace-nowrap py-3 pl-4 pr-4 text-xs">
                {p.required === "是" ? (
                  <span className="font-medium text-amber-600 dark:text-amber-400">是</span>
                ) : (
                  <span className="text-muted-foreground">否</span>
                )}
              </td>
              <td className="py-3 px-4 text-xs text-muted-foreground leading-relaxed">{p.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ToolCard({ tool }: { tool: ToolDef }) {
  return (
    <div className="rounded-xl border bg-card p-6">
      {/* 工具名称 + 认证标记 */}
      <div className="mb-4 flex items-center gap-3">
        <code className="rounded-lg bg-zinc-950 px-3 py-1 font-mono font-semibold text-sm text-zinc-50">
          {tool.name}
        </code>
        <Badge label={tool.auth === "必需" ? "需认证" : "公开"} variant={tool.auth === "必需" ? "auth" : "public"} />
      </div>

      {/* 描述 */}
      <p className="mb-4 text-muted-foreground leading-relaxed text-sm">{tool.description}</p>

      {/* 适用场景 */}
      <div className="mb-4 rounded-lg border bg-background p-4">
        <span className="font-medium text-xs">适用场景</span>
        <p className="mt-1 text-muted-foreground text-xs leading-relaxed">{tool.bestFor}</p>
      </div>

      {/* 返回值 */}
      <div className="mb-4 rounded-lg border bg-background p-4">
        <span className="font-medium text-xs">返回值</span>
        <p className="mt-1 text-muted-foreground text-xs leading-relaxed">{tool.returns}</p>
      </div>

      {/* 参数表 */}
      <div className="mb-4">
        <span className="mb-2 block font-medium text-xs">参数</span>
        <ParamTable params={tool.params} />
      </div>

      {/* 使用说明 */}
      {tool.usageNote && (
        <div className="rounded-lg border-l-2 border-primary/50 bg-background p-4">
          <span className="font-medium text-xs">使用说明</span>
          <p className="mt-1 text-muted-foreground text-xs leading-relaxed">{tool.usageNote}</p>
        </div>
      )}
    </div>
  );
}

// ── 页面主体 ────────────────────────────────────────────

export default function McpDocsPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      {/* ── 页面标题 ── */}
      <div className="mb-12">
        <h1 className="mb-4 font-bold text-3xl tracking-tight">Viben MCP 服务</h1>
        <p className="max-w-2xl text-muted-foreground text-base leading-relaxed">
          Viben MCP 服务基于 Model Context Protocol (MCP) v1.0.0，为 AI 应用、智能体和自动化工作流提供对
          Viben 页面系统的程序化访问。通过标准的 MCP 工具接口，AI 助手可以直接搜索、读取、创建和更新
          Viben 页面，无需离开对话上下文。
        </p>
      </div>

      {/* ── 连接信息 ── */}
      <section className="mb-12">
        <h2 className="mb-4 font-semibold text-2xl">连接信息</h2>
        <div className="rounded-xl border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <tbody>
              {[
                ["端点", <code key="ep" className="font-mono text-xs break-all">{MCP_ENDPOINT}</code>],
                ["传输方式", "Streamable HTTP — POST 发送请求，GET 可选用于服务端→客户端流式推送，DELETE 终止会话"],
                ["认证", "Bearer Token（API Key，bmcp_ 前缀）或 JWE Session Token"],
                ["协议版本", "Model Context Protocol (MCP) v1.0.0"],
              ].map(([label, value]) => (
                <tr key={label as string} className="border-b border-border last:border-0">
                  <td className="w-32 py-3 px-4 font-medium text-xs">{label}</td>
                  <td className="py-3 px-4 text-muted-foreground text-xs">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── 支持的客户端 ── */}
      <section className="mb-12">
        <h2 className="mb-4 font-semibold text-2xl">支持的客户端</h2>
        <div className="rounded-xl border bg-card p-6">
          <p className="mb-4 text-muted-foreground text-sm">
            Viben MCP 服务可被任何兼容 MCP Streamable HTTP transport 的客户端使用。
            以下是最常见的集成方式：
          </p>
          <div className="space-y-4">
            {CLIENTS.map((client) => (
              <div key={client.name} className="rounded-lg border bg-background p-4">
                <span className="font-medium text-sm">{client.name}</span>
                {client.command && (
                  <pre className="mt-2 overflow-x-auto rounded-lg bg-zinc-950 p-3 font-mono text-xs text-zinc-200">
                    <code>{client.command}</code>
                  </pre>
                )}
                {client.detail && (
                  <p className="mt-2 text-muted-foreground text-xs">{client.detail}</p>
                )}
                {client.config && (
                  <pre className="mt-2 overflow-x-auto rounded-lg bg-zinc-950 p-3 font-mono text-xs text-zinc-200">
                    <code>{client.config}</code>
                  </pre>
                )}
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
            <p className="text-amber-800 dark:text-amber-300 text-xs leading-relaxed">
              <strong>注意：</strong>浏览器中运行的 MCP 集成（如直接在 claude.ai 或 chatgpt.com 内添加）
              可能因 CORS 策略无法直接连接。如需在浏览器助手中使用，可以通过本地桥接工具转发：
              <code className="mx-1 rounded bg-amber-200 px-1 py-0.5 font-mono text-xs dark:bg-amber-800/50">
                npx mcp-remote {MCP_ENDPOINT}
              </code>
            </p>
          </div>
        </div>
      </section>

      {/* ── 认证 ── */}
      <section className="mb-12">
        <h2 className="mb-4 font-semibold text-2xl">认证</h2>
        <div className="rounded-xl border bg-card p-6">
          <p className="mb-4 text-muted-foreground leading-relaxed text-sm">
            Viben MCP 服务使用 Bearer Token 认证。读取操作（搜索、获取页面）为可选认证：
            不传 Token 时只能访问公开页面；传入 Token 后可访问用户本人的所有页面（包括 private 和 unlisted）。
            写入操作（创建、更新页面）需要强制认证。
          </p>

          <h3 className="mb-3 font-medium text-sm">API Key 认证（推荐）</h3>
          <p className="mb-3 text-muted-foreground text-xs">
            在 Viben 的{" "}
            <a href={`${APP_URL}/settings/api_keys`} className="text-primary underline">
              API 密钥管理
            </a>{" "}
            页面创建 API Key（以 bmcp_ 为前缀），然后在请求头中传递：
          </p>
          <pre className="mb-4 overflow-x-auto rounded-lg bg-zinc-950 p-4 text-sm text-zinc-50">
            <code>{"Authorization: Bearer bmcp_XXXXXXXX_YYYYYYYYYYYY"}</code>
          </pre>

          <h3 className="mb-3 font-medium text-sm">Session Token 认证</h3>
          <p className="text-muted-foreground text-xs">
            浏览器登录后，Session Cookie 中存储的 JWE Token 也可作为 Bearer Token 使用。
            此方式主要用于桌面客户端和浏览器扩展集成。
          </p>
        </div>
      </section>

      {/* ── 工具参考：读取工具 ── */}
      <section className="mb-12">
        <h2 className="mb-2 font-semibold text-2xl">工具参考</h2>
        <p className="mb-6 text-muted-foreground text-sm">
          Viben MCP 服务目前提供 4 个工具，分为两组：读取工具（无需认证）和写入工具（需要认证）。
        </p>

        <h3 className="mb-4 font-medium text-lg">读取工具</h3>
        <p className="mb-4 text-muted-foreground text-xs leading-relaxed">
          以下工具用于搜索和获取页面内容。无需认证即可访问公开页面；传入 API Key 后可额外访问本人的私有和未上架页面。
        </p>
        <div className="space-y-6">
          {READ_TOOLS.map((tool) => (
            <ToolCard key={tool.name} tool={tool} />
          ))}
        </div>
      </section>

      {/* ── 工具参考：写入工具 ── */}
      <section className="mb-12">
        <h3 className="mb-4 font-medium text-lg">写入工具</h3>
        <p className="mb-4 text-muted-foreground text-xs leading-relaxed">
          以下工具用于创建和更新页面内容。需要 API Key 认证，操作者只能管理自己的页面。
        </p>
        <div className="space-y-6">
          {WRITE_TOOLS.map((tool) => (
            <ToolCard key={tool.name} tool={tool} />
          ))}
        </div>
      </section>

      {/* ── 常见工作流 ── */}
      <section className="mb-12">
        <h2 className="mb-4 font-semibold text-2xl">常见工作流</h2>
        <div className="space-y-4">
          {WORKFLOWS.map((wf) => (
            <div key={wf.title} className="rounded-xl border bg-card p-6">
              <h3 className="mb-4 font-medium text-sm">{wf.title}</h3>
              <div className="space-y-3">
                {wf.steps.map((step, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-mono text-xs">
                      {i + 1}
                    </span>
                    <div>
                      {step.tool && (
                        <code className="rounded bg-zinc-950 px-1.5 py-0.5 font-mono text-xs text-zinc-200">
                          {step.tool}
                        </code>
                      )}
                      <span className="ml-1 text-muted-foreground text-xs">{step.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 限制与注意事项 ── */}
      <section>
        <h2 className="mb-4 font-semibold text-2xl">限制与注意事项</h2>
        <div className="rounded-xl border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <tbody>
              {[
                ["请求超时", "最大 300 秒（服务端函数执行上限）"],
                ["页面大小", "HTML 内容建议控制在 5MB 以内。超大页面可能导致请求超时或内存不足"],
                ["标签数量", "每页最多 12 个标签。超出部分将被自动截断"],
                ["传输协议", "仅支持 Streamable HTTP。不支持旧版 SSE transport（2024 规范）"],
                ["并发限制", "与 Viben REST API 共享频率限制策略。高频写入可能触发限流"],
                ["可见性", "private 页面仅作者本人可见。MCP 服务不会将私有内容暴露给未认证的请求"],
              ].map(([label, value]) => (
                <tr key={label as string} className="border-b border-border last:border-0">
                  <td className="w-40 py-3 px-4 font-medium text-xs">{label}</td>
                  <td className="py-3 px-4 text-muted-foreground text-xs">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
