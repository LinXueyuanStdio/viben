import { useMemo } from "react";
import { useOverlayStore } from "@/stores/overlay-store";
import type { ClickEffect, ClickStyle } from "@/types/overlay";

interface UseClickIndicatorReturn {
  enabled: boolean;
  style: ClickStyle;
  effects: ClickEffect[];
  setEnabled: (enabled: boolean) => void;
  setStyle: (style: ClickStyle) => void;
  addEffect: (effect: ClickEffect) => void;
  removeEffect: (id: string) => void;
}

export function useClickIndicator(): UseClickIndicatorReturn {
  const store = useOverlayStore();
  const { clickEnabled: enabled, clickStyle: style, clickEffects: effects, actions } = store;

  return useMemo(
    () => ({
      enabled,
      style,
      effects,
      setEnabled: actions.setClickEnabled,
      setStyle: actions.setClickStyle,
      addEffect: actions.addClickEffect,
      removeEffect: actions.removeClickEffect,
    }),
    [enabled, style, effects, actions]
  );
}
