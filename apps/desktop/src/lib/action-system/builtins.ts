import { toPng } from "html-to-image";
import type { ClientToolResult } from "../client-side-tool/types";
import type { ExecutionContext } from "./types";
import { useActionStore } from "@/stores/action-store";

/**
 * Execute a built-in action. Returns null if the action name is not a built-in.
 */
export async function executeBuiltin(
  action: string,
  payload: unknown,
  ctx: ExecutionContext
): Promise<ClientToolResult | null> {
  switch (action) {
    case "list_actions":
      return handleListActions();
    case "get_action_detail":
      return handleGetActionDetail(payload);
    case "read_window":
      return handleReadWindow(ctx);
    case "navigate_to":
      return handleNavigateTo(payload, ctx);
    default:
      return null; // Not a built-in
  }
}

function handleListActions(): ClientToolResult {
  const store = useActionStore.getState();
  const actions = store.listActions();
  return {
    content: [{ type: "text", text: JSON.stringify(actions, null, 2) }],
  };
}

function handleGetActionDetail(payload: unknown): ClientToolResult {
  const { action } = (payload as { action?: string }) || {};
  if (!action) {
    return {
      content: [{ type: "text", text: 'validation_error: missing required field "action"' }],
      isError: true,
    };
  }

  const store = useActionStore.getState();
  const detail = store.getActionDetail(action);
  if (!detail) {
    return {
      content: [{ type: "text", text: `action_not_available: "${action}" is not registered` }],
      isError: true,
    };
  }

  return {
    content: [{ type: "text", text: JSON.stringify(detail, null, 2) }],
  };
}

async function handleReadWindow(ctx: ExecutionContext): Promise<ClientToolResult> {
  try {
    await ctx.requireApproval("Allow the agent to capture the current application window?", {
      title: "Screen Capture",
      description: "The screenshot will be sent back as the GUI action result.",
      confirmLabel: "Allow",
    });

    const appRoot = document.getElementById("root");
    if (!appRoot) {
      return {
        content: [{ type: "text", text: "read_window failed: no root element found" }],
        isError: true,
      };
    }

    const dataUrl = await toPng(appRoot, {
      quality: 0.8,
      pixelRatio: 1,
    });

    // Strip the data:image/png;base64, prefix
    const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, "");

    return {
      content: [{ type: "image", data: base64, mimeType: "image/png" }],
    };
  } catch (err) {
    return {
      content: [{ type: "text", text: `read_window failed: ${String(err)}` }],
      isError: true,
    };
  }
}

async function handleNavigateTo(payload: unknown, ctx: ExecutionContext): Promise<ClientToolResult> {
  const { url } = (payload as { url?: string }) || {};
  if (!url) {
    return {
      content: [{ type: "text", text: 'validation_error: missing required field "url"' }],
      isError: true,
    };
  }

  try {
    const path = normalizeNavigationPath(url);
    if (!path) {
      return {
        content: [{ type: "text", text: "validation_error: url must be an in-app relative path" }],
        isError: true,
      };
    }

    await ctx.requireApproval(`Allow the agent to navigate to ${path}?`, {
      title: "Navigate",
      description: "This changes the current app route.",
      confirmLabel: "Navigate",
    });

    // Use history.pushState + popstate event for SPA navigation.
    // BrowserRouter listens to popstate events, so this triggers a route
    // change without a full page reload (which would destroy React state).
    window.history.pushState(null, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
    return {
      content: [{ type: "text", text: JSON.stringify({ success: true, url: path }) }],
    };
  } catch (err) {
    return {
      content: [{ type: "text", text: `navigate_to failed: ${String(err)}` }],
      isError: true,
    };
  }
}

function normalizeNavigationPath(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith("//")) return null;
  if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(trimmed)) return null;

  const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  if (path.includes("\\")) return null;

  return path;
}
