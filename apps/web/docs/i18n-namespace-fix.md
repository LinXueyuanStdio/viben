# i18n 问题修复跟踪

## 一、collection namespace 问题 ✅ 已完成

**根因**: `lib/i18n/index.ts` 只注册了 `translation` namespace，
但 9 个 collection 组件使用 `useTranslation('collections')` 查不存在的 namespace，
导致 `t()` 返回 key 本身（英文），不会显示翻译。

**修复**: `useTranslation('collections')` → `useTranslation()`，
`t('key')` → `t('collections.key')`

**已修复文件 (9/9)**:
- [x] `components/collections/add-item-dialog.tsx`
- [x] `components/collections/collection-card.tsx`
- [x] `components/collections/collection-header.tsx`
- [x] `components/collections/collection-items.tsx`
- [x] `components/collections/collections-empty.tsx`
- [x] `components/collections/collections-filters.tsx`
- [x] `components/collections/create-collection-button.tsx`
- [x] `components/collections/edit-collection-form.tsx`
- [x] `components/pages/collection-selector.tsx` — 使用 useTranslation() 但待验证 key 前缀

---

## 二、硬编码中文（未使用 i18n）

### 2.1 通知页面 `app/(dashboard)/notifications/page.tsx`

Server component，无法用 `useTranslation`，但部分已用 `<T>`/`<EmptyState>` 模式。

| 行号 | 硬编码 | 应改为 |
|------|--------|--------|
| 20 | `["全部", "评论", "关注", "订阅"]` | i18n tab labels |
| 36 | `"刚刚"` | time ago i18n |
| 37 | `"${mins}分钟前"` | time ago i18n |
| 39 | `"${hours}小时前"` | time ago i18n |
| 41 | `"${days}天前"` | time ago i18n |
| 42 | `"${days/7}周前"` | time ago i18n |
| 43 | `"${days/30}个月前"` | time ago i18n |
| 44 | `"${days/365}年前"` | time ago i18n |
| 81 | `"查看"`, `"标记已读"` | action labels |
| 120 | `title="通知"` | page heading |
| 148 | `title="订阅作者"` | section heading |

### 2.2 Admin 页面 metadata.title（16 个文件）

每个 admin page 的 `export const metadata = { title: 'XXX管理' }` 硬编码中文。
仅在浏览器 tab 标题显示，优先级低。

- [ ] `app/(admin)/admin/drafts/page.tsx` — `'草稿管理'`
- [ ] `app/(admin)/admin/media/page.tsx` — `'媒体管理'`
- [ ] `app/(admin)/admin/comments/page.tsx` — `'评论管理'`
- [ ] `app/(admin)/admin/moments/page.tsx` — `'动态管理'`
- [ ] `app/(admin)/admin/categories/page.tsx` — `'分类管理'`
- [ ] `app/(admin)/admin/notifications/page.tsx` — `'通知管理'`
- [ ] `app/(admin)/admin/collections/page.tsx` — `'合集管理'`
- [ ] `app/(admin)/admin/ratings/page.tsx` — `'评分管理'`
- [ ] `app/(admin)/admin/feedbacks/page.tsx` — `'反馈管理'`
- [ ] `app/(admin)/admin/rankings/page.tsx` — `'榜单管理'`
- [ ] `app/(admin)/admin/users/page.tsx` — `'用户管理'`
- [ ] `app/(admin)/admin/api-keys/page.tsx` — `'API 密钥管理'`
- [ ] `app/(admin)/admin/topics/page.tsx` — `'话题管理'`
- [ ] `app/(admin)/admin/reports/page.tsx` — `'举报管理'`
- [ ] `app/(admin)/admin/shares/page.tsx` — `'分享管理'`
- [ ] `app/(admin)/admin/operations/page.tsx` — `'运营位管理'`

### 2.3 用户菜单硬编码 ✅ 已修复

- [x] `components/layout/user-menu.tsx` — `"语言"` → `t("settings.language")`
- [x] `components/layout/user-menu.tsx` — theme labels → `t("settings.system")` 等

### 2.4 zh-CN 翻译值质量 ✅ 已修复

- [x] "访达" → "文件管理器"（2处）
- [x] "集合" → "合集"（collections section 统一，~25处）
- [x] "派生" → "复刻"（5处）
- [x] "拥有者" → "所有者"（1处）
- [x] 中英混杂修复

---

## 三、翻译子 agent 状态 ✅ 全部完成

18 个语种各翻译了约 965 个新增 key：
de, es, fr, ja, ko, pt, it, ru, vi, th, tr, hi, id, nl, sv, pl, ms, uk
