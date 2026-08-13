import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { WebAgentUIMessage } from "@/app/types";
import type { Chat, Session } from "@/lib/db/schema";
import type { ModelOption } from "@/lib/model-options";
import { useSessionChatRuntime } from "@/hooks/assistant/chat/use-session-chat-runtime";
import { SharedChatCore } from "./shared-chat-core";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/hooks/assistant/chat/use-session-chat-runtime", () => ({
  useSessionChatRuntime: vi.fn(),
}));

const transcriptState = vi.hoisted(() => ({
  props: {} as Record<string, unknown>,
}));

vi.mock("@/components/assistant/chat-transcript", () => ({
  ChatTranscript: (props: Record<string, unknown>) => {
    transcriptState.props = props;
    return <div data-testid="chat-transcript" />;
  },
}));

vi.mock("@/components/assistant/chat-composer", () => ({
  ChatComposer: ({
    mode,
    workExtensions,
    onSubmit,
    onStop,
  }: {
    mode: "work" | "page";
    workExtensions?: {
      fileSuggestions: unknown[];
      skillSuggestions: unknown[];
      todo: ReactNode;
      overlay: ReactNode;
    };
    onSubmit: (draft: {
      text: string;
      images: [];
      textAttachments: [];
      modelId: string;
    }) => Promise<void>;
    onStop: () => void;
  }) => (
    <div>
      <div>mode:{mode}</div>
      {workExtensions?.overlay}
      {workExtensions?.todo}
      <button
        type="button"
        onClick={() =>
          void onSubmit({
            text: "Summarize this page",
            images: [],
            textAttachments: [],
            modelId: "openai/gpt-5",
          })
        }
      >
        mock send
      </button>
      <button type="button" onClick={onStop}>
        Stop generating
      </button>
    </div>
  ),
}));

const session = {
  id: "session-1",
  agentType: "chat",
} as Session;

const chat = {
  id: "chat-1",
  sessionId: "session-1",
  modelId: "openai/gpt-5",
  activeStreamId: "stream-1",
} as Chat;

const modelOptions: ModelOption[] = [
  {
    id: "openai/gpt-5",
    label: "OpenAI GPT-5",
    shortLabel: "GPT-5",
    isVariant: false,
    provider: "openai",
    contextWindow: 128_000,
  },
];

function runtime() {
  return {
    chat: {
      messages: [] as WebAgentUIMessage[],
      status: "ready" as const,
      error: undefined,
      sendMessage: vi.fn().mockResolvedValue(undefined),
      resumeStream: vi.fn().mockResolvedValue(undefined),
      clearError: vi.fn(),
    },
    stopChatStream: vi.fn(),
    retryChatStream: vi.fn(),
    workspaceStatus: null,
    clearWorkspaceStatus: vi.fn(),
  };
}

describe("SharedChatCore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("uses the existing chat transport for page submit and stop", async () => {
    const runtimeMock = runtime();
    vi.mocked(useSessionChatRuntime).mockReturnValue(runtimeMock);

    render(
      <SharedChatCore
        session={session}
        chat={chat}
        initialMessages={[]}
        modelOptions={modelOptions}
        mode="page"
        density="compact"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "mock send" }));
    await waitFor(() =>
      expect(runtimeMock.chat.sendMessage).toHaveBeenCalledWith({
        text: "Summarize this page",
        files: undefined,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Stop generating" }));
    expect(runtimeMock.stopChatStream).toHaveBeenCalledOnce();
    expect(useSessionChatRuntime).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "session-1",
        chatId: "chat-1",
        initialMessages: [],
        initialChatActiveStreamId: "stream-1",
        contextLimit: 128_000,
      }),
    );
  });

  test("work mode forwards work extensions without changing the runtime", () => {
    const runtimeMock = runtime();
    vi.mocked(useSessionChatRuntime).mockReturnValue(runtimeMock);

    render(
      <SharedChatCore
        session={session}
        chat={chat}
        initialMessages={[]}
        modelOptions={modelOptions}
        mode="work"
        density="full"
        workExtensions={{
          fileSuggestions: [],
          skillSuggestions: [],
          todo: <div>Todo</div>,
          overlay: (
            <>
              <div>File suggestions</div>
              <div>Skills</div>
            </>
          ),
        }}
      />,
    );

    expect(screen.getByText("mode:work")).toBeVisible();
    expect(screen.getByText("File suggestions")).toBeVisible();
    expect(screen.getByText("Skills")).toBeVisible();
    expect(screen.getByText("Todo")).toBeVisible();
    expect(useSessionChatRuntime).toHaveBeenCalledOnce();
  });

  test("page mode omits retry action while work mode provides it", () => {
    const runtimeMock = runtime();
    vi.mocked(useSessionChatRuntime).mockReturnValue(runtimeMock);

    const { rerender } = render(
      <SharedChatCore
        session={session}
        chat={chat}
        initialMessages={[]}
        modelOptions={modelOptions}
        mode="page"
        density="full"
      />,
    );

    expect(transcriptState.props.onRetryMessage).toBeUndefined();

    rerender(
      <SharedChatCore
        session={session}
        chat={chat}
        initialMessages={[]}
        modelOptions={modelOptions}
        mode="work"
        density="full"
      />,
    );

    expect(transcriptState.props.onRetryMessage).toBeTypeOf("function");
  });
});
