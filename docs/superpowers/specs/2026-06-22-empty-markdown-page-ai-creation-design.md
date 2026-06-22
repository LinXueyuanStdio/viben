# 空 Markdown 页面与 AI 创建入口阶段性设计

日期：2026-06-22

状态：阶段性确认。本文只记录本轮已经讨论并确认的设计，后续仍需继续讨论模板导入、AI 创建状态流、文件监听与测试细节。

## 原始要求

创建新页面时，不需要用户填详细的表格，直接创建一个新的 Markdown 文件，从 markdown 类型开始，并保持空内容（yaml front matter 可以根据需要添加），展示空页面时的 UI。

当打开一个 Markdown 文件时，当文件内容为空时，在 Markdown 编辑界面，icon 和 title 的下面，展示空页面 UI。

空页面 UI 是一个卡片：
```
+-----------------------------+
|             开始             |
+-----------------------------+
| 按 Enter 键开始编辑内容        |
| [从模板创建] [导入新页面| down triangle]    |
+-----------------------------+
| 使用 AI 助手创建 [文档* | 静态网页 | 全栈应用 ]           | <- 下面是一个卡片， 卡片里面是 acp-chat input
|【emoji| file | screenshot】 |
|【输入框，min lines =3 】|
|【[agent/provider/model selector][context approval status]     [submit button]】|
+-----------------------------+
```
点击“从模板创建页面”按钮时，弹出一个对话框，展示可用的模板列表，用户可以选择一个模板来创建页面。
```
[选择模板         x]
[ search icon ] 搜索模板
+-----------------------------+
| 模板列表                     |
| 模板1                        |
...
+-----------------------------+
```
点击“导入新页面”按钮时，弹出一个对话框，展示从网络连接导入或者从文件类型导入
```
[选择导入方式         x]
---
[[剪藏 icon] 从网络连接导入]
[[url 输入框] [[loading icon] 开始导入]] <- 爬虫爬取页面后，自动整理为 markdown 添加到 SKILL.md 中
---
[[markdown icon] 导入 Markdown 文件] <- 如果是 markdown 文件，将markdown 文件去除 front matter，将内容部分添加到 SKILL.md 中.
[[html icon] 导入 HTML 文件] <- 如果是 html 文件，自动变为 static 类型的 page，导入文件名称改为 index.html。SKILL.md 内容记录为：“从 /.../xxx.html 导入的页面”
```
使用 AI 助手创建 的右边是 segment button。用户在下面输入后点击 submit 后：
1. 空页面 UI 隐藏，显示创建中的 loading UI(就是 acp-chat 的 compact 模式)
    ```
    +-----------------------------+
    | [avatar] 使用 AI 助手创建 {文档} 中... |
    | [loading icon]【input】    [停止icon] |
    +-----------------------------+
    ```
    点击停止按钮时，停止创建，根据 SKILL.md 内容，决定是否还展示空页面 UI。
2. 进入创建中状态后，考虑：
   1. 生成文档：watch SKILL.md 文件内容变化，diff，anim到新状态，达到实时渲染blocks。此时loading UI 继续存在在最后一个 block 下面。滑动到上面时，loadingUI 粘滞在底部中间，直到用户点击 loading UI 右上角的 x 按钮（在 compact 模式里是 expanded 模式切换按钮）或者用户点击文档外部（边缘）区域，loading UI 消失。
   2. 生成静态网页：当发现 index.html 存在后，loading UI 消失，切换为 static preview 页面，然后让左侧的 acp-chat 切换到当前正在生成的 session 继续生成
   3. 生成全栈应用：当发现 package.json  和 vite.config.js 存在后，loading UI 消失，切换为 server preview 页面，然后让左侧的 acp-chat 切换到当前正在生成的 session 继续生成
3. 用户后续继续通过对话来指导内容生成。

## 背景

