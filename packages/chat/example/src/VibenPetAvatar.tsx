import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";

export type AssistantPetState = "idle" | "waiting" | "review" | "waving" | "failed";
export type PetInteractionState = "idle" | "hover" | "drag-right" | "drag-left" | "drag-up" | "drag-down" | "waiting";
export type VibenPetAvatarKind = "dynamic" | "static";
export type VibenPetAvatarProps = {
  kind?: VibenPetAvatarKind;
  state: AssistantPetState;
  interaction?: PetInteractionState;
};

type PetStateTransitionKey = `initial-${AssistantPetState}` | `${AssistantPetState}-to-${AssistantPetState}`;
type MotionValues = {
  x?: number | number[];
  y?: number | number[];
  rotate?: number | number[];
  scale?: number | number[];
  scaleX?: number | number[];
  scaleY?: number | number[];
  opacity?: number | number[];
};
type PetMotionPreset = {
  duration: number;
  loop: boolean;
  root?: MotionValues;
  torso?: MotionValues;
  leftHand?: MotionValues;
  rightHand?: MotionValues;
  leftFoot?: MotionValues;
  rightFoot?: MotionValues;
  face?: MotionValues;
  tail?: MotionValues;
  status?: MotionValues;
};
type PetPose = {
  root?: MotionValues;
  torso?: MotionValues;
  leftHand?: MotionValues;
  rightHand?: MotionValues;
  leftFoot?: MotionValues;
  rightFoot?: MotionValues;
  face?: MotionValues;
  tail?: MotionValues;
};
type PetStateMeta = {
  labelKey: string;
  defaultLabel: string;
  eye: string;
  mouth: string;
  statusFill: string;
};

const PET_STATE_META: Record<AssistantPetState, PetStateMeta> = {
  idle: {
    labelKey: "chat_app.pet.state.idle",
    defaultLabel: "Idle",
    eye: "M27 42 Q31 39 35 42",
    mouth: "M31 55 Q40 59 49 55",
    statusFill: "oklch(0.78 0.13 188)",
  },
  waiting: {
    labelKey: "chat_app.pet.state.waiting",
    defaultLabel: "Waiting",
    eye: "M27 41 H35",
    mouth: "M32 56 Q40 54 48 56",
    statusFill: "oklch(0.82 0.16 82)",
  },
  review: {
    labelKey: "chat_app.pet.state.review",
    defaultLabel: "Review",
    eye: "M27 41 Q31 38.5 35 41",
    mouth: "M31 55 Q40 52 49 55",
    statusFill: "oklch(0.75 0.15 172)",
  },
  waving: {
    labelKey: "chat_app.pet.state.waving",
    defaultLabel: "Waving",
    eye: "M27 41 Q31 44 35 41",
    mouth: "M31 54 Q40 61 49 54",
    statusFill: "oklch(0.78 0.15 132)",
  },
  failed: {
    labelKey: "chat_app.pet.state.failed",
    defaultLabel: "Failed",
    eye: "M27 39 L35 45 M35 39 L27 45",
    mouth: "M31 58 Q40 53 49 58",
    statusFill: "oklch(0.66 0.2 28)",
  },
};

const PET_POSES: Record<AssistantPetState, PetPose> = {
  idle: {
    leftHand: { rotate: -8 },
    rightHand: { rotate: 8 },
    tail: { rotate: 12 },
  },
  waiting: {
    root: { y: -1, rotate: -1 },
    leftHand: { rotate: 6, x: 1 },
    rightHand: { rotate: -6, x: -1 },
    leftFoot: { y: -1 },
    rightFoot: { y: -1 },
    tail: { rotate: -3 },
  },
  review: {
    root: { x: -0.5 },
    rightHand: { rotate: 8, y: -1 },
    leftHand: { rotate: 2 },
    rightFoot: { x: 1 },
    tail: { rotate: 2 },
  },
  waving: {
    root: { x: -1, rotate: -1 },
    rightHand: { rotate: 18, y: -3 },
    leftHand: { rotate: 4 },
    rightFoot: { y: -1.5 },
    tail: { rotate: 14 },
  },
  failed: {
    root: { y: 2, scale: 0.98 },
    leftHand: { rotate: -10, y: 2 },
    rightHand: { rotate: 10, y: 2 },
    leftFoot: { rotate: 6 },
    rightFoot: { rotate: -6 },
    tail: { rotate: -14, y: 2 },
  },
};

