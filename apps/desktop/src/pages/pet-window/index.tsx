// apps/desktop/src/pages/pet-window/index.tsx
import { useEffect, useState, useCallback, useRef } from "react";
import { getCurrentWindow, PhysicalPosition } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { convertFileSrc } from "@tauri-apps/api/core";
import { PetSprite, type PetConfig, type PetInteraction, STANDARD_ANIMATIONS, PET_DEFAULTS } from "@viben/pet";
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
const DRAG_GESTURE_MIN_PX = 5;
const DRAG_AXIS_BIAS = 1.3;

export default function PetWindowPage() {
  const [pet, setPet] = useState<PetConfig | null>(null);
  const [config, setConfig] = useState<PetConfigResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [interaction, setInteraction] = useState<PetInteraction>("idle");
  const [isDragging, setIsDragging] = useState(false);

  // Track positions for drag direction detection
  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const idleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

      // Load pet - 先尝试从 public/pets 加载（内置），失败则从 Gateway 获取
      try {
        let petData: PetConfig;
        try {
          petData = await loadPetFromPublic(cfg.current);
        } catch {
          // 不是内置 Pet，从 Gateway 获取已安装 Pet 的信息
          const petRes = await fetch(`${API_BASE}/api/pet/show/${encodeURIComponent(cfg.current)}`);
          if (!petRes.ok) throw new Error("Pet not found");
          const { pet: petInfo } = await petRes.json();
          const spritesheetSrc = petInfo.spritesheet_url.startsWith("/")
            ? convertFileSrc(petInfo.spritesheet_url)
            : petInfo.spritesheet_url;
          petData = {
            id: petInfo.id,
            name: petInfo.metadata.display_name,
            description: petInfo.metadata.description,
            accent: "#6366f1",
            greeting: `Hi! I'm ${petInfo.metadata.display_name}.`,
            spritesheet: spritesheetSrc,
            atlas: {
              cols: 8,
              rows: 9,
              cellWidth: 192,
              cellHeight: 208,
              animations: STANDARD_ANIMATIONS,
            },
            ambient: PET_DEFAULTS.ambient,
            idleTimeoutMs: PET_DEFAULTS.idleTimeoutMs,
          };
        }
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

  // Track whether user is interacting with pet (to avoid focus redirect during interaction).
  // Use pointerdown on document (capture phase) to set the flag BEFORE the focus event fires.
  const isInteractingRef = useRef(false);

  useEffect(() => {
    const markInteracting = () => {
      isInteractingRef.current = true;
    };
    // Capture phase ensures this fires before the focus event
    document.addEventListener("pointerdown", markInteracting, true);
    return () => document.removeEventListener("pointerdown", markInteracting, true);
  }, []);

  // When app is activated (e.g., clicking dock icon), focus main window instead.
  // But NOT when the user is directly interacting with the pet (drag/click).
  useEffect(() => {
    const handleFocus = async () => {
      if (isInteractingRef.current) return;

      const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
      const mainWindow = await WebviewWindow.getByLabel("main");
      if (mainWindow) {
        await mainWindow.setFocus();
      }
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  // Handle window dragging start
  const handleMouseDown = useCallback(async (e: React.MouseEvent) => {
    if (e.button !== 0) return;

    // Mark as interacting so focus redirect is suppressed
    isInteractingRef.current = true;

    const win = getCurrentWindow();
    const pos = await win.outerPosition();

    dragStartPosRef.current = { x: pos.x, y: pos.y };
    lastPosRef.current = { x: pos.x, y: pos.y };
    setIsDragging(true);

    // Use Tauri's native window dragging
    await win.startDragging();

    // After drag ends (startDragging resolves), clear interacting flag after a short delay
    setTimeout(() => {
      isInteractingRef.current = false;
    }, 300);
  }, []);

  // Listen to tauri://move events to detect drag direction
  useEffect(() => {
    let saveTimeoutId: ReturnType<typeof setTimeout>;

    const handleMove = async (event: { payload: { x: number; y: number } }) => {
      const { x, y } = event.payload;
      const lastPos = lastPosRef.current;

      // We're moving, so we're dragging
      if (!isDragging) {
        setIsDragging(true);
      }

      // Clear any pending idle timeout
      if (idleTimeoutRef.current) {
        clearTimeout(idleTimeoutRef.current);
        idleTimeoutRef.current = null;
      }

      // Detect direction based on movement delta from last position
      if (lastPos) {
        const dx = x - lastPos.x;
        const dy = y - lastPos.y;
        const absX = Math.abs(dx);
        const absY = Math.abs(dy);

        if (absX >= DRAG_GESTURE_MIN_PX || absY >= DRAG_GESTURE_MIN_PX) {
          let dir: PetInteraction = interaction;

          if (absX >= absY * DRAG_AXIS_BIAS) {
            dir = dx > 0 ? "drag-right" : "drag-left";
          } else if (absY >= absX * DRAG_AXIS_BIAS) {
            dir = dy > 0 ? "drag-down" : "drag-up";
          }

          if (dir !== interaction) {
            setInteraction(dir);
          }
        }
      }

      lastPosRef.current = { x, y };

      // Set idle timeout - if no movement for 150ms, consider drag ended
      idleTimeoutRef.current = setTimeout(() => {
        setIsDragging(false);
        setInteraction("idle");
        dragStartPosRef.current = null;
        lastPosRef.current = null;
      }, 150);

      // Debounce save position
      clearTimeout(saveTimeoutId);
      saveTimeoutId = setTimeout(async () => {
        const monitors = await (await import("@tauri-apps/api/window")).availableMonitors();
        const primaryMonitor = monitors[0];
        if (primaryMonitor) {
          const screenWidth = primaryMonitor.size.width;
          const screenHeight = primaryMonitor.size.height;
          const right = screenWidth - x - WINDOW_SIZE;
          const bottom = screenHeight - y - WINDOW_SIZE;
          await updatePetPosition(right, bottom);
        }
      }, 500);
    };

    const unlisten = listen<{ x: number; y: number }>("tauri://move", handleMove);

    return () => {
      clearTimeout(saveTimeoutId);
      if (idleTimeoutRef.current) {
        clearTimeout(idleTimeoutRef.current);
      }
      unlisten.then((fn) => fn());
    };
  }, [isDragging, interaction]);

  // Hover interaction
  const handleMouseEnter = useCallback(() => {
    isInteractingRef.current = true;
    if (!isDragging) setInteraction("hover");
  }, [isDragging]);

  const handleMouseLeave = useCallback(() => {
    isInteractingRef.current = false;
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
