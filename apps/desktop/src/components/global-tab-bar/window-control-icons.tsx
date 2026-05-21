// apps/desktop/src/components/global-tab-bar/window-control-icons.tsx

/**
 * Windows 11 Style Window Control Icons
 *
 * Custom SVG icons that match Windows 11 Segoe MDL2 style:
 * - Sharp corners (no border-radius)
 * - Thin strokes
 * - Clean geometric shapes
 */

import type { SVGProps } from "react";

interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number;
}

/**
 * Minimize icon - single horizontal line
 */
export function MinimizeIcon({ size = 10, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 10 10"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M0 5H10" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

/**
 * Maximize icon - empty square outline
 */
export function MaximizeIcon({ size = 10, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 10 10"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <rect x="0.5" y="0.5" width="9" height="9" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

/**
 * Restore icon - two overlapping squares (Windows 11 style)
 */
export function RestoreIcon({ size = 10, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 10 10"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {/* Back square (top-right) */}
      <path d="M2.5 0.5H9.5V7.5" stroke="currentColor" strokeWidth="1" />
      <path d="M2.5 0.5V0.5" stroke="currentColor" strokeWidth="1" />
      {/* Front square (bottom-left) */}
      <rect x="0.5" y="2.5" width="7" height="7" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

/**
 * Close icon - X shape
 */
export function CloseIcon({ size = 10, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 10 10"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M0 0L10 10M10 0L0 10" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}
