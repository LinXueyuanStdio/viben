/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MarkdownPageEditor } from "../markdown-page-editor";

const mocks = vi.hoisted(() => ({
  applyTemplateMutateAsync: vi.fn(),
  pageTemplates: [
    {
      id: "markdown-docs",
      name: "Markdown Documentation",
      description: "Documentation page",
      type: "markdown",
      default_config: {},
      source: "builtin",
    },
  ],
}));

vi.mock("@monaco-editor/react", () => ({
  default: ({
    value,
    onChange,
    onMount,
    height,
    options,
  }: {
    value: string;
    onChange?: (value: string) => void;
    onMount?: (editor: {
      addAction: () => void;
      focus: () => void;
      setPosition: (position: { lineNumber: number; column: number }) => void;
    }, monaco: unknown) => void;
    height?: string;
    options?: Record<string, unknown>;
  }) => (
    <textarea
      aria-label="monaco markdown editor"
      data-height={height}
      data-options={JSON.stringify(options)}
      value={value}
      ref={(node) => {
        if (!node || !onMount) return;
        onMount(
          {
            addAction: () => undefined,
            focus: () => node.focus(),
            setPosition: () => undefined,
          },
          {
            KeyMod: { CtrlCmd: 1 },
            KeyCode: { KeyS: 2 },
          }
        );
      }}
      onChange={(event) => onChange?.(event.target.value)}
    />
  ),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string, opts?: Record<string, unknown>) => opts ? (fallback ?? key).replace(/\{\{(\w+)\}\}/g, (_: string, k: string) => String(opts[k] ?? `{{${k}}}`)) : (fallback ?? key),
  }),
  initReactI18next: {
    type: "3rdParty" as const,
    init: () => {},
  },
}));

vi.mock("@/hooks/use-theme", () => ({
  useTheme: () => ({ resolvedTheme: "light" }),
}));

vi.mock("@/hooks/use-pages", () => ({
  pageKeys: {
    list: (workspacePath: string) => ["pages", "list", workspacePath],
    detail: (workspacePath: string, uid: string) => ["pages", "detail", workspacePath, uid],
  },
  usePageTemplates: () => ({ data: mocks.pageTemplates, isLoading: false }),
  useApplyPageTemplate: () => ({
    mutateAsync: mocks.applyTemplateMutateAsync,
    isPending: false,
  }),
}));

vi.mock("@/components/ui/icon-picker", () => ({
  IconDisplay: ({ icon }: { icon?: { value?: string } | string }) => (
    <span data-testid="icon-display">{typeof icon === "string" ? icon : icon?.value}</span>
  ),
  IconPicker: () => null,
}));

vi.mock("@viben/chat", () => ({
  ChatInput: ({
    value,
    onValueChange,
    onSend,
    placeholder,
  }: {
    value: string;
    onValueChange: (value: string) => void;
    onSend: (content: string) => void;
    placeholder?: string;
  }) => (
    <textarea
      value={value}
      placeholder={placeholder}
      onChange={(event) => onValueChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          onSend(value);
        }
      }}
    />
  ),
}));

vi.mock("@/lib/gateway/config", () => ({
  getGatewayUrl: () => "http://127.0.0.1:18790",
}));

vi.mock("@/lib/gateway/modules/pages", () => ({
  updatePageConfig: vi.fn(),
  updatePageContent: vi.fn(),
}));

function renderRenderer(content: string) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MarkdownPageEditor
        content={content}
        editable
        workspacePath="/tmp/workspace"
        uid="0623-blank"
        title=""
      />
    </QueryClientProvider>
  );
}