const PET_MOTION_PRESETS: Record<AssistantPetState, PetMotionPreset> = {
  idle: {
    duration: 2.8,
    loop: true,
    root: { y: [0, -1.5, 0] },
    torso: { scaleY: [1, 0.985, 1], scaleX: [1, 1.008, 1] },
    leftHand: { rotate: [0, -2, 0] },
    rightHand: { rotate: [0, 2, 0] },
    tail: { rotate: [0, 6, 0, -4, 0] },
  },
  waiting: {
    duration: 0.95,
    loop: true,
    root: { y: [0, -3, 0], scale: [1, 1.025, 1] },
    leftHand: { rotate: [4, -5, 4] },
    rightHand: { rotate: [-4, 5, -4] },
    leftFoot: { y: [0, -1, 0] },
    rightFoot: { y: [0, -1, 0] },
    tail: { rotate: [-3, 3, -3] },
    status: { scale: [0.9, 1.22, 0.9], opacity: [0.75, 1, 0.75] },
  },
  review: {
    duration: 1.2,
    loop: true,
    root: { rotate: [0, -1.5, 1, 0] },
    face: { x: [-0.8, 0.8, -0.8] },
    rightHand: { rotate: [-6, 8, -3, 0] },
    leftHand: { rotate: [2, -2, 2] },
    rightFoot: { x: [0, 1, 0] },
    tail: { rotate: [2, -2, 2] },
    status: { scale: [0.9, 1.08, 0.9], opacity: [0.8, 1, 0.8] },
  },
  waving: {
    duration: 0.6,
    loop: false,
    root: { x: [0, -1, 0], rotate: [0, -3, 0] },
    rightHand: { rotate: [-12, 18, -8, 14, 0] },
    leftHand: { rotate: [4, -3, 0] },
    rightFoot: { y: [0, -1.5, 0] },
    tail: { rotate: [0, -8, 6, 0] },
  },
  failed: {
    duration: 0.42,
    loop: false,
    root: { x: [0, -3, 3, -1, 0], y: [0, 2, 1.5], rotate: [0, -4, 4, 0] },
    leftHand: { rotate: [0, -10, -6] },
    rightHand: { rotate: [0, 10, 6] },
    tail: { rotate: [0, -18, -14] },
    status: { scale: [1, 1.35, 0.95, 1], opacity: [0.85, 1, 0.85] },
  },
};

export function getPetStateTransitionKey(previousState: AssistantPetState | undefined, nextState: AssistantPetState): PetStateTransitionKey {
  return previousState ? `${previousState}-to-${nextState}` : `initial-${nextState}`;
}

export function getPetMotionPreset(state: AssistantPetState): PetMotionPreset {
  return PET_MOTION_PRESETS[state];
}

function usePreviousPetState(state: AssistantPetState) {
  const previousRef = React.useRef<AssistantPetState | undefined>(undefined);
  const previousState = previousRef.current;

  React.useEffect(() => {
    previousRef.current = state;
  }, [state]);

  return previousState;
}

function getRightEyePath(path: string) {
  return path.replace(/27/g, "45").replace(/35/g, "53");
}

function getReducedMotionPreset(state: AssistantPetState): PetMotionPreset {
  return state === "failed"
    ? { duration: 0.22, loop: false, status: { scale: [1, 1.12, 1] } }
    : { duration: 0.2, loop: false, root: { scale: [0.98, 1], opacity: [0.9, 1] } };
}

function combineMotion(pose: MotionValues | undefined, motion: MotionValues | undefined, reducedMotion: boolean) {
  if (reducedMotion) return pose;
  return { ...pose, ...motion };
}

function getTransition(preset: PetMotionPreset, reducedMotion: boolean, delay = 0) {
  return {
    duration: reducedMotion ? Math.min(preset.duration, 0.24) : preset.duration,
    repeat: !reducedMotion && preset.loop ? Infinity : 0,
    ease: "easeInOut",
    delay,
  } as const;
}

function PetAvatarDefs({
  warmGradientId,
  bodyGradientId,
  glowId,
}: {
  warmGradientId: string;
  bodyGradientId: string;
  glowId: string;
}) {
  return (
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
  );
}

