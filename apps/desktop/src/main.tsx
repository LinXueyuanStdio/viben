import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { Toaster } from "@/components/ui/toaster";
import "./index.css";

// Initialize i18n before rendering
import "./i18n";

// Disable browser's default context menu in Tauri environment
// Custom context menus (ContextMenu component) still work as they use onContextMenu + preventDefault
if (window.__TAURI_INTERNALS__) {
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

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster />
    </QueryClientProvider>
  </React.StrictMode>
);
