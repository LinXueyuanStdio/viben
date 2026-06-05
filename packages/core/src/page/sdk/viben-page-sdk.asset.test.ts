// @vitest-environment jsdom
/// <reference lib="dom" />
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

interface PageSdk {
  actions: {
    ready: Promise<boolean>;
    register: (namespace: string, actions: Record<string, PageActionDefinition>) => () => void;
    unregister: (namespace?: string) => void;
    list: () => PageActionMetadata[];
  };
}

interface PageActionDefinition {
  description: string;
  input_schema?: Record<string, unknown>;
  output_schema?: Record<string, unknown>;
  execute: (payload: unknown, context: unknown) => Promise<unknown> | unknown;
}

interface PageActionMetadata {
  namespace: string;
  action: string;
  description: string;
  input_schema?: Record<string, unknown>;
  output_schema?: Record<string, unknown>;
}

interface PostedMessage {
  type?: string;
  request_id?: string;
  namespace?: string;
  actions?: Record<string, unknown>;
  execute_request_id?: string;
  message?: string;
  result?: unknown;
}

declare global {
  interface Window {
    VibenPage?: PageSdk;
  }
}

const sdkMessages: Array<{ type: string; listener: EventListenerOrEventListenerObject }> = [];

function loadSdk(): PageSdk {
  const sdkPath = resolve(process.cwd(), "assets/viben-page-sdk.js");
  window.eval(readFileSync(sdkPath, "utf8"));
  if (!window.VibenPage) {
    throw new Error("VibenPage was not initialized");
  }
  return window.VibenPage;
}

function useIframeParent(): { postMessage: (message: unknown, targetOrigin: string) => void } {
  const parent = { postMessage: vi.fn() };
  Object.defineProperty(window, "parent", {
    value: parent,
    configurable: true,
  });
  return parent;
}

function dispatchFromParent(data: Record<string, unknown>, origin = "http://localhost:1549"): void {
  window.dispatchEvent(
    new MessageEvent("message", {
      origin,
      source: window.parent,
      data,
    })
  );
}

function messageOfType(posted: unknown[], type: string): PostedMessage {
  const message = posted.find(
    (item) => typeof item === "object" && item !== null && (item as PostedMessage).type === type
  );
  if (!message) {
    throw new Error(`Expected posted message of type ${type}`);
  }
  return message as PostedMessage;
}

