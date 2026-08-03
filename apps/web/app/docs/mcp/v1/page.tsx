import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Viben MCP 文档",
  description: "通过 Model Context Protocol 将 Viben 页面管理能力接入 AI 助手",
};

const TOOLS = [
  {
    name: "search_pages",
    description: "搜索 viben 上已发布的公开页面",
    auth: "可选",
    params: [
      { name: "query", type: "string", required: "是", desc: "搜索关键词，匹配标题、页面 ID 和描述" },
      { name: "author_slug", type: "string", required: "否", desc: "按作者 slug 过滤结果" },
      { name: "limit", type: "number", required: "否", desc: "返回数量，默认 20，最大 50" },
    ],
  },
  {
    name: "get_page",
    description: "获取指定页面的完整内容，包括 HTML、元数据和作者信息",
    auth: "可选",
    params: [
      { name: "author_slug", type: "string", required: "是", desc: "页面作者的 slug" },
      { name: "page_uid", type: "string", required: "是", desc: "页面唯一标识符" },
    ],
  },
  {
    name: "create_page",
    description: "发布新页面到 viben",
    auth: "必需",
    params: [
      { name: "uid", type: "string", required: "是", desc: "页面唯一标识符" },
      { name: "title", type: "string", required: "是", desc: "页面标题" },
      { name: "html", type: "string", required: "是", desc: "页面 HTML 内容" },
      { name: "description", type: "string", required: "否", desc: "页面描述" },
      { name: "tags", type: "string[]", required: "否", desc: "标签列表（最多 12 个）" },
      { name: "visibility", type: '"public" | "unlisted" | "private"', required: "否", desc: "可见性，默认 public" },
      { name: "cover_url", type: "string", required: "否", desc: "封面图片 URL" },
    ],
  },
  {
    name: "update_page",
    description: "更新已有页面的内容或元数据",
    auth: "必需",
    params: [
      { name: "uid", type: "string", required: "是", desc: "要更新的页面唯一标识符" },
      { name: "title", type: "string", required: "否", desc: "新标题" },
      { name: "html", type: "string", required: "否", desc: "新 HTML 内容" },
      { name: "description", type: "string", required: "否", desc: "新描述" },
      { name: "tags", type: "string[]", required: "否", desc: "新标签列表" },
      { name: "visibility", type: '"public" | "unlisted" | "private"', required: "否", desc: "新可见性设置" },
      { name: "cover_url", type: "string", required: "否", desc: "新封面图片 URL" },
    ],
  },
];

const MCP_ENDPOINT = `${process.env.NEXT_PUBLIC_APP_URL || "https://viben-web.vercel.app"}/api/mcp/v1`;

const CLIENTS = [
  { name: "Claude Code", command: `claude mcp add viben ${MCP_ENDPOINT}` },
  { name: "Claude Desktop", note: "在 claude_desktop_config.json 中添加 streamableHttp 类型的服务器配置" },
  { name: "VS Code / Cursor", note: "通过 MCP 配置文件添加，类型选择 Streamable HTTP" },
  { name: "Zed", note: "在 settings.json 的 context_servers 中添加" },
];

export default function McpDocsPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      {/* Header */}
      <div className="mb-12">
        <h1 className="mb-3 font-bold text-3xl tracking-tight">Viben MCP 服务</h1>
        <p className="text-muted-foreground text-lg leading-relaxed">
          通过 Model Context Protocol (MCP) 将 Viben 的页面管理能力接入 AI 助手。
          搜索、读取、创建和更新页面 — 直接在 Claude Code、VS Code、Cursor 等 MCP 兼容客户端中使用。
        </p>
      </div>

      {/* 快速开始 */}
      <section className="mb-12">
        <h2 className="mb-4 font-semibold text-2xl">快速开始</h2>
        <div className="rounded-xl border bg-card p-6">
          <p className="mb-4 text-muted-foreground text-sm">MCP 服务端点：</p>
          <pre className="mb-4 overflow-x-auto rounded-lg bg-zinc-950 p-4 text-sm text-zinc-50">
            <code>{MCP_ENDPOINT}</code>
          </pre>
          <p className="mb-3 font-medium text-sm">支持的客户端：</p>
          <div className="space-y-3">
            {CLIENTS.map((client) => (
              <div key={client.name} className="rounded-lg border bg-background p-3">
                <span className="font-medium text-sm">{client.name}</span>
                {client.command ? (
                  <pre className="mt-1.5 overflow-x-auto rounded bg-zinc-950 p-2 font-mono text-xs text-zinc-300">
                    <code>{client.command}</code>
                  </pre>
                ) : (
                  <p className="mt-1 text-muted-foreground text-xs">{client.note}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 认证 */}
      <section className="mb-12">
        <h2 className="mb-4 font-semibold text-2xl">认证</h2>
        <div className="rounded-xl border bg-card p-6">
          <p className="mb-4 text-muted-foreground leading-relaxed">
            写入操作（创建、更新页面）需要认证。使用 viben API Key，通过 HTTP Bearer Token 传递：
          </p>
          <pre className="overflow-x-auto rounded-lg bg-zinc-950 p-4 text-sm text-zinc-50">
            <code>{"Authorization: Bearer bmcp_XXXXXXXX_YYYYYYYYYYYY"}</code>
          </pre>
          <p className="mt-4 text-muted-foreground text-sm">
            API Key 可在 viben 设置 →{" "}
            <a href="/settings/api_keys" className="text-primary underline">
              API 密钥
            </a>{" "}
            页面创建和管理。搜索和读取操作不需要认证。
          </p>
        </div>
      </section>

      {/* 工具参考 */}
      <section className="mb-12">
        <h2 className="mb-4 font-semibold text-2xl">工具参考</h2>
        <div className="space-y-6">
          {TOOLS.map((tool) => (
            <div key={tool.name} className="rounded-xl border bg-card p-6">
              <div className="mb-3 flex items-center gap-3">
                <code className="rounded bg-zinc-950 px-2 py-0.5 font-mono font-semibold text-sm text-zinc-50">
                  {tool.name}
                </code>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    tool.auth === "必需"
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                      : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                  }`}
                >
                  {tool.auth === "必需" ? "需认证" : "公开"}
                </span>
              </div>
              <p className="mb-4 text-muted-foreground">{tool.description}</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="py-2 pr-4 text-left font-medium">参数</th>
                      <th className="py-2 pr-4 text-left font-medium">类型</th>
                      <th className="py-2 pr-4 text-left font-medium">必填</th>
                      <th className="py-2 text-left font-medium">说明</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tool.params.map((p) => (
                      <tr key={p.name} className="border-b last:border-0">
                        <td className="py-2 pr-4 font-mono text-xs">{p.name}</td>
                        <td className="py-2 pr-4 font-mono text-muted-foreground text-xs">{p.type}</td>
                        <td className="py-2 pr-4 text-xs">{p.required}</td>
                        <td className="py-2 text-muted-foreground text-xs">{p.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 限制说明 */}
      <section>
        <h2 className="mb-4 font-semibold text-2xl">限制说明</h2>
        <div className="rounded-xl border bg-card p-6">
          <ul className="space-y-2 text-muted-foreground text-sm">
            <li>· 请求超时：最大 300 秒（由 Vercel 函数限制）</li>
            <li>· 速率限制：与 REST API 共享相同的频率限制策略</li>
            <li>· 页面 HTML 大小：建议控制在 5MB 以内</li>
            <li>· 标签数量：每页最多 12 个标签</li>
            <li>· 仅支持 Streamable HTTP transport，不支持 SSE</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
