---
page:
  type: static
  file: index.html
  permission: [read, write]
name: "Desktop Action System"
description: "desktop chat popup 到 GUI_execute 本地 action 执行和 agent 回答的完整链路说明"
icon:
  type: lucide
  value: route
---

# Desktop Action System

说明 desktop 的 action system 从 chat popup 用户输入 query 开始，到 agent 调用 GUI_execute、前端执行本地 action、gateway 回填 tool result、agent 继续回答的完整链路。