当前 Workspace Pages 已经支持 `static`、`markdown`、`server`、`proxy` 四类页面，并通过 `packages/core/src/page/ops/*` 提供页面能力。桌面端通过 Gateway API 使用这些能力，Markdown 类型页面由 `YooptaMarkdownRenderer` 渲染和编辑 `pages/<uid>/SKILL.md` 的正文内容。

现有问题是：创建页面时需要用户填写较多表单；Markdown 页面创建后默认写入标题和描述正文，因此无法自然进入“空页面”状态；当用户打开只有 YAML front matter、正文为空的 Markdown 页面时，编辑界面没有明确的空页面 UI，也无法从空页面直接进入模板、导入或 AI 创建流程。

本设计将“新建页面”和“空 Markdown 页面”的默认体验改成更直接的工作流：新建页面默认创建一个 Markdown 类型页面，保留必要 front matter，正文为空；当 Markdown 正文为空时，在标题和 icon 下方展示空页面 UI。

## 已确认的总体方案

采用方案 A：核心 page API 补齐 + Yoopta 内空态 + 复用 ACP ChatInput。

含义如下：

1. 页面创建、模板应用、导入等能力应归入 `packages/core` 的 page 边界，由桌面端通过正式 Gateway API 调用。
2. 桌面端不直接绕过 page 边界拼接 `SKILL.md`、`index.html` 或其他页面文件，除非后续设计明确某个局部可复用通用 files API。
3. 空页面 UI 放在 `YooptaMarkdownRenderer` 内部，因为该组件掌握 Markdown 正文、front matter 保留、编辑器 blocks、标题/icon/cover、保存状态和聚焦行为。
4. AI 创建输入区域复用现有 `@viben/chat` 的 `ChatInput` 结构，不重新实现一个相似但分叉的输入框。
5. 创建中状态复用现有 `ChatApp` compact 模式的语义：摘要 popup + compact ChatInput 单行输入/停止/发送。

不采用的方案：

1. 不采用“desktop 直接新建后 `update-content("")` 再用 files API 写文件”的快速方案。原因是它会绕过 `packages/core` 作为页面底层能力唯一边界，导致桌面端和未来 Web/CLI 行为分叉。
2. 不采用“只做空态 UI，模板/导入/AI 后置为壳”的极简方案。原因是用户期望的首屏工作流本身包含模板、导入和 AI 创建入口，空态 UI 的组件边界必须提前兼容这些入口。

## 当前代码上下文

页面核心能力位于：

1. `packages/core/src/page/ops/crud.ts`
2. `packages/core/src/page/ops/discovery.ts`
3. `packages/core/src/page/ops/templates.ts`
4. `packages/core/src/page/ops/serve.ts`
5. `packages/core/src/gateway/routes/page.ts`

桌面端页面能力位于：

1. `apps/desktop/src/hooks/use-pages.ts`
2. `apps/desktop/src/lib/gateway/modules/pages.ts`
3. `apps/desktop/src/lib/gateway/types/page.ts`
4. `apps/desktop/src/pages/apps/components/page-preview.tsx`
5. `apps/desktop/src/pages/apps/components/yoopta-markdown-renderer.tsx`
6. `apps/desktop/src/pages/apps/components/create-page-dialog.tsx`

聊天输入和 ACP 会话能力位于：

1. `packages/chat/src/chat-input/index.tsx`
2. `packages/chat/src/chat-input/top-toolbar.tsx`
3. `packages/chat/src/chat-input/bottom-toolbar.tsx`
4. `packages/chat/src/chat-input/types.ts`
5. `packages/chat/src/chat-app.tsx`
6. `apps/desktop/src/components/acp-chat/acp-chat.tsx`
7. `apps/desktop/src/components/acp-chat/use-acp-session.ts`
8. `apps/desktop/src/stores/acp-session-store.ts`

当前工作区已经有未提交改动，尤其是 ACP agent/provider/model 选择相关文件。后续实现必须基于现有 dirty worktree 谨慎处理，不回滚用户改动。

## 页面创建设计

新建页面时不再要求用户先填写详细表单。默认行为是直接创建 Markdown 类型页面。

新建结果：