describe("viben-page-sdk action provider", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    for (const { type, listener } of sdkMessages.splice(0)) {
      window.removeEventListener(type, listener);
    }
    const originalAddEventListener = window.addEventListener.bind(window);
    vi.spyOn(window, "addEventListener").mockImplementation((type, listener, options) => {
      if (type === "message" || type === "beforeunload") {
        sdkMessages.push({ type, listener });
      }
      return originalAddEventListener(type, listener, options);
    });
    document.documentElement.className = "";
    history.replaceState(null, "", "/page.html?theme=light");
    Object.defineProperty(window, "parent", {
      value: window,
      configurable: true,
    });
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    delete window.VibenPage;
  });

  it("sends ready to any parent origin then locks to the init origin", () => {
    const parent = useIframeParent();
    const posted: Array<{ message: unknown; targetOrigin: string }> = [];
    vi.mocked(parent.postMessage).mockImplementation((message: unknown, targetOrigin: string) => {
      posted.push({ message, targetOrigin });
    });

    loadSdk();
    expect(posted).toContainEqual({
      message: { type: "viben-page-ready" },
      targetOrigin: "*",
    });

    dispatchFromParent({
      type: "viben-page-init",
      theme: "dark",
      workspace_path: "/workspace",
    });
    dispatchFromParent({
      type: "viben-page-theme",
      theme: "light",
    }, "http://evil.local");

    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("keeps early registrations locally and syncs them after init", () => {
    const parent = useIframeParent();
    const posted: unknown[] = [];
    vi.mocked(parent.postMessage).mockImplementation((message: unknown) => {
      posted.push(message);
    });

    const sdk = loadSdk();
    sdk.actions.register("todo", {
      add_item: {
        description: "Add an item",
        input_schema: { type: "object" },
        execute: async () => "added",
      },
    });

    expect(sdk.actions.list()).toEqual([
      {
        namespace: "todo",
        action: "add_item",
        description: "Add an item",
        input_schema: { type: "object" },
      },
    ]);

    dispatchFromParent({
      type: "viben-page-init",
      theme: "dark",
      workspace_path: "/workspace",
    });

    expect(posted).toContainEqual(expect.objectContaining({ type: "viben-page-ready" }));
    expect(posted).toContainEqual(
      expect.objectContaining({
        type: "viben-page-actions-register",
        namespace: "todo",
        actions: {
          add_item: {
            description: "Add an item",
            input_schema: { type: "object" },
          },
        },
      })
    );
  });

  it("executes registered actions and normalizes object results", async () => {
    const parent = useIframeParent();
    const posted: unknown[] = [];
    vi.mocked(parent.postMessage).mockImplementation((message: unknown) => {
      posted.push(message);
    });

    const sdk = loadSdk();
    sdk.actions.register("todo", {
      add_item: {
        description: "Add an item",
        execute: async (payload, context) => ({
          ok: true,
          text: (payload as { text: string }).text,
          workspacePath: (context as { workspacePath: string | null }).workspacePath,
        }),
      },
    });
    dispatchFromParent({
      type: "viben-page-init",
      theme: "light",
      workspace_path: "/workspace",
    });

    dispatchFromParent({
      type: "viben-page-action-execute",
      request_id: "exec-1",
      namespace: "todo",
      action: "add_item",
      payload: { text: "Ship" },
      context: {
        session_id: "s1",
        tool_use_id: "t1",
        full_action: "page.ws.page.todo.add_item",
        page_slug: "dashboard",
        workspace_path: "/workspace",
      },
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(posted).toContainEqual({
      type: "viben-page-action-result",
      request_id: "exec-1",
      result: {
        content: [{ type: "text", text: "{\"ok\":true,\"text\":\"Ship\",\"workspacePath\":\"/workspace\"}" }],
        structuredContent: { ok: true, text: "Ship", workspacePath: "/workspace" },
      },
    });
  });

  it("binds approval requests to the active execute request", async () => {
    const parent = useIframeParent();
    const posted: unknown[] = [];
    vi.mocked(parent.postMessage).mockImplementation((message: unknown) => {
      posted.push(message);
    });

    const sdk = loadSdk();
    sdk.actions.register("todo", {
      guarded: {
        description: "Guarded action",
        execute: async (_payload, context) => {
          await (context as { requireApproval: (message: string) => Promise<boolean> }).requireApproval("Allow?");
          return "approved";
        },
      },
    });
    dispatchFromParent({
      type: "viben-page-init",
      theme: "light",
      workspace_path: "/workspace",
    });

    dispatchFromParent({
      type: "viben-page-action-execute",
      request_id: "exec-2",
      namespace: "todo",
      action: "guarded",
      payload: {},
      context: {
        session_id: "s1",
        tool_use_id: "t1",
        full_action: "page.ws.p.todo.guarded",
        page_slug: "p",
        workspace_path: "/workspace",
      },
    });

    await Promise.resolve();
    const approvalRequest = messageOfType(posted, "viben-page-action-approval-request");
    expect(approvalRequest).toEqual(
      expect.objectContaining({
        type: "viben-page-action-approval-request",
        execute_request_id: "exec-2",
        message: "Allow?",
      })
    );

    dispatchFromParent({
      type: "viben-page-action-approval-result",
      request_id: approvalRequest.request_id,
      execute_request_id: "exec-2",
      approved: true,
    });

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(posted).toContainEqual({
      type: "viben-page-action-result",
      request_id: "exec-2",
      result: { content: [{ type: "text", text: "approved" }] },
    });
  });

  it("rejects approval when the bridge is unavailable", async () => {
    const parent = useIframeParent();
    const posted: unknown[] = [];
    vi.mocked(parent.postMessage).mockImplementation((message: unknown) => {
      posted.push(message);
    });

    const sdk = loadSdk();
    sdk.actions.register("todo", {
      guarded: {
        description: "Guarded action",
        execute: async (_payload, context) => {
          await (context as { requireApproval: (message: string) => Promise<boolean> }).requireApproval("Allow?");
        },
      },
    });

    dispatchFromParent({
      type: "viben-page-action-execute",
      request_id: "exec-3",
      namespace: "todo",
      action: "guarded",
      payload: {},
      context: {
        session_id: "s1",
        tool_use_id: "t1",
        full_action: "page.ws.p.todo.guarded",
        page_slug: "p",
        workspace_path: "/workspace",
      },
    });

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(posted).toContainEqual({
      type: "viben-page-action-result",
      request_id: "exec-3",
      result: {
        content: [{ type: "text", text: "execution_error: page_action_bridge_unavailable" }],
        isError: true,
      },
    });
  });
});
