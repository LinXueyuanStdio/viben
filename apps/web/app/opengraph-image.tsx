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
        <svg
          viewBox="0 0 100 100"
          width="80"
          height="80"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient
              id="viben-logo-gradient"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop offset="0%" stopColor="#FDB813" />
              <stop offset="100%" stopColor="#38B2AC" />
            </linearGradient>
          </defs>
          <rect
            x="0"
            y="0"
            width="100"
            height="100"
            rx="22"
            fill="url(#viben-logo-gradient)"
          />
          <path
            d="M28 30 L15 50 L28 70"
            fill="none"
            stroke="#fff"
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M38 32 L50 68 L62 32"
            fill="none"
            stroke="#fff"
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M72 30 L85 50 L72 70"
            fill="none"
            stroke="#fff"
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
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
