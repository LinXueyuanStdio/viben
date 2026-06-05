import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionDef, ExecutionContext } from "@/lib/action-system/types";
import type { ClientToolResult } from "@/lib/client-side-tool/types";
import {
  createPageActionBridge,
  encodePageActionSegment,
} from "./page-action-bridge";

interface RegisteredProvider {
  providerId: string;
  namespace: string;
  actions: ActionDef[];
}

interface FakeIframeWindow {
  postMessage: (message: unknown, targetOrigin: string) => void;
}

function createHarness() {
  const posted: Array<{ message: unknown; targetOrigin: string }> = [];
  const iframeWindow: FakeIframeWindow = {
    postMessage: vi.fn((message: unknown, targetOrigin: string) => {
      posted.push({ message, targetOrigin });
    }),
  };
  const iframe = { contentWindow: iframeWindow } as unknown as HTMLIFrameElement;
  const providers = new Map<string, RegisteredProvider>();
  let handler: ((event: MessageEvent) => void) | null = null;
  const bridge = createPageActionBridge({
    iframe,
    gatewayOrigin: "http://127.0.0.1:18790",
    workspacePath: "/workspace/main",
    workspaceId: "main",
    pageSlug: "reports/daily",
    theme: "dark",
    registerActions: (providerId, namespace, actions) => {
      providers.set(providerId, { providerId, namespace, actions });
    },
    unregisterActions: (providerId) => {
      providers.delete(providerId);
    },
    addWindowMessageListener: (nextHandler) => {
      handler = nextHandler;
      return () => {
        handler = null;
      };
    },
    setTimeoutFn: ((callback: () => void) => setTimeout(callback, 30)) as typeof setTimeout,
  });

  function dispatch(data: Record<string, unknown>, source: unknown = iframeWindow, origin = "http://127.0.0.1:18790") {
    if (!handler) throw new Error("message handler missing");
    handler({ data, origin, source } as MessageEvent);
  }

  return { bridge, posted, iframeWindow, iframe, providers, dispatch };
}

function createExecutionContext(): ExecutionContext {
  return {
    sessionId: "session-1",
    toolUseId: "tool-1",
    requireApproval: vi.fn(async () => true),
  };
}

function firstRegisteredAction(providers: Map<string, RegisteredProvider>): ActionDef {
  const provider = [...providers.values()][0];
  if (!provider) throw new Error("expected registered provider");
  return provider.actions[0];
}

