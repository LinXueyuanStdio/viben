# 发布页面 User Slug 设计

## 背景

当前发布页公开 URL 使用 `/page/{user_id}/{page_id}`。`user_id` 是 UUID，过长且不适合展示。发布页需要改为 `/page/{user_slug}/{page_id}`，其中 `user_slug` 是用户公开短标识。

## 目标

- `users` 表新增 `user_slug` 字段，唯一且非空。
- `user_slug` 只允许英文、数字、下划线和连字符，并采用接近编程语言变量名的规则：首字符必须为英文字母或下划线。
- 发布 API 返回 `/page/{user_slug}/{page_id}`。
- 公开访问路由通过 `user_slug` 查用户，再用用户 id 和页面 id 查发布页。
- Desktop 发布状态自动加载时也使用 `user_slug`，不再依赖长 `user_id`。

## 约束

`user_slug` 使用正则：`^[A-Za-z_][A-Za-z0-9_-]{2,29}$`。

- 长度 3 到 30。
- 首字符只能是英文字母或 `_`。
- 后续字符允许英文字母、数字、`_`、`-`。
- 数据库层使用 `CHECK` 约束强制校验。
- 数据库层使用唯一索引保证唯一性。

## 数据迁移

迁移给现有用户补齐 `user_slug`：

- 优先使用现有 `username`。
- 不合法字符替换为 `_`。
- 如果首字符不合法，前置 `_`。
- 长度裁剪到 30。
- 为空或过短时使用 `user_` 加短 id。
- 迁移完成后添加 `NOT NULL`、唯一索引和 `CHECK` 约束。

## API 行为

发布页创建或更新时，服务端从当前 session 的用户记录读取 `user_slug`，返回：

```json
{
  "success": true,
  "page_uid": "demo",
  "url": "/page/alice/demo",
  "updated": false
}
```

公开页面访问：

- `GET /page/{user_slug}/{page_id}`。
- 先按 `users.user_slug` 查用户。
- 再按 `published_pages.user_id` 和 `published_pages.uid` 查页面。
- 找不到用户或页面时返回 404。

## Desktop 同步

Desktop auth session 增加 `userSlug`。Setting tab 挂载或切换静态页面时，调用 gateway 的发布状态接口：

```json
{
  "access_token": "...",
  "user_slug": "alice",
  "uid": "demo"
}
```

若远端已发布，返回 `/page/{user_slug}/{page_id}` 并更新本地发布 store，使按钮显示 `Update Publish`。
