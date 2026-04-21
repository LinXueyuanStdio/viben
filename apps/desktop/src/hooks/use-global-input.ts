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

function buildKeysFromEvent(e: KeyboardEvent): string[] {
  const keys: string[] = [];
  if (e.metaKey) keys.push("Meta");
  if (e.ctrlKey) keys.push("Control");
  if (e.altKey) keys.push("Alt");
  if (e.shiftKey) keys.push("Shift");

  const key = e.key;
  if (!MODIFIER_KEYS.includes(key)) {
    keys.push(key);
  }
  return keys;
}

function keysToString(keys: string[]): string {
  return keys.slice().sort().join("+");
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
  const currentComboRef = useRef<string | null>(null);
  const activeKeystrokeIdRef = useRef<string | null>(null);

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

      if (showModifiersOnly && !hasModifier && !showKeys.includes(key)) {
        return;
      }

      const keys = buildKeysFromEvent(e);
      if (keys.length === 0) return;

      const comboStr = keysToString(keys);

      // 如果组合键变化了，移除旧的并创建新的
      if (currentComboRef.current !== comboStr) {
        if (activeKeystrokeIdRef.current) {
          removeKeystroke(activeKeystrokeIdRef.current);
        }

        const item: KeystrokeItem = {
          id: nanoid(),
          keys,
          displayText: formatKeyDisplay(keys),
          timestamp: Date.now(),
        };

        addKeystroke(item);
        currentComboRef.current = comboStr;
        activeKeystrokeIdRef.current = item.id;
      }
    },
    [keystrokeEnabled, showModifiersOnly, showKeys, addKeystroke, removeKeystroke]
  );

  const handleKeyUp = useCallback(
    (e: KeyboardEvent) => {
      pressedKeysRef.current.delete(e.key);

      // 当所有键都释放时，延迟移除显示
      if (pressedKeysRef.current.size === 0 && activeKeystrokeIdRef.current) {
        const idToRemove = activeKeystrokeIdRef.current;
        setTimeout(() => {
          removeKeystroke(idToRemove);
        }, PERFORMANCE_LIMITS.keystrokeDuration);
        currentComboRef.current = null;
        activeKeystrokeIdRef.current = null;
      }
    },
    [removeKeystroke]
  );

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
