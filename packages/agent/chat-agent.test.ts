import { describe, expect, mock, test } from "bun:test";
import type { ToolSet } from "ai";
import { z } from "zod";

mock.module("ai", () => {
  class ToolLoopAgent {
    readonly tools: ToolSet;
    readonly prepareCall: unknown;
    readonly prepareStep: unknown;

    constructor(config: {
      tools?: ToolSet;
      prepareCall?: unknown;
      prepareStep?: unknown;
    }) {
      this.tools = config.tools ?? {};
      this.prepareCall = config.prepareCall;
      this.prepareStep = config.prepareStep;
    }
  }

  return {
    createGateway: () => (modelId: string) => ({
      modelId,
      provider: "test",
    }),
    defaultSettingsMiddleware: () => ({
      kind: "default-settings-middleware",
    }),
    stepCountIs: (count: number) => ({ kind: "step-count", count }),
    ToolLoopAgent,
    wrapLanguageModel: ({ model }: { model: unknown }) => model,
  };
});

const { chatAgent, prepareChatAgentCall } = await import("./chat-agent");

describe("chatAgent", () => {
  test("accepts externally scoped tools without sandbox", () => {
    const getPageTool = {
      description: "Read the scoped page",
      inputSchema: z.object({}),
      execute: async () => "page content",
    };

    const prepared = prepareChatAgentCall({
      options: {
        instructions: "Answer about page-1 only",
        model: "openai/gpt-5",
        tools: { get_page: getPageTool },
      },
    });

    expect(prepared.tools).toHaveProperty("get_page");
    expect(prepared.instructions).toContain("page-1");
    expect(
      (prepared as { experimental_context?: unknown }).experimental_context,
    ).toBeUndefined();
  });

  test("does not register work tools", () => {
    expect(Object.keys(chatAgent.tools)).not.toEqual(
      expect.arrayContaining(["bash", "read", "write", "edit", "task", "skill"]),
    );
  });
});
