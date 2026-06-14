"use client";

import { useEffect, useRef, useCallback } from "react";
import { Bash, defineCommand } from "just-bash";
import type { Command } from "just-bash";
import { LiteTerminal } from "./lite-terminal";
import { executeGUIAction } from "@/lib/action-system";
import type { ExecutionContext } from "@/lib/action-system";
import type { ClientToolResult } from "@/lib/client-side-tool/types";

const HISTORY_KEY = "viben-console-history";
const MAX_HISTORY = 100;

function getTheme(isDark: boolean) {
  return {
    background: "transparent",
    foreground: isDark ? "#e0e0e0" : "#1a1a1a",
    cursor: isDark ? "#fff" : "#000",
    cyan: isDark ? "#0AC5B3" : "#089485",
    brightCyan: isDark ? "#3DD9C8" : "#067A6D",
    brightBlack: isDark ? "#666" : "#525252",
  };
}

// Find the start of the previous word
function findPrevWordBoundary(str: string, pos: number): number {
  if (pos <= 0) return 0;
  let i = pos - 1;
  while (i > 0 && str[i] === " ") i--;
  while (i > 0 && str[i - 1] !== " ") i--;
  return i;
}

// Find the end of the next word
function findNextWordBoundary(str: string, pos: number): number {
  const len = str.length;
  if (pos >= len) return len;
  let i = pos;
  while (i < len && str[i] === " ") i++;
  while (i < len && str[i] !== " ") i++;
  return i;
}

// Tab completion context
function getCompletionContext(cmd: string, cursorPos: number): { prefix: string; wordStart: number } {
  let wordStart = cursorPos;
  while (wordStart > 0 && cmd[wordStart - 1] !== " ") {
    wordStart--;
  }
  return {
    prefix: cmd.slice(wordStart, cursorPos),
    wordStart,
  };
}

function showWelcome(term: { write: (data: string) => void; writeln: (data: string) => void; cols: number }) {
  term.writeln("");
  term.writeln("\x1b[1mViben Console\x1b[0m");
  term.writeln("\x1b[2m=============\x1b[0m");
  term.writeln("");
  term.writeln("\x1b[2mA sandboxed bash environment with GUI action support.\x1b[0m");
  term.writeln("");
  term.writeln("\x1b[2mTry:\x1b[0m \x1b[36mls\x1b[0m, \x1b[36mecho hello\x1b[0m, \x1b[36mgui --help\x1b[0m, \x1b[36mgui list_actions\x1b[0m");
  term.writeln("");
  term.write("$ ");
}

/**
 * Create a no-approval execution context for console use.
 * read_window and other actions don't require user approval in interactive console.
 */
function createConsoleExecutionContext(): ExecutionContext {
  return {
    sessionId: "console",
    toolUseId: `console-${Date.now()}`,
    requireApproval: async () => true, // Auto-approve in console
  };
}

/**
 * Create a GUI command for the console bash with flattened action interface.
 * Usage: gui <action> [--json '{"key":"value"}'] [--help]
 *
 * Action naming:
 * - Builtins (unprefixed): list_actions, get_action_detail
 * - Desktop builtins: read_window, navigate_to (also available as desktop_main.*)
 * - Provider actions: namespace.action_name (e.g., desktop_main.navigate_to, presentation.spotlight)
 */
