/**
 * Official exchange brand icons as React SVG components.
 * Sources: official brand assets from each exchange.
 */
import type React from "react";

interface IconProps {
  size?: number;
  className?: string;
}

export function BinanceIcon({ size = 20, className }: IconProps) {
  return (
    <svg viewBox="0 0 126 126" width={size} height={size} className={className} fill="none">
      <path d="M63 0L77.1 14.1L38.7 52.5L24.6 38.4L63 0Z" fill="#F3BA2F" />
      <path d="M87.3 24.3L101.4 38.4L38.7 101.1L24.6 87L87.3 24.3Z" fill="#F3BA2F" />
      <path d="M14.1 49.2L28.2 63.3L14.1 77.4L0 63.3L14.1 49.2Z" fill="#F3BA2F" />
      <path d="M111.9 49.2L126 63.3L63.3 126L49.2 111.9L111.9 49.2Z" fill="#F3BA2F" />
      <path d="M63.3 38.4L77.4 52.5L63.3 66.6L49.2 52.5L63.3 38.4Z" fill="#F3BA2F" />
    </svg>
  );
}

export function OkxIcon({ size = 20, className }: IconProps) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} className={className} fill="none">
      <rect width="12" height="12" x="1" y="1" fill="currentColor" rx="2" />
      <rect width="12" height="12" x="14" y="1" fill="currentColor" rx="2" />
      <rect width="12" height="12" x="27" y="1" fill="currentColor" rx="2" />
      <rect width="12" height="12" x="1" y="14" fill="currentColor" rx="2" />
      <rect width="12" height="12" x="27" y="14" fill="currentColor" rx="2" />
      <rect width="12" height="12" x="1" y="27" fill="currentColor" rx="2" />
      <rect width="12" height="12" x="14" y="27" fill="currentColor" rx="2" />
      <rect width="12" height="12" x="27" y="27" fill="currentColor" rx="2" />
    </svg>
  );
}

export function BybitIcon({ size = 20, className }: IconProps) {
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} className={className} fill="none">
      <path
        d="M40 45h30v110H40V45zm45 0h30l35 65v-65h30v110h-30l-35-65v65H85V45z"
        fill="#F7A600"
      />
    </svg>
  );
}

export function BitgetIcon({ size = 20, className }: IconProps) {
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} className={className} fill="none">
      <path
        d="M55.5 60L100 100L144.5 60H170V140H144.5L100 100L55.5 140H30V60H55.5Z"
        fill="#00F0FF"
      />
    </svg>
  );
}

export function GateIcon({ size = 20, className }: IconProps) {
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} className={className} fill="none">
      <circle cx="100" cy="100" r="70" stroke="#2354E6" strokeWidth="20" fill="none" />
      <path d="M100 100h70" stroke="#2354E6" strokeWidth="20" />
    </svg>
  );
}

export function HtxIcon({ size = 20, className }: IconProps) {
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} className={className} fill="none">
      <path
        d="M100 20c-15 25-50 55-50 90a50 50 0 00100 0c0-35-35-65-50-90z"
        fill="#2BAF6E"
      />
    </svg>
  );
}

export function KucoinIcon({ size = 20, className }: IconProps) {
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} className={className} fill="none">
      <path
        d="M80 60v80M80 100l40-40v30l30-30M80 100l40 40v-30l30 30"
        stroke="#23AF91"
        strokeWidth="16"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function MexcIcon({ size = 20, className }: IconProps) {
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} className={className} fill="none">
      <path
        d="M30 150L65 50L100 120L135 50L170 150"
        stroke="#1972E2"
        strokeWidth="18"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

/** Map exchange id to its icon component */
export const exchangeIcons: Record<string, (props: IconProps) => React.ReactElement> = {
  binance: BinanceIcon,
  okx: OkxIcon,
  bybit: BybitIcon,
  bitget: BitgetIcon,
  gate: GateIcon,
  htx: HtxIcon,
  kucoin: KucoinIcon,
  mexc: MexcIcon,
};
