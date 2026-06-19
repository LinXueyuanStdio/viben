# Static 页面云端发布设计

## 目标

在 Desktop 用户已登录的前提下，给 workspace 的 static 类型页面 Setting 面板增加发布按钮。点击后读取该 static 页面的入口 HTML 文件，将 HTML 作为字符串发布到 apps/web 的数据库；访问云端 `/page/{uid}` 时展示该 HTML 页面。

## 范围

- 仅支持 `page.type === "static"`。
- 发布使用本地页面 `uid` 作为云端页面 `uid`，全局唯一。
- 重复发布同一 `uid` 时，如果当前登录用户是原 owner，则更新；如果不是 owner，则返回 403。
- `published_pages` 表保留 `icon` 和 `description` 字段。
- 云端公开展示页不要求登录。

## 数据流

1. Desktop Setting 面板点击“Publish”。
2. Desktop 使用 gateway `/api/page/view` 获取 page 配置，读取 static 入口文件名。
3. Desktop 使用 gateway `/api/page/serve` 获取入口 HTML 字符串。
4. Desktop 使用 `@viben/api-client` 携带 Bearer Token 调用 apps/web `POST /api/pages/publish`。
5. apps/web 将 `{ uid, title, icon, description, html }` 写入 `published_pages`。
6. 用户访问 `/page/{uid}`，apps/web 从数据库读取 `html` 并以 sandbox iframe 展示。

## 数据库

`apps/web/lib/db/schema.ts` 中的 `published_pages` 表包含：

- `id`
- `uid`，全局唯一
- `user_id`
- `title`
- `icon`
- `description`
- `html`
- `created_at`
- `updated_at`

当前代码已存在该表和 `icon`、`description` 字段；实现中只补齐类型导出和迁移一致性检查。

## API

`POST /api/pages/publish`

请求体：

```json
{
  "uid": "demo",
  "title": "Demo",
  "icon": { "type": "lucide", "value": "file-text" },
  "description": "Demo page",
  "html": "<!doctype html><html><body>Demo</body></html>"
}
```

响应：

```json
{
  "success": true,
  "page_uid": "demo",
  "url": "/page/demo",
  "updated": false
}
```

错误：

- 401：未登录或 token 无效。
- 400：缺少 `uid`、`title`、`html` 或字段类型不合法。
- 403：`uid` 已被其他用户发布。

## Web 展示

新增 `/page/[uid]` 路由。页面本身使用主站布局，但用户 HTML 放入 `<iframe sandbox="allow-scripts allow-forms allow-popups allow-modals allow-downloads">` 的 `srcDoc`，隔离用户 HTML 对主站 DOM、cookie、localStorage 的访问。

## Desktop UI

`PageSettingPanel` 在 `pageType === "static"` 时显示发布区：

- 未登录时禁用发布按钮并提示登录。
- 发布中显示 loading。
- 成功后 toast 展示发布成功，并提供云端 URL。
- 失败时 toast 展示错误。

## 测试

- apps/web：测试发布 API 写入/更新 icon、description、html，非 owner 更新返回 403。
- apps/web：测试 `/page/[uid]` 路由会渲染 sandbox iframe，未找到时返回 not found。
- packages/api-client：测试 `pages.publish()` 会发送 Bearer Token、JSON body，并返回 `page_uid`/`url`。
- apps/desktop：测试 static 页显示发布按钮，非 static 页不显示；点击后读取入口 HTML 并调用 API client。

## 验证

- `pnpm --filter @viben/web test:run`
- `pnpm --filter @viben/api-client typecheck`
- `pnpm --filter @viben/desktop test`
- `pnpm typecheck`