function createGUICommand(): Command {
  return defineCommand("gui", async (args) => {
    const actionName = args[0];

    // Show help if no action or --help flag
    if (!actionName || actionName === "--help") {
      return {
        stdout: [
          "gui - execute desktop GUI actions",
          "",
          "Usage: gui <action> [options]",
          "",
          "Options:",
          "  --help              Show detailed schema for a specific action",
          "  --json '{...}'      Pass JSON payload to the action",
          "",
          "Global Actions:",
          "  list_actions        List all available actions",
          "  get_action_detail   Get schema for an action",
          "",
          "Desktop Actions (desktop_main.*):",
          "  desktop_main.read_window        Capture the current window",
          "  desktop_main.navigate_to        Navigate to an in-app route",
          "",
          "Provider actions use namespace.name format.",
          "",
          "Examples:",
          "  gui list_actions",
          "  gui desktop_main.read_window",
          "  gui desktop_main.navigate_to --help",
          "  gui desktop_main.navigate_to --json '{\"url\":\"/settings\"}'",
          "",
        ].join("\n"),
        stderr: "",
        exitCode: 0,
      };
    }

    // Check for --help flag to get action detail
    if (args.includes("--help")) {
      try {
        const ctx = createConsoleExecutionContext();
        const result = await executeGUIAction({ action: "get_action_detail", payload: { action: actionName } }, ctx);
        if (result.isError) {
          return {
            stdout: "",
            stderr: `${resultToText(result)}\n`,
            exitCode: 1,
          };
        }
        return {
          stdout: `${JSON.stringify(resultToExecutorValue(result), null, 2)}\n`,
          stderr: "",
          exitCode: 0,
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          stdout: "",
          stderr: `gui ${actionName} --help: ${msg}\n`,
          exitCode: 1,
        };
      }
    }

    // Parse --json payload if present
    let payload: unknown = undefined;
    const jsonIndex = args.indexOf("--json");
    if (jsonIndex !== -1 && jsonIndex + 1 < args.length) {
      try {
        payload = JSON.parse(args[jsonIndex + 1]);
      } catch (err) {
        return {
          stdout: "",
          stderr: `gui: invalid JSON payload: ${err instanceof Error ? err.message : String(err)}\n`,
          exitCode: 1,
        };
      }
    }

    // Execute the action
    try {
      const ctx = createConsoleExecutionContext();
      const result = await executeGUIAction({ action: actionName, payload }, ctx);

      if (result.isError) {
        return {
          stdout: "",
          stderr: `${resultToText(result) || "Action failed"}\n`,
          exitCode: 1,
        };
      }

      // Handle image results (e.g., read_window)
      const hasImage = result.content.some((c) => c.type === "image");
      if (hasImage) {
        const textParts = result.content
          .map((c) => {
            if (c.type === "image") {
              return `[Image: ${c.mimeType}, ${Math.round((c.data?.length || 0) / 1024)}KB base64]`;
            }
            return c.type === "text" ? c.text : "";
          })
          .filter(Boolean);
        return {
          stdout: `${textParts.join("\n")}\n`,
          stderr: "",
          exitCode: 0,
        };
      }

      return {
        stdout: `${JSON.stringify(resultToExecutorValue(result), null, 2)}\n`,
        stderr: "",
        exitCode: 0,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        stdout: "",
        stderr: `gui ${actionName}: ${msg}\n`,
        exitCode: 1,
      };
    }
  });
}

function resultToExecutorValue(result: ClientToolResult): unknown {
  if (result.structuredContent) return result.structuredContent;
  if (result.content.length === 1 && result.content[0].type === "text") {
    const text = result.content[0].text;
    try {
      return JSON.parse(text);
    } catch {
      return { text };
    }
  }
  return {
    content: result.content,
  };
}

function resultToText(result: ClientToolResult): string {
  return result.content.map((item) => item.type === "text" ? item.text : `[${item.mimeType} image]`).join("\n");
}

