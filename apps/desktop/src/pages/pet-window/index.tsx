// apps/desktop/src/pages/pet-window/index.tsx
import { useEffect, useState, useCallback, useRef } from "react";
import { getCurrentWindow, PhysicalPosition, availableMonitors, cursorPosition } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { PetSprite, type PetConfig, type PetInteraction, STANDARD_ANIMATIONS, PET_DEFAULTS } from "@viben/pet";
import { loadPetFromPublic } from "@/lib/pet-loader";
import { getGatewayClient } from "@/lib/gateway";

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
    const data = await getGatewayClient().get<{ config: PetConfigResponse }>("/api/pet/config");
    return data.config;
  } catch {
    return null;
  }
}

async function updatePetPosition(right: number, bottom: number): Promise<void> {
  try {
    await getGatewayClient().request<void>("/api/pet/config", {
      method: "PUT",
      body: { preferences: { position: { right, bottom } } },
      responseType: "none",
    });
  } catch {
    // Ignore errors
  }
}

const PET_SIZE = 96;
const WINDOW_PADDING = 16;
const WINDOW_SIZE = PET_SIZE + WINDOW_PADDING * 2;

const DRAG_GESTURE_MIN_PX = 5;
const DRAG_AXIS_BIAS = 1.3;

export default function PetWindowPage() {
  const [pet, setPet] = useState<PetConfig | null>(null);
  const [config, setConfig] = useState<PetConfigResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [interaction, setInteraction] = useState<PetInteraction>("idle");
  const [isDragging, setIsDragging] = useState(false);

  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const idleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragStartRef = useRef<{ cursorX: number; cursorY: number; winX: number; winY: number } | null>(null);
  const rafIdRef = useRef<number | null>(null);

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

      try {
        let petData: PetConfig;
        try {
          petData = await loadPetFromPublic(cfg.current);
        } catch {
          const gatewayClient = getGatewayClient();
          const { pet: petInfo } = await gatewayClient.get<{
            pet: {
              id: string;
              metadata: {
                display_name: string;
                description: string;
              };
              spritesheet_url: string;
            };
          }>(`/api/pet/show/${encodeURIComponent(cfg.current)}`);
          let spritesheetSrc = petInfo.spritesheet_url;
          if (spritesheetSrc.startsWith("/api/")) {
            spritesheetSrc = `${gatewayClient.getBaseUrl()}${spritesheetSrc}`;
          }
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

        const win = getCurrentWindow();
        const monitors = await availableMonitors();
        const primaryMonitor = monitors[0];

        if (primaryMonitor) {
          const screenWidth = primaryMonitor.size.width;
          const screenHeight = primaryMonitor.size.height;

          let x: number;
          let y: number;

          if (cfg.preferences.position) {
            x = screenWidth - cfg.preferences.position.right - WINDOW_SIZE;
            y = screenHeight - cfg.preferences.position.bottom - WINDOW_SIZE;
          } else {
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
    return () => { mounted = false; };
  }, [reloadKey]);

  // Listen for config changes from settings
  useEffect(() => {
    const unlisten = listen("pet-config-changed", () => {
      setReloadKey((k) => k + 1);
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  const handleMouseDown = useCallback(async (e: React.MouseEvent) => {
    if (e.button !== 0) return;

    const win = getCurrentWindow();
    const pos = await win.outerPosition();
    const cursor = await cursorPosition();

    dragStartRef.current = {
      cursorX: cursor.x,
      cursorY: cursor.y,
      winX: pos.x,
      winY: pos.y,
    };
    lastPosRef.current = { x: pos.x, y: pos.y };
    setIsDragging(true);
  }, []);

  const handleMouseUp = useCallback(() => {
    if (!dragStartRef.current) return;
    dragStartRef.current = null;
    setIsDragging(false);
    setInteraction("idle");
    lastPosRef.current = null;
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  }, []);

  // Drag polling loop
  useEffect(() => {
    if (!isDragging) return;

    let running = true;
    let saveTimeoutId: ReturnType<typeof setTimeout>;

    const pollCursor = async () => {
      if (!running || !dragStartRef.current) return;

      try {
        const cursor = await cursorPosition();
        const start = dragStartRef.current;
        const dx = cursor.x - start.cursorX;
        const dy = cursor.y - start.cursorY;
        const newX = start.winX + dx;
        const newY = start.winY + dy;

        const win = getCurrentWindow();
        await win.setPosition(new PhysicalPosition(newX, newY));

        const lastPos = lastPosRef.current;
        if (lastPos) {
          const moveDx = newX - lastPos.x;
          const moveDy = newY - lastPos.y;
          const absX = Math.abs(moveDx);
          const absY = Math.abs(moveDy);

          if (absX >= DRAG_GESTURE_MIN_PX || absY >= DRAG_GESTURE_MIN_PX) {
            if (absX >= absY * DRAG_AXIS_BIAS) {
              setInteraction(moveDx > 0 ? "drag-right" : "drag-left");
            } else if (absY >= absX * DRAG_AXIS_BIAS) {
              setInteraction(moveDy > 0 ? "drag-down" : "drag-up");
            }
          }
        }
        lastPosRef.current = { x: newX, y: newY };

        if (idleTimeoutRef.current) {
          clearTimeout(idleTimeoutRef.current);
        }
        idleTimeoutRef.current = setTimeout(() => {
          setInteraction("idle");
        }, 150);

        clearTimeout(saveTimeoutId);
        saveTimeoutId = setTimeout(async () => {
          const monitors = await availableMonitors();
          const primaryMonitor = monitors[0];
          if (primaryMonitor) {
            const screenWidth = primaryMonitor.size.width;
            const screenHeight = primaryMonitor.size.height;
            const right = screenWidth - newX - WINDOW_SIZE;
            const bottom = screenHeight - newY - WINDOW_SIZE;
            await updatePetPosition(right, bottom);
          }
        }, 500);
      } catch {
        // Ignore errors during rapid polling
      }

      if (running) {
        rafIdRef.current = requestAnimationFrame(pollCursor);
      }
    };

    pollCursor();

    return () => {
      running = false;
      clearTimeout(saveTimeoutId);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [isDragging]);

  useEffect(() => {
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseUp]);

  // Hover interaction
  const handleMouseEnter = useCallback(() => {
    if (!isDragging) setInteraction("hover");
  }, [isDragging]);

  const handleMouseLeave = useCallback(() => {
    if (!isDragging) setInteraction("idle");
  }, [isDragging]);

  const getRowId = (): string => {
    switch (interaction) {
      case "drag-left": return "walk-left";
      case "drag-right": return "walk-right";
      case "drag-up": return "jump";
      case "drag-down": return "fall";
      case "hover": return "alert";
      default: return "idle";
    }
  };

  if (loading || !config?.enabled || !pet) {
    return <div style={{ width: "100vw", height: "100vh", background: "transparent" }} />;
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
      <PetSprite pet={pet} rowId={getRowId()} size={PET_SIZE} />
    </div>
  );
}
