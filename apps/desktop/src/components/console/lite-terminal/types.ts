export interface ThemeConfig {
  background?: string;
  foreground?: string;
  cursor?: string;
  cyan?: string;
  brightCyan?: string;
  brightBlack?: string;
}

export interface LiteTerminalOptions {
  cursorBlink?: boolean;
  fontSize?: number;
  fontFamily?: string;
  lineHeight?: number;
  letterSpacing?: number;
  theme?: ThemeConfig;
}

export interface TextStyle {
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  link?: string;
}

export interface StyledSegment {
  text: string;
  style: TextStyle;
}

export type DataCallback = (data: string) => void;