function PetArtwork({
  state,
  meta,
  pose,
  preset,
  reducedMotion,
  warmGradientId,
  bodyGradientId,
  glowId,
  dynamic,
}: {
  state: AssistantPetState;
  meta: PetStateMeta;
  pose: PetPose;
  preset: PetMotionPreset;
  reducedMotion: boolean;
  warmGradientId: string;
  bodyGradientId: string;
  glowId: string;
  dynamic: boolean;
}) {
  const rootMotion = dynamic ? combineMotion(pose.root, preset.root, reducedMotion) : pose.root;
  return (
    <motion.g
      data-testid="pet-root-layer"
      filter={`url(#${glowId})`}
      animate={rootMotion}
      transition={getTransition(preset, reducedMotion)}
      style={{ transformOrigin: "40px 43px" }}
    >
      <motion.g
        data-testid="pet-tail-layer"
        animate={dynamic ? combineMotion(pose.tail, preset.tail, reducedMotion) : pose.tail}
        transition={getTransition(preset, reducedMotion, 0.08)}
        style={{ transformOrigin: "58px 52px" }}
      >
        <path d="M60 51 Q72 52 70 41" fill="none" stroke="#38B2AC" strokeWidth="4" strokeLinecap="round" opacity="0.9" />
      </motion.g>

      <motion.g
        data-testid="pet-torso-layer"
        animate={dynamic ? combineMotion(pose.torso, preset.torso, reducedMotion) : pose.torso}
        transition={getTransition(preset, reducedMotion)}
        style={{ transformOrigin: "40px 45px" }}
      >
        <circle cx="40" cy="41" r="29" fill={`url(#${bodyGradientId})`} stroke={`url(#${warmGradientId})`} strokeWidth="3" />
        <path d="M28 25 L40 35 L52 25" fill="none" stroke={`url(#${warmGradientId})`} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity="0.95" />
        <path d="M31 33 L40 55 L49 33" fill="none" stroke="oklch(0.22 0.04 220)" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
      </motion.g>

      <motion.g
        data-testid="pet-left-hand-layer"
        animate={dynamic ? combineMotion(pose.leftHand, preset.leftHand, reducedMotion) : pose.leftHand}
        transition={getTransition(preset, reducedMotion)}
        style={{ transformOrigin: "22px 43px" }}
      >
        <path d="M21 36 L12 43 L21 50" fill="none" stroke="#FDB813" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity="0.96" />
      </motion.g>

      <motion.g
        data-testid="pet-right-hand-layer"
        animate={dynamic ? combineMotion(pose.rightHand, preset.rightHand, reducedMotion) : pose.rightHand}
        transition={getTransition(preset, reducedMotion)}
        style={{ transformOrigin: "58px 43px" }}
      >
        <path d="M59 36 L68 43 L59 50" fill="none" stroke="#38B2AC" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity="0.96" />
      </motion.g>

      <motion.g
        data-testid="pet-left-foot-layer"
        animate={dynamic ? combineMotion(pose.leftFoot, preset.leftFoot, reducedMotion) : pose.leftFoot}
        transition={getTransition(preset, reducedMotion)}
        style={{ transformOrigin: "31px 65px" }}
      >
        <path d="M30 66 Q34 68 38 66" fill="none" stroke="#FDB813" strokeWidth="3" strokeLinecap="round" />
      </motion.g>

      <motion.g
        data-testid="pet-right-foot-layer"
        animate={dynamic ? combineMotion(pose.rightFoot, preset.rightFoot, reducedMotion) : pose.rightFoot}
        transition={getTransition(preset, reducedMotion)}
        style={{ transformOrigin: "49px 65px" }}
      >
        <path d="M42 66 Q46 68 50 66" fill="none" stroke="#38B2AC" strokeWidth="3" strokeLinecap="round" />
      </motion.g>

      <motion.g
        data-testid="pet-face-layer"
        animate={dynamic ? combineMotion(pose.face, preset.face, reducedMotion) : pose.face}
        transition={getTransition(preset, reducedMotion)}
        style={{ transformOrigin: "40px 48px" }}
      >
        <path d={meta.eye} stroke="oklch(0.19 0.03 230)" strokeWidth="3" strokeLinecap="round" fill="none" />
        <path d={getRightEyePath(meta.eye)} stroke="oklch(0.19 0.03 230)" strokeWidth="3" strokeLinecap="round" fill="none" />
        <path d={meta.mouth} stroke="oklch(0.19 0.03 230)" strokeWidth="3" strokeLinecap="round" fill="none" />
      </motion.g>

      <motion.circle
        data-testid="pet-status-layer"
        cx="61"
        cy="20"
        r="5"
        fill={meta.statusFill}
        stroke="oklch(0.99 0.01 95)"
        strokeWidth="2"
        animate={dynamic ? preset.status : undefined}
        transition={getTransition(preset, reducedMotion)}
      />
      {state === "failed" && (
        <path d="M23 64 H57" stroke="oklch(0.66 0.2 28)" strokeWidth="4" strokeLinecap="round" opacity="0.75" />
      )}
    </motion.g>
  );
}

export function VibenPetAvatar({ kind = "dynamic", state, interaction = "idle" }: VibenPetAvatarProps) {
  const { t } = useTranslation();
  const previousState = usePreviousPetState(state);
  const stateTransitionKey = getPetStateTransitionKey(previousState, state);
  const reducedMotion = useReducedMotion() ?? false;
  const meta = PET_STATE_META[state];
  const stateLabel = t(meta.labelKey, meta.defaultLabel);
  const gradientId = React.useId().replace(/:/g, "");
  const warmGradientId = `${gradientId}-warm`;
  const bodyGradientId = `${gradientId}-body`;
  const glowId = `${gradientId}-glow`;
  const preset = reducedMotion ? getReducedMotionPreset(state) : getPetMotionPreset(state);
  const pose = PET_POSES[state];
  const ariaLabel = t("chat_app.pet.aria_label", "Viben pet {{state}}", { state: stateLabel });
  const isDynamic = kind === "dynamic";

  return (
    <svg
      viewBox="0 0 80 80"
      role="img"
      aria-label={ariaLabel}
      className="size-full"
      data-testid="viben-pet-avatar"
      data-avatar-kind={kind}
      data-interaction={interaction}
      data-state-transition={isDynamic ? stateTransitionKey : undefined}
    >
      <PetAvatarDefs warmGradientId={warmGradientId} bodyGradientId={bodyGradientId} glowId={glowId} />
      <PetArtwork
        state={state}
        meta={meta}
        pose={pose}
        preset={preset}
        reducedMotion={reducedMotion}
        warmGradientId={warmGradientId}
        bodyGradientId={bodyGradientId}
        glowId={glowId}
        dynamic={isDynamic}
      />
    </svg>
  );
}
