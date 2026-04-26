import { useMemo, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Minus, Plus, Monitor, RotateCcw, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useTerminalFontStore } from "@/stores/terminal-font-store";
import type { TerminalFontSettings } from "@/stores/terminal-font-store";
import {
  FONT_SIZE_MIN,
  FONT_SIZE_MAX,
  FONT_SIZE_STEP,
  FONT_WEIGHT_MIN,
  FONT_WEIGHT_MAX,
  FONT_WEIGHT_STEP,
  LINE_HEIGHT_MIN,
  LINE_HEIGHT_MAX,
  LINE_HEIGHT_STEP,
  LETTER_SPACING_MIN,
  LETTER_SPACING_MAX,
  LETTER_SPACING_STEP,
  SLIDER_INPUT_CLASSES,
  COMMON_MONOSPACE_FONTS,
  VALID_CURSOR_STYLES,
} from "@/lib/terminal-font-constants";
import { SettingsItem, SectionHeader } from "./components";

// Preset card configuration
const BUILTIN_PRESETS = [
  { id: "vscode", nameKey: "settings.terminalFonts.presets.vscode" },
  { id: "intellij", nameKey: "settings.terminalFonts.presets.intellij" },
  { id: "macos", nameKey: "settings.terminalFonts.presets.macos" },
  { id: "ubuntu", nameKey: "settings.terminalFonts.presets.ubuntu" },
];

