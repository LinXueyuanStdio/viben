import type {
  LiteTerminalOptions,
  ThemeConfig,
  TextStyle,
  DataCallback,
  StyledSegment,
} from "./types";
import { AnsiParser, type ParseResult } from "./ansi-parser";
import { InputHandler } from "./input-handler";

/** Maximum number of lines to keep in scrollback */
const MAX_SCROLLBACK_LINES = 100_000;

/**
 * URL schemes considered safe for clickable terminal links.
 */
const SAFE_LINK_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

function isSafeLinkUrl(url: string): boolean {
  try {
    const parsed = new URL(url, "https://example.invalid/");
    if (!SAFE_LINK_PROTOCOLS.has(parsed.protocol)) return false;
    if (parsed.hostname === "example.invalid" && !/^https?:|^mailto:/i.test(url)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Lightweight terminal implementation
 */
export class LiteTerminal {
  private container: HTMLElement | null = null;
  private outputElement: HTMLElement | null = null;
  private cursorElement: HTMLElement | null = null;

  private parser: AnsiParser;
  private inputHandler: InputHandler;

  private lines: StyledSegment[][] = [[]];
  private currentLine = 0;
  private currentCol = 0;
  private currentStyle: TextStyle = {};

  private _cols = 80;
  private _options: LiteTerminalOptions;

  private pendingWrites: string[] = [];
  private writeScheduled = false;

  // Incremental rendering state
  private lineElements: HTMLElement[] = [];
  private dirtyLines: Set<number> = new Set();
  private lastCursorLine = -1;

  constructor(options: LiteTerminalOptions = {}) {
    this._options = {
      cursorBlink: true,
      fontSize: 14,
      fontFamily: '"JetBrains Mono", "SF Mono", Menlo, monospace',
      lineHeight: 1.4,
      letterSpacing: 0,
      theme: {
        background: "transparent",
        foreground: "#e0e0e0",
        cursor: "#fff",
        cyan: "#0AC5B3",
        brightCyan: "#3DD9C8",
        brightBlack: "#666",
      },
      ...options,
    };

    this.parser = new AnsiParser();
    this.inputHandler = new InputHandler();
  }

  /**
   * Get terminal width in columns
   */
  get cols(): number {
    return this._cols;
  }

  /**
   * Get/set terminal options (for theme updates)
   */
  get options(): { theme: ThemeConfig } {
    const terminal = this;
    return {
      get theme() {
        return terminal._options.theme as ThemeConfig;
      },
      set theme(newTheme: ThemeConfig) {
        terminal._options.theme = { ...terminal._options.theme, ...newTheme };
        terminal.applyTheme();
      },
    };
  }

  /**
   * Open terminal in a container element
   */
  open(container: HTMLElement): void {
    this.container = container;

    // Create terminal structure
    container.innerHTML = "";
    container.className = "lite-terminal";
    container.setAttribute("role", "region");
    container.setAttribute("aria-label", "Terminal");

    // Output area
    this.outputElement = document.createElement("pre");
    this.outputElement.className = "lite-terminal-output";
    this.outputElement.setAttribute("role", "log");
    this.outputElement.setAttribute("aria-live", "off");
    this.outputElement.setAttribute("aria-label", "Terminal output");
    container.appendChild(this.outputElement);

    // Cursor element (inline within text flow)
    this.cursorElement = document.createElement("span");
    this.cursorElement.className = "lite-terminal-cursor";
    if (this._options.cursorBlink) {
      this.cursorElement.classList.add("blink");
    }
    this.outputElement.appendChild(this.cursorElement);

    // Apply theme colors
    this.applyTheme();

    // Calculate columns
    this.calculateCols();

    // Attach input handler
    this.inputHandler.attach(container);

    // Handle resize
    if (typeof ResizeObserver !== "undefined") {
      const resizeObserver = new ResizeObserver(() => {
        this.calculateCols();
      });
      resizeObserver.observe(container);
    }
  }

  /**
   * Write data to the terminal
   */
  write(data: string): void {
    this.pendingWrites.push(data);
    this.scheduleWrite();
  }

  /**
   * Write data followed by newline
   */
  writeln(data: string): void {
    this.write(data + "\n");
  }

  /**
   * Clear the terminal
   */
  clear(): void {
    this.lines = [[]];
    this.currentLine = 0;
    this.currentCol = 0;
    this.currentStyle = {};
    this.parser.reset();
    this.lineElements = [];
    this.dirtyLines.clear();
    this.lastCursorLine = -1;
    this.render(true);
  }

  /**
   * Register callback for input data
   */
  onData(callback: DataCallback): void {
    this.inputHandler.onData(callback);
  }

  /**
   * Focus the terminal
   */
  focus(): void {
    this.inputHandler.focus();
  }

  /**
   * Dispose of terminal resources
   */
  dispose(): void {
    this.inputHandler.detach();
    if (this.container) {
      this.container.innerHTML = "";
      this.container = null;
    }
    this.outputElement = null;
    this.cursorElement = null;
  }

  /**
   * Schedule a batched write operation
   */
  private scheduleWrite(): void {
    if (this.writeScheduled) return;
    this.writeScheduled = true;

    requestAnimationFrame(() => {
      this.writeScheduled = false;
      this.processWrites();
    });
  }

  /**
   * Process all pending writes
   */
  private processWrites(): void {
    if (this.pendingWrites.length === 0) return;

    const combined = this.pendingWrites.join("");
    this.pendingWrites = [];

    const results = this.parser.parse(combined);

    const startLine = this.currentLine;

    for (const result of results) {
      this.processParseResult(result);
    }

    for (let i = startLine; i <= this.currentLine; i++) {
      this.dirtyLines.add(i);
    }

    this.render(false);
    this.scrollToBottom();
  }

  /**
   * Process a single parse result
   */
  private processParseResult(result: ParseResult): void {
    switch (result.type) {
      case "text":
        this.writeText(result.text || "");
        break;

      case "style":
        if (result.style) {
          this.currentStyle = { ...result.style };
        }
        break;

      case "cursor":
        if (result.cursor) {
          this.handleCursor(result.cursor);
        }
        break;

      case "clear":
        this.handleClear(result.clear || "line");
        break;
    }
  }

  /**
   * Write text to the current position
   */
  private writeText(text: string): void {
    for (const char of text) {
      if (char === "\n") {
        this.newLine();
      } else {
        this.writeChar(char);
      }
    }
  }

  /**
   * Write a single character at current position
   */
  private writeChar(char: string): void {
    const line = this.lines[this.currentLine];

    let pos = 0;
    let segmentIndex = 0;
    let charInSegment = 0;

    while (segmentIndex < line.length && pos < this.currentCol) {
      const segLen = line[segmentIndex].text.length;
      if (pos + segLen > this.currentCol) {
        charInSegment = this.currentCol - pos;
        break;
      }
      pos += segLen;
      segmentIndex++;
      charInSegment = 0;
    }

    if (segmentIndex >= line.length) {
      const gap = this.currentCol - pos;
      if (gap > 0) {
        line.push({ text: " ".repeat(gap), style: {} });
      }
      const lastSeg = line[line.length - 1];
      if (lastSeg && this.stylesEqual(lastSeg.style, this.currentStyle)) {
        lastSeg.text += char;
      } else {
        line.push({ text: char, style: { ...this.currentStyle } });
      }
    } else if (charInSegment > 0) {
      const seg = line[segmentIndex];
      const before = seg.text.slice(0, charInSegment);
      const after = seg.text.slice(charInSegment + 1);

      if (this.stylesEqual(seg.style, this.currentStyle)) {
        seg.text = before + char + after;
      } else {
        const newSegments: StyledSegment[] = [];
        if (before) {
          newSegments.push({ text: before, style: seg.style });
        }
        newSegments.push({ text: char, style: { ...this.currentStyle } });
        if (after) {
          newSegments.push({ text: after, style: seg.style });
        }
        line.splice(segmentIndex, 1, ...newSegments);
      }
    } else {
      const seg = line[segmentIndex];
      if (this.stylesEqual(seg.style, this.currentStyle)) {
        seg.text = char + seg.text.slice(1);
      } else {
        const after = seg.text.slice(1);
        const newSegments: StyledSegment[] = [
          { text: char, style: { ...this.currentStyle } },
        ];
        if (after) {
          newSegments.push({ text: after, style: seg.style });
        }
        line.splice(segmentIndex, 1, ...newSegments);
      }
    }

    this.currentCol++;
  }

  /**
   * Start a new line
   */
  private newLine(): void {
    this.dirtyLines.add(this.currentLine);

    this.currentLine++;
    this.currentCol = 0;
    if (this.currentLine >= this.lines.length) {
      this.lines.push([]);
      if (this.outputElement) {
        const lineEl = document.createElement("div");
        lineEl.className = "lite-terminal-line";
        this.lineElements.push(lineEl);
        this.outputElement.appendChild(lineEl);
      }
    }

    this.dirtyLines.add(this.currentLine);

    if (this.lines.length > MAX_SCROLLBACK_LINES) {
      const trimCount = this.lines.length - MAX_SCROLLBACK_LINES;
      this.lines.splice(0, trimCount);
      this.currentLine -= trimCount;
      for (let i = 0; i < trimCount; i++) {
        const el = this.lineElements.shift();
        el?.remove();
      }
    }
  }

  /**
   * Handle cursor movement commands
   */
  private handleCursor(cursor: {
    action: "left" | "right" | "home";
    count?: number;
  }): void {
    const count = cursor.count || 1;

    switch (cursor.action) {
      case "left":
        this.currentCol = Math.max(0, this.currentCol - count);
        break;

      case "right":
        this.currentCol += count;
        break;

      case "home":
        this.currentCol = 0;
        break;
    }
  }

  /**
   * Handle clear commands
   */
  private handleClear(type: "line" | "screen" | "scrollback"): void {
    switch (type) {
      case "line": {
        const line = this.lines[this.currentLine];
        let pos = 0;
        let segmentIndex = 0;

        while (segmentIndex < line.length && pos < this.currentCol) {
          const segLen = line[segmentIndex].text.length;
          if (pos + segLen > this.currentCol) {
            line[segmentIndex].text = line[segmentIndex].text.slice(
              0,
              this.currentCol - pos
            );
            segmentIndex++;
            break;
          }
          pos += segLen;
          segmentIndex++;
        }
        line.splice(segmentIndex);
        this.dirtyLines.add(this.currentLine);
        break;
      }

      case "screen":
      case "scrollback":
        this.lines = [[]];
        this.currentLine = 0;
        this.currentCol = 0;
        this.lineElements = [];
        this.dirtyLines.clear();
        this.lastCursorLine = -1;
        break;
    }
  }

  /**
   * Compare two styles for equality
   */
  private stylesEqual(a: TextStyle, b: TextStyle): boolean {
    return (
      a.bold === b.bold &&
      a.dim === b.dim &&
      a.italic === b.italic &&
      a.underline === b.underline &&
      a.color === b.color &&
      a.link === b.link
    );
  }

  /**
   * Render the terminal content to DOM with inline cursor
   */
  private render(forceFullRender = false): void {
    if (!this.outputElement || !this.cursorElement) return;

    if (forceFullRender || this.lineElements.length === 0 ||
        this.lines.length !== this.lineElements.length) {
      this.fullRender();
      return;
    }

    const cursorMoved = this.lastCursorLine !== this.currentLine;

    if (cursorMoved && this.lastCursorLine >= 0 && this.lastCursorLine < this.lines.length) {
      this.dirtyLines.add(this.lastCursorLine);
    }
    this.dirtyLines.add(this.currentLine);

    for (const lineIndex of this.dirtyLines) {
      if (lineIndex < this.lines.length && lineIndex < this.lineElements.length) {
        this.renderLine(lineIndex);
      }
    }

    this.dirtyLines.clear();
    this.lastCursorLine = this.currentLine;

    this.updateCursorSize();
  }

  /**
   * Full re-render of all content
   */
  private fullRender(): void {
    if (!this.outputElement || !this.cursorElement) return;

    this.outputElement.innerHTML = "";
    this.lineElements = [];

    for (let lineIndex = 0; lineIndex < this.lines.length; lineIndex++) {
      const lineEl = document.createElement("div");
      lineEl.className = "lite-terminal-line";
      this.lineElements.push(lineEl);
      this.outputElement.appendChild(lineEl);
      this.renderLineContent(lineIndex, lineEl);
    }

    this.dirtyLines.clear();
    this.lastCursorLine = this.currentLine;
    this.updateCursorSize();
  }

  /**
   * Re-render a single line
   */
  private renderLine(lineIndex: number): void {
    const lineEl = this.lineElements[lineIndex];
    if (!lineEl) return;
    this.renderLineContent(lineIndex, lineEl);
  }

  /**
   * Render the content of a single line into a line element
   */
  private renderLineContent(lineIndex: number, lineEl: HTMLElement): void {
    if (!this.cursorElement) return;

    lineEl.innerHTML = "";
    const line = this.lines[lineIndex];
    const isCursorLine = lineIndex === this.currentLine;

    if (!isCursorLine) {
      for (const segment of line) {
        if (segment.text) {
          lineEl.appendChild(this.createStyledSpan(segment.text, segment.style));
        }
      }
      if (line.length === 0 || line.every(s => !s.text)) {
        lineEl.appendChild(document.createTextNode("​"));
      }
      return;
    }

    let charPos = 0;
    let cursorInserted = false;

    for (const segment of line) {
      if (!segment.text) continue;

      const segStart = charPos;
      const segEnd = charPos + segment.text.length;

      if (!cursorInserted && this.currentCol >= segStart && this.currentCol < segEnd) {
        const offsetInSegment = this.currentCol - segStart;
        const beforeCursor = segment.text.slice(0, offsetInSegment);
        const afterCursor = segment.text.slice(offsetInSegment);

        if (beforeCursor) {
          lineEl.appendChild(this.createStyledSpan(beforeCursor, segment.style));
        }
        lineEl.appendChild(this.cursorElement);
        cursorInserted = true;
        if (afterCursor) {
          lineEl.appendChild(this.createStyledSpan(afterCursor, segment.style));
        }
      } else {
        lineEl.appendChild(this.createStyledSpan(segment.text, segment.style));
      }

      charPos += segment.text.length;
    }

    if (!cursorInserted) {
      lineEl.appendChild(this.cursorElement);
    }
  }

  // URL detection regex for plain URLs
  private static readonly URL_REGEX = /(https?:\/\/[^\s)<>]+)/g;

  /**
   * Create a styled element
   */
  private createStyledSpan(text: string, style: TextStyle): HTMLSpanElement | HTMLAnchorElement | Text | DocumentFragment {
    const classes = this.getStyleClasses(style);
    const inlineStyle = this.getInlineStyle(style);

    if (style.link && isSafeLinkUrl(style.link)) {
      const link = document.createElement("a");
      link.href = style.link;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = text;
      if (classes) link.className = classes;
      if (inlineStyle) link.style.cssText = inlineStyle;
      link.style.cursor = "pointer";
      return link;
    }

    const urlMatch = text.match(LiteTerminal.URL_REGEX);
    if (urlMatch) {
      return this.createTextWithLinks(text, classes, inlineStyle);
    }

    if (!classes && !inlineStyle) {
      return document.createTextNode(text);
    }

    const span = document.createElement("span");
    if (classes) span.className = classes;
    if (inlineStyle) span.style.cssText = inlineStyle;
    span.textContent = text;
    return span;
  }

  /**
   * Create text content with clickable URL links
   */
  private createTextWithLinks(
    text: string,
    classes: string,
    inlineStyle: string
  ): DocumentFragment {
    const fragment = document.createDocumentFragment();
    let lastIndex = 0;

    LiteTerminal.URL_REGEX.lastIndex = 0;

    let match;
    while ((match = LiteTerminal.URL_REGEX.exec(text)) !== null) {
      if (match.index > lastIndex) {
        const beforeText = text.slice(lastIndex, match.index);
        fragment.appendChild(this.createStyledElement(beforeText, classes, inlineStyle));
      }

      const url = match[0];
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = url;
      if (classes) link.className = classes;
      if (inlineStyle) link.style.cssText = inlineStyle;
      link.style.cursor = "pointer";
      fragment.appendChild(link);

      lastIndex = match.index + url.length;
    }

    if (lastIndex < text.length) {
      const afterText = text.slice(lastIndex);
      fragment.appendChild(this.createStyledElement(afterText, classes, inlineStyle));
    }

    return fragment;
  }

  /**
   * Create a styled element (span or text node)
   */
  private createStyledElement(text: string, classes: string, inlineStyle: string): HTMLSpanElement | Text {
    if (!classes && !inlineStyle) {
      return document.createTextNode(text);
    }
    const span = document.createElement("span");
    if (classes) span.className = classes;
    if (inlineStyle) span.style.cssText = inlineStyle;
    span.textContent = text;
    return span;
  }

  /**
   * Update cursor size based on font metrics
   */
  private updateCursorSize(): void {
    if (!this.cursorElement || !this.outputElement) return;

    const charWidth = this.measureCharWidth();
    const computedStyle = getComputedStyle(this.outputElement);
    const lineHeight = parseFloat(computedStyle.lineHeight) ||
                       (this._options.fontSize! * (this._options.lineHeight || 1.2));

    this.cursorElement.style.width = `${charWidth}px`;
    this.cursorElement.style.height = `${lineHeight}px`;
  }

  // Allowlist of valid color class names
  private static readonly VALID_COLOR_CLASSES = new Set([
    "black", "red", "green", "yellow", "blue", "magenta", "cyan", "white",
    "brightBlack", "brightRed", "brightGreen", "brightYellow",
    "brightBlue", "brightMagenta", "brightCyan", "brightWhite",
  ]);

  /**
   * Get CSS classes for a text style
   */
  private getStyleClasses(style: TextStyle): string {
    const classes: string[] = [];

    if (style.bold) classes.push("bold");
    if (style.dim) classes.push("dim");
    if (style.italic) classes.push("italic");
    if (style.underline) classes.push("underline");

    if (style.color && LiteTerminal.VALID_COLOR_CLASSES.has(style.color)) {
      classes.push(style.color);
    }

    return classes.join(" ");
  }

  // Regex to validate rgb() color format
  private static readonly RGB_COLOR_REGEX = /^rgb\(\d{1,3},\d{1,3},\d{1,3}\)$/;

  /**
   * Get inline style for RGB colors
   */
  private getInlineStyle(style: TextStyle): string {
    if (style.color && LiteTerminal.RGB_COLOR_REGEX.test(style.color)) {
      return `color: ${style.color}`;
    }
    return "";
  }

  /**
   * Scroll to bottom of terminal
   */
  private scrollToBottom(): void {
    if (this.container) {
      this.container.scrollTop = this.container.scrollHeight;
    }
  }

  /**
   * Calculate terminal width in columns
   */
  private calculateCols(): void {
    if (!this.container || !this.outputElement) return;

    const charWidth = this.measureCharWidth();
    const containerPadding = 32;
    const availableWidth = (this.container.clientWidth || 800) - containerPadding;

    this._cols = Math.floor(availableWidth / charWidth) || 80;
  }

  /**
   * Measure character width for monospace font
   */
  private measureCharWidth(): number {
    if (!this.outputElement) return 8;

    const measureSpan = document.createElement("span");
    measureSpan.textContent = "M";
    measureSpan.style.visibility = "hidden";
    measureSpan.style.position = "absolute";
    this.outputElement.appendChild(measureSpan);

    const width = measureSpan.offsetWidth;
    this.outputElement.removeChild(measureSpan);

    return width || 8;
  }

  /**
   * Apply theme colors
   */
  private applyTheme(): void {
    if (!this.container) return;

    const theme = this._options.theme || Object.create(null);

    this.container.style.setProperty(
      "background-color",
      theme.background || "transparent"
    );
    this.container.style.setProperty("color", theme.foreground || "#e0e0e0");

    this.container.style.setProperty("--term-cyan", theme.cyan || "#0AC5B3");
    this.container.style.setProperty(
      "--term-brightCyan",
      theme.brightCyan || "#3DD9C8"
    );
    this.container.style.setProperty(
      "--term-brightBlack",
      theme.brightBlack || "#666"
    );

    if (this.cursorElement) {
      this.cursorElement.style.backgroundColor = theme.cursor || "#fff";
    }
  }
}
