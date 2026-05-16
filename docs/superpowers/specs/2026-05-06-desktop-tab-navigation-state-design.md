# Desktop Tab Navigation State 同步修正规格

## 问题

Desktop 当前有两份“当前页面状态”：

- tab bar 读 `PageTab.label/icon/descriptorId/meta`
- breadcrumb、router、页面内容读 `PageTab.navigationHistory[historyIndex]`

当 tab back/forward、history jump、breadcrumb 跳转只移动或改写 `navigationHistory` 时，tab 标题/图标会和 breadcrumb、URL、页面内容脱节。

典型链路：

```text
sidebar 点击「智能体」
  -> 进入智能体列表
  -> 右侧选中「个人助手」      // 页面局部选择，不写导航
  -> 点击「编排」              // 进入子页面，写 tab history
```

## 目标

1. 当前页面状态唯一来源是 `navigationHistory[historyIndex]`。
2. tab 标题/图标、breadcrumb、router URL、复制链接、detach window 都从当前 entry 派生。
3. 明确 sidebar replace、页面子导航 push、breadcrumb 祖先段跳转、tab back/forward 的行为。
4. 完整迁移到新 tab state；旧 persisted tab state 不兼容，且不做 migrate。

## 非目标

1. 不重写 React Router。
2. 不改变 `DesktopLocation` 外部语义。
3. 不把列表选中态提升为导航状态。
4. 不引入数据库或服务端导航状态。

## 现有概念边界

- `DesktopLocation`：canonical route state。所有 URL 生产方只能用 `locationToUrl(current.location)`。
- `TabNavigationState`：tab history entry，包含 `location`、`breadcrumbStack`、必要的 `activeNodeId/activeIndexPath`。
- `breadcrumbStack`：当前 entry 的页面路径快照，也是 breadcrumb 主链路、tab leaf、history menu label 的来源。每段可以携带 `target/location`。
- `PageTab`：tab 容器，只负责 `id/pinned/historyIndex/navigationHistory/viewMode` 等 tab 状态。

`activeNodeId/activeIndexPath` 是可恢复的页面定位上下文，不等同于普通列表选中态。

`PageTab.label/icon/descriptorId/meta/history` 在目标代码中不存在。新代码不读取旧 persisted tab state，不提供 migrate。

## 硬性不变量

1. 任意 `PageTab`，包括 `recentlyClosedTabs[].tab`，都必须是新结构且有合法 `navigationHistory[historyIndex]`。
2. tab 标题/图标只从当前 `breadcrumbStack.at(-1)` 派生。
3. breadcrumb 的 root、segments、leaf 都从当前 `breadcrumbStack` 派生。
4. router、copy link、detach window 只从当前 `location` 派生；current entry 不合法是数据错误，不允许 fallback 到旧 URL history。
5. `goBack/goForward/jumpToHistory` 只改 `historyIndex`。
6. `push/replace/openTab/restore/duplicate` 等运行时动作不得写 `PageTab.label/icon/descriptorId/meta/history`；这些字段在目标类型中不存在。

## 导航语义

| 入口 | 动作 | history 行为 | breadcrumb 行为 | forward 处理 |
| --- | --- | --- | --- | --- |
| sidebar / 顶部主路径 / workspace 首页入口 | `replace` | 替换当前 entry，不新增 entry | 使用目标 `DesktopLocation` 重新 resolve 出完整 stack | 替换后截断当前 index 之后的 forward |
| 页面内进入详情、编排、设置、web wrapper | `push` | 截断 forward 后追加新 entry | 基于当前 stack 追加子段，或使用显式完整 stack | 截断旧 forward |
| 点击 breadcrumb 祖先段 | `popTo` | 优先跳到当前 index 之前匹配该目标的 entry；找不到时把目标 entry 插到当前 entry 之前并选中它 | stack 截断到被点击段 | 不截断 forward，forward 应回到原子页面 |
| tab back/forward/history menu | `jump` | 只移动 `historyIndex` | 当前 entry 自然变化 | 不改写 history |

### sidebar replace

点击左侧 sidebar「智能体」：

```text
openWorkspaceSection(workspaceId, "agent")
  -> resolveLocationNavigation(workspace-section(agent))
  -> replace 当前 entry
```

结果：

```text
location = workspace-section(agent)
breadcrumbStack = [workspace, 智能体]
tab leaf = 智能体
breadcrumb = workspace / 智能体
```

`replace` 到新 `DesktopLocation` 必须使用新 location resolve 出的完整 `breadcrumbStack`。除非是刷新当前同一 location 的展示快照，否则不得默认继承旧 stack。

若现有入口保留 `stackMode: "push"`，只能用于明确的页面子导航场景；sidebar/top-level path 不允许使用它。

