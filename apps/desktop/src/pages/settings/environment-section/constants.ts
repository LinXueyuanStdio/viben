import type React from "react";
import { Code, Terminal, Play, Bot, Zap, Sparkles } from "lucide-react";
import { GithubIcon as Github } from "@/components/ui/icons";

export interface CliToolConfig {
  key: string;
  icon: React.ElementType;
  category: "core" | "ai-assistant";
  installHint?: string;
}

export const CLI_TOOLS: CliToolConfig[] = [
  // Core tools
  { key: "python", icon: Code, category: "core" },
  { key: "git", icon: Code, category: "core" },
  { key: "gh", icon: Github, category: "core", installHint: "brew install gh" },
  // AI Assistants
  { key: "claude", icon: Sparkles, category: "ai-assistant", installHint: "npm install -g @anthropic-ai/claude-code" },
  { key: "codex", icon: Zap, category: "ai-assistant", installHint: "npm install -g @openai/codex" },
  { key: "aider", icon: Bot, category: "ai-assistant", installHint: "pip install aider-chat" },
  { key: "goose", icon: Bot, category: "ai-assistant", installHint: "pip install goose-ai" },
  { key: "cline", icon: Terminal, category: "ai-assistant", installHint: "npm install -g cline" },
  { key: "continue", icon: Play, category: "ai-assistant" },
  { key: "cursor", icon: Terminal, category: "ai-assistant" },
];
