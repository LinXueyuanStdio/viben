"use client";

import { useSessionState } from "@/app/context/session-state-context";

// -- Inline SVG Icons --

function StepBackIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 1.5L3 6l5 4.5V1.5z" />
    </svg>
  );
}

function StepForwardIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 1.5L9 6l-5 4.5V1.5z" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 1.5v9l7-4.5L3 1.5z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <rect x="2.5" y="1.5" width="2.5" height="9" rx="0.5" />
      <rect x="7" y="1.5" width="2.5" height="9" rx="0.5" />
    </svg>
  );
}

function LiveDot() {
  return (
    <span className="relative flex h-2 w-2">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gain opacity-75" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-gain" />
    </span>
  );
}

// -- Speed options --

const SPEED_OPTIONS = [1, 2, 4, 8] as const;

// -- Main Component --

export function PlayerBar() {
  const { mode, replay, setMode, state } = useSessionState();

  if (mode !== "replay") return null;

  const { isPlaying, speed, currentIndex, totalEvents, play, pause, step, stepBack, seek, setSpeed } = replay;

  return (
    <div className="flex h-10 items-center gap-3 border-t border-border bg-muted px-4 py-1.5">
      {/* Step Back */}
      <button
        onClick={stepBack}
        disabled={currentIndex <= 0}
        className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted-foreground/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        title="后退一步"
      >
        <StepBackIcon />
      </button>

      {/* Play / Pause */}
      <button
        onClick={isPlaying ? pause : play}
        className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted-foreground/20 transition-colors"
        title={isPlaying ? "暂停回放" : "开始回放"}
      >
        {isPlaying ? <PauseIcon /> : <PlayIcon />}
      </button>

      {/* Step Forward */}
      <button
        onClick={step}
        disabled={currentIndex >= totalEvents - 1}
        className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted-foreground/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        title="前进一步"
      >
        <StepForwardIcon />
      </button>

      {/* Progress Slider */}
      <input
        type="range"
        min={0}
        max={totalEvents - 1}
        value={currentIndex}
        onChange={(e) => seek(Number(e.target.value))}
        className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-border accent-cyan-600"
        title={`Event ${currentIndex + 1} / ${totalEvents}`}
      />

      {/* Event Count */}
      <span className="whitespace-nowrap text-xs text-muted-foreground">
        {currentIndex + 1} / {totalEvents}
      </span>

      {/* Current Cycle Info */}
      <span className="whitespace-nowrap text-xs text-muted-foreground/60">
        Cycle {state.current_cycle}
      </span>

      {/* Speed Selector */}
      <div className="flex items-center gap-0.5">
        {SPEED_OPTIONS.map((s) => (
          <button
            key={s}
            onClick={() => setSpeed(s)}
            className={`h-6 rounded px-1.5 text-xs transition-colors ${
              speed === s
                ? "bg-cyan-600 text-white"
                : "text-muted-foreground hover:bg-muted-foreground/20"
            }`}
            title={`${s}x 速度`}
          >
            {s}x
          </button>
        ))}
      </div>

      {/* Switch to Live */}
      <button
        onClick={() => setMode("live")}
        className="inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted-foreground/20 transition-colors"
        title="切回实时模式"
      >
        <LiveDot />
        <span>实时</span>
      </button>
    </div>
  );
}
