import { useEffect, useCallback, useRef } from "react";
import { nanoid } from "nanoid";
import { useClickIndicator } from "./use-click-indicator";
import { useKeystroke } from "./use-keystroke";
import type { ClickEffect, KeystrokeItem } from "@/types/overlay";
import { PERFORMANCE_LIMITS } from "@/lib/overlay/constants";

const MODIFIER_KEYS = ["Meta", "Control", "Alt", "Shift"];

function formatKeyDisplay(keys: string[]): string {
  const isMac = navigator.platform.includes("Mac");
  const symbolMap: Record<string, string> = isMac
    ? { Meta: "\u2318", Control: "\u2303", Alt: "\u2325", Shift: "\u21E7" }
    : { Meta: "Win", Control: "Ctrl", Alt: "Alt", Shift: "Shift" };

  return keys
    .map((key) => symbolMap[key] ?? key)
    .join(isMac ? "" : "+");
}

export function useGlobalInput(): void {
  const { enabled: clickEnabled, addEffect, removeEffect } = useClickIndicator();
  const {
    enabled: keystrokeEnabled,
    showModifiersOnly,
    showKeys,
    addKeystroke,
    removeKeystroke,
  } = useKeystroke();

  const pressedKeysRef = useRef<Set<string>>(new Set());

  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      if (!clickEnabled) return;

      const button: ClickEffect["button"] =
        e.button === 0 ? "left" : e.button === 2 ? "right" : "middle";

      const effect: ClickEffect = {
        id: nanoid(),
        x: e.clientX,
        y: e.clientY,
        button,
        timestamp: Date.now(),
      };

      addEffect(effect);

      setTimeout(() => {
        removeEffect(effect.id);
      }, PERFORMANCE_LIMITS.clickEffectDuration);
    },
    [clickEnabled, addEffect, removeEffect]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!keystrokeEnabled) return;

      const key = e.key;
      if (pressedKeysRef.current.has(key)) return;
      pressedKeysRef.current.add(key);

      const hasModifier = e.metaKey || e.ctrlKey || e.altKey || e.shiftKey;
      const isModifierKey = MODIFIER_KEYS.includes(key);

      if (showModifiersOnly && !hasModifier && !showKeys.includes(key)) {
        return;
      }

      const keys: string[] = [];
      if (e.metaKey && key !== "Meta") keys.push("Meta");
      if (e.ctrlKey && key !== "Control") keys.push("Control");
      if (e.altKey && key !== "Alt") keys.push("Alt");
      if (e.shiftKey && key !== "Shift") keys.push("Shift");
      if (!isModifierKey) keys.push(key);

      if (keys.length === 0) return;

      const item: KeystrokeItem = {
        id: nanoid(),
        keys,
        displayText: formatKeyDisplay(keys),
        timestamp: Date.now(),
      };

      addKeystroke(item);

      setTimeout(() => {
        removeKeystroke(item.id);
      }, PERFORMANCE_LIMITS.keystrokeDuration);
    },
    [keystrokeEnabled, showModifiersOnly, showKeys, addKeystroke, removeKeystroke]
  );

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    pressedKeysRef.current.delete(e.key);
  }, []);

  useEffect(() => {
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [handleMouseDown, handleKeyDown, handleKeyUp]);
}
