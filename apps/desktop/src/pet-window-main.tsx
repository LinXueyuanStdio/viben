import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AcpChat } from "@/components/acp-chat";
import { Toaster } from "@/components/ui/toaster";
import "@viben/pet/styles/pet.css";
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

function FloatingChatWindow() {
  const [mode, setMode] = useState<"floating" | "compact" | "expanded" | "full">("floating");

  return (
    <div className="h-screen w-screen overflow-hidden bg-background/95 backdrop-blur-sm rounded-xl border border-border">
      <AcpChat
        mode={mode}
        onModeChange={setMode}
        contained
        className="h-full"
      />
    </div>
  );
}

const root = document.getElementById("root");

if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <FloatingChatWindow />
        <Toaster />
      </QueryClientProvider>
    </React.StrictMode>
  );
}
