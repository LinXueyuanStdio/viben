import { initApp } from "@/lib/init";
import { ErrorBoundary } from "@/lib/analytics/error-boundary";

initApp();

import ReactDOM from "react-dom/client";
import { ScreenshotOverlayPage } from "./pages/screenshot-overlay";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <ErrorBoundary name="ScreenshotOverlay">
    <ScreenshotOverlayPage />
  </ErrorBoundary>
);
