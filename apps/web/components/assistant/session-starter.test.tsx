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
        "assistant.sessionStarter.openSandboxSettings":
          "Open sandbox settings",
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
  BranchSelectorCompact: ({
    onChange,
  }: {
    onChange: (branch: string | null, isNewBranch: boolean) => void;
  }) => (
    <button type="button" onClick={() => onChange("develop", false)}>
      main
    </button>
  ),
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

  test("keeps New chat while repository selection opens and closes incomplete", async () => {
    render(
      <SessionStarter
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        isLoading={false}
        lastRepo={null}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /new chat/i }));
    expect(screen.getByRole("button", { name: /new chat/i })).toBeInTheDocument();
    expect(screen.queryByText("New session")).not.toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /new chat/i }),
      ).toBeInTheDocument(),
    );
  });

  test("shows repository and branch controls after selecting a repository", () => {
    render(
      <SessionStarter
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        isLoading={false}
        lastRepo={null}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /new chat/i }));
    fireEvent.click(
      screen.getByRole("button", { name: "Select acme/dashboard" }),
    );

    const repoButton = screen.getByRole("button", { name: "acme/dashboard" });
    const branchButton = screen.getByRole("button", { name: "main" });
    const modeBar = repoButton.closest('[data-slot="session-starter-mode-bar"]');

    expect(modeBar).toHaveClass("h-8", "justify-start");
    expect(modeBar).toContainElement(branchButton);
    expect(screen.queryByText("New session")).not.toBeInTheDocument();
  });

  test("reopens repository selection from the selected repository control", async () => {
    render(
      <SessionStarter
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        isLoading={false}
        lastRepo={null}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /new chat/i }));
    fireEvent.click(
      screen.getByRole("button", { name: "Select acme/dashboard" }),
    );
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Select acme/dashboard" }),
      ).not.toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: "acme/dashboard" }));

    expect(
      screen.getByRole("button", { name: "Select acme/dashboard" }),
    ).toBeInTheDocument();
  });

  test("submits the selected repository and branch", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <SessionStarter onSubmit={onSubmit} isLoading={false} lastRepo={null} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /new chat/i }));
    fireEvent.click(
      screen.getByRole("button", { name: "Select acme/dashboard" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "main" }));
    fireEvent.change(screen.getByPlaceholderText("Ask Viben"), {
      target: { value: "Ship it" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        sessionInput: expect.objectContaining({
          repoOwner: "acme",
          repoName: "dashboard",
          branch: "develop",
          isNewBranch: false,
        }),
        draft: expect.objectContaining({ text: "Ship it" }),
      }),
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
