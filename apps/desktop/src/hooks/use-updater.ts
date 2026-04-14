import { useState, useCallback } from "react";
import { check, Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export interface UpdateInfo {
  version: string;
  date?: string;
  body?: string;
}

export interface UpdaterState {
  checking: boolean;
  downloading: boolean;
  downloadProgress: number;
  updateAvailable: boolean;
  updateInfo: UpdateInfo | null;
  error: string | null;
}

export function useUpdater() {
  const [state, setState] = useState<UpdaterState>({
    checking: false,
    downloading: false,
    downloadProgress: 0,
    updateAvailable: false,
    updateInfo: null,
    error: null,
  });

  const [update, setUpdate] = useState<Update | null>(null);

  const checkForUpdates = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      checking: true,
      error: null,
      updateAvailable: false,
      updateInfo: null,
    }));

    try {
      const result = await check();

      if (result) {
        setUpdate(result);
        setState((prev) => ({
          ...prev,
          checking: false,
          updateAvailable: true,
          updateInfo: {
            version: result.version,
            date: result.date,
            body: result.body,
          },
        }));
        return true;
      } else {
        setState((prev) => ({
          ...prev,
          checking: false,
          updateAvailable: false,
        }));
        return false;
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to check for updates";
      console.error("Update check failed:", error);
      setState((prev) => ({
        ...prev,
        checking: false,
        error: errorMessage,
      }));
      return false;
    }
  }, []);

  const downloadAndInstall = useCallback(async () => {
    if (!update) {
      setState((prev) => ({
        ...prev,
        error: "No update available to install",
      }));
      return false;
    }

    setState((prev) => ({
      ...prev,
      downloading: true,
      downloadProgress: 0,
      error: null,
    }));

    try {
      let downloaded = 0;
      let contentLength = 0;

      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            contentLength = event.data.contentLength ?? 0;
            console.log(`Download started, total size: ${contentLength} bytes`);
            break;
          case "Progress":
            downloaded += event.data.chunkLength;
            const progress = contentLength > 0 ? (downloaded / contentLength) * 100 : 0;
            setState((prev) => ({
              ...prev,
              downloadProgress: Math.round(progress),
            }));
            break;
          case "Finished":
            console.log("Download finished");
            setState((prev) => ({
              ...prev,
              downloadProgress: 100,
            }));
            break;
        }
      });

      // Relaunch the app after successful installation
      await relaunch();
      return true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to install update";
      console.error("Update installation failed:", error);
      setState((prev) => ({
        ...prev,
        downloading: false,
        error: errorMessage,
      }));
      return false;
    }
  }, [update]);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    checkForUpdates,
    downloadAndInstall,
    clearError,
  };
}
