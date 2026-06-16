import { toPng } from "html-to-image";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { ClientToolResult } from "../client-side-tool/types";
import type { ActionDetail, ExecutionContext } from "./types";
import { useActionStore } from "@/stores/action-store";
import { useAuthStore } from "@/stores/auth-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { getCurrentWindowTabStore, getTabViewModel } from "@/stores/tab-store";
import { navigateToPath } from "./navigation-handler";
import { ROUTE_ENTRIES, registry } from "@/navigation/route-registry";
import { queryRemoteActions } from "./gateway-action-socket";

const READ_WINDOW_CAPTURE_TIMEOUT_MS = 10_000;

interface ScreenshotResult {
  data: string;
  width: number;
  height: number;
}

/**
 * Execute a built-in action. Returns null if the action name is not a built-in.
 * Accepts both bare names (e.g., "read_window") and namespaced names (e.g., "desktop_main.read_window").
 */
export async function executeBuiltin(
  action: string,
  payload: unknown,
  ctx: ExecutionContext
): Promise<ClientToolResult | null> {
  // Strip desktop_main. prefix if present
  const actionName = action.startsWith(`${DESKTOP_MAIN_NAMESPACE}.`)
    ? action.slice(DESKTOP_MAIN_NAMESPACE.length + 1)
    : action;

  switch (actionName) {
    case "list_actions":
      return handleListActions();
    case "get_action_detail":
      return handleGetActionDetail(payload);
    case "read_window":
      return handleReadWindow(ctx);
    case "navigate_to":
      return handleNavigateTo(payload, ctx);
    case "list_navigation_paths":
      return handleListNavigationPaths();
    case "current_window_state":
      return handleCurrentWindowState();
    default:
      return null; // Not a built-in
  }
}

