import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { ModelOption } from "@/lib/model-options";
import {
  ChatComposer,
  type ChatComposerProps,
  type ChatComposerSubmit,
} from "./chat-composer";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("nanoid", () => ({
  nanoid: vi.fn(() => `attachment-${Math.random().toString(16).slice(2)}`),
}));

vi.mock("@/lib/image-utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/image-utils")>();
  return {
    ...actual,
    compressImageFile: vi.fn((file: File) => Promise.resolve(file)),
    fileToDataUrl: vi.fn((file: File) =>
      Promise.resolve(`data:${file.type};base64,ZmFrZQ==`),
    ),
  };
});

const modelOptions: ModelOption[] = [
  {
    id: "openai/gpt-5",
    label: "OpenAI GPT-5",
    shortLabel: "GPT-5",
    isVariant: false,
    provider: "openai",
  },
];

function pageProps(overrides: Partial<ChatComposerProps> = {}) {
  return {
    mode: "page" as const,
    density: "full" as const,
    modelId: "openai/gpt-5",
    modelOptions,
    contextUsage: <span>12% context</span>,
    status: "ready" as const,
    onModelChange: vi.fn().mockResolvedValue(undefined),
    onSubmit: vi.fn().mockResolvedValue(undefined),
    onStop: vi.fn(),
    ...overrides,
  };
}

function workExtensions(): NonNullable<
  ChatComposerProps["workExtensions"]
> {
  return {
    fileSuggestions: [],
    skillSuggestions: [],
    todo: <div>Todo</div>,
    overlay: (
      <>
        <div>File suggestions</div>
        <div>Skills</div>
      </>
    ),
  };
}

async function prepareDraftWithImageAndTextAttachment() {
  const largeText = "x".repeat(10_000);
  const imageFile = new File(["fake"], "screenshot.png", {
    type: "image/png",
  });

  fireEvent.paste(screen.getByPlaceholderText("Ask about this page"), {
    clipboardData: {
      items: [],
      getData: () => largeText,
    },
  });
  fireEvent.change(screen.getByTestId("attachment-input"), {
    target: { files: [imageFile] },
  });
  await screen.findByTestId("image-attachment-preview");
  fireEvent.change(screen.getByPlaceholderText("Ask about this page"), {
    target: { value: "Summarize it" },
  });
}

describe("ChatComposer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("page mode keeps common controls and never renders work extensions", () => {
    render(
      <ChatComposer {...pageProps({ workExtensions: workExtensions() })} />,
    );

    expect(screen.getByRole("button", { name: "Attach files" })).toBeVisible();
    expect(screen.getByRole("button", { name: /model/i })).toBeVisible();
    expect(screen.getByRole("button", { name: "Voice input" })).toBeVisible();
    expect(screen.getByText("12% context")).toBeVisible();
    expect(screen.queryByText("File suggestions")).not.toBeInTheDocument();
    expect(screen.queryByText("Skills")).not.toBeInTheDocument();
    expect(screen.queryByText("Todo")).not.toBeInTheDocument();
  });

  test("submits image and large-text attachments then clears on success", async () => {
    const onSubmit = vi.fn<(draft: ChatComposerSubmit) => Promise<void>>(
      () => Promise.resolve(),
    );
    render(<ChatComposer {...pageProps({ onSubmit })} />);

    await prepareDraftWithImageAndTextAttachment();
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          text: "Summarize it",
          images: [expect.objectContaining({ mediaType: "image/png" })],
          textAttachments: [
            expect.objectContaining({ content: "x".repeat(10_000) }),
          ],
          modelId: "openai/gpt-5",
        }),
      ),
    );
    expect(screen.getByPlaceholderText("Ask about this page")).toHaveValue("");
    expect(screen.queryByTestId("image-attachment-preview")).not.toBeInTheDocument();
    expect(screen.queryByTestId("text-attachment-preview")).not.toBeInTheDocument();
  });

  test("restores draft and attachments when submit rejects", async () => {
    const onSubmit = vi.fn<(draft: ChatComposerSubmit) => Promise<void>>(() =>
      Promise.reject(new Error("network")),
    );
    render(<ChatComposer {...pageProps({ onSubmit })} />);

    await prepareDraftWithImageAndTextAttachment();
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await screen.findByText("network");
    expect(screen.getByPlaceholderText("Ask about this page")).toHaveValue(
      "Summarize it",
    );
    expect(screen.getByTestId("image-attachment-preview")).toBeVisible();
    expect(screen.getByTestId("text-attachment-preview")).toBeVisible();
  });

  test("shows stop instead of send while streaming", () => {
    const onStop = vi.fn();
    render(<ChatComposer {...pageProps({ status: "streaming", onStop })} />);

    fireEvent.click(screen.getByRole("button", { name: "Stop generating" }));

    expect(onStop).toHaveBeenCalledOnce();
    expect(
      screen.queryByRole("button", { name: "Send message" }),
    ).not.toBeInTheDocument();
  });
});
