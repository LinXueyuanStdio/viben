# Assistant Session Starter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `/assistant` 空页面改造成带 Viben Assistant 欢迎标识的完整首消息输入入口，并在创建空白或仓库 session 后自动发送文本、附件和语音转写内容。

**Architecture:** 把正式对话页底部输入框抽成受控的 `AssistantPromptComposer`，由欢迎页与正式对话页共享。欢迎页创建 session 后把首消息存入以 `chatId` 为键的一次性内存交接区；正式对话运行时消费草稿、应用模型并复用现有发送链路，失败时恢复草稿。

**Tech Stack:** Next.js 15、React 19、TypeScript、Tailwind CSS v4、Radix Popover、Vitest、Testing Library、react-i18next

## Global Constraints

- 所有编辑命令使用绝对路径。
- Gateway API 查询参数与文件存储字段使用 `snake_case`；本功能不新增 Gateway API。
- TypeScript 类型只使用文件顶部的显式 `import type`，禁止 `import("path").TypeName`。
- 禁止新增 `await import()` 动态导入；现有可选依赖例外不适用于本功能。
- 使用现有 oklch 语义变量时直接引用变量或 Tailwind 语义类，禁止 `hsl(var(--background))` 形式。
- `agent` 的简体中文为“智能体”，`token` 的简体中文为“词元”。
- 不在仓库根目录运行 `pnpm build` 或 `pnpm typecheck`；只在 `apps/web` 内执行。
- 不新增后端复合接口，不修改消息或流式响应协议。
- 欢迎页不展示上下文用量；正式页保留现有上下文用量、停止生成与内联提问能力。

## File Structure

- Create: `apps/web/components/assistant/starter-message-handoff.ts` — 定义首消息草稿类型和一次性 `put/take` 内存交接。
- Test: `apps/web/components/assistant/starter-message-handoff.test.ts` — 验证按 chat 隔离、一次消费和覆盖语义。
- Create: `apps/web/components/assistant/chat-message-payload.ts` — 统一文本、图片 file parts 与文本 snippet parts 的消息 payload 构造。
- Test: `apps/web/components/assistant/chat-message-payload.test.ts` — 验证纯文本、图片和 snippet payload。
- Create: `apps/web/components/assistant/assistant-prompt-composer.tsx` — 欢迎页和正式对话页共享的受控输入框卡片。
- Test: `apps/web/components/assistant/assistant-prompt-composer.test.tsx` — 验证输入、附件、模型、语音和发送交互。
- Modify: `apps/web/components/assistant/session-chat-content.tsx` — 使用共享输入框、共享 payload 构造器，并消费首消息交接。
- Modify: `apps/web/hooks/assistant/use-text-attachments.ts` — 支持批量恢复文本附件。
- Test: `apps/web/hooks/assistant/use-text-attachments.test.ts` — 验证失败恢复所需的批量添加。
- Modify: `apps/web/components/assistant/session-starter.tsx` — 实现欢迎卡片、模型/附件/语音状态和 repo popover。
- Test: `apps/web/components/assistant/session-starter.test.tsx` — 验证模式、popover 取消、Cloud 导航和提交草稿。
- Modify: `apps/web/components/assistant/sessions-index-shell.tsx` — 创建 session 后写入交接区并跳转。
- Test: `apps/web/components/assistant/sessions-index-shell.test.tsx` — 验证创建失败保留页面、成功写入并跳转。
- Modify: `apps/web/lib/i18n/locales/en.json` — 新增欢迎页和可访问文案。
- Modify: `apps/web/lib/i18n/locales/zh-CN.json` — 新增对应简体中文文案。

---

### Task 1: 首消息草稿与消息 Payload

**Files:**
- Create: `apps/web/components/assistant/starter-message-handoff.ts`
- Test: `apps/web/components/assistant/starter-message-handoff.test.ts`
- Create: `apps/web/components/assistant/chat-message-payload.ts`
- Test: `apps/web/components/assistant/chat-message-payload.test.ts`