1. 创建目录：`pages/<uid>/`
2. 创建文件：`pages/<uid>/SKILL.md`
3. `SKILL.md` 写入必要 YAML front matter。
4. Markdown 正文保持为空。
5. 页面类型为 `markdown`。

示例结构：

```markdown
---
name: "未命名"
metadata:
  page:
    type: markdown
    permission: [read, write]
---
```

是否需要额外 front matter 字段由实现阶段按现有 page config 解析规则确定，但正文部分必须为空。可以添加 `description`、`metadata.icon` 等字段，但不能写入 `# 未命名`、默认描述或占位正文。

为了支持这个行为，`createPage` 需要引入明确的空正文语义，例如：

```ts
empty_body?: boolean;
```

Gateway API 也应使用 snake_case：

```json
{
  "workspace_path": "...",
  "name": "未命名",
  "type": "markdown",
  "empty_body": true
}
```

`empty_body` 的具体命名可以在实现计划中最终确定，但必须遵守 API 命名约定：Gateway API 查询参数、请求体字段、YAML、Markdown、`task.json` 等文件存储均使用 snake_case。

## 空正文判定

空页面 UI 的显示条件不是简单判断 `skill_content` 是否存在，而是判断去掉 YAML front matter 后的 Markdown 正文是否为空。

判定规则：

1. 如果文件没有 front matter，则对整个文件内容 `trim()`。
2. 如果文件有 front matter，则移除开头 `--- ... ---` 块后，对剩余正文 `trim()`。
3. 如果结果为空字符串，则视为正文为空。
4. 如果正文包含任意非空字符，则视为非空。

这条规则已经确认：

> 如果文件只有 YAML front matter、没有正文，就显示空页面 UI；一旦正文有任意非空内容，就隐藏。

现有 `discovery` 在正文为空时可能把 `skill_content` 置为 `undefined`。后续实现需要保证 Markdown 页面即使正文为空，也能被正常 view，并让 renderer 获得可判断的空内容状态。`serve` 对空 Markdown 页面也不应返回“no content”错误；它可以返回空字符串或保持页面配置可用。

## 空页面 UI 放置位置

空页面 UI 放在 `YooptaMarkdownRenderer` 内。

放置位置：

1. 在 title/icon/cover 区域之后。
2. 在真正的 Yoopta editor 容器之前。
3. 不放进 Yoopta content blocks。
4. 不放在 `PagePreview` 里。

原因：

1. `YooptaMarkdownRenderer` 才知道当前内容是否为空、是否可编辑、editor children 是否为空。
2. 空态 UI 不应被保存进 `SKILL.md`。
3. `PagePreview` 只负责按页面类型选择预览/编辑组件，继续保持轻量。
4. Yoopta 的 selection box 会影响编辑容器内的 mouse down 行为，空态卡片应避开容易触发编辑器内部选择逻辑的位置。

## 空页面 UI 结构

视觉方向已通过 companion v2 确认。空态卡片不是营销页，也不是独立 landing，而是 Markdown 编辑器中的工作入口。

空态 UI 位于 Markdown 页面标题/icon 下方，是一个边框卡片，结构如下：

```text
+-----------------------------+
|             开始             |
+-----------------------------+
| 按 Enter 键开始编辑内容       |
| [从模板创建] [导入新页面 ▾]   |
+-----------------------------+
| 使用 AI 助手创建 [文档 | 静态网页 | 全栈应用] |
| <复用 ChatInput expanded 布局> |
+-----------------------------+
```

第一段为手动入口：

1. 文案：`按 Enter 键开始编辑内容`
2. 按钮：`从模板创建`
3. 按钮/菜单：`导入新页面 ▾`

第二段为 AI 入口：

1. 标题：`使用 AI 助手创建`
2. 右侧 segmented control：`文档`、`静态网页`、`全栈应用`
3. 默认选中：`文档`
4. 输入区使用 expanded `ChatInput` 结构：
   - `ChatInputTopToolbar`
   - 多行输入，视觉上最小约 3 行
   - `ChatInputBottomToolbar`
   - 左侧放 agent/provider/model selector 和 context approval 状态
   - 右侧放 submit 按钮

