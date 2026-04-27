/**
 * DynamicLucideIcon
 *
 * Renders a Lucide icon by name with async loading.
 * Shows skeleton while loading, falls back to FileText on error.
 */

import { useState, useEffect } from "react";
import { FileText } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCachedIcon, loadIcon } from "./icon-cache";

interface DynamicLucideIconProps {
  name: string;
  size?: number;
  className?: string;
}

export function DynamicLucideIcon({ name, size = 16, className }: DynamicLucideIconProps) {
  const [Icon, setIcon] = useState<LucideIcon | null>(() => getCachedIcon(name));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // Check cache first (may have loaded since initial render)
    const cached = getCachedIcon(name);
    if (cached) {
      setIcon(() => cached);
      setFailed(false);
      return;
    }

    // Load dynamically
    let cancelled = false;
    setFailed(false);

    loadIcon(name).then((loaded) => {
      if (cancelled) return;
      if (loaded) {
        setIcon(() => loaded);
      } else {
        setFailed(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [name]);

  // Error fallback
  if (failed) {
    return <FileText className={className} style={{ width: size, height: size }} />;
  }

  // Loading skeleton
  if (!Icon) {
    return (
      <span
        className={cn("animate-pulse rounded bg-muted inline-block", className)}
        style={{ width: size, height: size }}
      />
    );
  }

  // Render loaded icon
  return <Icon className={className} style={{ width: size, height: size }} />;
}