async function handleListActions(): Promise<ClientToolResult> {
  const store = useActionStore.getState();
  const localActions = [...getBuiltinActionInfos(), ...store.listActions()];

  // Also include actions from other sources (pages) registered on the gateway
  const remoteActions = await queryRemoteActions();
  const remoteActionInfos = remoteActions.map((a) => ({
    name: `${a.namespace}.${a.name}`,
    description: a.description,
  }));

  // Deduplicate: local actions take priority
  const localNames = new Set(localActions.map((a) => a.name));
  const uniqueRemote = remoteActionInfos.filter((a) => !localNames.has(a.name));

  const allActions = [...localActions, ...uniqueRemote];
  return {
    content: [{ type: "text", text: JSON.stringify(allActions, null, 2) }],
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

  // Strip desktop_main. prefix for builtin lookup
  const actionName = action.startsWith(`${DESKTOP_MAIN_NAMESPACE}.`)
    ? action.slice(DESKTOP_MAIN_NAMESPACE.length + 1)
    : action;

  const builtinDetail = getBuiltinActionDetail(actionName);
  if (builtinDetail) {
    // Return with full namespaced name for namespaced builtins
    const fullName = NAMESPACED_BUILTINS.includes(actionName)
      ? `${DESKTOP_MAIN_NAMESPACE}.${actionName}`
      : actionName;
    return {
      content: [{ type: "text", text: JSON.stringify({ ...builtinDetail, name: fullName }, null, 2) }],
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

async function handleReadWindow(_ctx: ExecutionContext): Promise<ClientToolResult> {
  try {
    const dataUrl = await captureCurrentWindowDataUrl();
    const compressed = await compressScreenshot(dataUrl, 1280, 0.75);
    const base64 = stripDataUrlPrefix(compressed);
    const mimeType = compressed.startsWith("data:image/jpeg") ? "image/jpeg" : "image/png";

    return {
      content: [{ type: "image", data: base64, mimeType }],
    };
  } catch (err) {
    return {
      content: [{ type: "text", text: `read_window failed: ${String(err)}` }],
      isError: true,
    };
  }
}

async function captureCurrentWindowDataUrl(): Promise<string> {
  try {
    return await withTimeout(captureCurrentTauriWindowDataUrl(), READ_WINDOW_CAPTURE_TIMEOUT_MS, "native window capture");
  } catch (err) {
    console.warn("[read_window] Native window capture failed, falling back to DOM capture:", err);
  }

  const appRoot = document.getElementById("root");
  if (!appRoot) {
    throw new Error("no root element found");
  }

  return await withTimeout(
    toPng(appRoot, {
      quality: 0.8,
      pixelRatio: 1,
      cacheBust: true,
      skipFonts: true,
    }),
    READ_WINDOW_CAPTURE_TIMEOUT_MS,
    "DOM PNG capture"
  );
}

async function captureCurrentTauriWindowDataUrl(): Promise<string> {
  const currentWindow = getCurrentWindow();
  const [position, size] = await Promise.all([
    currentWindow.outerPosition(),
    currentWindow.outerSize(),
  ]);
  const result = await invoke<ScreenshotResult>("take_screenshot_region", {
    x: Math.max(0, Math.round(position.x)),
    y: Math.max(0, Math.round(position.y)),
    width: Math.max(1, Math.round(size.width)),
    height: Math.max(1, Math.round(size.height)),
  });
  return result.data;
}

function compressScreenshot(dataUrl: string, maxWidth: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = img.width > maxWidth ? maxWidth / img.width : 1;
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx2d = canvas.getContext("2d");
      if (!ctx2d) { resolve(dataUrl); return; }
      ctx2d.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => reject(new Error("Failed to load screenshot for compression"));
    img.src = dataUrl;
  });
}

function stripDataUrlPrefix(dataUrl: string): string {
  return dataUrl.replace(/^data:image\/\w+;base64,/, "");
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        window.clearTimeout(timer);
        reject(err);
      }
    );
  });
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
    case "list_navigation_paths":
      return {
        name: "list_navigation_paths",
        description: "List all navigable in-app route patterns with their titles, parameters, and categories.",
        input_schema: {
          type: "object",
          properties: {},
        },
        output_schema: {
          type: "object",
          properties: {
            content: { type: "array" },
          },
        },
      };
    case "current_window_state":
      return {
        name: "current_window_state",
        description: "Get current window state as formatted text: open tabs, current URL, workspace info, page tree, navigable paths, auth status, and current time.",
        input_schema: {
          type: "object",
          properties: {},
        },
        output_schema: {
          type: "object",
          properties: {
            content: { type: "array" },
          },
        },
      };
    default:
      return null;
  }
}

const DESKTOP_MAIN_NAMESPACE = "desktop_main";

// Builtins that are namespace-scoped (registered under desktop_main)
const NAMESPACED_BUILTINS = ["read_window", "navigate_to", "list_navigation_paths", "current_window_state"];
// Builtins that are global (no namespace prefix)
const GLOBAL_BUILTINS = ["list_actions", "get_action_detail"];

