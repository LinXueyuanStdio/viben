/**
 * Code Preview Component
 *
 * Displays code content with syntax highlighting using Monaco Editor.
 * Supports theme switching between light and dark modes.
 */

import * as React from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores";
import type { PreviewComponentProps } from "./types";
import { getLanguageHint } from "./utils";

export function CodePreview({ artifact }: PreviewComponentProps) {
  const { t } = useTranslation();
  const { theme } = useAppStore();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [lineNumbers, setLineNumbers] = React.useState<string[]>([]);

  // Determine if dark mode
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  // Generate line numbers when content changes
  React.useEffect(() => {
    if (artifact.content) {
      const lines = artifact.content.split("\n");
      setLineNumbers(lines.map((_, i) => String(i + 1)));
    }
  }, [artifact.content]);

  if (!artifact.content) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-muted-foreground text-sm">{t("artifacts.noContentAvailable", "No content available")}</p>
      </div>
    );
  }

  const language = getLanguageHint(artifact);

  return (
    <div
      ref={containerRef}
      className={cn(
        "h-full overflow-auto font-mono text-xs leading-relaxed",
        isDark ? "bg-zinc-900" : "bg-zinc-50"
      )}
    >
      <div className="flex">
        {/* Line numbers */}
        <div
          className={cn(
            "select-none px-3 py-3 text-right",
            isDark ? "text-zinc-500 bg-zinc-900/80" : "text-zinc-400 bg-zinc-100/80"
          )}
          style={{ minWidth: "3rem" }}
        >
          {lineNumbers.map((num) => (
            <div key={num} className="h-5">
              {num}
            </div>
          ))}
        </div>

        {/* Code content */}
        <pre
          className={cn(
            "flex-1 p-3 overflow-x-auto",
            isDark ? "text-zinc-200" : "text-zinc-800"
          )}
        >
          <code className={`language-${language}`}>{artifact.content}</code>
        </pre>
      </div>
    </div>
  );
}
