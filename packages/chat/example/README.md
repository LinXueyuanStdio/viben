# @viben/chat example

这个 example 主要用于验证 `@viben/chat` 的消息列表、输入框、Claude Code session 回放，以及 `ChatApp` 在 `floating -> compact -> expanded -> full` 四种模式之间的状态转换。

## ChatApp expanded/full 动画实现要点

- `App.tsx` 负责页面级布局和模式时序，`ChatApp.tsx` 负责聊天窗口本身的共享元素动画。
- `expanded -> full` 不直接把 `ChatApp` 重挂到 full 栏里。先显示空的 `fullscreen-chat-dock`，让 full 区域立即占位并撑开布局；短延迟后再把 `ChatApp` 切到 `full` 模式。
- 非 full 状态的 `chat-app-stage` 挂在 example shell 的绝对定位层上，并用左侧 sidebar 宽度计算 `left`，避免 full dock 插入时把 expanded 源窗口先挤到右侧。
- 外层窗口使用同一个 `layoutId="viben-overlay-surface"`，让 expanded 悬浮窗口和 full dock 窗口之间走 Framer Motion shared layout。
- ChatApp 内部关键区域也走共享元素动画：
  - header: `layoutId="viben-overlay-header"`
  - message panel: `layoutId="viben-overlay-message-panel"`
  - input panel: `layoutId="viben-overlay-input-panel"`
- 不使用 `scale` 做 expanded/full 过渡，避免整体 UI 被缩放导致文字、边框和输入框变形。
- `fullscreen_chat_width` 记忆在 `localStorage`，进入 full 前先按当前 sidebar 宽度 clamp，保证 dock 预占位和最终 full 宽度一致。
- `expanded` 和 `full` 共用 header、message panel、chat input 配置，减少两种模式之间的结构差异，让共享元素动画更稳定。

## 验证命令

```bash
pnpm --dir /root/viben/packages/chat/example exec vitest run src/App.test.tsx src/ChatApp.test.tsx --reporter=dot
pnpm --dir /root/viben/packages/chat/example exec tsc --noEmit --pretty false
pnpm --dir /root/viben/packages/chat typecheck
pnpm --dir /root/viben/packages/chat/example build
```