**Interfaces:**
- Consumes: `ImageAttachment` from `@/lib/image-utils`、`TextAttachment` from `@/lib/text-attachment-utils`、`FileUIPart` from `ai`。
- Produces: `StarterMessageDraft`、`putStarterMessage(chatId, draft)`、`takeStarterMessage(chatId)`、`buildChatMessagePayload(input)`。

- [ ] **Step 1: 为一次性交接写失败测试**

```ts
import { describe, expect, test } from "vitest";
import {
  putStarterMessage,
  takeStarterMessage,
  type StarterMessageDraft,
} from "./starter-message-handoff";

const draft: StarterMessageDraft = {
  text: "Build the dashboard",
  images: [],
  textAttachments: [],
  modelId: "openai/gpt-5",
};

describe("starter message handoff", () => {
  test("returns a draft exactly once for its chat", () => {
    putStarterMessage("chat-1", draft);
    expect(takeStarterMessage("chat-1")).toEqual(draft);
    expect(takeStarterMessage("chat-1")).toBeNull();
  });

  test("keeps drafts isolated by chat id", () => {
    putStarterMessage("chat-1", draft);
    expect(takeStarterMessage("chat-2")).toBeNull();
    expect(takeStarterMessage("chat-1")).toEqual(draft);
  });
});
```

- [ ] **Step 2: 运行测试并确认因模块缺失而失败**

Run: `cd /mnt/aime/datasets/linxueyuan/viben/apps/web && pnpm test:run components/assistant/starter-message-handoff.test.ts`

Expected: FAIL，提示无法解析 `./starter-message-handoff`。

- [ ] **Step 3: 实现最小一次性交接模块**

```ts
import type { ImageAttachment } from "@/lib/image-utils";
import type { TextAttachment } from "@/lib/text-attachment-utils";

export interface StarterMessageDraft {
  text: string;
  images: ImageAttachment[];
  textAttachments: TextAttachment[];
  modelId: string | null;
}

const drafts = new Map<string, StarterMessageDraft>();

export function putStarterMessage(chatId: string, draft: StarterMessageDraft) {
  drafts.set(chatId, draft);
}

export function takeStarterMessage(chatId: string) {
  const draft = drafts.get(chatId) ?? null;
  drafts.delete(chatId);
  return draft;
}

```

- [ ] **Step 4: 为统一 payload 构造写失败测试**

```ts
import { describe, expect, test } from "vitest";
import { buildChatMessagePayload } from "./chat-message-payload";

describe("buildChatMessagePayload", () => {
  test("uses text/files shape when there are no snippets", () => {
    const files = [{ type: "file", mediaType: "image/png", url: "data:image/png;base64,AA==" }] as const;
    expect(buildChatMessagePayload({ text: "look", files: [...files], textAttachments: [] })).toEqual({
      text: "look",
      files,
    });
  });

  test("uses parts shape when text snippets are present", () => {
    const result = buildChatMessagePayload({
      text: "review",
      files: [],
      textAttachments: [{ id: "snippet-1", content: "const x = 1", filename: "snippet.ts", lineCount: 1, byteSize: 11 }],
    });
    expect(result).toMatchObject({
      parts: [
        { type: "text", text: "review" },
        { type: "data-snippet", id: "snippet-1", data: { content: "const x = 1", filename: "snippet.ts" } },
      ],
    });
  });
});
```

- [ ] **Step 5: 运行 payload 测试并确认因模块缺失而失败**

Run: `cd /mnt/aime/datasets/linxueyuan/viben/apps/web && pnpm test:run components/assistant/chat-message-payload.test.ts`

Expected: FAIL，提示无法解析 `./chat-message-payload`。

- [ ] **Step 6: 实现最小 payload 构造并运行两个测试**