function createInputHandler(
  term: {
    write: (data: string) => void;
    writeln: (data: string) => void;
    clear: () => void;
    onData: (callback: (data: string) => void) => void;
  },
  bash: Bash
) {
  const history: string[] = JSON.parse(
    sessionStorage.getItem(HISTORY_KEY) || "[]"
  );
  let cmd = "";
  let cursorPos = 0;
  let historyIndex = history.length;

  const commands = [
    "gui", // Custom GUI command
    "cat", "ls", "grep", "head", "tail", "wc", "sort", "uniq", "tr", "cut",
    "sed", "awk", "find", "xargs", "tee", "diff", "mkdir", "rmdir", "rm",
    "cp", "mv", "touch", "chmod", "ln", "basename", "dirname", "date",
    "sleep", "seq", "env", "which", "whoami", "hostname", "cd", "echo",
    "export", "false", "help", "history", "printf", "pwd", "set", "test",
    "true", "type", "unset", "clear",
  ];

  const redrawLine = () => {
    term.write("\r$ " + cmd + "\x1b[K");
    const moveBack = cmd.length - cursorPos;
    if (moveBack > 0) {
      term.write(`\x1b[${moveBack}D`);
    }
  };

  const setCmd = (newCmd: string, newCursorPos?: number) => {
    cmd = newCmd;
    cursorPos = newCursorPos ?? newCmd.length;
    redrawLine();
  };

  const handleTabCompletion = async () => {
    const { prefix, wordStart } = getCompletionContext(cmd, cursorPos);
    if (!prefix) return;

    const isFirstWord = cmd.slice(0, wordStart).trim() === "";

    let candidates: string[];
    if (isFirstWord) {
      candidates = commands;
    } else {
      const lsResult = await bash.exec("ls -1");
      candidates = lsResult.stdout
        .split("\n")
        .map((f) => f.trim())
        .filter((f) => f.length > 0);
    }

    const matches = candidates.filter((c) =>
      c.toLowerCase().startsWith(prefix.toLowerCase())
    );

    if (matches.length === 0) return;

    if (matches.length === 1) {
      const completion = matches[0];
      cmd = cmd.slice(0, wordStart) + completion + cmd.slice(cursorPos);
      cursorPos = wordStart + completion.length;
      redrawLine();
    } else {
      let commonPrefix = matches[0];
      for (const match of matches) {
        let i = 0;
        while (
          i < commonPrefix.length &&
          i < match.length &&
          commonPrefix[i].toLowerCase() === match[i].toLowerCase()
        ) {
          i++;
        }
        commonPrefix = commonPrefix.slice(0, i);
      }

      if (commonPrefix.length > prefix.length) {
        cmd = cmd.slice(0, wordStart) + commonPrefix + cmd.slice(cursorPos);
        cursorPos = wordStart + commonPrefix.length;
        redrawLine();
      } else {
        term.writeln("");
        term.writeln(matches.join("  "));
        term.write("$ " + cmd);
        const moveBack = cmd.length - cursorPos;
        if (moveBack > 0) {
          term.write(`\x1b[${moveBack}D`);
        }
      }
    }
  };

  const executeCommand = async (command: string) => {
    const trimmed = command.trim();
    if (!trimmed) return;

    history.push(trimmed);
    historyIndex = history.length;
    sessionStorage.setItem(
      HISTORY_KEY,
      JSON.stringify(history.slice(-MAX_HISTORY))
    );

    if (trimmed === "clear") {
      term.write("\x1b[2J\x1b[3J\x1b[H");
    } else {
      const result = await bash.exec(trimmed);
      if (result.stdout) term.write(result.stdout.replace(/\n/g, "\r\n"));
      if (result.stderr) term.write(result.stderr.replace(/\n/g, "\r\n"));
    }

    cmd = "";
    cursorPos = 0;
    term.write("$ ");
  };

  term.onData(async (e: string) => {
    if (e === "\r") {
      term.writeln("");
      await executeCommand(cmd);
      return;
    }

    if (e === "\t") {
      await handleTabCompletion();
      return;
    }

    if (e === "\x01") {
      cursorPos = 0;
      redrawLine();
      return;
    }

    if (e === "\x05") {
      cursorPos = cmd.length;
      redrawLine();
      return;
    }

    if (e === "\x15") {
      cmd = cmd.slice(cursorPos);
      cursorPos = 0;
      redrawLine();
      return;
    }

    if (e === "\x0b") {
      cmd = cmd.slice(0, cursorPos);
      redrawLine();
      return;
    }

    if (e === "\x17") {
      const newPos = findPrevWordBoundary(cmd, cursorPos);
      cmd = cmd.slice(0, newPos) + cmd.slice(cursorPos);
      cursorPos = newPos;
      redrawLine();
      return;
    }

    if (e === "\x0c") {
      term.write("\x1b[2J\x1b[3J\x1b[H$ " + cmd + "\x1b[K");
      const moveBack = cmd.length - cursorPos;
      if (moveBack > 0) {
        term.write(`\x1b[${moveBack}D`);
      }
      return;
    }

    if (e === "\x1b\x7f") {
      const newPos = findPrevWordBoundary(cmd, cursorPos);
      cmd = cmd.slice(0, newPos) + cmd.slice(cursorPos);
      cursorPos = newPos;
      redrawLine();
      return;
    }

    if (e === "\x1bd") {
      const newPos = findNextWordBoundary(cmd, cursorPos);
      cmd = cmd.slice(0, cursorPos) + cmd.slice(newPos);
      redrawLine();
      return;
    }

    if (e === "\x1b[A") {
      if (historyIndex > 0) {
        historyIndex--;
        setCmd(history[historyIndex]);
      }
      return;
    }

    if (e === "\x1b[B") {
      if (historyIndex < history.length - 1) {
        historyIndex++;
        setCmd(history[historyIndex]);
      } else if (historyIndex === history.length - 1) {
        historyIndex = history.length;
        setCmd("");
      }
      return;
    }

    if (e === "\x1b[D") {
      if (cursorPos > 0) {
        cursorPos--;
        term.write("\x1b[D");
      }
      return;
    }

    if (e === "\x1b[C") {
      if (cursorPos < cmd.length) {
        cursorPos++;
        term.write("\x1b[C");
      }
      return;
    }

    if (e === "\x1b[1;3D" || e === "\x1b[1;5D" || e === "\x1bb") {
      cursorPos = findPrevWordBoundary(cmd, cursorPos);
      redrawLine();
      return;
    }

    if (e === "\x1b[1;3C" || e === "\x1b[1;5C" || e === "\x1bf") {
      cursorPos = findNextWordBoundary(cmd, cursorPos);
      redrawLine();
      return;
    }

    if (e === "\x1b[H" || e === "\x1bOH" || e === "\x1b[1~") {
      cursorPos = 0;
      redrawLine();
      return;
    }

    if (e === "\x1b[F" || e === "\x1bOF" || e === "\x1b[4~") {
      cursorPos = cmd.length;
      redrawLine();
      return;
    }

    if (e === "\x7F" || e === "\b") {
      if (cursorPos > 0) {
        cmd = cmd.slice(0, cursorPos - 1) + cmd.slice(cursorPos);
        cursorPos--;
        redrawLine();
      }
      return;
    }

    if (e === "\x1b[3~") {
      if (cursorPos < cmd.length) {
        cmd = cmd.slice(0, cursorPos) + cmd.slice(cursorPos + 1);
        redrawLine();
      }
      return;
    }

    if (e === "\x03") {
      term.writeln("^C");
      cmd = "";
      cursorPos = 0;
      term.write("$ ");
      return;
    }

    if (e >= " " && e <= "~") {
      cmd = cmd.slice(0, cursorPos) + e + cmd.slice(cursorPos);
      cursorPos++;
      redrawLine();
      return;
    }
  });

  return { history };
}

