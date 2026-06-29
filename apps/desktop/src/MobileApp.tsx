import { Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ErrorBoundary } from "@/lib/analytics/error-boundary";
import { AnalyticsContextProvider } from "@/lib/analytics";
import { MobileLayout } from "@/components/mobile/mobile-layout";
import { ConnectPage, DeviceListPage, MobileChatPage } from "@/pages";

function MobileApp() {
  const { t } = useTranslation();

  return (
    <AnalyticsContextProvider>
    <ErrorBoundary name="MobileApp">
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
    </ErrorBoundary>
    </AnalyticsContextProvider>
  );
}

export default MobileApp;
