// apps/desktop/src/pages/pet-window/index.tsx
import { useEffect, useState, useCallback, useRef } from "react";
import { getCurrentWindow, PhysicalPosition } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { PetSprite, type PetConfig, type PetInteraction } from "@viben/pet";
import { loadPetFromPublic } from "@/lib/pet-loader";

const API_BASE = "http://127.0.0.1:18790";

interface PetConfigResponse {
  current: string | null;
  enabled: boolean;
  preferences: {
    size: number;
    position: { right: number; bottom: number } | null;
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

// Drag detection thresholds
const DRAG_GESTURE_MIN_PX = 10;
const DRAG_AXIS_BIAS = 1.5;

export default function PetWindowPage() {
  const [pet, setPet] = useState<PetConfig | null>(null);
  const [config, setConfig] = useState<PetConfigResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [interaction, setInteraction] = useState<PetInteraction>("idle");
  const [isDragging, setIsDragging] = useState(false);

  // Track window position for drag direction detection
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null);

  // Load config and pet
  useEffect(() => {
    let mounted = true;

    async function init() {
      const cfg = await fetchPetConfig();
      if (!mounted) return;

      setConfig(cfg);

      if (!cfg?.enabled || !cfg.current) {
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

          let x: number;
          let y: number;

          // Check if position is saved, otherwise center the window
          if (cfg.preferences.position) {
            x = screenWidth - cfg.preferences.position.right - WINDOW_SIZE;
            y = screenHeight - cfg.preferences.position.bottom - WINDOW_SIZE;
          } else {
            // First time: center on screen
            x = Math.round((screenWidth - WINDOW_SIZE) / 2);
            y = Math.round((screenHeight - WINDOW_SIZE) / 2);
          }

          await win.setPosition(new PhysicalPosition(x, y));
        }

        await win.show();
      } catch (err) {
        console.error("[PetWindow] Failed to load pet:", err);
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
  const handleMouseDown = useCallback(async (e: React.MouseEvent) => {
    if (e.button !== 0) return;

    setIsDragging(true);

    const win = getCurrentWindow();
    const pos = await win.outerPosition();
    dragStartPosRef.current = { x: pos.x, y: pos.y };
    lastPosRef.current = { x: pos.x, y: pos.y };

    // Use Tauri's native window dragging
    await win.startDragging();
  }, []);

  // Detect drag direction from window movement
  useEffect(() => {
    if (!isDragging) return;

    let animationFrame: number;

    const detectDirection = async () => {
      const win = getCurrentWindow();
      const pos = await win.outerPosition();
      const startPos = dragStartPosRef.current;

      if (startPos) {
        const dx = pos.x - startPos.x;
        const dy = pos.y - startPos.y;

        const absX = Math.abs(dx);
        const absY = Math.abs(dy);

        if (absX >= DRAG_GESTURE_MIN_PX || absY >= DRAG_GESTURE_MIN_PX) {
          let dir: PetInteraction = "idle";

          if (absX >= absY * DRAG_AXIS_BIAS) {
            dir = dx > 0 ? "drag-right" : "drag-left";
          } else if (absY >= absX * DRAG_AXIS_BIAS) {
            dir = dy < 0 ? "drag-up" : "drag-down";
          }

          if (dir !== "idle") {
            setInteraction(dir);
          }
        }
      }

      lastPosRef.current = { x: pos.x, y: pos.y };
      animationFrame = requestAnimationFrame(detectDirection);
    };

    animationFrame = requestAnimationFrame(detectDirection);

    return () => {
      cancelAnimationFrame(animationFrame);
    };
  }, [isDragging]);

  // Reset interaction when drag ends (detect via mouse up on document)
  useEffect(() => {
    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        setInteraction("idle");
        dragStartPosRef.current = null;
      }
    };

    document.addEventListener("mouseup", handleMouseUp);
    return () => document.removeEventListener("mouseup", handleMouseUp);
  }, [isDragging]);

  // Save position when window is moved (debounced)
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
      }
    };

    const unlisten = listen("tauri://move", () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(savePosition, 500);
    });

    return () => {
      clearTimeout(timeoutId);
      unlisten.then((fn) => fn());
    };
  }, []);

  // Hover interaction
  const handleMouseEnter = useCallback(() => {
    if (!isDragging) setInteraction("hover");
  }, [isDragging]);

  const handleMouseLeave = useCallback(() => {
    if (!isDragging) setInteraction("idle");
  }, [isDragging]);

  // Get animation row based on interaction
  const getRowId = (): string => {
    switch (interaction) {
      case "drag-left":
        return "walk-left";
      case "drag-right":
        return "walk-right";
      case "drag-up":
        return "jump";
      case "drag-down":
        return "fall";
      case "hover":
        return "alert";
      default:
        return "idle";
    }
  };

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
      onMouseDown={handleMouseDown}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <PetSprite
        pet={pet}
        rowId={getRowId()}
        size={PET_SIZE}
      />
    </div>
  );
}
