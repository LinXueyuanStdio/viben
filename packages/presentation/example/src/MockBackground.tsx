import { useEffect } from "react"

/**
 * Mock "2024 Global AI Chip Market Analysis" background
 *
 * A rich, information-dense financial research dashboard styled like
 * Bloomberg terminal meets educational video (小Lin说 style).
 *
 * Layout: dark theme, 1024x768 viewport, 40px padding, max-width ~920px centered.
 */
export function MockBackground() {
  // DEBUG: Log all data-presentation-id element positions after mount
  useEffect(() => {
    const logPositions = () => {
      const els = document.querySelectorAll<HTMLElement>("[data-presentation-id]")
      console.group("[MockBackground] Element positions after mount")
      els.forEach((el) => {
        const id = el.dataset.presentationId
        const rect = el.getBoundingClientRect()
        console.log(
          `  "${id}" → left:${rect.left.toFixed(0)} top:${rect.top.toFixed(0)} w:${rect.width.toFixed(0)} h:${rect.height.toFixed(0)}`,
          `| offsetParent:`, el.offsetParent?.tagName,
          `| computed position:`, getComputedStyle(el).position,
        )
      })
      console.groupEnd()
    }
    // Log immediately and after a frame
    logPositions()
    requestAnimationFrame(logPositions)
  }, [])
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background:
          "linear-gradient(160deg, #0f0c29 0%, #1a1545 50%, #24243e 100%)",
        fontFamily:
          "'PingFang SC', 'SF Pro Display', -apple-system, sans-serif",
        overflow: "hidden",
      }}
    >
      {/* Decorative glow orbs */}
      <div
        style={{
          position: "absolute",
          top: -120,
          right: -80,
          width: 420,
          height: 420,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(99, 102, 241, 0.12), transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: -140,
          left: -60,
          width: 380,
          height: 380,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(118, 185, 0, 0.08), transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* Content container */}
      <div
        style={{
          position: "relative",
          maxWidth: 920,
          margin: "0 auto",
          padding: 40,
          height: "100%",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* === HEADER === */}
        <div style={{ marginBottom: 20 }}>
          <div
            data-presentation-id="title"
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: "#FFFFFF",
              letterSpacing: -0.5,
              marginBottom: 8,
              lineHeight: 1.2,
            }}
          >
            2024 全球 AI 芯片市场深度分析
          </div>
          <div
            data-presentation-id="subtitle"
            style={{
              fontSize: 13,
              color: "rgba(255,255,255,0.45)",
              display: "flex",
              gap: 14,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <span>Morgan Stanley Research</span>
            <Separator />
            <span>2024.03</span>
            <Separator />
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
            <Separator />
            <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>
              Target Price: $950 (+22%)
            </span>
          </div>
        </div>

        {/* === DATA CARDS ROW === */}
        <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
          <DataCard
            presentationId="card-nvidia"
            label="NVIDIA"
            sublabel="H100 / H200 / B100"
            value="80%"
            change="+5.2% YoY"
            color="#76B900"
            revenue="$26.0B"
            marketCap="$2.2T"
          />
          <DataCard
            presentationId="card-amd"
            label="AMD"
            sublabel="MI300X / MI300A"
            value="12%"
            change="+8.1% YoY"
            color="#ED1C24"
            revenue="$3.5B"
            marketCap="$280B"
          />
          <DataCard
            presentationId="card-others"
            label="Others"
            sublabel="Intel / Google TPU / Huawei Ascend"
            value="8%"
            change="-2.3% YoY"
            color="#6366F1"
            revenue="$2.1B"
            marketCap="--"
          />
        </div>

        {/* === BAR CHART === */}
        <div
          style={{
            background: "rgba(255,255,255,0.03)",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.06)",
            padding: "14px 20px",
            marginBottom: 20,
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "rgba(255,255,255,0.4)",
              textTransform: "uppercase",
              letterSpacing: 1.2,
              marginBottom: 12,
            }}
          >
            Market Share Breakdown
          </div>
          <div style={{ display: "flex", gap: 3, height: 24, borderRadius: 6, overflow: "hidden" }}>
            <div
              style={{
                flex: 80,
                background: "linear-gradient(90deg, #76B900, #76B900CC)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                fontWeight: 700,
                color: "#fff",
              }}
            >
              NVIDIA 80%
            </div>
            <div
              style={{
                flex: 12,
                background: "linear-gradient(90deg, #ED1C24, #ED1C24CC)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10,
                fontWeight: 600,
                color: "#fff",
              }}
            >
              AMD
            </div>
            <div
              style={{
                flex: 8,
                background: "linear-gradient(90deg, #6366F1, #6366F1CC)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 9,
                fontWeight: 600,
                color: "#fff",
              }}
            >
              Other
            </div>
          </div>
        </div>

        {/* === ANALYSIS + REVENUE CHART === */}
        <div style={{ display: "flex", gap: 20, marginBottom: 20, flex: 1, minHeight: 0 }}>
          {/* Analysis paragraph */}
          <div data-presentation-id="analysis" style={{ flex: 1.3 }}>
            <SectionTitle>Investment Thesis</SectionTitle>
            <div
              style={{
                fontSize: 13,
                color: "rgba(255,255,255,0.7)",
                lineHeight: 1.85,
                marginTop: 10,
              }}
            >
              According to the latest data, NVIDIA holds an{" "}
              <Emphasis color="#76B900">80%</Emphasis> share of the AI training
              chip market. The H100/H200 series GPU dominates large model
              training with absolute leadership.
            </div>
            <div
              style={{
                fontSize: 13,
                color: "rgba(255,255,255,0.7)",
                lineHeight: 1.85,
                marginTop: 8,
              }}
            >
              AMD has captured <Emphasis color="#ED1C24">12%</Emphasis> market
              share with MI300X, showing the fastest growth rate at{" "}
              <Emphasis color="#ED1C24">+180% YoY</Emphasis>. ROCm ecosystem
              maturity is the key catalyst.
            </div>
            <div
              style={{
                fontSize: 13,
                color: "rgba(255,255,255,0.55)",
                lineHeight: 1.85,
                marginTop: 8,
                fontStyle: "italic",
              }}
            >
              Key risk: Open-source inference frameworks (vLLM, TensorRT-LLM)
              are reducing CUDA lock-in, potentially enabling AMD acceleration.
            </div>
          </div>

          {/* Revenue bar chart */}
          <div
            data-presentation-id="revenue-chart"
            style={{
              flex: 0.7,
              background: "rgba(255,255,255,0.03)",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.06)",
              padding: "14px 18px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <SectionTitle>DC Revenue (FY2024)</SectionTitle>
            <div
              style={{
                marginTop: 14,
                display: "flex",
                flexDirection: "column",
                gap: 10,
                flex: 1,
                justifyContent: "center",
              }}
            >
              <BarRow presentationId="bar-nvidia" label="NVIDIA" value={80} color="#76B900" amount="$26.0B" />
              <BarRow presentationId="bar-amd" label="AMD" value={12} color="#ED1C24" amount="$3.5B" />
              <BarRow presentationId="bar-intel" label="Intel" value={4} color="#0071C5" amount="$1.1B" />
              <BarRow presentationId="bar-google" label="Google" value={3} color="#4285F4" amount="$0.8B" />
              <BarRow presentationId="bar-huawei" label="Huawei" value={1} color="#CF0A2C" amount="$0.2B" />
            </div>
          </div>
        </div>

        {/* === TIMELINE === */}
        <div
          style={{
            background: "rgba(255,255,255,0.03)",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.06)",
            padding: "14px 24px",
          }}
        >
          <SectionTitle>Key Timeline</SectionTitle>
          <div
            style={{
              marginTop: 12,
              display: "flex",
              alignItems: "center",
              gap: 0,
              position: "relative",
            }}
          >
            {/* Connecting line */}
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: 0,
                right: 0,
                height: 1,
                background:
                  "linear-gradient(90deg, rgba(255,255,255,0.1), rgba(255,255,255,0.2), rgba(255,255,255,0.1))",
                transform: "translateY(-50%)",
              }}
            />
            <TimelineItem date="2022.03" label="H100 发布" color="#76B900" />
            <TimelineItem date="2023.06" label="MI300X 发布" color="#ED1C24" />
            <TimelineItem date="2023.12" label="TPU v5e GA" color="#4285F4" />
            <TimelineItem date="2024.03" label="B200 预览" color="#76B900" />
            <TimelineItem date="2024.Q4" label="MI400 路线图" color="#ED1C24" isLast />
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
  presentationId,
  label,
  sublabel,
  value,
  change,
  color,
  revenue,
  marketCap,
}: {
  presentationId?: string
  label: string
  sublabel: string
  value: string
  change: string
  color: string
  revenue: string
  marketCap: string
}) {
  const isPositive = change.startsWith("+")
  return (
    <div
      data-presentation-id={presentationId}
      style={{
        flex: 1,
        background: "rgba(255,255,255,0.04)",
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.06)",
        borderLeft: `3px solid ${color}`,
        padding: "14px 18px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Subtle glow */}
      <div
        style={{
          position: "absolute",
          top: -20,
          right: -20,
          width: 60,
          height: 60,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${color}15, transparent 70%)`,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          fontSize: 13,
          color: "rgba(255,255,255,0.55)",
          fontWeight: 600,
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 10,
          color: "rgba(255,255,255,0.3)",
          marginBottom: 8,
        }}
      >
        {sublabel}
      </div>
      <div
        data-presentation-id={presentationId ? `${label.toLowerCase()}-value` : undefined}
        style={{
          fontSize: 32,
          fontWeight: 800,
          color,
          marginBottom: 6,
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div
          style={{
            fontSize: 11,
            color: isPositive ? "#4ADE80" : "#F87171",
            fontWeight: 600,
          }}
        >
          {change}
        </div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>
          {revenue}
        </div>
      </div>
      <div
        style={{
          fontSize: 10,
          color: "rgba(255,255,255,0.3)",
          marginTop: 4,
        }}
      >
        MCap: {marketCap}
      </div>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
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

function Emphasis({
  children,
  color,
}: {
  children: React.ReactNode
  color: string
}) {
  return <span style={{ color, fontWeight: 700 }}>{children}</span>
}

function Separator() {
  return (
    <span
      style={{
        width: 1,
        height: 12,
        background: "rgba(255,255,255,0.2)",
        display: "inline-block",
      }}
    />
  )
}

function BarRow({
  presentationId,
  label,
  value,
  color,
  amount,
}: {
  presentationId?: string
  label: string
  value: number
  color: string
  amount: string
}) {
  return (
    <div data-presentation-id={presentationId} style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div
        style={{
          width: 48,
          fontSize: 11,
          color: "rgba(255,255,255,0.5)",
          textAlign: "right",
        }}
      >
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
      <div
        style={{
          width: 44,
          fontSize: 10,
          color: "rgba(255,255,255,0.4)",
          textAlign: "right",
        }}
      >
        {amount}
      </div>
    </div>
  )
}

function TimelineItem({
  date,
  label,
  color,
  isLast,
}: {
  date: string
  label: string
  color: string
  isLast?: boolean
}) {
  return (
    <div
      style={{
        flex: isLast ? undefined : 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        position: "relative",
        zIndex: 1,
      }}
    >
      <div
        style={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: color,
          border: "2px solid rgba(255,255,255,0.2)",
          marginBottom: 6,
        }}
      />
      <div
        style={{
          fontSize: 10,
          color: "rgba(255,255,255,0.6)",
          fontWeight: 600,
          whiteSpace: "nowrap",
        }}
      >
        {date}
      </div>
      <div
        style={{
          fontSize: 9,
          color: "rgba(255,255,255,0.4)",
          whiteSpace: "nowrap",
          marginTop: 2,
        }}
      >
        {label}
      </div>
    </div>
  )
}
