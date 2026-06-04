import { toPng } from "html-to-image";
import type { ClientToolResult } from "../client-side-tool/types";
import type { ActionDetail, ExecutionContext } from "./types";
import { useActionStore } from "@/stores/action-store";
import { navigateToPath } from "./navigation-handler";
import { ROUTE_ENTRIES, registry } from "@/navigation/route-registry";

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
  const actions = [...getBuiltinActionInfos(), ...store.listActions()];
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

  const builtinDetail = getBuiltinActionDetail(action);
  if (builtinDetail) {
    return {
      content: [{ type: "text", text: JSON.stringify(builtinDetail, null, 2) }],
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

function getBuiltinActionDetail(action: string): (ActionDetail & Record<string, unknown>) | null {
  switch (action) {
    case "list_actions":
      return {
        name: "list_actions",
        description: "List currently available GUI actions. Builtin actions are unprefixed; frontend provider actions use namespace.name.",
        input_schema: {
          type: "object",
          properties: {},
        },
        output_schema: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              description: { type: "string" },
            },
            required: ["name", "description"],
          },
        },
      };
    case "get_action_detail":
      return {
        name: "get_action_detail",
        description: "Return description and JSON schema details for a builtin or registered GUI action.",
        input_schema: {
          type: "object",
          properties: {
            action: {
              type: "string",
              description: "Action name to inspect. Builtins are unprefixed; provider actions use namespace.name.",
            },
          },
          required: ["action"],
        },
        output_schema: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            input_schema: { type: "object" },
            output_schema: { type: "object" },
          },
          required: ["name", "description"],
        },
      };
    case "read_window":
      return {
        name: "read_window",
        description: "Capture the current desktop app window as a PNG image after user approval.",
        input_schema: {
          type: "object",
          properties: {},
        },
        output_schema: {
          type: "object",
          properties: {
            content: { type: "array" },
            isError: { type: "boolean" },
          },
          required: ["content"],
        },
      };
    case "navigate_to":
      return {
        name: "navigate_to",
        description:
          "Navigate to an in-app desktop route through Viben's tab and breadcrumb navigation system. The url must be a relative route matching one of the supported route patterns.",
        input_schema: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description:
                "In-app relative URL. Dynamic route parameters must be filled, for example /workspace/global/chat.",
            },
          },
          required: ["url"],
        },
        output_schema: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            url: { type: "string" },
          },
          required: ["success", "url"],
        },
        urls: ROUTE_ENTRIES.map((entry) => entry.pattern),
        routes: ROUTE_ENTRIES.map((entry) => ({
          pattern: entry.pattern,
          title: typeof entry.title === "string" ? entry.title : undefined,
          title_key: entry.titleKey,
          params: registry.getParamNames(entry.pattern),
          rest_param: registry.getRestParam(entry.pattern),
          query_params: entry.queryParams ?? [],
        })),
      };
    default:
      return null;
  }
}

function getBuiltinActionInfos() {
  return ["list_actions", "get_action_detail", "read_window", "navigate_to"]
    .map((name) => {
      const detail = getBuiltinActionDetail(name);
      return detail
        ? {
            name: detail.name,
            description: detail.description,
          }
        : null;
    })
    .filter((detail): detail is { name: string; description: string } => detail !== null);
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

    if (!registry.match(path)) {
      return {
        content: [{ type: "text", text: `validation_error: url does not match a supported app route: ${path}` }],
        isError: true,
      };
    }

    await ctx.requireApproval(`Allow the agent to navigate to ${path}?`, {
      title: "Navigate",
      description: "This changes the current app route.",
      confirmLabel: "Navigate",
    });

    navigateToPath(path);
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