describe("MarkdownPageEditor Monaco empty state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.applyTemplateMutateAsync.mockResolvedValue({
      success: true,
      page: {
        uid: "0623-blank",
        name: "",
        type: "markdown",
        permission: ["read", "write"],
        path: "/tmp/workspace/pages/0623-blank",
        skill_content: "## Getting Started",
      },
    });
  });

  it("shows the empty page card for empty markdown", () => {
    renderRenderer("");

    expect(screen.getByRole("button", { name: "开始" })).toBeTruthy();
    expect(screen.getByText("按 Enter 键开始编辑内容")).toBeTruthy();
  });

  it("shows the empty page card for frontmatter-only markdown", () => {
    renderRenderer("---\nname: test\n---\n\n");

    expect(screen.getByRole("button", { name: "开始" })).toBeTruthy();
  });

  it("hides the empty page card when markdown body has content", () => {
    renderRenderer("---\nname: test\n---\n\n正文");

    expect(screen.queryByRole("button", { name: "开始" })).toBeNull();
  });

  it("enters the editor from the start button", async () => {
    renderRenderer("");

    fireEvent.click(screen.getByRole("button", { name: "开始" }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "开始" })).toBeNull();
      expect(document.activeElement).toBe(screen.getByLabelText("monaco markdown editor"));
    });
  });

  it("enters the editor from the empty page area", async () => {
    renderRenderer("");

    fireEvent.click(screen.getByLabelText("空页面操作"));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "开始" })).toBeNull();
      expect(document.activeElement).toBe(screen.getByLabelText("monaco markdown editor"));
    });
  });

  it("enters the editor when Enter is pressed outside controls", async () => {
    renderRenderer("");

    fireEvent.keyDown(document, { key: "Enter" });

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "开始" })).toBeNull();
      expect(document.activeElement).toBe(screen.getByLabelText("monaco markdown editor"));
    });
  });

  it("shows the empty page card after non-empty content becomes empty", async () => {
    vi.useFakeTimers();
    try {
      renderRenderer("");

      fireEvent.click(screen.getByRole("button", { name: "开始" }));
      const editor = screen.getByLabelText("monaco markdown editor");

      fireEvent.change(editor, { target: { value: "正文" } });
      expect(screen.queryByRole("button", { name: "开始" })).toBeNull();

      fireEvent.change(editor, { target: { value: "" } });
      expect(screen.queryByRole("button", { name: "开始" })).toBeNull();

      act(() => {
        vi.advanceTimersByTime(249);
      });
      expect(screen.queryByRole("button", { name: "开始" })).toBeNull();

      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(screen.getByRole("button", { name: "开始" })).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows the empty page card after a single space is typed and deleted", async () => {
    vi.useFakeTimers();
    try {
      renderRenderer("");

      fireEvent.click(screen.getByRole("button", { name: "开始" }));
      const editor = screen.getByLabelText("monaco markdown editor");

      fireEvent.change(editor, { target: { value: " " } });
      expect(screen.queryByRole("button", { name: "开始" })).toBeNull();

      fireEvent.change(editor, { target: { value: "" } });
      expect(screen.queryByRole("button", { name: "开始" })).toBeNull();

      act(() => {
        vi.advanceTimersByTime(250);
      });
      expect(screen.getByRole("button", { name: "开始" })).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows the empty page card when Backspace is pressed in an already empty editor", async () => {
    vi.useFakeTimers();
    try {
      renderRenderer("");

      fireEvent.click(screen.getByRole("button", { name: "开始" }));
      const editor = screen.getByLabelText("monaco markdown editor");
      expect(screen.queryByRole("button", { name: "开始" })).toBeNull();

      fireEvent.keyDown(editor, { key: "Backspace" });
      expect(screen.queryByRole("button", { name: "开始" })).toBeNull();

      act(() => {
        vi.advanceTimersByTime(250);
      });
      expect(screen.getByRole("button", { name: "开始" })).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the editor full height with document-focused Monaco options", () => {
    renderRenderer("正文");

    const editor = screen.getByLabelText("monaco markdown editor");
    expect(editor.getAttribute("data-height")).toBe("100%");
    expect(editor.getAttribute("data-options")).toContain("\"wordWrap\":\"on\"");
    expect(editor.getAttribute("data-options")).toContain("\"wrappingIndent\":\"same\"");
    expect(editor.getAttribute("data-options")).toContain("\"lineNumbers\":\"on\"");
    expect(editor.getAttribute("data-options")).toContain("\"horizontal\":\"hidden\"");
  });

  it("applies a template from the empty page card", async () => {
    renderRenderer("");

    fireEvent.click(screen.getByRole("button", { name: "从模板创建" }));
    fireEvent.click(await screen.findByText("Markdown Documentation"));

    await waitFor(() => {
      expect(mocks.applyTemplateMutateAsync).toHaveBeenCalledWith({
        workspace_path: "/tmp/workspace",
        uid: "0623-blank",
        template_id: "markdown-docs",
      });
    });
  });
});
