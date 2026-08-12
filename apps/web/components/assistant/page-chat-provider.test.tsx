import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { WebAgentUIMessage } from "@/app/types";
import type { Chat, Session } from "@/lib/db/schema";
import type { ModelOption } from "@/lib/model-options";
import {
  PageChatProvider,
  usePageChatProviderContext,
} from "./page-chat-provider";

const session = {
  id: "session-1",
  agentType: "chat",
} as Session;

const chat = {
  id: "chat-1",
  sessionId: "session-1",
  modelId: "openai/gpt-5",
} as Chat;

const modelOptions: ModelOption[] = [
  {
    id: "openai/gpt-5",
    label: "OpenAI GPT-5",
    shortLabel: "GPT-5",
    isVariant: false,
    provider: "openai",
  },
];

function Consumer() {
  const context = usePageChatProviderContext();
  return <div>{context.chat.id === "chat-1" ? "ready" : "missing"}</div>;
}

describe("PageChatProvider", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test("page provider does not request sandbox, files, skills, diff or git endpoints", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}"));

    render(
      <PageChatProvider
        session={session}
        chat={chat}
        initialMessages={[] as WebAgentUIMessage[]}
        initialModelOptions={modelOptions}
      >
        <Consumer />
      </PageChatProvider>,
    );

    await waitFor(() => expect(screen.getByText("ready")).toBeVisible());
    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls).not.toEqual(
      expect.arrayContaining([
        expect.stringContaining("/sandbox/"),
        expect.stringContaining("/files"),
        expect.stringContaining("/skills"),
        expect.stringContaining("/diff"),
        expect.stringContaining("/git"),
      ]),
    );
  });
});
