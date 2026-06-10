import "./i18n";
import "./index.css";

import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ChatWindowPage from "@/pages/chat-window";
import { Toaster } from "@/components/ui/toaster";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const root = document.getElementById("root");

if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <ChatWindowPage />
        <Toaster />
      </QueryClientProvider>
    </React.StrictMode>
  );
}
