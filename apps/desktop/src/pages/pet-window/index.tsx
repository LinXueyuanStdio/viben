// apps/desktop/src/pages/pet-window/index.tsx
import { useEffect, useState, useCallback, useRef } from "react";
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
    const res = await fetch(`${API_BASE}/api/pet/config`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.config;
  } catch {
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
  const [pet, setPet] = useState<PetConfig | null>(null);
  const [config, setConfig] = useState<PetConfigResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const dragRef = useRef<{ startX: number; startY: number; startWinX: number; startWinY: number } | null>(null);

  // Load config and pet
  useEffect(() => {
    let mounted = true;

    async function init() {
      const cfg = await fetchPetConfig();
      if (!mounted) return;

      setConfig(cfg);

      if (!cfg?.enabled || !cfg.current) {
        // Hide window if pet is disabled or not selected
        const win = getCurrentWindow();
        await win.hide();
        setPet(null);
        setLoading(false);
        return;
      }

      // Load pet
      try {
        const petData = await loadPetFromPublic(cfg.current);
        if (!mounted) return;
        setPet(petData);

        // Position and show window
        const win = getCurrentWindow();
        const monitors = await (await import("@tauri-apps/api/window")).availableMonitors();
        const primaryMonitor = monitors[0];
        if (primaryMonitor) {
          const screenWidth = primaryMonitor.size.width;
          const screenHeight = primaryMonitor.size.height;
          const x = screenWidth - cfg.preferences.position.right - WINDOW_SIZE;
          const y = screenHeight - cfg.preferences.position.bottom - WINDOW_SIZE;
          await win.setPosition(new PhysicalPosition(x, y));
        }
        await win.show();
      } catch (err) {
        console.error("Failed to load pet:", err);
      }

      setLoading(false);
    }

    init();

    return () => {
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

  // Handle window dragging
  const handlePointerDown = useCallback(async (e: React.PointerEvent) => {
    if (e.button !== 0) return;

    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);

    const win = getCurrentWindow();
    const pos = await win.outerPosition();

    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startWinX: pos.x,
      startWinY: pos.y,
    };
    setIsDragging(true);
  }, []);

  const handlePointerMove = useCallback(async (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;

    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;

    const win = getCurrentWindow();
    const newX = drag.startWinX + dx;
    const newY = drag.startWinY + dy;

    await win.setPosition(new PhysicalPosition(newX, newY));
  }, []);

  const handlePointerUp = useCallback(async (e: React.PointerEvent) => {
    const drag = dragRef.current;
    dragRef.current = null;

    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }

    setIsDragging(false);

    if (!drag) return;

    // Save new position to config
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
    }
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
        cursor: isDragging ? "grabbing" : "grab",
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <PetSprite
        pet={pet}
        rowId="idle"
        size={PET_SIZE}
      />
    </div>
  );
}
