import { initApp } from "@/lib/init";
import { ErrorBoundary } from "@/lib/analytics/error-boundary";

initApp();

import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { PagePreviewWindow } from "@/pages/apps/page-preview-window";
import "./i18n";
import "./index.css";

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
      <ErrorBoundary name="PagePreviewWindow">
        <PagePreviewWindow />
        <Toaster />
      </ErrorBoundary>
    </QueryClientProvider>
  </React.StrictMode>
);