export function TerminalFontsSection() {
  const { t, i18n } = useTranslation();

  // Get current settings from store using individual selectors
  const fontFamily = useTerminalFontStore((state) => state.fontFamily);
  const fontSize = useTerminalFontStore((state) => state.fontSize);
  const fontWeight = useTerminalFontStore((state) => state.fontWeight);
  const lineHeight = useTerminalFontStore((state) => state.lineHeight);
  const letterSpacing = useTerminalFontStore((state) => state.letterSpacing);
  const cursorStyle = useTerminalFontStore((state) => state.cursorStyle);
  const cursorBlink = useTerminalFontStore((state) => state.cursorBlink);

  // Get action methods from store
  const setFontFamily = useTerminalFontStore((state) => state.setFontFamily);
  const setFontSize = useTerminalFontStore((state) => state.setFontSize);
  const setFontWeight = useTerminalFontStore((state) => state.setFontWeight);
  const setLineHeight = useTerminalFontStore((state) => state.setLineHeight);
  const setLetterSpacing = useTerminalFontStore((state) => state.setLetterSpacing);
  const setCursorStyle = useTerminalFontStore((state) => state.setCursorStyle);
  const setCursorBlink = useTerminalFontStore((state) => state.setCursorBlink);
  const applyPreset = useTerminalFontStore((state) => state.applyPreset);
  const resetToDefaults = useTerminalFontStore((state) => state.resetToDefaults);
  const exportSettings = useTerminalFontStore((state) => state.exportSettings);

  // Reconstruct settings object for preview
  const settings = useMemo<TerminalFontSettings>(
    () => ({
      fontFamily,
      fontSize,
      fontWeight,
      lineHeight,
      letterSpacing,
      cursorStyle,
      cursorBlink,
      cursorAccentColor: "#000000",
      scrollback: 10000,
    }),
    [fontFamily, fontSize, fontWeight, lineHeight, letterSpacing, cursorStyle, cursorBlink]
  );

  // Locale-aware number formatter
  const numberFormatter = useMemo(() => {
    return new Intl.NumberFormat(i18n.language, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    });
  }, [i18n.language]);

  // State for available fonts
  const [availableFonts, setAvailableFonts] = useState<string[]>([]);

  // Load available fonts on mount
  useEffect(() => {
    const allFonts = [
      ...COMMON_MONOSPACE_FONTS.windows,
      ...COMMON_MONOSPACE_FONTS.macos,
      ...COMMON_MONOSPACE_FONTS.linux,
      ...COMMON_MONOSPACE_FONTS.popular,
    ];
    const uniqueFonts = [...new Set(allFonts)].filter((f) => f.toLowerCase() !== "monospace");
    setAvailableFonts(uniqueFonts);
  }, []);

  // Current font family (primary font from the array)
  const currentFontFamily = fontFamily[0] || "";

  // Handle font family change
  const handleFontFamilyChange = (font: string) => {
    setFontFamily([font, "monospace"]);
  };

  // Handle font size change
  const handleFontSizeChange = (value: number) => {
    if (Number.isNaN(value)) return;
    const clampedValue = Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, value));
    setFontSize(clampedValue);
  };

  // Handle font weight change
  const handleFontWeightChange = (value: string) => {
    const numValue = parseInt(value, 10);
    if (Number.isNaN(numValue)) return;
    const clampedValue = Math.max(FONT_WEIGHT_MIN, Math.min(FONT_WEIGHT_MAX, numValue));
    const steppedValue = Math.round(clampedValue / FONT_WEIGHT_STEP) * FONT_WEIGHT_STEP;
    setFontWeight(steppedValue);
  };

  // Handle line height change
  const handleLineHeightChange = (value: number) => {
    if (Number.isNaN(value)) return;
    const clampedValue = Math.max(LINE_HEIGHT_MIN, Math.min(LINE_HEIGHT_MAX, value));
    const roundedValue = Math.round(clampedValue * 10) / 10;
    setLineHeight(roundedValue);
  };

  // Handle letter spacing change
  const handleLetterSpacingChange = (value: number) => {
    if (Number.isNaN(value)) return;
    const clampedValue = Math.max(LETTER_SPACING_MIN, Math.min(LETTER_SPACING_MAX, value));
    const roundedValue = Math.round(clampedValue * 10) / 10;
    setLetterSpacing(roundedValue);
  };

  // Handle copy to clipboard
  const handleCopyToClipboard = async () => {
    try {
      const json = exportSettings();
      await navigator.clipboard.writeText(json);
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold font-serif mb-1">
          {t("settings.sections.terminalFonts")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("settings.terminalFonts.description")}
        </p>
      </div>

      {/* Font Configuration */}
      <div className="rounded-xl border bg-card p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/30">
        <SectionHeader title={t("settings.terminalFonts.fontConfig.title")} />

        {/* Font Family */}
        <SettingsItem
          title={t("settings.terminalFonts.fontConfig.fontFamily")}
          description={t("settings.terminalFonts.fontConfig.fontFamilyDescription")}
        >
          <Select value={currentFontFamily} onValueChange={handleFontFamilyChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue>{currentFontFamily || t("settings.terminalFonts.fontConfig.selectFont")}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {availableFonts.map((font) => (
                <SelectItem key={font} value={font}>
                  <span style={{ fontFamily: font }}>{font}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsItem>

        {/* Font Size */}
        <div className="py-4 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <div className="flex-1 pr-4">
              <h3 className="text-sm font-medium text-foreground">
                {t("settings.terminalFonts.fontConfig.fontSize")}
              </h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                {t("settings.terminalFonts.fontConfig.fontSizeDescription")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono text-muted-foreground">{fontSize}px</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleFontSizeChange(fontSize - FONT_SIZE_STEP)}
                  disabled={fontSize <= FONT_SIZE_MIN}
                  className={cn(
                    "p-1 rounded-md transition-colors",
                    "hover:bg-accent text-muted-foreground hover:text-foreground",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleFontSizeChange(fontSize + FONT_SIZE_STEP)}
                  disabled={fontSize >= FONT_SIZE_MAX}
                  className={cn(
                    "p-1 rounded-md transition-colors",
                    "hover:bg-accent text-muted-foreground hover:text-foreground",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
          <input
            type="range"
            min={FONT_SIZE_MIN}
            max={FONT_SIZE_MAX}
            step={FONT_SIZE_STEP}
            value={fontSize}
            onChange={(e) => handleFontSizeChange(parseInt(e.target.value, 10))}
            className={cn(...SLIDER_INPUT_CLASSES)}
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>{FONT_SIZE_MIN}px</span>
            <span>{FONT_SIZE_MAX}px</span>
          </div>
        </div>

        {/* Font Weight */}
        <SettingsItem
          title={t("settings.terminalFonts.fontConfig.fontWeight")}
          description={t("settings.terminalFonts.fontConfig.fontWeightDescription")}
        >
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={FONT_WEIGHT_MIN}
              max={FONT_WEIGHT_MAX}
              step={FONT_WEIGHT_STEP}
              value={fontWeight}
              onChange={(e) => handleFontWeightChange(e.target.value)}
              className={cn(
                "w-20 h-9 px-2 rounded-lg border border-border bg-background text-sm",
                "focus:outline-none focus:ring-2 focus:ring-primary/20"
              )}
            />
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleFontWeightChange((fontWeight - FONT_WEIGHT_STEP).toString())}
                disabled={fontWeight <= FONT_WEIGHT_MIN}
                className={cn(
                  "p-1 rounded-md transition-colors",
                  "hover:bg-accent text-muted-foreground hover:text-foreground",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleFontWeightChange((fontWeight + FONT_WEIGHT_STEP).toString())}
                disabled={fontWeight >= FONT_WEIGHT_MAX}
                className={cn(
                  "p-1 rounded-md transition-colors",
                  "hover:bg-accent text-muted-foreground hover:text-foreground",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </SettingsItem>

        {/* Line Height */}
        <div className="py-4 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <div className="flex-1 pr-4">
              <h3 className="text-sm font-medium text-foreground">
                {t("settings.terminalFonts.fontConfig.lineHeight")}
              </h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                {t("settings.terminalFonts.fontConfig.lineHeightDescription")}
              </p>
            </div>
            <span className="text-sm font-mono text-muted-foreground">
              {numberFormatter.format(lineHeight)}
            </span>
          </div>
          <input
            type="range"
            min={LINE_HEIGHT_MIN}
            max={LINE_HEIGHT_MAX}
            step={LINE_HEIGHT_STEP}
            value={lineHeight}
            onChange={(e) => handleLineHeightChange(parseFloat(e.target.value))}
            className={cn(...SLIDER_INPUT_CLASSES)}
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>{LINE_HEIGHT_MIN.toFixed(1)}</span>
            <span>{LINE_HEIGHT_MAX.toFixed(1)}</span>
          </div>
        </div>

        {/* Letter Spacing */}
        <div className="py-4 border-b border-border last:border-b-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex-1 pr-4">
              <h3 className="text-sm font-medium text-foreground">
                {t("settings.terminalFonts.fontConfig.letterSpacing")}
              </h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                {t("settings.terminalFonts.fontConfig.letterSpacingDescription")}
              </p>
            </div>
            <span className="text-sm font-mono text-muted-foreground">
              {letterSpacing > 0 ? `+${numberFormatter.format(letterSpacing)}` : numberFormatter.format(letterSpacing)}px
            </span>
          </div>
          <input
            type="range"
            min={LETTER_SPACING_MIN}
            max={LETTER_SPACING_MAX}
            step={LETTER_SPACING_STEP}
            value={letterSpacing}
            onChange={(e) => handleLetterSpacingChange(parseFloat(e.target.value))}
            className={cn(...SLIDER_INPUT_CLASSES)}
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>{LETTER_SPACING_MIN}px</span>
            <span>+{LETTER_SPACING_MAX}px</span>
          </div>
        </div>
      </div>

      {/* Cursor Configuration */}
      <div className="rounded-xl border bg-card p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/30">
        <SectionHeader title={t("settings.terminalFonts.cursorConfig.title")} />

        <SettingsItem
          title={t("settings.terminalFonts.cursorConfig.cursorStyle")}
          description={t("settings.terminalFonts.cursorConfig.cursorStyleDescription")}
        >
          <Select value={cursorStyle} onValueChange={(v) => setCursorStyle(v as typeof cursorStyle)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue>{t(`settings.terminalFonts.cursorConfig.styles.${cursorStyle}`)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {VALID_CURSOR_STYLES.map((style) => (
                <SelectItem key={style} value={style}>
                  {t(`settings.terminalFonts.cursorConfig.styles.${style}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsItem>

        <SettingsItem
          title={t("settings.terminalFonts.cursorConfig.cursorBlink")}
          description={t("settings.terminalFonts.cursorConfig.cursorBlinkDescription")}
        >
          <Switch checked={cursorBlink} onCheckedChange={setCursorBlink} />
        </SettingsItem>
      </div>

      {/* Live Preview */}
      <div className="rounded-xl border bg-card p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/30">
        <SectionHeader title={t("settings.terminalFonts.preview.title")} />
        <p className="text-sm text-muted-foreground mb-4">
          {t("settings.terminalFonts.preview.description")}
        </p>
        <div
          className="rounded-lg bg-black p-4 overflow-hidden"
          style={{
            fontFamily: settings.fontFamily.join(", "),
            fontSize: `${settings.fontSize}px`,
            fontWeight: settings.fontWeight,
            lineHeight: settings.lineHeight,
            letterSpacing: `${settings.letterSpacing}px`,
          }}
        >
          <div className="text-green-400">{t("settings.terminalFonts.preview.exampleCommand1")}</div>
          <div className="text-white">{t("settings.terminalFonts.preview.exampleOutput1")}</div>
          <div className="text-green-400">{t("settings.terminalFonts.preview.exampleCommand2")}</div>
          <div className="text-blue-400">{t("settings.terminalFonts.preview.exampleDir1")}</div>
          <div className="text-blue-400">{t("settings.terminalFonts.preview.exampleDir2")}</div>
          <div className="text-white">{t("settings.terminalFonts.preview.exampleFile1")}</div>
          <div className="text-green-400">
            $ <span className={cn("inline-block w-2 h-4 bg-white", cursorBlink && "animate-pulse")} />
          </div>
        </div>
      </div>

      {/* Presets */}
      <div className="rounded-xl border bg-card p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/30">
        <SectionHeader title={t("settings.terminalFonts.presets.title")} />
        <p className="text-sm text-muted-foreground mb-4">
          {t("settings.terminalFonts.presets.description")}
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {BUILTIN_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset.id)}
              className={cn(
                "flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all",
                "border-border hover:border-primary/50 hover:bg-accent/50",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              )}
            >
              <Monitor className="h-5 w-5" />
              <span className="text-sm font-medium">{t(preset.nameKey)}</span>
            </button>
          ))}
        </div>

        {/* Reset and Export */}
        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
          <Button variant="outline" onClick={resetToDefaults} className="flex-1">
            <RotateCcw className="h-4 w-4 mr-2" />
            {t("settings.terminalFonts.presets.reset")}
          </Button>
          <Button variant="outline" onClick={handleCopyToClipboard}>
            <Copy className="h-4 w-4 mr-2" />
            {t("settings.terminalFonts.export")}
          </Button>
        </div>
      </div>
    </div>
  );
}
