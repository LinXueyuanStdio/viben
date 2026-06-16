import type { StepCommandDef } from "./types"
import { num, numOpt, strOpt, json } from "./parse-utils"

export const effectsCommands: StepCommandDef[] = [
  {
    name: "confetti",
    description: "Particle burst celebration effect",
    category: "effects",
    defaultDurationMs: 4000,
    inputSchema: {
      type: "object",
      properties: {
        position: { type: "object", description: "Burst origin {x, y}" },
        count: { type: "number", description: "Number of particles, default 60" },
        spread: { type: "number", description: "Spread radius in px, default 250" },
        colors: { type: "array", description: "Array of color strings for particles" },
      },
    },
    parseArgs: (args) => ({
      type: "confetti",
      position: json(args.position, { x: 480, y: 300 }),
      count: numOpt(args.count) ?? 60,
      spread: numOpt(args.spread) ?? 250,
      colors: json(args.colors, ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7", "#DDA0DD"]),
    }),
  },
  {
    name: "countdown",
    description: "Large countdown number animation",
    category: "effects",
    defaultDurationMs: 5000,
    inputSchema: {
      type: "object",
      properties: {
        position: { type: "object", description: "Position {x, y}" },
        from: { type: "number", description: "Starting number to count down from, default 3" },
        fontSize: { type: "number", description: "Font size in px, default 120" },
        color: { type: "string", description: "Text color, default #fff" },
      },
    },
    parseArgs: (args) => ({
      type: "countdown",
      position: json(args.position, { x: 480, y: 300 }),
      from: num(args.from, 3),
      fontSize: numOpt(args.fontSize) ?? 120,
      color: strOpt(args.color) ?? "#fff",
    }),
  },
  {
    name: "reveal",
    description: "Mask wipe revealing underlying content",
    category: "effects",
    defaultDurationMs: 4000,
    inputSchema: {
      type: "object",
      properties: {
        region: { type: "object", description: "Region to reveal {x, y, width, height}" },
        direction: { type: "string", description: "Wipe direction: 'left', 'right', 'top', 'bottom', or 'center', default 'center'" },
        color: { type: "string", description: "Mask color, default #1a1a2e" },
      },
    },
    parseArgs: (args) => ({
      type: "reveal",
      region: json(args.region, { x: 200, y: 150, width: 560, height: 300 }),
      direction: (strOpt(args.direction) as "left" | "right" | "top" | "bottom" | "center") ?? "center",
      color: strOpt(args.color) ?? "#1a1a2e",
    }),
  },
  {
    name: "zoom",
    description: "Magnifying lens effect on a region",
    category: "effects",
    defaultDurationMs: 4000,
    inputSchema: {
      type: "object",
      properties: {
        region: { type: "object", description: "Region to magnify {x, y, width, height}" },
        scale: { type: "number", description: "Magnification scale factor, default 2.5" },
        borderColor: { type: "string", description: "Lens border color, default #6366F1" },
      },
    },
    parseArgs: (args) => ({
      type: "zoom",
      region: json(args.region, { x: 340, y: 220, width: 280, height: 180 }),
      scale: numOpt(args.scale) ?? 2.5,
      borderColor: strOpt(args.borderColor) ?? "#6366F1",
    }),
  },
  {
    name: "morph",
    description: "Number / shape morph transition animation",
    category: "effects",
    defaultDurationMs: 4000,
    inputSchema: {
      type: "object",
      properties: {
        position: { type: "object", description: "Position {x, y}" },
        from: { type: "number", description: "Starting number value, default 0" },
        to: { type: "number", description: "Ending number value, default 100" },
        color: { type: "string", description: "Text color, default #6366F1" },
        fontSize: { type: "number", description: "Font size in px, default 64" },
      },
    },
    parseArgs: (args) => ({
      type: "morph",
      position: json(args.position, { x: 420, y: 260 }),
      from: args.from !== undefined ? (typeof args.from === "number" ? args.from : Number(args.from) || 0) : 0,
      to: args.to !== undefined ? (typeof args.to === "number" ? args.to : Number(args.to) || 100) : 100,
      color: strOpt(args.color) ?? "#6366F1",
      fontSize: numOpt(args.fontSize) ?? 64,
    }),
  },
]
