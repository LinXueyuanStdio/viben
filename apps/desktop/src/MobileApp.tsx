import { Suspense, Component, type ReactNode } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { MobileLayout } from "@/components/mobile/mobile-layout";
import { ConnectPage, DeviceListPage, MobileChatPage } from "@/pages";

class AppErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[AppErrorBoundary] Caught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-screen bg-background text-foreground p-4">
          <div className="text-center max-w-md">
            <h1 className="text-xl font-bold mb-2">Something went wrong</h1>
            <p className="text-sm text-muted-foreground mb-4">
              {this.state.error?.message || "Unknown error"}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded"
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function MobileApp() {
  const { t } = useTranslation();

  return (
    <AppErrorBoundary>
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-screen bg-background">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2 text-foreground">{t("common.loading")}</span>
          </div>
        }
      >
        <BrowserRouter>
          <Routes>
            <Route path="/m" element={<MobileLayout />}>
              <Route path="connect" element={<ConnectPage />} />
              <Route path="devices" element={<DeviceListPage />} />
              <Route path="chat" element={<MobileChatPage />} />
              <Route index element={<Navigate to="connect" replace />} />
            </Route>
            <Route path="*" element={<Navigate to="/m/connect" replace />} />
          </Routes>
        </BrowserRouter>
      </Suspense>
    </AppErrorBoundary>
  );
}

export default MobileApp;