视觉必须贴合现有 `@viben/chat`：

1. expanded `ChatInput` 是三段式：top toolbar、editor、bottom toolbar。
2. top toolbar 包含 emoji、file、screenshot 等图标动作。
3. bottom toolbar 通过 `leftContent` 承载 agent/provider/model selector、context approval、voice 等控制。
4. submit/stop 使用现有 `ChatInputSubmitControl` 风格。

## Enter 开始编辑行为

当正文为空时，用户可以按 Enter 开始编辑。

触发位置：

1. 标题输入处按 Enter。
2. 空态卡片中“按 Enter 键开始编辑内容”区域可点击或聚焦后按 Enter。

行为：

1. 如果 editor 当前没有 blocks，创建一个空 `Paragraph` block。
2. 调用现有可靠聚焦工具，例如 `ensureBlockFocus`，把光标放入新段落。
3. 如果 editor 已经有一个空 Paragraph，则直接聚焦它。
4. 这个聚焦动作不应主动保存正文。
5. 只有用户实际输入内容后，才触发 autosave。

原因：

现有 title Enter 仅调用 `editor.focus()`。Yoopta 在没有 block 时无法聚焦，所以需要显式创建/聚焦空段落。

## 空内容加载与清空行为

现有 renderer 只在 `content` truthy 时反序列化：

```ts
if (content && content !== lastContentRef.current) {
  ...
}
```

这会带来两个问题：

1. `content=""` 时不会清空 editor。
2. 同一个 renderer 从非空页面切换到空页面时，可能残留上一页 blocks。

后续实现需要把“空内容”作为有效输入处理：

1. 当 `content` 是空字符串时，也应更新 `lastContentRef`。
2. 应清空 editor children。
3. 应正确设置 `frontmatterRef`。
4. frontmatter-only 内容应保留 frontmatter，正文解析为空 blocks。

这部分是空态 UI 正确性的基础，不是可选优化。

## 空态隐藏与恢复

空态 UI 隐藏条件：

1. 用户手写正文后隐藏。
2. 从模板创建后正文非空则隐藏。
3. 导入 Markdown 或网络内容后正文非空则隐藏。
4. AI 写入文档正文后隐藏。
5. AI 创建静态网页或全栈应用并切换页面类型/预览后，Markdown 空态不再作为主界面显示。

空态 UI 恢复条件：

1. 当前页面仍是 Markdown 编辑界面。
2. 正文再次变为空。
3. AI 创建被停止，且 `SKILL.md` 正文仍为空。
4. 模板/导入失败且没有写入正文。

## AI 创建初始输入区

AI 创建的初始输入区复用 `ChatInput` expanded 布局。

它需要的能力：

1. 支持 emoji。
2. 支持附件。
3. 支持截图。
4. 支持多行输入，视觉最小约 3 行。
5. 支持 agent/provider/model selector。
6. 支持 context approval 状态和设置入口。
7. 支持 submit。
8. 输入为空时 submit disabled。
9. agent 未连接或不可用时显示现有 send-disabled/blocked 状态。

不重新实现这些控件，优先复用：

1. `ChatInput`
2. `ChatInputTopToolbar`
3. `ChatInputBottomToolbar`
4. `ChatInputSubmitControl`
5. ACP Chat 中已有的 triple selector/context approval 组合

## AI 创建中 compact UI

用户在空态 AI 输入区提交后：

1. 空页面 UI 隐藏。
2. 页面进入创建中状态。
3. 显示创建中的 loading UI。

创建中 UI 使用 compact 语义：

```text
+-----------------------------+
| [avatar] 使用 AI 助手创建 {文档} 中... |
| [loading icon] input [停止 icon] [submit] |
+-----------------------------+
```

它应贴近现有 `ChatApp` compact 模式：

