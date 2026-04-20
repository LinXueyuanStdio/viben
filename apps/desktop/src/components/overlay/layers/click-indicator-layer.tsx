import { useCallback } from "react";
import { useOverlayStore } from "@/stores/overlay-store";
import { ClickRipple } from "../elements";
import { DOMZIndex } from "@/types/overlay";
import { DEFAULT_OVERLAY_SETTINGS } from "@/lib/overlay-config";

export function ClickIndicatorLayer() {
  const clickEnabled = useOverlayStore((s) => s.clickEnabled);
  const clickStyle = useOverlayStore((s) => s.clickStyle);
  const effects = useOverlayStore((s) => s.clickEffects);
  const removeClickEffect = useOverlayStore((s) => s.actions.removeClickEffect);

  const handleComplete = useCallback(
    (id: string) => {
      removeClickEffect(id);
    },
    [removeClickEffect]
  );

  if (!clickEnabled) {
    return null;
  }

  // Build the style object from store and defaults
  const styleConfig = {
    effect: clickStyle,
    color: DEFAULT_OVERLAY_SETTINGS.click_indicator.color,
    size: DEFAULT_OVERLAY_SETTINGS.click_indicator.size,
  };

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: DOMZIndex.OverlayCanvas,
      }}
    >
      {effects.map((effect) => (
        <ClickRipple
          key={effect.id}
          effect={effect}
          style={styleConfig}
          onComplete={handleComplete}
        />
      ))}
    </div>
  );
}
