import "./index.css";

import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TrayPopupPage } from "@/pages/tray-popup";

import "./i18n";

if (window.__TAURI_INTERNALS__ && !import.meta.env.DEV) {
  document.addEventListener("contextmenu", (event) => {
    const target = event.target as HTMLElement;
    const isEditable =
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable ||
      target.closest('[contenteditable="true"]');

    const allowContextMenu = target.closest("[data-allow-context-menu]");

    if (!isEditable && !allowContextMenu) {
      event.preventDefault();
    }
  });
}

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
      <TrayPopupPage />
      <Toaster />
    </QueryClientProvider>
  </React.StrictMode>
);
