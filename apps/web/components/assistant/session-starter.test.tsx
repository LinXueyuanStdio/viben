import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { SessionStarter } from "./session-starter";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        "assistant.sessionStarter.welcomeTitle": "Viben Assistant",
        "assistant.sessionStarter.newChat": "New chat",
        "assistant.sessionStarter.newSession": "New session",
        "assistant.sessionStarter.attachFiles": "Attach files",
        "assistant.sessionStarter.voiceInput": "Voice input",
        "assistant.sessionStarter.sendMessage": "Send message",
        "assistant.chatContent.inputPlaceholder": "Ask Viben",
      })[key] ?? key,
  }),
}));

vi.mock("@/hooks/assistant/use-session", () => ({
  useSession: () => ({
    session: {
      isManagedTemplateTrialUser: false,
      authProvider: "github",
    },
    loading: false,
    hasGitHub: true,
  }),
}));

vi.mock("@/hooks/assistant/use-github-connection-status", () => ({
  useGitHubConnectionStatus: () => ({
    reconnectRequired: false,
    isLoading: false,
  }),
}));

vi.mock("@/hooks/assistant/use-user-preferences", () => ({
  useUserPreferences: () => ({
    preferences: {
      defaultModelId: "openai/gpt-5",
      defaultSandboxType: "local",
      autoCommitPush: false,
      autoCreatePr: false,
    },
    loading: false,
  }),
}));

vi.mock("@/hooks/assistant/use-model-options", () => ({
  useModelOptions: () => ({
    modelOptions: [
      {
        id: "openai/gpt-5",
        label: "OpenAI GPT-5",
        shortLabel: "GPT-5",
        isVariant: false,
        provider: "openai",
      },
    ],
    loading: false,
  }),
}));

vi.mock("@/hooks/assistant/use-vercel-repo-projects", () => ({
  useVercelRepoProjects: () => ({
    data: undefined,
    loading: false,
    error: null,
  }),
}));

vi.mock("./repo-selector-compact", () => ({
  RepoSelectorCompact: ({
    onSelect,
  }: {
    onSelect: (owner: string, repo: string) => void;
  }) => (
    <button type="button" onClick={() => onSelect("acme", "dashboard")}>
      Select acme/dashboard
    </button>
  ),
}));

vi.mock("./branch-selector-compact", () => ({
  BranchSelectorCompact: () => null,
}));

vi.mock("./session-starter-vercel-sync-section", () => ({
  SessionStarterVercelSyncSection: () => null,
}));

describe("SessionStarter", () => {
  test("renders the Viben welcome composer and sandbox shortcut", () => {
    render(
      <SessionStarter
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        isLoading={false}
        lastRepo={null}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Viben Assistant" }),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Ask Viben")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sandbox/i })).toHaveAttribute(
      "href",
      "/settings/sandbox",
    );
    expect(
      screen.getByRole("button", { name: /new chat/i }),
    ).toBeInTheDocument();
  });

  test("returns to new chat when repository selection closes incomplete", async () => {
    render(
      <SessionStarter
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        isLoading={false}
        lastRepo={null}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /new chat/i }));
    expect(
      screen.getByRole("button", { name: /new session/i }),
    ).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /new chat/i }),
      ).toBeInTheDocument(),
    );
  });

  test("submits the selected model with the complete first-message draft", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <SessionStarter onSubmit={onSubmit} isLoading={false} lastRepo={null} />,
    );

    fireEvent.change(screen.getByPlaceholderText("Ask Viben"), {
      target: { value: "Build it" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        sessionInput: expect.objectContaining({ isNewBranch: false }),
        draft: {
          text: "Build it",
          images: [],
          textAttachments: [],
          modelId: "openai/gpt-5",
        },
      }),
    );
  });
});
