import * as React from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";

export type AssistantPetState = "idle" | "waiting" | "review" | "waving" | "failed";
export type PetInteractionState = "idle" | "hover" | "drag-right" | "drag-left" | "drag-up" | "drag-down" | "waiting";

type PetStateMeta = {
  labelKey: string;
  defaultLabel: string;
  halo: string;
  eye: string;
  mouth: string;
  statusFill: string;
};

type PetStateTransitionKey = `initial-${AssistantPetState}` | `${AssistantPetState}-to-${AssistantPetState}`;

type PetTransition = {
  body: {
    scale?: number[];
    rotate?: number[];
    x?: number[];
    y?: number[];
  };
  status?: {
    scale?: number[];
    opacity?: number[];
  };
  duration: number;
};

const PET_STATE_META: Record<AssistantPetState, PetStateMeta> = {
  idle: {
    labelKey: "chat_app.pet.state.idle",
    defaultLabel: "Idle",
    halo: "oklch(0.78 0.13 188)",
    eye: "M27 42 Q31 39 35 42",
    mouth: "M31 55 Q40 59 49 55",
    statusFill: "oklch(0.78 0.13 188)",
  },
  waiting: {
    labelKey: "chat_app.pet.state.waiting",
    defaultLabel: "Waiting",
    halo: "oklch(0.82 0.16 82)",
    eye: "M27 41 H35",
    mouth: "M32 56 Q40 54 48 56",
    statusFill: "oklch(0.82 0.16 82)",
  },
  review: {
    labelKey: "chat_app.pet.state.review",
    defaultLabel: "Review",
    halo: "oklch(0.75 0.15 172)",
    eye: "M27 42 Q31 39 35 42",
    mouth: "M31 55 Q40 52 49 55",
    statusFill: "oklch(0.75 0.15 172)",
  },
  waving: {
    labelKey: "chat_app.pet.state.waving",
    defaultLabel: "Waving",
    halo: "oklch(0.78 0.15 132)",
    eye: "M27 41 Q31 44 35 41",
    mouth: "M31 54 Q40 61 49 54",
    statusFill: "oklch(0.78 0.15 132)",
  },
  failed: {
    labelKey: "chat_app.pet.state.failed",
    defaultLabel: "Failed",
    halo: "oklch(0.66 0.2 28)",
    eye: "M27 39 L35 45 M35 39 L27 45",
    mouth: "M31 58 Q40 53 49 58",
    statusFill: "oklch(0.66 0.2 28)",
  },
};

const PET_FLOAT_ANIMATION: Record<PetInteractionState, { y?: number[]; rotate?: number[]; x?: number[]; scale?: number[] }> = {
  idle: { y: [0, -1.5, 0] },
  hover: { rotate: [-2, 2, -2] },
  "drag-right": { x: [0, 2, 0] },
  "drag-left": { x: [0, -2, 0] },
  "drag-up": { y: [0, -5, 0] },
  "drag-down": { y: [0, 3, 0] },
  waiting: { y: [0, -3, 0], scale: [1, 1.02, 1] },
};

const DEFAULT_STATE_TRANSITION: PetTransition = {
  body: { scale: [0.96, 1.02, 1], y: [2, -1, 0] },
  status: { scale: [0.8, 1.18, 1], opacity: [0.65, 1, 1] },
  duration: 0.42,
};

