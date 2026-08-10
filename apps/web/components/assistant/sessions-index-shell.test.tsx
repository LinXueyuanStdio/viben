import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { takeStarterMessage } from "./starter-message-handoff";
import { SessionsIndexShell } from "./sessions-index-shell";

const mocks = vi.hoisted(() => ({
  createSession: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock("./sessions-shell-context", () => ({
  useSessionsShell: () => ({
    createSession: mocks.createSession,
    lastRepo: null,
  }),
}));

vi.mock("./session-starter", () => ({
  SessionStarter: ({
    onSubmit,
  }: {
    onSubmit: (input: {
      sessionInput: { isNewBranch: boolean; sandboxType: "local" };
      draft: {
        text: string;
        images: [];
        textAttachments: [];
        modelId: string;
      };
    }) => Promise<void>;
  }) => (
    <button
      type="button"
      onClick={() => {
        void onSubmit({
          sessionInput: { isNewBranch: false, sandboxType: "local" },
          draft: {
            text: "Build it",
            images: [],
            textAttachments: [],
            modelId: "openai/gpt-5",
          },
        }).catch(() => undefined);
      }}
    >
      Submit starter
    </button>
  ),
}));

describe("SessionsIndexShell", () => {
  beforeEach(() => {
    mocks.createSession.mockReset();
    mocks.push.mockReset();
    takeStarterMessage("created-chat");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("queues the draft and navigates after session creation succeeds", async () => {
    mocks.createSession.mockResolvedValue({
      session: { id: "created-session" },
      chat: { id: "created-chat" },
    });
    render(<SessionsIndexShell />);

    fireEvent.click(screen.getByRole("button", { name: "Submit starter" }));

    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith(
        "/assistant/created-session/chats/created-chat",
      ),
    );
    expect(takeStarterMessage("created-chat")).toMatchObject({
      text: "Build it",
      modelId: "openai/gpt-5",
    });
  });

  test("does not queue or navigate when session creation fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.createSession.mockRejectedValue(new Error("create failed"));
    render(<SessionsIndexShell />);

    fireEvent.click(screen.getByRole("button", { name: "Submit starter" }));

    await waitFor(() => expect(mocks.createSession).toHaveBeenCalledOnce());
    expect(mocks.push).not.toHaveBeenCalled();
    expect(takeStarterMessage("created-chat")).toBeNull();
  });
});
