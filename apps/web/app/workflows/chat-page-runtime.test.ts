import { beforeEach, describe, expect, test, vi } from "vitest";
import type { UIMessageChunk } from "ai";
import { runPageAgentStep } from "./chat-page-runtime";

const mocks = vi.hoisted(() => ({
  onPageResourceUpdated: undefined as
    | undefined
    | ((publishedPageId: string) => Promise<void> | void),
  createPageMcpTools: vi.fn(
    async (input: {
      onPageResourceUpdated?: (publishedPageId: string) => Promise<void> | void;
    }) => {
      mocks.onPageResourceUpdated = input.onPageResourceUpdated;
      return { tools: {}, close: vi.fn(async () => undefined) };
    },
  ),
  resolvePageChatContext: vi.fn(async () => ({
    page: {
      publishedPageId: "page-1",
      userSlug: "alice",
      pageSlug: "guide",
      title: "Guide",
      canEdit: true,
      url: "/alice/guide?tab=read",
    },
    bearerToken: "token",
  })),
  stream: vi.fn(),
}));

vi.mock("workflow/api", () => ({
  getRun: () => ({
    get status() {
      return Promise.resolve("running");
    },
  }),
}));

vi.mock("@/app/config", () => ({
  pageAgent: {
    stream: mocks.stream,
  },
}));

vi.mock("@/lib/page-chat/page-mcp-tools", () => ({
  buildPageChatInstructions: () => "instructions",
  createPageMcpTools: mocks.createPageMcpTools,
}));

vi.mock("@/lib/page-chat/page-chat-context", () => ({
  resolvePageChatContext: mocks.resolvePageChatContext,
}));

const writtenChunks: UIMessageChunk[] = [];

function makeWritable(): WritableStream<UIMessageChunk> {
  return new WritableStream<UIMessageChunk>({
    write(chunk) {
      writtenChunks.push(chunk);
    },
  });
}

function makeInput(overrides: Record<string, unknown> = {}) {
  return {
    messages: [],
    originalMessages: [],
    messageId: "msg-1",
    writable: makeWritable(),
    workflowRunId: "wrun-1",
    chatId: "chat-1",
    sessionId: "session-1",
    userId: "user-1",
    requestUrl: "http://localhost/api/chat",
    selectedModelId: "gpt-4",
    modelId: "gpt-4",
    model: { provider: "openai", modelId: "gpt-4" },
    stepNumber: 1,
    ...overrides,
  } as unknown as Parameters<typeof runPageAgentStep>[0];
}

describe("runPageAgentStep page content changed bridge", () => {
  beforeEach(() => {
    writtenChunks.length = 0;
    mocks.onPageResourceUpdated = undefined;
    mocks.createPageMcpTools.mockClear();
    mocks.resolvePageChatContext.mockClear();
    mocks.stream.mockReset();

    mocks.stream.mockImplementation(async () => ({
      toUIMessageStream: (opts: {
        onFinish?: (args: { responseMessage: unknown }) => void;
      }) => ({
        async *[Symbol.asyncIterator]() {
          opts.onFinish?.({
            responseMessage: {
              id: "assistant-1",
              role: "assistant",
              parts: [],
              metadata: {},
            },
          });
        },
      }),
      totalUsage: Promise.resolve(undefined),
      finishReason: Promise.resolve("stop"),
      rawFinishReason: Promise.resolve(undefined),
      response: Promise.resolve({ messages: [] }),
      steps: Promise.resolve([]),
    }));
  });

  test("passes onPageResourceUpdated to createPageMcpTools and writes a page-content-changed part", async () => {
    await runPageAgentStep(makeInput());

    expect(mocks.onPageResourceUpdated).toBeTypeOf("function");
    await mocks.onPageResourceUpdated?.("page-1");

    expect(writtenChunks).toContainEqual({
      type: "data-page-content-changed",
      id: "chat-1:page-content-changed:page-1",
      data: { publishedPageId: "page-1", chatId: "chat-1" },
    });
  });
});
