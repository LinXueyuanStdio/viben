/**
 * Font Preview Component
 *
 * Displays font file preview with sample text using the font.
 * Loads font files via Tauri fs plugin and creates a dynamic @font-face rule.
 */

import * as React from "react";
import { readFile } from "@tauri-apps/plugin-fs";
import { openUrl as openExternal } from "@tauri-apps/plugin-opener";
import { ExternalLink, Loader2, Type } from "lucide-react";

import type { PreviewComponentProps } from "./types";
import { getFileExtension, isRemoteUrl } from "./utils";

const SAMPLE_TEXT = "The quick brown fox jumps over the lazy dog";
const PANGRAM_SENTENCES = [
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  "abcdefghijklmnopqrstuvwxyz",
  "0123456789",
  "!@#$%^&*()_+-=[]{}|;':\",./<>?",
];

const FONT_SIZES = [12, 16, 24, 32, 48, 72];

export function FontPreview({ artifact }: PreviewComponentProps) {
  const [fontLoaded, setFontLoaded] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [fontFamily, setFontFamily] = React.useState<string>("");

  const handleOpenExternal = async () => {
    if (artifact.path) {
      try {
        await openExternal(artifact.path);
      } catch (err) {
        console.error("Failed to open file externally:", err);
      }
    }
  };

  React.useEffect(() => {
    let styleElement: HTMLStyleElement | null = null;

    async function loadFont() {
      if (!artifact.path && !artifact.content) {
        setError("No font file path available");
        setLoading(false);
        return;
      }

      try {
        const ext = getFileExtension(artifact.name);
        const fontFormat = getFontFormat(ext);
        const uniqueFontFamily = `preview-font-${artifact.id}`;

        let fontUrl: string;

        if (artifact.content && artifact.content.startsWith("data:")) {
          // Already a data URL
          fontUrl = artifact.content;
        } else if (artifact.path) {
          if (isRemoteUrl(artifact.path)) {
            // Remote URL - use directly
            fontUrl = artifact.path.startsWith("//")
              ? `https:${artifact.path}`
              : artifact.path;
          } else {
            // Local file - read and create data URL
            const data = await readFile(artifact.path);
            const blob = new Blob([data], { type: `font/${ext}` });
            fontUrl = URL.createObjectURL(blob);
          }
        } else {
          throw new Error("No font source available");
        }

        // Create @font-face rule
        styleElement = document.createElement("style");
        styleElement.textContent = `
          @font-face {
            font-family: '${uniqueFontFamily}';
            src: url('${fontUrl}') format('${fontFormat}');
            font-weight: normal;
            font-style: normal;
          }
        `;
        document.head.appendChild(styleElement);

        // Wait for font to load
        await document.fonts.ready;

        setFontFamily(uniqueFontFamily);
        setFontLoaded(true);
        setError(null);
      } catch (err) {
        console.error("[Font Preview] Failed to load font:", err);
        const errorMsg = err instanceof Error ? err.message : String(err);
        setError(errorMsg);
      } finally {
        setLoading(false);
      }
    }

    loadFont();

    // Cleanup
    return () => {
      if (styleElement) {
        document.head.removeChild(styleElement);
      }
    };
  }, [artifact.id, artifact.path, artifact.content, artifact.name]);

  if (loading) {
    return (
      <div className="bg-muted/20 flex h-full flex-col items-center justify-center p-8">
        <Loader2 className="text-muted-foreground size-8 animate-spin" />
        <p className="text-muted-foreground mt-4 text-sm">Loading font...</p>
      </div>
    );
  }

  if (error || !fontLoaded) {
    return (
      <div className="bg-muted/20 flex h-full flex-col items-center justify-center p-8">
        <div className="flex max-w-md flex-col items-center text-center">
          <div className="border-border bg-background mb-4 flex size-20 items-center justify-center rounded-xl border">
            <Type className="text-muted-foreground size-10" />
          </div>
          <h3 className="text-foreground mb-2 text-lg font-medium">
            {artifact.name}
          </h3>
          <p className="text-muted-foreground mb-6 text-sm break-all whitespace-pre-wrap">
            {error || "Font preview not available"}
          </p>
          <button
            onClick={handleOpenExternal}
            className="bg-primary text-primary-foreground hover:bg-primary/90 flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            <ExternalLink className="size-4" />
            Open in Font Viewer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background flex h-full flex-col overflow-auto">
      {/* Header */}
      <div className="border-border bg-muted/30 shrink-0 border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 flex size-12 items-center justify-center rounded-lg">
            <Type className="text-primary size-6" />
          </div>
          <div>
            <h2 className="text-foreground text-lg font-semibold">
              {artifact.name.replace(/\.[^/.]+$/, "")}
            </h2>
            <p className="text-muted-foreground text-xs uppercase">
              {getFileExtension(artifact.name)} Font
            </p>
          </div>
        </div>
      </div>

      {/* Sample text at different sizes */}
      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-8">
          {/* Main sample */}
          <div className="border-border rounded-xl border p-6">
            <p
              className="text-foreground text-4xl leading-relaxed"
              style={{ fontFamily }}
            >
              {SAMPLE_TEXT}
            </p>
          </div>

          {/* Character sets */}
          <div className="space-y-4">
            <h3 className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
              Character Set
            </h3>
            <div className="border-border rounded-xl border p-4">
              {PANGRAM_SENTENCES.map((text, idx) => (
                <p
                  key={idx}
                  className="text-foreground mb-2 text-lg leading-relaxed last:mb-0"
                  style={{ fontFamily }}
                >
                  {text}
                </p>
              ))}
            </div>
          </div>

          {/* Size samples */}
          <div className="space-y-4">
            <h3 className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
              Size Samples
            </h3>
            <div className="border-border space-y-4 rounded-xl border p-4">
              {FONT_SIZES.map((size) => (
                <div key={size} className="flex items-baseline gap-4">
                  <span className="text-muted-foreground w-12 shrink-0 text-right text-xs">
                    {size}px
                  </span>
                  <p
                    className="text-foreground flex-1"
                    style={{ fontFamily, fontSize: `${size}px` }}
                  >
                    {SAMPLE_TEXT}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Get font format string for @font-face src
 */
function getFontFormat(ext: string): string {
  const formatMap: Record<string, string> = {
    ttf: "truetype",
    otf: "opentype",
    woff: "woff",
    woff2: "woff2",
    eot: "embedded-opentype",
  };
  return formatMap[ext.toLowerCase()] || "truetype";
}