实现 `buildChatMessagePayload({ text, files, textAttachments })`：无 snippet 时返回 `{ text, files: files.length ? files : undefined }`；有 snippet 时按 text、files、`data-snippet` 顺序返回 `{ parts }`。使用顶部显式类型导入，返回类型与 `WebAgentUIMessage["parts"]` 兼容。

Run: `cd /mnt/aime/datasets/linxueyuan/viben/apps/web && pnpm test:run components/assistant/starter-message-handoff.test.ts components/assistant/chat-message-payload.test.ts`

Expected: 2 个文件全部 PASS。

- [ ] **Step 7: 提交 Task 1**

```bash
git add apps/web/components/assistant/starter-message-handoff.ts apps/web/components/assistant/starter-message-handoff.test.ts apps/web/components/assistant/chat-message-payload.ts apps/web/components/assistant/chat-message-payload.test.ts
git commit -m "feat(web): add starter message handoff"
```

### Task 2: 可复用 Assistant 输入框

**Files:**
- Create: `apps/web/components/assistant/assistant-prompt-composer.tsx`
- Test: `apps/web/components/assistant/assistant-prompt-composer.test.tsx`
- Modify: `apps/web/components/assistant/session-chat-content.tsx`

**Interfaces:**
- Consumes: `ModelOption`、`ImageAttachment`、`TextAttachment`，以及由父组件持有的 input/attachment/audio 状态。
- Produces: `AssistantPromptComposer`。核心 props 为 `value`、`onValueChange`、`onSubmit`、`images`、`textAttachments`、附件回调、`modelId`、`modelOptions`、`onModelChange`、`recordingState`、`onMicClick`、`disabled`、`submitting`；`leadingToolbarContent`、`submitControl`、`inputOverlay` 和 `questionHeader` 为正式页可选插槽。

- [ ] **Step 1: 写共享输入框的失败组件测试**

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { AssistantPromptComposer } from "./assistant-prompt-composer";