const PET_STATE_TRANSITIONS: Partial<Record<`${AssistantPetState}-to-${AssistantPetState}`, PetTransition>> = {
  "idle-to-waiting": {
    body: { y: [0, -5, 0], scale: [1, 1.04, 1] },
    status: { scale: [0.75, 1.28, 1], opacity: [0.5, 1, 1] },
    duration: 0.5,
  },
  "waiting-to-idle": {
    body: { y: [-2, 1, 0], scale: [1.02, 0.98, 1] },
    status: { scale: [1.15, 0.9, 1], opacity: [1, 0.7, 1] },
    duration: 0.46,
  },
  "idle-to-review": {
    body: { rotate: [0, -3, 2, 0], scale: [1, 1.03, 1] },
    status: { scale: [0.82, 1.2, 1], opacity: [0.6, 1, 1] },
    duration: 0.48,
  },
  "review-to-idle": {
    body: { rotate: [0, 2, -1, 0], scale: [1.02, 0.98, 1] },
    status: { scale: [1.1, 0.86, 1], opacity: [1, 0.7, 1] },
    duration: 0.44,
  },
  "waiting-to-failed": {
    body: { x: [0, -3, 3, -1, 0], rotate: [0, -4, 4, 0], scale: [1, 1.03, 0.98, 1] },
    status: { scale: [1, 1.35, 1], opacity: [0.8, 1, 1] },
    duration: 0.58,
  },
  "failed-to-waving": {
    body: { y: [2, -4, 0], rotate: [0, 4, 0], scale: [0.96, 1.04, 1] },
    status: { scale: [0.8, 1.2, 1], opacity: [0.6, 1, 1] },
    duration: 0.52,
  },
};

export function getPetStateTransitionKey(previousState: AssistantPetState | undefined, nextState: AssistantPetState): PetStateTransitionKey {
  return previousState ? `${previousState}-to-${nextState}` : `initial-${nextState}`;
}

function usePreviousPetState(state: AssistantPetState) {
  const previousRef = React.useRef<AssistantPetState | undefined>(undefined);
  const previousState = previousRef.current;

  React.useEffect(() => {
    previousRef.current = state;
  }, [state]);

  return previousState;
}

function getStateTransition(key: PetStateTransitionKey): PetTransition {
  if (key.startsWith("initial-")) {
    return {
      body: { scale: [0.98, 1], y: [1, 0] },
      status: { scale: [0.9, 1], opacity: [0.75, 1] },
      duration: 0.28,
    };
  }
  return PET_STATE_TRANSITIONS[key as `${AssistantPetState}-to-${AssistantPetState}`] ?? DEFAULT_STATE_TRANSITION;
}

