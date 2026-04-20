import { useMemo } from "react";
import { useOverlayStore } from "@/stores/overlay-store";
import type { KeystrokeItem, KeystrokePosition } from "@/types/overlay";

interface UseKeystrokeReturn {
  enabled: boolean;
  position: KeystrokePosition;
  items: KeystrokeItem[];
  showModifiersOnly: boolean;
  showKeys: string[];
  setEnabled: (enabled: boolean) => void;
  setPosition: (position: KeystrokePosition) => void;
  addKeystroke: (item: KeystrokeItem) => void;
  removeKeystroke: (id: string) => void;
}

export function useKeystroke(): UseKeystrokeReturn {
  const store = useOverlayStore();
  const {
    keystrokeEnabled: enabled,
    keystrokePosition: position,
    keystrokeItems: items,
    keystrokeShowModifiersOnly: showModifiersOnly,
    keystrokeShowKeys: showKeys,
    actions,
  } = store;

  return useMemo(
    () => ({
      enabled,
      position,
      items,
      showModifiersOnly,
      showKeys,
      setEnabled: actions.setKeystrokeEnabled,
      setPosition: actions.setKeystrokePosition,
      addKeystroke: actions.addKeystroke,
      removeKeystroke: actions.removeKeystroke,
    }),
    [enabled, position, items, showModifiersOnly, showKeys, actions]
  );
}