### 页面子导航 push

在智能体列表选中「个人助手」只是页面局部 state，不改变 tab、breadcrumb、URL。

点击右侧「编排」：

```text
openWorkspaceAgentDetail(workspaceId, agent.id, { title: agent.name })
  -> openChildLocation(...)
  -> push 新 entry
```

结果：

```text
location = workspace-agent-detail(agent.id)
breadcrumbStack = [workspace, 智能体, 个人助手]
tab leaf = 个人助手
breadcrumb = workspace / 智能体 / 个人助手
```

实体详情页 leaf label 优先使用已知实体名称；没有名称时才 fallback 到 id。

### breadcrumb 祖先段 popTo

当前为：

```text
history = [workspace / 智能体, workspace / 智能体 / 个人助手]
historyIndex = 1
```

点击 breadcrumb 的「智能体」后：

```text
historyIndex = 0
current = workspace / 智能体
forward = workspace / 智能体 / 个人助手
```

如果当前 history 中没有祖先 entry，例如新 tab 直接打开了 `workspace / 智能体 / 个人助手`，点击「智能体」时插入祖先 entry：

```text
before: [workspace / 智能体 / 个人助手] @0
after:  [workspace / 智能体, workspace / 智能体 / 个人助手] @0
```

这样 breadcrumb 祖先跳转后，tab forward 仍能回到原子页面。之后如果用户从「智能体」进入另一个子页面，按普通 `push` 规则截断旧 forward。

### tab back/forward

`goBack`、`goForward`、`jumpToHistory(index)` 只移动 `historyIndex`。tab 标题、breadcrumb、URL、页面内容都因 current entry 改变而同步变化，不需要额外同步写入。

## Header 约束

只要 current entry 合法：

- 主 breadcrumb 的 workspace/root/segments/leaf 全部来自当前 `breadcrumbStack`
- `WorkspaceHeader segments` / `setHeader({ segments })` 不参与主 breadcrumb
- center/right slot、刷新按钮、工具栏、className 可继续由页面注册

registered `segments` 只允许作为异常空状态 fallback，不是正常兼容路径。

## Persisted State 约束

`navigateTo(url, input)`、`openTab` 只能接收新结构输入。旧 persisted tab state 不兼容，也不做字段级转换或 migrate。

```text
new persist key -> only new PageTab state
old persist key -> ignored
```

规则：

1. 使用新的 persist storage key，或在启动前显式清空旧 `viben-tab-store`。
2. 不实现 Zustand `migrate`。
3. 不读取旧 `label/icon/descriptorId/meta/history/target/sourceNodeId/parentNodeId`。
4. 新 persisted state 必须已经是新结构。
5. 新 persisted state 中出现非法 tab 时，视为数据错误，可丢弃该 tab，但不得读取旧字段修复。

`recentlyClosedTabs` 规则：

- 旧 key 内的 `recentlyClosedTabs` 被忽略
- close 时写入的 snapshot 必须已经是新结构
- restore 时只读 `navigationHistory[historyIndex]`
- `originIndex/pinned/historyIndex` 只在新结构内保持稳定语义

## 验收

1. sidebar 点击「智能体」后当前 tab replace 到 `workspace / 智能体`，tab、breadcrumb、URL、页面内容一致。
2. 选中「个人助手」不改变导航；点击「编排」后 push 到 `workspace / 智能体 / 个人助手`。
3. 点击 breadcrumb 的「智能体」后跳回列表，tab forward 能回到「个人助手」。
4. tab back/forward/history menu 任意跳转后，tab leaf、breadcrumb leaf、URL、页面内容一致。
5. 从 breadcrumb 回到父级后进入另一个子页面，会截断旧 forward 并追加新 entry。
6. copy link、detach window 始终使用 current `location`。
7. 页面注册 header segments 时不能覆盖 current `breadcrumbStack`。
8. 旧 persisted tabs 和 `recentlyClosedTabs` 不被读取，二次启动不再出现旧字段。

## 迁移顺序

1. 切换 persist storage key 或清空旧 key；不实现 migrate，新 key 只保存新结构。
2. 改 tab bar、history menu、router、copy link、detach window 的读取源为 current entry。
3. 删除运行时 `PageTab.label/icon/descriptorId/meta/history` 类型和写入路径。
4. 落地四类导航语义：top-level replace、child push、breadcrumb popTo、history jump。
5. 降低 header segments 优先级，主 breadcrumb 只认 current `breadcrumbStack`。
6. 修复智能体「编排」入口传实体名称，并逐步让 resolver 从缓存解析实体名称。
7. 补 store 与交互测试覆盖验收项。
