# S2: 举报 + 反馈

## 概述

为阅读模式 topbar 的 ReadMoreMenu 中的举报和反馈按钮实现完整功能。举报关联当前阅读页面，反馈关联当前页面并包含分类和评分。

## 当前状态

`components/layout/topbar.tsx` 中 `ReadMoreMenu` 的举报和反馈按钮只弹出 toast 提示"开发中"。

## 设计

### 前端

#### ReadMoreMenu 修改

- 举报按钮：打开 `ReportDialog`，传入当前 `pageId` 和 `entityType: "published_page"`
- 反馈按钮：打开 `FeedbackDialog`，传入当前 `pageId`

#### ReportDialog

弹窗内容：
- 下拉选择举报原因（必选）：
  - 垃圾内容（spam）
  - 不当内容（inappropriate）
  - 版权问题（copyright）
  - 安全问题（security）
  - 其他（other）
- 文本框：补充说明（选填，最多 500 字）
- 提交按钮：POST `/api/reports`
- 成功后 toast 提示，关闭弹窗

#### FeedbackDialog

弹窗内容：
- 下拉选择分类（必选）：
  - Bug 反馈
  - 功能建议
  - 其他
- 1-5 星评分（必选）
- 文本框：详细描述（必填，最多 1000 字）
- 提交按钮：POST `/api/feedbacks`
- 成功后 toast 提示，关闭弹窗

#### 权限

- 举报和反馈均需登录
- 未登录时点击按钮跳转登录页

### 后端

#### 数据库

修改 `reports` 表 entity_type enum：追加 `published_page`

新增 `feedbacks` 表：
```sql
feedbacks (
  id            text primary key,
  page_id       text not null,              -- 关联的 published_page uid
  reporter_id   text not null references users(id),
  category      text not null,              -- 'bug' | 'suggestion' | 'other'
  rating        integer not null,           -- 1-5
  content       text not null,
  created_at    timestamp default now()
)
```

#### POST /api/reports

- 接收：`{ entity_type: "published_page", entity_id: string, reason: string, description?: string }`
- 插入 `reports` 表
- 返回：`{ id, status: "pending" }`

#### POST /api/feedbacks

- 接收：`{ page_id: string, category: string, rating: number, content: string }`
- 插入 `feedbacks` 表
- 返回：`{ id }`

## 涉及文件

| 层 | 文件 | 操作 |
|----|------|------|
| UI | `components/layout/topbar.tsx` | 修改（ReadMoreMenu 按钮绑定） |
| UI | `components/content/report-dialog.tsx` | 新增 |
| UI | `components/content/feedback-dialog.tsx` | 新增 |
| DB | `lib/db/schema.ts` | 修改（reports enum）+ 新增（feedbacks 表） |
| API | `app/api/reports/route.ts` | 新增 |
| API | `app/api/feedbacks/route.ts` | 新增 |

## 不在范围内

- 举报和反馈的后台管理界面（admin panel）
- 举报自动处理/通知管理员
- 反馈回复功能

## i18n

需要新增的 key（zh-CN）：
- `community.report` — "举报"
- `community.reportReason` — "举报原因"
- `community.reportDescription` — "补充说明（选填）"
- `community.reportSubmit` — "提交举报"
- `community.reportSuccess` — "举报已提交"
- `community.feedback` — "反馈"
- `community.feedbackCategory` — "反馈类型"
- `community.feedbackRating` — "评分"
- `community.feedbackContent` — "详细描述"
- `community.feedbackSubmit` — "提交反馈"
- `community.feedbackSuccess` — "反馈已提交，感谢！"
- `community.reportReasonSpam` — "垃圾内容"
- `community.reportReasonInappropriate` — "不当内容"
- `community.reportReasonCopyright` — "版权问题"
- `community.reportReasonSecurity` — "安全问题"
- `community.reportReasonOther` — "其他"
- `community.feedbackCategoryBug` — "Bug 反馈"
- `community.feedbackCategorySuggestion` — "功能建议"
- `community.feedbackCategoryOther` — "其他"