interface ConsoleTerminalProps {
  className?: string;
}

export function ConsoleTerminal({ className }: ConsoleTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstance = useRef<LiteTerminal | null>(null);

  const initTerminal = useCallback(() => {
    const container = terminalRef.current;
    if (!container || terminalInstance.current) return;

    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches ||
                   document.documentElement.classList.contains("dark");

    const term = new LiteTerminal({
      cursorBlink: true,
      theme: getTheme(isDark),
    });
    term.open(container);
    terminalInstance.current = term;

    const files = {
      "/home/user/README.md": "# Viben Console\n\nA sandboxed bash environment with GUI action support.\n\nTry `gui --help` to see available GUI commands.\n",
      "/home/user/example.txt": "Hello, World!\n",
    };

    // Create bash with GUI command support
    const guiCommand = createGUICommand();
    const bash = new Bash({
      customCommands: [guiCommand],
      files,
      cwd: "/home/user",
    });

    createInputHandler(term, bash);

    requestAnimationFrame(() => {
      showWelcome(term);
    });

    const colorSchemeQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const onColorSchemeChange = (e: MediaQueryListEvent) => {
      term.options.theme = getTheme(e.matches);
    };
    colorSchemeQuery.addEventListener("change", onColorSchemeChange);

    term.focus();

    return () => {
      colorSchemeQuery.removeEventListener("change", onColorSchemeChange);
      term.dispose();
      terminalInstance.current = null;
    };
  }, []);

  useEffect(() => {
    const cleanup = initTerminal();
    return cleanup;
  }, [initTerminal]);

  return (
    <div
      ref={terminalRef}
      className={className}
      style={{
        padding: "16px",
        boxSizing: "border-box",
        height: "100%",
        overflow: "auto",
      }}
    />
  );
}
