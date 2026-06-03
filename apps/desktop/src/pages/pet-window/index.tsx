// apps/desktop/src/pages/pet-window/index.tsx
import { useEffect, useState, useCallback } from "react";
import { getCurrentWindow, PhysicalPosition } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { PetSprite, type PetConfig } from "@viben/pet";
import { loadPetFromPublic } from "@/lib/pet-loader";

const API_BASE = "http://127.0.0.1:18790";

interface PetConfigResponse {
  current: string | null;
  enabled: boolean;
  preferences: {
    size: number;
    position: { right: number; bottom: number };
  };
}

async function fetchPetConfig(): Promise<PetConfigResponse | null> {
  try {
    console.log("[PetWindow] Fetching pet config from:", `${API_BASE}/api/pet/config`);
    const res = await fetch(`${API_BASE}/api/pet/config`);
    if (!res.ok) {
      console.log("[PetWindow] fetchPetConfig failed with status:", res.status);
      return null;
    }
    const data = await res.json();
    console.log("[PetWindow] fetchPetConfig result:", data.config);
    return data.config;
  } catch (err) {
    console.error("[PetWindow] fetchPetConfig error:", err);
    return null;
  }
}

async function updatePetPosition(right: number, bottom: number): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/pet/config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preferences: { position: { right, bottom } } }),
    });
  } catch {
    // Ignore errors
  }
}

const PET_SIZE = 96;
const WINDOW_PADDING = 16;
const WINDOW_SIZE = PET_SIZE + WINDOW_PADDING * 2;

export default function PetWindowPage() {
  console.log("[PetWindowPage] Component rendering");

  const [pet, setPet] = useState<PetConfig | null>(null);
  const [config, setConfig] = useState<PetConfigResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  // Load config and pet
  useEffect(() => {
    console.log("[PetWindowPage] useEffect triggered, reloadKey:", reloadKey);
    let mounted = true;

    async function init() {
      console.log("[PetWindowPage] init() starting...");
      const cfg = await fetchPetConfig();
      console.log("[PetWindowPage] Config fetched:", JSON.stringify(cfg, null, 2));

      if (!mounted) {
        console.log("[PetWindowPage] Component unmounted during fetch, aborting");
        return;
      }

      setConfig(cfg);

      if (!cfg?.enabled || !cfg.current) {
        // Hide window if pet is disabled or not selected
        console.log("[PetWindowPage] Pet disabled or no current pet selected. enabled:", cfg?.enabled, "current:", cfg?.current);
        const win = getCurrentWindow();
        console.log("[PetWindowPage] Hiding window...");
        await win.hide();
        console.log("[PetWindowPage] Window hidden");
        setPet(null);
        setLoading(false);
        return;
      }

      console.log("[PetWindowPage] Pet enabled and selected, loading pet:", cfg.current);

      // Load pet
      try {
        console.log("[PetWindowPage] Calling loadPetFromPublic with:", cfg.current);
        const petData = await loadPetFromPublic(cfg.current);
        console.log("[PetWindowPage] Pet data loaded:", petData ? "success" : "null");
        if (!mounted) return;
        setPet(petData);

        // Position and show window
        const win = getCurrentWindow();
        console.log("[PetWindowPage] Getting monitors...");
        const monitors = await (await import("@tauri-apps/api/window")).availableMonitors();
        console.log("[PetWindowPage] Monitors found:", monitors.length);
        const primaryMonitor = monitors[0];
        if (primaryMonitor) {
          const screenWidth = primaryMonitor.size.width;
          const screenHeight = primaryMonitor.size.height;
          console.log("[PetWindowPage] Screen size:", screenWidth, "x", screenHeight);
          const x = screenWidth - cfg.preferences.position.right - WINDOW_SIZE;
          const y = screenHeight - cfg.preferences.position.bottom - WINDOW_SIZE;
          console.log("[PetWindowPage] Setting window position to:", x, y);
          await win.setPosition(new PhysicalPosition(x, y));
        }
        console.log("[PetWindowPage] Showing window...");
        await win.show();
        console.log("[PetWindowPage] Window shown successfully");
      } catch (err) {
        console.error("[PetWindowPage] Failed to load pet:", err);
      }

      setLoading(false);
      console.log("[PetWindowPage] init() complete");
    }

    init();

    return () => {
      console.log("[PetWindowPage] useEffect cleanup");
      mounted = false;
    };
  }, [reloadKey]);

  // Listen for config changes from settings
  useEffect(() => {
    const unlisten = listen("pet-config-changed", () => {
      setReloadKey((k) => k + 1);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // Handle window dragging using Tauri's native drag
  const handleMouseDown = useCallback(async (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    console.log("[PetWindowPage] Mouse down, starting drag");

    const win = getCurrentWindow();
    // Use Tauri's native window dragging
    await win.startDragging();
    console.log("[PetWindowPage] startDragging called");
  }, []);

  // Save position when window is moved (after drag ends)
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const savePosition = async () => {
      const win = getCurrentWindow();
      const pos = await win.outerPosition();
      const monitors = await (await import("@tauri-apps/api/window")).availableMonitors();
      const primaryMonitor = monitors[0];

      if (primaryMonitor) {
        const screenWidth = primaryMonitor.size.width;
        const screenHeight = primaryMonitor.size.height;
        const right = screenWidth - pos.x - WINDOW_SIZE;
        const bottom = screenHeight - pos.y - WINDOW_SIZE;
        await updatePetPosition(right, bottom);
        console.log("[PetWindowPage] Position saved:", { right, bottom });
      }
    };

    // Listen for window move events and debounce save
    const unlisten = listen("tauri://move", () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(savePosition, 500);
    });

    return () => {
      clearTimeout(timeoutId);
      unlisten.then((fn) => fn());
    };
  }, []);

  if (loading) {
    return (
      <div
        style={{
          width: "100vw",
          height: "100vh",
          background: "transparent",
        }}
      />
    );
  }

  if (!config?.enabled || !pet) {
    return (
      <div
        style={{
          width: "100vw",
          height: "100vh",
          background: "transparent",
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "transparent",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "grab",
      }}
      onMouseDown={handleMouseDown}
    >
      <PetSprite
        pet={pet}
        rowId="idle"
        size={PET_SIZE}
      />
    </div>
  );
}
