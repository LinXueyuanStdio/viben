// CSS must be imported FIRST for @tailwindcss/vite to properly detect all utility classes
// during production build (before any components that use Tailwind classes are imported)
import "./index.css";

import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { Toaster } from "@/components/ui/toaster";

// Initialize Analytics before app renders
import { initApp } from "@/lib/init";
import { getProvider } from "@/lib/analytics/factory";
import { AnalyticsEvents, getSessionId } from "@/lib/analytics/types";
import { getPlatformType } from "@/lib/platform";

initApp();

// Initialize i18n before rendering
import "./i18n";

// Disable browser's default context menu in Tauri environment (production only)
// In dev mode, allow browser context menu for debugging (Inspect Element, etc.)
// Custom context menus (ContextMenu component) still work as they use onContextMenu + preventDefault
if (window.__TAURI_INTERNALS__ && !import.meta.env.DEV) {
  document.addEventListener("contextmenu", (e) => {
    // Allow context menu on editable elements (input, textarea, contenteditable)
    const target = e.target as HTMLElement;
    const isEditable =
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable ||
      target.closest('[contenteditable="true"]');

    // Allow if element or ancestor has data-allow-context-menu attribute
    const allowContextMenu = target.closest("[data-allow-context-menu]");

    if (!isEditable && !allowContextMenu) {
      e.preventDefault();
    }
  });
}

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Report app_launch event
try {
  let platform = "unknown";
  try {
    platform = getPlatformType();
  } catch {
    // platform detection may fail early
  }
  getProvider().logEvent(AnalyticsEvents.APP_LAUNCHED, {
    platform,
    app_version: import.meta.env.VITE_APP_VERSION || "0.0.0",
    is_first_launch: !localStorage.getItem("viben_has_launched"),
  });
  localStorage.setItem("viben_has_launched", "true");
} catch {
  // Analytics not yet available, skip
}

// Report app_session_start event
const sessionStartTime = Date.now();
try {
  getProvider().logEvent(AnalyticsEvents.APP_SESSION_START, {
    session_id: getSessionId(),
    previous_session_duration_ms: 0,
    session_gap_ms: 0,
  });
} catch {
  // Analytics not yet available, skip
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster />
    </QueryClientProvider>
  </React.StrictMode>
);

// Session end tracking
let sessionEndReported = false;

function reportSessionEnd(): void {
  if (sessionEndReported) return;
  sessionEndReported = true;

  try {
    const durationMs = Date.now() - sessionStartTime;
    getProvider().logEvent(AnalyticsEvents.APP_SESSION_END, {
      session_id: getSessionId(),
      session_duration_ms: durationMs,
      pages_viewed_count: 0,
      messages_sent_count: 0,
      tasks_created_count: 0,
    });
  } catch {
    // Analytics not available, skip
  }
}

// Report session end when page becomes hidden (tab switch, minimize)
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    reportSessionEnd();
  }
});

// Report session end when page unloads (tab close, navigation)
window.addEventListener("beforeunload", () => {
  reportSessionEnd();
  try {
    getProvider().flush();
  } catch {
    // Flush not available
  }
});