export function VibenPetAvatar({ state, interaction }: { state: AssistantPetState; interaction: PetInteractionState }) {
  const { t } = useTranslation();
  const previousState = usePreviousPetState(state);
  const stateTransitionKey = getPetStateTransitionKey(previousState, state);
  const stateTransition = getStateTransition(stateTransitionKey);
  const meta = PET_STATE_META[state];
  const stateLabel = t(meta.labelKey, meta.defaultLabel);
  const gradientId = React.useId().replace(/:/g, "");
  const warmGradientId = `${gradientId}-warm`;
  const bodyGradientId = `${gradientId}-body`;
  const glowId = `${gradientId}-glow`;
  const movement = PET_FLOAT_ANIMATION[interaction];
  const shouldLoop = interaction !== "idle" || state === "review" || state === "waiting";

  return (
    <svg
      viewBox="0 0 80 80"
      role="img"
      aria-label={t("chat_app.pet.aria_label", "Viben pet {{state}}", { state: stateLabel })}
      className="size-full"
      data-testid="viben-pet-avatar"
      data-state-transition={stateTransitionKey}
    >
      <defs>
        <linearGradient id={warmGradientId} x1="13" y1="13" x2="67" y2="67" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FDB813" />
          <stop offset="100%" stopColor="#38B2AC" />
        </linearGradient>
        <radialGradient id={bodyGradientId} cx="33%" cy="24%" r="68%">
          <stop offset="0%" stopColor="oklch(0.99 0.02 95)" />
          <stop offset="52%" stopColor="oklch(0.93 0.04 102)" />
          <stop offset="100%" stopColor="oklch(0.86 0.05 176)" />
        </radialGradient>
        <filter id={glowId} x="-24%" y="-24%" width="148%" height="148%">
          <feDropShadow dx="0" dy="7" stdDeviation="5" floodColor="#0f172a" floodOpacity="0.28" />
          <feDropShadow dx="0" dy="0" stdDeviation="2" floodColor="#38B2AC" floodOpacity="0.25" />
        </filter>
      </defs>
      <motion.g
        key={stateTransitionKey}
        filter={`url(#${glowId})`}
        initial={{ scale: stateTransition.body.scale?.[0] ?? 1, rotate: stateTransition.body.rotate?.[0] ?? 0, x: stateTransition.body.x?.[0] ?? 0, y: stateTransition.body.y?.[0] ?? 0 }}
        animate={stateTransition.body}
        transition={{ duration: stateTransition.duration, ease: "easeInOut" }}
        style={{ transformOrigin: "40px 43px" }}
      >
        <motion.g
          animate={movement}
          transition={{ duration: interaction === "waiting" ? 1.1 : 1.6, repeat: shouldLoop ? Infinity : 0, ease: "easeInOut" }}
          style={{ transformOrigin: "40px 43px" }}
        >
          <motion.path
            d="M18 31 L8 20 L24 24"
            fill="none"
            stroke="#FDB813"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
            animate={state === "waving" ? { rotate: [-7, 7, -7] } : undefined}
            transition={{ duration: 0.7, repeat: state === "waving" ? Infinity : 0 }}
            style={{ transformOrigin: "21px 28px" }}
          />
          <motion.path
            d="M62 31 L72 20 L56 24"
            fill="none"
            stroke="#38B2AC"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
            animate={state === "waving" ? { rotate: [7, -7, 7] } : undefined}
            transition={{ duration: 0.7, repeat: state === "waving" ? Infinity : 0 }}
            style={{ transformOrigin: "59px 28px" }}
          />
          <circle cx="40" cy="41" r="29" fill={`url(#${bodyGradientId})`} stroke={`url(#${warmGradientId})`} strokeWidth="3" />
          <path d="M28 25 L40 35 L52 25" fill="none" stroke={`url(#${warmGradientId})`} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity="0.95" />
          <path d="M31 33 L40 55 L49 33" fill="none" stroke="oklch(0.22 0.04 220)" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M21 36 L12 43 L21 50" fill="none" stroke="#FDB813" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity="0.96" />
          <path d="M59 36 L68 43 L59 50" fill="none" stroke="#38B2AC" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity="0.96" />
          <path d={meta.eye} stroke="oklch(0.19 0.03 230)" strokeWidth="3" strokeLinecap="round" fill="none" />
          <path d={meta.eye.replace(/27/g, "45").replace(/35/g, "53")} stroke="oklch(0.19 0.03 230)" strokeWidth="3" strokeLinecap="round" fill="none" />
          <motion.path
            d={meta.mouth}
            stroke="oklch(0.19 0.03 230)"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
            animate={state === "review" ? { d: ["M31 55 Q40 52 49 55", "M31 55 Q40 58 49 55", "M31 55 Q40 52 49 55"] } : undefined}
            transition={{ duration: 0.7, repeat: state === "review" ? Infinity : 0 }}
          />
          <motion.circle
            cx="61"
            cy="20"
            r="5"
            fill={meta.statusFill}
            stroke="oklch(0.99 0.01 95)"
            strokeWidth="2"
            initial={{ scale: stateTransition.status?.scale?.[0] ?? 1, opacity: stateTransition.status?.opacity?.[0] ?? 1 }}
            animate={state === "waiting" || state === "review"
              ? { scale: [0.85, 1.18, 0.85], opacity: [0.75, 1, 0.75] }
              : stateTransition.status}
            transition={{ duration: state === "waiting" || state === "review" ? 0.9 : stateTransition.duration, repeat: state === "waiting" || state === "review" ? Infinity : 0 }}
          />
          {state === "failed" && (
            <path d="M23 64 H57" stroke="oklch(0.66 0.2 28)" strokeWidth="4" strokeLinecap="round" opacity="0.75" />
          )}
        </motion.g>
      </motion.g>
    </svg>
  );
}