function getBuiltinActionInfos() {
  const allBuiltins = [...GLOBAL_BUILTINS, ...NAMESPACED_BUILTINS];
  return allBuiltins
    .map((name) => {
      const detail = getBuiltinActionDetail(name);
      if (!detail) return null;
      // Add namespace prefix for non-global builtins
      const fullName = NAMESPACED_BUILTINS.includes(name)
        ? `${DESKTOP_MAIN_NAMESPACE}.${name}`
        : name;
      return {
        name: fullName,
        description: detail.description,
      };
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

function handleListNavigationPaths(): ClientToolResult {
  const paths = ROUTE_ENTRIES.map((entry) => {
    const params = registry.getParamNames(entry.pattern);
    const title = typeof entry.title === "string" ? entry.title : undefined;
    return {
      pattern: entry.pattern,
      title,
      titleKey: entry.titleKey,
      params: params.length > 0 ? params : undefined,
      queryParams: entry.queryParams,
      category: entry.dropdownCategory,
    };
  });

  const lines = paths.map((p) => {
    let line = p.pattern;
    if (p.title) line += `  # ${p.title}`;
    if (p.params) line += `  [params: ${p.params.join(", ")}]`;
    if (p.queryParams) line += `  [query: ${p.queryParams.join(", ")}]`;
    return line;
  });

  return {
    content: [{ type: "text", text: lines.join("\n") }],
  };
}

function handleCurrentWindowState(): ClientToolResult {
  const tabStore = getCurrentWindowTabStore();
  const tabState = tabStore.getState();

  // Tab list
  const allTabs = tabState.tabs.map((tab) => getTabViewModel(tab));
  const activeTabId = tabState.activeTabId;
  const tabLines = allTabs.map((t) => {
    const marker = t.id === activeTabId ? " *" : "";
    const pin = t.pinned ? " [pinned]" : "";
    return `  ${t.label || "(untitled)"}${pin}${marker} → ${t.url || "(empty)"}`;
  });

  // Current tab URL
  const currentUrl = activeTabId ? tabState.getCurrentUrl(activeTabId) : null;

  // Workspace
  const workspaceStore = useWorkspaceStore.getState();
  const activeWorkspace = workspaceStore.getActiveWorkspace();
  const workspacePath = activeWorkspace?.path ?? "(none)";
  const workspaceName = activeWorkspace?.name ?? "(none)";

  // Auth
  const authState = useAuthStore.getState();
  const authStatus = authState.isAuthenticated
    ? `logged in as ${authState.user?.displayName || authState.user?.username || authState.user?.email || "unknown"}`
    : "not logged in";

  // Current time
  const now = new Date();
  const timeStr = now.toLocaleString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  // Navigation paths (compact)
  const navPaths = ROUTE_ENTRIES
    .filter((e) => !e.pattern.includes(":") || e.dropdownCategory === "root")
    .map((e) => {
      const title = typeof e.title === "string" ? e.title : e.titleKey;
      return `  ${e.pattern}  # ${title || ""}`;
    });

  // Page tree (workspace pages if available)
  let pageTreeSection = "  (no workspace selected)";
  if (activeWorkspace) {
    const pagesUrl = `/workspace/${activeWorkspace.id}/page`;
    pageTreeSection = `  workspace pages: ${pagesUrl}`;
  }

  const output = [
    `=== Current Window State ===`,
    ``,
    `Time: ${timeStr}`,
    `Auth: ${authStatus}`,
    ``,
    `--- Workspace ---`,
    `Name: ${workspaceName}`,
    `Path: ${workspacePath}`,
    ``,
    `--- Tabs (${allTabs.length}) ---`,
    ...tabLines,
    ``,
    `--- Current URL ---`,
    `  ${currentUrl || "(none)"}`,
    ``,
    `--- Page Tree ---`,
    pageTreeSection,
    ``,
    `--- Navigation Paths ---`,
    ...navPaths,
  ];

  return {
    content: [{ type: "text", text: output.join("\n") }],
  };
}

function normalizeNavigationPath(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith("//")) return null;
  if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(trimmed)) return null;

  const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  if (path.includes("\\")) return null;

  return path;
}

export function getRegistrableBuiltins(): Record<string, {
  description: string
  inputSchema?: Record<string, unknown>
  outputSchema?: Record<string, unknown>
}> {
  const readWindow = getBuiltinActionDetail("read_window");
  const navigateTo = getBuiltinActionDetail("navigate_to");
  const listNavPaths = getBuiltinActionDetail("list_navigation_paths");
  const windowState = getBuiltinActionDetail("current_window_state");
  return {
    read_window: {
      description: readWindow!.description,
      inputSchema: readWindow!.input_schema as Record<string, unknown>,
      outputSchema: readWindow!.output_schema as Record<string, unknown>,
    },
    navigate_to: {
      description: navigateTo!.description,
      inputSchema: navigateTo!.input_schema as Record<string, unknown>,
      outputSchema: navigateTo!.output_schema as Record<string, unknown>,
    },
    list_navigation_paths: {
      description: listNavPaths!.description,
      inputSchema: listNavPaths!.input_schema as Record<string, unknown>,
      outputSchema: listNavPaths!.output_schema as Record<string, unknown>,
    },
    current_window_state: {
      description: windowState!.description,
      inputSchema: windowState!.input_schema as Record<string, unknown>,
      outputSchema: windowState!.output_schema as Record<string, unknown>,
    },
  };
}
