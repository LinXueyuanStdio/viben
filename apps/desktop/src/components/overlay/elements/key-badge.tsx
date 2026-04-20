import { useEffect, useRef } from "react";
import type { KeystrokeItem } from "@/types/overlay";

interface KeyBadgeProps {
  item: KeystrokeItem;
}

export function KeyBadge({ item }: KeyBadgeProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.animate([{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "translateY(0)" }], {
      duration: 150,
      easing: "ease-out",
      fill: "forwards",
    });
  }, []);

  return (
    <div
      ref={ref}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "6px 12px",
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        borderRadius: 8,
        border: "1px solid rgba(255, 255, 255, 0.2)",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.4)",
        fontFamily: "system-ui, -apple-system, sans-serif",
        fontSize: 14,
        fontWeight: 500,
        color: "#ffffff",
        whiteSpace: "nowrap",
      }}
    >
      {item.displayText}
    </div>
  );
}
