import { ImageResponse } from "next/og";

export const alt = "Viben";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const runtime = "nodejs";

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        overflow: "hidden",
        background: "#0a0a0a",
        color: "#ffffff",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      {/* Gradient background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 900px 500px at 15% 20%, rgba(255, 138, 61, 0.12), transparent 60%), radial-gradient(ellipse 700px 500px at 85% 80%, rgba(255, 255, 255, 0.04), transparent 60%)",
        }}
      />

      {/* Border frame */}
      <div
        style={{
          position: "absolute",
          top: 28,
          left: 28,
          right: 28,
          bottom: 28,
          borderRadius: 24,
          border: "1px solid rgba(255, 255, 255, 0.08)",
          display: "flex",
        }}
      />

      {/* Content */}
      <div
        style={{
          position: "absolute",
          top: 28,
          left: 28,
          right: 28,
          bottom: 28,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: "48px 56px",
        }}
      >
        {/* Logo */}
        <svg viewBox="0 0 24 24" width="80" height="80" fill="none">
          <path
            d="M4 17L10 11L4 5"
            stroke="rgba(255,255,255,0.6)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M12 19H20"
            stroke="rgba(255,255,255,0.6)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>

        {/* Title */}
        <div
          style={{
            marginTop: 32,
            fontSize: 64,
            fontWeight: 700,
            letterSpacing: "-0.035em",
            color: "#fff",
          }}
        >
          Viben
        </div>

        {/* Tagline */}
        <div
          style={{
            marginTop: 12,
            fontSize: 24,
            color: "rgba(255, 255, 255, 0.45)",
            letterSpacing: "-0.01em",
            fontWeight: 500,
          }}
        >
          创作 · 分享 · 连接
        </div>
      </div>
    </div>,
    { ...size },
  );
}
