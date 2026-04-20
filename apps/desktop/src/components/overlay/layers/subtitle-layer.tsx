import { useEffect, useState } from "react";
import { useSubtitle } from "@/hooks/use-subtitle";
import { DOMZIndex } from "@/types/overlay";

const positionStyles: Record<"top" | "center" | "bottom", React.CSSProperties> = {
  top: { top: 60, left: "50%", transform: "translateX(-50%)" },
  center: { top: "50%", left: "50%", transform: "translate(-50%, -50%)" },
  bottom: { bottom: 60, left: "50%", transform: "translateX(-50%)" },
};

export function SubtitleLayer(): React.ReactElement | null {
  const { enabled, current, config, streaming } = useSubtitle();
  const [displayText, setDisplayText] = useState("");
  const [showCursor, setShowCursor] = useState(false);

  useEffect(() => {
    if (!streaming) {
      setDisplayText("");
      setShowCursor(false);
      return;
    }

    setDisplayText(streaming.text);
    setShowCursor(streaming.cursor ?? false);
  }, [streaming]);

  useEffect(() => {
    if (!showCursor) return;

    const interval = setInterval(() => {
      setShowCursor((prev) => !prev);
    }, 500);

    return () => clearInterval(interval);
  }, [showCursor]);

  if (!enabled) return null;

  const subtitle = streaming ?? (current ? { text: current.text, options: current } : null);
  if (!subtitle) return null;

  const position = streaming?.options?.position ?? current?.position ?? config.defaultPosition;
  const style = streaming?.options?.style ?? current?.style ?? "plain";
  const speaker = streaming?.options?.speaker ?? current?.speaker;

  const text = streaming ? displayText : subtitle.text;

  return (
    <div
      style={{
        position: "fixed",
        ...positionStyles[position],
        zIndex: DOMZIndex.InteractiveLayer,
        pointerEvents: "none",
        maxWidth: "80%",
      }}
    >
      <div
        style={{
          backgroundColor: config.backgroundColor,
          borderRadius: style === "dialogue" ? 12 : 8,
          padding: config.padding,
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        }}
      >
        {speaker && style === "dialogue" && (
          <div
            style={{
              color: "#a0aec0",
              fontSize: config.fontSize * 0.8,
              marginBottom: 4,
              fontWeight: 500,
            }}
          >
            {speaker}
          </div>
        )}
        <div
          style={{
            color: "#ffffff",
            fontSize: config.fontSize,
            fontStyle: style === "narrator" ? "italic" : "normal",
            lineHeight: 1.5,
            textAlign: "center",
          }}
        >
          {text}
          {streaming?.isStreaming && (
            <span
              style={{
                display: "inline-block",
                width: 2,
                height: "1em",
                backgroundColor: showCursor ? "#ffffff" : "transparent",
                marginLeft: 2,
                verticalAlign: "text-bottom",
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
