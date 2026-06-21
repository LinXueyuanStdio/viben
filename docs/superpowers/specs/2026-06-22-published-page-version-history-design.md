# 发布页面版本记录设计

## 目标

每次用户发布 static page 时，系统自动记录一条不可变发布版本。公网访问仍读取 `published_pages` 的最新内容，版本记录只用于历史追踪、后续回滚和差异查看。

## 数据模型

新增 `published_page_versions` 表：

- `id`: 主键。
- `published_page_id`: 指向 `published_pages.id`，页面删除时级联删除版本。
- `uid`: 页面 uid 快照，便于按页面查询。
- `user_id`: 发布用户 id。
- `version`: 同一 `user_id + uid` 下从 `1` 递增的版本号。
- `title`, `icon`, `description`, `html`: 本次发布内容快照。
- `created_at`: 版本创建时间。

约束：

- `published_page_versions_user_id_uid_version_idx` 唯一约束保证同一用户同一页面版本号不重复。
- 索引 `published_page_versions_page_id_idx` 支持按发布页面查询历史。
- 索引 `published_page_versions_user_id_uid_idx` 支持按用户和 page uid 查询历史。

## 发布流程

`POST /api/pages/publish` 继续使用数据库级 upsert 更新 `published_pages` 最新版本，避免并发发布撞唯一键。upsert 后查询当前 `published_pages` 记录，计算 `max(version) + 1`，插入 `published_page_versions`。

版本记录失败时，整个 publish 失败并返回详细错误；这样不会出现“页面最新内容已变更但版本记录缺失”的不一致状态。后续如需更强一致性，可以把 upsert 和版本插入包进数据库事务。

## 非目标

本次不做发布历史 UI、不做回滚接口、不改变 gateway/desktop 的发布接口。

