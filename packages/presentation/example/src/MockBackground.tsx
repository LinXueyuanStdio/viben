/**
 * Mock "2024 Global AI Chip Market Analysis" background
 */
export function MockBackground() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "linear-gradient(155deg, #0f0c29 0%, #302b63 50%, #24243e 100%)",
        fontFamily: "'PingFang SC', 'SF Pro Display', -apple-system, sans-serif",
        padding: 40,
        overflow: "hidden",
      }}
    >
      {/* Decorative glow */}
      <div
        style={{
          position: "absolute",
          top: -100,
          right: -80,
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(99, 102, 241, 0.12), transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: -120,
          left: -60,
          width: 350,
          height: 350,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(118, 185, 0, 0.08), transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* Title */}
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            fontSize: 32,
            fontWeight: 800,
            color: "#FFFFFF",
            letterSpacing: -0.5,
            marginBottom: 8,
          }}
        >
          2024 Global AI Chip Market Analysis
        </div>
        <div
          style={{
            fontSize: 14,
            color: "rgba(255,255,255,0.45)",
            display: "flex",
            gap: 16,
            alignItems: "center",
          }}
        >
          <span>Morgan Stanley Research</span>
          <span style={{ width: 1, height: 12, background: "rgba(255,255,255,0.2)" }} />
          <span>2024.03</span>
          <span style={{ width: 1, height: 12, background: "rgba(255,255,255,0.2)" }} />
          <span
            style={{
              background: "rgba(99,102,241,0.2)",
              color: "#818CF8",
              padding: "2px 8px",
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            OVERWEIGHT
          </span>
        </div>
      </div>

      {/* Data cards */}
      <div style={{ display: "flex", gap: 20, marginBottom: 28 }}>
        <DataCard
          label="NVIDIA"
          sublabel="H100 / H200 / B100"
          value="80%"
          change="+5.2% YoY"
          color="#76B900"
          revenue="$26.0B"
        />
        <DataCard
          label="AMD"
          sublabel="MI300X / MI300A"
          value="12%"
          change="+8.1% YoY"
          color="#ED1C24"
          revenue="$3.5B"
        />
        <DataCard
          label="Others"
          sublabel="Intel / Google TPU / Huawei"
          value="8%"
          change="-2.3% YoY"
          color="#6366F1"
          revenue="$2.1B"
        />
      </div>

      {/* Analysis section */}
      <div style={{ display: "flex", gap: 24, marginBottom: 28 }}>
        <div style={{ flex: 1.2 }}>
          <SectionTitle>Market Analysis</SectionTitle>
          <div
            style={{
              fontSize: 13.5,
              color: "rgba(255,255,255,0.7)",
              lineHeight: 1.9,
              marginTop: 12,
            }}
          >
            According to the latest data, NVIDIA holds an{" "}
            <Emphasis color="#76B900">80%</Emphasis> share of the AI training chip market.
            Data center GPU revenue grew YoY by <Emphasis color="#76B900">265%</Emphasis>.
          </div>
          <div
            style={{
              fontSize: 13.5,
              color: "rgba(255,255,255,0.7)",
              lineHeight: 1.9,
              marginTop: 12,
            }}
          >
            AMD has captured <Emphasis color="#ED1C24">12%</Emphasis> market share
            with the MI300X series, showing strong price-performance in inference workloads.
          </div>
        </div>

        {/* Bar chart */}
        <div
          style={{
            flex: 0.8,
            background: "rgba(255,255,255,0.03)",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.06)",
            padding: "16px 20px",
          }}
        >
          <SectionTitle>Revenue Share (FY2024)</SectionTitle>
          <div
            style={{
              marginTop: 16,
              display: "flex",
              flexDirection: "column",
              gap: 12,
              height: 140,
              justifyContent: "flex-end",
            }}
          >
            <BarRow label="NVIDIA" value={80} color="#76B900" amount="$26.0B" />
            <BarRow label="AMD" value={12} color="#ED1C24" amount="$3.5B" />
            <BarRow label="Intel" value={4} color="#0071C5" amount="$1.1B" />
            <BarRow label="Google" value={3} color="#4285F4" amount="$0.8B" />
            <BarRow label="Huawei" value={1} color="#CF0A2C" amount="$0.2B" />
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Sub-components
// ============================================================================

function DataCard({
  label,
  sublabel,
  value,
  change,
  color,
  revenue,
}: {
  label: string
  sublabel: string
  value: string
  change: string
  color: string
  revenue: string
}) {
  const isPositive = change.startsWith("+")
  return (
    <div
      style={{
        flex: 1,
        background: "rgba(255,255,255,0.04)",
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.06)",
        borderLeft: `3px solid ${color}`,
        padding: "16px 20px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginBottom: 10 }}>
        {sublabel}
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color, marginBottom: 4 }}>{value}</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div
          style={{
            fontSize: 11,
            color: isPositive ? "#4ADE80" : "#F87171",
            fontWeight: 600,
          }}
        >
          {change}
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{revenue}</div>
      </div>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        color: "rgba(255,255,255,0.4)",
        textTransform: "uppercase",
        letterSpacing: 1.2,
      }}
    >
      {children}
    </div>
  )
}

function Emphasis({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span style={{ color, fontWeight: 700 }}>{children}</span>
  )
}

function BarRow({
  label,
  value,
  color,
  amount,
}: {
  label: string
  value: number
  color: string
  amount: string
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 48, fontSize: 11, color: "rgba(255,255,255,0.5)", textAlign: "right" }}>
        {label}
      </div>
      <div
        style={{
          flex: 1,
          height: 14,
          background: "rgba(255,255,255,0.05)",
          borderRadius: 4,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${value}%`,
            height: "100%",
            background: `linear-gradient(90deg, ${color}, ${color}AA)`,
            borderRadius: 4,
          }}
        />
      </div>
      <div style={{ width: 44, fontSize: 10, color: "rgba(255,255,255,0.4)", textAlign: "right" }}>
        {amount}
      </div>
    </div>
  )
}
