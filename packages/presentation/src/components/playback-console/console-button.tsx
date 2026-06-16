import type React from "react"
import type { ReactNode } from "react"

export function ConsoleButton({
  title,
  icon,
  onClick,
  primary,
  large,
  style: styleProp,
  "aria-label": ariaLabel,
}: {
  title: string
  icon: ReactNode
  onClick: () => void
  primary?: boolean
  large?: boolean
  style?: React.CSSProperties
  "aria-label"?: string
}) {
  const size = large ? 38 : 32

  return (
    <button
      className={`pbc-btn ${primary ? "pbc-btn-primary" : "pbc-btn-ghost"}`}
      type="button"
      title={title}
      aria-label={ariaLabel}
      onClick={onClick}
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: primary ? "1px solid rgba(118,185,0,0.7)" : "1px solid rgba(255,255,255,0.1)",
        borderRadius: primary ? 10 : 8,
        background: primary ? "rgba(118,185,0,0.22)" : "rgba(255,255,255,0.05)",
        color: "#fff",
        cursor: "pointer",
        padding: 0,
        ...styleProp,
      }}
    >
      {icon}
    </button>
  )
}