1. 上方是 `AgentPopup` 风格摘要区域。
2. 下方是 `ChatInput layoutVariant="compact"` 风格的单行输入。
3. compact input 左侧是 `+` 附件入口。
4. 运行中显示停止按钮。
5. 允许用户继续发送/排队 steer prompt。
6. 可展开到完整聊天。

停止按钮：

1. 调用 ACP `interrupt()` 或等价 session interrupt 能力。
2. 停止后根据当前 `SKILL.md` 正文是否为空决定是否恢复空态 UI。
3. 如果已有正文，不恢复空态。

## ACP 会话边界

AI 创建应复用现有 ACP 会话系统，不新建独立传输层。

已确认的现有能力：

1. `useAcpSession()` 提供 `createSession`、`sendPrompt`、`sendSteerPrompt`、`interrupt`、`selectSession`。
2. ACP session 状态存放在全局 store。
3. 左侧 chat 使用 `AcpChat` full 模式时，也读取同一个 active session。

设计方向：

1. 空页面 AI 创建提交时，创建或选择一个 ACP session。
2. 将页面上下文、目标页面路径、创建模式写入 prompt。
3. 发送用户输入。
4. 保存生成 session id，作为当前页面的创建中 session。
5. 当用户后续展开或切换到左侧 chat 时，调用 `selectSession(session_id)` 并切换 chat mode。
6. 左侧 ACP chat 继续同一个 session，不创建第二条会话。

注意：

当前 ACP agent/provider/model 选择相关文件有未提交改动，后续实现必须以当时工作区状态为准，不能回滚这些改动。

## 已确认但待继续细化的内容

以下内容属于本需求范围，但还没有完成详细设计，后续继续讨论：

1. 模板创建对话框的具体数据流。
2. `template_id` 如何从 Gateway create route 传到 `createPage`。
3. 内置模板 frontmatter 从旧 `page:` 结构迁移到 `metadata.page` 的兼容策略。
4. 导入新页面对话框中 URL、Markdown 文件、HTML 文件三种导入方式的 API 设计。
5. URL 抓取和 HTML 转 Markdown 的执行位置、依赖和错误处理。
6. HTML 文件导入后页面类型如何从 Markdown 切换到 `static`，以及 `index.html` 如何写入。
7. AI 创建文档时如何 watch `SKILL.md` 变化、diff 并实时渲染 blocks。
8. AI 创建静态网页时如何检测 `index.html` 出现并切换 static preview。
9. AI 创建全栈应用时如何检测 `package.json` 和 `vite.config.js` 出现并切换 server preview。
10. compact loading UI 的粘滞底部行为、关闭行为和点击文档边缘隐藏行为。
11. 测试矩阵和验证命令。

## 当前阶段设计结论

当前已经定下来的设计结论：

1. 新建页面默认创建 Markdown 页面。
2. 新建 Markdown 页面正文为空，只写必要 YAML front matter。
3. 空页面 UI 的显示条件是：去掉 YAML front matter 后正文为空。
4. 正文一旦有任意非空内容，空页面 UI 隐藏。
5. 空态 UI 位于 `YooptaMarkdownRenderer`，不保存为 Markdown blocks。
6. Enter 开始编辑需要创建/聚焦空 Paragraph，不能只调用 `editor.focus()`。
7. 空内容本身必须被 renderer 当作有效输入处理，避免残留上一页 blocks。
8. 空态初始 AI 输入复用 expanded `ChatInput`。
9. 创建中 UI 复用 compact `ChatApp`/`ChatInput` 语义。
10. AI 创建会话复用 ACP session/store，后续左侧 chat 切换到同一个 session。

## 实施约束

1. 所有 Gateway API 字段使用 snake_case。
2. 不使用 inline `import("path").TypeName` 类型写法。
3. 不使用非必要动态 import。
4. `packages/core` 是页面底层能力边界，desktop 不应私自复制核心页面逻辑。
5. 编辑文件时使用绝对路径。
6. 后续实现必须运行 `pnpm build` 或 `pnpm typecheck` 做验证。
7. 不能回滚当前工作区中已有的未提交用户改动。

