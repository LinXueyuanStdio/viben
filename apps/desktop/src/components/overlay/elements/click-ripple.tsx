import { useEffect, useRef } from "react";
import type { ClickEffect, ClickIndicatorStyle } from "@/types/overlay";

interface ClickRippleProps {
  effect: ClickEffect;
  style: ClickIndicatorStyle;
  onComplete: (id: string) => void;
}

export function ClickRipple({ effect, style, onComplete }: ClickRippleProps) {
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;

    const duration = 400;

    // Configure animation based on style type
    let keyframes: Keyframe[];

    switch (style.effect) {
      case "spotlight":
        keyframes = [
          { transform: "scale(0)", opacity: 0.8 },
          { transform: "scale(1)", opacity: 0 },
        ];
        break;
      case "ring":
        keyframes = [
          { transform: "scale(0.5)", opacity: 1 },
          { transform: "scale(1)", opacity: 0 },
        ];
        break;
      case "ripple":
      default:
        keyframes = [
          { transform: "scale(0)", opacity: 0.6 },
          { transform: "scale(1)", opacity: 0 },
        ];
        break;
    }

    const animation = el.animate(keyframes, {
      duration,
      easing: "ease-out",
      fill: "forwards",
    });

    animation.onfinish = () => {
      onComplete(effect.id);
    };

    return () => {
      animation.cancel();
    };
  }, [effect, style, onComplete]);

  const { x, y } = effect;
  const size = style.size;

  // Generate styles based on effect type
  const getEffectStyles = (): React.CSSProperties => {
    const baseStyles: React.CSSProperties = {
      position: "absolute",
      left: x - size / 2,
      top: y - size / 2,
      width: size,
      height: size,
      borderRadius: "50%",
      pointerEvents: "none",
    };

    switch (style.effect) {
      case "spotlight":
        return {
          ...baseStyles,
          background: `radial-gradient(circle, ${style.color} 0%, transparent 70%)`,
        };
      case "ring":
        return {
          ...baseStyles,
          border: `3px solid ${style.color}`,
          background: "transparent",
        };
      case "ripple":
      default:
        return {
          ...baseStyles,
          border: `2px solid ${style.color}`,
          boxShadow: `0 0 10px ${style.color}`,
          background: "transparent",
        };
    }
  };

  return <div ref={elementRef} style={getEffectStyles()} />;
}
