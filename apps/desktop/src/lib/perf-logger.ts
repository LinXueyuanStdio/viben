/**
 * Performance Logger
 *
 * Writes timestamped performance logs to a file for analyzing
 * latency in the ChatPopup → Gateway → Claude SDK → ChatCapsule pipeline.
 *
 * Logs are written to: ~/viben-perf.log
 */

import { writeTextFile, BaseDirectory } from "@tauri-apps/plugin-fs";

const LOG_FILE = "viben-perf.log";
let sessionStart: number = 0;
let lastMark: number = 0;

interface PerfEntry {
  ts: string; // ISO timestamp
  elapsed: number; // ms since session start
  delta: number; // ms since last mark
  stage: string;
  detail?: string;
}

const buffer: string[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

async function flushBuffer() {
  if (buffer.length === 0) return;
  const lines = buffer.splice(0, buffer.length).join("\n") + "\n";
  try {
    // Append to file in home directory
    await writeTextFile(LOG_FILE, lines, { baseDir: BaseDirectory.Home, append: true });
  } catch (e) {
    // fallback: write to console
    console.warn("[PerfLog] Failed to write to file, dumping to console:", e);
    console.log(lines);
  }
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushBuffer();
  }, 100); // flush every 100ms max
}

/**
 * Start a new perf session (call when user sends a message)
 */
export function perfStart(label: string) {
  sessionStart = performance.now();
  lastMark = sessionStart;
  const entry: PerfEntry = {
    ts: new Date().toISOString(),
    elapsed: 0,
    delta: 0,
    stage: "START",
    detail: label,
  };
  buffer.push(`\n${"=".repeat(80)}`);
  buffer.push(formatEntry(entry));
  scheduleFlush();
}

/**
 * Record a timing mark
 */
export function perfMark(stage: string, detail?: string) {
  const now = performance.now();
  const elapsed = now - sessionStart;
  const delta = now - lastMark;
  lastMark = now;
  const entry: PerfEntry = {
    ts: new Date().toISOString(),
    elapsed: Math.round(elapsed),
    delta: Math.round(delta),
    stage,
    detail,
  };
  buffer.push(formatEntry(entry));
  scheduleFlush();
}

/**
 * Record end of session
 */
export function perfEnd(detail?: string) {
  const now = performance.now();
  const elapsed = now - sessionStart;
  const delta = now - lastMark;
  lastMark = now;
  const entry: PerfEntry = {
    ts: new Date().toISOString(),
    elapsed: Math.round(elapsed),
    delta: Math.round(delta),
    stage: "END",
    detail,
  };
  buffer.push(formatEntry(entry));
  buffer.push(`${"=".repeat(80)}\n`);
  // Flush immediately on end
  flushBuffer();
}

function formatEntry(e: PerfEntry): string {
  const elapsedStr = `+${e.elapsed}ms`.padStart(10);
  const deltaStr = `Δ${e.delta}ms`.padStart(10);
  return `[${e.ts}] ${elapsedStr} ${deltaStr}  ${e.stage}${e.detail ? ` | ${e.detail}` : ""}`;
}
