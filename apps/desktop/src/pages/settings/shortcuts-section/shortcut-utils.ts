// Format shortcut string for display (convert to platform symbols with + separator)
export function formatShortcutForPlatform(shortcut: string, currentPlatform: string): string {
  if (!shortcut) return "";

  const isMac = currentPlatform === "macos";

  // Split by + and map each part to its symbol, then join with +
  const parts = shortcut.split("+").map((part) => {
    const key = part.trim().toLowerCase();
    if (isMac) {
      switch (key) {
        case "ctrl": return "\u2303";
        case "alt": case "option": return "\u2325";
        case "shift": return "\u21E7";
        case "cmd": case "meta": return "\u2318";
        case "enter": return "\u21B5";
        default: return part.trim().toUpperCase();
      }
    } else {
      // Windows/Linux
      switch (key) {
        case "cmd": case "meta": return "Ctrl";
        case "enter": return "Enter";
        default: return part.trim();
      }
    }
  });

  return parts.join("+");
}

// Parse keyboard event to shortcut string
export function keyEventToShortcutForPlatform(e: KeyboardEvent, currentPlatform: string): string {
  const parts: string[] = [];
  const isMac = currentPlatform === "macos";

  if (e.ctrlKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  if (e.metaKey) parts.push(isMac ? "Cmd" : "Meta");

  // Get the key, excluding modifier keys themselves
  const key = e.key;
  if (!["Control", "Alt", "Shift", "Meta"].includes(key)) {
    // Normalize key names
    if (key === " ") {
      parts.push("Space");
    } else if (key.length === 1) {
      parts.push(key.toUpperCase());
    } else {
      parts.push(key);
    }
  }

  return parts.join("+");
}
