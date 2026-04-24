export interface ThemeColors {
  primary: string;
  primaryText: string;
  background: string;
  surface: string;
  surfaceHover: string;
  text: string;
  textSecondary: string;
  border: string;
  shadow: string;
  error: string;
  success: string;
  warning: string;
}

export interface ThemeFonts {
  body: string;
  mono: string;
  bodySize: number;
  titleSize: number;
  captionSize: number;
}

export interface ThemeSpacing {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
}

export interface ThemeRadii {
  sm: number;
  md: number;
  lg: number;
  xl: number;
  full: number;
}

export interface Theme {
  name: string;
  colors: ThemeColors;
  fonts: ThemeFonts;
  spacing: ThemeSpacing;
  radii: ThemeRadii;
}

export const darkTheme: Theme = {
  name: "dark",
  colors: {
    primary: "#007AFF",
    primaryText: "#FFFFFF",
    background: "#000000",
    surface: "#1C1C1E",
    surfaceHover: "#2C2C2E",
    text: "#FFFFFF",
    textSecondary: "#8E8E93",
    border: "#38383A",
    shadow: "rgba(0,0,0,0.5)",
    error: "#FF3B30",
    success: "#30D158",
    warning: "#FF9F0A",
  },
  fonts: {
    body: "",
    mono: "",
    bodySize: 17,
    titleSize: 28,
    captionSize: 12,
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  radii: { sm: 4, md: 8, lg: 16, xl: 24, full: 9999 },
};

export const lightTheme: Theme = {
  name: "light",
  colors: {
    primary: "#007AFF",
    primaryText: "#FFFFFF",
    background: "#F2F2F7",
    surface: "#FFFFFF",
    surfaceHover: "#E5E5EA",
    text: "#000000",
    textSecondary: "#8E8E93",
    border: "#C6C6C8",
    shadow: "rgba(0,0,0,0.15)",
    error: "#FF3B30",
    success: "#34C759",
    warning: "#FF9F0A",
  },
  fonts: {
    body: "",
    mono: "",
    bodySize: 17,
    titleSize: 28,
    captionSize: 12,
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  radii: { sm: 4, md: 8, lg: 16, xl: 24, full: 9999 },
};
