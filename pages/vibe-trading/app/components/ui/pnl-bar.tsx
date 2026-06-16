"use client";

interface PnlBarProps {
  value: number; // PnL percentage (-1 to 1)
  maxRange?: number; // Maximum range (default 0.1 = 10%)
}

export function PnlBar({ value, maxRange = 0.1 }: PnlBarProps) {
  // Clamp value to [-maxRange, maxRange] then normalize to [-1, 1]
  const clamped = Math.max(-maxRange, Math.min(maxRange, value));
  const normalized = clamped / maxRange; // -1 to 1

  // Bar width as percentage of half the container (since center is midpoint)
  const barWidth = Math.abs(normalized) * 50; // 0 to 50%

  // Position: positive goes right from center, negative goes left from center
  const isPositive = normalized >= 0;

  return (
    <div
      className="relative rounded-full bg-muted overflow-hidden"
      style={{ width: 60, height: 6 }}
    >
      {/* Center line indicator */}
      <div
        className="absolute top-0 bottom-0 w-px bg-border"
        style={{ left: "50%" }}
      />
      {/* PnL bar */}
      <div
        className={`absolute top-0 bottom-0 rounded-full transition-all duration-300 ${
          isPositive ? "bg-gain" : "bg-loss"
        }`}
        style={
          isPositive
            ? { left: "50%", width: `${barWidth}%` }
            : { right: "50%", width: `${barWidth}%` }
        }
      />
    </div>
  );
}