test("exposes text, attachment, model, voice and submit controls", () => {
  const onValueChange = vi.fn();
  const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
  render(
    <AssistantPromptComposer
      value="hello"
      onValueChange={onValueChange}
      onSubmit={onSubmit}
      placeholder="Ask Viben"
      images={[]}
      textAttachments={[]}
      onRemoveImage={vi.fn()}
      onRemoveTextAttachment={vi.fn()}
      onAddImages={vi.fn()}
      onAddLargeText={vi.fn()}
      onOpenFilePicker={vi.fn()}
      modelId="model-1"
      modelOptions={[{ id: "model-1", label: "Model 1", shortLabel: "Model 1", provider: "openai" }]}
      onModelChange={vi.fn()}
      recordingState="idle"
      onMicClick={vi.fn()}
      disabled={false}
      submitting={false}
      canSubmit
    />,
  );
  fireEvent.change(screen.getByPlaceholderText("Ask Viben"), { target: { value: "next" } });
  fireEvent.click(screen.getByRole("button", { name: /send/i }));
  expect(onValueChange).toHaveBeenCalledWith("next");
  expect(onSubmit).toHaveBeenCalledOnce();
  expect(screen.getByRole("button", { name: /attach/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /voice/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /model/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: 运行测试并确认因组件缺失而失败**

Run: `cd /mnt/aime/datasets/linxueyuan/viben/apps/web && pnpm test:run components/assistant/assistant-prompt-composer.test.tsx`

Expected: FAIL，提示无法解析 `./assistant-prompt-composer`。

- [ ] **Step 3: 实现共享组件的最小可用结构**

组件必须渲染：隐藏 file input、附件预览、textarea、Paperclip、`ModelSelectorCompact`、Mic、ArrowUp；复用正式页当前 `rounded-2xl bg-muted` 样式、三行高度限制、拖放、图片粘贴和大文本粘贴处理。所有会话专属逻辑通过插槽或回调注入，不在组件内读取 session context。

```tsx
export interface AssistantPromptComposerProps {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  images: ImageAttachment[];
  textAttachments: TextAttachment[];
  modelId: string | null;
  modelOptions: ModelOption[];
  recordingState: "idle" | "recording" | "processing";
  disabled: boolean;
  submitting: boolean;
  canSubmit: boolean;
  leadingToolbarContent?: ReactNode;
  submitControl?: ReactNode;
  inputOverlay?: ReactNode;
  questionHeader?: ReactNode;
}
```

- [ ] **Step 4: 运行组件测试并修到通过**

Run: `cd /mnt/aime/datasets/linxueyuan/viben/apps/web && pnpm test:run components/assistant/assistant-prompt-composer.test.tsx`

Expected: PASS，无 React `act`、可访问名称或 key 警告。

- [ ] **Step 5: 将正式对话页切换到共享组件**

在 `session-chat-content.tsx` 中保留现有状态、建议列表、slash command、内联问题、标题生成和发送回调，只用 `AssistantPromptComposer` 替换输入表单 DOM。把 ContextUsageIndicator 放入 `leadingToolbarContent`，把内联问题/停止按钮放入 `submitControl`，把 `SandboxInputOverlay` 放入 `inputOverlay`。把表单内 payload 拼装替换为 Task 1 的 `buildChatMessagePayload`，确保功能不变。

- [ ] **Step 6: 验证正式页抽取未破坏类型和组件测试**

Run: `cd /mnt/aime/datasets/linxueyuan/viben/apps/web && pnpm test:run components/assistant/assistant-prompt-composer.test.tsx && pnpm typecheck`

Expected: 测试 PASS，TypeScript exit 0。

- [ ] **Step 7: 提交 Task 2**

```bash
git add apps/web/components/assistant/assistant-prompt-composer.tsx apps/web/components/assistant/assistant-prompt-composer.test.tsx apps/web/components/assistant/session-chat-content.tsx
git commit -m "refactor(web): share assistant prompt composer"
```

### Task 3: 欢迎页 Session Starter

**Files:**
- Modify: `apps/web/components/assistant/session-starter.tsx`
- Test: `apps/web/components/assistant/session-starter.test.tsx`
- Modify: `apps/web/lib/i18n/locales/en.json`
- Modify: `apps/web/lib/i18n/locales/zh-CN.json`

**Interfaces:**
- Consumes: `AssistantPromptComposer`、`useModelOptions`、`useImageAttachments`、`useTextAttachments`、`useAudioRecording`、现有 repo/branch/Vercel/Git 设置组件。
- Produces: `SessionStarter` 的异步 `onSubmit({ sessionInput, draft })`；`draft` 精确使用 `StarterMessageDraft`。

- [ ] **Step 1: 写模式与提交行为的失败测试**

测试中 mock session/preferences/model/attachment hooks 和 repo selector，只验证公开行为：

```tsx
test("starts as new chat and opens new session repository selection", async () => {
  render(<SessionStarter onSubmit={vi.fn()} isLoading={false} lastRepo={null} />);
  expect(screen.getByRole("button", { name: /new chat/i })).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /new chat/i }));
  expect(screen.getByRole("button", { name: /new session/i })).toBeInTheDocument();
  expect(screen.getByText("repo-selector-stub")).toBeInTheDocument();
});

test("returns to new chat when repository popover closes without a selection", async () => {
  render(<SessionStarter onSubmit={vi.fn()} isLoading={false} lastRepo={null} />);
  await userEvent.click(screen.getByRole("button", { name: /new chat/i }));
  await userEvent.keyboard("{Escape}");
  expect(screen.getByRole("button", { name: /new chat/i })).toBeInTheDocument();
});

test("submits the selected model and complete draft", async () => {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(<SessionStarter onSubmit={onSubmit} isLoading={false} lastRepo={null} />);
  await userEvent.type(screen.getByRole("textbox"), "Build it");
  await userEvent.click(screen.getByRole("button", { name: /send/i }));
  expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
    sessionInput: expect.objectContaining({ isNewBranch: false }),
    draft: expect.objectContaining({ text: "Build it", modelId: "model-1" }),
  }));
});
```

- [ ] **Step 2: 运行测试并确认当前 starter 结构导致失败**

Run: `cd /mnt/aime/datasets/linxueyuan/viben/apps/web && pnpm test:run components/assistant/session-starter.test.tsx`

Expected: FAIL，找不到欢迎输入框、`New session` 或发送按钮。

- [ ] **Step 3: 实现欢迎标识和输入状态**

使用现有 `VibenLogo` 渲染 Logo 与 `Viben Assistant`。在 `SessionStarter` 中接入 `AssistantPromptComposer`、附件和录音 hooks；模型初值使用 `preferences.defaultModelId ?? APP_DEFAULT_MODEL_ID`，若不在已加载 model options 中则保持服务端默认模型回退。语音停止后的转写文本追加到当前 input。

- [ ] **Step 4: 实现灰色模式行与 repo popover**

把 Cloud 按钮作为 `/settings/sandbox` 的 `Link`。默认按钮文案为 `New chat >`；点击后设置 repo 模式并打开受控 Radix `Popover`，文案变为 `New session >`。`onOpenChange(false)` 且 `selectedOwner/selectedRepo` 不完整时调用统一 reset 函数，清空 owner、repo、branch、Vercel 选择和 Git 设置展开态并恢复 chat 模式；已选 repo 时只关闭 popover而保留 repo 模式。

- [ ] **Step 5: 实现欢迎页提交**

只有文本、图片或文本附件至少一项存在时可发送。构造：

```ts
await onSubmit({
  sessionInput: {
    repoOwner: mode === "repo" ? selectedOwner : undefined,
    repoName: mode === "repo" ? selectedRepo : undefined,
    branch: mode === "repo" ? selectedBranch ?? undefined : undefined,
    cloneUrl: mode === "repo" ? `https://github.com/${selectedOwner}/${selectedRepo}` : undefined,
    isNewBranch: mode === "repo" ? isNewBranch : false,
    sandboxType,
    autoCommitPush: effectiveAutoCommitPush,
    autoCreatePr: effectiveAutoCommitPush ? effectiveAutoCreatePr : false,
    vercelProject,
  },
  draft: { text: input, images, textAttachments, modelId: selectedModelId },
});
```

只在 promise 成功后清空输入与附件；失败时保持全部受控状态。

- [ ] **Step 6: 添加英文与简体中文文案并运行测试**

在 `assistant.sessionStarter` 下增加 `welcomeTitle`、`newSession`、`openSandboxSettings`、`sendMessage`、`attachFiles`、`voiceInput`。英文分别使用 `Viben Assistant`、`New session` 等自然文案；简体中文使用“Viben Assistant”“新会话”“打开沙箱设置”“发送消息”“添加附件”“语音输入”。

Run: `cd /mnt/aime/datasets/linxueyuan/viben/apps/web && pnpm test:run components/assistant/session-starter.test.tsx components/assistant/assistant-prompt-composer.test.tsx`

Expected: 全部 PASS。

- [ ] **Step 7: 提交 Task 3**

```bash
git add apps/web/components/assistant/session-starter.tsx apps/web/components/assistant/session-starter.test.tsx apps/web/lib/i18n/locales/en.json apps/web/lib/i18n/locales/zh-CN.json
git commit -m "feat(web): redesign assistant session starter"
```

### Task 4: 创建后交接并自动发送

**Files:**
- Modify: `apps/web/components/assistant/sessions-index-shell.tsx`
- Test: `apps/web/components/assistant/sessions-index-shell.test.tsx`
- Modify: `apps/web/hooks/assistant/use-text-attachments.ts`
- Test: `apps/web/hooks/assistant/use-text-attachments.test.ts`
- Modify: `apps/web/components/assistant/session-chat-content.tsx`

**Interfaces:**
- Consumes: `StarterMessageDraft`、`putStarterMessage`、`takeStarterMessage`、`buildChatMessagePayload`、现有 `createSession`、`updateChatModel` 和 `sendMessageWithPendingState`。
- Produces: 创建成功后的 `chatId` 交接，以及正式页一次性自动发送/失败恢复。

- [ ] **Step 1: 写 index shell 成功与失败的测试**

```tsx
test("stores the draft and navigates only after session creation succeeds", async () => {
  createSession.mockResolvedValue({ session: { id: "session-1" }, chat: { id: "chat-1" } });
  render(<SessionsIndexShell />);
  await starterSubmit({ sessionInput, draft });
  expect(takeStarterMessage("chat-1")).toEqual(draft);
  expect(push).toHaveBeenCalledWith("/assistant/session-1/chats/chat-1");
});

test("does not store or navigate when session creation fails", async () => {
  createSession.mockRejectedValue(new Error("create failed"));
  render(<SessionsIndexShell />);
  await starterSubmit({ sessionInput, draft });
  expect(takeStarterMessage("chat-1")).toBeNull();
  expect(push).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: 运行 index shell 测试并确认失败**

Run: `cd /mnt/aime/datasets/linxueyuan/viben/apps/web && pnpm test:run components/assistant/sessions-index-shell.test.tsx`

Expected: FAIL，因为当前 handler 不接收 draft，也不写交接区。

- [ ] **Step 3: 实现创建成功后的交接顺序**

`SessionsIndexShell` 的 handler 必须严格按 `await createSession(sessionInput)` → `putStarterMessage(chat.id, draft)` → `router.push(...)` 执行。catch 后重新抛出错误给 `SessionStarter`，以便 starter 不清空草稿；finally 清除创建中状态。

- [ ] **Step 4: 为文本附件恢复写失败 hook 测试**

```ts
import { act, renderHook } from "@testing-library/react";
import { expect, test } from "vitest";
import { useTextAttachments } from "./use-text-attachments";

test("restores multiple existing text attachments", () => {
  const { result } = renderHook(useTextAttachments);
  act(() => result.current.addTextAttachments([
    { id: "a", content: "one", filename: "one.txt", lineCount: 1, byteSize: 3 },
    { id: "b", content: "two", filename: "two.txt", lineCount: 1, byteSize: 3 },
  ]));
  expect(result.current.textAttachments.map((item) => item.id)).toEqual(["a", "b"]);
});
```

- [ ] **Step 5: 运行 hook 测试确认失败，再实现批量恢复**

Run: `cd /mnt/aime/datasets/linxueyuan/viben/apps/web && pnpm test:run hooks/assistant/use-text-attachments.test.ts`

Expected: FAIL，`addTextAttachments` 不存在。

实现：

```ts
const addTextAttachments = useCallback((attachments: TextAttachment[]) => {
  setTextAttachments((current) => [...current, ...attachments]);
}, []);
```

再次运行同一命令，Expected: PASS。

- [ ] **Step 6: 在正式页消费草稿并复用发送流程**

把现有表单发送主体抽为 `submitComposerMessage({ text, files, textAttachments, clearComposer })` callback，使普通提交与 starter 自动发送共同经过 payload 构造、首消息乐观标题、标题生成、`sendMessageWithPendingState` 和错误回滚。

增加只针对当前 `chatInfo.id` 执行一次的 effect：

```ts
useEffect(() => {
  const draft = takeStarterMessage(chatInfo.id);
  if (!draft) return;

  void (async () => {
    try {
      if (draft.modelId && draft.modelId !== chatInfo.modelId) {
        await updateChatModel(draft.modelId);
      }
      const files = draft.images.map(imageAttachmentToFilePart);
      await submitComposerMessage({
        text: draft.text,
        files,
        textAttachments: draft.textAttachments,
        clearComposer: false,
      });
    } catch {
      setInput(draft.text);
      addImageAttachments(draft.images);
      addTextAttachments(draft.textAttachments);
    }
  })();
}, [chatInfo.id]);
```

实际依赖数组需包含稳定 callback；使用 `consumedStarterChatIdRef` 防止 callback 身份变化造成重复读取。模型更新失败必须进入 catch，不得使用当前吞掉异常的 `handleModelChange`。发送成功后不恢复草稿。

- [ ] **Step 7: 运行定向测试和类型检查**

Run: `cd /mnt/aime/datasets/linxueyuan/viben/apps/web && pnpm test:run components/assistant/starter-message-handoff.test.ts components/assistant/chat-message-payload.test.ts components/assistant/sessions-index-shell.test.tsx hooks/assistant/use-text-attachments.test.ts components/assistant/session-starter.test.tsx components/assistant/assistant-prompt-composer.test.tsx && pnpm typecheck`

Expected: 全部测试 PASS，TypeScript exit 0。

- [ ] **Step 8: 提交 Task 4**

```bash
git add apps/web/components/assistant/sessions-index-shell.tsx apps/web/components/assistant/sessions-index-shell.test.tsx apps/web/hooks/assistant/use-text-attachments.ts apps/web/hooks/assistant/use-text-attachments.test.ts apps/web/components/assistant/session-chat-content.tsx
git commit -m "feat(web): send starter message after session creation"
```

### Task 5: 完整回归验证

**Files:**
- Modify only if verification exposes a defect in files already listed above.

**Interfaces:**
- Consumes: Tasks 1–4 的最终实现。
- Produces: 测试、类型检查和生产构建的最新通过证据。

- [ ] **Step 1: 运行新增和相关 assistant 测试**

Run: `cd /mnt/aime/datasets/linxueyuan/viben/apps/web && pnpm test:run components/assistant/starter-message-handoff.test.ts components/assistant/chat-message-payload.test.ts components/assistant/assistant-prompt-composer.test.tsx components/assistant/session-starter.test.tsx components/assistant/sessions-index-shell.test.tsx hooks/assistant/use-text-attachments.test.ts hooks/assistant/use-session-chats.test.ts`

Expected: 0 failures、0 unhandled errors。

- [ ] **Step 2: 运行 apps/web 类型检查**

Run: `cd /mnt/aime/datasets/linxueyuan/viben/apps/web && pnpm typecheck`

Expected: exit 0。

- [ ] **Step 3: 运行 apps/web 生产构建**

Run: `cd /mnt/aime/datasets/linxueyuan/viben/apps/web && pnpm build`

Expected: Next.js build exit 0，无 TypeScript 或 route 编译错误。

- [ ] **Step 4: 浏览器验收**

启动 `apps/web` 开发服务并逐项验证：

1. `/assistant` 显示 Viben Logo、`Viben Assistant` 和大输入卡片；
2. Cloud 图标进入 `/settings/sandbox`；
3. `New chat >` 打开 repo popover并变成 `New session >`；
4. 未选 repo 按 Escape/点击外部后恢复 `New chat >`；
5. 空白 chat 的文本、图片、长文本附件、语音转写和模型选择可自动发送；
6. repo session 的相同内容可自动发送；
7. 创建失败时欢迎页草稿不清空；
8. 人为使自动发送失败时正式输入框恢复文本和附件；
9. 移动端尺寸下输入框、popover 和触摸按钮不溢出。

- [ ] **Step 5: 检查最终 diff 并提交必要修正**

Run: `cd /mnt/aime/datasets/linxueyuan/viben && git diff --check`

Expected: 无 whitespace error；最终 diff 只包含本计划列出的文件。若验证阶段产生修正，使用：

```bash
git add apps/web
git commit -m "fix(web): finish assistant starter validation"
```
