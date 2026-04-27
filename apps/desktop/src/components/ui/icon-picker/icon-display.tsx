/**
 * IconDisplay Component
 *
 * Unified icon display component that supports:
 * - Lucide icons (by name)
 * - Emoji characters
 * - Custom images (local path or URL)
 */

import * as React from "react";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { DynamicLucideIcon } from "./dynamic-lucide-icon";
import { LUCIDE_ICON_MAP, DEFAULT_ICON_NAME } from "./constants";
import { parseIconData, getIconSizeClass, getIconPixelSize } from "./utils";
import type { IconData, IconSize } from "./types";

export interface IconDisplayProps {
  /** Icon data (new format) or string (old format) */
  icon?: IconData | string | null;
  /** Icon size preset or pixel value */
  size?: IconSize | number;
  /** Fallback icon when icon is empty or invalid */
  fallback?: IconData | string;
  /** Workspace path for resolving relative image paths */
  workspacePath?: string;
  /** Additional CSS classes */
  className?: string;
  /** Alt text for images */
  alt?: string;
}

/**
 * Internal component for rendering image icons
 */
function ImageIcon({
  src,
  size,
  workspacePath,
  className,
  alt,
}: {
  src: string;
  size: number;
  workspacePath?: string;
  className?: string;
  alt?: string;
}) {
  const [error, setError] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  // Resolve the image URL
  const imageUrl = React.useMemo(() => {
    // Already a full URL or data URL
    if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("data:")) {
      return src;
    }

    // Relative path - need to construct URL through gateway
    if (workspacePath) {
      // Use gateway file serving endpoint
      const gatewayUrl = import.meta.env.VITE_GATEWAY_URL || "http://127.0.0.1:18790";
      return `${gatewayUrl}/api/file/read?workspace_path=${encodeURIComponent(workspacePath)}&file_path=${encodeURIComponent(src)}`;
    }

    // Fallback: treat as relative path (may not work without workspace)
    return src;
  }, [src, workspacePath]);

  // Reset states when src changes
  React.useEffect(() => {
    setError(false);
    setLoading(true);
  }, [imageUrl]);

  if (error) {
    // Show fallback icon on error
    return <FileText className={cn(getIconSizeClass(size), className)} />;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center overflow-hidden rounded",
        className
      )}
      style={{ width: size, height: size }}
    >
      {loading && (
        <span
          className="animate-pulse bg-muted rounded"
          style={{ width: size, height: size }}
        />
      )}
      <img
        src={imageUrl}
        alt={alt ?? "icon"}
        width={size}
        height={size}
        className={cn(
          "object-cover",
          loading && "hidden"
        )}
        onLoad={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          setError(true);
        }}
      />
    </span>
  );
}

/**
 * IconDisplay component
 *
 * Renders an icon based on its type (lucide, emoji, or image).
 * Supports both new IconData format and legacy string format.
 */
export function IconDisplay({
  icon,
  size = "md",
  fallback,
  workspacePath,
  className,
  alt,
}: IconDisplayProps) {
  // Parse icon data from various formats
  const iconData = React.useMemo(() => {
    // Parse the main icon
    let data: IconData | null = null;

    if (icon) {
      if (typeof icon === "string") {
        data = parseIconData(icon);
      } else {
        data = icon;
      }
    }

    // Use fallback if no valid icon
    if (!data && fallback) {
      if (typeof fallback === "string") {
        data = parseIconData(fallback);
      } else {
        data = fallback;
      }
    }

    // Ultimate fallback
    if (!data) {
      data = { type: "lucide", value: DEFAULT_ICON_NAME };
    }

    return data;
  }, [icon, fallback]);

  // Get size values
  const sizeClass = getIconSizeClass(size);
  const pixelSize = getIconPixelSize(size);

  // Render based on icon type
  switch (iconData.type) {
    case "lucide": {
      const StaticIcon = LUCIDE_ICON_MAP[iconData.value];
      if (StaticIcon) {
        return <StaticIcon className={cn(sizeClass, "shrink-0", className)} />;
      }
      // Fallback: dynamically load icons not in static map
      return (
        <DynamicLucideIcon
          name={iconData.value}
          size={pixelSize}
          className={cn("shrink-0", className)}
        />
      );
    }

    case "emoji": {
      // Calculate font size based on icon size (slightly smaller than container)
      const fontSize = Math.floor(pixelSize * 0.85);
      return (
        <span
          className={cn(
            "inline-flex items-center justify-center shrink-0 leading-none",
            className
          )}
          style={{
            width: pixelSize,
            height: pixelSize,
            fontSize: `${fontSize}px`,
          }}
        >
          {iconData.value}
        </span>
      );
    }

    case "image": {
      return (
        <ImageIcon
          src={iconData.value}
          size={pixelSize}
          workspacePath={workspacePath}
          className={className}
          alt={alt}
        />
      );
    }

    default: {
      // Fallback to default icon
      return <FileText className={cn(sizeClass, "shrink-0", className)} />;
    }
  }
}

export default IconDisplay;
