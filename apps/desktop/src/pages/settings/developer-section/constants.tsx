import type React from "react";
import {
  Code,
  Zap,
  FileText,
  Boxes,
  Wrench,
  Terminal,
  Rocket,
  Cat,
  SquareTerminal,
  Apple,
} from "lucide-react";
import Cursor from "@lobehub/icons/es/Cursor";
import Windsurf from "@lobehub/icons/es/Windsurf";
import i18n from "@/i18n";

// IDE icon renderer - returns icon component for given IDE key
export function getIDEIcon(id: string): React.ReactNode {
  switch (id) {
    case "vscode":
      return <Code className="h-3.5 w-3.5 text-[#007ACC]" />;
    case "cursor":
      return <Cursor size={14} />;
    case "zed":
      return <Zap className="h-3.5 w-3.5 text-[#084CCF]" />;
    case "windsurf":
      return <Windsurf size={14} />;
    case "sublime":
      return <FileText className="h-3.5 w-3.5 text-[#FF9800]" />;
    case "vim":
      return <span className="text-[11px] font-bold text-[#019833]">Vi</span>;
    case "neovim":
      return <span className="text-[11px] font-bold text-[#57A143]">Nv</span>;
    case "emacs":
      return <span className="text-[11px] font-bold text-[#7F5AB6]">Em</span>;
    case "intellij":
      return <Boxes className="h-3.5 w-3.5 text-[#FE315D]" />;
    case "webstorm":
      return <Boxes className="h-3.5 w-3.5 text-[#07C3F2]" />;
    case "pycharm":
      return <Boxes className="h-3.5 w-3.5 text-[#21D789]" />;
    case "xcode":
      return <Wrench className="h-3.5 w-3.5 text-[#147EFB]" />;
    case "custom":
      return <Code className="h-3.5 w-3.5 text-muted-foreground" />;
    default:
      return <Code className="h-3.5 w-3.5" />;
  }
}

export const IDE_OPTIONS: Record<string, { name: string }> = {
  vscode: { name: "Visual Studio Code" },
  cursor: { name: "Cursor" },
  zed: { name: "Zed" },
  windsurf: { name: "Windsurf" },
  sublime: { name: "Sublime Text" },
  vim: { name: "Vim" },
  neovim: { name: "Neovim" },
  emacs: { name: "Emacs" },
  intellij: { name: "IntelliJ IDEA" },
  webstorm: { name: "WebStorm" },
  pycharm: { name: "PyCharm" },
  xcode: { name: "Xcode" },
  custom: { get name() { return i18n.t("settings.developer.customOption", "Custom..."); } },
};

// Terminal icon renderer - returns icon component for given terminal key
export function getTerminalIcon(id: string): React.ReactNode {
  switch (id) {
    case "system":
      return <Terminal className="h-3.5 w-3.5" />;
    case "iterm2":
      return <span className="text-[11px] font-bold text-[#000000] dark:text-white">iT</span>;
    case "warp":
      return <Rocket className="h-3.5 w-3.5 text-[#01A4FF]" />;
    case "alacritty":
      return <SquareTerminal className="h-3.5 w-3.5 text-[#F46D01]" />;
    case "kitty":
      return <Cat className="h-3.5 w-3.5 text-muted-foreground" />;
    case "hyper":
      return <span className="text-[11px] font-bold">H_</span>;
    case "ghostty":
      return <span className="text-[11px]">👻</span>;
    case "wezterm":
      return <span className="text-[11px] font-bold text-[#4E49EE]">Wz</span>;
    case "terminal":
      return <Apple className="h-3.5 w-3.5" />;
    case "custom":
      return <Terminal className="h-3.5 w-3.5 text-muted-foreground" />;
    default:
      return <Terminal className="h-3.5 w-3.5" />;
  }
}

export const TERMINAL_OPTIONS: Record<string, { name: string }> = {
  system: { get name() { return i18n.t("settings.developer.systemTerminal", "System Terminal"); } },
  iterm2: { name: "iTerm2" },
  warp: { name: "Warp" },
  alacritty: { name: "Alacritty" },
  kitty: { name: "Kitty" },
  hyper: { name: "Hyper" },
  ghostty: { name: "Ghostty" },
  wezterm: { name: "WezTerm" },
  terminal: { name: "Terminal.app" },
  custom: { get name() { return i18n.t("settings.developer.customOption", "Custom..."); } },
};

export interface DebugInfo {
  os: string;
  osVersion: string;
  arch: string;
  appVersion: string;
  gatewayVersion?: string;
  pythonVersion?: string;
  logsPath: string;
  configPath: string;
}
