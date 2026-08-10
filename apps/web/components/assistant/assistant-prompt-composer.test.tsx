import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { AssistantPromptComposer } from "./assistant-prompt-composer";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const modelOptions = [
  {
    id: "openai/gpt-5",
    label: "OpenAI GPT-5",
    shortLabel: "GPT-5",
    isVariant: false,
    provider: "openai",
  },
];

function renderComposer(overrides = {}) {
  const onValueChange = vi.fn();
  const onSubmit = vi.fn((event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  });
  const onOpenFilePicker = vi.fn();
  const onMicClick = vi.fn();

  render(
    <AssistantPromptComposer
      inputRef={createRef<HTMLTextAreaElement>()}
      fileInputRef={createRef<HTMLInputElement>()}
      value="hello"
      onValueChange={onValueChange}
      onSubmit={onSubmit}
      placeholder="Ask Viben"
      images={[]}
      textAttachments={[]}
      onRemoveImage={vi.fn()}
      onRemoveTextAttachment={vi.fn()}
      onAddImage={vi.fn().mockResolvedValue(true)}
      onAddImages={vi.fn().mockResolvedValue(undefined)}
      onAddLargeText={vi.fn()}
      onOpenFilePicker={onOpenFilePicker}
      modelId="openai/gpt-5"
      modelOptions={modelOptions}
      onModelChange={vi.fn()}
      recordingState="idle"
      onMicClick={onMicClick}
      disabled={false}
      submitting={false}
      canSubmit
      labels={{
        attachFiles: "Attach files",
        voiceInput: "Voice input",
        sendMessage: "Send message",
      }}
      footer={<div>Session mode</div>}
      {...overrides}
    />,
  );

  return { onValueChange, onSubmit, onOpenFilePicker, onMicClick };
}

describe("AssistantPromptComposer", () => {
  test("connects the shared text, attachment, voice and submit controls", () => {
    const callbacks = renderComposer();

    fireEvent.change(screen.getByPlaceholderText("Ask Viben"), {
      target: { value: "next" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Attach files" }));
    fireEvent.click(screen.getByRole("button", { name: "Voice input" }));
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    expect(callbacks.onValueChange).toHaveBeenCalledWith("next");
    expect(callbacks.onOpenFilePicker).toHaveBeenCalledOnce();
    expect(callbacks.onMicClick).toHaveBeenCalledOnce();
    expect(callbacks.onSubmit).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: /model/i })).toBeInTheDocument();
    expect(screen.getByText("Session mode")).toBeInTheDocument();
  });

  test("disables all mutating controls while submitting", () => {
    renderComposer({ submitting: true });

    expect(screen.getByPlaceholderText("Ask Viben")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Attach files" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Voice input" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
  });
});
