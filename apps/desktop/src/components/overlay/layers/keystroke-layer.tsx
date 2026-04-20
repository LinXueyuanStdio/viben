import { useKeystroke } from "@/hooks/use-keystroke";
import { KeyBadge } from "../elements/key-badge";
import { DOMZIndex } from "@/types/overlay";
import type { KeystrokePosition } from "@/types/overlay";

const positionStyles: Record<KeystrokePosition, React.CSSProperties> = {
  "top-left": { top: 20, left: 20 },
  "top-right": { top: 20, right: 20 },
  "bottom-left": { bottom: 20, left: 20 },
  "bottom-right": { bottom: 20, right: 20 },
};

export function KeystrokeLayer() {
  const { enabled, position, items } = useKeystroke();

  if (!enabled || items.length === 0) return null;

  const isRight = position.includes("right");

  return (
    <div
      style={{
        position: "fixed",
        ...positionStyles[position],
        display: "flex",
        flexDirection: "column",
        alignItems: isRight ? "flex-end" : "flex-start",
        gap: 8,
        pointerEvents: "none",
        zIndex: DOMZIndex.InteractiveLayer,
      }}
    >
      {items.map((item) => (
        <KeyBadge key={item.id} item={item} />
      ))}
    </div>
  );
}
