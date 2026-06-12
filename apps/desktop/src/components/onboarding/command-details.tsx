/**
 * CommandDetails Component
 *
 * Displays command/path details with copy functionality.
 * Used in environment check items to show detailed information.
 */

import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Copy, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

export interface DetailItem {
  label: string;
  value: string;
  copyable?: boolean;
}

export interface CommandDetailsProps {
  /** List of detail items to display */
  items?: DetailItem[];
  /** Legacy: Binary path */
  binaryPath?: string | null;
  /** Legacy: Command string */
  command?: string | null;
  /** Additional className */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function CommandDetails({
  items,
  binaryPath,
  command,
  className,
}: CommandDetailsProps) {
  const { t } = useTranslation();
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopy = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // Build items list from legacy props if items not provided
  const displayItems: DetailItem[] = useMemo(() => {
    if (items && items.length > 0) {
      return items;
    }

    const legacyItems: DetailItem[] = [];
    if (binaryPath) {
      legacyItems.push({ label: t("onboarding.envCheck.labels.binary", "Binary"), value: binaryPath, copyable: true });
    }
    if (command) {
      legacyItems.push({ label: t("onboarding.envCheck.labels.command", "Command"), value: command, copyable: true });
    }
    return legacyItems;
  }, [items, binaryPath, command]);

  if (displayItems.length === 0) return null;

  return (
    <div
      className={cn(
        "space-y-2 rounded bg-muted/50 p-3 font-mono text-xs",
        className
      )}
    >
      {displayItems.map((item, index) => (
        <div key={index} className="flex items-start gap-2">
          <span className="text-muted-foreground shrink-0 pt-0.5 min-w-[60px]">
            {item.label}:
          </span>
          <div className="flex-1 min-w-0 overflow-x-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent">
            <code className="whitespace-nowrap">{item.value}</code>
          </div>
          {item.copyable !== false && (
            <button
              onClick={() => handleCopy(item.value, index)}
              className="shrink-0 p-1 rounded hover:bg-muted-foreground/10 transition-colors"
              title={t("common.copyItem", { item: item.label.toLowerCase() })}
            >
              {copiedIndex === index ? (
                <CheckCheck className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Copy className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
