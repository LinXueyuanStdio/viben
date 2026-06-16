// ---------------------------------------------------------------------------
// Shared style injection for CSS-based hover/active states & animations
// (Injected once, scoped via class names, avoids per-component useState for hover)
// ---------------------------------------------------------------------------

export const PLAYBACK_SPEEDS = [0.25, 0.5, 1, 1.5, 2, 4] as const

export const DEFAULT_FPS = 30

let _stylesInjected = false
export function injectConsoleStyles() {
  if (_stylesInjected) return
  _stylesInjected = true
  const style = document.createElement("style")
  style.textContent = `
    .pbc-btn {
      transition: background 120ms ease, border-color 120ms ease, transform 80ms ease, box-shadow 120ms ease;
      outline: none;
    }
    .pbc-btn:hover { filter: brightness(1.25); }
    .pbc-btn:active { transform: scale(0.94); }
    .pbc-btn:focus-visible {
      box-shadow: 0 0 0 2px rgba(118,185,0,0.5);
    }
    .pbc-btn-primary:hover {
      background: rgba(118,185,0,0.38) !important;
      border-color: rgba(118,185,0,0.9) !important;
    }
    .pbc-btn-primary:active {
      background: rgba(118,185,0,0.5) !important;
    }
    .pbc-btn-ghost:hover {
      background: rgba(255,255,255,0.12) !important;
    }
    .pbc-btn-ghost:active {
      background: rgba(255,255,255,0.18) !important;
    }
    .pbc-seg:hover:not(.pbc-seg-active) {
      background: rgba(255,255,255,0.08) !important;
    }
    .pbc-seg-active {
      background: rgba(255,255,255,0.18) !important;
      color: #fff !important;
    }
    .pbc-seg:focus-visible {
      box-shadow: 0 0 0 2px rgba(118,185,0,0.5);
      outline: none;
    }
    @keyframes stepPopoverIn {
      from { opacity: 0; transform: translateX(-50%) translateY(4px) scale(0.96); }
      to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
    }
    @keyframes stepPopoverOut {
      from { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
      to { opacity: 0; transform: translateX(-50%) translateY(4px) scale(0.97); }
    }
    .pbc-timeline-item {
      transition: opacity 100ms ease, filter 100ms ease, box-shadow 150ms ease;
    }
    .pbc-timeline-item:hover {
      opacity: 1 !important;
      filter: brightness(1.35);
      z-index: 3;
    }
    .pbc-timeline-item:focus-visible {
      outline: 2px solid rgba(118,185,0,0.7);
      outline-offset: 1px;
    }
    @keyframes pbc-active-pulse {
      0%, 100% { box-shadow: 0 0 8px var(--pulse-color, rgba(118,185,0,0.4)), inset 0 1px 0 rgba(255,255,255,0.15); }
      50% { box-shadow: 0 0 14px var(--pulse-color, rgba(118,185,0,0.6)), 0 0 4px var(--pulse-color, rgba(118,185,0,0.3)), inset 0 1px 0 rgba(255,255,255,0.2); }
    }
    .pbc-timeline-item-active {
      animation: pbc-active-pulse 1.8s ease-in-out infinite;
    }
    .pbc-lane-row {
      transition: background 120ms ease;
    }
    .pbc-lane-row:hover {
      background: rgba(255,255,255,0.035) !important;
    }
    .pbc-cmd-card {
      transition: background 100ms ease;
    }
    .pbc-cmd-card:hover {
      background: rgba(255,255,255,0.04);
    }
    .pbc-collapse-anim {
      transition: max-height 300ms cubic-bezier(0.34, 1.56, 0.64, 1), padding 250ms cubic-bezier(0.4,0,0.2,1), opacity 200ms ease;
    }
    /* Custom range slider styling */
    .pbc-range {
      -webkit-appearance: none;
      appearance: none;
      width: 100%;
      height: 6px;
      border-radius: 3px;
      background: transparent;
      cursor: pointer;
      outline: none;
    }
    .pbc-range::-webkit-slider-runnable-track {
      height: 6px;
      border-radius: 3px;
      background: rgba(255,255,255,0.1);
    }
    .pbc-range::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #76B900;
      border: 2px solid #fff;
      margin-top: -4px;
      cursor: pointer;
      box-shadow: 0 0 8px rgba(118,185,0,0.5);
      transition: transform 100ms ease, box-shadow 100ms ease;
    }
    .pbc-range::-webkit-slider-thumb:hover {
      transform: scale(1.2);
      box-shadow: 0 0 14px rgba(118,185,0,0.7);
    }
    .pbc-range::-moz-range-track {
      height: 6px;
      border-radius: 3px;
      background: rgba(255,255,255,0.1);
      border: none;
    }
    .pbc-range::-moz-range-thumb {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #76B900;
      border: 2px solid #fff;
      cursor: pointer;
      box-shadow: 0 0 8px rgba(118,185,0,0.5);
    }
    .pbc-range:focus-visible::-webkit-slider-thumb {
      box-shadow: 0 0 0 3px rgba(118,185,0,0.4), 0 0 12px rgba(118,185,0,0.6);
    }
    .pbc-scrub-wrapper:hover .pbc-scrub-thumb {
      transform: translate(-50%, -50%) scale(1.3);
    }
    .pbc-kbd {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 18px;
      height: 18px;
      padding: 0 4px;
      border-radius: 4px;
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.12);
      font-size: 9px;
      font-weight: 700;
      color: rgba(255,255,255,0.5);
      font-family: SFMono-Regular, Consolas, monospace;
      line-height: 1;
    }
    /* Enhanced timeline playhead */
    .pbc-playhead-handle {
      cursor: ew-resize;
      transition: transform 80ms ease, filter 80ms ease;
    }
    .pbc-playhead-handle:hover {
      transform: scaleX(1.3);
      filter: brightness(1.3) drop-shadow(0 0 4px rgba(118,185,0,0.8));
    }
    .pbc-playhead-line {
      background: linear-gradient(180deg, #76B900, #9FE030, #76B900) !important;
      box-shadow: 0 0 12px rgba(118,185,0,0.7), 0 0 4px rgba(118,185,0,0.9), 0 0 24px rgba(118,185,0,0.3) !important;
    }
    /* Timeline track area custom scrollbar */
    .pbc-track-scroll::-webkit-scrollbar {
      width: 5px;
      height: 5px;
    }
    .pbc-track-scroll::-webkit-scrollbar-track {
      background: transparent;
    }
    .pbc-track-scroll::-webkit-scrollbar-thumb {
      background: rgba(255,255,255,0.12);
      border-radius: 3px;
    }
    .pbc-track-scroll::-webkit-scrollbar-thumb:hover {
      background: rgba(255,255,255,0.22);
    }
    .pbc-track-scroll {
      scrollbar-width: thin;
      scrollbar-color: rgba(255,255,255,0.12) transparent;
    }
    /* Minimap viewport drag */
    .pbc-minimap-viewport {
      cursor: grab;
      transition: border-color 100ms ease, background 100ms ease, box-shadow 100ms ease;
    }
    .pbc-minimap-viewport:hover {
      border-color: rgba(118,185,0,0.7) !important;
      background: rgba(118,185,0,0.1) !important;
      box-shadow: 0 0 6px rgba(118,185,0,0.2);
    }
    .pbc-minimap-viewport:active {
      cursor: grabbing;
      border-color: rgba(118,185,0,0.9) !important;
    }
    /* Minimap resize handles */
    .pbc-minimap-viewport::before,
    .pbc-minimap-viewport::after {
      content: '';
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      width: 3px;
      height: 8px;
      border-radius: 1.5px;
      background: rgba(118,185,0,0.5);
      opacity: 0;
      transition: opacity 100ms ease;
    }
    .pbc-minimap-viewport::before { left: 2px; }
    .pbc-minimap-viewport::after { right: 2px; }
    .pbc-minimap-viewport:hover::before,
    .pbc-minimap-viewport:hover::after {
      opacity: 1;
    }
    /* Timeline block label */
    .pbc-timeline-item .pbc-block-label {
      opacity: 0.85;
      transition: opacity 80ms ease;
    }
    .pbc-timeline-item:hover .pbc-block-label {
      opacity: 1;
    }
    /* Active block glow animation - enhanced */
    @keyframes pbc-block-glow {
      0%, 100% { box-shadow: 0 0 8px var(--glow-color, rgba(118,185,0,0.4)), inset 0 1px 0 rgba(255,255,255,0.15), inset 0 -1px 0 rgba(0,0,0,0.2); }
      50% { box-shadow: 0 0 18px var(--glow-color, rgba(118,185,0,0.7)), 0 0 6px var(--glow-color, rgba(118,185,0,0.4)), inset 0 1px 0 rgba(255,255,255,0.25), inset 0 -1px 0 rgba(0,0,0,0.2); }
    }
    .pbc-block-active-glow {
      animation: pbc-block-glow 2s ease-in-out infinite;
    }
    /* Playhead time badge */
    .pbc-playhead-time {
      position: absolute;
      top: -20px;
      left: 50%;
      transform: translateX(-50%);
      padding: 2px 6px;
      border-radius: 4px;
      background: rgba(118,185,0,0.95);
      font-size: 9px;
      font-weight: 700;
      color: #fff;
      font-variant-numeric: tabular-nums;
      font-family: SFMono-Regular, Consolas, monospace;
      white-space: nowrap;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
      pointer-events: none;
    }
    /* Playhead motion trail */
    @keyframes pbc-playhead-trail {
      0% { opacity: 0.4; }
      100% { opacity: 0; }
    }
    .pbc-playhead-trail {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 1px;
      pointer-events: none;
      animation: pbc-playhead-trail 400ms ease-out forwards;
    }
    /* Group collapse/expand */
    .pbc-group-header {
      cursor: pointer;
      user-select: none;
      transition: background 120ms ease;
    }
    .pbc-group-header:hover {
      background: rgba(255,255,255,0.05) !important;
    }
    .pbc-group-chevron {
      transition: transform 200ms cubic-bezier(0.4, 0, 0.2, 1);
      display: inline-flex;
      align-items: center;
    }
    .pbc-group-chevron-collapsed {
      transform: rotate(-90deg);
    }
    /* Item count badge animation */
    @keyframes pbc-badge-pop {
      0% { transform: scale(0.7); opacity: 0; }
      50% { transform: scale(1.15); }
      100% { transform: scale(1); opacity: 1; }
    }
    .pbc-badge-pop {
      animation: pbc-badge-pop 300ms cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    /* Zoom controls */
    .pbc-zoom-btn {
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 5px;
      background: rgba(255,255,255,0.04);
      color: rgba(255,255,255,0.6);
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      transition: background 100ms ease, border-color 100ms ease, color 100ms ease;
      padding: 0;
      line-height: 1;
    }
    .pbc-zoom-btn:hover {
      background: rgba(255,255,255,0.1);
      border-color: rgba(255,255,255,0.2);
      color: rgba(255,255,255,0.9);
    }
    .pbc-zoom-btn:active {
      background: rgba(255,255,255,0.15);
      transform: scale(0.93);
    }
    /* Time ruler enhanced */
    .pbc-time-ruler {
      position: relative;
      height: 28px;
      border-bottom: 1px solid rgba(255,255,255,0.06);
      background: linear-gradient(180deg, rgba(255,255,255,0.02), transparent);
    }
    .pbc-ruler-tick-major {
      position: absolute;
      bottom: 0;
      width: 1px;
      height: 10px;
      background: rgba(255,255,255,0.2);
    }
    .pbc-ruler-tick-minor {
      position: absolute;
      bottom: 0;
      width: 1px;
      height: 5px;
      background: rgba(255,255,255,0.08);
    }
    .pbc-ruler-label {
      position: absolute;
      top: 4px;
      transform: translateX(-50%);
      font-size: 9px;
      color: rgba(255,255,255,0.4);
      font-variant-numeric: tabular-nums;
      font-family: SFMono-Regular, Consolas, monospace;
      white-space: nowrap;
    }
    /* Density curve minimap */
    .pbc-density-curve {
      fill: none;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    /* Tooltip for block labels */
    .pbc-block-tooltip {
      position: absolute;
      bottom: calc(100% + 4px);
      left: 50%;
      transform: translateX(-50%);
      padding: 3px 7px;
      border-radius: 4px;
      background: rgba(10, 12, 28, 0.95);
      border: 1px solid rgba(255,255,255,0.1);
      font-size: 9px;
      font-weight: 600;
      color: rgba(255,255,255,0.9);
      white-space: nowrap;
      pointer-events: none;
      opacity: 0;
      transition: opacity 120ms ease;
      z-index: 10;
    }
    .pbc-timeline-item:hover .pbc-block-tooltip {
      opacity: 1;
    }
    /* Speed dropdown */
    .pbc-speed-menu {
      position: absolute;
      bottom: calc(100% + 4px);
      left: 50%;
      transform: translateX(-50%);
      padding: 4px;
      border-radius: 8px;
      background: rgba(10, 12, 28, 0.97);
      border: 1px solid rgba(255,255,255,0.12);
      box-shadow: 0 12px 40px rgba(0,0,0,0.5);
      backdrop-filter: blur(20px);
      z-index: 20;
      min-width: 64px;
    }
    .pbc-speed-option {
      display: block;
      width: 100%;
      padding: 5px 10px;
      border: none;
      border-radius: 5px;
      background: transparent;
      color: rgba(255,255,255,0.65);
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      text-align: center;
      font-variant-numeric: tabular-nums;
      font-family: SFMono-Regular, Consolas, monospace;
      transition: background 80ms ease;
    }
    .pbc-speed-option:hover {
      background: rgba(255,255,255,0.1);
    }
    .pbc-speed-option-active {
      color: #76B900 !important;
      background: rgba(118,185,0,0.12) !important;
    }
    /* Empty state clock animation */
    @keyframes pbc-clock-pulse {
      0%, 100% { opacity: 0.4; transform: scale(1); }
      50% { opacity: 0.6; transform: scale(1.08); }
    }
    .pbc-empty-clock {
      animation: pbc-clock-pulse 2.5s ease-in-out infinite;
    }
    @keyframes pbc-clock-hand {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .pbc-clock-hand-anim {
      transform-origin: 12px 12px;
      animation: pbc-clock-hand 3s linear infinite;
    }
    /* Command card enter/exit transition */
    @keyframes pbc-card-enter {
      from { opacity: 0; transform: translateY(-6px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .pbc-cmd-card-enter { animation: pbc-card-slide-in 250ms cubic-bezier(0.16,1,0.3,1) both; }
    @keyframes pbc-card-slide-in { from { opacity: 0; transform: translateX(12px); } to { opacity: 1; transform: translateX(0); } }
    @keyframes pbc-card-pulse-glow { 0%,100% { box-shadow: inset 0 0 0 rgba(118,185,0,0); } 50% { box-shadow: inset 0 0 8px rgba(118,185,0,0.15); } }
    .pbc-cmd-card-pulse { animation: pbc-card-slide-in 250ms cubic-bezier(0.16,1,0.3,1) both, pbc-card-pulse-glow 600ms ease-out 250ms; }
    @keyframes pbc-loop-pulse-anim { 0%,100% { box-shadow: 0 0 0 0 rgba(118,185,0,0); } 50% { box-shadow: 0 0 8px 2px rgba(118,185,0,0.3); } }
    .pbc-loop-pulse { animation: pbc-loop-pulse-anim 2s ease-in-out infinite; }
    @keyframes pbc-badge-dot-pulse { 0%,100% { opacity:0.7; transform:scale(1); } 50% { opacity:1; transform:scale(1.3); } }
    .pbc-badge-dot { animation: pbc-badge-dot-pulse 1.5s ease-in-out infinite; }
    @keyframes pbc-play-press-ring { 0% { box-shadow: 0 0 0 0 rgba(118,185,0,0.6); } 100% { box-shadow: 0 0 0 8px rgba(118,185,0,0); } }
    .pbc-play-btn:active { animation: pbc-play-press-ring 400ms ease-out !important; }
    .pbc-cmd-card:hover {
      background: rgba(255,255,255,0.06) !important;
    }
    /* JSON diff highlight */
    @keyframes pbc-diff-flash {
      0% { background: rgba(118,185,0,0.25); }
      100% { background: transparent; }
    }
    .pbc-diff-flash {
      animation: pbc-diff-flash 800ms ease-out;
    }
    /* Copy button feedback */
    @keyframes pbc-copy-check {
      0% { transform: scale(0.8); opacity: 0; }
      30% { transform: scale(1.1); opacity: 1; }
      100% { transform: scale(1); opacity: 1; }
    }
    .pbc-copy-check {
      animation: pbc-copy-check 300ms ease-out;
    }
    /* Time display glow */
    .pbc-time-glow {
      text-shadow: 0 0 12px rgba(118,185,0,0.4), 0 0 4px rgba(118,185,0,0.2);
    }
    /* Circular progress ring animation */
    .pbc-progress-ring {
      transition: stroke-dashoffset 120ms linear;
    }
    /* Speed dial visual */
    .pbc-speed-dial {
      transition: transform 200ms cubic-bezier(0.4,0,0.2,1);
    }
    /* Panel cross-fade */
    @keyframes pbc-panel-fadein {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .pbc-panel-fade {
      animation: pbc-panel-fadein 200ms ease-out;
    }
    /* Waiting countdown pulse */
    @keyframes pbc-waiting-pulse {
      0%, 100% { opacity: 0.5; }
      50% { opacity: 0.9; }
    }
    .pbc-waiting-pulse {
      animation: pbc-waiting-pulse 1.5s ease-in-out infinite;
    }
    /* Keyboard shortcut tooltip */
    .pbc-kbd-group {
      position: relative;
      display: inline-flex;
    }
    .pbc-kbd-group .pbc-kbd-tooltip {
      display: none;
      position: absolute;
      bottom: calc(100% + 6px);
      left: 50%;
      transform: translateX(-50%);
      padding: 4px 8px;
      border-radius: 5px;
      background: rgba(0,0,0,0.92);
      border: 1px solid rgba(255,255,255,0.15);
      color: rgba(255,255,255,0.75);
      font-size: 9px;
      white-space: nowrap;
      pointer-events: none;
      z-index: 30;
    }
    .pbc-kbd-group:hover .pbc-kbd-tooltip {
      display: block;
    }
    /* Waveform bar in progress background */
    .pbc-waveform-bar {
      display: inline-block;
      border-radius: 1px;
      background: rgba(118,185,0,0.25);
      min-width: 1px;
    }
  `
  document.head.appendChild(style)
}