describe("page-action-bridge", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("encodes page action segments into stable identifier-safe keys", () => {
    expect(encodePageActionSegment("reports/daily")).toBe("reports_2Fdaily");
    expect(encodePageActionSegment("Revenue 2026")).toBe("Revenue_202026");
    expect(encodePageActionSegment("")).toBe("empty");
  });

  it("accepts only messages from the current iframe source and gateway origin", () => {
    const { dispatch, providers } = createHarness();

    dispatch({
      type: "viben-page-actions-register",
      request_id: "bad-origin",
      namespace: "todo",
      actions: { add_item: { description: "Add item" } },
    }, undefined, "http://evil.local");
    expect(providers.size).toBe(0);

    dispatch({
      type: "viben-page-actions-register",
      request_id: "bad-source",
      namespace: "todo",
      actions: { add_item: { description: "Add item" } },
    }, { postMessage: vi.fn() });
    expect(providers.size).toBe(0);
  });

  it("registers page actions under the page namespace with workspace and page keys", () => {
    const { dispatch, providers, posted } = createHarness();

    dispatch({
      type: "viben-page-actions-register",
      request_id: "reg-1",
      namespace: "todo",
      actions: {
        add_item: {
          description: "Add item",
          input_schema: { type: "object" },
        },
      },
    });

    const provider = [...providers.values()][0];
    expect(provider.namespace).toBe("page");
    expect(provider.actions).toHaveLength(1);
    expect(provider.actions[0].name).toMatch(/^main\.reports_2Fdaily\.[a-zA-Z0-9_-]+\.todo\.add_item$/);
    expect(provider.actions[0]).toMatchObject({
      description: "Add item",
      input_schema: { type: "object" },
    });
    expect(posted).toContainEqual({
      message: {
        type: "viben-page-actions-register-result",
        request_id: "reg-1",
        accepted: ["add_item"],
        rejected: [],
      },
      targetOrigin: "http://127.0.0.1:18790",
    });
  });

  it("executes a registered iframe action and returns its result", async () => {
    const { dispatch, providers, posted } = createHarness();

    dispatch({
      type: "viben-page-actions-register",
      request_id: "reg-1",
      namespace: "todo",
      actions: { add_item: { description: "Add item" } },
    });

    const executePromise = firstRegisteredAction(providers).execute({ text: "Ship" }, createExecutionContext());
    const executeMessage = posted.find(
      (entry) => (entry.message as { type?: string }).type === "viben-page-action-execute"
    );
    expect(executeMessage).toMatchObject({
      targetOrigin: "http://127.0.0.1:18790",
      message: {
        type: "viben-page-action-execute",
        namespace: "todo",
        action: "add_item",
        payload: { text: "Ship" },
        context: {
          session_id: "session-1",
          tool_use_id: "tool-1",
          full_action: expect.stringMatching(/^page\.main\.reports_2Fdaily\.[a-zA-Z0-9_-]+\.todo\.add_item$/),
          page_slug: "reports/daily",
          workspace_path: "/workspace/main",
        },
      },
    });

    dispatch({
      type: "viben-page-action-result",
      request_id: (executeMessage?.message as { request_id: string }).request_id,
      result: { content: [{ type: "text", text: "added" }] },
    });

    await expect(executePromise).resolves.toEqual({ content: [{ type: "text", text: "added" }] });
  });

  it("cleans an existing namespace provider when a re-register has no valid actions", () => {
    const { dispatch, providers } = createHarness();

    dispatch({
      type: "viben-page-actions-register",
      request_id: "reg-1",
      namespace: "todo",
      actions: { add_item: { description: "Add item" } },
    });
    expect(providers.size).toBe(1);

    dispatch({
      type: "viben-page-actions-register",
      request_id: "reg-2",
      namespace: "todo",
      actions: {},
    });

    expect(providers.size).toBe(0);
  });

  it("does not post approval results after execute is cancelled", async () => {
    const approval = {
      resolve: (_value: boolean) => {},
    };
    const { bridge, dispatch, providers, posted } = createHarness();
    const ctx: ExecutionContext = {
      sessionId: "session-1",
      toolUseId: "tool-1",
      requireApproval: vi.fn(
        () =>
          new Promise<boolean>((resolve) => {
            approval.resolve = resolve;
          })
      ),
    };

    dispatch({
      type: "viben-page-actions-register",
      request_id: "reg-1",
      namespace: "todo",
      actions: { guarded: { description: "Guarded" } },
    });

    const executePromise = firstRegisteredAction(providers).execute({}, ctx);
    const executeMessage = posted.find(
      (entry) => (entry.message as { type?: string }).type === "viben-page-action-execute"
    );
    const executeRequestId = (executeMessage?.message as { request_id: string }).request_id;
    dispatch({
      type: "viben-page-action-approval-request",
      request_id: "approval-1",
      execute_request_id: executeRequestId,
      message: "Allow?",
    });
    await Promise.resolve();

    bridge.dispose("page_action_cancelled");
    approval.resolve(true);
    await Promise.resolve();

    expect(posted).not.toContainEqual({
      message: {
        type: "viben-page-action-approval-result",
        request_id: "approval-1",
        execute_request_id: executeRequestId,
        approved: true,
      },
      targetOrigin: "http://127.0.0.1:18790",
    });
    await expect(executePromise).resolves.toEqual({
      content: [{ type: "text", text: "page_action_cancelled" }],
      isError: true,
    });
  });

  it("binds approval requests to an active execute request", async () => {
    const { dispatch, providers, posted } = createHarness();
    const ctx = createExecutionContext();

    dispatch({
      type: "viben-page-actions-register",
      request_id: "reg-1",
      namespace: "todo",
      actions: { guarded: { description: "Guarded" } },
    });

    const executePromise = firstRegisteredAction(providers).execute({}, ctx);
    const executeMessage = posted.find(
      (entry) => (entry.message as { type?: string }).type === "viben-page-action-execute"
    );
    const executeRequestId = (executeMessage?.message as { request_id: string }).request_id;

    dispatch({
      type: "viben-page-action-approval-request",
      request_id: "approval-1",
      execute_request_id: "wrong-exec",
      message: "Allow?",
    });
    expect(ctx.requireApproval).not.toHaveBeenCalled();

    dispatch({
      type: "viben-page-action-approval-request",
      request_id: "approval-2",
      execute_request_id: executeRequestId,
      message: "Allow?",
    });
    await Promise.resolve();

    expect(ctx.requireApproval).toHaveBeenCalledWith("Allow?", undefined);
    expect(posted).toContainEqual({
      message: {
        type: "viben-page-action-approval-result",
        request_id: "approval-2",
        execute_request_id: executeRequestId,
        approved: true,
      },
      targetOrigin: "http://127.0.0.1:18790",
    });

    dispatch({
      type: "viben-page-action-result",
      request_id: executeRequestId,
      result: { content: [{ type: "text", text: "done" }] },
    });
    await expect(executePromise).resolves.toEqual({ content: [{ type: "text", text: "done" }] });
  });

  it("cleans providers and resolves pending execute with cancellation on dispose", async () => {
    const { bridge, dispatch, providers } = createHarness();

    dispatch({
      type: "viben-page-actions-register",
      request_id: "reg-1",
      namespace: "todo",
      actions: { add_item: { description: "Add item" } },
    });
    const executePromise = firstRegisteredAction(providers).execute({}, createExecutionContext());

    expect(providers.size).toBe(1);
    bridge.dispose("page_action_cancelled");

    expect(providers.size).toBe(0);
    const expected: ClientToolResult = {
      content: [{ type: "text", text: "page_action_cancelled" }],
      isError: true,
    };
    await expect(executePromise).resolves.toEqual(expected);
  });

  it("sends init on ready and theme updates to the current iframe", () => {
    const { bridge, dispatch, posted } = createHarness();

    dispatch({ type: "viben-page-ready" });
    bridge.updateTheme("light");

    expect(posted).toContainEqual({
      message: {
        type: "viben-page-init",
        theme: "dark",
        workspace_path: "/workspace/main",
      },
      targetOrigin: "http://127.0.0.1:18790",
    });
    expect(posted).toContainEqual({
      message: { type: "viben-page-theme", theme: "light" },
      targetOrigin: "http://127.0.0.1:18790",
    });
  });
});
