# Page Preview Tab Frame 设计说明

## 目标

将桌面端主窗口的 `GlobalTabBar` 拆出可复用的浏览器式标签栏展示层，并让 `apps/desktop/page-preview-window.html` 对应的独立预览窗口接入同一套 tab frame 视觉与交互结构。

## 范围

- 抽出共享组件，承载标题栏高度、macOS traffic-light 预留、导航按钮区、标签区、拖拽空白区、右侧工具区和非 macOS 窗口控制区。
- `GlobalTabBar` 继续负责主窗口的 tab store、路由、拖拽排序和上下文菜单业务逻辑，只把布局外壳迁移到共享组件。
- `PagePreviewWindow` 使用共享组件渲染独立窗口顶部栏：后退、前进、刷新、当前页 tab、空白拖拽区、浏览器打开按钮、more 下拉菜单。
- preview window 当前只需要展示当前预览页的本地 tab，不接入主窗口全局 tab store，也不实现多个预览 tab 的持久化。

## 共享组件设计

新增 `BrowserTabFrame` 作为纯展示容器：

- 接收 `isMacOS`、`reserveMacOSControlsSpace`、`heightVariant`、`leadingControls`、`tabs`、`spacerMenu`、`rightControls`、`windowControls` 等插槽。
- 只负责布局和 drag region，不读取 Zustand store，不调用 router，不包含 preview 或主窗口业务。
- 维持主窗口现有视觉节奏：macOS 高度 32px，其他平台 40px，边框和 muted 背景沿用现有 `GlobalTabBar`。

新增轻量的 `BrowserTabFrameTab`：

- 用于非拖拽场景的标签展示，例如 preview window。
- 支持 icon、label、active、closable、onSelect、onClose。
- 主窗口仍使用现有 `SortableTabItem`，避免把 dnd-kit 依赖扩散到 preview window。

新增 `BrowserTabFrameIconButton`：

- 统一 titlebar 图标按钮尺寸、hover、disabled、aria-label 和 tooltip 包装。
- 主窗口和 preview window 都可复用。

## Preview Window 行为

顶部栏按用户给定结构实现：

```text
mac:
[x][-][[]] [<][>][refresh icon][[icon] tab1 x] [[icon] tab2 x] [ space ][browser icon] [more icon]
[ page ]
```

当前实现只有一个本地 tab。关闭该 tab 等价于关闭当前预览窗口。tab label 使用 page name，icon 优先用 page icon，缺省用 file/text 图标。

more 菜单使用 `DropdownMenu`，菜单项为：

- 刷新，快捷键 `⌘R`
- 复制链接
- 调整文字大小子菜单：标准大小 `⌘0`、放大 `⌘+`、缩小 `⌘-`
- 查找...，快捷键 `⌘F`
- 打印，快捷键 `⌘P`
- 分隔线
- 带 icon 的转发
- 分隔线
- 用默认浏览器打开
- 分隔线
- 浏览记录
- 下载内容，快捷键 `⌥⌘L`
- 关闭全部标签页，快捷键 `⌥⌘W`
- 打开上一个标签页，快捷键 `⌘⇧T`

首批接真实行为的项目：刷新、复制链接、用默认浏览器打开、浏览器 icon、关闭 tab。查找、打印、浏览记录、下载内容、打开上一个标签页在无现成能力时先禁用，保证菜单结构完整且不会误导成已完成能力。

```
[刷新        ⌘R]
[复制链接       ]
[调整文字大小 >]-> [标准大小       ⌘0]选中
                 [放大         ⌘+]
                 [缩小         ⌘-]
[查找...       ⌘F]
[打印       ⌘P]
----
[[icon] 转发       ]
----
[用默认浏览器打开]
----
[浏览记录      ]
[下载内容    ⌥⌘L]
[关闭全部标签页 ⌥⌘W]
[打开上一个标签页 ⌘⇧T]
```

## URL 与刷新

preview window 的当前可复制/外部打开 URL 根据页面类型计算：

- `static` HTML 或 iframe fallback：使用 gateway `/api/page/serve?workspace_path=...&slug=...&theme=...`。
- `server`：优先使用 live preview URL；如果服务尚未启动，则触发 start preview 后仍保持菜单项禁用，直到 URL 可用。
- `proxy`：使用 page 配置的目标 URL。
- `markdown` 或 skill view：使用当前 preview window 的地址作为可复制链接。

刷新通过递增 `iframeKey` 完成，并在 server page 时保留已有 `VitePreview` 行为。

## 验证

- 新增 jsdom 组件测试覆盖共享 tab frame 的插槽渲染、按钮点击和 tab close 事件隔离。
- 运行 desktop 相关 Vitest、`pnpm --filter @viben/desktop typecheck`。
- 如时间允许，运行 `pnpm --filter @viben/desktop build`；若受环境或既有 unrelated 改动影响，需要报告具体失败点。
